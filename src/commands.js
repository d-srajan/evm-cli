import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { detectShell, getConfigPath, setVar, getVar, removeVar, readManagedVars, writeBackup, listBackups, readBackupFile } from './shell.js';
import { parseKeyValue, parseDotEnvFile, serializeDotEnv, keyVal, success, error, warn, dim, printTable } from './utils.js';

/**
 * Resolve shell + config path, allowing overrides for testing.
 */
function resolveContext(options = {}) {
  const shell = detectShell(options.shell);
  const configPath = getConfigPath(shell, options.config);
  return { shell, configPath };
}

// ─── set ────────────────────────────────────────────────

export function setCommand(args, options = {}) {
  const input = args.join(' ');
  const parsed = parseKeyValue(input);
  if (!parsed) {
    error('Invalid format. Usage: evm set KEY=value');
    process.exitCode = 1;
    return;
  }

  const { shell, configPath } = resolveContext(options);
  const { replaced } = setVar(configPath, shell, parsed.key, parsed.value);

  success(`${replaced ? 'Updated' : 'Set'} ${keyVal(parsed.key, parsed.value)}`);
  console.log(dim(`  persisted to ${configPath}`));
  console.log(dim(`  run: source ${configPath}`));
}

// ─── get ────────────────────────────────────────────────

export function getCommand(key, options = {}) {
  if (!key) {
    error('Usage: evm get KEY');
    process.exitCode = 1;
    return;
  }

  // Check current environment first
  const envValue = process.env[key];
  if (envValue !== undefined) {
    success(keyVal(key, envValue));
    console.log(dim('  source: current environment'));
    return;
  }

  // Fall back to config file
  const { shell, configPath } = resolveContext(options);
  const value = getVar(configPath, shell, key);
  if (value !== null) {
    success(keyVal(key, value));
    console.log(dim(`  source: ${configPath} (not yet in session — run: source ${configPath})`));
  } else {
    error(`${key} is not set`);
    process.exitCode = 1;
  }
}

// ─── rm ─────────────────────────────────────────────────

export function rmCommand(key, options = {}) {
  if (!key) {
    error('Usage: evm rm KEY');
    process.exitCode = 1;
    return;
  }

  const { shell, configPath } = resolveContext(options);
  const removed = removeVar(configPath, shell, key);

  if (removed) {
    success(`Removed ${key}`);
    console.log(dim(`  from ${configPath}`));
    console.log(dim(`  run: source ${configPath}`));
  } else {
    warn(`${key} not found in evm-managed variables`);
  }
}

// ─── list ───────────────────────────────────────────────

export function listCommand(options = {}) {
  const { shell, configPath } = resolveContext(options);
  let vars = readManagedVars(configPath, shell);

  if (options.grep) {
    const pattern = new RegExp(options.grep, 'i');
    vars = vars.filter(v => pattern.test(v.key) || pattern.test(v.value));
  }

  console.log(dim(`  shell: ${shell} | config: ${configPath}\n`));
  printTable(vars, { unmask: options.unmask || false });
}

// ─── import ─────────────────────────────────────────────

export function importCommand(filePath, options = {}) {
  if (!filePath) {
    error('Usage: evm import <file>');
    process.exitCode = 1;
    return;
  }
  if (!existsSync(filePath)) {
    error(`File not found: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const { shell, configPath } = resolveContext(options);
  const content = readFileSync(filePath, 'utf-8');
  const entries = parseDotEnvFile(content);

  if (entries.length === 0) {
    warn('No valid KEY=value entries found in file.');
    return;
  }

  let set = 0, skipped = 0;
  for (const { key, value } of entries) {
    const existing = getVar(configPath, shell, key);
    if (existing !== null && !options.overwrite) {
      skipped++;
      continue;
    }
    setVar(configPath, shell, key, value);
    set++;
  }

  success(`Imported ${set} variable${set !== 1 ? 's' : ''} from ${filePath}`);
  if (skipped > 0) warn(`  Skipped ${skipped} existing (use --overwrite to replace)`);
  console.log(dim(`  persisted to ${configPath}`));
  console.log(dim(`  run: source ${configPath}`));
}

// ─── export ─────────────────────────────────────────────

export function exportCommand(filePath, options = {}) {
  const { shell, configPath } = resolveContext(options);
  const vars = readManagedVars(configPath, shell);

  if (vars.length === 0) {
    warn('No evm-managed variables to export.');
    return;
  }

  const content = serializeDotEnv(vars);

  if (!filePath) {
    // Print to stdout
    process.stdout.write(content);
    return;
  }

  writeFileSync(filePath, content);
  success(`Exported ${vars.length} variable${vars.length !== 1 ? 's' : ''} to ${filePath}`);
}

// ─── copy ────────────────────────────────────────────────

export function copyCommand(src, dest, options = {}) {
  if (!src || !dest) {
    error('Usage: evm copy SRC DEST');
    process.exitCode = 1;
    return;
  }

  const { shell, configPath } = resolveContext(options);
  const value = getVar(configPath, shell, src);

  if (value === null) {
    error(`${src} not found in evm-managed variables`);
    process.exitCode = 1;
    return;
  }

  const existing = getVar(configPath, shell, dest);
  if (existing !== null && !options.overwrite) {
    warn(`${dest} already exists. Use --overwrite to replace.`);
    return;
  }

  setVar(configPath, shell, dest, value);
  success(`Copied ${keyVal(src, value)} → ${keyVal(dest, value)}`);
  console.log(dim(`  persisted to ${configPath}`));
}

// ─── rename ──────────────────────────────────────────────

export function renameCommand(src, dest, options = {}) {
  if (!src || !dest) {
    error('Usage: evm rename SRC DEST');
    process.exitCode = 1;
    return;
  }

  const { shell, configPath } = resolveContext(options);
  const value = getVar(configPath, shell, src);

  if (value === null) {
    error(`${src} not found in evm-managed variables`);
    process.exitCode = 1;
    return;
  }

  const existing = getVar(configPath, shell, dest);
  if (existing !== null && !options.overwrite) {
    warn(`${dest} already exists. Use --overwrite to replace.`);
    return;
  }

  setVar(configPath, shell, dest, value);
  removeVar(configPath, shell, src);
  success(`Renamed ${src} → ${dest}`);
  console.log(dim(`  persisted to ${configPath}`));
}

// ─── backup ──────────────────────────────────────────────

export function backupCommand(options = {}) {
  const { shell, configPath } = resolveContext(options);
  const vars = readManagedVars(configPath, shell);

  if (vars.length === 0) {
    warn('No evm-managed variables to back up.');
    return;
  }

  const backupPath = writeBackup(vars, options.backupDir);
  success(`Backed up ${vars.length} variable${vars.length !== 1 ? 's' : ''}`);
  console.log(dim(`  saved to ${backupPath}`));
}

// ─── restore ─────────────────────────────────────────────

export function restoreCommand(name, options = {}) {
  // --list flag: show all backups
  if (options.list) {
    const backups = listBackups(options.backupDir);
    if (backups.length === 0) {
      warn('No backups found. Run: evm backup');
      return;
    }
    console.log(dim(`  ${backups.length} backup${backups.length !== 1 ? 's' : ''} available:\n`));
    backups.forEach((b, i) => {
      console.log(`  ${i === 0 ? '\x1b[32m→\x1b[0m' : ' '} ${b.name}`);
    });
    console.log(dim('\n  Usage: evm restore <name>'));
    return;
  }

  if (!name) {
    error('Usage: evm restore <backup-name>  or  evm restore --list');
    process.exitCode = 1;
    return;
  }

  // Resolve backup path: accept name (with or without .env) or full path
  const backups = listBackups(options.backupDir);
  const match = backups.find(b => b.name === name || b.name === name.replace(/\.env$/, '') || b.path === name);

  if (!match) {
    error(`Backup "${name}" not found. Run: evm restore --list`);
    process.exitCode = 1;
    return;
  }

  const entries = readBackupFile(match.path);
  if (!entries || entries.length === 0) {
    error('Backup file is empty or invalid.');
    process.exitCode = 1;
    return;
  }

  const { shell, configPath } = resolveContext(options);
  for (const { key, value } of entries) {
    setVar(configPath, shell, key, value);
  }

  success(`Restored ${entries.length} variable${entries.length !== 1 ? 's' : ''} from ${match.name}`);
  console.log(dim(`  persisted to ${configPath}`));
  console.log(dim(`  run: source ${configPath}`));
}

// ─── edit ───────────────────────────────────────────────

export async function editCommand(key, options = {}) {
  if (!key) {
    error('Usage: evm edit KEY');
    process.exitCode = 1;
    return;
  }

  const { shell, configPath } = resolveContext(options);
  const currentValue = getVar(configPath, shell, key);

  if (currentValue === null) {
    error(`${key} not found in evm-managed variables`);
    console.log(dim(`  use: evm set ${key}=value`));
    process.exitCode = 1;
    return;
  }

  console.log(`  Current: ${keyVal(key, currentValue)}`);

  const rl = readline.createInterface({ input, output });
  const newValue = await rl.question(`  New value: `);
  rl.close();

  if (newValue === '') {
    warn('Empty value — no changes made.');
    return;
  }

  setVar(configPath, shell, key, newValue);
  success(`Updated ${keyVal(key, newValue)}`);
  console.log(dim(`  persisted to ${configPath}`));
  console.log(dim(`  run: source ${configPath}`));
}
