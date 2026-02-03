/**
 * TreeDataProvider for Claude Code Skills
 *
 * Scans both global (~/.claude/skills/) and project-specific (.claude/skills/)
 * directories for SKILL.md files and displays them in the VS Code tree view.
 * Supports virtual folder organization with drag-and-drop.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { ResourceItem, ResourceScope, SkillMetadata } from '../types';
import { parseSkillFile, isValidSkillMetadata } from '../parsers/skillParser';
import { FolderManager } from '../services/folderManager';
import { FolderItem, isFolderItem } from './folderItem';

/** Union type for all tree items in the skills view */
export type SkillTreeItem = SkillItem | FolderItem;

/**
 * Tree item representing a skill in the sidebar
 */
export class SkillItem extends vscode.TreeItem implements ResourceItem {
  public readonly resourceType = 'skill' as const;
  public readonly itemType = 'skill' as const;

  constructor(
    public readonly name: string,
    public readonly resourceDescription: string,
    public readonly scope: ResourceScope,
    public readonly filePath: string,
    public readonly invokeCommand: string
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);

    // Set the description shown after the label (e.g., "(Global)")
    this.description = scope === 'global' ? '(Global)' : '(Project)';

    // Set tooltip to show full description
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${name}**\n\n`);
    if (resourceDescription) {
      this.tooltip.appendMarkdown(`${resourceDescription}\n\n`);
    }
    this.tooltip.appendMarkdown(`*Scope:* ${scope}\n\n`);
    this.tooltip.appendMarkdown(`*Invoke:* \`${invokeCommand}\``);

    // Set icon based on scope
    this.iconPath = scope === 'global'
      ? new vscode.ThemeIcon('globe')
      : new vscode.ThemeIcon('folder-opened');

    // Set context value for menu contributions
    this.contextValue = 'skill';

    // Set command to invoke when clicked
    this.command = {
      command: 'claudeCodeBrowser.invokeResource',
      title: 'Invoke Skill',
      arguments: [this]
    };
  }
}

/**
 * Type guard for SkillItem
 */
export function isSkillItem(item: unknown): item is SkillItem {
  return item instanceof SkillItem;
}

/**
 * TreeDataProvider that discovers and displays Claude Code skills
 * with support for virtual folder organization and drag-and-drop.
 */
export class SkillsProvider implements
  vscode.TreeDataProvider<SkillTreeItem>,
  vscode.TreeDragAndDropController<SkillTreeItem> {

  // Drag and drop MIME types
  readonly dropMimeTypes = ['application/vnd.code.tree.claudecodebrowser.skills'];
  readonly dragMimeTypes = ['application/vnd.code.tree.claudecodebrowser.skills'];

  private _onDidChangeTreeData = new vscode.EventEmitter<SkillTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filterText: string = '';
  private treeView?: vscode.TreeView<SkillTreeItem>;

  constructor(private folderManager: FolderManager) {
    // Listen for folder changes
    this.folderManager.onDidChange(type => {
      if (type === 'skill') {
        this.refresh();
      }
    });
  }

  /**
   * Create and return the tree view with drag-and-drop support
   */
  createTreeView(): vscode.TreeView<SkillTreeItem> {
    this.treeView = vscode.window.createTreeView('claudeCodeBrowser.skills', {
      treeDataProvider: this,
      dragAndDropController: this,
      canSelectMany: true
    });
    return this.treeView;
  }

  /**
   * Set filter text and refresh the view
   */
  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this.refresh();
  }

  /**
   * Clear the filter and refresh the view
   */
  clearFilter(): void {
    this.filterText = '';
    this.refresh();
  }

  /**
   * Refresh the tree view by firing the change event
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item for display
   */
  getTreeItem(element: SkillTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for the tree view with folder hierarchy support
   */
  async getChildren(element?: SkillTreeItem): Promise<SkillTreeItem[]> {
    try {
      // Get all skills first
      const allSkills = await this.getAllSkills();

      // Root level: return folders + unassigned items
      if (!element) {
        const folders = this.folderManager.getFolders('skill');
        const result: SkillTreeItem[] = [];

        // Add folders first (sorted alphabetically)
        const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));
        for (const folder of sortedFolders) {
          const itemsInFolder = allSkills.filter(
            s => this.folderManager.getFolderForItem('skill', s.filePath) === folder.id
          );
          // Apply filter to folder - show if folder name matches or has matching items
          if (this.filterText) {
            const folderMatches = folder.name.toLowerCase().includes(this.filterText);
            const hasMatchingItems = itemsInFolder.some(item =>
              item.name.toLowerCase().includes(this.filterText) ||
              item.resourceDescription.toLowerCase().includes(this.filterText)
            );
            if (!folderMatches && !hasMatchingItems) {
              continue;
            }
          }
          result.push(new FolderItem(folder, 'skill', itemsInFolder.length));
        }

        // Add unassigned items
        const unassignedSkills = allSkills.filter(
          s => !this.folderManager.getFolderForItem('skill', s.filePath)
        );
        const filteredUnassigned = this.applyFilter(unassignedSkills);
        result.push(...filteredUnassigned.sort((a, b) => a.name.localeCompare(b.name)));

        return result;
      }

      // Folder children: return items assigned to this folder
      if (isFolderItem(element)) {
        const folderSkills = allSkills.filter(
          s => this.folderManager.getFolderForItem('skill', s.filePath) === element.folder.id
        );
        const filteredSkills = this.applyFilter(folderSkills);
        return filteredSkills.sort((a, b) => a.name.localeCompare(b.name));
      }

      // Skill items have no children
      return [];
    } catch (error) {
      console.error('[SkillsProvider] Error getting children:', error);
      return [];
    }
  }

  /**
   * Handle drag start - prepare data for transfer
   */
  handleDrag(
    source: readonly SkillTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): void {
    // Only allow dragging skill items, not folders
    const skillItems = source.filter(isSkillItem);
    if (skillItems.length > 0) {
      const filePaths = skillItems.map(s => s.filePath);
      dataTransfer.set(
        'application/vnd.code.tree.claudecodebrowser.skills',
        new vscode.DataTransferItem(filePaths)
      );
    }
  }

  /**
   * Handle drop - move items to target folder
   */
  async handleDrop(
    target: SkillTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const transferItem = dataTransfer.get('application/vnd.code.tree.claudecodebrowser.skills');
    if (!transferItem) {
      return;
    }

    const filePaths: string[] = transferItem.value;
    if (!filePaths || filePaths.length === 0) {
      return;
    }

    // Determine target folder
    let targetFolderId: string | undefined;
    if (isFolderItem(target)) {
      targetFolderId = target.folder.id;
    }
    // If dropping on root or a skill item, move to root level

    // Move all dragged items to target folder
    await this.folderManager.assignItemsToFolder('skill', filePaths, targetFolderId);
  }

  /**
   * Apply filter to skill items
   */
  private applyFilter(items: SkillItem[]): SkillItem[] {
    if (!this.filterText) {
      return items;
    }
    return items.filter(item =>
      item.name.toLowerCase().includes(this.filterText) ||
      item.resourceDescription.toLowerCase().includes(this.filterText)
    );
  }

  /**
   * Get all skills from all sources (without hierarchy)
   */
  private async getAllSkills(): Promise<SkillItem[]> {
    const skills: SkillItem[] = [];

    // Scan global skills
    const globalSkills = await this.scanDirectory(this.getGlobalSkillsPath(), 'global');
    skills.push(...globalSkills);

    // Scan project skills for each workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const projectSkillsPath = path.join(folder.uri.fsPath, '.claude', 'skills');
        const projectSkills = await this.scanDirectory(projectSkillsPath, 'project');
        skills.push(...projectSkills);
      }
    }

    return skills;
  }

  /**
   * Get the global skills directory path
   */
  private getGlobalSkillsPath(): string {
    return path.join(os.homedir(), '.claude', 'skills');
  }

  /**
   * Scan a directory for skill folders containing SKILL.md files
   */
  private async scanDirectory(dirPath: string, scope: ResourceScope): Promise<SkillItem[]> {
    const skills: SkillItem[] = [];

    try {
      await fs.access(dirPath);
    } catch {
      return skills;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const skillPath = path.join(dirPath, entry.name, 'SKILL.md');

        try {
          await fs.access(skillPath);
          const content = await fs.readFile(skillPath, 'utf-8');
          const metadata = parseSkillFile(content, skillPath);

          if (isValidSkillMetadata(metadata)) {
            const skillItem = this.createSkillItem(metadata, scope);
            skills.push(skillItem);
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.warn(`[SkillsProvider] Error scanning directory ${dirPath}:`, error);
    }

    return skills;
  }

  /**
   * Create a SkillItem from parsed metadata
   */
  private createSkillItem(metadata: SkillMetadata, scope: ResourceScope): SkillItem {
    const invokeCommand = `/${metadata.name}`;
    return new SkillItem(
      metadata.name,
      metadata.description,
      scope,
      metadata.filePath,
      invokeCommand
    );
  }
}
