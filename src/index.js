import { Command } from 'commander';
import { setCommand, getCommand, rmCommand, listCommand, editCommand, importCommand, exportCommand, copyCommand, renameCommand, backupCommand, restoreCommand } from './commands.js';

export function createProgram() {
  const program = new Command();

  program
    .name('evm')
    .description('Manage OS-level environment variables with ease')
    .version('1.0.0');

  program
    .command('set')
    .description('Set an environment variable: evm set KEY=value')
    .argument('<assignment...>', 'KEY=value pair')
    .action((args) => setCommand(args));

  program
    .command('get')
    .description('Get the value of an environment variable')
    .argument('<key>', 'Variable name')
    .action((key) => getCommand(key));

  program
    .command('rm')
    .description('Remove an environment variable')
    .argument('<key>', 'Variable name')
    .action((key) => rmCommand(key));

  program
    .command('list')
    .description('List all evm-managed environment variables')
    .option('-g, --grep <pattern>', 'Filter by regex pattern')
    .option('-u, --unmask', 'Reveal sensitive values')
    .action((opts) => listCommand(opts));

  program
    .command('edit')
    .description('Interactively edit a variable\'s value')
    .argument('<key>', 'Variable name')
    .action((key) => editCommand(key));

  program
    .command('import')
    .description('Import variables from a .env file')
    .argument('<file>', 'Path to .env file')
    .option('-o, --overwrite', 'Overwrite existing variables')
    .action((file, opts) => importCommand(file, opts));

  program
    .command('export')
    .description('Export evm-managed variables to a .env file (or stdout)')
    .argument('[file]', 'Output file path (omit for stdout)')
    .action((file) => exportCommand(file));

  program
    .command('copy')
    .description('Copy a variable to a new name')
    .argument('<src>', 'Source variable name')
    .argument('<dest>', 'Destination variable name')
    .option('-o, --overwrite', 'Overwrite destination if it exists')
    .action((src, dest, opts) => copyCommand(src, dest, opts));

  program
    .command('rename')
    .description('Rename a variable')
    .argument('<src>', 'Current variable name')
    .argument('<dest>', 'New variable name')
    .option('-o, --overwrite', 'Overwrite destination if it exists')
    .action((src, dest, opts) => renameCommand(src, dest, opts));

  program
    .command('backup')
    .description('Snapshot all evm-managed variables to ~/.evm/backups/')
    .action(() => backupCommand());

  program
    .command('restore')
    .description('Restore variables from a backup')
    .argument('[name]', 'Backup name (from evm restore --list)')
    .option('-l, --list', 'List available backups')
    .action((name, opts) => restoreCommand(name, opts));

  return program;
}
