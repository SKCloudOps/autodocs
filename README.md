# 📝 AutoDocs

> AI that writes your documentation so your team doesn't have to.

[![GitHub Marketplace](https://img.shields.io/badge/GitHub-Marketplace-blue?logo=github)](https://github.com/marketplace/actions/autodocs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

AutoDocs is a GitHub Action that automatically generates professional documentation every time code changes — on every PR and push. It reads your changed files, sends them to AI, and commits the generated docs back to your repo.

**Supports OpenAI, Anthropic Claude, and GitHub Models. Works with any language or build system.**

---

## 🚀 Quick Start

```yaml
- uses: SKCloudOps/autodocs@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    ai-provider: github-models   # free, no extra key needed
```

Add `permissions: contents: write` to your job for auto-commit to work.

---

## 💬 What It Does

When code changes on a PR, AutoDocs:

1. Detects which files changed
2. Filters to documentable code files
3. Reads the changed code
4. Sends it to AI with context from your existing docs
5. Generates or updates documentation
6. Commits docs back to the branch (or opens a separate PR)
7. Posts a summary comment on the PR

---

## 🤖 AI Providers

| Provider | Cost | Setup |
|---|---|---|
| `github-models` | Free (rate limited) | Just needs `models: read` permission |
| `openai` | Pay per use | Add `OPENAI_API_KEY` secret |
| `anthropic` | Pay per use | Add `ANTHROPIC_API_KEY` secret |

---

## ⚙️ Inputs

| Input | Default | Description |
|---|---|---|
| `github-token` | `${{ github.token }}` | Required for reading code and committing docs |
| `ai-provider` | `github-models` | AI provider: `github-models`, `openai`, `anthropic` |
| `api-key` | `` | API key for OpenAI or Anthropic |
| `docs-path` | `docs` | Directory to write generated docs |
| `doc-style` | `markdown` | Style: `markdown`, `jsdoc`, `docstring`, `rst` |
| `languages` | all | Comma-separated extensions: `ts,py,go,java` |
| `auto-commit` | `true` | Commit docs directly to the branch |
| `create-pr` | `false` | Create a separate PR for docs |
| `min-lines` | `10` | Skip files with fewer lines than this |
| `exclude-paths` | `test/**,dist/**,...` | Glob patterns to exclude |
| `post-comment` | `true` | Post a summary comment on the PR |

---

## 📤 Outputs

| Output | Description |
|---|---|
| `docs-generated` | Number of doc files generated |
| `files-analysed` | Number of code files analysed |
| `docs-path` | Path where docs were written |

---

## 📋 Full Example

```yaml
name: Auto-generate docs

on:
  pull_request:
    types: [opened, synchronize]
  push:
    branches: [main]

jobs:
  autodocs:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      models: read

    steps:
      - uses: actions/checkout@v4

      - uses: SKCloudOps/autodocs@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          ai-provider: github-models
          docs-path: docs
          doc-style: markdown
          auto-commit: true
          min-lines: 10
```

---

## 🌍 Supported Languages

TypeScript, JavaScript, Python, Go, Java, Ruby, Rust, C#, C++, PHP, Swift, Kotlin, Terraform, Shell and more.

---

## 📄 License

MIT · Built by [SKCloudOps](https://github.com/SKCloudOps)
