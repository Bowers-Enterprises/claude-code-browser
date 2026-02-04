/**
 * Service for managing user-added marketplace sources.
 * Marketplace sources are GitHub repositories containing Claude Code skills.
 * Persists sources to VS Code globalState for cross-session storage.
 */

import * as vscode from 'vscode';

const STORAGE_KEY = 'claudeCodeBrowser.marketplaceSources';
const CURRENT_VERSION = 1;

/**
 * A user-added marketplace source (GitHub repo containing skills)
 */
export interface MarketplaceSource {
  id: string;
  name: string;
  type: 'github-repo';
  url: string;
  addedAt: string;
  lastFetched?: string;
  skillCount?: number;
}

/**
 * Definition for a skill from a marketplace source
 */
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  author?: string;
  githubUrl: string;
  category?: string;
  sourceId: string; // Which marketplace source this came from
}

/**
 * Storage format for marketplace sources
 */
interface MarketplaceSourcesState {
  version: number;
  sources: MarketplaceSource[];
}

/**
 * Manager for marketplace sources with persistence
 */
export class MarketplaceSourceManager {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Get all marketplace sources
   */
  getSources(): MarketplaceSource[] {
    const state = this.getState();
    return state.sources;
  }

  /**
   * Get a single source by ID
   */
  getSource(id: string): MarketplaceSource | undefined {
    return this.getSources().find(s => s.id === id);
  }

  /**
   * Add a new marketplace source
   * Validates GitHub URL and extracts repo name for display
   */
  async addSource(url: string): Promise<MarketplaceSource> {
    // Validate and normalize GitHub URL
    const normalizedUrl = this.validateAndNormalizeGitHubUrl(url);
    if (!normalizedUrl) {
      throw new Error('Invalid GitHub repository URL. Expected format: https://github.com/owner/repo');
    }

    const state = this.getState();

    // Check for duplicates
    const existing = state.sources.find(s => s.url === normalizedUrl);
    if (existing) {
      throw new Error(`Source already exists: ${existing.name}`);
    }

    const now = new Date().toISOString();

    // Extract repo name from URL for display name
    const repoName = this.extractRepoName(normalizedUrl);

    const newSource: MarketplaceSource = {
      id: this.generateId(),
      name: repoName,
      type: 'github-repo',
      url: normalizedUrl,
      addedAt: now
    };

    state.sources.push(newSource);
    await this.saveState(state);
    this._onDidChange.fire();

    return newSource;
  }

  /**
   * Remove a marketplace source
   */
  async removeSource(id: string): Promise<boolean> {
    const state = this.getState();
    const index = state.sources.findIndex(s => s.id === id);

    if (index === -1) {
      return false;
    }

    state.sources.splice(index, 1);
    await this.saveState(state);
    this._onDidChange.fire();

    return true;
  }

  /**
   * Update source metadata (e.g., after fetching skills)
   */
  async updateSource(id: string, updates: Partial<Omit<MarketplaceSource, 'id' | 'addedAt'>>): Promise<MarketplaceSource | undefined> {
    const state = this.getState();
    const index = state.sources.findIndex(s => s.id === id);

    if (index === -1) {
      return undefined;
    }

    state.sources[index] = {
      ...state.sources[index],
      ...updates
    };

    await this.saveState(state);
    this._onDidChange.fire();

    return state.sources[index];
  }

  /**
   * Validate and normalize GitHub repository URL
   */
  private validateAndNormalizeGitHubUrl(url: string): string | null {
    try {
      // Handle various GitHub URL formats
      let normalized = url.trim();

      // Remove trailing slash
      normalized = normalized.replace(/\/$/, '');

      // Remove .git suffix if present
      normalized = normalized.replace(/\.git$/, '');

      // Parse URL
      const urlObj = new URL(normalized);

      // Ensure it's a GitHub URL
      if (urlObj.hostname !== 'github.com') {
        return null;
      }

      // Extract path and ensure it has owner/repo format
      const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
      if (pathParts.length < 2) {
        return null;
      }

      // Reconstruct normalized URL (just owner/repo, no tree/blob paths)
      const owner = pathParts[0];
      const repo = pathParts[1];

      return `https://github.com/${owner}/${repo}`;
    } catch {
      return null;
    }
  }

  /**
   * Extract repository name from GitHub URL for display
   */
  private extractRepoName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
      if (pathParts.length >= 2) {
        // Format: "owner/repo"
        return `${pathParts[0]}/${pathParts[1]}`;
      }
      return url;
    } catch {
      return url;
    }
  }

  /**
   * Get the current state from storage
   */
  private getState(): MarketplaceSourcesState {
    const state = this.context.globalState.get<MarketplaceSourcesState>(STORAGE_KEY);

    if (!state) {
      return { version: CURRENT_VERSION, sources: [] };
    }

    return state;
  }

  /**
   * Save state to storage
   */
  private async saveState(state: MarketplaceSourcesState): Promise<void> {
    await this.context.globalState.update(STORAGE_KEY, state);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Fetch skills from a GitHub repository
 *
 * This function attempts to discover skills in a GitHub repo by:
 * 1. Looking for a skills.json manifest file
 * 2. Looking for SKILL.md files in the repo structure
 * 3. Parsing README.md for skill definitions
 */
export async function fetchSkillsFromGitHubRepo(url: string, sourceId: string): Promise<SkillDefinition[]> {
  try {
    // Extract owner and repo from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);

    if (pathParts.length < 2) {
      throw new Error('Invalid GitHub URL format');
    }

    const owner = pathParts[0];
    const repo = pathParts[1];

    // Try to fetch skills.json first
    const skillsFromManifest = await fetchSkillsFromManifest(owner, repo, sourceId, url);
    if (skillsFromManifest.length > 0) {
      return skillsFromManifest;
    }

    // Try to find SKILL.md files
    const skillsFromFiles = await fetchSkillsFromSkillFiles(owner, repo, sourceId, url);
    if (skillsFromFiles.length > 0) {
      return skillsFromFiles;
    }

    // Try to parse README
    const skillsFromReadme = await fetchSkillsFromReadme(owner, repo, sourceId, url);
    if (skillsFromReadme.length > 0) {
      return skillsFromReadme;
    }

    // No skills found
    return [];
  } catch (error) {
    console.error('Error fetching skills from GitHub repo:', error);
    throw new Error(`Failed to fetch skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch skills from a skills.json manifest file
 */
async function fetchSkillsFromManifest(
  owner: string,
  repo: string,
  sourceId: string,
  repoUrl: string
): Promise<SkillDefinition[]> {
  try {
    const manifestUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/skills.json`;
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      // Try master branch
      const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/skills.json`;
      const masterResponse = await fetch(masterUrl);
      if (!masterResponse.ok) {
        return [];
      }
      const data = await masterResponse.json();
      return parseSkillsManifest(data, sourceId, repoUrl);
    }

    const data = await response.json();
    return parseSkillsManifest(data, sourceId, repoUrl);
  } catch {
    return [];
  }
}

/**
 * Parse skills.json manifest
 */
function parseSkillsManifest(data: any, sourceId: string, repoUrl: string): SkillDefinition[] {
  if (!data.skills || !Array.isArray(data.skills)) {
    return [];
  }

  return data.skills
    .filter((skill: any) => skill.id && skill.name)
    .map((skill: any) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description || '',
      author: skill.author,
      githubUrl: skill.githubUrl || repoUrl,
      category: skill.category,
      sourceId
    }));
}

/**
 * Fetch skills from SKILL.md files in the repository
 */
async function fetchSkillsFromSkillFiles(
  owner: string,
  repo: string,
  sourceId: string,
  repoUrl: string
): Promise<SkillDefinition[]> {
  try {
    // Use GitHub API to search for SKILL.md files
    const searchUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      // Try master branch
      const masterUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
      const masterResponse = await fetch(masterUrl);
      if (!masterResponse.ok) {
        return [];
      }
      const data = await masterResponse.json();
      return await extractSkillsFromTree(data, owner, repo, 'master', sourceId, repoUrl);
    }

    const data = await response.json();
    return await extractSkillsFromTree(data, owner, repo, 'main', sourceId, repoUrl);
  } catch {
    return [];
  }
}

/**
 * Extract skills from GitHub tree API response
 */
async function extractSkillsFromTree(
  treeData: any,
  owner: string,
  repo: string,
  branch: string,
  sourceId: string,
  repoUrl: string
): Promise<SkillDefinition[]> {
  if (!treeData.tree || !Array.isArray(treeData.tree)) {
    return [];
  }

  const skillFiles = treeData.tree.filter((item: any) =>
    item.path && item.path.endsWith('SKILL.md') && item.type === 'blob'
  );

  const skills: SkillDefinition[] = [];

  for (const file of skillFiles) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
      const response = await fetch(rawUrl);

      if (response.ok) {
        const content = await response.text();
        const skill = parseSkillMarkdown(content, file.path, sourceId, repoUrl);
        if (skill) {
          skills.push(skill);
        }
      }
    } catch {
      // Skip files that fail to fetch
      continue;
    }
  }

  return skills;
}

/**
 * Parse a SKILL.md file to extract skill metadata
 */
function parseSkillMarkdown(
  content: string,
  filePath: string,
  sourceId: string,
  repoUrl: string
): SkillDefinition | null {
  try {
    // Extract title (first # heading)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const name = titleMatch ? titleMatch[1].trim() : extractSkillNameFromPath(filePath);

    // Extract description (first paragraph after title or metadata section)
    let description = '';
    const lines = content.split('\n');
    let foundTitle = false;
    let foundDescription = false;

    for (const line of lines) {
      if (line.startsWith('# ')) {
        foundTitle = true;
        continue;
      }

      if (foundTitle && !foundDescription && line.trim() && !line.startsWith('#') && !line.startsWith('---')) {
        description = line.trim();
        foundDescription = true;
        break;
      }
    }

    // Generate ID from file path
    const id = extractSkillIdFromPath(filePath);

    return {
      id,
      name,
      description: description || 'No description available',
      githubUrl: repoUrl,
      sourceId
    };
  } catch {
    return null;
  }
}

/**
 * Extract skill name from file path
 */
function extractSkillNameFromPath(filePath: string): string {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];

  if (fileName === 'SKILL.md' && parts.length > 1) {
    // Use parent directory name
    return formatSkillName(parts[parts.length - 2]);
  }

  return formatSkillName(fileName.replace('.md', '').replace('SKILL', ''));
}

/**
 * Extract skill ID from file path
 */
function extractSkillIdFromPath(filePath: string): string {
  const parts = filePath.split('/');

  if (parts[parts.length - 1] === 'SKILL.md' && parts.length > 1) {
    // Use parent directory name
    return parts[parts.length - 2].toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  return parts[parts.length - 1]
    .replace('.md', '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

/**
 * Format skill name for display
 */
function formatSkillName(name: string): string {
  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Fetch skills from README.md
 */
async function fetchSkillsFromReadme(
  owner: string,
  repo: string,
  sourceId: string,
  repoUrl: string
): Promise<SkillDefinition[]> {
  try {
    const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;
    const response = await fetch(readmeUrl);

    if (!response.ok) {
      // Try master branch
      const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`;
      const masterResponse = await fetch(masterUrl);
      if (!masterResponse.ok) {
        return [];
      }
      const content = await masterResponse.text();
      return parseReadmeForSkills(content, sourceId, repoUrl);
    }

    const content = await response.text();
    return parseReadmeForSkills(content, sourceId, repoUrl);
  } catch {
    return [];
  }
}

/**
 * Parse README.md to extract skill listings
 * Looks for structured lists or tables of skills
 */
function parseReadmeForSkills(content: string, sourceId: string, repoUrl: string): SkillDefinition[] {
  const skills: SkillDefinition[] = [];

  // Look for markdown tables with skill information
  const tableRegex = /\|[^\n]+\|[^\n]+\|\n\|[-:\s|]+\|\n((?:\|[^\n]+\|\n?)+)/g;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(content)) !== null) {
    const tableContent = tableMatch[1];
    const rows = tableContent.split('\n').filter(row => row.trim());

    for (const row of rows) {
      const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);

      if (cells.length >= 2) {
        // Assume format: | Name | Description | ... |
        const name = cells[0].replace(/\[([^\]]+)\]\([^)]+\)/, '$1'); // Remove markdown links
        const description = cells[1];

        if (name && description) {
          skills.push({
            id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            name,
            description,
            githubUrl: repoUrl,
            sourceId
          });
        }
      }
    }
  }

  // Look for bulleted lists of skills
  if (skills.length === 0) {
    const listRegex = /^[-*]\s+\*\*([^*]+)\*\*\s*[-:]\s*(.+)$/gm;
    let listMatch;

    while ((listMatch = listRegex.exec(content)) !== null) {
      const name = listMatch[1].trim();
      const description = listMatch[2].trim();

      skills.push({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name,
        description,
        githubUrl: repoUrl,
        sourceId
      });
    }
  }

  return skills;
}
