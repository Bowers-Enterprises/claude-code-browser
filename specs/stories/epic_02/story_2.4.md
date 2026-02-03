# Story 2.4: Implement Agent Markdown Parser

**Epic:** Resource Discovery
**Priority:** P0
**Estimate:** Small

## Description

As a developer, I need a parser for agent .md files that extracts YAML frontmatter metadata so that agents can be displayed with accurate information.

## Acceptance Criteria

```gherkin
Given an agent .md file with valid YAML frontmatter
When I parse the file
Then I extract:
  - name (string)
  - description (string)
  - tools (optional string)
  - disallowedTools (optional string)
  - model (optional string)

Given an agent file without frontmatter
When I parse the file
Then I use the filename (without .md) as the agent name
And I use the first paragraph as description

Given an agent file with malformed YAML
When I parse the file
Then I return null or throw a catchable error
```

## Technical Notes

### Parser Implementation
```typescript
// src/parsers/agentParser.ts
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AgentMetadata {
  name: string;
  description: string;
  tools?: string;
  disallowedTools?: string;
  model?: string;
  filePath: string;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

export async function parseAgentFile(filePath: string): Promise<AgentMetadata | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    const match = content.match(FRONTMATTER_REGEX);
    if (!match) {
      return extractFromContent(filePath, content);
    }

    const yamlContent = match[1];
    const metadata = parseYaml(yamlContent);

    return {
      name: metadata.name || path.basename(filePath, '.md'),
      description: metadata.description || '',
      tools: metadata.tools,
      disallowedTools: metadata.disallowedTools,
      model: metadata.model,
      filePath
    };
  } catch (error) {
    console.warn(`Failed to parse agent file: ${filePath}`, error);
    return null;
  }
}

function parseYaml(yamlContent: string): Record<string, any> {
  // Reuse same simple YAML parser from skillParser
  // Or import shared utility
}

function extractFromContent(filePath: string, content: string): AgentMetadata {
  const fileName = path.basename(filePath, '.md');

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
    name: fileName,
    description,
    filePath
  };
}
```

### Shared YAML Parser
Since both skill and agent parsers need YAML parsing, extract to shared utility:
```typescript
// src/parsers/yamlUtils.ts
export function parseSimpleYaml(content: string): Record<string, any> {
  // Shared implementation
}
```

## Definition of Done

- [ ] parseAgentFile function implemented
- [ ] Extracts name, description, tools from frontmatter
- [ ] Falls back to filename when no frontmatter
- [ ] Handles malformed files gracefully
- [ ] Shared YAML parser extracted for reuse
