# Story 2.2: Implement Skill YAML Parser

**Epic:** Resource Discovery
**Priority:** P0
**Estimate:** Small

## Description

As a developer, I need a parser for SKILL.md files that extracts YAML frontmatter metadata so that skills can be displayed with accurate information.

## Acceptance Criteria

```gherkin
Given a SKILL.md file with valid YAML frontmatter
When I parse the file
Then I extract:
  - name (string)
  - description (string)
  - model (optional string)
  - allowed-tools (optional array)

Given a SKILL.md file without frontmatter
When I parse the file
Then I use the folder name as the skill name
And I use the first paragraph as description

Given a SKILL.md file with malformed YAML
When I parse the file
Then I return null or throw a catchable error
And the error includes the file path for debugging

Given a SKILL.md with very long description
When I parse the file
Then description is available in full
And UI can truncate as needed
```

## Technical Notes

### YAML Frontmatter Format
```yaml
---
name: skill-name
description: What it does and when to use it
model: claude-opus-4-5
allowed-tools:
  - Read
  - Bash(python:*)
  - Grep
---

# Skill Content Below
```

### Parser Implementation
```typescript
// src/parsers/skillParser.ts
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SkillMetadata {
  name: string;
  description: string;
  model?: string;
  allowedTools?: string[];
  filePath: string;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

export async function parseSkillFile(filePath: string): Promise<SkillMetadata | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    const match = content.match(FRONTMATTER_REGEX);
    if (!match) {
      // No frontmatter - use folder name and first paragraph
      return extractFromContent(filePath, content);
    }

    const yamlContent = match[1];
    const metadata = parseYaml(yamlContent);

    return {
      name: metadata.name || path.basename(path.dirname(filePath)),
      description: metadata.description || '',
      model: metadata.model,
      allowedTools: metadata['allowed-tools'],
      filePath
    };
  } catch (error) {
    console.warn(`Failed to parse skill file: ${filePath}`, error);
    return null;
  }
}

function parseYaml(yamlContent: string): Record<string, any> {
  // Simple YAML parser for basic key-value pairs
  // Could use 'yaml' package for robustness
  const result: Record<string, any> = {};
  const lines = yamlContent.split('\n');

  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Array item
    if (trimmed.startsWith('- ') && currentKey) {
      if (!currentArray) currentArray = [];
      currentArray.push(trimmed.slice(2));
      result[currentKey] = currentArray;
      continue;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      currentKey = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      currentArray = null;

      if (value) {
        result[currentKey] = value;
      }
    }
  }

  return result;
}

function extractFromContent(filePath: string, content: string): SkillMetadata {
  const folderName = path.basename(path.dirname(filePath));

  // Find first non-heading paragraph
  const lines = content.split('\n');
  let description = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      description = trimmed;
      break;
    }
  }

  return {
    name: folderName,
    description,
    filePath
  };
}
```

### Alternative: Use gray-matter Library
If we want robust YAML parsing:
```typescript
import matter from 'gray-matter';

export async function parseSkillFile(filePath: string): Promise<SkillMetadata | null> {
  const content = await fs.readFile(filePath, 'utf-8');
  const { data } = matter(content);
  // ...
}
```

Decision: Start with simple regex parser (no deps), upgrade to gray-matter if edge cases appear.

## Definition of Done

- [ ] parseSkillFile function implemented
- [ ] Extracts name, description from YAML frontmatter
- [ ] Falls back to folder name when no frontmatter
- [ ] Handles malformed files gracefully
- [ ] Unit tests pass for common cases
