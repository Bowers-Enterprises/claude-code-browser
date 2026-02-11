/**
 * TreeDataProvider for Claude Code hooks with full CRUD support.
 *
 * Reads hook configurations from Claude Code settings files and provides
 * add, edit, delete, toggle, and duplicate operations.
 *
 * Data sources:
 * - ~/.claude/settings.json (Global hooks)
 * - {workspace}/.claude/settings.json (Project hooks)
 * - {workspace}/.claude/settings.local.json (Local hooks)
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { openHookEditor, type HookFormData, type ScopeOption } from './hookEditorWebview';

/** Configuration for a single hook */
interface HookConfig {
  type: 'command' | 'prompt';
  command?: string;
  prompt?: string;
  timeout?: number;
}

/** A matcher entry containing hooks and an optional matcher pattern */
interface HookMatcher {
  matcher?: string;
  hooks: HookConfig[];
}

/** Full settings file shape (we preserve non-hook keys when writing) */
interface SettingsFile {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: any;
}

/** Valid hook event names in Claude Code */
const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SubagentStop',
  'SessionStart',
  'SessionStop',
] as const;

type HookEvent = typeof HOOK_EVENTS[number];

/** Scope identifies which settings file a hook lives in */
interface HookScope {
  label: string;
  filePath: string;
}

/** A resolved hook with its location info for CRUD operations */
interface ResolvedHook {
  event: string;
  matcherIndex: number;
  hookIndex: number;
  matcher: HookMatcher;
  hook: HookConfig;
  scope: HookScope;
}

/** Tree item that carries hook metadata */
class HookTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly hookData?: ResolvedHook,
    public readonly eventName?: string,
    public readonly scope?: HookScope,
    public readonly children?: HookTreeItem[]
  ) {
    super(label, collapsibleState);
  }
}

export class HookManagerProvider implements vscode.TreeDataProvider<HookTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<HookTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: HookTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: HookTreeItem): Promise<HookTreeItem[]> {
    if (!element) {
      return this.getHookEvents();
    }
    return element.children || [];
  }

  // ─── CRUD Operations ───────────────────────────────────────

  /**
   * Add a new hook via webview form.
   * If eventName is provided, pre-selects that event.
   */
  async addHook(preselectedEvent?: string): Promise<void> {
    const scopes = this.getAvailableScopes();

    const result = await openHookEditor(this.extensionUri, {
      mode: 'add',
      scopes,
      initial: preselectedEvent ? { event: preselectedEvent } : undefined
    });

    if (!result) { return; }

    const scopeFilePath = result.scope;
    const settings = this.readSettingsFile(scopeFilePath);
    if (!settings.hooks) {
      settings.hooks = {};
    }
    if (!settings.hooks[result.event]) {
      settings.hooks[result.event] = [];
    }

    const hookConfig: HookConfig = { type: result.type };
    if (result.type === 'command') {
      hookConfig.command = result.command;
    } else {
      hookConfig.prompt = result.prompt;
    }
    if (result.timeout) {
      hookConfig.timeout = parseInt(result.timeout, 10);
    }

    const newMatcher: HookMatcher = { hooks: [hookConfig] };
    if (result.matcher) {
      newMatcher.matcher = result.matcher;
    }

    settings.hooks[result.event].push(newMatcher);
    this.writeSettingsFile(scopeFilePath, settings);

    vscode.window.showInformationMessage(`Hook added to ${result.event}`);
    this.refresh();
  }

  /**
   * Edit an existing hook via webview form.
   */
  async editHook(item: HookTreeItem): Promise<void> {
    const data = item.hookData;
    if (!data) { return; }

    const settings = this.readSettingsFile(data.scope.filePath);
    const matchers = settings.hooks?.[data.event];
    if (!matchers?.[data.matcherIndex]?.hooks?.[data.hookIndex]) {
      vscode.window.showErrorMessage('Hook not found. It may have been modified externally.');
      this.refresh();
      return;
    }

    const hook = matchers[data.matcherIndex].hooks[data.hookIndex];
    const matcher = matchers[data.matcherIndex];
    const scopes = this.getAvailableScopes();

    const result = await openHookEditor(this.extensionUri, {
      mode: 'edit',
      scopes,
      initial: {
        event: data.event,
        scope: data.scope.filePath,
        type: hook.type,
        command: (hook.command || '').replace(/^#DISABLED# /, ''),
        prompt: (hook.prompt || '').replace(/^#DISABLED# /, ''),
        matcher: matcher.matcher || '',
        timeout: hook.timeout ? String(hook.timeout) : '',
      }
    });

    if (!result) { return; }

    const eventChanged = result.event !== data.event;
    const scopeChanged = result.scope !== data.scope.filePath;

    // Build the new hook config
    const wasDisabled = this.isDisabled(data.hook);
    const newHookConfig: HookConfig = { type: result.type };
    if (result.type === 'command') {
      newHookConfig.command = (wasDisabled ? '#DISABLED# ' : '') + result.command;
    } else {
      newHookConfig.prompt = (wasDisabled ? '#DISABLED# ' : '') + result.prompt;
    }
    if (result.timeout) {
      newHookConfig.timeout = parseInt(result.timeout, 10);
    }

    const newMatcher: HookMatcher = { hooks: [newHookConfig] };
    if (result.matcher) {
      newMatcher.matcher = result.matcher;
    }

    if (eventChanged || scopeChanged) {
      // Remove from old location
      const oldSettings = this.readSettingsFile(data.scope.filePath);
      const oldMatchers = oldSettings.hooks?.[data.event];
      if (oldMatchers?.[data.matcherIndex]) {
        oldMatchers[data.matcherIndex].hooks.splice(data.hookIndex, 1);
        if (oldMatchers[data.matcherIndex].hooks.length === 0) {
          oldMatchers.splice(data.matcherIndex, 1);
        }
        if (oldMatchers.length === 0) {
          delete oldSettings.hooks![data.event];
        }
        if (oldSettings.hooks && Object.keys(oldSettings.hooks).length === 0) {
          delete oldSettings.hooks;
        }
        this.writeSettingsFile(data.scope.filePath, oldSettings);
      }

      // Add to new location
      const newSettings = this.readSettingsFile(result.scope);
      if (!newSettings.hooks) { newSettings.hooks = {}; }
      if (!newSettings.hooks[result.event]) { newSettings.hooks[result.event] = []; }
      newSettings.hooks[result.event].push(newMatcher);
      this.writeSettingsFile(result.scope, newSettings);
    } else {
      // Same event and scope — update in place
      const freshSettings = this.readSettingsFile(data.scope.filePath);
      const freshMatchers = freshSettings.hooks?.[data.event];
      if (!freshMatchers?.[data.matcherIndex]?.hooks?.[data.hookIndex]) {
        vscode.window.showErrorMessage('Hook was modified externally. Please refresh and try again.');
        this.refresh();
        return;
      }

      freshMatchers[data.matcherIndex].hooks[data.hookIndex] = newHookConfig;
      if (result.matcher) {
        freshMatchers[data.matcherIndex].matcher = result.matcher;
      } else {
        delete freshMatchers[data.matcherIndex].matcher;
      }

      this.writeSettingsFile(data.scope.filePath, freshSettings);
    }

    vscode.window.showInformationMessage('Hook updated.');
    this.refresh();
  }

  /**
   * Delete a hook after confirmation.
   */
  async deleteHook(item: HookTreeItem): Promise<void> {
    const data = item.hookData;
    if (!data) { return; }

    const confirm = await vscode.window.showWarningMessage(
      `Delete this ${data.hook.type} hook from ${data.event}?`,
      { modal: true },
      'Delete'
    );
    if (confirm !== 'Delete') { return; }

    const settings = this.readSettingsFile(data.scope.filePath);
    const matchers = settings.hooks?.[data.event];
    if (!matchers) { return; }

    const matcher = matchers[data.matcherIndex];
    if (!matcher) { return; }

    // Remove the hook from its matcher
    matcher.hooks.splice(data.hookIndex, 1);

    // If matcher has no hooks left, remove the matcher
    if (matcher.hooks.length === 0) {
      matchers.splice(data.matcherIndex, 1);
    }

    // If event has no matchers left, remove the event
    if (matchers.length === 0) {
      delete settings.hooks![data.event];
    }

    // If hooks object is empty, remove it
    if (settings.hooks && Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }

    this.writeSettingsFile(data.scope.filePath, settings);
    vscode.window.showInformationMessage('Hook deleted.');
    this.refresh();
  }

  /**
   * Toggle a hook between enabled and disabled.
   * Disabled hooks get their type prefixed with '_disabled_'.
   */
  async toggleHook(item: HookTreeItem): Promise<void> {
    const data = item.hookData;
    if (!data) { return; }

    const settings = this.readSettingsFile(data.scope.filePath);
    const hook = settings.hooks?.[data.event]?.[data.matcherIndex]?.hooks?.[data.hookIndex];
    if (!hook) { return; }

    // Toggle by prefixing/unprefixing the command or prompt with #DISABLED#
    if (hook.type === 'command') {
      if (hook.command?.startsWith('#DISABLED# ')) {
        hook.command = hook.command.substring('#DISABLED# '.length);
      } else {
        hook.command = '#DISABLED# ' + (hook.command || '');
      }
    } else if (hook.type === 'prompt') {
      if (hook.prompt?.startsWith('#DISABLED# ')) {
        hook.prompt = hook.prompt.substring('#DISABLED# '.length);
      } else {
        hook.prompt = '#DISABLED# ' + (hook.prompt || '');
      }
    }

    this.writeSettingsFile(data.scope.filePath, settings);
    this.refresh();
  }

  /**
   * Duplicate an existing hook.
   */
  async duplicateHook(item: HookTreeItem): Promise<void> {
    const data = item.hookData;
    if (!data) { return; }

    const settings = this.readSettingsFile(data.scope.filePath);
    const matchers = settings.hooks?.[data.event];
    if (!matchers?.[data.matcherIndex]) { return; }

    // Deep copy the matcher + hook
    const sourceMatcher = matchers[data.matcherIndex];
    const newHook: HookConfig = { ...data.hook };
    const newMatcher: HookMatcher = {
      hooks: [newHook]
    };
    if (sourceMatcher.matcher) {
      newMatcher.matcher = sourceMatcher.matcher;
    }

    matchers.push(newMatcher);
    this.writeSettingsFile(data.scope.filePath, settings);

    vscode.window.showInformationMessage('Hook duplicated.');
    this.refresh();
  }

  /**
   * Open the settings file that contains a hook.
   */
  async openSettingsFile(item: HookTreeItem): Promise<void> {
    const filePath = item.hookData?.scope.filePath || item.scope?.filePath;
    if (!filePath) {
      // If called from an event node, open global settings
      const globalPath = path.join(os.homedir(), '.claude', 'settings.json');
      if (fs.existsSync(globalPath)) {
        const doc = await vscode.workspace.openTextDocument(globalPath);
        await vscode.window.showTextDocument(doc);
      }
      return;
    }

    if (!fs.existsSync(filePath)) {
      vscode.window.showWarningMessage(`File not found: ${filePath}`);
      return;
    }

    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
  }

  // ─── Tree Building ─────────────────────────────────────────

  private getHookEvents(): HookTreeItem[] {
    const allHooks = this.loadAllHooks();
    const events: HookTreeItem[] = [];

    for (const [eventName, resolved] of Object.entries(allHooks)) {
      const totalHooks = resolved.length;
      const enabledCount = resolved.filter(r => !this.isDisabled(r.hook)).length;

      const item = new HookTreeItem(
        eventName,
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        eventName,
        resolved[0]?.scope
      );
      item.iconPath = new vscode.ThemeIcon('zap');
      item.description = enabledCount === totalHooks
        ? `${totalHooks} hook${totalHooks !== 1 ? 's' : ''}`
        : `${enabledCount}/${totalHooks} enabled`;
      item.contextValue = 'hook-event';
      item.tooltip = this.getEventDescription(eventName);

      const children = this.buildHookChildren(resolved);
      (item as any).children = children;

      events.push(item);
    }

    if (events.length === 0) {
      const empty = new HookTreeItem('No hooks configured', vscode.TreeItemCollapsibleState.None);
      empty.description = 'Click + to add a hook';
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty];
    }

    return events;
  }

  private buildHookChildren(hooks: ResolvedHook[]): HookTreeItem[] {
    return hooks.map(resolved => {
      const disabled = this.isDisabled(resolved.hook);
      const label = this.getHookLabel(resolved.hook);

      const child = new HookTreeItem(
        label,
        vscode.TreeItemCollapsibleState.None,
        resolved
      );

      child.iconPath = new vscode.ThemeIcon(
        this.getHookIcon(resolved.hook.type),
        disabled ? new vscode.ThemeColor('disabledForeground') : undefined
      );

      const parts: string[] = [];
      if (resolved.matcher.matcher) {
        parts.push(`[${resolved.matcher.matcher}]`);
      }
      parts.push(resolved.scope.label);
      if (disabled) {
        parts.push('(disabled)');
      }
      child.description = parts.join(' ');

      child.tooltip = this.getHookTooltip(resolved);
      child.contextValue = disabled ? 'hook-item-disabled' : 'hook-item';
      child.command = {
        command: 'claudeCodeBrowser.hooks.edit',
        title: 'Edit Hook',
        arguments: [child]
      };

      return child;
    });
  }

  // ─── Data Loading ──────────────────────────────────────────

  /**
   * Load all hooks from all settings files, returning ResolvedHook objects
   * that carry enough info for CRUD operations.
   */
  private loadAllHooks(): Record<string, ResolvedHook[]> {
    const result: Record<string, ResolvedHook[]> = {};

    const scopes = this.getAvailableScopes();

    for (const scope of scopes) {
      try {
        if (!fs.existsSync(scope.filePath)) { continue; }
        const content = fs.readFileSync(scope.filePath, 'utf-8');
        const settings: SettingsFile = JSON.parse(content);
        if (!settings.hooks) { continue; }

        for (const [event, matchers] of Object.entries(settings.hooks)) {
          if (!result[event]) { result[event] = []; }

          for (let mi = 0; mi < matchers.length; mi++) {
            const matcher = matchers[mi];
            for (let hi = 0; hi < matcher.hooks.length; hi++) {
              result[event].push({
                event,
                matcherIndex: mi,
                hookIndex: hi,
                matcher,
                hook: matcher.hooks[hi],
                scope
              });
            }
          }
        }
      } catch {
        // Skip malformed files
      }
    }

    return result;
  }

  private getAvailableScopes(): HookScope[] {
    const scopes: HookScope[] = [];

    const globalPath = path.join(os.homedir(), '.claude', 'settings.json');
    scopes.push({ label: 'Global', filePath: globalPath });

    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    for (const folder of workspaceFolders) {
      scopes.push({
        label: 'Project',
        filePath: path.join(folder.uri.fsPath, '.claude', 'settings.json')
      });
      scopes.push({
        label: 'Local',
        filePath: path.join(folder.uri.fsPath, '.claude', 'settings.local.json')
      });
    }

    return scopes;
  }

  // ─── File I/O ──────────────────────────────────────────────

  private readSettingsFile(filePath: string): SettingsFile {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      // Fall through to default
    }
    return {};
  }

  private writeSettingsFile(filePath: string, settings: SettingsFile): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  }

  // ─── Helpers ───────────────────────────────────────────────

  private isDisabled(hook: HookConfig): boolean {
    if (hook.type === 'command') {
      return hook.command?.startsWith('#DISABLED# ') || false;
    }
    if (hook.type === 'prompt') {
      return hook.prompt?.startsWith('#DISABLED# ') || false;
    }
    return false;
  }

  private getHookLabel(hook: HookConfig): string {
    const maxLength = 60;
    let text = '';

    if (hook.type === 'command') {
      text = hook.command || 'Empty command';
    } else if (hook.type === 'prompt') {
      text = hook.prompt || 'Empty prompt';
    } else {
      return `${hook.type} hook`;
    }

    // Strip disabled prefix for display
    text = text.replace(/^#DISABLED# /, '');

    return text.length > maxLength
      ? text.substring(0, maxLength - 3) + '...'
      : text;
  }

  private getHookIcon(type: HookConfig['type']): string {
    switch (type) {
      case 'command': return 'terminal';
      case 'prompt': return 'comment-discussion';
      default: return 'gear';
    }
  }

  private getHookTooltip(resolved: ResolvedHook): vscode.MarkdownString {
    const hook = resolved.hook;
    const lines: string[] = [];

    lines.push(`**${resolved.event}** hook (${hook.type})`);
    lines.push('');

    if (resolved.matcher.matcher) {
      lines.push(`Matcher: \`${resolved.matcher.matcher}\``);
    }

    lines.push(`Scope: ${resolved.scope.label}`);
    lines.push(`File: ${resolved.scope.filePath}`);
    lines.push('');

    if (hook.type === 'command') {
      const cmd = (hook.command || '').replace(/^#DISABLED# /, '');
      lines.push('```bash');
      lines.push(cmd);
      lines.push('```');
    } else if (hook.type === 'prompt') {
      const prompt = (hook.prompt || '').replace(/^#DISABLED# /, '');
      lines.push(prompt);
    }

    if (hook.timeout) {
      lines.push('', `Timeout: ${hook.timeout}ms`);
    }

    const md = new vscode.MarkdownString(lines.join('\n'));
    md.isTrusted = true;
    return md;
  }

  private getEventDescription(event: string): string {
    switch (event) {
      case 'PreToolUse': return 'Runs before a tool is executed';
      case 'PostToolUse': return 'Runs after a tool is executed';
      case 'Notification': return 'Runs when Claude sends a notification';
      case 'Stop': return 'Runs when Claude finishes a response';
      case 'SubagentStop': return 'Runs when a subagent finishes';
      case 'SessionStart': return 'Runs when a session begins';
      case 'SessionStop': return 'Runs when a session ends';
      default: return '';
    }
  }
}
