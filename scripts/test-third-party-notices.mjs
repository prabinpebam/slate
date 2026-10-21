import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { canvasBuildOptions } from "./build-canvas.mjs";
import {
  CANVAS_BANNER,
  CANVAS_NOTICES_FILE,
  VENDORED_COMPONENTS,
  checkVendoredNotices,
  collectBundledPackages,
  renderCanvasNotices,
} from "./third-party-notices.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canvasRoot = path.join(packageRoot, "shell", "canvas");
let passed = 0;

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function withTempDir(fn) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slate-notices-"));
  try {
    return fn(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const result = await build({ ...canvasBuildOptions(packageRoot), write: false, logLevel: "silent" });
const bundled = collectBundledPackages(result.metafile, packageRoot);

await check("Canvas notices cover every bundled package and match the release build", () => {
  for (const name of ["react", "react-dom", "@xyflow/react", "@xyflow/system", "zustand", "classcat", "lucide-react", "d3-zoom", "d3-ease"]) {
    assert.ok(bundled.some((entry) => entry.name === name), `${name} should be detected in the Canvas bundle`);
  }
  const committed = fs.readFileSync(path.join(canvasRoot, CANVAS_NOTICES_FILE), "utf8").replace(/\r\n/g, "\n");
  assert.equal(committed, renderCanvasNotices(bundled), "shell/canvas notices are stale; run npm run build:canvas");
});

await check("Canvas bundle points to its notices and ships no partial legal file", () => {
  const bundle = fs.readFileSync(path.join(canvasRoot, "canvas.js"), "utf8");
  assert.ok(bundle.startsWith(CANVAS_BANNER), "canvas.js must start with the notices banner");
  assert.equal(fs.existsSync(path.join(canvasRoot, "canvas.js.LEGAL.txt")), false, "obsolete canvas.js.LEGAL.txt must not ship");
});

await check("every vendored runtime file is recorded with a matching version and license text", () => {
  assert.deepEqual(checkVendoredNotices(packageRoot), []);
});

await check("the published notices guide lists every redistributed component and version", () => {
  const guide = fs.readFileSync(path.join(packageRoot, "docs", "third-party-notices.md"), "utf8").split("\n");
  const components = [
    ...bundled.map(({ name, version }) => ({ name, version })),
    ...VENDORED_COMPONENTS.map(({ name, version }) => ({ name, version })),
  ];
  for (const { name, version } of components) {
    assert.ok(
      guide.some((line) => line.includes(name) && line.includes(version)),
      `docs/third-party-notices.md must list ${name} ${version}`,
    );
  }
});

await check("a bundled package without a license file fails the build", () => withTempDir((directory) => {
  const pkg = path.join(directory, "node_modules", "@scope", "unlicensed");
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "@scope/unlicensed", version: "1.0.0", license: "MIT" }));
  fs.writeFileSync(path.join(pkg, "index.js"), "export default 1;\n");
  const metafile = { outputs: { "out.js": { inputs: { "node_modules/@scope/unlicensed/index.js": { bytesInOutput: 10 } } } } };
  assert.throws(() => collectBundledPackages(metafile, directory), /has no license file/);
  fs.writeFileSync(path.join(pkg, "LICENSE"), "MIT License\r\n\r\nCopyright (c) Example\r\n");
  const [entry] = collectBundledPackages(metafile, directory);
  assert.deepEqual([entry.name, entry.version, entry.licenseText], ["@scope/unlicensed", "1.0.0", "MIT License\n\nCopyright (c) Example"]);
}));

await check("an unrecorded or upgraded vendored file is rejected", () => withTempDir((directory) => {
  fs.cpSync(path.join(packageRoot, "shell", "vendor"), path.join(directory, "shell", "vendor"), { recursive: true });
  const vendorRoot = path.join(directory, "shell", "vendor");
  fs.writeFileSync(path.join(vendorRoot, "extra.min.js"), "/* unknown */\n");
  fs.writeFileSync(path.join(vendorRoot, "marked.min.js"), "/** marked v99.0.0 */\n");
  fs.rmSync(path.join(vendorRoot, "LICENSES", "DOMPurify.LICENSE.txt"));
  const errors = checkVendoredNotices(directory).join("\n");
  assert.match(errors, /extra\.min\.js has no recorded license/);
  assert.match(errors, /marked\.min\.js does not match recorded version 14\.1\.4/);
  assert.match(errors, /DOMPurify: missing license text/);
}));

console.log(`\n${passed} third-party notice checks passed.`);
