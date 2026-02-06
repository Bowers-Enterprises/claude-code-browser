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
function getResourceTypeFromViewId(viewId?: unknown): ResourceType | undefined {
  if (!viewId || typeof viewId !== 'string') return undefined;
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
    vscode.commands.registerCommand('claudeCodeBrowser.createFolder', async (arg?: unknown) => {
      let resourceType = getResourceTypeFromViewId(arg);

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

  // Create subfolder command (right-click on folder)
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.createSubfolder', async (item: FolderItem) => {
      if (!(item instanceof FolderItem)) {
        vscode.window.showErrorMessage('Please select a folder');
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: `Create subfolder inside "${item.folder.name}"`,
        placeHolder: 'Subfolder Name',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Folder name cannot be empty';
          }
          return null;
        }
      });

      if (name) {
        await folderManager.createFolder(item.resourceType, name.trim(), item.folder.id);
        vscode.window.showInformationMessage(`Created subfolder "${name}" inside "${item.folder.name}"`);
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
        `Delete folder "${item.folder.name}" and all sub-folders? Items will return to root level.`,
        { modal: true },
        'Delete'
      );

      if (confirm === 'Delete') {
        await folderManager.deleteFolder(item.resourceType, item.folder.id);
        vscode.window.showInformationMessage(`Deleted folder "${item.folder.name}"`);
      }
    })
  );

  // Move to folder command (supports multi-select)
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.moveToFolder', async (clickedItem: unknown, selectedItems?: unknown[]) => {
      // Use selected items if available, otherwise fall back to clicked item
      const items = selectedItems && selectedItems.length > 0 ? selectedItems : [clickedItem];

      // Filter to only non-folder items and extract keys
      const validItems: { resourceType: ResourceType; key: string }[] = [];
      for (const item of items) {
        // Skip folder items
        if (item && typeof item === 'object' && (item as Record<string, unknown>).itemType === 'folder') {
          continue;
        }
        const resourceType = getResourceTypeFromItem(item);
        const key = getItemKey(item);
        if (resourceType && key) {
          validItems.push({ resourceType, key });
        }
      }

      if (validItems.length === 0) {
        vscode.window.showErrorMessage('Please select items to move');
        return;
      }

      // All items must be same resource type
      const resourceType = validItems[0].resourceType;
      const mixedTypes = validItems.some(i => i.resourceType !== resourceType);
      if (mixedTypes) {
        vscode.window.showErrorMessage('Cannot move items of different types together');
        return;
      }

      const allFolders = folderManager.getFolders(resourceType);

      // Build hierarchical folder list with indentation
      const options: { label: string; folderId: string | undefined }[] = [
        { label: '$(home) Root Level', folderId: undefined as string | undefined }
      ];

      function addFolderOptions(parentId: string | undefined, indent: number): void {
        const children = allFolders.filter(f => f.parentId === parentId);
        children.sort((a, b) => a.name.localeCompare(b.name));
        for (const folder of children) {
          const prefix = indent > 0 ? '\u00A0\u00A0'.repeat(indent) + '$(folder) ' : '$(folder) ';
          options.push({ label: `${prefix}${folder.name}`, folderId: folder.id });
          addFolderOptions(folder.id, indent + 1);
        }
      }
      addFolderOptions(undefined, 0);

      if (options.length === 1) {
        vscode.window.showInformationMessage('No folders exist. Create a folder first.');
        return;
      }

      const itemCount = validItems.length;
      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: `Select destination folder for ${itemCount} item${itemCount > 1 ? 's' : ''}`
      });

      if (selected !== undefined) {
        const keys = validItems.map(i => i.key);
        await folderManager.assignItemsToFolder(resourceType, keys, selected.folderId);
        const destination = selected.folderId ?
          allFolders.find(f => f.id === selected.folderId)?.name : 'root level';
        vscode.window.showInformationMessage(`Moved ${itemCount} item${itemCount > 1 ? 's' : ''} to ${destination}`);
      }
    })
  );

  // Move to root command (convenience command, supports multi-select)
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.moveToRoot', async (clickedItem: unknown, selectedItems?: unknown[]) => {
      // Use selected items if available, otherwise fall back to clicked item
      const items = selectedItems && selectedItems.length > 0 ? selectedItems : [clickedItem];

      // Filter to only non-folder items and extract keys
      const validItems: { resourceType: ResourceType; key: string }[] = [];
      for (const item of items) {
        // Skip folder items
        if (item && typeof item === 'object' && (item as Record<string, unknown>).itemType === 'folder') {
          continue;
        }
        const resourceType = getResourceTypeFromItem(item);
        const key = getItemKey(item);
        if (resourceType && key) {
          validItems.push({ resourceType, key });
        }
      }

      if (validItems.length === 0) {
        vscode.window.showErrorMessage('Please select items to move');
        return;
      }

      // All items must be same resource type
      const resourceType = validItems[0].resourceType;
      const mixedTypes = validItems.some(i => i.resourceType !== resourceType);
      if (mixedTypes) {
        vscode.window.showErrorMessage('Cannot move items of different types together');
        return;
      }

      const keys = validItems.map(i => i.key);
      await folderManager.assignItemsToFolder(resourceType, keys, undefined);
      const itemCount = validItems.length;
      vscode.window.showInformationMessage(`Moved ${itemCount} item${itemCount > 1 ? 's' : ''} to root level`);
    })
  );
}
