/**
 * TreeDataProvider for Claude Code git worktrees.
 *
 * Manages worktrees stored in {workspace}/.claude/worktrees/ directory.
 * Shows each worktree with its branch, dirty status, and active terminal state.
 * Watches the filesystem and terminal lifecycle to keep the view current.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface WorktreeInfo {
  name: string;
  branch: string;
  path: string;
  dirty: boolean;
  hasActiveTerminal: boolean;
}

export class WorktreeTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly worktreeInfo?: WorktreeInfo
  ) {
    super(label, collapsibleState);
  }
}

export class WorktreeProvider implements vscode.TreeDataProvider<WorktreeTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WorktreeTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private fsWatcher: fs.FSWatcher | undefined;
  private terminalOpenListener: vscode.Disposable | undefined;
  private terminalCloseListener: vscode.Disposable | undefined;

  constructor() {
    this.startWatching();
    this.watchTerminals();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: WorktreeTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorktreeTreeItem): Promise<WorktreeTreeItem[]> {
    // Flat list — no nesting
    if (element) {
      return [];
    }

    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!root) {
      const empty = new WorktreeTreeItem('No workspace open', vscode.TreeItemCollapsibleState.None);
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty];
    }

    // Check if workspace is a git repo
    try {
      await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root });
    } catch {
      const empty = new WorktreeTreeItem('Not a git repository', vscode.TreeItemCollapsibleState.None);
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty];
    }

    const worktreesDir = path.join(root, '.claude', 'worktrees');

    if (!fs.existsSync(worktreesDir)) {
      const empty = new WorktreeTreeItem('No worktrees yet', vscode.TreeItemCollapsibleState.None);
      empty.description = 'Click + to create one';
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty];
    }

    // Read directory entries, keep only directories
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(worktreesDir, { withFileTypes: true })
        .filter(d => d.isDirectory());
    } catch {
      return [];
    }

    if (entries.length === 0) {
      const empty = new WorktreeTreeItem('No worktrees yet', vscode.TreeItemCollapsibleState.None);
      empty.description = 'Click + to create one';
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty];
    }

    // Build WorktreeInfo for each directory
    const items: WorktreeTreeItem[] = [];

    for (const entry of entries) {
      const dirPath = path.join(worktreesDir, entry.name);
      const info = await this.getWorktreeInfo(dirPath);

      const item = new WorktreeTreeItem(
        info.name,
        vscode.TreeItemCollapsibleState.None,
        info
      );

      // Description: branch name, plus dirty indicator
      item.description = info.branch + (info.dirty ? ' *' : '');

      // Icon based on state
      if (info.hasActiveTerminal) {
        item.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.green'));
      } else if (info.dirty) {
        item.iconPath = new vscode.ThemeIcon('git-branch', new vscode.ThemeColor('list.warningForeground'));
      } else {
        item.iconPath = new vscode.ThemeIcon('git-branch');
      }

      // Tooltip
      const tooltipLines = [
        `**${info.name}**`,
        '',
        `Branch: \`${info.branch}\``,
        `Path: ${info.path}`,
        `Status: ${info.dirty ? 'Uncommitted changes' : 'Clean'}`,
      ];
      const md = new vscode.MarkdownString(tooltipLines.join('\n'));
      md.isTrusted = true;
      item.tooltip = md;

      // Context value for menus
      item.contextValue = info.hasActiveTerminal ? 'worktree-active' : 'worktree';

      // Click to resume — pass the item itself as the argument
      item.command = {
        command: 'claudeCodeBrowser.worktree.resume',
        title: 'Resume Worktree',
        arguments: [item]
      };

      items.push(item);
    }

    // Sort alphabetically by name
    items.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));

    return items;
  }

  private async getWorktreeInfo(dirPath: string): Promise<WorktreeInfo> {
    const name = path.basename(dirPath);

    // Resolve branch
    let branch: string;
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dirPath });
      branch = stdout.trim();
    } catch {
      branch = 'worktree-' + name;
    }

    // Check for uncommitted changes
    let dirty = false;
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: dirPath });
      dirty = stdout.trim() !== '';
    } catch {
      dirty = false;
    }

    // Check for active terminal
    const hasActiveTerminal = vscode.window.terminals.some(
      t => t.name === 'Worktree: ' + name
    );

    return {
      name,
      branch,
      path: dirPath,
      dirty,
      hasActiveTerminal,
    };
  }

  private startWatching(): void {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { return; }

    const worktreesDir = path.join(root, '.claude', 'worktrees');
    if (!fs.existsSync(worktreesDir)) { return; }

    try {
      this.fsWatcher = fs.watch(worktreesDir, () => this.refresh());
    } catch {
      // Ignore watch errors (e.g., directory deleted mid-session)
    }
  }

  private watchTerminals(): void {
    this.terminalOpenListener = vscode.window.onDidOpenTerminal(() => this.refresh());
    this.terminalCloseListener = vscode.window.onDidCloseTerminal(() => this.refresh());
  }

  dispose(): void {
    this.fsWatcher?.close();
    this.terminalOpenListener?.dispose();
    this.terminalCloseListener?.dispose();
  }
}
