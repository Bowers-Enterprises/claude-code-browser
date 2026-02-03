import * as fs from 'fs/promises';

import { McpServer, PluginMetadata } from '../types';

/**
 * Raw structure of .mcp.json file
 */
interface McpConfigFile {
  mcpServers?: Record<string, {
    command?: string;
    args?: string[];
    url?: string;
  }>;
}

/**
 * Parse MCP configuration from .mcp.json file
 *
 * Expected file structure:
 * {
 *   "mcpServers": {
 *     "server-name": {
 *       "command": "npx",
 *       "args": ["-y", "some-mcp-server"]
 *     }
 *   }
 * }
 *
 * @param filePath - Absolute path to .mcp.json file
 * @returns Array of McpServer objects, or empty array if file missing/invalid
 */
export async function parseMcpConfig(filePath: string): Promise<McpServer[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const config: McpConfigFile = JSON.parse(content);

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      return [];
    }

    const servers: McpServer[] = [];

    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      if (!serverConfig || typeof serverConfig !== 'object') {
        continue;
      }

      const server: McpServer = {
        name,
        command: serverConfig.command,
        args: Array.isArray(serverConfig.args) ? serverConfig.args : undefined,
        url: serverConfig.url,
      };

      servers.push(server);
    }

    return servers;
  } catch (error) {
    // File doesn't exist, is unreadable, or contains invalid JSON
    // Return empty array as per requirements
    return [];
  }
}

/**
 * Raw plugin entry structure (flexible to handle variations)
 */
interface RawPluginEntry {
  name?: string;
  version?: string;
  marketplace?: string;
  installedAt?: string;
  installed_at?: string; // Alternative casing
}

/**
 * Parse plugins manifest from installed_plugins.json
 *
 * Handles flexible structure - plugins may be an array or object
 *
 * @param filePath - Absolute path to installed_plugins.json
 * @returns Array of PluginMetadata objects, or empty array if file missing/invalid
 */
export async function parsePluginsManifest(filePath: string): Promise<PluginMetadata[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const manifest: unknown = JSON.parse(content);

    const plugins: PluginMetadata[] = [];

    // Handle array format
    if (Array.isArray(manifest)) {
      for (const entry of manifest) {
        const plugin = extractPluginMetadata(entry);
        if (plugin) {
          plugins.push(plugin);
        }
      }
      return plugins;
    }

    // Handle object format (keyed by plugin name)
    if (manifest && typeof manifest === 'object') {
      // Check if it has a 'plugins' array property
      const manifestObj = manifest as Record<string, unknown>;
      if (Array.isArray(manifestObj.plugins)) {
        for (const entry of manifestObj.plugins) {
          const plugin = extractPluginMetadata(entry);
          if (plugin) {
            plugins.push(plugin);
          }
        }
        return plugins;
      }

      // Otherwise treat keys as plugin names
      for (const [name, value] of Object.entries(manifestObj)) {
        if (value && typeof value === 'object') {
          const entry = value as RawPluginEntry;
          const plugin: PluginMetadata = {
            name: entry.name || name,
            version: entry.version || 'unknown',
            marketplace: entry.marketplace,
            installedAt: entry.installedAt || entry.installed_at,
          };
          plugins.push(plugin);
        } else if (typeof value === 'string') {
          // Simple format: { "plugin-name": "1.0.0" }
          plugins.push({
            name,
            version: value,
          });
        }
      }
    }

    return plugins;
  } catch (error) {
    // File doesn't exist, is unreadable, or contains invalid JSON
    // Return empty array as per requirements
    return [];
  }
}

/**
 * Extract PluginMetadata from a raw entry
 */
function extractPluginMetadata(entry: unknown): PluginMetadata | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const raw = entry as RawPluginEntry;

  // Must have at least a name
  if (!raw.name || typeof raw.name !== 'string') {
    return null;
  }

  return {
    name: raw.name,
    version: raw.version || 'unknown',
    marketplace: raw.marketplace,
    installedAt: raw.installedAt || raw.installed_at,
  };
}
