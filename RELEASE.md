# Releasing AutoDocs to GitHub Marketplace

This guide walks you through releasing a new version of the AutoDocs action and publishing it to the [GitHub Marketplace](https://github.com/marketplace).

## Prerequisites

- **Repository is public** (required for Marketplace).
- **Two-factor authentication** enabled on your GitHub account.
- **Marketplace Developer Agreement** accepted: [GitHub Marketplace](https://github.com/marketplace) → your profile → accept terms if prompted.
- **Semantic version** in mind (e.g. `v1.0.0`, `v1.1.0`, `v2.0.0`).

## Release workflow (automated)

When you **publish** or **edit** a release with a semantic tag (e.g. `v1.0.0`), the [Release to Marketplace](.github/workflows/release.yml) workflow:

1. Checks out the code at that tag.
2. Installs dependencies and builds the action (`npm ci && npm run build` → `dist/index.js`).
3. Uses [JasonEtco/build-and-tag-action](https://github.com/JasonEtco/build-and-tag-action) to:
   - Force-push the release tag to a commit that contains only `action.yml` and the built `dist/index.js`.
   - Update the major (and minor) tags (e.g. `v1.0.0` → also update `v1` and `v1.0`) so users can pin `@v1` or `@v1.0`.

So: **you create the release in the GitHub UI; the workflow makes sure the tag points at the built action.**

## Step-by-step: Create a release and publish to Marketplace

### 1. Create a new release on GitHub

1. Open your repo on GitHub.
2. Go to **Releases** → **Draft a new release** (or **Create a new release**).
3. **Choose a tag**:
   - Click **Choose a tag**.
   - Type a new tag, e.g. `v1.0.0`, and create it (from `main` or your default branch).
4. **Release title**: e.g. `v1.0.0` or `AutoDocs v1.0.0`.
5. **Description**: paste or write release notes (e.g. features, fixes).
6. Optionally attach binaries if you use them (the workflow will still build and update the tag).

### 2. Publish the release

- Click **Publish release** (not “Save draft”).
- The **Release to Marketplace** workflow will run, build the action, and update the tag and `v1` / `v1.0` tags.

### 3. Publish to GitHub Marketplace (first time or new version)

- After the release exists, open the **same release** and click **Edit** (pencil icon).
- Scroll to **Publish this Action to the GitHub Marketplace**.
- Check the box.
- Choose **Primary category** (e.g. “Documentation”) and optionally **Secondary category**.
- Complete any remaining fields (e.g. branding is already in `action.yml`).
- Click **Update release**.

Your action will then appear (or update) on the [GitHub Marketplace](https://github.com/marketplace) and users can install it or use `owner/repo@v1` / `@v1.0.0`.

## Versioning

- Use **semantic versioning**: `vMAJOR.MINOR.PATCH` (e.g. `v1.0.0`, `v1.1.0`, `v2.0.0`).
- The workflow keeps **major** and **minor** tags up to date (e.g. `v1` and `v1.0` point to the latest `v1.0.x`).
- Users can pin:
  - `@v1` — latest 1.x
  - `@v1.0` — latest 1.0.x
  - `@v1.0.0` — exact version

## Manual build (optional)

To build locally without publishing:

```bash
npm ci
npm run build
```

Output: `dist/index.js` (bundled with dependencies). The workflow does this on every release.

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Workflow fails on “Install dependencies” | Ensure `package.json` and `package-lock.json` exist and commit `package-lock.json` after running `npm install`. |
| Tag not updated / wrong commit | Check workflow run has `contents: write` and `GITHUB_TOKEN`; re-run the job after fixing. |
| Action not visible on Marketplace | Confirm “Publish this Action to the GitHub Marketplace” is checked in the release edit screen and the repo is public. |
| Marketplace says “metadata invalid” | Ensure a single `action.yml` at repo root and that `name`, `description`, and `runs` are valid. |

## References

- [Publishing actions in GitHub Marketplace](https://docs.github.com/en/actions/sharing-automations/creating-actions/publishing-actions-in-github-marketplace)
- [Releasing and maintaining actions](https://docs.github.com/en/actions/sharing-automations/creating-actions/releasing-and-maintaining-actions)
- [build-and-tag-action](https://github.com/JasonEtco/build-and-tag-action)
