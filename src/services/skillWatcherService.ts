/**
 * FileSystemWatcher service for detecting new skills in ~/.claude/skills/
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';

export class SkillWatcherService {
  private watcher: vscode.FileSystemWatcher | undefined;
  private knownSkills: Set<string> = new Set();
  private onNewSkillCallback: ((skillName: string) => void) | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  async start(onNewSkill: (skillName: string) => void): Promise<void> {
    this.onNewSkillCallback = onNewSkill;

    const globalSkillsPath = path.join(os.homedir(), '.claude', 'skills');

    // Index existing skills
    await this.indexExistingSkills(globalSkillsPath);

    // Watch for new SKILL.md files
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(globalSkillsPath),
      '**/SKILL.md'
    );

    this.watcher = vscode.workspace.createFileSystemWatcher(pattern, false, true, true);

    this.watcher.onDidCreate(async (uri) => {
      const skillFolder = path.dirname(uri.fsPath);
      const skillName = path.basename(skillFolder);

      if (!this.knownSkills.has(skillName)) {
        this.knownSkills.add(skillName);
        this.onNewSkillCallback?.(skillName);
      }
    });

    this.context.subscriptions.push(this.watcher);
  }

  private async indexExistingSkills(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          this.knownSkills.add(entry.name);
        }
      }
    } catch {
      // Directory may not exist yet
    }
  }

  dispose(): void {
    this.watcher?.dispose();
  }
}
