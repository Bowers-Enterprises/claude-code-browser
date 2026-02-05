/**
 * MCP-specific commands for Claude Code Browser
 *
 * - Preview: Opens the .mcp.json config file that contains this server's definition
 */

import * as vscode from 'vscode';
import { McpItem, McpProvider } from '../providers/mcpProvider';

/**
 * Register MCP-specific commands
 */
export function registerMcpCommands(
  context: vscode.ExtensionContext,
  mcpProvider: McpProvider
): void {
  // Preview MCP command - opens the .mcp.json config file
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.previewMcp', async (item: McpItem) => {
      if (!item?.filePath) {
        vscode.window.showErrorMessage('No MCP server selected');
        return;
      }

      try {
        const uri = vscode.Uri.file(item.filePath);

        // Open the JSON config file in a text editor
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, {
          preview: true,
          preserveFocus: false
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to preview MCP config: ${error}`);
      }
    })
  );
}
