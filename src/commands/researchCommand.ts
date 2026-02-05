/**
 * Command to generate research prompts for creating new skills
 */

import * as vscode from 'vscode';
import { generateResearchPrompt, topicToSkillName } from '../services/researchPromptService';
import { SkillsProvider } from '../providers/skillsProvider';

export function registerResearchCommand(
  context: vscode.ExtensionContext,
  skillsProvider: SkillsProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.generateResearchPrompt', async () => {
      // Get topic from user
      const topic = await vscode.window.showInputBox({
        prompt: 'What topic should Claude research?',
        placeHolder: 'e.g., Playwright testing best practices',
        title: 'Create Skill from Research'
      });

      if (!topic) {
        return;
      }

      // Generate skill name
      const defaultName = topicToSkillName(topic);
      const skillName = await vscode.window.showInputBox({
        prompt: 'Skill folder name',
        value: defaultName,
        title: 'Skill Name'
      });

      if (!skillName) {
        return;
      }

      // Generate and copy prompt
      const prompt = generateResearchPrompt(topic, skillName);
      await vscode.env.clipboard.writeText(prompt);

      vscode.window.showInformationMessage(
        `Research prompt copied! Paste into Claude Code to create "${skillName}" skill.`,
        'Open Terminal'
      ).then(choice => {
        if (choice === 'Open Terminal') {
          vscode.commands.executeCommand('workbench.action.terminal.focus');
        }
      });
    })
  );
}
