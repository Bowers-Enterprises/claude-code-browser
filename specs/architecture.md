# Architecture: Claude Code Browser

> VS Code Extension for browsing and invoking Claude Code resources

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │  extension.ts │   │   Commands   │   │   Providers  │    │
│  │  (Entry)      │──▶│              │──▶│              │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│                                                    │         │
│                           ┌────────────────────────┘         │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                      Parsers                          │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │   │
│  │  │ Skill   │  │ Agent   │  │  MCP    │  │ Plugin  │  │   │
│  │  │ Parser  │  │ Parser  │  │ Parser  │  │ Parser  │  │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
└───────────────────────────│──────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     File System                              │
│  ~/.claude/skills/         ~/.claude/agents/                 │
│  ~/.claude/plugins/        {workspace}/.claude/              │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Structure

```
claude-code-browser/
├── src/
│   ├── extension.ts              # Entry point, activation
│   │
│   ├── providers/                # TreeDataProvider implementations
│   │   ├── index.ts              # Re-exports all providers
│   │   ├── skillsProvider.ts     # Skills TreeDataProvider
│   │   ├── agentsProvider.ts     # Agents TreeDataProvider
│   │   ├── mcpProvider.ts        # MCP Servers TreeDataProvider
│   │   └── pluginsProvider.ts    # Plugins TreeDataProvider
│   │
│   ├── parsers/                  # File parsing utilities
│   │   ├── index.ts              # Re-exports all parsers
│   │   ├── yamlUtils.ts          # Shared YAML frontmatter parsing
│   │   ├── skillParser.ts        # SKILL.md parser
│   │   ├── agentParser.ts        # Agent .md parser
│   │   └── configParser.ts       # JSON config parser (MCP, plugins)
│   │
│   ├── commands/                 # Command implementations
│   │   ├── index.ts              # Register all commands
│   │   ├── invokeCommand.ts      # Click-to-invoke handler
│   │   ├── refreshCommand.ts     # Refresh all providers
│   │   └── searchCommand.ts      # Filter resources
│   │
│   ├── types/                    # TypeScript interfaces
│   │   └── index.ts              # Shared type definitions
│   │
│   └── utils/                    # Utilities
│       ├── paths.ts              # Path resolution (home, workspace)
│       └── fs.ts                 # Safe file reading utilities
│
├── resources/
│   └── icon.svg                  # Activity bar icon
│
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript config
└── .vscodeignore                 # Files to exclude from VSIX
```

---

## Key Components

### 1. Extension Entry Point (`extension.ts`)

**Responsibilities:**
- Handle activation/deactivation lifecycle
- Register all TreeDataProviders
- Register all commands
- Set up error handling

**Interface:**
```typescript
export function activate(context: vscode.ExtensionContext): void;
export function deactivate(): void;
```

### 2. Providers (`providers/*.ts`)

Each provider implements `vscode.TreeDataProvider<T>` where T extends `vscode.TreeItem`.

**Shared Interface:**
```typescript
interface ResourceItem extends vscode.TreeItem {
  name: string;
  description: string;
  scope: 'global' | 'project';
  resourceType: 'skill' | 'agent' | 'mcp' | 'plugin';
  filePath?: string;
  command?: string; // Slash command to invoke
}
```

**Provider Pattern:**
```typescript
class XxxProvider implements vscode.TreeDataProvider<ResourceItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ResourceItem | undefined>;
  readonly onDidChangeTreeData: vscode.Event<ResourceItem | undefined>;

  constructor();
  getChildren(element?: ResourceItem): Promise<ResourceItem[]>;
  getTreeItem(element: ResourceItem): vscode.TreeItem;
  refresh(): void;

  // Internal
  private loadFromPath(path: string, scope: Scope): Promise<ResourceItem[]>;
}
```

### 3. Parsers (`parsers/*.ts`)

Pure functions that parse file contents into structured data.

**Skill Parser:**
```typescript
interface SkillMetadata {
  name: string;
  description: string;
  model?: string;
  allowedTools?: string[];
  filePath: string;
}

function parseSkillFile(filePath: string): Promise<SkillMetadata | null>;
```

**Agent Parser:**
```typescript
interface AgentMetadata {
  name: string;
  description: string;
  tools?: string;
  model?: string;
  filePath: string;
}

function parseAgentFile(filePath: string): Promise<AgentMetadata | null>;
```

**Config Parser:**
```typescript
interface McpServer {
  name: string;
  url: string;
}

interface Plugin {
  name: string;
  version: string;
  marketplace: string;
  installedAt: string;
}

function parseMcpConfig(filePath: string): Promise<McpServer[]>;
function parsePluginsManifest(filePath: string): Promise<Plugin[]>;
```

### 4. Commands (`commands/*.ts`)

**Invoke Command:**
```typescript
function registerInvokeCommand(context: vscode.ExtensionContext): void;
// Handles: claudeCodeBrowser.invokeResource
```

**Refresh Command:**
```typescript
function registerRefreshCommand(
  context: vscode.ExtensionContext,
  providers: AllProviders
): void;
// Handles: claudeCodeBrowser.refresh
```

**Search Command:**
```typescript
function registerSearchCommand(
  context: vscode.ExtensionContext,
  providers: AllProviders
): void;
// Handles: claudeCodeBrowser.search
```

---

## Data Flow

### Loading Resources

```
User opens sidebar
        │
        ▼
Extension activates (if not already)
        │
        ▼
getChildren() called on each provider
        │
        ▼
Provider scans directories:
  - ~/.claude/skills/*/SKILL.md
  - {workspace}/.claude/skills/*/SKILL.md
  - ~/.claude/agents/*.md
  - ~/.claude/plugins/installed_plugins.json
  - {workspace}/.claude/.mcp.json
        │
        ▼
Parsers extract metadata from files
        │
        ▼
ResourceItems created and returned
        │
        ▼
VS Code renders TreeView
```

### Invoking a Resource

```
User clicks resource in TreeView
        │
        ▼
TreeItem.command triggered
        │
        ▼
invokeCommand executes
        │
        ▼
Try: Insert into Claude Code (if API available)
        │
        ├─ Success: Show notification
        │
        └─ Failure: Copy to clipboard
                    │
                    ▼
              Show notification
```

### Refreshing

```
User clicks refresh button
        │
        ▼
refreshCommand executes
        │
        ▼
Each provider.refresh() called
        │
        ▼
onDidChangeTreeData fires
        │
        ▼
VS Code re-calls getChildren()
        │
        ▼
TreeView updates
```

---

## Error Handling Strategy

### File System Errors
- **Missing directory:** Return empty array, no error shown
- **Missing file:** Skip silently, log to console
- **Permission denied:** Log error, show in output channel

### Parse Errors
- **Malformed YAML:** Return null from parser, skip resource
- **Invalid JSON:** Log error, return empty array
- **Missing required fields:** Use defaults or folder name

### Display Errors
- Empty sections show "No [resources] found" message
- Parse failures don't prevent other resources from loading

### Error Logging
```typescript
const outputChannel = vscode.window.createOutputChannel('Claude Code Browser');

function logError(context: string, error: unknown): void {
  outputChannel.appendLine(`[ERROR] ${context}: ${error}`);
}
```

---

## Configuration

### package.json contributes

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "claude-code-browser",
          "title": "Claude Code Browser",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "claude-code-browser": [
        { "id": "claudeCodeBrowser.skills", "name": "Skills" },
        { "id": "claudeCodeBrowser.agents", "name": "Agents" },
        { "id": "claudeCodeBrowser.mcpServers", "name": "MCP Servers" },
        { "id": "claudeCodeBrowser.plugins", "name": "Plugins" }
      ]
    },
    "commands": [
      {
        "command": "claudeCodeBrowser.invokeResource",
        "title": "Invoke Resource"
      },
      {
        "command": "claudeCodeBrowser.refresh",
        "title": "Refresh",
        "icon": "$(refresh)"
      },
      {
        "command": "claudeCodeBrowser.search",
        "title": "Search",
        "icon": "$(search)"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "claudeCodeBrowser.refresh",
          "when": "view =~ /claudeCodeBrowser\\./",
          "group": "navigation"
        },
        {
          "command": "claudeCodeBrowser.search",
          "when": "view =~ /claudeCodeBrowser\\./",
          "group": "navigation"
        }
      ]
    }
  }
}
```

---

## Security Considerations

1. **Read-only access:** Extension only reads files, never writes
2. **No network calls:** All data is local filesystem
3. **No credential exposure:** API keys in MCP configs are not displayed
4. **Sandboxed execution:** Runs within VS Code extension host

---

## Performance Considerations

1. **Lazy loading:** Providers only scan when sidebar is opened
2. **Caching:** Consider caching parsed results (future enhancement)
3. **Async operations:** All file I/O is async to avoid blocking
4. **Minimal dependencies:** Only VS Code API and Node.js built-ins

---

## Testing Strategy

1. **Unit tests:** Parser functions with mock file content
2. **Integration tests:** Provider loading with test fixtures
3. **Manual testing:** Extension Development Host (F5)

---

## Future Enhancements (Out of Scope for MVP)

1. **File watching:** Auto-refresh when files change
2. **Inline preview:** Show skill content in hover
3. **Quick pick:** Cmd+Shift+P integration for quick invoke
4. **Context menu:** Right-click actions (open file, copy path)
5. **Webview:** Richer UI with skill details panel
