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

  // Convert to Global Skill command (supports multi-select)
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.convertToGlobalSkill', async (item: SkillItem, allItems?: SkillItem[]) => {
      // Handle multi-select: use allItems if provided, otherwise single item
      const items = allItems && allItems.length > 0 ? allItems : (item ? [item] : []);

      // Filter to only project skills
      const projectSkills = items.filter(i => i?.filePath && i.scope === 'project');

      if (projectSkills.length === 0) {
        vscode.window.showErrorMessage('No project skills selected');
        return;
      }

      const skillNames = projectSkills.map(s => path.basename(path.dirname(s.filePath)));
      const isMultiple = projectSkills.length > 1;

      try {
        // Ask user whether to move or copy
        const action = await vscode.window.showQuickPick(
          [
            { label: 'Move', description: 'Move to global (removes from project)', action: 'move' },
            { label: 'Copy', description: 'Copy to global (keeps project version)', action: 'copy' }
          ],
          {
            placeHolder: isMultiple
              ? `Convert ${projectSkills.length} skills to global`
              : `Convert "${skillNames[0]}" to global skill`,
            title: 'Convert to Global Skill'
          }
        );

        if (!action) {
          return;
        }

        const globalSkillsDir = path.join(os.homedir(), '.claude', 'skills');
        await fs.mkdir(globalSkillsDir, { recursive: true });

        let converted = 0;
        let skipped = 0;

        for (const skill of projectSkills) {
          const skillFolder = path.dirname(skill.filePath);
          const skillName = path.basename(skillFolder);
          const targetDir = path.join(globalSkillsDir, skillName);

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
              `Global skill "${skillName}" already exists. Replace it?`,
              { modal: true },
              'Replace',
              'Skip'
            );

            if (choice !== 'Replace') {
              skipped++;
              continue;
            }

            await fs.rm(targetDir, { recursive: true, force: true });
          }

          // Copy the skill folder
          await copyDirectory(skillFolder, targetDir);

          // If moving, delete the original
          if (action.action === 'move') {
            await fs.rm(skillFolder, { recursive: true, force: true });
          }

          converted++;
        }

        // Show result message
        if (isMultiple) {
          const verb = action.action === 'move' ? 'moved' : 'copied';
          let msg = `${converted} skill${converted !== 1 ? 's' : ''} ${verb} to global.`;
          if (skipped > 0) {
            msg += ` ${skipped} skipped.`;
          }
          vscode.window.showInformationMessage(msg);
        } else if (converted > 0) {
          const verb = action.action === 'move' ? 'moved' : 'copied';
          vscode.window.showInformationMessage(`Skill "${skillNames[0]}" ${verb} to global.`);
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
