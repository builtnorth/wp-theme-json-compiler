# WP Theme JSON Compiler

A modular theme.json compiler for WordPress themes.

> ⚠️ **Warning**
>
> The `compile` and `watch` commands will overwrite your `theme.json` file in the specified theme directory.
>
> A backup is created automatically, but you may want to manually make one as well since this tool has not been thoroughly tested yet.

## Features

- Split `theme.json` into modular files for easier management
- Compile modular files back into a single `theme.json`
- Supports granular splitting for `settings`, `styles`, and more
- CLI commands for `compile`, `split`, and `watch`

## Installation

```bash
npm install @builtnorth/wp-theme-json-compiler
```

## CLI Commands

- **split**: Splits a current `theme.json` file into modular JavaScript files in the `theme-config` directory. This makes it easier to manage and edit theme settings in a structured way.
- **compile**: Compiles all modular files from the `theme-config` directory back into a single `theme.json` file. Automatically creates a backup of the existing `theme.json` before overwriting.
- **watch**: Watches the `theme-config` directory for changes. When a change is detected, automatically recompiles `theme.json` (creating a backup the first time in each session).

## Usage

### CLI

```

npx @builtnorth/wp-theme-json-compiler compile --theme-path=wp-content/themes/your-theme
npx @builtnorth/wp-theme-json-compiler split --theme-path=wp-content/themes/your-theme
npx @builtnorth/wp-theme-json-compiler watch --theme-path=wp-content/themes/your-theme

```

- If `--theme-path` is omitted, the current working directory is used.

### NPM Scripts

Add to your root `package.json` scripts:

```

"theme-json:compile": "wp-theme-json-compiler compile --theme-path=wp-content/themes/your-theme",
"theme-json:split": "wp-theme-json-compiler split --theme-path=wp-content/themes/your-theme",
"theme-json:watch": "wp-theme-json-compiler watch --theme-path=wp-content/themes/your-theme"

```

## Configuration

- By default, operates on `theme.json` and `theme-config` in the current working directory.
- Use `--theme-path` to specify a custom theme directory.

## Automatic Backups

Before overwriting your existing `theme.json`, the compiler automatically creates a backup named `theme.backup.json` in the same theme directory. This occurs every time you run the `compile` command, and once per session when using the `watch` command (the first time a change is detected).

- The backup file is always named `theme.backup.json` and will be overwritten on subsequent runs.
- This helps prevent accidental data loss. To restore, simply rename or copy `theme.backup.json` back to `theme.json`.
- Always verify your changes and keep your own version control backups for extra safety.

## Credits

Thanks to [Nick Diego's article on managing theme.json files](https://nickdiego.com/stop-struggling-with-cumbersome-theme-json-files/) that came up in search results when looking into spitting up a monolithic theme.json file.

## Disclaimer

This tool is provided "as is" without warranty of any kind, express or implied. Use at your own risk. Tool will override currenth theme.json files, so please understand that and/or have a backup. The authors and contributors are not responsible for any damages or liabilities arising from the use of this library. Always test thoroughly in your specific environment before deploying to production.

## License

GNU General Public License version 2 (or later) (GPLv2)
