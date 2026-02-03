import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentMetadata } from '../types';

/**
 * Regex pattern to match YAML frontmatter at the start of a markdown file.
 * Matches content between opening and closing --- delimiters.
 */
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

/**
 * Parse a simple YAML key-value pair.
 * Handles basic string values (with or without quotes).
 */
function parseYamlLine(line: string): [string, string] | null {
  const match = line.match(/^(\w+):\s*(.*)$/);
  if (!match) {
    return null;
  }
  const key = match[1].trim();
  let value = match[2].trim();

  // Remove surrounding quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

/**
 * Parse YAML frontmatter into a key-value object.
 * Only handles simple key: value pairs (no nested objects or arrays).
 */
function parseFrontmatter(frontmatterContent: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = frontmatterContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parsed = parseYamlLine(trimmed);
    if (parsed) {
      const [key, value] = parsed;
      result[key] = value;
    }
  }

  return result;
}

/**
 * Extract description from markdown content by finding the first
 * non-heading, non-empty paragraph line.
 */
function extractDescriptionFromContent(content: string): string {
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Skip headings (lines starting with #)
    if (trimmed.startsWith('#')) {
      continue;
    }

    // Skip frontmatter delimiters
    if (trimmed === '---') {
      continue;
    }

    // Skip code block markers
    if (trimmed.startsWith('```')) {
      continue;
    }

    // Found a content line - use it as description
    // Truncate if too long
    const maxLength = 200;
    if (trimmed.length > maxLength) {
      return trimmed.substring(0, maxLength - 3) + '...';
    }
    return trimmed;
  }

  return '';
}

/**
 * Parse an agent markdown file and extract metadata.
 *
 * Agent files may have YAML frontmatter with name, description, model, tools fields.
 * If no frontmatter is present, the name is derived from the filename and
 * the description is extracted from the first content paragraph.
 *
 * @param filePath - Absolute path to the agent .md file
 * @returns AgentMetadata if parsing succeeds, null if file is malformed or unreadable
 */
export async function parseAgentFile(filePath: string): Promise<AgentMetadata | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const filename = path.basename(filePath, '.md');

    // Try to extract frontmatter
    const frontmatterMatch = content.match(FRONTMATTER_REGEX);

    let name = filename;
    let description = '';
    let model: string | undefined;
    let tools: string | undefined;

    if (frontmatterMatch) {
      const frontmatterContent = frontmatterMatch[1];
      const frontmatter = parseFrontmatter(frontmatterContent);

      // Use frontmatter values if present
      if (frontmatter.name) {
        name = frontmatter.name;
      }
      if (frontmatter.description) {
        description = frontmatter.description;
      }
      if (frontmatter.model) {
        model = frontmatter.model;
      }
      if (frontmatter.tools) {
        tools = frontmatter.tools;
      }

      // If no description in frontmatter, extract from content after frontmatter
      if (!description) {
        const contentAfterFrontmatter = content.substring(frontmatterMatch[0].length);
        description = extractDescriptionFromContent(contentAfterFrontmatter);
      }
    } else {
      // No frontmatter - extract description from full content
      description = extractDescriptionFromContent(content);
    }

    // Fallback description if still empty
    if (!description) {
      description = `Agent: ${name}`;
    }

    return {
      name,
      description,
      model,
      tools,
      filePath
    };
  } catch (error) {
    // Log warning for debugging but return null to handle gracefully
    console.warn(`Failed to parse agent file ${filePath}:`, error);
    return null;
  }
}

/**
 * Scan a directory for agent .md files and parse each one.
 *
 * @param directoryPath - Absolute path to the agents directory
 * @returns Array of successfully parsed AgentMetadata objects
 */
export async function parseAgentsDirectory(directoryPath: string): Promise<AgentMetadata[]> {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const mdFiles = entries.filter(
      entry => entry.isFile() && entry.name.endsWith('.md')
    );

    const parsePromises = mdFiles.map(file => {
      const fullPath = path.join(directoryPath, file.name);
      return parseAgentFile(fullPath);
    });

    const results = await Promise.all(parsePromises);

    // Filter out null results (failed parses) and return valid metadata
    return results.filter((result): result is AgentMetadata => result !== null);
  } catch (error) {
    // Directory doesn't exist or is unreadable - return empty array
    console.warn(`Failed to read agents directory ${directoryPath}:`, error);
    return [];
  }
}
