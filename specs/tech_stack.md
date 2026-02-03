# Tech Stack: Claude Code Browser

---

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Runtime | Node.js | 18+ | Extension host runtime |
| Language | TypeScript | 5.x | Type-safe development |
| Framework | VS Code Extension API | 1.85.0+ | Extension platform |

---

## Dependencies

### Production Dependencies
**None** - The extension uses only VS Code API and Node.js built-ins.

This is intentional:
- Smaller bundle size
- Fewer security risks
- No dependency maintenance
- Faster load time

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/vscode` | ^1.85.0 | VS Code API types |
| `@types/node` | ^18 | Node.js types |
| `typescript` | ^5.0.0 | TypeScript compiler |
| `@vscode/vsce` | ^2.22.0 | Extension packaging |
| `esbuild` | ^0.19.0 | Fast bundling (optional) |

---

## VS Code API Usage

### Core APIs

| API | Purpose |
|-----|---------|
| `vscode.window.createTreeView()` | Create sidebar TreeView |
| `vscode.TreeDataProvider` | Provide data for TreeView |
| `vscode.TreeItem` | Individual tree nodes |
| `vscode.commands.registerCommand()` | Register commands |
| `vscode.env.clipboard` | Clipboard access |
| `vscode.workspace.workspaceFolders` | Get workspace root |
| `vscode.window.showInformationMessage()` | Notifications |
| `vscode.ThemeIcon` | Built-in icons |

### Extension Manifest APIs

| Feature | Package.json Key |
|---------|------------------|
| Activity bar icon | `contributes.viewsContainers.activitybar` |
| Sidebar views | `contributes.views` |
| Commands | `contributes.commands` |
| Menu items | `contributes.menus` |

---

## Build Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "lib": ["ES2021"],
    "sourceMap": true,
    "rootDir": "src",
    "outDir": "out",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true
  },
  "exclude": ["node_modules", ".vscode-test"]
}
```

### package.json Scripts

```json
{
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src --ext ts",
    "package": "vsce package",
    "publish": "vsce publish"
  }
}
```

---

## File Format Support

### YAML Frontmatter (Skills, Agents)

**Parser:** Custom regex-based parser (no external dependencies)

```typescript
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
```

**Alternative if needed:** `gray-matter` package for complex YAML

### JSON (MCP, Plugins)

**Parser:** Built-in `JSON.parse()`

```typescript
const data = JSON.parse(await fs.readFile(path, 'utf-8'));
```

---

## Project Structure

```
claude-code-browser/
├── .vscode/
│   ├── launch.json           # Debug configuration
│   ├── tasks.json            # Build tasks
│   └── extensions.json       # Recommended extensions
│
├── src/
│   ├── extension.ts
│   ├── providers/
│   ├── parsers/
│   ├── commands/
│   ├── types/
│   └── utils/
│
├── resources/
│   └── icon.svg
│
├── out/                      # Compiled JavaScript (gitignored)
│
├── specs/                    # BMAD specifications
│
├── package.json
├── tsconfig.json
├── .gitignore
├── .vscodeignore
├── CLAUDE.md
└── README.md
```

---

## VS Code Extension Manifest

### package.json (Key Fields)

```json
{
  "name": "claude-code-browser",
  "displayName": "Claude Code Browser",
  "description": "Browse and invoke Claude Code skills, agents, MCP servers, and plugins",
  "version": "0.1.0",
  "publisher": "your-publisher-id",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "viewsContainers": { ... },
    "views": { ... },
    "commands": { ... },
    "menus": { ... }
  }
}
```

---

## Development Workflow

### Setup
```bash
cd claude-code-browser
npm install
```

### Compile
```bash
npm run compile
```

### Debug (F5 in VS Code)
Opens Extension Development Host with extension loaded.

### Package
```bash
npm run package
# Creates claude-code-browser-0.1.0.vsix
```

### Install Locally
```bash
code --install-extension claude-code-browser-0.1.0.vsix
```

---

## Compatibility Matrix

| VS Code Version | Node.js | Status |
|-----------------|---------|--------|
| 1.85.0+ | 18+ | Supported |
| 1.80.0 - 1.84.x | 16+ | May work, untested |
| < 1.80.0 | - | Not supported |

---

## Icon

### Activity Bar Icon (`resources/icon.svg`)

Requirements:
- 24x24 SVG
- Single color (uses VS Code's icon coloring)
- Simple, recognizable shape

Options:
1. Custom SVG (brain + code symbol)
2. Use Codicon as fallback: `$(symbol-misc)`

---

## Alternative Considerations

### Why No React/Webview?
- Overkill for simple TreeView
- Adds bundle size and complexity
- TreeView API is sufficient for MVP
- Can add Webview later for rich details panel

### Why No External YAML Parser?
- Simple frontmatter parsing is trivial
- Avoids dependency management
- No complex YAML features needed
- Can add `gray-matter` later if edge cases appear

### Why Not esbuild for Bundling?
- TypeScript compiler is sufficient for this size
- Can add esbuild later for:
  - Faster builds
  - Tree shaking
  - Smaller output

---

## Security Checklist

- [x] No network requests
- [x] Read-only file access
- [x] No credential storage
- [x] No credential display
- [x] Sandboxed in extension host
- [x] No eval() or dynamic code execution
- [x] No external process spawning
