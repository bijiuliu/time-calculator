import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const icons = resolve(root, "assets/icons");
const mark = readFileSync(resolve(icons, "logo.svg"), "utf8");
const app = mark
  .replace('viewBox="0 0 1254 1254"', 'viewBox="0 0 1024 1024"')
  .replace(/(<svg\b[^>]*>)/, '$1\n  <rect width="1024" height="1024" fill="#fff"/>\n  <g transform="translate(38 7) scale(.745)">')
  .replace(/<\/svg>\s*$/, '  </g>\n</svg>\n');
const pagePath = resolve(root, "index.html");
const page = readFileSync(pagePath, "utf8");
const start = "<!-- logo:inline:start -->";
const end = "<!-- logo:inline:end -->";
const block = new RegExp(`(${start})[\\s\\S]*?(${end})`);

if (!mark.includes('viewBox="0 0 1254 1254"') || !app.includes('scale(.745)')) {
  throw new Error("Could not transform the SVG master for the app icon");
}
if (!block.test(page)) throw new Error("Could not find the inline logo markers in index.html");
const inline = mark.trim().split("\n").map(line => `          ${line}`).join("\n");
writeFileSync(pagePath, page.replace(block, (_, open, close) => `${open}\n${inline}\n          ${close}`));
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
