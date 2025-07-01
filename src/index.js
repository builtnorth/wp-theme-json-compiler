#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");

// Parse CLI args for --theme-path
function getThemePathArg() {
	const args = process.argv.slice(2);
	let themePath = null;
	for (let i = 0; i < args.length; i++) {
		if (args[i].startsWith("--theme-path=")) {
			themePath = args[i].split("=")[1];
		} else if (args[i] === "--theme-path" && args[i + 1]) {
			themePath = args[i + 1];
		}
	}
	return themePath ? path.resolve(process.cwd(), themePath) : process.cwd();
}

const THEME_BASE = getThemePathArg();
const THEME_CONFIG_DIR = path.join(THEME_BASE, "theme-config");
const THEME_JSON_PATH = path.join(THEME_BASE, "theme.json");

function requireIfExists(filePath) {
	if (fs.existsSync(filePath)) {
		// Clear require cache to allow reloading
		delete require.cache[require.resolve(filePath)];
		return require(filePath);
	}
	return {};
}

function mergeDeep(target, source) {
	for (const key of Object.keys(source)) {
		if (
			source[key] &&
			typeof source[key] === "object" &&
			!Array.isArray(source[key]) &&
			target[key] &&
			typeof target[key] === "object" &&
			!Array.isArray(target[key])
		) {
			mergeDeep(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
	return target;
}

function compileDirectory(dirPath) {
	if (!fs.existsSync(dirPath)) return {};
	const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".js"));
	let result = {};
	for (const file of files) {
		const data = requireIfExists(path.join(dirPath, file));
		result = mergeDeep(result, data);
	}
	return result;
}

function compileBlocksFromDir(blocksDir) {
	if (!fs.existsSync(blocksDir)) return {};
	const files = fs.readdirSync(blocksDir).filter((f) => f.endsWith(".js"));
	let allBlocks = {};
	for (const file of files) {
		const data = requireIfExists(path.join(blocksDir, file));
		allBlocks = mergeDeep(allBlocks, data);
	}
	return allBlocks;
}

function writeJsModule(filePath, obj, comment = null) {
	let content = "";
	if (comment) {
		content += `/**\n * ${comment}\n */\n`;
	}
	content += "module.exports = " + JSON.stringify(obj, null, 2) + ";\n";
	fs.writeFileSync(filePath, content);
}

function splitThemeJson() {
	if (!fs.existsSync(THEME_JSON_PATH)) {
		console.error("theme.json not found at", THEME_JSON_PATH);
		process.exit(1);
	}
	const themeData = JSON.parse(fs.readFileSync(THEME_JSON_PATH, "utf8"));
	if (!fs.existsSync(THEME_CONFIG_DIR)) {
		fs.mkdirSync(THEME_CONFIG_DIR, { recursive: true });
	}
	// Main sections
	const sections = {
		version: ["version"],
		settings: ["settings"],
		styles: ["styles"],
		customTemplates: ["customTemplates"],
		templateParts: ["templateParts"],
		patterns: ["patterns"],
	};
	for (const [filename, keys] of Object.entries(sections)) {
		const sectionData = {};
		for (const key of keys) {
			if (themeData[key] !== undefined) {
				sectionData[key] = themeData[key];
			}
		}
		if (Object.keys(sectionData).length) {
			writeJsModule(
				path.join(THEME_CONFIG_DIR, filename + ".js"),
				sectionData,
			);
		}
	}
	// Split settings
	if (themeData.settings) {
		const settingsSections = {
			typography: ["typography"],
			colors: ["color"],
			layout: ["layout", "spacing"],
			blocks: ["blocks"],
			custom: ["custom"],
		};
		const settingsDir = path.join(THEME_CONFIG_DIR, "settings");
		if (!fs.existsSync(settingsDir)) {
			fs.mkdirSync(settingsDir, { recursive: true });
		}
		for (const [filename, keys] of Object.entries(settingsSections)) {
			const sectionData = {};
			for (const key of keys) {
				if (themeData.settings[key] !== undefined) {
					sectionData[key] = themeData.settings[key];
				}
			}
			if (Object.keys(sectionData).length) {
				writeJsModule(
					path.join(settingsDir, filename + ".js"),
					sectionData,
				);
			}
		}
	}
	// Split styles
	if (themeData.styles) {
		const stylesDir = path.join(THEME_CONFIG_DIR, "styles");
		if (!fs.existsSync(stylesDir)) {
			fs.mkdirSync(stylesDir, { recursive: true });
		}
		// Global styles
		const globalKeys = ["typography", "color", "spacing", "border"];
		const globalStyles = {};
		for (const key of globalKeys) {
			if (themeData.styles[key] !== undefined) {
				globalStyles[key] = themeData.styles[key];
			}
		}
		if (Object.keys(globalStyles).length) {
			writeJsModule(path.join(stylesDir, "global.js"), globalStyles);
		}
		// Elements
		if (themeData.styles.elements) {
			writeJsModule(path.join(stylesDir, "elements.js"), {
				elements: themeData.styles.elements,
			});
		}
		// Blocks
		const blocksDir = path.join(stylesDir, "blocks");
		if (!fs.existsSync(blocksDir)) {
			fs.mkdirSync(blocksDir, { recursive: true });
		}
		if (themeData.styles.blocks) {
			// Write all blocks to a single file for now
			writeJsModule(
				path.join(blocksDir, "blocks.js"),
				themeData.styles.blocks,
				"Block styles - organize however you want!",
			);
		}
	}
	console.log("Split theme.json into modular .js files at", THEME_CONFIG_DIR);
}

function backupThemeJson(backupName = "theme.backup.json") {
	if (fs.existsSync(THEME_JSON_PATH)) {
		const backupPath = path.join(path.dirname(THEME_JSON_PATH), backupName);
		fs.copyFileSync(THEME_JSON_PATH, backupPath);
		console.log(`Backup created: ${backupPath}`);
	}
}

function compileThemeJson({ skipBackup = false } = {}) {
	if (!skipBackup) backupThemeJson();
	let compiled = {};
	// Main sections
	const mainFiles = [
		"version.js",
		"settings.js",
		"styles.js",
		"customTemplates.js",
		"templateParts.js",
		"patterns.js",
	];
	for (const file of mainFiles) {
		const data = requireIfExists(path.join(THEME_CONFIG_DIR, file));
		compiled = mergeDeep(compiled, data);
	}
	// Merge granular settings
	const settingsData = compileDirectory(
		path.join(THEME_CONFIG_DIR, "settings"),
	);
	if (Object.keys(settingsData).length) {
		compiled.settings = mergeDeep(compiled.settings || {}, settingsData);
	}
	// Merge granular styles
	const stylesData = compileDirectory(path.join(THEME_CONFIG_DIR, "styles"));
	// Merge blocks
	const blocksData = compileBlocksFromDir(
		path.join(THEME_CONFIG_DIR, "styles", "blocks"),
	);
	if (Object.keys(blocksData).length) {
		stylesData.blocks = mergeDeep(stylesData.blocks || {}, blocksData);
	}
	if (Object.keys(stylesData).length) {
		compiled.styles = mergeDeep(compiled.styles || {}, stylesData);
	}
	// Write theme.json
	fs.writeFileSync(THEME_JSON_PATH, JSON.stringify(compiled, null, 2));
	console.log("Compiled theme.json at", THEME_JSON_PATH);
}

function watchThemeConfig() {
	if (!fs.existsSync(THEME_CONFIG_DIR)) {
		console.error("theme-config directory not found at", THEME_CONFIG_DIR);
		process.exit(1);
	}
	console.log("Watching", THEME_CONFIG_DIR, "for changes...");
	let timeout = null;
	let backupMade = false;
	const watcher = chokidar.watch(THEME_CONFIG_DIR, {
		ignoreInitial: true,
		persistent: true,
	});
	function recompile() {
		if (!backupMade) {
			backupThemeJson();
			backupMade = true;
		}
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => {
			console.log("Change detected, recompiling theme.json...");
			compileThemeJson({ skipBackup: true });
		}, 100);
	}
	watcher
		.on("add", recompile)
		.on("change", recompile)
		.on("unlink", recompile)
		.on("addDir", recompile)
		.on("unlinkDir", recompile)
		.on("error", (error) => console.error("Watcher error:", error));
}

const command = process.argv[2];

switch (command) {
	case "split":
		splitThemeJson();
		break;
	case "compile":
		compileThemeJson();
		break;
	case "watch":
		watchThemeConfig();
		break;
	default:
		console.log(
			"Usage: theme-json-compiler <split|compile|watch> [--theme-path <path>]",
		);
		process.exit(1);
}
