import fs from "node:fs";
import path from "node:path";

export const CANVAS_NOTICES_FILE = "THIRD_PARTY_NOTICES.txt";
export const CANVAS_BANNER = `/*! Slate Canvas. Third-party licenses: ${CANVAS_NOTICES_FILE} */`;

// Every redistributed file in shell/vendor/ must be listed here with its license text in
// shell/vendor/LICENSES/. `marker` is a string that must appear in the shipped file, so a
// silent library upgrade fails the notices test until this record is updated.
export const VENDORED_COMPONENTS = [
  {
    name: "marked",
    version: "14.1.4",
    license: "MIT",
    source: "https://github.com/markedjs/marked",
    files: ["marked.min.js"],
    licenseFile: "LICENSES/marked.LICENSE.md",
    marker: "marked v14.1.4",
  },
  {
    name: "highlight.js",
    version: "11.9.0",
    license: "BSD-3-Clause",
    source: "https://github.com/highlightjs/highlight.js",
    files: ["highlight.min.js"],
    licenseFile: "LICENSES/highlight.js.LICENSE.txt",
    marker: "Highlight.js v11.9.0",
  },
  {
    name: "highlight.js GitHub themes",
    version: "11.9.0",
    license: "BSD-3-Clause",
    source: "https://github.com/highlightjs/highlight.js/tree/11.9.0/src/styles",
    files: ["github.min.css", "github-dark.min.css"],
    licenseFile: "LICENSES/highlight.js.LICENSE.txt",
    marker: "Theme: GitHub",
  },
  {
    name: "DOMPurify",
    version: "3.4.11",
    license: "Apache-2.0 (elected from Apache-2.0 OR MPL-2.0)",
    source: "https://github.com/cure53/DOMPurify",
    files: ["purify.min.js"],
    licenseFile: "LICENSES/DOMPurify.LICENSE.txt",
    marker: "DOMPurify 3.4.11",
  },
  {
    name: "Material Symbols Outlined",
    version: "2.958",
    license: "Apache-2.0",
    source: "https://github.com/google/material-design-icons",
    files: ["material-symbols-outlined.ttf"],
    licenseFile: "LICENSES/material-symbols.LICENSE.txt",
    // The font's name table stores its version as UTF-16BE.
    marker: Buffer.from("Version 2.958", "utf16le").swap16(),
  },
];

const LICENSE_FILE_PATTERN = /^(?:licen[cs]e|copying)(?:[.-][a-z0-9]+)?(?:\.(?:md|txt))?$/i;

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function packageForInput(inputPath) {
  const normalized = toPosix(inputPath);
  const marker = "node_modules/";
  const index = normalized.lastIndexOf(marker);
  if (index === -1) return null;
  const rest = normalized.slice(index + marker.length).split("/");
  const name = rest[0].startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0];
  return { name, directory: normalized.slice(0, index + marker.length) + name };
}

// Resolves every npm package that contributes bytes to an esbuild output, with the full text
// of its license file. Throws when a bundled package ships no license file, because the
// resulting bundle could not be redistributed with a complete notice.
export function collectBundledPackages(metafile, workingDirectory) {
  const packages = new Map();
  for (const output of Object.values(metafile.outputs)) {
    for (const [inputPath, input] of Object.entries(output.inputs)) {
      if (!input.bytesInOutput) continue;
      const located = packageForInput(inputPath);
      if (!located || packages.has(located.directory)) continue;
      const directory = path.resolve(workingDirectory, located.directory);
      const manifest = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
      const licenseName = fs.readdirSync(directory)
        .filter((entry) => LICENSE_FILE_PATTERN.test(entry))
        .sort()[0];
      if (!licenseName) throw new Error(`Bundled package ${manifest.name} has no license file in ${directory}`);
      packages.set(located.directory, {
        name: manifest.name,
        version: manifest.version,
        license: typeof manifest.license === "string" ? manifest.license : "SEE LICENSE TEXT",
        homepage: manifest.homepage ?? null,
        licenseText: fs.readFileSync(path.join(directory, licenseName), "utf8").replace(/\r\n/g, "\n").trim(),
      });
    }
  }
  return [...packages.values()].sort((left, right) => left.name.localeCompare(right.name)
    || left.version.localeCompare(right.version));
}

export function renderCanvasNotices(packages) {
  const rule = "=".repeat(78);
  const lines = [
    "Slate Canvas third-party notices",
    "",
    "canvas.js in this directory bundles the following third-party packages. Each package is",
    "redistributed under its own license, reproduced in full below. Keep this file with",
    "canvas.js whenever the Canvas runtime is copied or published.",
    "",
    "Package summary:",
    ...packages.map((entry) => `  ${entry.name} ${entry.version} (${entry.license})`),
  ];
  for (const entry of packages) {
    lines.push("", rule, `${entry.name} ${entry.version}`, `License: ${entry.license}`);
    if (entry.homepage) lines.push(`Homepage: ${entry.homepage}`);
    lines.push(rule, "", entry.licenseText);
  }
  return `${lines.join("\n")}\n`;
}

// Static checks for shell/vendor/: every shipped file is recorded, matches its recorded
// version, and has its license text beside it.
export function checkVendoredNotices(packageRoot) {
  const errors = [];
  const vendorRoot = path.join(packageRoot, "shell", "vendor");
  const recorded = new Map();
  for (const component of VENDORED_COMPONENTS) {
    if (!fs.existsSync(path.join(vendorRoot, component.licenseFile))) {
      errors.push(`${component.name}: missing license text ${component.licenseFile}`);
    }
    for (const file of component.files) {
      recorded.set(file, component);
      const filePath = path.join(vendorRoot, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`${component.name}: recorded file is missing: shell/vendor/${file}`);
        continue;
      }
      if (!fs.readFileSync(filePath).includes(component.marker)) {
        errors.push(`${component.name}: shell/vendor/${file} does not match recorded version ${component.version}`);
      }
    }
  }

  for (const entry of fs.readdirSync(vendorRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === "LICENSES") continue;
    if (entry.name === "README.md") continue;
    if (!recorded.has(entry.name)) errors.push(`shell/vendor/${entry.name} has no recorded license`);
  }

  const referenced = new Set(VENDORED_COMPONENTS.map((component) => component.licenseFile));
  for (const name of fs.readdirSync(path.join(vendorRoot, "LICENSES"))) {
    if (!referenced.has(`LICENSES/${name}`)) errors.push(`shell/vendor/LICENSES/${name} is not referenced`);
  }

  const readme = fs.readFileSync(path.join(vendorRoot, "README.md"), "utf8");
  for (const component of VENDORED_COMPONENTS) {
    for (const file of component.files) {
      const row = readme.split("\n").find((line) => line.includes(`\`${file}\``));
      if (!row || !row.includes(component.version) || !row.includes(component.licenseFile)) {
        errors.push(`shell/vendor/README.md must list ${file} with version ${component.version} and ${component.licenseFile}`);
      }
    }
  }
  return errors;
}
