/**
 * TreeDataProvider for Claude Code Skill Marketplace
 *
 * Displays curated community skills that users can install to ~/.claude/skills/
 * Supports browsing by category, viewing on GitHub, and one-click installation.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { MarketplaceSourceManager, MarketplaceSource, SkillDefinition, fetchSkillsFromGitHubRepo } from '../services/marketplaceSourceManager';

const execAsync = promisify(exec);

/**
 * Represents a skill available in the marketplace
 */
export interface MarketplaceSkill {
  /** Unique identifier (used as folder name when installed) */
  id: string;
  /** Display name */
  name: string;
  /** Brief description */
  description: string;
  /** Author/organization name */
  author: string;
  /** GitHub repository URL */
  githubUrl: string;
  /** Category for grouping */
  category: 'productivity' | 'code-quality' | 'automation' | 'documentation' | 'testing' | 'deployment';
  /** Stars on GitHub (for display/sorting) */
  stars?: number;
  /** Subdirectory within the repo containing the skill (for multi-skill repos) */
  skillPath?: string;
}

/**
 * Curated list of REAL community skills (Staff Picks)
 */
const STAFF_PICKS: MarketplaceSkill[] = [
  // Productivity & Automation
  {
    id: "github-ops",
    name: "GitHub Operations",
    description: "Complete GitHub workflow automation: create PRs, manage issues, run API queries",
    author: "daymade",
    githubUrl: "https://github.com/daymade/claude-code-skills",
    category: "automation",
    stars: 1200,
    skillPath: "github-ops",
  },
  {
    id: "playwright-skill",
    name: "Playwright Browser Automation",
    description: "Write and execute browser automation tests with visual testing across viewports",
    author: "lackeyjb",
    githubUrl: "https://github.com/lackeyjb/playwright-skill",
    category: "testing",
    stars: 1600,
    // No skillPath - repo IS the skill
  },
  {
    id: "test-driven-development",
    name: "Test-Driven Development",
    description: "RED-GREEN-REFACTOR cycle guidance with anti-patterns for testable code",
    author: "obra",
    githubUrl: "https://github.com/anthropics/claude-code-superpowers",
    category: "testing",
    stars: 800,
    skillPath: "test-driven-development",
  },
  {
    id: "systematic-debugging",
    name: "Systematic Debugging",
    description: "Four-phase root cause analysis methodology for complex bugs",
    author: "obra",
    githubUrl: "https://github.com/anthropics/claude-code-superpowers",
    category: "code-quality",
    stars: 800,
    skillPath: "systematic-debugging",
  },
  {
    id: "static-analysis",
    name: "Static Analysis Toolkit",
    description: "Security-focused static analysis using CodeQL, Semgrep for vulnerability detection",
    author: "trailofbits",
    githubUrl: "https://github.com/trailofbits/claude-code-skills",
    category: "code-quality",
    stars: 750,
    skillPath: "static-analysis",
  },
  {
    id: "markdown-tools",
    name: "Markdown Tools",
    description: "Convert documents (Word, PDF, PowerPoint) to markdown with image extraction",
    author: "daymade",
    githubUrl: "https://github.com/daymade/claude-code-skills",
    category: "documentation",
    stars: 1200,
    skillPath: "markdown-tools",
  },
  {
    id: "mermaid-tools",
    name: "Mermaid Diagram Tools",
    description: "Extract Mermaid diagrams from markdown and convert to PNG images",
    author: "daymade",
    githubUrl: "https://github.com/daymade/claude-code-skills",
    category: "documentation",
    stars: 1200,
    skillPath: "mermaid-tools",
  },
  {
    id: "pdf-creator",
    name: "PDF Creator",
    description: "Convert markdown to professional PDFs with full font support",
    author: "daymade",
    githubUrl: "https://github.com/daymade/claude-code-skills",
    category: "documentation",
    stars: 1200,
    skillPath: "pdf-creator",
  },
  {
    id: "ppt-creator",
    name: "PowerPoint Creator",
    description: "Create presentation decks with data-driven charts and PPTX generation",
    author: "daymade",
    githubUrl: "https://github.com/daymade/claude-code-skills",
    category: "documentation",
    stars: 1200,
    skillPath: "ppt-creator",
  },
  {
    id: "qa-expert",
    name: "QA Testing Expert",
    description: "Comprehensive QA testing infrastructure following Google Testing Standards",
    author: "daymade",
    githubUrl: "https://github.com/daymade/claude-code-skills",
    category: "testing",
    stars: 1200,
    skillPath: "qa-expert",
  },
  {
    id: "differential-review",
    name: "Differential Security Review",
    description: "Security-focused code review with git history analysis",
    author: "trailofbits",
    githubUrl: "https://github.com/trailofbits/claude-code-skills",
    category: "code-quality",
    stars: 750,
    skillPath: "differential-review",
  },
  {
    id: "subagent-development",
    name: "Subagent-Driven Development",
    description: "Enable concurrent subagent workflows with two-stage code review",
    author: "obra",
    githubUrl: "https://github.com/anthropics/claude-code-superpowers",
    category: "productivity",
    stars: 800,
    skillPath: "subagent-driven-development",
  },
  {
    id: "skill-creator",
    name: "Skill Creator",
    description: "Meta-skill for building and packaging custom Claude Code skills",
    author: "daymade",
    githubUrl: "https://github.com/daymade/claude-code-skills",
    category: "productivity",
    stars: 1200,
    skillPath: "skill-creator",
  },
  {
    id: "cli-demo-generator",
    name: "CLI Demo Generator",
    description: "Generate animated CLI demos and terminal recordings for documentation",
    author: "daymade",
    githubUrl: "https://github.com/daymade/claude-code-skills",
    category: "documentation",
    stars: 1200,
    skillPath: "cli-demo-generator",
  },
  {
    id: "insecure-defaults",
    name: "Insecure Defaults Detector",
    description: "Detect hardcoded credentials and fail-open security patterns",
    author: "trailofbits",
    githubUrl: "https://github.com/trailofbits/claude-code-skills",
    category: "code-quality",
    stars: 750,
    skillPath: "insecure-defaults",
  },
];

/**
 * Category display configuration
 */
const CATEGORY_CONFIG = {
  'productivity': { label: 'Productivity', icon: 'zap' },
  'code-quality': { label: 'Code Quality', icon: 'checklist' },
  'automation': { label: 'Automation', icon: 'gear' },
  'documentation': { label: 'Documentation', icon: 'book' },
  'testing': { label: 'Testing', icon: 'beaker' },
  'deployment': { label: 'Deployment', icon: 'rocket' }
} as const;

/**
 * Tree item for a marketplace category
 */
export class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: MarketplaceSkill['category'],
    public readonly skillCount: number
  ) {
    const config = CATEGORY_CONFIG[category];
    super(config.label, vscode.TreeItemCollapsibleState.Collapsed);

    this.description = `${skillCount} skill${skillCount !== 1 ? 's' : ''}`;
    this.iconPath = new vscode.ThemeIcon(config.icon);
    this.contextValue = 'marketplace-category';
  }
}

/**
 * Tree item for a marketplace source (user-added)
 */
export class SourceItem extends vscode.TreeItem {
  constructor(
    public readonly source: MarketplaceSource,
    public readonly skillCount: number
  ) {
    super(source.name, vscode.TreeItemCollapsibleState.Collapsed);

    this.description = `${skillCount} skill${skillCount !== 1 ? 's' : ''}`;
    this.iconPath = new vscode.ThemeIcon('repo');
    this.contextValue = 'marketplace-source';
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${source.name}**\n\n`);
    this.tooltip.appendMarkdown(`[View on GitHub](${source.url})\n\n`);
    if (source.lastFetched) {
      this.tooltip.appendMarkdown(`*Last fetched:* ${new Date(source.lastFetched).toLocaleString()}`);
    }
  }
}

/**
 * Tree item for a marketplace skill
 */
export class MarketplaceSkillItem extends vscode.TreeItem {
  constructor(public readonly skill: MarketplaceSkill) {
    super(skill.name, vscode.TreeItemCollapsibleState.None);

    this.description = `by ${skill.author}`;

    // Create tooltip with full details
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${skill.name}**\n\n`);
    this.tooltip.appendMarkdown(`${skill.description}\n\n`);
    this.tooltip.appendMarkdown(`*Author:* ${skill.author}\n\n`);
    if (skill.stars) {
      this.tooltip.appendMarkdown(`⭐ ${skill.stars} stars\n\n`);
    }
    this.tooltip.appendMarkdown(`[View on GitHub](${skill.githubUrl})`);

    // Icon based on installation status
    this.iconPath = new vscode.ThemeIcon('cloud-download');
    this.contextValue = 'marketplace-skill';

    // Check if already installed (async check happens in provider)
    this.checkInstallationStatus();
  }

  private async checkInstallationStatus(): Promise<void> {
    const installPath = path.join(os.homedir(), '.claude', 'skills', this.skill.id);
    try {
      await fs.access(installPath);
      this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      this.contextValue = 'marketplace-skill-installed';
      this.description = `${this.description} (Installed)`;
    } catch {
      // Not installed - keep default icon
    }
  }
}

/**
 * Tree item for skills fetched from user sources
 */
export class SourceSkillItem extends vscode.TreeItem {
  constructor(public readonly skill: SkillDefinition) {
    super(skill.name, vscode.TreeItemCollapsibleState.None);

    this.description = skill.author ? `by ${skill.author}` : '';

    // Create tooltip with full details
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${skill.name}**\n\n`);
    this.tooltip.appendMarkdown(`${skill.description}\n\n`);
    if (skill.author) {
      this.tooltip.appendMarkdown(`*Author:* ${skill.author}\n\n`);
    }
    this.tooltip.appendMarkdown(`[View on GitHub](${skill.githubUrl})`);

    // Icon based on installation status
    this.iconPath = new vscode.ThemeIcon('cloud-download');
    this.contextValue = 'marketplace-source-skill';

    // Check if already installed (async check happens in provider)
    this.checkInstallationStatus();
  }

  private async checkInstallationStatus(): Promise<void> {
    const installPath = path.join(os.homedir(), '.claude', 'skills', this.skill.id);
    try {
      await fs.access(installPath);
      this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      this.contextValue = 'marketplace-source-skill-installed';
      this.description = `${this.description} (Installed)`;
    } catch {
      // Not installed - keep default icon
    }
  }
}

/**
 * Type for marketplace tree items
 */
export type MarketplaceTreeItem = CategoryItem | MarketplaceSkillItem | SourceItem | SourceSkillItem;

/**
 * TreeDataProvider for the Skill Marketplace
 */
export class MarketplaceProvider implements vscode.TreeDataProvider<MarketplaceTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MarketplaceTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filterText: string = '';
  private sourceSkillsCache: Map<string, SkillDefinition[]> = new Map();

  constructor(private sourceManager: MarketplaceSourceManager) {
    // Listen for changes in sources
    sourceManager.onDidChange(() => {
      this.sourceSkillsCache.clear();
      this.refresh();
    });
  }

  /**
   * Set filter text and refresh the view
   */
  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this.refresh();
  }

  /**
   * Clear the filter and refresh the view
   */
  clearFilter(): void {
    this.filterText = '';
    this.refresh();
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Clear the skills cache for a specific source
   */
  clearSourceCache(sourceId: string): void {
    this.sourceSkillsCache.delete(sourceId);
  }

  /**
   * Get tree item for display
   */
  getTreeItem(element: MarketplaceTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for the tree view
   */
  async getChildren(element?: MarketplaceTreeItem): Promise<MarketplaceTreeItem[]> {
    // Root level: show "Staff Picks" category first, then user sources
    if (!element) {
      const items: MarketplaceTreeItem[] = [];

      // Add Staff Picks categories
      const categories = this.getStaffPicksCategories();
      items.push(...categories);

      // Add user sources
      const sources = this.sourceManager.getSources();
      for (const source of sources) {
        try {
          const skills = await this.getSkillsForSource(source);
          items.push(new SourceItem(source, skills.length));
        } catch (error) {
          console.error(`Error loading skills for source ${source.name}:`, error);
          items.push(new SourceItem(source, 0));
        }
      }

      return items;
    }

    // Category level: show skills in that category (Staff Picks)
    if (element instanceof CategoryItem) {
      const skills = STAFF_PICKS.filter(s => s.category === element.category);
      const filteredSkills = this.applyFilterToMarketplaceSkills(skills);

      // Sort by stars (descending), then name
      const sorted = filteredSkills.sort((a, b) => {
        if (a.stars && b.stars) {
          return b.stars - a.stars;
        }
        return a.name.localeCompare(b.name);
      });

      return sorted.map(skill => new MarketplaceSkillItem(skill));
    }

    // Source level: show skills from that source
    if (element instanceof SourceItem) {
      try {
        const skills = await this.getSkillsForSource(element.source);
        const filteredSkills = this.applyFilterToSourceSkills(skills);

        // Sort by name
        const sorted = filteredSkills.sort((a, b) => a.name.localeCompare(b.name));

        return sorted.map(skill => new SourceSkillItem(skill));
      } catch (error) {
        console.error(`Error loading skills for source ${element.source.name}:`, error);
        vscode.window.showErrorMessage(`Failed to load skills from ${element.source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return [];
      }
    }

    // Skills have no children
    return [];
  }

  /**
   * Get skills for a source (with caching)
   */
  private async getSkillsForSource(source: MarketplaceSource): Promise<SkillDefinition[]> {
    // Check cache first
    if (this.sourceSkillsCache.has(source.id)) {
      return this.sourceSkillsCache.get(source.id)!;
    }

    // Fetch from GitHub
    const skills = await fetchSkillsFromGitHubRepo(source.url, source.id);

    // Update source metadata
    await this.sourceManager.updateSource(source.id, {
      lastFetched: new Date().toISOString(),
      skillCount: skills.length
    });

    // Cache the results
    this.sourceSkillsCache.set(source.id, skills);

    return skills;
  }

  /**
   * Get Staff Picks categories with skill counts
   */
  private getStaffPicksCategories(): CategoryItem[] {
    const categoryCounts = new Map<MarketplaceSkill['category'], number>();

    // Count skills per category (after filtering)
    for (const skill of STAFF_PICKS) {
      if (this.matchesFilterForMarketplaceSkill(skill)) {
        const count = categoryCounts.get(skill.category) || 0;
        categoryCounts.set(skill.category, count + 1);
      }
    }

    // Create category items
    const categories: CategoryItem[] = [];
    for (const [category, count] of categoryCounts.entries()) {
      if (count > 0) { // Only show categories with skills
        categories.push(new CategoryItem(category, count));
      }
    }

    // Sort by category label
    return categories.sort((a, b) => {
      const labelA = CATEGORY_CONFIG[a.category].label;
      const labelB = CATEGORY_CONFIG[b.category].label;
      return labelA.localeCompare(labelB);
    });
  }

  /**
   * Apply filter to marketplace skills
   */
  private applyFilterToMarketplaceSkills(skills: MarketplaceSkill[]): MarketplaceSkill[] {
    if (!this.filterText) {
      return skills;
    }
    return skills.filter(skill => this.matchesFilterForMarketplaceSkill(skill));
  }

  /**
   * Apply filter to source skills
   */
  private applyFilterToSourceSkills(skills: SkillDefinition[]): SkillDefinition[] {
    if (!this.filterText) {
      return skills;
    }
    return skills.filter(skill => this.matchesFilterForSourceSkill(skill));
  }

  /**
   * Check if a marketplace skill matches the filter
   */
  private matchesFilterForMarketplaceSkill(skill: MarketplaceSkill): boolean {
    if (!this.filterText) {
      return true;
    }
    return (
      skill.name.toLowerCase().includes(this.filterText) ||
      skill.description.toLowerCase().includes(this.filterText) ||
      skill.author.toLowerCase().includes(this.filterText)
    );
  }

  /**
   * Check if a source skill matches the filter
   */
  private matchesFilterForSourceSkill(skill: SkillDefinition): boolean {
    if (!this.filterText) {
      return true;
    }
    return (
      skill.name.toLowerCase().includes(this.filterText) ||
      skill.description.toLowerCase().includes(this.filterText) ||
      Boolean(skill.author && skill.author.toLowerCase().includes(this.filterText))
    );
  }
}

/**
 * Install a skill from the marketplace
 */
async function installSkill(skill: MarketplaceSkill | SkillDefinition): Promise<void> {
  const targetPath = path.join(os.homedir(), '.claude', 'skills', skill.id);

  // Check if already installed
  try {
    await fs.access(targetPath);
    const choice = await vscode.window.showWarningMessage(
      `Skill "${skill.name}" is already installed. Reinstall?`,
      'Reinstall',
      'Cancel'
    );
    if (choice !== 'Reinstall') {
      return;
    }
    // Remove existing installation
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch {
    // Not installed, proceed
  }

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing ${skill.name}...`,
      cancellable: false
    },
    async (progress) => {
      try {
        // Create temp directory
        const tempDir = path.join(os.tmpdir(), `claude-skill-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });

        progress.report({ message: 'Cloning repository...' });

        // Clone the repository
        await execAsync(`git clone --depth 1 "${skill.githubUrl}" "${tempDir}"`, {
          timeout: 60000 // 60 second timeout
        });

        progress.report({ message: 'Installing skill...' });

        // Ensure target directory exists
        const skillsDir = path.join(os.homedir(), '.claude', 'skills');
        await fs.mkdir(skillsDir, { recursive: true });

        // Determine source directory
        // 1. If skill has skillPath (for multi-skill repos), use that subdirectory
        // 2. Otherwise check for /skill subdirectory
        // 3. Fall back to repo root
        let sourceDir = tempDir;

        // Check if this is a MarketplaceSkill with skillPath
        const marketplaceSkill = skill as MarketplaceSkill;
        if (marketplaceSkill.skillPath) {
          const skillPathDir = path.join(tempDir, marketplaceSkill.skillPath);
          try {
            await fs.access(skillPathDir);
            sourceDir = skillPathDir;
          } catch {
            throw new Error(`Skill directory "${marketplaceSkill.skillPath}" not found in repository`);
          }
        } else {
          // Fall back to looking for /skill subdirectory or use repo root
          try {
            const skillSubdir = path.join(tempDir, 'skill');
            await fs.access(skillSubdir);
            sourceDir = skillSubdir;
          } catch {
            // No /skill subdirectory, use repo root
          }
        }

        await fs.cp(sourceDir, targetPath, { recursive: true });

        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });

        progress.report({ message: 'Complete!' });

        // Show success message
        vscode.window.showInformationMessage(
          `Successfully installed "${skill.name}"! Reload VS Code to see it in your Skills list.`,
          'Reload Now',
          'Later'
        ).then(choice => {
          if (choice === 'Reload Now') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(
          `Failed to install "${skill.name}": ${errorMessage}`
        );
        throw error;
      }
    }
  );
}

/**
 * Open skill repository in browser
 */
async function viewOnGitHub(skill: MarketplaceSkill | SkillDefinition): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(skill.githubUrl));
}

/**
 * Register marketplace commands
 */
export function registerMarketplaceCommands(
  context: vscode.ExtensionContext,
  provider: MarketplaceProvider
): void {
  // Install skill command (for Staff Picks)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeCodeBrowser.marketplace.installSkill',
      async (item: MarketplaceSkillItem) => {
        await installSkill(item.skill);
        provider.refresh();
      }
    )
  );

  // Install skill command (for source skills)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeCodeBrowser.marketplace.installSourceSkill',
      async (item: SourceSkillItem) => {
        await installSkill(item.skill);
        provider.refresh();
      }
    )
  );

  // View on GitHub command (for Staff Picks)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeCodeBrowser.marketplace.viewOnGitHub',
      async (item: MarketplaceSkillItem) => {
        await viewOnGitHub(item.skill);
      }
    )
  );

  // View on GitHub command (for source skills)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeCodeBrowser.marketplace.viewSourceSkillOnGitHub',
      async (item: SourceSkillItem) => {
        await viewOnGitHub(item.skill);
      }
    )
  );

  // Add source command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeCodeBrowser.marketplace.addSource',
      async () => {
        const url = await vscode.window.showInputBox({
          prompt: 'Enter GitHub repository URL',
          placeHolder: 'https://github.com/owner/repo',
          validateInput: (value) => {
            if (!value) {
              return 'URL is required';
            }
            if (!value.includes('github.com')) {
              return 'Must be a GitHub repository URL';
            }
            return null;
          }
        });

        if (url) {
          try {
            const source = await provider['sourceManager'].addSource(url);
            vscode.window.showInformationMessage(`Added marketplace source: ${source.name}`);
            provider.refresh();
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to add source: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }
    )
  );

  // Remove source command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeCodeBrowser.marketplace.removeSource',
      async (item: SourceItem) => {
        const choice = await vscode.window.showWarningMessage(
          `Remove marketplace source "${item.source.name}"?`,
          'Remove',
          'Cancel'
        );

        if (choice === 'Remove') {
          const removed = await provider['sourceManager'].removeSource(item.source.id);
          if (removed) {
            vscode.window.showInformationMessage(`Removed marketplace source: ${item.source.name}`);
            provider.clearSourceCache(item.source.id);
            provider.refresh();
          }
        }
      }
    )
  );

  // Refresh source command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeCodeBrowser.marketplace.refreshSource',
      async (item: SourceItem) => {
        provider.clearSourceCache(item.source.id);
        provider.refresh();
        vscode.window.showInformationMessage(`Refreshed source: ${item.source.name}`);
      }
    )
  );

  // Refresh marketplace command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeCodeBrowser.marketplace.refresh',
      () => {
        provider.refresh();
      }
    )
  );
}
