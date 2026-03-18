import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseExportLine, buildExportLine, parseDotEnvFile, serializeDotEnv } from './utils.js';

const EVM_DIR = join(homedir(), '.evm');
const BACKUP_DIR = join(EVM_DIR, 'backups');

const EVM_START = '# >>> evm managed >>>';
const EVM_END = '# <<< evm managed <<<';

// ─── Shell Detection ────────────────────────────────────

const SHELL_CONFIGS = {
  zsh: () => join(homedir(), '.zshrc'),
  bash: () => {
    const profile = join(homedir(), '.bash_profile');
    const rc = join(homedir(), '.bashrc');
    // macOS typically uses .bash_profile
    if (process.platform === 'darwin' && existsSync(profile)) return profile;
    return rc;
  },
  fish: () => join(homedir(), '.config', 'fish', 'config.fish'),
};

/**
 * Detect the user's shell. Returns 'zsh', 'bash', or 'fish'.
 * Can be overridden for testing via options.
 */
export function detectShell(overrideShell) {
  if (overrideShell) return overrideShell;
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('fish')) return 'fish';
  if (shell.includes('bash')) return 'bash';
  return 'zsh'; // default fallback
}

/**
 * Get the config file path for a shell.
 * Accepts an override path for testing.
 */
export function getConfigPath(shell, overridePath) {
  if (overridePath) return overridePath;
  const resolver = SHELL_CONFIGS[shell];
  if (!resolver) return SHELL_CONFIGS.zsh();
  return resolver();
}

// ─── Config File Operations ─────────────────────────────

/**
 * Read all evm-managed variables from a config file.
 * Returns an array of { key, value }.
 */
export function readManagedVars(configPath, shell) {
  if (!existsSync(configPath)) return [];
  const content = readFileSync(configPath, 'utf-8');
  const lines = content.split('\n');

  let inside = false;
  const vars = [];
  for (const line of lines) {
    if (line.trim() === EVM_START) { inside = true; continue; }
    if (line.trim() === EVM_END) { inside = false; continue; }
    if (!inside) continue;
    const parsed = parseExportLine(line, shell);
    if (parsed) vars.push(parsed);
  }
  return vars;
}

/**
 * Set a variable in the evm-managed block.
 * Creates the block if it doesn't exist.
 * Replaces the value if the key already exists.
 */
export function setVar(configPath, shell, key, value) {
  const content = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : '';
  const exportLine = buildExportLine(key, value, shell);

  if (!content.includes(EVM_START)) {
    // No evm block yet — append it
    const block = `\n${EVM_START}\n${exportLine}\n${EVM_END}\n`;
    writeFileSync(configPath, content + block);
    return { replaced: false };
  }

  // Block exists — rebuild it
  const lines = content.split('\n');
  const result = [];
  let inside = false;
  let replaced = false;

  for (const line of lines) {
    if (line.trim() === EVM_START) {
      inside = true;
      result.push(line);
      continue;
    }
    if (line.trim() === EVM_END) {
      if (!replaced) {
        result.push(exportLine);
      }
      inside = false;
      result.push(line);
      continue;
    }
    if (inside) {
      const parsed = parseExportLine(line, shell);
      if (parsed && parsed.key === key) {
        result.push(exportLine);
        replaced = true;
      } else {
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  writeFileSync(configPath, result.join('\n'));
  return { replaced };
}

/**
 * Remove a variable from the evm-managed block.
 * Returns true if the key was found and removed.
 */
export function removeVar(configPath, shell, key) {
  if (!existsSync(configPath)) return false;
  const content = readFileSync(configPath, 'utf-8');
  if (!content.includes(EVM_START)) return false;

  const lines = content.split('\n');
  const result = [];
  let inside = false;
  let found = false;

  for (const line of lines) {
    if (line.trim() === EVM_START) { inside = true; result.push(line); continue; }
    if (line.trim() === EVM_END) { inside = false; result.push(line); continue; }
    if (inside) {
      const parsed = parseExportLine(line, shell);
      if (parsed && parsed.key === key) {
        found = true;
        continue; // skip this line
      }
    }
    result.push(line);
  }

  if (found) writeFileSync(configPath, result.join('\n'));
  return found;
}

/**
 * Get a single variable's value from the evm block.
 * Returns the value string or null.
 */
export function getVar(configPath, shell, key) {
  const vars = readManagedVars(configPath, shell);
  const entry = vars.find(v => v.key === key);
  return entry ? entry.value : null;
}

// ─── Backup / Restore ───────────────────────────────────

function ensureBackupDir(dir = BACKUP_DIR) {
  mkdirSync(dir, { recursive: true });
}

/**
 * Write a backup of evm-managed vars to ~/.evm/backups/<timestamp>.env
 * Returns the path of the created backup.
 */
export function writeBackup(vars, backupDir = BACKUP_DIR) {
  ensureBackupDir(backupDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
  const filePath = join(backupDir, `${ts}.env`);
  writeFileSync(filePath, serializeDotEnv(vars));
  return filePath;
}

/**
 * List all backup files sorted newest-first.
 * Returns array of { name, path, date }.
 */
export function listBackups(backupDir = BACKUP_DIR) {
  if (!existsSync(backupDir)) return [];
  return readdirSync(backupDir)
    .filter(f => f.endsWith('.env'))
    .sort()
    .reverse()
    .map(f => ({
      name: f.replace('.env', ''),
      path: join(backupDir, f),
    }));
}

/**
 * Read a backup file and return { key, value }[].
 */
export function readBackupFile(filePath) {
  if (!existsSync(filePath)) return null;
  return parseDotEnvFile(readFileSync(filePath, 'utf-8'));
}
