/**
 * Worktree-specific commands for Claude Code Browser
 *
 * - Create: Launches a new Claude worktree in a terminal
 * - Resume: Reopens an existing worktree with --resume
 * - Open in Editor: Opens the worktree directory in a new VS Code window
 * - Delete: Removes the worktree via git with confirmation
 * - Launch Task: Creates a worktree and optionally sends a task prompt
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { WorktreeTreeItem } from '../providers/worktreeProvider';

const execFileAsync = promisify(execFile);

/**
 * Register all worktree-related commands
 */
export function registerWorktreeCommands(
  context: vscode.ExtensionContext,
  worktreeProvider: { refresh(): void }
): void {
  context.subscriptions.push(
    // Create a new worktree
    vscode.commands.registerCommand('claudeCodeBrowser.worktree.create', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Enter a name for the worktree',
        title: 'Create Worktree',
        validateInput: (value) => {
          if (!value || !/^[a-zA-Z0-9_-]+$/.test(value)) {
            return 'Name can only contain letters, numbers, hyphens, and underscores';
          }
          const worktreePath = path.join(root, '.claude', 'worktrees', value);
          try {
            const stat = require('fs').statSync(worktreePath);
            if (stat.isDirectory()) {
              return 'A worktree with this name already exists';
            }
          } catch {
            // Directory doesn't exist — good
          }
          return undefined;
        }
      });

      if (!name) {
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: 'Worktree: ' + name,
        cwd: root
      });
      terminal.sendText('claude --worktree ' + name);
      terminal.show();

      // Worktree directory takes a moment to be created
      setTimeout(() => worktreeProvider.refresh(), 2000);
    }),

    // Resume an existing worktree
    vscode.commands.registerCommand('claudeCodeBrowser.worktree.resume', async (item: WorktreeTreeItem) => {
      if (!item?.worktreeInfo) {
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: 'Worktree: ' + item.worktreeInfo.name,
        cwd: item.worktreeInfo.path
      });
      terminal.sendText('claude --resume');
      terminal.show();
    }),

    // Open worktree directory in a new VS Code window
    vscode.commands.registerCommand('claudeCodeBrowser.worktree.openInEditor', async (item: WorktreeTreeItem) => {
      if (!item?.worktreeInfo) {
        return;
      }

      await vscode.commands.executeCommand(
        'vscode.openFolder',
        vscode.Uri.file(item.worktreeInfo.path),
        { forceNewWindow: true }
      );
    }),

    // Delete a worktree with confirmation
    vscode.commands.registerCommand('claudeCodeBrowser.worktree.delete', async (item: WorktreeTreeItem) => {
      if (!item?.worktreeInfo) {
        return;
      }

      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        return;
      }

      const name = item.worktreeInfo.name;

      // First confirmation
      const confirm = await vscode.window.showWarningMessage(
        'Delete worktree "' + name + '"? This will remove the directory and its branch.',
        { modal: true },
        'Delete'
      );
      if (confirm !== 'Delete') {
        return;
      }

      // Second confirmation if dirty
      if (item.worktreeInfo.dirty) {
        const dirtyConfirm = await vscode.window.showWarningMessage(
          'Worktree "' + name + '" has uncommitted changes. Delete anyway?',
          { modal: true },
          'Delete Anyway'
        );
        if (dirtyConfirm !== 'Delete Anyway') {
          return;
        }
      }

      try {
        await execFileAsync('git', ['worktree', 'remove', item.worktreeInfo.path, '--force'], { cwd: root });
        vscode.window.showInformationMessage('Worktree "' + name + '" deleted.');
      } catch (error: any) {
        vscode.window.showErrorMessage('Failed to delete worktree: ' + error.message);
      }

      worktreeProvider.refresh();
    }),

    // Launch a parallel task in a new worktree
    vscode.commands.registerCommand('claudeCodeBrowser.worktree.launchTask', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Name for the parallel worktree',
        title: 'Launch Parallel Task',
        validateInput: (value) => {
          if (!value || !/^[a-zA-Z0-9_-]+$/.test(value)) {
            return 'Name can only contain letters, numbers, hyphens, and underscores';
          }
          const worktreePath = path.join(root, '.claude', 'worktrees', value);
          try {
            const stat = require('fs').statSync(worktreePath);
            if (stat.isDirectory()) {
              return 'A worktree with this name already exists';
            }
          } catch {
            // Directory doesn't exist — good
          }
          return undefined;
        }
      });

      if (!name) {
        return;
      }

      const task = await vscode.window.showInputBox({
        prompt: 'Task description (optional -- press Enter to skip)',
        title: 'Launch Parallel Task'
      });

      // undefined means cancelled, empty string means skipped
      if (task === undefined) {
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: 'Worktree: ' + name,
        cwd: root
      });

      let command: string;
      if (task) {
        const escapedTask = "'" + task.replace(/'/g, "'\\''") + "'";
        command = 'claude --worktree ' + name + ' -p ' + escapedTask;
      } else {
        command = 'claude --worktree ' + name;
      }

      terminal.sendText(command);
      terminal.show();

      // Worktree directory takes a moment to be created
      setTimeout(() => worktreeProvider.refresh(), 2000);
    })
  );
}
