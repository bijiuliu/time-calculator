import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const icons = resolve(root, "assets/icons");
const mark = readFileSync(resolve(icons, "logo.svg"), "utf8");
const app = mark.replace(/(<svg\b[^>]*>)/, '$1\n  <rect width="1024" height="1024" fill="#fff"/>');

if (app === mark) throw new Error("Could not find the SVG root element");
writeFileSync(resolve(icons, "logo-app.svg"), app);

for (const [name, size] of [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-1024.png", 1024],
]) {
  const result = spawnSync("inkscape", [
    resolve(icons, "logo-app.svg"),
    `--export-filename=${resolve(icons, name)}`,
    `--export-width=${size}`,
  ], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Failed to export ${name}. Install Inkscape and retry.`);
}
