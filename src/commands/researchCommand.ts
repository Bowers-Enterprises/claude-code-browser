/**
 * Command to generate research prompts for creating new skills
 */

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import { generateResearchPrompt, topicToSkillName, getTemplatePath, getDefaultTemplate } from '../services/researchPromptService';
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
      const prompt = await generateResearchPrompt(topic, skillName);
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

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBrowser.editResearchTemplate', async () => {
      const templatePath = getTemplatePath();

      try {
        await fs.access(templatePath);
      } catch {
        // File doesn't exist, create it with default content
        const templateDir = path.dirname(templatePath);
        await fs.mkdir(templateDir, { recursive: true });
        await fs.writeFile(templatePath, getDefaultTemplate(), 'utf-8');
      }

      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(templatePath));
      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(
        'Edit the template and save. Use {{topic}} and {{skillName}} as placeholders.'
      );
    })
  );
}
