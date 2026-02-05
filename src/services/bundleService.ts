/**
 * Service for exporting and importing skill bundles as .zip files
 *
 * Uses child_process.execFile with system zip/unzip commands
 * (available on macOS/Linux).
 */

import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Export selected skill folders into a .zip bundle
 * @param skillFolders Array of absolute paths to skill folders
 * @param outputPath Absolute path for the output .zip file
 */
export async function exportBundle(skillFolders: string[], outputPath: string): Promise<void> {
  // Create a temp directory to stage the bundle
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-bundle-'));

  try {
    // Copy each skill folder into the temp directory
    for (const folder of skillFolders) {
      const skillName = path.basename(folder);
      await copyDirectory(folder, path.join(tmpDir, skillName));
    }

    // Create zip from the temp directory
    const skillNames = skillFolders.map(f => path.basename(f));
    await execFileAsync('zip', ['-r', outputPath, ...skillNames], { cwd: tmpDir });
  } finally {
    // Clean up temp directory
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Import skills from a .zip bundle (preview phase)
 * @param zipPath Absolute path to the .zip file
 * @param targetDir Directory to extract skills into (e.g. ~/.claude/skills/)
 * @returns Array of imported skill names and any conflicts
 */
export async function importBundle(
  zipPath: string,
  targetDir: string
): Promise<{ imported: string[]; conflicts: string[] }> {
  // Create a temp directory to extract into
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-import-'));

  try {
    // Extract zip
    await execFileAsync('unzip', ['-o', zipPath, '-d', tmpDir]);

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    // List extracted folders
    const entries = await fs.readdir(tmpDir, { withFileTypes: true });
    const folders = entries.filter(e => e.isDirectory());

    const imported: string[] = [];
    const conflicts: string[] = [];

    for (const folder of folders) {
      const targetPath = path.join(targetDir, folder.name);

      // Check for conflicts
      try {
        await fs.access(targetPath);
        conflicts.push(folder.name);
      } catch {
        // No conflict
      }

      imported.push(folder.name);
    }

    return { imported, conflicts };
  } finally {
    // Clean up temp directory (this is just the preview phase)
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Complete the import by copying from temp to target
 * @param zipPath Path to the zip file
 * @param targetDir Target directory
 * @param skipConflicts Skill names to skip
 * @param replaceConflicts Skill names to replace
 */
export async function completeImport(
  zipPath: string,
  targetDir: string,
  skipConflicts: string[],
  replaceConflicts: string[]
): Promise<{ imported: string[]; skipped: string[] }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-import-'));

  try {
    // Extract zip
    await execFileAsync('unzip', ['-o', zipPath, '-d', tmpDir]);

    await fs.mkdir(targetDir, { recursive: true });

    const entries = await fs.readdir(tmpDir, { withFileTypes: true });
    const folders = entries.filter(e => e.isDirectory());

    const imported: string[] = [];
    const skipped: string[] = [];
    const skipSet = new Set(skipConflicts);
    const replaceSet = new Set(replaceConflicts);

    for (const folder of folders) {
      const sourcePath = path.join(tmpDir, folder.name);
      const targetPath = path.join(targetDir, folder.name);

      // Check if exists
      let exists = false;
      try {
        await fs.access(targetPath);
        exists = true;
      } catch {
        // doesn't exist
      }

      if (exists && skipSet.has(folder.name)) {
        skipped.push(folder.name);
        continue;
      }

      if (exists && replaceSet.has(folder.name)) {
        await fs.rm(targetPath, { recursive: true, force: true });
      }

      if (exists && !replaceSet.has(folder.name) && !skipSet.has(folder.name)) {
        skipped.push(folder.name);
        continue;
      }

      await copyDirectory(sourcePath, targetPath);
      imported.push(folder.name);
    }

    return { imported, skipped };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * List the contents of a zip bundle without extracting
 */
export async function listBundleContents(zipPath: string): Promise<string[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-list-'));

  try {
    await execFileAsync('unzip', ['-o', zipPath, '-d', tmpDir]);
    const entries = await fs.readdir(tmpDir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Recursively copy a directory and all its contents
 */
async function copyDirectory(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}
