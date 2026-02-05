# Changelog

All notable changes to the Claude Code Browser extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2025-02-05

### Added
- **Reveal in Finder**: Right-click any skill or agent → "Reveal in Finder" to open in OS file explorer
- **Copy Path**: Right-click any skill or agent → "Copy Path" to copy the file path to clipboard
- **Duplicate Skills**: Right-click a skill → "Duplicate Skill" to clone the entire skill folder (auto-names with "-copy" suffix)
- **Duplicate Agents**: Right-click an agent → "Duplicate Agent" to clone the agent file
- **Rename Skills**: Right-click a skill → "Rename Skill" to rename the skill folder in place
- **Rename Agents**: Right-click an agent → "Rename Agent" to rename the agent file
- Context menu now organized into clear sections: Actions → Management → Move → Delete

## [0.9.0] - 2025-02-05

### Added
- **Edit Skills**: Right-click a skill and select "Edit Skill" to open SKILL.md in the text editor
- **Edit Agents**: Right-click an agent and select "Edit Agent" to open the .md file in the text editor
- **Delete Skills**: Right-click a skill and select "Delete Skill" to remove it (with confirmation dialog)
  - Supports multi-select: select multiple skills and delete them all at once
- **Delete Agents**: Right-click an agent and select "Delete Agent" to remove it (with confirmation dialog)
  - Supports multi-select: select multiple agents and delete them all at once

## [0.8.0] - 2025-02-05

### Added
- **Create Skill from Research**: Generate comprehensive prompts for Claude Code to research a topic and create a skill
  - Click the lightbulb icon (💡) in the Skills panel toolbar or right-click → "Create Skill from Research"
  - Enter a topic (e.g., "Playwright testing best practices")
  - Prompt is copied to clipboard with research instructions, SKILL.md template, and quality criteria
  - Paste into Claude Code to have it research and create the skill
- **Auto-detect New Skills**: Extension now watches `~/.claude/skills/` for new skills
  - Shows notification when a new skill is created
  - Click "Preview" to open the new skill immediately

## [0.7.3] - 2025-02-05

### Added
- **Preview Agents**: Click the preview icon or right-click → "Preview Agent" to open agent .md files in markdown preview
- **Preview MCP Servers**: Click the preview icon or right-click → "Preview MCP Config" to open the .mcp.json config file

## [0.7.2] - 2025-02-04

### Added
- **Multi-select support for Convert to Global**: Select multiple project skills (Cmd+click or Shift+click) and convert them all at once
  - Shows count of skills being converted
  - Prompts individually for any name conflicts

## [0.7.1] - 2025-02-04

### Changed
- **Convert to Global Skill**: Now offers Move or Copy options
  - Move: Transfers skill to global and removes from project (no duplicates)
  - Copy: Keeps both project and global versions

## [0.7.0] - 2025-02-04

### Added
- **Preview Skills**: Open SKILL.md in VS Code's markdown preview
  - Click the preview icon (👁) that appears when hovering over a skill
  - Or right-click a skill and select "Preview Skill"
  - Works for both global and project skills
- **Convert to Global Skill**: Promote project skills to global with one click
  - Right-click a project skill and select "Convert to Global Skill"
  - Copies the entire skill folder to `~/.claude/skills/`
  - Prompts for confirmation if a global skill with the same name exists

## [0.6.0] - 2025-02-04

### Added
- **Panel Visibility Manager**: Hide panels you don't use
  - "Manage Panels" command opens a checklist to toggle panels on/off
  - "Show All Panels" command to restore all panels
  - Preferences persist across VS Code sessions
  - Access via the list icon (≡) in any panel's toolbar

## [0.5.0] - 2025-02-03

### Added
- **Skill Marketplace**: Browse and install community skills with one click
  - **Staff Picks**: 15 curated skills from daymade, lackeyjb, obra, trailofbits
  - Categories: Productivity, Automation, Code Quality, Documentation, Testing, Deployment
  - Real skills: GitHub Ops, Playwright, TDD, Systematic Debugging, Static Analysis, Markdown Tools, PDF Creator, and more
  - **Add Your Own Sources**: Click "+" to add any GitHub repo containing skills
  - Skills from user sources are fetched and cached automatically
  - Right-click to Install or View on GitHub
- Toolbar buttons in Marketplace: Refresh, Add Source

## [0.4.0] - 2025-02-03

### Added
- **Custom Prompts Library**: Create, edit, and manage your own reusable prompts
  - "My Prompts" category at the top of Commands view
  - Create prompts with custom names, descriptions, and icons
  - Edit and delete prompts via right-click context menu
  - Export prompts to JSON for backup or sharing
  - Import prompts from JSON files (merge or replace modes)
- Toolbar buttons in Commands view: New Prompt (+), Export, Import

## [0.3.0] - 2025-02-03

### Added
- **Commands Section**: New panel with curated Claude Code commands and prompts
  - CLI Flags: `--dangerously-skip-permissions`, `--print`, `--verbose`, `--model`, `--resume`, `--continue`
  - Slash Commands: `/clear`, `/compact`, `/cost`, `/doctor`, `/help`, `/init`, `/memory`, `/model`, `/permissions`, `/review`, `/vim`, `/config`, `/status`, `/bug`
  - Quick Prompts: Run Autonomously, Fix All Errors, Write Tests, Explain Code, Refactor, Add Types, Security Review, Optimize, Add Docs, Commit, Create PR, Debug
- Click any command to copy it to clipboard
- Search/filter works across commands too

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
