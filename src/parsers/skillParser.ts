/**
 * Parser for SKILL.md files with optional YAML frontmatter
 *
 * Extracts metadata from Claude Code skill files. Supports two formats:
 * 1. YAML frontmatter (preferred): metadata between --- delimiters
 * 2. Fallback: folder name as skill name, first paragraph as description
 */

import * as path from 'path';
import { SkillMetadata } from '../types';

/**
 * YAML frontmatter regex pattern
 * Matches content between opening and closing --- delimiters at the start of the file
 */
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

/**
 * Parse a simple YAML string into key-value pairs
 * Handles basic YAML: string values, optional model, and allowed-tools array
 *
 * @param yamlContent - Raw YAML content without delimiters
 * @returns Parsed key-value object
 */
function parseSimpleYaml(yamlContent: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = yamlContent.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] = [];
  let inArray = false;

  for (const line of lines) {
    // Check for array item (starts with "  - " or "- " after a key)
    const arrayItemMatch = line.match(/^\s+-\s+(.+)$/);
    if (inArray && arrayItemMatch) {
      currentArray.push(arrayItemMatch[1].trim());
      continue;
    }

    // If we were in an array and hit a non-array line, save the array
    if (inArray && currentKey) {
      result[currentKey] = currentArray;
      currentArray = [];
      inArray = false;
      currentKey = null;
    }

    // Check for key-value pair
    const keyValueMatch = line.match(/^([a-zA-Z-]+):\s*(.*)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim();
      const value = keyValueMatch[2].trim();

      if (value === '' || value === '|') {
        // This might be the start of an array or multiline value
        currentKey = key;
        inArray = true;
        currentArray = [];
      } else {
        // Simple key-value pair
        result[key] = value;
      }
    }
  }

  // Handle case where file ends while in an array
  if (inArray && currentKey && currentArray.length > 0) {
    result[currentKey] = currentArray;
  }

  return result;
}

/**
 * Extract the first non-heading paragraph from markdown content
 * Used as fallback description when no frontmatter is present
 *
 * @param content - Markdown content (without frontmatter)
 * @returns First paragraph text or empty string
 */
function extractFirstParagraph(content: string): string {
  const lines = content.split('\n');
  let paragraphLines: string[] = [];
  let inParagraph = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines before paragraph starts
    if (!inParagraph && trimmedLine === '') {
      continue;
    }

    // Skip headings
    if (trimmedLine.startsWith('#')) {
      // If we were collecting a paragraph, we're done
      if (inParagraph && paragraphLines.length > 0) {
        break;
      }
      continue;
    }

    // Skip horizontal rules
    if (trimmedLine.match(/^[-*_]{3,}$/)) {
      if (inParagraph && paragraphLines.length > 0) {
        break;
      }
      continue;
    }

    // If we hit an empty line while in a paragraph, we're done
    if (inParagraph && trimmedLine === '') {
      break;
    }

    // Collect paragraph lines
    if (trimmedLine !== '') {
      inParagraph = true;
      paragraphLines.push(trimmedLine);
    }
  }

  return paragraphLines.join(' ').trim();
}

/**
 * Parse a SKILL.md file content and extract metadata
 *
 * @param content - Raw file content
 * @param filePath - Full path to the SKILL.md file
 * @returns SkillMetadata object or null if parsing fails
 */
export function parseSkillFile(content: string, filePath: string): SkillMetadata | null {
  try {
    // Get folder name as fallback for skill name
    const folderPath = path.dirname(filePath);
    const folderName = path.basename(folderPath);

    // Try to extract YAML frontmatter
    const frontmatterMatch = content.match(FRONTMATTER_REGEX);

    if (frontmatterMatch) {
      // Parse YAML frontmatter
      const yamlContent = frontmatterMatch[1];
      const parsed = parseSimpleYaml(yamlContent);

      const name = (parsed['name'] as string) || folderName;
      const description = (parsed['description'] as string) || '';
      const model = parsed['model'] as string | undefined;
      const allowedTools = parsed['allowed-tools'] as string[] | undefined;

      if (!name) {
        console.warn(`[skillParser] No name found in frontmatter or folder for: ${filePath}`);
        return null;
      }

      return {
        name,
        description,
        model,
        allowedTools,
        filePath
      };
    } else {
      // Fallback: use folder name and first paragraph
      const description = extractFirstParagraph(content);

      if (!folderName) {
        console.warn(`[skillParser] Could not determine skill name for: ${filePath}`);
        return null;
      }

      return {
        name: folderName,
        description,
        filePath
      };
    }
  } catch (error) {
    console.warn(`[skillParser] Failed to parse skill file: ${filePath}`, error);
    return null;
  }
}

/**
 * Validate that a parsed skill has minimum required fields
 *
 * @param metadata - Parsed skill metadata
 * @returns true if metadata is valid
 */
export function isValidSkillMetadata(metadata: SkillMetadata | null): metadata is SkillMetadata {
  return metadata !== null && typeof metadata.name === 'string' && metadata.name.length > 0;
}
