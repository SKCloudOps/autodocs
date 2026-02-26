import * as core from '@actions/core'

export type AIProvider = 'github-models' | 'openai' | 'anthropic'

export interface AIClient {
  provider: AIProvider
  generateDocs(code: string, filename: string, existingDocs: string, style: string): Promise<string | null>
}

// ─────────────────────────────────────────────
// GITHUB MODELS
// ─────────────────────────────────────────────

async function callGitHubModels(
  prompt: string,
  token: string
): Promise<string | null> {
  try {
    const response = await fetch('https://models.github.ai/inference/chat/completions', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.2
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const err = await response.text()
      core.warning(`⚠️ GitHub Models API returned ${response.status}: ${err}`)
      return null
    }

    const data = await response.json() as unknown as {
      choices: { message: { content: string } }[]
    }
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch (err) {
    core.warning(`⚠️ GitHub Models failed: ${err}`)
    return null
  }
}

// ─────────────────────────────────────────────
// OPENAI
// ─────────────────────────────────────────────

async function callOpenAI(
  prompt: string,
  apiKey: string
): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.2
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const err = await response.text()
      core.warning(`⚠️ OpenAI API returned ${response.status}: ${err}`)
      return null
    }

    const data = await response.json() as unknown as {
      choices: { message: { content: string } }[]
    }
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch (err) {
    core.warning(`⚠️ OpenAI failed: ${err}`)
    return null
  }
}

// ─────────────────────────────────────────────
// ANTHROPIC
// ─────────────────────────────────────────────

async function callAnthropic(
  prompt: string,
  apiKey: string
): Promise<string | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const err = await response.text()
      core.warning(`⚠️ Anthropic API returned ${response.status}: ${err}`)
      return null
    }

    const data = await response.json() as unknown as {
      content: { type: string; text: string }[]
    }
    return data.content
      ?.filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim() || null
  } catch (err) {
    core.warning(`⚠️ Anthropic failed: ${err}`)
    return null
  }
}

// ─────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────

function buildPrompt(
  code: string,
  filename: string,
  existingDocs: string,
  style: string
): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const language = detectLanguage(ext)
  const styleGuide = getStyleGuide(style, language)

  const existingContext = existingDocs
    ? `\n\nExisting documentation in this project for reference (match this style):\n\`\`\`\n${existingDocs.substring(0, 500)}\n\`\`\`\n`
    : ''

  return `You are a technical documentation expert. Generate professional documentation for the following ${language} code.

File: ${filename}
${existingContext}
Documentation style: ${styleGuide}

Rules:
- Be concise and accurate — document what the code actually does
- Focus on WHY and HOW, not just WHAT (the code already shows what)
- Include: overview, parameters/inputs, return values, examples where useful
- Do NOT include implementation details that belong in code comments
- Do NOT wrap output in markdown code fences
- Output ONLY the documentation, nothing else

Code to document:
\`\`\`${language}
${code.substring(0, 4000)}
\`\`\``
}

function detectLanguage(ext: string): string {
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript',
    js: 'JavaScript', jsx: 'JavaScript',
    py: 'Python',
    go: 'Go',
    java: 'Java',
    rb: 'Ruby',
    rs: 'Rust',
    tf: 'Terraform',
    yml: 'YAML', yaml: 'YAML',
    sh: 'Shell',
    cs: 'C#',
    cpp: 'C++', cc: 'C++',
    c: 'C',
    php: 'PHP',
    swift: 'Swift',
    kt: 'Kotlin'
  }
  return map[ext] || 'code'
}

function getStyleGuide(style: string, language: string): string {
  switch (style) {
    case 'jsdoc':
      return 'JSDoc format with @param, @returns, @example tags'
    case 'docstring':
      return language === 'Python'
        ? 'Python docstring format (Google style)'
        : 'Inline docstring format'
    case 'rst':
      return 'reStructuredText format with :param:, :type:, :returns:'
    default:
      return 'Clean Markdown with ## headings, parameter tables, and code examples'
  }
}

// ─────────────────────────────────────────────
// MAIN AI CLIENT
// ─────────────────────────────────────────────

export function createAIClient(
  provider: AIProvider,
  token: string,
  apiKey: string
): AIClient {
  return {
    provider,
    async generateDocs(
      code: string,
      filename: string,
      existingDocs: string,
      style: string
    ): Promise<string | null> {
      const prompt = buildPrompt(code, filename, existingDocs, style)
      core.info(`🤖 Generating docs for ${filename} using ${provider}...`)

      switch (provider) {
        case 'github-models':
          return callGitHubModels(prompt, token)
        case 'openai':
          return callOpenAI(prompt, apiKey)
        case 'anthropic':
          return callAnthropic(prompt, apiKey)
        default:
          core.warning(`Unknown provider: ${provider}`)
          return null
      }
    }
  }
}
