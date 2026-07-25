import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(packageRoot, "canvas");
const outputRoot = path.join(packageRoot, "shell", "canvas");

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

await build({
  entryPoints: [path.join(sourceRoot, "src", "main.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: path.join(outputRoot, "canvas.js"),
  minify: true,
  sourcemap: false,
  legalComments: "linked",
  logLevel: "info",
});

fs.copyFileSync(path.join(sourceRoot, "index.html"), path.join(outputRoot, "index.html"));
console.log("Slate Canvas runtime built at shell/canvas.");