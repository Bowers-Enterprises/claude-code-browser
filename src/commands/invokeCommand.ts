import * as vscode from 'vscode';
import { ResourceItem } from '../types';

/**
 * Attempts to insert text into Claude Code chat input.
 * Strategy: Focus the Claude Code input, then use the 'type' command.
 * @param text The text to insert
 * @returns true if successfully inserted, false if fallback needed
 */
// Note: Claude Code chat input is a webview that VS Code extensions cannot directly access.
// The best UX is to copy to clipboard and show a clear message.

/**
 * Registers the invoke resource command.
 * This command attempts to insert the invoke command into Claude Code,
 * falling back to clipboard copy with an action button to open the source file.
 * @param context The extension context for subscription management
 */
export function registerInvokeCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'claudeCodeBrowser.invokeResource',
    async (item: ResourceItem) => {
      try {
        // Validate that we have an invoke command
        if (!item.invokeCommand) {
          vscode.window.showWarningMessage(
            `Resource "${item.name}" has no invoke command`
          );
          return;
        }

        // Copy to clipboard
        await vscode.env.clipboard.writeText(item.invokeCommand);

        // Show notification - user pastes into Claude Code chat with Cmd+V
        vscode.window.showInformationMessage(
          `Copied ${item.invokeCommand} — paste in Claude chat (⌘V)`
        );
      } catch (error) {
        console.error('Error in invokeResource command:', error);
        vscode.window.showErrorMessage(
          `Failed to invoke resource: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  context.subscriptions.push(command);
}
