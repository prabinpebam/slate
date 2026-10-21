import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { CANVAS_BANNER, CANVAS_NOTICES_FILE, collectBundledPackages, renderCanvasNotices } from "./third-party-notices.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(packageRoot, "canvas");
const outputRoot = path.join(packageRoot, "shell", "canvas");

// Shared with the notices test so it bundles exactly what the release build bundles.
// Inline legal comments are dropped because THIRD_PARTY_NOTICES.txt carries the complete
// license text of every bundled package; esbuild's own comment extraction misses packages
// that publish no @license comment.
export function canvasBuildOptions(root = packageRoot) {
  return {
    absWorkingDir: root,
    entryPoints: [path.join(root, "canvas", "src", "main.jsx")],
    bundle: true,
    format: "esm",
    jsx: "automatic",
    outfile: path.join(root, "shell", "canvas", "canvas.js"),
    minify: true,
    sourcemap: false,
    legalComments: "none",
    banner: { js: CANVAS_BANNER },
    metafile: true,
  };
}

export async function buildCanvas() {
  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  const result = await build({ ...canvasBuildOptions(), logLevel: "info" });
  const packages = collectBundledPackages(result.metafile, packageRoot);
  fs.writeFileSync(path.join(outputRoot, CANVAS_NOTICES_FILE), renderCanvasNotices(packages));

  // The shell requests canvas.js and canvas.css with a ?v= cache key. That key was
  // hard-coded in the source index.html, so it never changed on release and browsers kept
  // executing a cached bundle after every Slate upgrade. Stamp the real package version.
  const packageVersion = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")).version;
  const canvasIndex = fs.readFileSync(path.join(sourceRoot, "index.html"), "utf8")
    .replaceAll("__SLATE_VERSION__", packageVersion);
  if (canvasIndex.includes("__SLATE_VERSION__") || !canvasIndex.includes(`?v=${packageVersion}`)) {
    throw new Error("Canvas index.html must request its assets with the current package version");
  }
  fs.writeFileSync(path.join(outputRoot, "index.html"), canvasIndex);
  console.log(`Slate Canvas runtime built at shell/canvas with notices for ${packages.length} packages.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await buildCanvas();
