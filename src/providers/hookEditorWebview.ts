/**
 * Webview panel for adding and editing Claude Code hooks.
 * Provides a form UI with dropdowns, textareas, and live validation.
 */

import * as vscode from 'vscode';

/** Valid hook event names */
const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SubagentStop',
  'SessionStart',
  'SessionStop',
] as const;

const EVENT_DESCRIPTIONS: Record<string, string> = {
  PreToolUse: 'Runs before a tool is executed',
  PostToolUse: 'Runs after a tool is executed',
  Notification: 'Runs when Claude sends a notification',
  Stop: 'Runs when Claude finishes a response',
  SubagentStop: 'Runs when a subagent finishes',
  SessionStart: 'Runs when a session begins',
  SessionStop: 'Runs when a session ends',
};

/** Data passed to/from the webview form */
export interface HookFormData {
  event: string;
  scope: string;
  type: 'command' | 'prompt';
  command: string;
  prompt: string;
  matcher: string;
  timeout: string;
}

/** Scope option for the dropdown */
export interface ScopeOption {
  label: string;
  filePath: string;
}

interface WebviewOptions {
  mode: 'add' | 'edit';
  scopes: ScopeOption[];
  initial?: Partial<HookFormData>;
}

/**
 * Opens a webview panel with a hook editor form.
 * Returns the form data on save, or undefined if cancelled.
 */
export function openHookEditor(
  extensionUri: vscode.Uri,
  options: WebviewOptions
): Promise<HookFormData | undefined> {
  return new Promise((resolve) => {
    const title = options.mode === 'add' ? 'Add Hook' : 'Edit Hook';

    const panel = vscode.window.createWebviewPanel(
      'hookEditor',
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    let resolved = false;

    panel.webview.html = getWebviewContent(options);

    panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'save') {
        resolved = true;
        resolve(msg.data as HookFormData);
        panel.dispose();
      } else if (msg.type === 'cancel') {
        resolved = true;
        resolve(undefined);
        panel.dispose();
      }
    });

    panel.onDidDispose(() => {
      if (!resolved) {
        resolve(undefined);
      }
    });
  });
}

function getWebviewContent(options: WebviewOptions): string {
  const { mode, scopes, initial } = options;

  const eventOptions = HOOK_EVENTS.map(e => {
    const selected = initial?.event === e ? 'selected' : '';
    return `<option value="${e}" ${selected}>${e}</option>`;
  }).join('\n');

  const scopeOptions = scopes.map((s, i) => {
    const selected = (initial?.scope === s.filePath || (!initial?.scope && i === 0)) ? 'selected' : '';
    return `<option value="${s.filePath}" ${selected}>${s.label}</option>`;
  }).join('\n');

  const typeCommand = (!initial?.type || initial.type === 'command') ? 'selected' : '';
  const typePrompt = initial?.type === 'prompt' ? 'selected' : '';

  const commandVal = escapeHtml(initial?.command || '');
  const promptVal = escapeHtml(initial?.prompt || '');
  const matcherVal = escapeHtml(initial?.matcher || '');
  const timeoutVal = escapeHtml(initial?.timeout || '');

  const isEdit = mode === 'edit';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${isEdit ? 'Edit' : 'Add'} Hook</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --input-bg: var(--vscode-input-background);
    --input-fg: var(--vscode-input-foreground);
    --input-border: var(--vscode-input-border, #444);
    --focus-border: var(--vscode-focusBorder, #007acc);
    --btn-bg: var(--vscode-button-background);
    --btn-fg: var(--vscode-button-foreground);
    --btn-hover: var(--vscode-button-hoverBackground);
    --btn-secondary-bg: var(--vscode-button-secondaryBackground);
    --btn-secondary-fg: var(--vscode-button-secondaryForeground);
    --btn-secondary-hover: var(--vscode-button-secondaryHoverBackground);
    --desc-fg: var(--vscode-descriptionForeground);
    --border: var(--vscode-panel-border, #333);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--fg);
    background: var(--bg);
    padding: 24px 32px;
    max-width: 700px;
  }

  h1 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .subtitle {
    color: var(--desc-fg);
    margin-bottom: 24px;
    font-size: 12px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  label {
    display: block;
    font-weight: 600;
    margin-bottom: 6px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--desc-fg);
  }

  .hint {
    color: var(--desc-fg);
    font-size: 11px;
    margin-top: 4px;
  }

  select, input[type="text"], input[type="number"], textarea {
    width: 100%;
    padding: 8px 10px;
    background: var(--input-bg);
    color: var(--input-fg);
    border: 1px solid var(--input-border);
    border-radius: 4px;
    font-family: var(--vscode-editor-font-family, 'SF Mono', Menlo, monospace);
    font-size: 13px;
    outline: none;
  }

  select {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
  }

  select:focus, input:focus, textarea:focus {
    border-color: var(--focus-border);
  }

  textarea {
    min-height: 120px;
    resize: vertical;
    line-height: 1.5;
  }

  .type-toggle {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .type-btn {
    flex: 1;
    padding: 10px 16px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--fg);
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
    font-size: 13px;
  }

  .type-btn:hover {
    border-color: var(--focus-border);
  }

  .type-btn.active {
    border-color: var(--focus-border);
    background: var(--btn-bg);
    color: var(--btn-fg);
  }

  .type-btn .icon {
    font-size: 18px;
    display: block;
    margin-bottom: 4px;
  }

  .type-btn .desc {
    font-size: 11px;
    opacity: 0.8;
  }

  .row {
    display: flex;
    gap: 16px;
  }

  .row > .form-group {
    flex: 1;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }

  .btn {
    padding: 8px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
  }

  .btn-primary {
    background: var(--btn-bg);
    color: var(--btn-fg);
  }

  .btn-primary:hover {
    background: var(--btn-hover);
  }

  .btn-secondary {
    background: var(--btn-secondary-bg);
    color: var(--btn-secondary-fg);
  }

  .btn-secondary:hover {
    background: var(--btn-secondary-hover);
  }

  .hidden { display: none; }

  .kbd {
    display: inline-block;
    padding: 2px 6px;
    border: 1px solid var(--input-border);
    border-radius: 3px;
    font-size: 11px;
    background: var(--input-bg);
  }
</style>
</head>
<body>
  <h1>${isEdit ? 'Edit' : 'Add'} Hook</h1>
  <p class="subtitle">Configure a Claude Code lifecycle hook. <span class="kbd">Cmd+Enter</span> to save.</p>

  <div class="row">
    <div class="form-group">
      <label for="event">Event</label>
      <select id="event" onchange="updateEventDescription()">
        ${eventOptions}
      </select>
      <p class="hint" id="event-desc"></p>
    </div>
    <div class="form-group">
      <label for="scope">Scope</label>
      <select id="scope" onchange="updateScopeDescription()">
        ${scopeOptions}
      </select>
      <p class="hint" id="scope-desc"></p>
    </div>
  </div>

  <div class="form-group">
    <label>Type</label>
    <div class="type-toggle">
      <div class="type-btn ${typeCommand ? 'active' : ''}" data-type="command" onclick="setType('command')">
        <span class="icon">$</span>
        <strong>Command</strong>
        <span class="desc">Run a shell command</span>
      </div>
      <div class="type-btn ${typePrompt ? 'active' : ''}" data-type="prompt" onclick="setType('prompt')">
        <span class="icon">?</span>
        <strong>Prompt</strong>
        <span class="desc">LLM-evaluated condition</span>
      </div>
    </div>
  </div>

  <div class="form-group" id="command-group">
    <label for="command">Shell Command</label>
    <textarea id="command" placeholder="e.g., npx prettier --write &quot;$FILE&quot;&#10;&#10;Multi-line commands work too.&#10;Use $FILE for the affected file path.">${commandVal}</textarea>
    <p class="hint">The command runs in your project root. Exit code 0 = success.</p>
  </div>

  <div class="form-group hidden" id="prompt-group">
    <label for="prompt">Prompt</label>
    <textarea id="prompt" placeholder="Review the conversation and determine if...&#10;&#10;Respond with {&quot;ok&quot;: true} if everything is fine,&#10;or {&quot;ok&quot;: false, &quot;reason&quot;: &quot;...&quot;} if not.">${promptVal}</textarea>
    <p class="hint">Claude evaluates this prompt and uses the JSON response to decide whether to continue.</p>
  </div>

  <div class="row">
    <div class="form-group">
      <label for="matcher">Matcher Pattern <span style="font-weight:400; text-transform:none">(optional)</span></label>
      <input type="text" id="matcher" value="${matcherVal}" placeholder="e.g., Edit|Write or compact" />
      <p class="hint">Regex pattern to filter which tools/events trigger this hook.</p>
    </div>
    <div class="form-group">
      <label for="timeout">Timeout <span style="font-weight:400; text-transform:none">(optional)</span></label>
      <input type="number" id="timeout" value="${timeoutVal}" placeholder="Default (no limit)" min="0" step="1000" />
      <p class="hint">Milliseconds before the hook is killed.</p>
    </div>
  </div>

  <div class="actions">
    <button class="btn btn-primary" onclick="save()">Save Hook</button>
    <button class="btn btn-secondary" onclick="cancel()">Cancel</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentType = '${initial?.type || 'command'}';

    const eventDescriptions = ${JSON.stringify(EVENT_DESCRIPTIONS)};
    const scopePaths = ${JSON.stringify(Object.fromEntries(scopes.map(s => [s.filePath, s.filePath])))};

    // Initialize visibility and descriptions
    updateTypeVisibility();
    updateEventDescription();
    updateScopeDescription();

    function updateEventDescription() {
      const event = document.getElementById('event').value;
      document.getElementById('event-desc').textContent = eventDescriptions[event] || '';
    }

    function updateScopeDescription() {
      const scope = document.getElementById('scope').value;
      document.getElementById('scope-desc').textContent = scope;
    }

    function setType(type) {
      currentType = type;
      document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
      });
      updateTypeVisibility();
    }

    function updateTypeVisibility() {
      document.getElementById('command-group').classList.toggle('hidden', currentType !== 'command');
      document.getElementById('prompt-group').classList.toggle('hidden', currentType !== 'prompt');
    }

    function save() {
      const data = {
        event: document.getElementById('event').value,
        scope: document.getElementById('scope').value,
        type: currentType,
        command: document.getElementById('command').value,
        prompt: document.getElementById('prompt').value,
        matcher: document.getElementById('matcher').value,
        timeout: document.getElementById('timeout').value,
      };

      // Validate
      if (currentType === 'command' && !data.command.trim()) {
        document.getElementById('command').focus();
        return;
      }
      if (currentType === 'prompt' && !data.prompt.trim()) {
        document.getElementById('prompt').focus();
        return;
      }

      vscode.postMessage({ type: 'save', data });
    }

    function cancel() {
      vscode.postMessage({ type: 'cancel' });
    }

    // Cmd+Enter to save, Escape to cancel
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        save();
      }
      if (e.key === 'Escape') {
        cancel();
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
