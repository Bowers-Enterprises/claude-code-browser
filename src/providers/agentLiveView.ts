/**
 * Real-time webview panel for observing a subagent's activity.
 *
 * Tails the subagent's JSONL log file using fs.watch and renders
 * a formatted, auto-scrolling activity feed showing:
 * - Tool calls (Read, Write, Edit, Bash, Grep, etc.)
 * - Assistant text responses
 * - Progress updates
 * - Todo list changes
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/** Info needed to open a live view for a subagent */
export interface AgentViewOptions {
  agentId: string;
  slug: string;
  task: string;
  jsonlPath: string;
  sessionId: string;
  agentType?: string;
}

/** Track open panels so we don't duplicate */
const openPanels = new Map<string, vscode.WebviewPanel>();

/**
 * Open (or focus) a live activity view for a subagent.
 */
export function openAgentLiveView(options: AgentViewOptions): void {
  const { agentId, slug, task, jsonlPath, agentType } = options;

  // If panel already open for this agent, focus it
  const existing = openPanels.get(agentId);
  if (existing) {
    existing.reveal();
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'agentLiveView',
    `Agent: ${slug}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  openPanels.set(agentId, panel);

  panel.onDidDispose(() => {
    openPanels.delete(agentId);
  });

  // Set initial HTML
  panel.webview.html = getWebviewHtml(slug, task, agentId, agentType);

  // Read existing content and start tailing
  tailJsonl(panel, jsonlPath, agentId);
}

/**
 * Tail a JSONL file: read all existing lines, then watch for new ones.
 */
function tailJsonl(panel: vscode.WebviewPanel, jsonlPath: string, agentId: string): void {
  let fileOffset = 0;
  let watcher: fs.FSWatcher | undefined;

  function readNewLines() {
    try {
      const stat = fs.statSync(jsonlPath);
      if (stat.size <= fileOffset) { return; }

      const fd = fs.openSync(jsonlPath, 'r');
      const buf = Buffer.alloc(stat.size - fileOffset);
      fs.readSync(fd, buf, 0, buf.length, fileOffset);
      fs.closeSync(fd);

      fileOffset = stat.size;

      const text = buf.toString('utf-8');
      const lines = text.split('\n').filter(l => l.trim());

      const entries: ParsedEntry[] = [];
      for (const line of lines) {
        try {
          const parsed = parseJsonlLine(JSON.parse(line));
          if (parsed) {
            entries.push(parsed);
          }
        } catch { /* skip malformed lines */ }
      }

      if (entries.length > 0) {
        panel.webview.postMessage({ type: 'entries', entries });
      }
    } catch { /* file may not exist yet */ }
  }

  // Read all existing content
  readNewLines();

  // Watch for changes
  try {
    watcher = fs.watch(jsonlPath, () => {
      readNewLines();
    });
  } catch {
    // Fall back to polling if fs.watch fails
    let disposed = false;
    const interval = setInterval(() => {
      if (disposed) {
        clearInterval(interval);
        return;
      }
      readNewLines();
    }, 1000);

    panel.onDidDispose(() => {
      disposed = true;
      clearInterval(interval);
    });
  }

  panel.onDidDispose(() => {
    watcher?.close();
  });
}

/** A parsed, display-ready log entry */
interface ParsedEntry {
  time: string;
  icon: string;
  category: 'tool' | 'response' | 'progress' | 'info';
  title: string;
  detail?: string;
  cssClass?: string;
}

/**
 * Parse a JSONL line into a display-ready entry.
 */
function parseJsonlLine(data: any): ParsedEntry | null {
  const timestamp = data.timestamp ? formatTime(data.timestamp) : '';

  // User message (usually the task prompt - skip, shown in header)
  if (data.type === 'user' || data.message?.role === 'user') {
    // Only show if it's not the first message (task description)
    if (data.parentUuid === null) { return null; }
    return {
      time: timestamp,
      icon: '&#x1F4AC;',
      category: 'info',
      title: 'User message',
      detail: truncate(extractTextContent(data.message?.content), 200),
    };
  }

  // Assistant message with tool use
  if (data.message?.role === 'assistant') {
    const content = data.message.content;
    if (!Array.isArray(content)) { return null; }

    for (const block of content) {
      if (block.type === 'tool_use') {
        return formatToolUse(block, timestamp);
      }
      if (block.type === 'text' && block.text?.trim()) {
        return {
          time: timestamp,
          icon: '&#x1F4AD;',
          category: 'response',
          title: 'Thinking',
          detail: truncate(block.text.trim(), 300),
        };
      }
    }
    return null;
  }

  // Tool result
  if (data.type === 'tool_result') {
    return null; // Skip raw tool results (noisy)
  }

  // Progress events
  if (data.type === 'progress') {
    const progressData = data.data;
    if (!progressData) { return null; }

    if (progressData.type === 'hook_progress') {
      return null; // Skip hook progress (noisy)
    }

    return {
      time: timestamp,
      icon: '&#x23F3;',
      category: 'progress',
      title: progressData.type || 'Progress',
      detail: progressData.message || undefined,
    };
  }

  return null;
}

/**
 * Format a tool_use block into a readable entry.
 */
function formatToolUse(block: any, timestamp: string): ParsedEntry {
  const toolName = block.name || 'Unknown tool';
  const input = block.input || {};

  const toolIcons: Record<string, string> = {
    Read: '&#x1F4D6;',
    Write: '&#x1F4DD;',
    Edit: '&#x270F;&#xFE0F;',
    Bash: '&#x1F4BB;',
    Grep: '&#x1F50D;',
    Glob: '&#x1F4C2;',
    Task: '&#x1F9E0;',
    WebFetch: '&#x1F310;',
    WebSearch: '&#x1F310;',
    TodoWrite: '&#x2705;',
    NotebookEdit: '&#x1F4D3;',
    AskUserQuestion: '&#x2753;',
  };

  const icon = toolIcons[toolName] || '&#x1F527;';
  let detail = '';

  switch (toolName) {
    case 'Read':
      detail = shortPath(input.file_path || '');
      break;
    case 'Write':
      detail = shortPath(input.file_path || '');
      break;
    case 'Edit':
      detail = shortPath(input.file_path || '');
      if (input.old_string) {
        detail += `\n  old: ${truncate(input.old_string, 80)}`;
        detail += `\n  new: ${truncate(input.new_string || '', 80)}`;
      }
      break;
    case 'Bash':
      detail = truncate(input.command || '', 150);
      break;
    case 'Grep':
      detail = `"${input.pattern || ''}"`;
      if (input.path) { detail += ` in ${shortPath(input.path)}`; }
      break;
    case 'Glob':
      detail = input.pattern || '';
      if (input.path) { detail += ` in ${shortPath(input.path)}`; }
      break;
    case 'Task':
      detail = input.description || input.prompt?.substring(0, 100) || '';
      break;
    case 'TodoWrite':
      const todos = input.todos;
      if (Array.isArray(todos)) {
        const inProgress = todos.find((t: any) => t.status === 'in_progress');
        detail = inProgress?.activeForm || inProgress?.content || `${todos.length} items`;
      }
      break;
    case 'WebSearch':
      detail = input.query || '';
      break;
    case 'WebFetch':
      detail = input.url || '';
      break;
    default:
      // Show first meaningful input field
      const keys = Object.keys(input).slice(0, 2);
      detail = keys.map(k => `${k}: ${truncate(String(input[k] || ''), 60)}`).join(', ');
  }

  return {
    time: timestamp,
    icon,
    category: 'tool',
    title: toolName,
    detail,
  };
}

function extractTextContent(content: any): string {
  if (typeof content === 'string') { return content; }
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item?.type === 'text') { return item.text || ''; }
    }
  }
  return '';
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function shortPath(p: string): string {
  if (!p) { return ''; }
  // Show last 3 path segments
  const parts = p.split('/');
  if (parts.length <= 3) { return p; }
  return '.../' + parts.slice(-3).join('/');
}

function truncate(s: string, maxLen: number): string {
  if (!s) { return ''; }
  // Replace newlines with spaces for single-line display
  const clean = s.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? clean.substring(0, maxLen - 3) + '...' : clean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Get the first meaningful line of task text for the collapsed preview */
function getTaskPreview(task: string): string {
  // Strip markdown markers and get first line with real content
  const lines = task.split('\n').map(l => l.trim()).filter(l => l);
  for (const line of lines) {
    const clean = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/^[-*]\s*/, '').trim();
    if (clean.length > 10) {
      return clean.length > 120 ? clean.substring(0, 117) + '...' : clean;
    }
  }
  return task.substring(0, 120);
}

/** Convert markdown-ish task text to simple HTML */
function formatTaskMarkdown(task: string): string {
  const escaped = escapeHtml(task);
  const lines = escaped.split('\n');
  let html = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    // Headings: ## Heading or #### Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      if (inList) { html += '</ul>'; inList = false; }
      const level = headingMatch[1].length;
      html += `<h${level}>${applyInlineFormatting(headingMatch[2])}</h${level}>`;
      continue;
    }

    // List items: - item or * item or 1. item
    const listMatch = line.match(/^[-*]\s+(.+)/) || line.match(/^\d+\.\s+(.+)/);
    if (listMatch) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${applyInlineFormatting(listMatch[1])}</li>`;
      continue;
    }

    // Regular paragraph
    if (inList) { html += '</ul>'; inList = false; }
    html += `<p>${applyInlineFormatting(line)}</p>`;
  }

  if (inList) { html += '</ul>'; }
  return html;
}

/** Apply bold and inline code formatting */
function applyInlineFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Generate the webview HTML.
 */
function getWebviewHtml(slug: string, task: string, agentId: string, agentType?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent: ${escapeHtml(slug)}</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --border: var(--vscode-panel-border, #333);
    --muted: var(--vscode-descriptionForeground, #888);
    --accent: var(--vscode-textLink-foreground, #4fc1ff);
    --tool-bg: var(--vscode-textBlockQuote-background, #1e1e2e);
    --response-bg: var(--vscode-editor-inactiveSelectionBackground, #264f78);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--fg);
    font-family: var(--vscode-font-family, 'SF Mono', 'Menlo', monospace);
    font-size: 12px;
    line-height: 1.5;
    padding: 0;
  }

  .header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }

  .header-top {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
  }

  .header-meta {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 10px;
    color: var(--muted);
    margin-left: auto;
    flex-shrink: 0;
  }

  .header-meta span {
    opacity: 0.7;
  }

  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .badge-type {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
  }

  .task-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 12px 6px 12px;
    cursor: pointer;
    user-select: none;
    font-size: 10px;
    color: var(--muted);
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .task-toggle:hover {
    opacity: 1;
  }

  .task-toggle .chevron {
    display: inline-block;
    transition: transform 0.15s;
    font-size: 9px;
  }

  .task-toggle .chevron.open {
    transform: rotate(90deg);
  }

  .task-toggle .task-preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .task-panel {
    display: none;
    max-height: 40vh;
    overflow-y: auto;
    padding: 0 12px 10px 12px;
    border-top: 1px solid var(--border);
  }

  .task-panel.open {
    display: block;
  }

  .task-panel::-webkit-scrollbar {
    width: 4px;
  }

  .task-panel::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
  }

  .task-content {
    font-size: 11px;
    line-height: 1.6;
    color: var(--muted);
    word-break: break-word;
  }

  .task-content h1, .task-content h2, .task-content h3, .task-content h4 {
    color: var(--fg);
    margin: 10px 0 4px 0;
    font-size: 11px;
    font-weight: 700;
  }

  .task-content h2 { font-size: 12px; }
  .task-content h1 { font-size: 13px; }

  .task-content p {
    margin: 4px 0;
  }

  .task-content ul, .task-content ol {
    margin: 4px 0;
    padding-left: 16px;
  }

  .task-content li {
    margin: 2px 0;
  }

  .task-content code {
    background: var(--tool-bg);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
  }

  .task-content strong {
    color: var(--fg);
    font-weight: 600;
  }

  .feed {
    padding: 8px 0;
  }

  .entry {
    display: flex;
    padding: 4px 16px;
    gap: 8px;
    align-items: flex-start;
    border-bottom: 1px solid transparent;
    transition: background 0.15s;
  }

  .entry:hover {
    background: var(--tool-bg);
  }

  .entry-time {
    flex-shrink: 0;
    width: 65px;
    color: var(--muted);
    font-size: 10px;
    padding-top: 2px;
    font-variant-numeric: tabular-nums;
  }

  .entry-icon {
    flex-shrink: 0;
    width: 20px;
    text-align: center;
    font-size: 13px;
  }

  .entry-content {
    flex: 1;
    min-width: 0;
  }

  .entry-title {
    font-weight: 600;
    font-size: 12px;
  }

  .entry-detail {
    color: var(--muted);
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 80px;
    overflow: hidden;
  }

  .entry.tool .entry-title { color: var(--accent); }
  .entry.response .entry-title { color: #c792ea; }
  .entry.progress .entry-title { color: #f78c6c; }
  .entry.info .entry-title { color: #89ddff; }

  .entry-count {
    position: fixed;
    bottom: 12px;
    right: 16px;
    background: var(--tool-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 4px 10px;
    font-size: 10px;
    color: var(--muted);
    z-index: 10;
  }

  .empty {
    text-align: center;
    padding: 40px 16px;
    color: var(--muted);
  }

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
</style>
</head>
<body>
  <div class="header" id="header">
    <div class="header-top">
      <div class="header-title">${escapeHtml(slug)}</div>
      ${agentType ? `<span class="badge badge-type">${escapeHtml(agentType)}</span>` : ''}
      <div class="header-meta">
        <span>${escapeHtml(agentId)}</span>
        <span id="entry-count">0 events</span>
      </div>
    </div>
    <div class="task-toggle" id="task-toggle">
      <span class="chevron" id="task-chevron">&#x25B6;</span>
      <span class="task-preview">${escapeHtml(getTaskPreview(task))}</span>
    </div>
    <div class="task-panel" id="task-panel">
      <div class="task-content">${formatTaskMarkdown(task)}</div>
    </div>
  </div>

  <div class="feed" id="feed">
    <div class="empty" id="empty-state">
      <div class="empty-icon">&#x1F4E1;</div>
      <div>Waiting for activity...</div>
    </div>
  </div>

  <script>
    const feed = document.getElementById('feed');
    const emptyState = document.getElementById('empty-state');
    const countEl = document.getElementById('entry-count');
    let entryCount = 0;
    let autoScroll = true;

    // Detect if user scrolled up (disable auto-scroll)
    window.addEventListener('scroll', () => {
      const atBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 50);
      autoScroll = atBottom;
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'entries') {
        if (emptyState) {
          emptyState.remove();
        }

        for (const entry of msg.entries) {
          const el = createEntryElement(entry);
          feed.appendChild(el);
          entryCount++;
        }

        countEl.textContent = entryCount + ' event' + (entryCount !== 1 ? 's' : '');

        if (autoScroll) {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
      }
    });

    function createEntryElement(entry) {
      const div = document.createElement('div');
      div.className = 'entry ' + (entry.cssClass || entry.category);

      let html = '';
      html += '<div class="entry-time">' + escapeHtml(entry.time) + '</div>';
      html += '<div class="entry-icon">' + entry.icon + '</div>';
      html += '<div class="entry-content">';
      html += '<div class="entry-title">' + escapeHtml(entry.title) + '</div>';
      if (entry.detail) {
        html += '<div class="entry-detail">' + escapeHtml(entry.detail) + '</div>';
      }
      html += '</div>';

      div.innerHTML = html;
      return div;
    }

    function escapeHtml(s) {
      if (!s) return '';
      const div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    // Collapsible task panel
    (function() {
      const toggle = document.getElementById('task-toggle');
      const panel = document.getElementById('task-panel');
      const chevron = document.getElementById('task-chevron');

      toggle.addEventListener('click', () => {
        const isOpen = panel.classList.toggle('open');
        chevron.classList.toggle('open', isOpen);
      });
    })();
  </script>
</body>
</html>`;
}
