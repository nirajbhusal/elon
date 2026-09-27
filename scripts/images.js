const fs = require("fs");
const path = require("path");
const opentype = require("opentype.js");
const PImage = require("pureimage");
const { longDate } = require("../lib/dates");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "generated");
const digestDir = path.join(root, "digests");

const WIDTH = 1200;
const HEIGHT = 630;

const FONT_PAIRS = [
  [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ],
  [
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
  ],
  [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  ],
];

function loadFonts() {
  const pair = FONT_PAIRS.find((fonts) => fonts.every((file) => fs.existsSync(file)));
  if (!pair) {
    throw new Error(
      "No sans font found for social images. Install fonts-liberation (Liberation Sans) or DejaVu Sans."
    );
  }
  return {
    regular: opentype.loadSync(pair[0]),
    bold: opentype.loadSync(pair[1]),
  };
}

function textWidth(font, text, size) {
  const scale = size / font.unitsPerEm;
  let width = 0;
  for (const glyph of font.stringToGlyphs(text)) width += (glyph.advanceWidth || 0) * scale;
  return width;
}

function fillText(ctx, font, text, x, y, size) {
  const outline = font.getPath(text, x, y, size, { kerning: false });
  ctx.beginPath();
  for (const cmd of outline.commands) {
    if (cmd.type === "M") ctx.moveTo(cmd.x, cmd.y);
    else if (cmd.type === "L") ctx.lineTo(cmd.x, cmd.y);
    else if (cmd.type === "C") ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
    else if (cmd.type === "Q") ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
    else if (cmd.type === "Z") ctx.closePath();
  }
  ctx.fill();
}

function field(block, key) {
  const match = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(block);
  if (!match) return "";
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value.replace(/\\"/g, '"');
}

function digests() {
  if (!fs.existsSync(digestDir)) return [];
  return fs
    .readdirSync(digestDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .map((name) => {
      const raw = fs.readFileSync(path.join(digestDir, name), "utf8").replace(/^\uFEFF/, "");
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
      const date = name.slice(0, 10);
      return {
        date,
        title: fm ? field(fm[1], "title") : date,
        label: longDate(date),
      };
    });
}

function wrap(font, text, size, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(font, next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function draw(fonts, kicker, title) {
  const image = PImage.make(WIDTH, HEIGHT);
  const ctx = image.getContext("2d");
  ctx.fillStyle = "#070708";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#E31937";
  ctx.fillRect(0, 0, WIDTH, 10);
  ctx.fillRect(88, 78, 56, 8);

  ctx.fillStyle = "#a1a1aa";
  fillText(ctx, fonts.regular, kicker, 88, 150, 28);

  ctx.fillStyle = "#f4f4f5";
  const lines = wrap(fonts.bold, title, 64, 1000).slice(0, 4);
  lines.forEach((line, index) => {
    fillText(ctx, fonts.bold, line, 88, 250 + index * 78, 64);
  });

  ctx.fillStyle = "#a1a1aa";
  fillText(ctx, fonts.regular, "Unofficial  ·  Nepal Time", 88, 572, 26);
  return image;
}

function writePng(image, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return PImage.encodePNGToStream(image, fs.createWriteStream(file));
}

function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

async function favicon() {
  const image = PImage.make(32, 32);
  const ctx = image.getContext("2d");
  ctx.fillStyle = "#070708";
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = "#E31937";
  ctx.fillRect(5, 5, 4, 22);
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(13, 8, 14, 3);
  ctx.fillRect(13, 15, 14, 3);
  ctx.fillRect(13, 22, 9, 3);
  const pngFile = path.join(outDir, "favicon.png");
  await writePng(image, pngFile);
  const png = fs.readFileSync(pngFile);
  fs.writeFileSync(path.join(outDir, "favicon.ico"), pngToIco(png));
  fs.rmSync(pngFile);
}

async function main() {
  const fonts = loadFonts();
  fs.mkdirSync(outDir, { recursive: true });
  await writePng(draw(fonts, "ELON", "A daily digest of Elon Musk"), path.join(outDir, "og.png"));
  for (const digest of digests()) {
    const title = digest.title || digest.date;
    await writePng(draw(fonts, digest.label.toUpperCase(), title), path.join(outDir, "og", `${digest.date}.png`));
  }
  await favicon();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
