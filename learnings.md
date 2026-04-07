# Claude Code Browser — Learnings

> Project-specific patterns discovered through development and deployment.

---

## VS Code Marketplace Publishing

> Publisher: `chase-bowers` | Listing: https://marketplace.visualstudio.com/items?itemName=chase-bowers.claude-code-browser

### Authentication

1. **VSCE CLI only supports Personal Access Tokens (PATs)** — no browser OAuth option. The `npx vsce login <publisher>` command prompts for a PAT, not a browser flow.
2. **PATs come from Azure DevOps**, not the Azure Portal. URL: `https://dev.azure.com/<org>/_usersSettings/tokens`. If no Azure DevOps org exists, `dev.azure.com/_usersSettings/tokens` returns 404.
3. **PAT scope required**: Organization = "All accessible organizations", Scopes = Custom → Marketplace → Manage.
4. **PATs expire silently** — VSCE caches the token and reuses it. When it expires, you get `TF400813: The user 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' is not authorized`. No clear "token expired" message.
5. **If no Azure DevOps org exists**, sign up at https://aka.ms/SignupAzureDevOps first, then create the PAT.

### Fallback: Web Upload (No PAT Needed)

If PAT auth is broken, upload the VSIX directly:
1. Go to https://marketplace.visualstudio.com/manage/publishers/chase-bowers
2. Find the extension → **...** menu → **Update**
3. Upload the `.vsix` file

### Build & Publish Commands

```bash
# From claude-code-browser directory:
cd "/Users/chasebowers/Documents/AI Workflows/claude-code-browser"

# Compile + package (creates .vsix):
npx vsce package

# Publish with PAT (auto-bumps version):
npx vsce publish patch    # 0.24.1 → 0.24.2
npx vsce publish minor    # 0.24.1 → 0.25.0
npx vsce publish 0.25.0   # explicit version

# If git is dirty, use --no-git-tag-version:
npx vsce publish --no-git-tag-version --no-update-package-json 0.25.0

# Login (stores PAT for future publishes):
npx vsce login chase-bowers
```

### Gotchas (2026-04-07)

- `npx vsce publish patch` runs `npm version patch` internally, which **requires a clean git working directory**. Either commit first or use explicit version with `--no-git-tag-version`.
- The `.vsix` file is built even when publish fails (auth error happens after packaging). So you always have the file for manual upload.
- VSIX files accumulate in the project root — 25+ versions already exist. Consider cleaning old ones periodically.
