/**
 * Commands for exporting and importing skill bundles
 *
 * - Export Bundle: Zips selected skills into a .zip file
 * - Import Bundle: Extracts skills from a .zip file into global or project skills
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { SkillItem, SkillsProvider } from '../providers/skillsProvider';
import { exportBundle, importBundle, completeImport } from '../services/bundleService';

export function registerBundleCommands(
  context: vscode.ExtensionContext,
  skillsProvider: SkillsProvider
): void {
  // Export Bundle - zip selected skills
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.exportBundle', async (item: SkillItem, allItems?: SkillItem[]) => {
      const items = allItems && allItems.length > 0 ? allItems : (item ? [item] : []);
      const validItems = items.filter(i => i?.filePath);

      if (validItems.length === 0) {
        vscode.window.showErrorMessage('No skills selected. Select skills first, then right-click → Export as Bundle.');
        return;
      }

      // Get skill folder paths
      const skillFolders = validItems.map(i => path.dirname(i.filePath));
      const skillNames = skillFolders.map(f => path.basename(f));

      // Ask where to save
      const defaultName = skillNames.length === 1
        ? `${skillNames[0]}.zip`
        : `claude-skills-bundle.zip`;

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(os.homedir(), 'Desktop', defaultName)),
        filters: { 'Zip Archive': ['zip'] },
        title: `Export ${validItems.length} Skill${validItems.length > 1 ? 's' : ''} as Bundle`
      });

      if (!saveUri) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Exporting ${validItems.length} skill${validItems.length > 1 ? 's' : ''}...`,
            cancellable: false
          },
          async () => {
            await exportBundle(skillFolders, saveUri.fsPath);
          }
        );

        const action = await vscode.window.showInformationMessage(
          `Bundle exported: ${path.basename(saveUri.fsPath)} (${skillNames.length} skill${skillNames.length > 1 ? 's' : ''})`,
          'Reveal in Finder'
        );

        if (action === 'Reveal in Finder') {
          await vscode.commands.executeCommand('revealFileInOS', saveUri);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export bundle: ${error}`);
      }
    })
  );

  // Import Bundle - extract skills from zip
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.importBundle', async () => {
      // Open file dialog
      const fileUris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'Zip Archive': ['zip'] },
        title: 'Import Skill Bundle'
      });

      if (!fileUris || fileUris.length === 0) {
        return;
      }

      const zipPath = fileUris[0].fsPath;

      // Ask where to import
      const destination = await vscode.window.showQuickPick(
        [
          { label: 'Global Skills', description: '~/.claude/skills/', target: 'global' },
          { label: 'Project Skills', description: '.claude/skills/ (current project)', target: 'project' }
        ],
        {
          placeHolder: 'Where should the skills be imported?',
          title: 'Import Destination'
        }
      );

      if (!destination) {
        return;
      }

      const targetDir = destination.target === 'global'
        ? path.join(os.homedir(), '.claude', 'skills')
        : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.claude', 'skills');

      if (destination.target === 'project' && !vscode.workspace.workspaceFolders?.[0]) {
        vscode.window.showErrorMessage('No workspace folder open. Cannot import to project.');
        return;
      }

      try {
        // Check for conflicts first
        const preview = await importBundle(zipPath, targetDir);

        if (preview.imported.length === 0) {
          vscode.window.showWarningMessage('No skills found in the bundle.');
          return;
        }

        let skipConflicts: string[] = [];
        let replaceConflicts: string[] = [];

        // Handle conflicts
        if (preview.conflicts.length > 0) {
          const conflictChoice = await vscode.window.showWarningMessage(
            `${preview.conflicts.length} skill${preview.conflicts.length > 1 ? 's' : ''} already exist${preview.conflicts.length === 1 ? 's' : ''}: ${preview.conflicts.join(', ')}`,
            { modal: true },
            'Replace All',
            'Skip Conflicts'
          );

          if (!conflictChoice) {
            return;
          }

          if (conflictChoice === 'Replace All') {
            replaceConflicts = preview.conflicts;
          } else {
            skipConflicts = preview.conflicts;
          }
        }

        // Do the import
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Importing skills...',
            cancellable: false
          },
          async () => {
            return await completeImport(zipPath, targetDir, skipConflicts, replaceConflicts);
          }
        );

        let msg = `Imported ${result.imported.length} skill${result.imported.length !== 1 ? 's' : ''}.`;
        if (result.skipped.length > 0) {
          msg += ` Skipped ${result.skipped.length}.`;
        }
        vscode.window.showInformationMessage(msg);

        skillsProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to import bundle: ${error}`);
      }
    })
  );
}
