/**
 * Commands for managing virtual folders in the Claude Code Browser.
 */

import * as vscode from 'vscode';
import { FolderManager } from '../services/folderManager';
import { ResourceType } from '../types';
import { FolderItem } from '../providers/folderItem';

/**
 * Get resource type from a view ID
 */
function getResourceTypeFromViewId(viewId?: string): ResourceType | undefined {
  if (!viewId) return undefined;
  if (viewId.includes('skills')) return 'skill';
  if (viewId.includes('agents')) return 'agent';
  if (viewId.includes('mcpServers')) return 'mcp';
  if (viewId.includes('plugins')) return 'plugin';
  return undefined;
}

/**
 * Get resource type from a tree item's context value
 */
function getResourceTypeFromItem(item: unknown): ResourceType | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const obj = item as Record<string, unknown>;
  if (obj.resourceType === 'skill') return 'skill';
  if (obj.resourceType === 'agent') return 'agent';
  if (obj.resourceType === 'mcp') return 'mcp';
  if (obj.resourceType === 'plugin') return 'plugin';
  return undefined;
}

/**
 * Get the item identifier (filePath or name) for folder assignment
 */
function getItemKey(item: unknown): string | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const obj = item as Record<string, unknown>;

  // MCP items use filePath:name as key
  if (obj.resourceType === 'mcp' && obj.filePath && obj.name) {
    return `${obj.filePath}:${obj.name}`;
  }

  // Plugins use name as key
  if (obj.resourceType === 'plugin' && obj.name) {
    return obj.name as string;
  }

  // Skills and agents use filePath
  if (obj.filePath) {
    return obj.filePath as string;
  }

  return undefined;
}

/**
 * Register all folder-related commands
 */
export function registerFolderCommands(
  context: vscode.ExtensionContext,
  folderManager: FolderManager
): void {
  // Create folder command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.createFolder', async (viewId?: string) => {
      let resourceType = getResourceTypeFromViewId(viewId);

      // If no view ID, ask user to select section
      if (!resourceType) {
        const section = await vscode.window.showQuickPick(
          [
            { label: 'Skills', value: 'skill' as ResourceType },
            { label: 'Agents', value: 'agent' as ResourceType },
            { label: 'MCP Servers', value: 'mcp' as ResourceType },
            { label: 'Plugins', value: 'plugin' as ResourceType }
          ],
          { placeHolder: 'Select section for new folder' }
        );
        if (!section) return;
        resourceType = section.value;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Enter folder name',
        placeHolder: 'My Folder',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Folder name cannot be empty';
          }
          return null;
        }
      });

      if (name) {
        await folderManager.createFolder(resourceType, name.trim());
        vscode.window.showInformationMessage(`Created folder "${name}"`);
      }
    })
  );

  // Rename folder command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.renameFolder', async (item: FolderItem) => {
      if (!(item instanceof FolderItem)) {
        vscode.window.showErrorMessage('Please select a folder to rename');
        return;
      }

      const newName = await vscode.window.showInputBox({
        prompt: 'Enter new folder name',
        value: item.folder.name,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Folder name cannot be empty';
          }
          return null;
        }
      });

      if (newName && newName.trim() !== item.folder.name) {
        await folderManager.renameFolder(item.resourceType, item.folder.id, newName.trim());
        vscode.window.showInformationMessage(`Renamed folder to "${newName}"`);
      }
    })
  );

  // Delete folder command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.deleteFolder', async (item: FolderItem) => {
      if (!(item instanceof FolderItem)) {
        vscode.window.showErrorMessage('Please select a folder to delete');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Delete folder "${item.folder.name}"? Items will return to root level.`,
        { modal: true },
        'Delete'
      );

      if (confirm === 'Delete') {
        await folderManager.deleteFolder(item.resourceType, item.folder.id);
        vscode.window.showInformationMessage(`Deleted folder "${item.folder.name}"`);
      }
    })
  );

  // Move to folder command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.moveToFolder', async (item: unknown) => {
      const resourceType = getResourceTypeFromItem(item);
      const itemKey = getItemKey(item);

      if (!resourceType || !itemKey) {
        vscode.window.showErrorMessage('Please select an item to move');
        return;
      }

      const folders = folderManager.getFolders(resourceType);

      const options = [
        { label: '$(home) Root Level', folderId: undefined as string | undefined },
        ...folders.map(f => ({ label: `$(folder) ${f.name}`, folderId: f.id }))
      ];

      if (options.length === 1) {
        vscode.window.showInformationMessage('No folders exist. Create a folder first.');
        return;
      }

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select destination folder'
      });

      if (selected !== undefined) {
        await folderManager.assignItemToFolder(resourceType, itemKey, selected.folderId);
        const destination = selected.folderId ?
          folders.find(f => f.id === selected.folderId)?.name : 'root level';
        vscode.window.showInformationMessage(`Moved to ${destination}`);
      }
    })
  );

  // Move to root command (convenience command)
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.moveToRoot', async (item: unknown) => {
      const resourceType = getResourceTypeFromItem(item);
      const itemKey = getItemKey(item);

      if (!resourceType || !itemKey) {
        vscode.window.showErrorMessage('Please select an item to move');
        return;
      }

      await folderManager.assignItemToFolder(resourceType, itemKey, undefined);
      vscode.window.showInformationMessage('Moved to root level');
    })
  );
}
