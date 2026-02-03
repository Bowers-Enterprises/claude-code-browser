# Story 1.1: Initialize VS Code Extension Project

**Epic:** Extension Foundation
**Priority:** P0
**Estimate:** Small

## Description

As a developer, I need a properly scaffolded VS Code extension project so that I can build the Claude Code Browser with TypeScript and modern tooling.

## Acceptance Criteria

```gherkin
Given I am setting up the Claude Code Browser project
When I initialize the extension scaffold
Then the project has:
  - package.json with extension manifest
  - tsconfig.json for TypeScript compilation
  - .vscode/launch.json for debugging
  - src/extension.ts as entry point
  - .gitignore for node_modules, out/, *.vsix
  - README.md with basic info

Given the extension project is scaffolded
When I run `npm install`
Then all dependencies install without errors

Given dependencies are installed
When I run `npm run compile`
Then TypeScript compiles to out/ directory without errors
```

## Technical Notes

### package.json Key Fields
```json
{
  "name": "claude-code-browser",
  "displayName": "Claude Code Browser",
  "description": "Browse and invoke Claude Code skills, agents, MCP servers, and plugins",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "viewsContainers": {},
    "views": {},
    "commands": []
  }
}
```

### Dependencies
- Dev: `@types/vscode`, `@types/node`, `typescript`, `@vscode/vsce`
- Runtime: None initially (may add `gray-matter` for YAML parsing)

### Scripts
- `compile`: `tsc -p ./`
- `watch`: `tsc -watch -p ./`
- `package`: `vsce package`

## Definition of Done

- [ ] Project structure created
- [ ] package.json with all required fields
- [ ] TypeScript compiles successfully
- [ ] Extension can be loaded in Extension Development Host
- [ ] No linter errors
