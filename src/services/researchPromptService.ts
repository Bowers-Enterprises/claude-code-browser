/**
 * Service for generating research prompts for Claude Code to create skills
 */

export function generateResearchPrompt(topic: string, skillName: string): string {
  return `# Create a Claude Code Skill: ${topic}

## Your Task
Research "${topic}" thoroughly and create a high-quality Claude Code skill.

## Research Instructions
1. **Web Search**: Search for official documentation, best practices, and tutorials
2. **Read Documentation**: Fetch and analyze the most authoritative sources
3. **Find Examples**: Look for real-world usage patterns and code examples
4. **Identify Triggers**: Determine when this skill should be invoked

## Output Requirements
Create a skill at: ~/.claude/skills/${skillName}/SKILL.md

## SKILL.md Template
\`\`\`markdown
---
name: ${skillName}
description: [One-line description of what this skill does and when to use it]
---

# ${topic}

## Quick Start
[Most common use case with example]

## When to Use
[Bullet list of trigger scenarios]

## Core Concepts
[Key information organized by topic]

## Examples
[2-3 practical examples with code]

## Common Patterns
[Reusable patterns and best practices]

## Troubleshooting
[Common issues and solutions]
\`\`\`

## Quality Criteria
- Clear trigger keywords in description
- Practical examples that can be copy-pasted
- Covers the most common use cases (80/20 rule)
- Well-organized with scannable headings
- Includes edge cases and gotchas

Begin researching now.`;
}

export function topicToSkillName(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}
