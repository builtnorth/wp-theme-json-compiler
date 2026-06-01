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

    if (!themePath) {
        return process.cwd();
    }

    const resolved = path.resolve(process.cwd(), themePath);
    const cwd = process.cwd();

    // Prevent path traversal: --theme-path must resolve to a path within the
    // current working directory so CI pipelines cannot accidentally point this
    // tool at a directory outside the project tree.
    if (resolved !== cwd && !resolved.startsWith(cwd + path.sep)) {
        throw new Error(
            `[wp-theme-json-compiler] --theme-path must be within the current working directory.\n` +
            `  Resolved: ${resolved}\n  CWD:      ${cwd}`,
        );
    }

    return resolved;
}

const THEME_BASE = getThemePathArg();
const THEME_CONFIG_DIR = path.join(THEME_BASE, "theme-config");
const THEME_JSON_PATH = path.join(THEME_BASE, "theme.json");

// Theme config files are intentionally executed as JavaScript (not parsed as JSON)
// to allow dynamic configuration — functions, conditionals, computed values —
// the same pattern as webpack.config.js or vite.config.js. Only files inside
// THEME_CONFIG_DIR are ever passed here; the bounds check in getThemePathArg()
// ensures THEME_CONFIG_DIR itself cannot point outside the project tree.
function requireIfExists(filePath) {
    if (fs.existsSync(filePath)) {
        // Clear require cache to allow reloading on watch re-runs.
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

function expandWildcardBlocks(blocksConfig) {
    if (!blocksConfig || typeof blocksConfig !== "object") {
        return blocksConfig;
    }

    const expanded = {};
    const wildcardConfig = blocksConfig["*"];

    // Common block patterns that should receive wildcard settings
    const commonBlocks = [
        // Core blocks
        "core/paragraph",
        "core/heading",
        "core/list",
        "core/list-item",
        "core/quote",
        "core/audio",
        "core/button",
        "core/buttons",
        "core/columns",
        "core/column",
        "core/cover",
        "core/file",
        "core/gallery",
        "core/group",
        "core/image",
        "core/media-text",
        "core/more",
        "core/nextpage",
        "core/preformatted",
        "core/pullquote",
        "core/separator",
        "core/shortcode",
        "core/spacer",
        "core/table",
        "core/verse",
        "core/video",
        "core/code",
        "core/details",
        "core/freeform",
        "core/html",
        "core/search",
        "core/social-links",
        "core/site-logo",
        "core/navigation",
        "core/post-template",
        "core/post-title",
        "core/post-excerpt",
        "core/post-content",
        "core/post-featured-image",
        "core/post-comments",
        "core/post-comments-form",
        "core/post-comments-count",
        "core/post-comments-link",
        "core/post-date",
        "core/post-author",
        "core/post-terms",
        "core/post-navigation-link",
        "core/query",
        "core/query-title",
        "core/query-pagination",
        "core/query-pagination-next",
        "core/query-pagination-previous",
        "core/query-pagination-numbers",
        "core/query-no-results",
        "core/read-more",
        "core/site-tagline",
        "core/site-title",
        "core/archives",
        "core/calendar",
        "core/categories",
        "core/latest-comments",
        "core/latest-posts",
        "core/page-list",
        "core/rss",
        "core/social-link",
        "core/tag-cloud",
        "core/home-link",
        "core/loginout",
        "core/term-description",
        "core/query-loop",
        "core/template-part",
        "core/avatar",
        "core/post-author-biography",
        "core/comment-author-avatar",
        "core/comment-author-name",
        "core/comment-content",
        "core/comment-date",
        "core/comment-edit-link",
        "core/comment-reply-link",
        "core/comment-template",
        "core/comments",
        "core/comments-pagination",
        "core/comments-pagination-next",
        "core/comments-pagination-numbers",
        "core/comments-pagination-previous",
        "core/comments-title",
        "core/embed",
        "core/block",
        "core/text",
        "core/row",
        "core/grid",
        // Polaris blocks
        "polaris/accordion",
        "polaris/business-card",
        "polaris/section",
        "polaris/container",
        // Compass blocks
        "compass/single-details",
        "compass/single-features",
        "compass/single-pricing",
    ];

    // Apply wildcard config to common blocks if it exists
    if (wildcardConfig) {
        for (const blockName of commonBlocks) {
            if (!blocksConfig[blockName]) {
                expanded[blockName] = wildcardConfig;
            }
        }
    }

    // Add all explicit block configurations (these override wildcard settings)
    for (const [blockName, config] of Object.entries(blocksConfig)) {
        if (blockName !== "*") {
            expanded[blockName] = config;
        }
    }

    return expanded;
}

function compileDirectory(dirPath, excludeDirs = []) {
    if (!fs.existsSync(dirPath)) return {};
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".js"));
    let result = {};
    for (const file of files) {
        const data = requireIfExists(path.join(dirPath, file));
        result = mergeDeep(result, data);
    }

    // Also scan subdirectories for nested files (like styles/blocks/)
    const subdirs = fs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

    for (const subdir of subdirs) {
        if (!excludeDirs.includes(subdir)) {
            const subdirPath = path.join(dirPath, subdir);
            const subdirData = compileDirectory(subdirPath, excludeDirs);
            result = mergeDeep(result, subdirData);
        }
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

    // Main sections (excluding settings and styles which will be split granularly)
    const sections = {
        version: ["version"],
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

    // Split settings granularly (don't create main settings.js)
    if (themeData.settings) {
        const settingsDir = path.join(THEME_CONFIG_DIR, "settings");
        if (!fs.existsSync(settingsDir)) {
            fs.mkdirSync(settingsDir, { recursive: true });
        }

        // Handle non-block settings (granular splitting)
        const settingsSections = {
            typography: ["typography"],
            colors: ["color"],
            layout: ["layout"],
            spacing: ["spacing"],
            custom: ["custom"],
            background: ["background"],
            border: ["border"],
            dimensions: ["dimensions"],
            position: ["position"],
            shadow: ["shadow"],
        };

        // Handle top-level boolean settings
        const topLevelSettings = [
            "appearanceTools",
            "useRootPaddingAwareAlignments",
        ];
        const topLevelData = {};
        for (const key of topLevelSettings) {
            if (themeData.settings[key] !== undefined) {
                topLevelData[key] = themeData.settings[key];
            }
        }
        if (Object.keys(topLevelData).length) {
            writeJsModule(path.join(settingsDir, "general.js"), topLevelData);
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

        // Handle block settings by prefix
        if (themeData.settings.blocks) {
            const blockSettings = themeData.settings.blocks;
            const blockPrefixes = new Set();

            // Collect all block prefixes
            for (const blockName of Object.keys(blockSettings)) {
                const prefix = blockName.split("/")[0];
                blockPrefixes.add(prefix);
            }

            // Split block settings by prefix
            for (const prefix of blockPrefixes) {
                const prefixData = {};
                for (const [blockName, blockData] of Object.entries(
                    blockSettings,
                )) {
                    if (
                        blockName.startsWith(prefix + "/") ||
                        blockName === prefix
                    ) {
                        prefixData[blockName] = blockData;
                    }
                }
                if (Object.keys(prefixData).length) {
                    writeJsModule(path.join(settingsDir, prefix + ".js"), {
                        blocks: prefixData,
                    });
                }
            }
        }
    }

    // Split styles granularly (don't create main styles.js)
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

        // Handle block styles by prefix
        if (themeData.styles.blocks) {
            const blockStyles = themeData.styles.blocks;
            const blockPrefixes = new Set();

            // Collect all block prefixes
            for (const blockName of Object.keys(blockStyles)) {
                const prefix = blockName.split("/")[0];
                blockPrefixes.add(prefix);
            }

            // Create blocks directory
            const blocksDir = path.join(stylesDir, "blocks");
            if (!fs.existsSync(blocksDir)) {
                fs.mkdirSync(blocksDir, { recursive: true });
            }

            // Split block styles by prefix
            for (const prefix of blockPrefixes) {
                const prefixData = {};
                for (const [blockName, blockData] of Object.entries(
                    blockStyles,
                )) {
                    if (
                        blockName.startsWith(prefix + "/") ||
                        blockName === prefix
                    ) {
                        prefixData[blockName] = blockData;
                    }
                }
                if (Object.keys(prefixData).length) {
                    writeJsModule(
                        path.join(blocksDir, prefix + ".js"),
                        prefixData,
                    );
                }
            }
        }
    }
    console.log("Split theme.json into modular .js files at", THEME_CONFIG_DIR);
}

function backupThemeJson(backupName = "theme.backup.json") {
    if (fs.existsSync(THEME_JSON_PATH)) {
        const backupPath = path.join(path.dirname(THEME_JSON_PATH), backupName);
        fs.copyFileSync(THEME_JSON_PATH, backupPath);
        console.log("Backup created:", backupPath);
    }
}

function compileThemeJson({ skipBackup = false } = {}) {
    if (!skipBackup) backupThemeJson();
    let compiled = {};

    // Main sections (excluding settings and styles which are handled granularly)
    const mainFiles = [
        "version.js",
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
        // Expand wildcard blocks if they exist
        if (settingsData.blocks) {
            settingsData.blocks = expandWildcardBlocks(settingsData.blocks);
        }
        compiled.settings = settingsData;
    }

    // Merge granular styles (excluding blocks directory)
    const stylesData = compileDirectory(path.join(THEME_CONFIG_DIR, "styles"), [
        "blocks",
    ]);

    // Handle blocks separately - they should be under styles.blocks
    const blocksData = compileDirectory(
        path.join(THEME_CONFIG_DIR, "styles", "blocks"),
    );
    if (Object.keys(blocksData).length) {
        stylesData.blocks = blocksData;
    }

    if (Object.keys(stylesData).length) {
        compiled.styles = stylesData;
    }

    // Write theme.json
    fs.writeFileSync(THEME_JSON_PATH, JSON.stringify(compiled, null, 2));
    console.log("Compiled theme.json at:", THEME_JSON_PATH);
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
