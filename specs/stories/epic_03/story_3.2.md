# Story 3.2: Add Clipboard Fallback

**Epic:** Interaction & Polish
**Priority:** P0
**Estimate:** Small

## Description

As a user, when direct insertion isn't available, I want the command copied to my clipboard so I can still quickly invoke it by pasting.

## Acceptance Criteria

```gherkin
Given I click on a resource
When direct insertion to Claude Code fails
Then the slash command is copied to clipboard
And a notification says "Copied to clipboard: /skillname"

Given I click on a resource
When the clipboard operation succeeds
Then I can paste "/skillname" into any input

Given I click multiple resources quickly
When each click triggers clipboard copy
Then the most recent resource is in the clipboard
```

## Technical Notes

### Clipboard API
VS Code provides a cross-platform clipboard API:
```typescript
import * as vscode from 'vscode';

async function copyToClipboard(text: string): Promise<void> {
  await vscode.env.clipboard.writeText(text);
}

async function readFromClipboard(): Promise<string> {
  return await vscode.env.clipboard.readText();
}
```

### Notification Patterns
Use appropriate notification level:
```typescript
// Success - brief info message
vscode.window.showInformationMessage(`Copied: ${command}`);

// With undo action (optional enhancement)
vscode.window.showInformationMessage(`Copied: ${command}`, 'Open Skill File')
  .then(selection => {
    if (selection === 'Open Skill File') {
      vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
    }
  });
```

### Error Handling
```typescript
try {
  await vscode.env.clipboard.writeText(slashCommand);
  vscode.window.showInformationMessage(`Copied: ${slashCommand}`);
} catch (error) {
  vscode.window.showErrorMessage(`Failed to copy to clipboard: ${error}`);
}
```

## Definition of Done

- [ ] Clipboard copy implemented using VS Code API
- [ ] Success notification shown
- [ ] Error handling for clipboard failures
- [ ] Works on macOS, Windows, Linux
