# evm — Environment Variable Manager

A simple CLI to set, get, and manage OS-level environment variables across shells — no more manually editing `.zshrc` or `.bashrc`.

Supports **zsh**, **bash**, and **fish**. Variables are persisted in a managed block in your shell config file.

## Install

```bash
npm install -g evm-cli
```

Or run locally:

```bash
git clone https://github.com/d-srajan/evm-cli
cd evm-cli && npm install
node bin/evm.js <command>
```

## Commands

### Core

```bash
evm set KEY=value        # Set and persist a variable
evm get KEY              # Get the current value
evm rm KEY               # Remove a variable
evm list                 # List all managed variables (sensitive values masked)
evm list --unmask        # Reveal sensitive values
evm list --grep pattern  # Filter by key or value
evm edit KEY             # Interactively update a value
```

### Productivity

```bash
evm copy SRC DEST        # Duplicate a variable under a new name
evm rename SRC DEST      # Rename a variable in place
evm import .env          # Bulk import from a .env file
evm import .env --overwrite  # Overwrite existing keys
evm export               # Print all variables to stdout
evm export out.env       # Export to a .env file
```

### Backup & Restore

```bash
evm backup               # Snapshot all variables to ~/.evm/backups/
evm restore --list       # Show available backups
evm restore <name>       # Restore from a backup
```

## How it works

Variables are written inside a managed block in your shell config (`~/.zshrc`, `~/.bashrc`, or `~/.config/fish/config.fish`):

```sh
# >>> evm managed >>>
export DATABASE_URL="postgres://localhost:5432/mydb"
export NODE_ENV="production"
# <<< evm managed <<<
```

After setting a variable, run `source ~/.zshrc` (or your shell's equivalent) to load it into your current session.

## Notes

- Keys matching `SECRET`, `TOKEN`, `PASSWORD`, `API_KEY`, `PRIVATE`, or `CREDENTIAL` are masked in `list` output by default
- evm only touches its managed block — your other shell config is never modified
- Backups are stored as plain `.env` files in `~/.evm/backups/`
