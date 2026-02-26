import * as core from '@actions/core'
import * as github from '@actions/github'

export interface ChangedFile {
  filename: string
  status: 'added' | 'modified' | 'renamed' | 'removed'
  additions: number
  deletions: number
  patch?: string
}

// File extensions worth documenting
const DOCUMENTABLE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx',
  'py', 'go', 'java', 'rb',
  'rs', 'cs', 'cpp', 'cc', 'c',
  'php', 'swift', 'kt',
  'tf',       // Terraform
  'sh',       // Shell scripts
])

// Paths to always skip
const DEFAULT_SKIP_PATTERNS = [
  /node_modules/,
  /\.test\./,
  /\.spec\./,
  /dist\//,
  /build\//,
  /__pycache__/,
  /\.min\./,
  /vendor\//,
  /\.d\.ts$/,  // TypeScript declaration files
]

export function shouldDocument(
  filename: string,
  allowedExtensions: string[],
  excludePatterns: string[],
  minLines: number,
  lineCount: number
): boolean {
  // Check minimum lines
  if (lineCount < minLines) return false

  // Check extension
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const allowed = allowedExtensions.length > 0
    ? allowedExtensions
    : Array.from(DOCUMENTABLE_EXTENSIONS)
  if (!allowed.includes(ext)) return false

  // Check default skip patterns
  for (const pattern of DEFAULT_SKIP_PATTERNS) {
    if (pattern.test(filename)) return false
  }

  // Check user-defined exclude patterns
  for (const pattern of excludePatterns) {
    const regex = new RegExp(
      pattern.trim().replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
    )
    if (regex.test(filename)) return false
  }

  return true
}

export async function getChangedFiles(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  context: typeof github.context
): Promise<ChangedFile[]> {
  try {
    // PR context
    if (context.payload.pull_request) {
      const prNumber = context.payload.pull_request.number
      const { data } = await octokit.rest.pulls.listFiles({
        owner, repo, pull_number: prNumber, per_page: 100
      })
      return data
        .filter(f => f.status !== 'removed')
        .map(f => ({
          filename: f.filename,
          status: f.status as ChangedFile['status'],
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch
        }))
    }

    // Push context — compare commits
    if (context.payload.before && context.payload.after) {
      const { data } = await octokit.rest.repos.compareCommits({
        owner, repo,
        base: context.payload.before,
        head: context.payload.after
      })
      return (data.files || [])
        .filter(f => f.status !== 'removed')
        .map(f => ({
          filename: f.filename,
          status: f.status as ChangedFile['status'],
          additions: f.additions || 0,
          deletions: f.deletions || 0,
          patch: f.patch
        }))
    }

    core.warning('⚠️ Could not determine changed files — not a PR or push event')
    return []
  } catch (err) {
    core.warning(`⚠️ Failed to get changed files: ${err}`)
    return []
  }
}

export async function getFileContent(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner, repo, path, ref
    })
    if ('content' in data && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8')
    }
    return null
  } catch {
    return null
  }
}

export async function getExistingDocs(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  docsPath: string,
  ref: string
): Promise<string> {
  try {
    // Try to read an existing doc file for style reference
    const { data } = await octokit.rest.repos.getContent({
      owner, repo, path: docsPath, ref
    })

    if (Array.isArray(data) && data.length > 0) {
      // Read first markdown file found
      const mdFile = data.find(f => f.name.endsWith('.md'))
      if (mdFile && 'download_url' in mdFile && mdFile.download_url) {
        const content = await getFileContent(
          octokit, owner, repo, mdFile.path, ref
        )
        return content?.substring(0, 500) || ''
      }
    }
    return ''
  } catch {
    return ''
  }
}
