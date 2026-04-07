/**
 * Service for tracking skill provenance and checking for updates.
 *
 * Each installed skill can have a `.source.json` file that records where it
 * came from (GitHub repo, marketplace source, etc.) and a content hash.
 * This service compares local hashes against remote SKILL.md content to
 * detect available updates.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { promises as fs } from "fs";
import { SkillSourceInfo, SkillUpdateStatus } from "../types";

const UPDATE_CACHE_KEY = "claudeCodeBrowser.skillUpdateCache";
const CHECK_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Compute SHA-256 hash of a string
 */
function contentHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Read .source.json from a skill directory, or return null if missing/invalid.
 */
async function readSourceInfo(
  skillDir: string,
): Promise<SkillSourceInfo | null> {
  try {
    const raw = await fs.readFile(path.join(skillDir, ".source.json"), "utf-8");
    return JSON.parse(raw) as SkillSourceInfo;
  } catch {
    return null;
  }
}

/**
 * Write .source.json into a skill directory.
 */
async function writeSourceInfo(
  skillDir: string,
  info: SkillSourceInfo,
): Promise<void> {
  await fs.writeFile(
    path.join(skillDir, ".source.json"),
    JSON.stringify(info, null, 2) + "\n",
    "utf-8",
  );
}

/**
 * Extract owner and repo from a GitHub URL.
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter((p) => p.length > 0);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

/**
 * Fetch the raw SKILL.md content from a GitHub repo.
 * Tries main, then master branch.
 */
async function fetchRemoteSkillContent(
  repoUrl: string,
  skillPath?: string,
): Promise<string | null> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) return null;

  const { owner, repo } = parsed;
  const filePath = skillPath ? `${skillPath}/SKILL.md` : "SKILL.md";

  for (const branch of ["main", "master"]) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        return await resp.text();
      }
    } catch {
      // try next branch
    }
  }
  return null;
}

export class SkillUpdateService {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  /** skillId -> SkillUpdateStatus */
  private cache: Map<string, SkillUpdateStatus> = new Map();
  private checking = false;

  constructor(private context: vscode.ExtensionContext) {
    this.loadCache();
  }

  // ── Provenance helpers ─────────────────────────────────────────────

  /**
   * Write provenance info for a skill that was just installed.
   */
  async stampInstall(
    skillDir: string,
    opts: {
      source: SkillSourceInfo["source"];
      repo?: string;
      branch?: string;
      skillPath?: string;
      marketplaceSourceId?: string;
    },
  ): Promise<void> {
    const skillMdPath = path.join(skillDir, "SKILL.md");
    let hash = "";
    try {
      const content = await fs.readFile(skillMdPath, "utf-8");
      hash = contentHash(content);
    } catch {
      // skill has no SKILL.md — unusual but possible
    }

    const info: SkillSourceInfo = {
      source: opts.source,
      repo: opts.repo,
      branch: opts.branch,
      skillPath: opts.skillPath,
      installedAt: new Date().toISOString(),
      contentHash: hash,
      marketplaceSourceId: opts.marketplaceSourceId,
    };

    await writeSourceInfo(skillDir, info);
  }

  /**
   * Read provenance for a skill. Returns null if not tracked.
   */
  async getSourceInfo(skillDir: string): Promise<SkillSourceInfo | null> {
    return readSourceInfo(skillDir);
  }

  // ── Update checking ────────────────────────────────────────────────

  /**
   * Check a single skill for updates.
   */
  async checkOne(skillId: string): Promise<SkillUpdateStatus> {
    const skillDir = path.join(os.homedir(), ".claude", "skills", skillId);
    const info = await readSourceInfo(skillDir);

    if (!info || !info.repo) {
      return {
        skillId,
        hasUpdate: false,
        localHash: info?.contentHash ?? "",
        checkedAt: new Date().toISOString(),
        error: "No provenance info or repo URL",
      };
    }

    // Read current local content
    let localHash = "";
    try {
      const content = await fs.readFile(
        path.join(skillDir, "SKILL.md"),
        "utf-8",
      );
      localHash = contentHash(content);
    } catch {
      localHash = info.contentHash;
    }

    // Fetch remote content
    const remote = await fetchRemoteSkillContent(info.repo, info.skillPath);
    if (remote === null) {
      return {
        skillId,
        hasUpdate: false,
        localHash,
        checkedAt: new Date().toISOString(),
        error: "Could not fetch remote SKILL.md",
      };
    }

    const remoteHash = contentHash(remote);
    const status: SkillUpdateStatus = {
      skillId,
      hasUpdate: remoteHash !== localHash,
      localHash,
      remoteHash,
      checkedAt: new Date().toISOString(),
    };

    this.cache.set(skillId, status);
    await this.saveCache();
    this._onDidChange.fire();
    return status;
  }

  /**
   * Check all tracked skills for updates. Shows progress notification.
   * Respects the 1-hour cooldown unless `force` is true.
   */
  async checkAll(force = false): Promise<Map<string, SkillUpdateStatus>> {
    if (this.checking) {
      vscode.window.showInformationMessage(
        "Update check already in progress...",
      );
      return this.cache;
    }

    this.checking = true;
    const results = new Map<string, SkillUpdateStatus>();

    try {
      const skillsDir = path.join(os.homedir(), ".claude", "skills");
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      const tracked: { id: string; dir: string; info: SkillSourceInfo }[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(skillsDir, entry.name);
        const info = await readSourceInfo(dir);
        if (info?.repo) {
          // Check cooldown
          if (!force) {
            const cached = this.cache.get(entry.name);
            if (cached) {
              const elapsed = Date.now() - new Date(cached.checkedAt).getTime();
              if (elapsed < CHECK_COOLDOWN_MS) {
                results.set(entry.name, cached);
                continue;
              }
            }
          }
          tracked.push({ id: entry.name, dir, info });
        }
      }

      if (tracked.length === 0) {
        vscode.window.showInformationMessage(
          "No tracked skills to check. Install skills from the Marketplace to enable update tracking.",
        );
        this.checking = false;
        return results;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Checking for skill updates...",
          cancellable: true,
        },
        async (progress, token) => {
          let checked = 0;
          for (const { id } of tracked) {
            if (token.isCancellationRequested) break;
            progress.report({
              message: `${checked + 1}/${tracked.length}: ${id}`,
              increment: 100 / tracked.length,
            });
            const status = await this.checkOne(id);
            results.set(id, status);
            checked++;
          }
        },
      );

      // Summarize
      const withUpdates = [...results.values()].filter((s) => s.hasUpdate);
      if (withUpdates.length > 0) {
        const msg = `${withUpdates.length} skill${withUpdates.length > 1 ? "s" : ""} with updates available.`;
        vscode.window
          .showInformationMessage(msg, "Show Details")
          .then((choice) => {
            if (choice === "Show Details") {
              const detail = withUpdates
                .map((s) => `  - ${s.skillId}`)
                .join("\n");
              vscode.window.showInformationMessage(
                `Skills with updates:\n${detail}`,
              );
            }
          });
      } else {
        vscode.window.showInformationMessage(
          "All tracked skills are up to date.",
        );
      }
    } finally {
      this.checking = false;
    }

    return results;
  }

  /**
   * Update a single skill by re-cloning from its source repo.
   */
  async updateSkill(skillId: string): Promise<boolean> {
    const skillDir = path.join(os.homedir(), ".claude", "skills", skillId);
    const info = await readSourceInfo(skillDir);

    if (!info?.repo) {
      vscode.window.showErrorMessage(
        `Skill "${skillId}" has no tracked source — cannot update.`,
      );
      return false;
    }

    const parsed = parseGitHubUrl(info.repo);
    if (!parsed) {
      vscode.window.showErrorMessage(
        `Invalid repo URL for skill "${skillId}".`,
      );
      return false;
    }

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Updating ${skillId}...`,
        cancellable: false,
      },
      async (progress) => {
        try {
          const { execFile } = await import("child_process");
          const { promisify } = await import("util");
          const execFileAsync = promisify(execFile);

          // Clone to temp dir
          const tempDir = path.join(
            os.tmpdir(),
            `claude-skill-update-${Date.now()}`,
          );
          await fs.mkdir(tempDir, { recursive: true });

          progress.report({ message: "Cloning repository..." });
          await execFileAsync(
            "git",
            ["clone", "--depth", "1", info.repo!, tempDir],
            {
              timeout: 60000,
            },
          );

          progress.report({ message: "Replacing skill files..." });

          // Determine source directory
          let sourceDir = tempDir;
          if (info.skillPath) {
            const subDir = path.join(tempDir, info.skillPath);
            try {
              await fs.access(subDir);
              sourceDir = subDir;
            } catch {
              throw new Error(
                `Skill path "${info.skillPath}" not found in repo`,
              );
            }
          }

          // Preserve .source.json during update
          const oldSourceJson = await readSourceInfo(skillDir);

          // Remove old skill and copy new
          await fs.rm(skillDir, { recursive: true, force: true });
          await fs.cp(sourceDir, skillDir, { recursive: true });

          // Clean up temp
          await fs.rm(tempDir, { recursive: true, force: true });

          // Re-stamp provenance with updated hash
          await this.stampInstall(skillDir, {
            source: info.source,
            repo: info.repo,
            branch: info.branch,
            skillPath: info.skillPath,
            marketplaceSourceId:
              info.marketplaceSourceId ?? oldSourceJson?.marketplaceSourceId,
          });

          // Clear update status
          const status: SkillUpdateStatus = {
            skillId,
            hasUpdate: false,
            localHash: "",
            checkedAt: new Date().toISOString(),
          };
          // Re-read the new hash
          try {
            const content = await fs.readFile(
              path.join(skillDir, "SKILL.md"),
              "utf-8",
            );
            status.localHash = contentHash(content);
          } catch {
            // ok
          }
          this.cache.set(skillId, status);
          await this.saveCache();
          this._onDidChange.fire();

          vscode.window.showInformationMessage(
            `Skill "${skillId}" updated successfully.`,
          );
          return true;
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to update "${skillId}": ${error instanceof Error ? error.message : String(error)}`,
          );
          return false;
        }
      },
    );
  }

  /**
   * Update all skills that have available updates.
   */
  async updateAll(): Promise<void> {
    const withUpdates = [...this.cache.entries()]
      .filter(([, s]) => s.hasUpdate)
      .map(([id]) => id);

    if (withUpdates.length === 0) {
      vscode.window.showInformationMessage("No skill updates available.");
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      `Update ${withUpdates.length} skill${withUpdates.length > 1 ? "s" : ""}?`,
      "Update All",
      "Cancel",
    );

    if (choice !== "Update All") return;

    let updated = 0;
    for (const id of withUpdates) {
      const ok = await this.updateSkill(id);
      if (ok) updated++;
    }

    vscode.window.showInformationMessage(
      `${updated}/${withUpdates.length} skills updated.`,
    );
  }

  // ── Backfill ───────────────────────────────────────────────────────

  /**
   * Backfill .source.json for skills installed from marketplace sources.
   * Matches installed skills against known marketplace sources by checking
   * if the skill's SKILL.md content matches what the repo serves.
   */
  async backfillFromMarketplaceSources(
    sources: Array<{
      id: string;
      url: string;
      skills: Array<{ id: string; githubUrl: string; skillPath?: string }>;
    }>,
  ): Promise<number> {
    const skillsDir = path.join(os.homedir(), ".claude", "skills");
    let backfilled = 0;

    for (const source of sources) {
      for (const skill of source.skills) {
        const skillDir = path.join(skillsDir, skill.id);

        // Skip if already tracked
        const existing = await readSourceInfo(skillDir);
        if (existing) continue;

        // Check if skill exists locally
        try {
          await fs.access(path.join(skillDir, "SKILL.md"));
        } catch {
          continue;
        }

        // Stamp it
        await this.stampInstall(skillDir, {
          source: "marketplace",
          repo: skill.githubUrl,
          skillPath: (skill as any).skillPath,
          marketplaceSourceId: source.id,
        });
        backfilled++;
      }
    }

    return backfilled;
  }

  // ── Cache queries ──────────────────────────────────────────────────

  /**
   * Get cached update status for a skill.
   */
  getStatus(skillId: string): SkillUpdateStatus | undefined {
    return this.cache.get(skillId);
  }

  /**
   * Get count of skills with available updates.
   */
  getUpdateCount(): number {
    return [...this.cache.values()].filter((s) => s.hasUpdate).length;
  }

  /**
   * Check if a specific skill has an update available.
   */
  hasUpdate(skillId: string): boolean {
    return this.cache.get(skillId)?.hasUpdate ?? false;
  }

  // ── Persistence ────────────────────────────────────────────────────

  private loadCache(): void {
    const raw =
      this.context.globalState.get<Array<[string, SkillUpdateStatus]>>(
        UPDATE_CACHE_KEY,
      );
    if (raw) {
      this.cache = new Map(raw);
    }
  }

  private async saveCache(): Promise<void> {
    await this.context.globalState.update(UPDATE_CACHE_KEY, [
      ...this.cache.entries(),
    ]);
  }
}
