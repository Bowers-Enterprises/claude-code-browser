# Story 3.1: Implement Click-to-Invoke Command

**Epic:** Interaction & Polish
**Priority:** P0
**Estimate:** Medium

## Description

As a user, I want to click on a skill or agent to invoke it so that I can quickly use it without typing.

## Acceptance Criteria

```gherkin
Given I see a skill in the Skills section
When I click on the skill name
Then the skill's slash command is sent to Claude Code
Or the slash command is copied to clipboard (fallback)
And I see a notification confirming the action

Given I see an agent in the Agents section
When I click on the agent name
Then I can invoke the agent (if invocable via command)
Or the agent command is copied to clipboard

Given the Claude Code extension is not detected
When I click on a resource
Then the command is copied to clipboard
And I see a notification: "Copied to clipboard: /skillname"
```

## Technical Notes

### Command Registration
```typescript
// Register in package.json
{
  "contributes": {
    "commands": [
      {
        "command": "claudeCodeBrowser.invokeResource",
        "title": "Invoke Resource"
      }
    ]
  }
}
```

### Command Implementation
```typescript
// src/commands/invokeCommand.ts
import * as vscode from 'vscode';

export function registerInvokeCommand(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    'claudeCodeBrowser.invokeResource',
    async (resource: { name: string; resourceType: string }) => {
      const slashCommand = `/${resource.name}`;

      // Try to insert into Claude Code (research required)
      const inserted = await tryInsertIntoClaudeCode(slashCommand);

      if (!inserted) {
        // Fallback: copy to clipboard
        await vscode.env.clipboard.writeText(slashCommand);
        vscode.window.showInformationMessage(`Copied to clipboard: ${slashCommand}`);
      } else {
        vscode.window.showInformationMessage(`Invoked: ${slashCommand}`);
      }
    }
  );

  context.subscriptions.push(command);
}

async function tryInsertIntoClaudeCode(text: string): Promise<boolean> {
  // Option 1: Check if Claude Code extension exposes a command
  try {
    const commands = await vscode.commands.getCommands(true);
    // Look for claude.* commands
    // If found: await vscode.commands.executeCommand('claude.insertMessage', text);
    return false; // Placeholder - needs investigation
  } catch {
    return false;
  }
}
```

### TreeItem Command Binding
Each TreeItem needs to trigger the invoke command on click:
```typescript
// In provider's getTreeItem method
item.command = {
  command: 'claudeCodeBrowser.invokeResource',
  title: 'Invoke',
  arguments: [{ name: item.name, resourceType: item.resourceType }]
};
```

### Claude Code Integration Research
Need to investigate:
1. Does Claude Code extension expose any VS Code commands?
2. Can we use `vscode.commands.executeCommand('type', { text: '/skill' })` to type into active editor?
3. Is there a webview API we can use?

For MVP, clipboard copy is acceptable fallback.

## Definition of Done

- [ ] invokeResource command registered
- [ ] Click on any resource triggers command
- [ ] Slash command format correct (/name)
- [ ] Clipboard fallback works
- [ ] Notification shown to user
- [ ] Research Claude Code integration documented
