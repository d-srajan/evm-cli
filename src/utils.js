import chalk from 'chalk';

// ─── Parsing ────────────────────────────────────────────

/**
 * Parse "KEY=value" string. Supports values with = in them.
 * Returns { key, value } or null if invalid.
 */
export function parseKeyValue(input) {
  const idx = input.indexOf('=');
  if (idx <= 0) return null;
  const key = input.slice(0, idx).trim();
  const value = input.slice(idx + 1);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  return { key, value };
}

/**
 * Parse an export line from a shell config.
 * Handles: export KEY="value", export KEY='value', export KEY=value
 * And fish: set -gx KEY value, set -gx KEY "value"
 */
export function parseExportLine(line, shell = 'zsh') {
  line = line.trim();
  if (shell === 'fish') {
    const match = line.match(/^set\s+-gx\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.*)$/);
    if (!match) return null;
    return { key: match[1], value: unquote(match[2]) };
  }
  const match = line.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return null;
  return { key: match[1], value: unquote(match[2]) };
}

/** Remove surrounding quotes from a string */
function unquote(s) {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Build an export line for the given shell.
 */
export function buildExportLine(key, value, shell = 'zsh') {
  if (shell === 'fish') {
    return `set -gx ${key} "${value}"`;
  }
  return `export ${key}="${value}"`;
}

// ─── Formatting ─────────────────────────────────────────

const SENSITIVE_PATTERNS = /SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE|CREDENTIAL/i;

export function isSensitiveKey(key) {
  return SENSITIVE_PATTERNS.test(key);
}

export function maskValue(value) {
  if (value.length <= 4) return '••••';
  return '••••' + value.slice(-4);
}

export function success(msg) {
  console.log(`${chalk.green('✓')} ${msg}`);
}

export function error(msg) {
  console.log(`${chalk.red('✗')} ${msg}`);
}

export function warn(msg) {
  console.log(`${chalk.yellow('⚠')} ${msg}`);
}

export function keyVal(key, value) {
  return `${chalk.cyan(key)}${chalk.dim('=')}${chalk.white(value)}`;
}

export function dim(msg) {
  return chalk.dim(msg);
}

/**
 * Print a table of key-value pairs with box-drawing borders.
 */
export function printTable(entries, { unmask = false } = {}) {
  if (entries.length === 0) {
    warn('No environment variables managed by evm.');
    return;
  }

  const maxKey = Math.max(3, ...entries.map(e => e.key.length));
  const displayEntries = entries.map(e => ({
    key: e.key,
    value: (!unmask && isSensitiveKey(e.key)) ? maskValue(e.value) : e.value,
  }));
  const maxVal = Math.max(5, ...displayEntries.map(e => e.value.length));

  const top = `┌${'─'.repeat(maxKey + 2)}┬${'─'.repeat(maxVal + 2)}┐`;
  const mid = `├${'─'.repeat(maxKey + 2)}┼${'─'.repeat(maxVal + 2)}┤`;
  const bot = `└${'─'.repeat(maxKey + 2)}┴${'─'.repeat(maxVal + 2)}┘`;
  const header = `│ ${chalk.bold('KEY'.padEnd(maxKey))} │ ${chalk.bold('VALUE'.padEnd(maxVal))} │`;

  console.log(chalk.dim(top));
  console.log(header);
  console.log(chalk.dim(mid));
  for (const e of displayEntries) {
    const k = chalk.cyan(e.key.padEnd(maxKey));
    const v = (!unmask && isSensitiveKey(e.key)) ? chalk.yellow(e.value.padEnd(maxVal)) : chalk.white(e.value.padEnd(maxVal));
    console.log(`│ ${k} │ ${v} │`);
  }
  console.log(chalk.dim(bot));
  console.log(dim(`  ${entries.length} variable${entries.length === 1 ? '' : 's'}`));
}
