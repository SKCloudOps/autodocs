import * as core from '@actions/core'
import * as github from '@actions/github'
import { createAIClient, AIProvider } from './ai'
import {
  getChangedFiles,
  getFileContent,
  getExistingDocs,
  shouldDocument
} from './detector'
import {
  getDocFilePath,
  formatDocContent,
  commitDocs,
  createDocsPR,
  postPRComment,
  GeneratedDoc
} from './writer'

async function run(): Promise<void> {
  try {
    // ── Inputs ──
    const token = core.getInput('github-token', { required: true })
    const provider = core.getInput('ai-provider') as AIProvider
    const apiKey = core.getInput('api-key')
    const docsPath = core.getInput('docs-path') || 'docs'
    const docStyle = core.getInput('doc-style') || 'markdown'
    const languagesInput = core.getInput('languages')
    const autoCommit = core.getInput('auto-commit') === 'true'
    const createPR = core.getInput('create-pr') === 'true'
    const minLines = parseInt(core.getInput('min-lines') || '10')
    const excludeInput = core.getInput('exclude-paths')
    const postComment = core.getInput('post-comment') === 'true'

    const allowedExtensions = languagesInput
      ? languagesInput.split(',').map(l => l.trim().toLowerCase())
      : []
    const excludePatterns = excludeInput
      ? excludeInput.split(',').map(p => p.trim())
      : []

    // ── Validate provider ──
    if (!['github-models', 'openai', 'anthropic'].includes(provider)) {
      core.setFailed(`Invalid ai-provider: '${provider}'. Must be github-models, openai, or anthropic.`)
      return
    }

    if (provider !== 'github-models' && !apiKey) {
      core.setFailed(`api-key is required when using provider '${provider}'`)
      return
    }

    core.info(`🚀 AutoDocs starting...`)
    core.info(`🤖 AI provider: ${provider}`)
    core.info(`📁 Docs path: ${docsPath}`)
    core.info(`📝 Style: ${docStyle}`)

    const octokit = github.getOctokit(token)
    const context = github.context
    const { owner, repo } = context.repo

    const branch = context.payload.pull_request
      ? context.payload.pull_request.head.ref
      : context.ref.replace('refs/heads/', '')

    const ref = context.payload.pull_request
      ? context.payload.pull_request.head.sha
      : context.sha

    // ── Get changed files ──
    const changedFiles = await getChangedFiles(octokit, owner, repo, context)
    core.info(`📋 Found ${changedFiles.length} changed files`)

    if (changedFiles.length === 0) {
      core.info('ℹ️ No changed files found — nothing to document')
      core.setOutput('docs-generated', '0')
      core.setOutput('files-analysed', '0')
      core.setOutput('docs-path', docsPath)
      return
    }

    // ── Get existing docs for style reference ──
    const existingDocs = await getExistingDocs(octokit, owner, repo, docsPath, ref)

    // ── Create AI client ──
    const ai = createAIClient(provider, token, apiKey)

    // ── Filter and document files ──
    const generatedDocs: GeneratedDoc[] = []
    let filesAnalysed = 0

    for (const file of changedFiles) {
      const lineCount = file.additions + file.deletions

      if (!shouldDocument(file.filename, allowedExtensions, excludePatterns, minLines, lineCount)) {
        core.info(`⏭️ Skipping: ${file.filename}`)
        continue
      }

      core.info(`🔍 Analysing: ${file.filename}`)
      filesAnalysed++

      // Get file content
      const code = await getFileContent(octokit, owner, repo, file.filename, ref)
      if (!code) {
        core.warning(`⚠️ Could not read content of ${file.filename}`)
        continue
      }

      // Generate docs
      const rawDocs = await ai.generateDocs(code, file.filename, existingDocs, docStyle)
      if (!rawDocs) {
        core.warning(`⚠️ Failed to generate docs for ${file.filename}`)
        continue
      }

      // Format and prepare doc file
      const docFile = getDocFilePath(file.filename, docsPath, docStyle)
      const content = formatDocContent(rawDocs, file.filename, docStyle, provider)

      // Check if doc file already exists
      const existingDoc = await getFileContent(octokit, owner, repo, docFile, ref)

      generatedDocs.push({
        sourceFile: file.filename,
        docFile,
        content,
        isNew: !existingDoc
      })

      core.info(`✅ Generated docs for: ${file.filename} → ${docFile}`)
    }

    core.info(`📊 Analysed ${filesAnalysed} files, generated ${generatedDocs.length} docs`)

    if (generatedDocs.length === 0) {
      core.info('ℹ️ No documentation generated')
      core.setOutput('docs-generated', '0')
      core.setOutput('files-analysed', String(filesAnalysed))
      core.setOutput('docs-path', docsPath)
      return
    }

    // ── Deliver docs ──
    let prUrl: string | null = null
    let committed = false

    if (createPR) {
      // Create a separate PR for docs
      prUrl = await createDocsPR(
        octokit, owner, repo, generatedDocs, branch,
        `📝 AutoDocs: Generated documentation for ${generatedDocs.length} files`
      )
    } else if (autoCommit) {
      // Commit directly to branch
      committed = await commitDocs(
        generatedDocs, branch,
        `📝 AutoDocs: Generated documentation for ${generatedDocs.length} files`
      )
    }

    // ── Post PR comment ──
    if (postComment && context.payload.pull_request) {
      const prNumber = context.payload.pull_request.number
      await postPRComment(
        octokit, owner, repo, prNumber,
        generatedDocs, prUrl, committed, provider
      )
    }

    // ── Write job summary ──
    const newDocs = generatedDocs.filter(d => d.isNew).length
    const updatedDocs = generatedDocs.filter(d => !d.isNew).length

    await core.summary
      .addHeading('📝 AutoDocs — Documentation Report')
      .addTable([
        [{ data: 'Metric', header: true }, { data: 'Value', header: true }],
        ['AI Provider', provider],
        ['Files Analysed', String(filesAnalysed)],
        ['Docs Generated', String(generatedDocs.length)],
        ['New Files', String(newDocs)],
        ['Updated Files', String(updatedDocs)],
        ['Docs Path', docsPath],
        ['Style', docStyle],
      ])
      .addHeading('Files Documented', 3)
      .addTable([
        [{ data: 'Source File', header: true }, { data: 'Doc File', header: true }, { data: 'Status', header: true }],
        ...generatedDocs.map(d => [d.sourceFile, d.docFile, d.isNew ? '🆕 New' : '🔄 Updated'])
      ])
      .write()

    // ── Set outputs ──
    core.setOutput('docs-generated', String(generatedDocs.length))
    core.setOutput('files-analysed', String(filesAnalysed))
    core.setOutput('docs-path', docsPath)

    core.info(`✅ AutoDocs complete — ${generatedDocs.length} docs generated`)

  } catch (error) {
    core.setFailed(`AutoDocs failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

run()
