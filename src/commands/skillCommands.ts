/**
 * Skill-specific commands for Claude Code Browser
 *
 * - Preview: Opens SKILL.md in markdown preview mode
 * - Convert to Global: Copies project skill to ~/.claude/skills/
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { SkillItem, SkillsProvider } from '../providers/skillsProvider';

/**
 * Register skill-specific commands
 */
export function registerSkillCommands(
  context: vscode.ExtensionContext,
  skillsProvider: SkillsProvider
): void {
  // Preview Skill command - opens SKILL.md in markdown preview
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.previewSkill', async (item: SkillItem) => {
      if (!item?.filePath) {
        vscode.window.showErrorMessage('No skill selected');
        return;
      }

      try {
        const uri = vscode.Uri.file(item.filePath);
        await vscode.commands.executeCommand('markdown.showPreview', uri);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to preview skill: ${error}`);
      }
    })
  );

  // Convert to Global Skill command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.convertToGlobalSkill', async (item: SkillItem) => {
      if (!item?.filePath) {
        vscode.window.showErrorMessage('No skill selected');
        return;
      }

      if (item.scope !== 'project') {
        vscode.window.showInformationMessage('This skill is already global');
        return;
      }

      try {
        // Get the skill folder (parent directory of SKILL.md)
        const skillFolder = path.dirname(item.filePath);
        const skillName = path.basename(skillFolder);
        const globalSkillsDir = path.join(os.homedir(), '.claude', 'skills');
        const targetDir = path.join(globalSkillsDir, skillName);

        // Ask user whether to move or copy
        const action = await vscode.window.showQuickPick(
          [
            { label: 'Move', description: 'Move to global (removes from project)', action: 'move' },
            { label: 'Copy', description: 'Copy to global (keeps project version)', action: 'copy' }
          ],
          { placeHolder: `Convert "${skillName}" to global skill`, title: 'Convert to Global Skill' }
        );

        if (!action) {
          return;
        }

        // Check if target already exists
        let targetExists = false;
        try {
          await fs.access(targetDir);
          targetExists = true;
        } catch {
          // Target doesn't exist
        }

        if (targetExists) {
          const choice = await vscode.window.showWarningMessage(
            `A global skill named "${skillName}" already exists. Replace it?`,
            { modal: true },
            'Replace',
            'Cancel'
          );

          if (choice !== 'Replace') {
            return;
          }

          await fs.rm(targetDir, { recursive: true, force: true });
        }

        // Ensure global skills directory exists
        await fs.mkdir(globalSkillsDir, { recursive: true });

        // Copy the skill folder recursively
        await copyDirectory(skillFolder, targetDir);

        // If moving, delete the original
        if (action.action === 'move') {
          await fs.rm(skillFolder, { recursive: true, force: true });
          vscode.window.showInformationMessage(`Skill "${skillName}" moved to global.`);
        } else {
          vscode.window.showInformationMessage(`Skill "${skillName}" copied to global.`);
        }

        // Refresh the skills view
        skillsProvider.refresh();

      } catch (error) {
        vscode.window.showErrorMessage(`Failed to convert skill: ${error}`);
      }
    })
  );
}

/**
 * Recursively copy a directory and all its contents
 */
async function copyDirectory(source: string, target: string): Promise<void> {
  // Create target directory
  await fs.mkdir(target, { recursive: true });

  // Read source directory
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      await copyDirectory(sourcePath, targetPath);
    } else {
      // Copy file
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}
