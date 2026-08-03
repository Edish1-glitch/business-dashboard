import sharp from "sharp";

const svg = (size, { rounded }) => {
  const s = size;
  const r = rounded ? Math.round(s * 0.22) : 0;
  const u = s / 512;
  const bars = [
    { x: 128, y: 240, h: 140 },
    { x: 224, y: 170, h: 210 },
    { x: 320, y: 100, h: 280 },
  ];
  const barW = 64;
  const barsSvg = bars
    .map((b, i) => `<rect x="${b.x * u}" y="${b.y * u}" width="${barW * u}" height="${b.h * u}" rx="${16 * u}" fill="white" fill-opacity="${0.75 + i * 0.12}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f46e5"/><stop offset="0.55" stop-color="#7c3aed"/><stop offset="1" stop-color="#6d28d9"/>
    </linearGradient></defs>
    <rect width="${s}" height="${s}" rx="${r}" fill="url(#g)"/>
    ${barsSvg}
  </svg>`;
};

async function png(size, opts, out) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(out);
  console.log("wrote", out);
}

await png(192, { rounded: true }, "public/icons/icon-192.png");
await png(512, { rounded: true }, "public/icons/icon-512.png");
await png(512, { rounded: false }, "public/icons/icon-maskable-512.png");
await png(180, { rounded: false }, "public/icons/apple-touch-icon-180.png");
await png(32, { rounded: true }, "public/icons/favicon-32.png");
