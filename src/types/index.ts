import * as vscode from 'vscode';

/**
 * Scope of a resource - global (~/.claude) or project-specific
 */
export type ResourceScope = 'global' | 'project';

/**
 * Type of Claude Code resource
 */
export type ResourceType = 'skill' | 'agent' | 'mcp' | 'plugin';

/**
 * Base interface for all resource tree items
 */
export interface ResourceItem extends vscode.TreeItem {
  /** Display name of the resource */
  name: string;
  /** Brief description of what the resource does */
  resourceDescription: string;
  /** Whether this is a global or project resource */
  scope: ResourceScope;
  /** The type of resource */
  resourceType: ResourceType;
  /** Path to the source file */
  filePath?: string;
  /** Command to invoke this resource (e.g., "/frontend-design") */
  invokeCommand?: string;
}

/**
 * Metadata extracted from a SKILL.md file
 */
export interface SkillMetadata {
  name: string;
  description: string;
  model?: string;
  allowedTools?: string[];
  filePath: string;
}

/**
 * Metadata extracted from an agent .md file
 */
export interface AgentMetadata {
  name: string;
  description: string;
  tools?: string;
  model?: string;
  filePath: string;
}

/**
 * MCP server configuration
 */
export interface McpServer {
  name: string;
  url?: string;
  command?: string;
  args?: string[];
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  name: string;
  version: string;
  marketplace?: string;
  installedAt?: string;
}

/**
 * Virtual folder definition for organizing resources
 */
export interface VirtualFolder {
  /** Unique identifier for the folder */
  id: string;
  /** Display name of the folder */
  name: string;
  /** The resource type this folder belongs to */
  resourceType: ResourceType;
}

/**
 * Mapping of item file paths to folder IDs
 * Key: filePath of the resource item
 * Value: folderId (or undefined for root level)
 */
export type FolderAssignments = Record<string, string>;

/**
 * Complete folder state for persistence
 */
export interface FolderState {
  /** Version for future migrations */
  version: number;
  /** All defined folders by resource type */
  folders: Record<ResourceType, VirtualFolder[]>;
  /** Assignments of items to folders by resource type */
  assignments: Record<ResourceType, FolderAssignments>;
}
