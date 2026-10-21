import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHostIndex } from "./init-project.mjs";
import { checkRuntimeHost, syncRuntimeHost } from "./runtime-host.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function assertContentPath(relativePath) {
  if (typeof relativePath !== "string"
      || !/^[^\\?#]+\.(?:md|html)$/.test(relativePath)
      || path.posix.isAbsolute(relativePath)
      || relativePath.includes(":")
      || relativePath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Invalid site content path: ${relativePath}`);
  }
}

function copyFile(sourceRoot, outputRoot, relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const destination = path.join(outputRoot, relativePath);
  if (!fs.statSync(source).isFile()) throw new Error(`Not a content file: ${relativePath}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function buildSite({ repoRoot = packageRoot, sourceRoot = packageRoot } = {}) {
  const outputRoot = path.resolve(repoRoot, "_site");
  if (fs.existsSync(outputRoot) && fs.lstatSync(outputRoot).isSymbolicLink()) {
    throw new Error(`Site output cannot be a symbolic link or junction: ${outputRoot}`);
  }

  const manifest = readJson(sourceRoot, path.join("site", "docs-manifest.json"));
  const config = readJson(sourceRoot, path.join("site", "slate.config.json"));
  const demoManifest = readJson(sourceRoot, path.join("demo", "docs-manifest.json"));
  const demoConfig = readJson(sourceRoot, path.join("demo", "slate.config.json"));
  const routes = new Set();
  for (const entry of manifest.entries) {
    assertContentPath(entry.path);
    if (!entry.path.startsWith("docs/")) throw new Error(`Site guides must live under docs/: ${entry.path}`);
    if (!entry.title || !entry.icon) throw new Error(`Site entry needs a title and icon: ${entry.path}`);
    if (routes.has(entry.path)) throw new Error(`Duplicate site route: ${entry.path}`);
    routes.add(entry.path);
  }
  if (!routes.has(config.landing)) throw new Error(`Site landing is not registered: ${config.landing}`);

  // Canvas stays in its own host so source links keep their original host-relative meaning.
  const demoEntries = demoManifest.entries
    .filter((entry) => entry.type !== "canvas")
    .map((entry) => {
      assertContentPath(entry.path);
      return {
        ...entry,
        path: `demo/${entry.path}`,
        group: entry.group ? `Demos/${entry.group}` : "Demos",
        order: 10 + (entry.order ?? 0),
      };
    });

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const entry of manifest.entries) copyFile(sourceRoot, outputRoot, entry.path);
  fs.cpSync(path.join(sourceRoot, "demo"), path.join(outputRoot, "demo"), {
    recursive: true,
    filter(source) {
      if (fs.lstatSync(source).isSymbolicLink()) throw new Error(`Demo cannot contain a symbolic link or junction: ${source}`);
      return true;
    },
  });

  fs.writeFileSync(path.join(outputRoot, "index.html"), createHostIndex(sourceRoot, config.projectName));
  writeJson(path.join(outputRoot, "docs-manifest.json"), { ...manifest, entries: [...manifest.entries, ...demoEntries] });
  writeJson(path.join(outputRoot, "slate.config.json"), config);
  fs.copyFileSync(path.join(sourceRoot, "site", "project.theme.css"), path.join(outputRoot, "project.theme.css"));
  fs.writeFileSync(path.join(outputRoot, ".nojekyll"), "");

  const demoRoot = path.join(outputRoot, "demo");
  fs.writeFileSync(path.join(demoRoot, "index.html"), createHostIndex(sourceRoot, demoConfig.projectName));
  fs.writeFileSync(path.join(demoRoot, "project.theme.css"), "/* The demo uses Slate's default theme. */\n");
  for (const hostRoot of [outputRoot, demoRoot]) {
    syncRuntimeHost(hostRoot, sourceRoot, repoRoot);
    const errors = checkRuntimeHost(hostRoot, sourceRoot, repoRoot);
    if (errors.length) throw new Error(`Site runtime check failed:\n${errors.join("\n")}`);
  }
  return outputRoot;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const outputRoot = buildSite();
  console.log(`Slate documentation and demos built at ${outputRoot}.`);
}
