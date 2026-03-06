/**
 * Tree items for companion files and directories within a skill folder.
 *
 * SkillFileItem: leaf node for individual files (click to open)
 * SkillDirectoryItem: collapsible node for subdirectories
 */

import * as vscode from "vscode";
import * as path from "path";

/**
 * Tree item representing a companion file inside a skill directory.
 * Clicking opens the file in the appropriate editor.
 */
export class SkillFileItem extends vscode.TreeItem {
  public readonly itemType = "skill-file" as const;

  constructor(
    public readonly name: string,
    public readonly absolutePath: string,
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);

    this.id = `skill-file:${absolutePath}`;
    this.contextValue = "skill-file";
    this.resourceUri = vscode.Uri.file(absolutePath);
    this.iconPath = vscode.ThemeIcon.File;
    this.tooltip = absolutePath;
    this.description = path.extname(absolutePath) || "";

    this.command = {
      command: "claudeCodeBrowser.openSkillFile",
      title: "Open File",
      arguments: [this],
    };
  }

  /** Compatibility with existing revealInFinder / copyPath commands */
  get filePath(): string {
    return this.absolutePath;
  }
}

/**
 * Tree item representing a subdirectory inside a skill directory.
 * Expands to show its contents.
 */
export class SkillDirectoryItem extends vscode.TreeItem {
  public readonly itemType = "skill-directory" as const;

  constructor(
    public readonly name: string,
    public readonly absolutePath: string,
    childCount: number,
  ) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);

    this.id = `skill-dir:${absolutePath}`;
    this.contextValue = "skill-directory";
    this.iconPath = vscode.ThemeIcon.Folder;
    this.description = childCount > 0 ? `(${childCount})` : "";
    this.tooltip = absolutePath;
  }

  /** Compatibility with existing revealInFinder / copyPath commands */
  get filePath(): string {
    return this.absolutePath;
  }
}

export function isSkillFileItem(item: unknown): item is SkillFileItem {
  return item instanceof SkillFileItem;
}

export function isSkillDirectoryItem(
  item: unknown,
): item is SkillDirectoryItem {
  return item instanceof SkillDirectoryItem;
}
