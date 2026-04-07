/**
 * Commands for checking and applying skill updates.
 *
 * - Check for Updates: scans all tracked skills against their source repos
 * - Update Skill: re-clones a single skill from its source
 * - Update All: updates all skills with available updates
 * - Backfill Sources: stamps .source.json on marketplace-installed skills
 */

import * as vscode from "vscode";
import * as path from "path";
import { SkillUpdateService } from "../services/skillUpdateService";
import { SkillsProvider, SkillItem } from "../providers/skillsProvider";
import {
  MarketplaceProvider,
  MarketplaceSkill,
} from "../providers/marketplaceProvider";
import {
  MarketplaceSourceManager,
  fetchSkillsFromGitHubRepo,
} from "../services/marketplaceSourceManager";

// Re-export the STAFF_PICKS for backfill (we need access to the curated list)
// Since STAFF_PICKS is not exported, we duplicate the IDs we need for backfill.
// The backfill reads marketplace sources from the source manager, plus staff picks
// are matched by their known GitHub URLs.

/**
 * Known Staff Picks repo URLs for backfill matching.
 * Maps skill ID -> { githubUrl, skillPath? }
 */
const STAFF_PICK_REPOS: Record<
  string,
  { githubUrl: string; skillPath?: string }
> = {
  "github-ops": {
    githubUrl: "https://github.com/daymade/claude-code-skills",
    skillPath: "github-ops",
  },
  "playwright-skill": {
    githubUrl: "https://github.com/lackeyjb/playwright-skill",
  },
  "markdown-tools": {
    githubUrl: "https://github.com/daymade/claude-code-skills",
    skillPath: "markdown-tools",
  },
  "mermaid-tools": {
    githubUrl: "https://github.com/daymade/claude-code-skills",
    skillPath: "mermaid-tools",
  },
  "pdf-creator": {
    githubUrl: "https://github.com/daymade/claude-code-skills",
    skillPath: "pdf-creator",
  },
  "ppt-creator": {
    githubUrl: "https://github.com/daymade/claude-code-skills",
    skillPath: "ppt-creator",
  },
  "qa-expert": {
    githubUrl: "https://github.com/daymade/claude-code-skills",
    skillPath: "qa-expert",
  },
  "skill-creator": {
    githubUrl: "https://github.com/daymade/claude-code-skills",
    skillPath: "skill-creator",
  },
  "cli-demo-generator": {
    githubUrl: "https://github.com/daymade/claude-code-skills",
    skillPath: "cli-demo-generator",
  },
};

export function registerUpdateCommands(
  context: vscode.ExtensionContext,
  updateService: SkillUpdateService,
  skillsProvider: SkillsProvider,
  sourceManager: MarketplaceSourceManager,
): void {
  // Check for Updates
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "claudeCodeBrowser.skills.checkForUpdates",
      async () => {
        await updateService.checkAll(true);
        skillsProvider.refresh();
      },
    ),
  );

  // Update single skill (from context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "claudeCodeBrowser.skills.updateSkill",
      async (item: SkillItem) => {
        if (!item?.filePath) {
          vscode.window.showErrorMessage("No skill selected");
          return;
        }
        const skillId = path.basename(path.dirname(item.filePath));
        const ok = await updateService.updateSkill(skillId);
        if (ok) {
          skillsProvider.refresh();
        }
      },
    ),
  );

  // Update All
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "claudeCodeBrowser.skills.updateAll",
      async () => {
        await updateService.updateAll();
        skillsProvider.refresh();
      },
    ),
  );

  // Backfill provenance from marketplace sources
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "claudeCodeBrowser.skills.backfillSources",
      async () => {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Backfilling skill provenance...",
            cancellable: false,
          },
          async (progress) => {
            // Gather all known sources: staff picks + user sources
            const allSources: Array<{
              id: string;
              url: string;
              skills: Array<{
                id: string;
                githubUrl: string;
                skillPath?: string;
              }>;
            }> = [];

            // Staff picks
            progress.report({ message: "Matching Staff Picks..." });
            const staffPickSkills = Object.entries(STAFF_PICK_REPOS).map(
              ([id, info]) => ({
                id,
                githubUrl: info.githubUrl,
                skillPath: info.skillPath,
              }),
            );
            allSources.push({
              id: "staff-picks",
              url: "",
              skills: staffPickSkills,
            });

            // User-added marketplace sources
            const sources = sourceManager.getSources();
            for (const source of sources) {
              progress.report({ message: `Fetching ${source.name}...` });
              try {
                const skills = await fetchSkillsFromGitHubRepo(
                  source.url,
                  source.id,
                );
                allSources.push({
                  id: source.id,
                  url: source.url,
                  skills: skills.map((s) => ({
                    id: s.id,
                    githubUrl: s.githubUrl,
                  })),
                });
              } catch {
                // skip failed sources
              }
            }

            progress.report({ message: "Stamping provenance..." });
            const count =
              await updateService.backfillFromMarketplaceSources(allSources);

            if (count > 0) {
              vscode.window.showInformationMessage(
                `Backfilled provenance for ${count} skill${count > 1 ? "s" : ""}.`,
              );
            } else {
              vscode.window.showInformationMessage(
                "No skills needed provenance backfill.",
              );
            }
          },
        );
      },
    ),
  );
}
