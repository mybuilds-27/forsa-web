const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "favicon-source.svg");
const dest = path.join(__dirname, "..", "src", "app", "favicon.ico");
const SIZES = [16, 32, 48];

// .ico هو غلاف بسيط (ICONDIR header + entry لكل مقاس) حوالين صور PNG خام — مفيش أي مكتبة
// جاهزة لتوليد ico متثبتة في المشروع، فبنبنيه يدويًا بدل ما نضيف dependency جديدة لسكريبت
// هيتشغل مرة واحدة بس.
async function buildIco() {
  const pngBuffers = await Promise.all(
    SIZES.map((size) => sharp(src, { density: 384 }).resize(size, size).png().toBuffer())
  );

  const headerSize = 6 + 16 * SIZES.length;
  let offset = headerSize;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(SIZES.length, 4); // عدد الصور

  const entries = [];
  SIZES.forEach((size, i) => {
    const png = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width (0 يعني 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // حجم بيانات الصورة
    entry.writeUInt32LE(offset, 12); // offset من بداية الملف
    offset += png.length;
    entries.push(entry);
  });

  const ico = Buffer.concat([header, ...entries, ...pngBuffers]);
  fs.writeFileSync(dest, ico);
  console.log("wrote", dest, `(${SIZES.join("x, ")}x px, ${ico.length} bytes)`);
}

buildIco().catch((err) => {
  console.error(err);
  process.exit(1);
});
