/**
 * TreeDataProvider for Claude Code agent teams (subagent sessions).
 *
 * Detects sessions that have spawned subagents by scanning:
 * - ~/.claude/projects/{project-key}/{session-uuid}/subagents/ (subagent JSONL logs)
 * - ~/.claude/todos/{session-uuid}-agent-{id}.json (todo lists for parent + subagents)
 *
 * Shows recent sessions with their subagents, task descriptions, and progress.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/** Parsed info about a subagent */
interface SubagentInfo {
  agentId: string;
  slug: string;
  task: string;
  /** Full task description (not truncated) */
  fullTask: string;
  /** Path to the JSONL log file */
  jsonlPath: string;
  /** Parent session ID */
  sessionId: string;
  /** The subagent_type from the Task tool call (e.g. "implementation", "Explore") */
  agentType?: string;
  /** Whether this subagent has in_progress todos */
  active: boolean;
}

/** A session that has subagents (an "agent team") */
interface TeamSession {
  sessionId: string;
  projectKey: string;
  projectName: string;
  /** Parent session's todo items */
  todos: TodoItem[];
  /** Subagents spawned by this session */
  subagents: SubagentInfo[];
  /** Most recent modification time across all files */
  lastModified: number;
  /** Whether the parent session has in_progress todos */
  active: boolean;
}

interface TodoItem {
  content: string;
  status: string;
  activeForm?: string;
}

/** Max sessions to display */
const MAX_SESSIONS = 10;

export class TeamTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children?: TeamTreeItem[],
    public readonly agentInfo?: SubagentInfo
  ) {
    super(label, collapsibleState);
  }
}

export class AgentTeamProvider implements vscode.TreeDataProvider<TeamTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TeamTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TeamTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TeamTreeItem): Promise<TeamTreeItem[]> {
    if (!element) {
      return this.getTeamSessions();
    }
    return element.children || [];
  }

  private getTeamSessions(): TeamTreeItem[] {
    const sessions = this.discoverTeamSessions();

    if (sessions.length === 0) {
      const empty = new TeamTreeItem('No agent teams found', vscode.TreeItemCollapsibleState.None);
      empty.description = 'Teams appear when Claude spawns subagents';
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty];
    }

    // Sort by most recent first
    sessions.sort((a, b) => b.lastModified - a.lastModified);

    // Limit to MAX_SESSIONS
    const displayed = sessions.slice(0, MAX_SESSIONS);

    return displayed.map(session => this.buildSessionItem(session));
  }

  private buildSessionItem(session: TeamSession): TeamTreeItem {
    const agentCount = session.subagents.length;
    const activeAgents = session.subagents.filter(a => a.active).length;

    // Use first todo content as the session label, or project name
    const label = this.getSessionLabel(session);

    const item = new TeamTreeItem(
      label,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    if (session.active) {
      item.iconPath = new vscode.ThemeIcon('pulse', new vscode.ThemeColor('charts.green'));
      item.description = `${activeAgents}/${agentCount} agents active`;
    } else {
      item.iconPath = new vscode.ThemeIcon('history');
      item.description = `${agentCount} agent${agentCount !== 1 ? 's' : ''} - ${this.relativeTime(session.lastModified)}`;
    }

    item.contextValue = 'agent-team';
    item.tooltip = this.buildSessionTooltip(session);

    // Build children: subagents + todo summary
    const children: TeamTreeItem[] = [];

    // Add subagents
    for (const agent of session.subagents) {
      children.push(this.buildAgentItem(agent, session));
    }

    // Add todo progress if available
    if (session.todos.length > 0) {
      const completed = session.todos.filter(t => t.status === 'completed').length;
      const inProgress = session.todos.filter(t => t.status === 'in_progress').length;
      const pending = session.todos.filter(t => t.status === 'pending').length;

      const progressItem = new TeamTreeItem(
        'Progress',
        vscode.TreeItemCollapsibleState.None
      );
      progressItem.iconPath = new vscode.ThemeIcon('checklist');
      progressItem.description = `${completed} done, ${inProgress} active, ${pending} pending`;
      children.push(progressItem);
    }

    (item as any).children = children;
    return item;
  }

  private buildAgentItem(agent: SubagentInfo, session: TeamSession): TeamTreeItem {
    const maxLen = 80;
    const taskLabel = agent.task.length > maxLen
      ? agent.task.substring(0, maxLen - 3) + '...'
      : agent.task;

    const item = new TeamTreeItem(taskLabel, vscode.TreeItemCollapsibleState.None, undefined, agent);

    const descParts: string[] = [];
    if (agent.agentType) { descParts.push(`[${agent.agentType}]`); }
    descParts.push(agent.slug);

    if (agent.active) {
      item.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.green'));
      item.description = descParts.join(' ');
    } else {
      item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      item.description = descParts.join(' ');
    }

    const tooltipParts = [`**${agent.slug}** (${agent.agentId})`];
    if (agent.agentType) { tooltipParts.push(`Type: \`${agent.agentType}\``); }
    tooltipParts.push('', agent.task, '', '*Click to open live view*');
    item.tooltip = new vscode.MarkdownString(tooltipParts.join('\n'));
    item.contextValue = 'agent-team-member';

    // Click to open live view
    item.command = {
      command: 'claudeCodeBrowser.agentTeams.watch',
      title: 'Watch Agent',
      arguments: [item]
    };

    return item;
  }

  private getSessionLabel(session: TeamSession): string {
    // Try to get a meaningful label from todos
    const inProgressTodo = session.todos.find(t => t.status === 'in_progress');
    if (inProgressTodo?.activeForm) {
      return inProgressTodo.activeForm;
    }

    // Use first todo content
    if (session.todos.length > 0) {
      const first = session.todos[0].content;
      return first.length > 60 ? first.substring(0, 57) + '...' : first;
    }

    // Fallback to project name
    return session.projectName;
  }

  /**
   * Scan all project directories for sessions that have subagents.
   */
  private discoverTeamSessions(): TeamSession[] {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    const todosDir = path.join(os.homedir(), '.claude', 'todos');
    const sessions: TeamSession[] = [];

    if (!fs.existsSync(projectsDir)) { return sessions; }

    try {
      const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const projectDir of projectDirs) {
        const projectPath = path.join(projectsDir, projectDir.name);

        try {
          const entries = fs.readdirSync(projectPath, { withFileTypes: true })
            .filter(d => d.isDirectory());

          for (const entry of entries) {
            const subagentsDir = path.join(projectPath, entry.name, 'subagents');
            if (!fs.existsSync(subagentsDir)) { continue; }

            const sessionId = entry.name;

            try {
              const agentFiles = fs.readdirSync(subagentsDir)
                .filter(f => f.startsWith('agent-') && f.endsWith('.jsonl') && !f.includes('compact'));

              if (agentFiles.length === 0) { continue; }

              // Read subagent info
              const subagents: SubagentInfo[] = [];
              let latestMtime = 0;

              for (const agentFile of agentFiles) {
                const agentPath = path.join(subagentsDir, agentFile);
                const stat = fs.statSync(agentPath);
                if (stat.mtimeMs > latestMtime) {
                  latestMtime = stat.mtimeMs;
                }

                const info = this.readSubagentInfo(agentPath, sessionId, todosDir);
                if (info) {
                  subagents.push(info);
                }
              }

              // Read parent session todos
              const todos = this.readTodos(sessionId, todosDir);
              const hasActive = todos.some(t => t.status === 'in_progress');

              // Check parent todo file mtime too
              const parentTodoFile = path.join(todosDir, `${sessionId}-agent-${sessionId}.json`);
              if (fs.existsSync(parentTodoFile)) {
                const stat = fs.statSync(parentTodoFile);
                if (stat.mtimeMs > latestMtime) {
                  latestMtime = stat.mtimeMs;
                }
              }

              const projectName = this.formatProjectName(projectDir.name);

              // Resolve agent types from parent session JSONL
              const parentJsonl = path.join(projectPath, `${sessionId}.jsonl`);
              this.resolveAgentTypes(parentJsonl, subagents);

              sessions.push({
                sessionId,
                projectKey: projectDir.name,
                projectName,
                todos,
                subagents,
                lastModified: latestMtime,
                active: hasActive
              });
            } catch {
              // Skip malformed session dirs
            }
          }
        } catch {
          // Skip unreadable project dirs
        }
      }
    } catch {
      // Skip if projects dir can't be read
    }

    return sessions;
  }

  /**
   * Read the first line of a subagent JSONL to extract slug, agentId, and task.
   */
  private readSubagentInfo(jsonlPath: string, sessionId: string, todosDir: string): SubagentInfo | null {
    try {
      // Read enough bytes to capture the first JSONL line
      // First lines can be large due to long task descriptions (up to ~10KB)
      const fd = fs.openSync(jsonlPath, 'r');
      const bufSize = 65536; // 64KB should cover any first line
      const buf = Buffer.alloc(bufSize);
      const bytesRead = fs.readSync(fd, buf, 0, bufSize, 0);
      fs.closeSync(fd);

      if (bytesRead === 0) { return null; }

      const content = buf.toString('utf-8', 0, bytesRead);
      const firstNewline = content.indexOf('\n');
      const firstLine = firstNewline > 0 ? content.substring(0, firstNewline) : content;

      const data = JSON.parse(firstLine);
      const agentId = data.agentId || '';
      const slug = data.slug || agentId;

      // Extract task from message content
      let task = '';
      const msgContent = data.message?.content;
      if (typeof msgContent === 'string') {
        task = msgContent;
      } else if (Array.isArray(msgContent)) {
        for (const item of msgContent) {
          if (item?.type === 'text') {
            task = item.text || '';
            break;
          }
        }
      }

      // Get first line of task as summary
      const firstTaskLine = task.split('\n')[0].trim();
      const taskSummary = firstTaskLine.length > 120
        ? firstTaskLine.substring(0, 117) + '...'
        : firstTaskLine;

      // Check if agent has active todos
      const agentTodoFile = path.join(todosDir, `${sessionId}-agent-${agentId}.json`);
      let active = false;
      if (fs.existsSync(agentTodoFile)) {
        try {
          const todos: TodoItem[] = JSON.parse(fs.readFileSync(agentTodoFile, 'utf-8'));
          active = Array.isArray(todos) && todos.some(t => t.status === 'in_progress');
        } catch { /* ignore */ }
      }

      return {
        agentId,
        slug,
        task: taskSummary || slug,
        fullTask: task,
        jsonlPath,
        sessionId,
        active
      };
    } catch {
      return null;
    }
  }

  /**
   * Read the parent session's todo list.
   */
  private readTodos(sessionId: string, todosDir: string): TodoItem[] {
    const todoFile = path.join(todosDir, `${sessionId}-agent-${sessionId}.json`);
    if (!fs.existsSync(todoFile)) { return []; }

    try {
      const todos = JSON.parse(fs.readFileSync(todoFile, 'utf-8'));
      return Array.isArray(todos) ? todos : [];
    } catch {
      return [];
    }
  }

  /**
   * Resolve agent types by scanning the parent session JSONL for Task tool_use calls
   * and agent_progress entries that link tool_use IDs to agent IDs.
   */
  private resolveAgentTypes(parentJsonlPath: string, subagents: SubagentInfo[]): void {
    if (!fs.existsSync(parentJsonlPath) || subagents.length === 0) { return; }

    const agentIds = new Set(subagents.map(a => a.agentId));
    const taskToolCalls = new Map<string, string>(); // tool_use_id -> subagent_type
    const agentTypeMap = new Map<string, string>(); // agentId -> subagent_type

    try {
      const content = fs.readFileSync(parentJsonlPath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) { continue; }
        // Stop early once all agents have types
        if (agentTypeMap.size >= agentIds.size) { break; }

        try {
          const data = JSON.parse(line);

          // Collect Task tool_use calls with subagent_type
          const msgContent = data.message?.content;
          if (Array.isArray(msgContent)) {
            for (const block of msgContent) {
              if (block?.name === 'Task' && block.input?.subagent_type) {
                taskToolCalls.set(block.id, block.input.subagent_type);
              }
            }
          }

          // Match agent_progress entries: parentToolUseID -> agentId
          if (data.type === 'progress' && data.data?.type === 'agent_progress') {
            const parentToolId = data.parentToolUseID;
            const agentId = data.data?.agentId;
            if (parentToolId && agentId && agentIds.has(agentId) && taskToolCalls.has(parentToolId)) {
              agentTypeMap.set(agentId, taskToolCalls.get(parentToolId)!);
            }
          }
        } catch { /* skip malformed lines */ }
      }

      // Apply resolved types to subagents
      for (const agent of subagents) {
        const resolvedType = agentTypeMap.get(agent.agentId);
        if (resolvedType) {
          agent.agentType = resolvedType;
        }
      }
    } catch { /* ignore read errors */ }
  }

  private formatProjectName(dirName: string): string {
    // Convert "-Users-chasebowers-Documents-AI-Workflows" to "AI Workflows"
    const parts = dirName.replace(/^-/, '').split('-');
    // Take last 2-3 meaningful parts
    const meaningful = parts.slice(-2);
    return meaningful.join(' ');
  }

  private relativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) { return 'just now'; }
    if (minutes < 60) { return `${minutes}m ago`; }
    if (hours < 24) { return `${hours}h ago`; }
    if (days < 7) { return `${days}d ago`; }
    return new Date(timestamp).toLocaleDateString();
  }

  private buildSessionTooltip(session: TeamSession): vscode.MarkdownString {
    const lines: string[] = [];
    lines.push(`**${session.projectName}**`);
    lines.push(`Session: \`${session.sessionId.substring(0, 8)}\``);
    lines.push(`Agents: ${session.subagents.length}`);
    lines.push('');

    if (session.todos.length > 0) {
      lines.push('**Tasks:**');
      for (const todo of session.todos) {
        const icon = todo.status === 'completed' ? '$(check)' : todo.status === 'in_progress' ? '$(sync~spin)' : '$(circle-outline)';
        lines.push(`${icon} ${todo.content}`);
      }
    }

    const md = new vscode.MarkdownString(lines.join('\n'));
    md.isTrusted = true;
    return md;
  }
}
