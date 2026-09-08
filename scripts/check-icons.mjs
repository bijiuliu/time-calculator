import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const index = read("index.html");
const manifestText = read("manifest.webmanifest");
const manifest = JSON.parse(manifestText);
const serviceWorker = read("sw.js");

for (const [path, content] of [["index.html", index], ["manifest.webmanifest", manifestText], ["sw.js", serviceWorker]]) {
  assert.doesNotMatch(content, /xunjian|巡检|night-inspection/i, `${path} contains a cross-project reference`);
}

for (const match of index.matchAll(/(?:href|src)="([^"]+)"/g)) {
  assert.ok(!match[1].startsWith("/"), `root-relative asset URL is forbidden: ${match[1]}`);
}

const dimensions = (path) => {
  const bytes = readFileSync(resolve(root, path));
  assert.equal(bytes.toString("ascii", 1, 4), "PNG", `${path} is not PNG`);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

const pngContract = new Map([
  ["apple-touch-icon.png", [180, 180]],
  ["assets/icons/time-calculator-favicon-32.png", [32, 32]],
  ["assets/icons/time-calculator-brand.png", [1254, 1254]],
  ["assets/icons/time-calculator-pwa-192.png", [192, 192]],
  ["assets/icons/time-calculator-pwa-512.png", [512, 512]],
  ["assets/icons/time-calculator-pwa-1024.png", [1024, 1024]],
]);

assert.ok(existsSync(resolve(root, "favicon.ico")), "favicon.ico is missing");
for (const [path, expected] of pngContract) assert.deepEqual(dimensions(path), expected, `${path} has wrong dimensions`);

assert.equal(manifest.id, "./");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.deepEqual(manifest.icons.map(({ src, sizes }) => [src.split("?")[0], sizes]), [
  ["./assets/icons/time-calculator-pwa-192.png", "192x192"],
  ["./assets/icons/time-calculator-pwa-512.png", "512x512"],
  ["./assets/icons/time-calculator-pwa-1024.png", "1024x1024"],
]);

for (const path of ["favicon.ico", "apple-touch-icon.png", ...pngContract.keys()]) {
  assert.ok(index.includes(path) || serviceWorker.includes(path) || manifestText.includes(path), `${path} is unreferenced`);
}

console.log("time-calculator icon contract: OK");
