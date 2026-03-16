import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { detectShell, getConfigPath, setVar, getVar, removeVar, readManagedVars } from './shell.js';
import { parseKeyValue, keyVal, success, error, warn, dim, printTable } from './utils.js';

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
