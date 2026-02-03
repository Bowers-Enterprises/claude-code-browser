/**
 * TreeDataProvider for Claude Code Skills
 *
 * Scans both global (~/.claude/skills/) and project-specific (.claude/skills/)
 * directories for SKILL.md files and displays them in the VS Code tree view.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { ResourceItem, ResourceScope, SkillMetadata } from '../types';
import { parseSkillFile, isValidSkillMetadata } from '../parsers/skillParser';

/**
 * Tree item representing a skill in the sidebar
 */
export class SkillItem extends vscode.TreeItem implements ResourceItem {
  public readonly resourceType = 'skill' as const;

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
 * TreeDataProvider that discovers and displays Claude Code skills
 */
export class SkillsProvider implements vscode.TreeDataProvider<SkillItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SkillItem | undefined | null | void> =
    new vscode.EventEmitter<SkillItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<SkillItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private filterText: string = '';

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
  getTreeItem(element: SkillItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get all skill items (no hierarchy, flat list)
   */
  async getChildren(element?: SkillItem): Promise<SkillItem[]> {
    // Skills are flat, no children
    if (element) {
      return [];
    }

    try {
      let skills: SkillItem[] = [];

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

      // Apply filter if set
      if (this.filterText) {
        skills = skills.filter(item =>
          item.name.toLowerCase().includes(this.filterText) ||
          item.resourceDescription.toLowerCase().includes(this.filterText)
        );
      }

      // Sort alphabetically by name
      skills.sort((a, b) => a.name.localeCompare(b.name));

      return skills;
    } catch (error) {
      console.error('[SkillsProvider] Error getting skills:', error);
      return [];
    }
  }

  /**
   * Get the global skills directory path
   */
  private getGlobalSkillsPath(): string {
    return path.join(os.homedir(), '.claude', 'skills');
  }

  /**
   * Scan a directory for skill folders containing SKILL.md files
   *
   * @param dirPath - Directory to scan
   * @param scope - Whether this is a global or project directory
   * @returns Array of SkillItem objects
   */
  private async scanDirectory(dirPath: string, scope: ResourceScope): Promise<SkillItem[]> {
    const skills: SkillItem[] = [];

    try {
      // Check if directory exists
      await fs.access(dirPath);
    } catch {
      // Directory doesn't exist, return empty array
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
          // Check if SKILL.md exists
          await fs.access(skillPath);

          // Read and parse the skill file
          const content = await fs.readFile(skillPath, 'utf-8');
          const metadata = parseSkillFile(content, skillPath);

          if (isValidSkillMetadata(metadata)) {
            const skillItem = this.createSkillItem(metadata, scope);
            skills.push(skillItem);
          }
        } catch {
          // SKILL.md doesn't exist or couldn't be read, skip this folder
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
   *
   * @param metadata - Parsed skill metadata
   * @param scope - Whether this is a global or project skill
   * @returns SkillItem for the tree view
   */
  private createSkillItem(metadata: SkillMetadata, scope: ResourceScope): SkillItem {
    // Generate invoke command with "/" prefix
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
