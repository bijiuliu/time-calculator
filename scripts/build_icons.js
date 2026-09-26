const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.resolve(__dirname, '..', 'assets', 'icons');
const indexPath = path.resolve(__dirname, '..', 'index.html');
const master = fs.readFileSync(path.join(iconsDir, 'logo-master.svg'), 'utf8');
if (/<image\b|data:image|base64,/i.test(master)) {
  throw new Error('The logo master must contain only vector artwork.');
}

const svgOpen = master.match(/<svg\b[^>]*>/)?.[0];
const defsEnd = master.indexOf('</defs>') + '</defs>'.length;
const svgEnd = master.lastIndexOf('</svg>');
if (!svgOpen || defsEnd < 7 || svgEnd < defsEnd) {
  throw new Error('Invalid logo-master.svg structure.');
}
const defs = master.slice(master.indexOf(svgOpen) + svgOpen.length, defsEnd);
const artwork = master.slice(defsEnd, svgEnd).trim();

function variant({ box, background, scale = 1, outputSize = 1024 }) {
  const [x, y, width, height] = box;
  const center = 627;
  const transform = scale === 1
    ? ''
    : ` transform="translate(${center} ${center}) scale(${scale}) translate(${-center} ${-center})"`;
  const backdrop = background
    ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${background}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputSize}" height="${outputSize}" viewBox="${box.join(' ')}">${defs}${backdrop}<g${transform}>${artwork}</g></svg>`;
}

const regular = { box: [130, 130, 994, 994] };
const install = { ...regular, background: '#F8FAFC' };
const maskable = { box: [0, 0, 1254, 1254], background: '#F8FAFC', scale: 0.89 };

async function png(filename, size, options, opaque = false) {
  const renderSize = Math.max(size * 4, 512);
  const svg = variant({ ...options, outputSize: renderSize });
  let image = sharp(Buffer.from(svg)).resize(size, size, { kernel: 'lanczos3' });
  if (opaque) image = image.removeAlpha();
  await image.png({ compressionLevel: 9 }).toFile(path.join(iconsDir, filename));
}

async function main() {
  const iconSvg = variant({ ...regular, outputSize: 1024 });
  fs.writeFileSync(path.join(iconsDir, 'icon.svg'), iconSvg);
  fs.writeFileSync(path.join(iconsDir, 'icon-maskable.svg'), variant({ ...maskable, outputSize: 512 }));
  await png('favicon-32.png', 32, { box: [165, 165, 924, 924] });
  await png('icon-192.png', 192, install, true);
  await png('icon-512.png', 512, install, true);
  await png('icon-1024.png', 1024, install, true);
  await png('apple-touch-icon.png', 180, install, true);
  await png('icon-maskable-192.png', 192, maskable, true);
  await png('icon-maskable-512.png', 512, maskable, true);
  const inlineBrand = iconSvg
    .replace(/^<svg\b[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" class="brand-logo" viewBox="130 130 994 994" focusable="false" aria-hidden="true">')
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="brand-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#brand-${id})`);
  const start = '<!-- brand-icon:start -->';
  const end = '<!-- brand-icon:end -->';
  const html = fs.readFileSync(indexPath, 'utf8');
  const startAt = html.indexOf(start);
  const endAt = html.indexOf(end, startAt + start.length);
  if (startAt < 0 || endAt < 0) throw new Error('Brand icon markers are missing from index.html');
  const updated = `${html.slice(0, startAt + start.length)}\n          ${inlineBrand}\n          ${html.slice(endAt)}`;
  if (updated !== html) fs.writeFileSync(indexPath, updated);
  console.log('Built all web and PWA icons from logo-master.svg');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
