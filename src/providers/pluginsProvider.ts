import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

import { ResourceItem, PluginMetadata } from '../types';
import { parsePluginsManifest } from '../parsers/configParser';

/**
 * Tree item representing a Claude Code plugin
 */
export interface PluginItem extends ResourceItem {
  resourceType: 'plugin';
  plugin: PluginMetadata;
}

/**
 * TreeDataProvider for Claude Code plugins
 *
 * Plugins are global-scoped, loaded from ~/.claude/plugins/installed_plugins.json
 */
export class PluginsProvider implements vscode.TreeDataProvider<PluginItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PluginItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filterText: string = '';

  /**
   * Set filter text and refresh the view
   */
  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this.refresh();
  }

  /**
   * Clear the filter and refresh the view
   */
  clearFilter(): void {
    this.filterText = '';
    this.refresh();
  }

  /**
   * Get child elements for the tree
   * Plugins are flat (no hierarchy), so children of any element is empty
   */
  async getChildren(element?: PluginItem): Promise<PluginItem[]> {
    // Plugin items have no children - flat list
    if (element) {
      return [];
    }

    let items: PluginItem[] = [];

    // Plugins are global-scoped
    const pluginsManifestPath = path.join(
      os.homedir(),
      '.claude',
      'plugins',
      'installed_plugins.json'
    );

    const plugins = await parsePluginsManifest(pluginsManifestPath);

    for (const plugin of plugins) {
      const item = this.createPluginItem(plugin, pluginsManifestPath);
      items.push(item);
    }

    // Apply filter if set
    if (this.filterText) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(this.filterText) ||
        item.resourceDescription.toLowerCase().includes(this.filterText)
      );
    }

    // Sort alphabetically by name
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get the tree item representation for display
   */
  getTreeItem(element: PluginItem): vscode.TreeItem {
    return element;
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Create a PluginItem from plugin metadata
   */
  private createPluginItem(
    plugin: PluginMetadata,
    manifestPath: string
  ): PluginItem {
    // Format version for description
    const versionDisplay = plugin.version !== 'unknown'
      ? `v${plugin.version}`
      : '';

    // The invoke command for plugins is the plugin name (for Skill tool usage)
    const invokeCommand = plugin.name;

    const item: PluginItem = {
      // TreeItem properties
      label: plugin.name,
      description: versionDisplay,
      tooltip: this.buildTooltip(plugin),
      iconPath: new vscode.ThemeIcon('extensions'),
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: 'plugin',

      // ResourceItem properties
      name: plugin.name,
      resourceDescription: this.buildResourceDescription(plugin),
      scope: 'global',
      resourceType: 'plugin',
      filePath: manifestPath,
      invokeCommand,

      // PluginItem specific
      plugin,
    };

    return item;
  }

  /**
   * Build a text description of the plugin
   */
  private buildResourceDescription(plugin: PluginMetadata): string {
    const parts: string[] = [];

    if (plugin.version && plugin.version !== 'unknown') {
      parts.push(`Version ${plugin.version}`);
    }

    if (plugin.marketplace) {
      parts.push(`from ${plugin.marketplace}`);
    }

    return parts.join(' ') || 'Claude Code plugin';
  }

  /**
   * Build a detailed tooltip for the plugin
   */
  private buildTooltip(plugin: PluginMetadata): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${plugin.name}**\n\n`);
    md.appendMarkdown(`*Scope:* Global\n\n`);

    if (plugin.version && plugin.version !== 'unknown') {
      md.appendMarkdown(`*Version:* ${plugin.version}\n\n`);
    }

    if (plugin.marketplace) {
      md.appendMarkdown(`*Marketplace:* ${plugin.marketplace}\n\n`);
    }

    if (plugin.installedAt) {
      md.appendMarkdown(`*Installed:* ${plugin.installedAt}\n\n`);
    }

    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`*Invoke:* \`${plugin.name}\``);

    return md;
  }
}
