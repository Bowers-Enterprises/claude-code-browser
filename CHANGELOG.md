# Changelog

All notable changes to the Claude Code Browser extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-02-03

### Added
- **Virtual Folders**: Organize skills, agents, MCP servers, and plugins into custom folders without affecting the file system
- **Drag and Drop**: Drag items into folders to organize them
- **Multi-select Support**: Select multiple items (Cmd+click or Shift+click) and move them all at once
- **Folder Management**: Create, rename, and delete folders via toolbar and context menu
- **Global MCP Config**: Now reads MCP servers from both project (`.mcp.json`) and global (`~/.claude/.mcp.json`) config files
- **Clear Filter Button**: Dedicated button to clear search filters (appears when filter is active)

### Fixed
- MCP servers now load from global config in addition to project config

## [0.1.0] - 2025-02-03

### Added
- Initial release
- **Skills Browser**: View and invoke skills from global (`~/.claude/skills/`) and project (`.claude/skills/`) directories
- **Agents Browser**: Browse custom agents from `~/.claude/agents/`
- **MCP Servers**: View configured MCP servers from `.claude/.mcp.json`
- **Plugins Browser**: See installed plugins from `~/.claude/plugins/`
- **Search/Filter**: Filter resources across all categories
- **Refresh**: Rescan directories for new resources
- **Scope Badges**: Visual indicators for global vs project-specific resources
- **Click-to-invoke**: Copy resource commands to clipboard with one click
