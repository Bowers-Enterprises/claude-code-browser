# Contributing to Claude Code Browser

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/claude-code-browser.git
   cd claude-code-browser
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Building

```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-recompile on changes)
npm run watch
```

### Testing Locally

1. Press `F5` in VS Code to launch the Extension Development Host
2. The extension will be loaded in a new VS Code window
3. Test your changes in the sidebar panel

### Packaging

```bash
npm run package
```

This creates a `.vsix` file you can install locally to test the full package.

## Code Style

- **TypeScript**: Use TypeScript for all source files
- **No external dependencies**: Keep the extension lightweight
- **VS Code API only**: Use built-in VS Code APIs where possible
- **Clear naming**: Use descriptive variable and function names
- **Comments**: Add comments for complex logic, but prefer self-documenting code

## Project Structure

```
src/
├── extension.ts          # Entry point
├── types/index.ts        # Shared interfaces
├── parsers/              # File format parsers
│   ├── skillParser.ts    # SKILL.md YAML frontmatter
│   ├── agentParser.ts    # Agent markdown files
│   └── configParser.ts   # JSON config files
├── providers/            # TreeDataProviders for sidebar
│   ├── skillsProvider.ts
│   ├── agentsProvider.ts
│   ├── mcpProvider.ts
│   └── pluginsProvider.ts
└── commands/             # Command handlers
    ├── index.ts
    ├── invokeCommand.ts
    ├── searchCommand.ts
    └── refreshCommand.ts
```

## Pull Request Process

1. **Update documentation**: If you change functionality, update the README
2. **Keep PRs focused**: One feature or fix per PR
3. **Write clear commit messages**: Describe what and why
4. **Test thoroughly**: Ensure the extension works with various Claude Code setups

### PR Title Format

```
feat: Add new feature
fix: Fix bug in skills parser
docs: Update README
refactor: Improve provider structure
```

## Reporting Issues

When reporting issues, please include:

- VS Code version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Any error messages from the Output panel

## Feature Requests

Feature requests are welcome! Please:

1. Check existing issues first
2. Describe the use case
3. Explain why it would be valuable

## Questions?

Open an issue with the `question` label.

---

Thank you for contributing!
