# Siratik WP Theme JSON Compiler

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
npm install @siratik/wp-theme-json-compiler
```

## CLI Commands

- **split**: Splits a current `theme.json` file into modular JavaScript files in the `theme-config` directory. This makes it easier to manage and edit theme settings in a structured way.
- **compile**: Compiles all modular files from the `theme-config` directory back into a single `theme.json` file. Automatically creates a backup of the existing `theme.json` before overwriting.
- **watch**: Watches the `theme-config` directory for changes. When a change is detected, automatically recompiles `theme.json` (creating a backup the first time in each session).

## Usage

### CLI

```

npx @siratik/wp-theme-json-compiler compile --theme-path=wp-content/themes/your-theme
npx @siratik/wp-theme-json-compiler split --theme-path=wp-content/themes/your-theme
npx @siratik/wp-theme-json-compiler watch --theme-path=wp-content/themes/your-theme

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

## License

GPL-3.0-or-later — see `LICENSE`.

## Disclaimer

This software is provided "as is", without warranty of any kind, express or
implied, including the warranties of merchantability and fitness for a
particular purpose. To the extent permitted by applicable law, the authors and
copyright holders, together with their parent, subsidiary, and affiliated
companies and contributors, are not liable for any direct, indirect,
incidental, or consequential damages arising from its use or inability to use
it, including loss of data, revenue, or site availability.

The software does not guarantee that your site is secure, ranks in search
results, or complies with privacy or other laws; that remains the site owner's
responsibility. AI-generated content can be inaccurate and should be reviewed
before publishing. Third-party services the software connects to are governed
by their own terms.

Keep a current backup and test changes on a staging site before applying them
to a live site. See sections 15 and 16 of the GNU General Public License,
version 3, for the full terms.
