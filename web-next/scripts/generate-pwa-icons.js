const sharp = require("sharp");
const path = require("path");

// نفس علامة "الشغل" البرتقالية المربّعة المستخدمة في LogoMark.tsx وNavbar (والمضمّنة
// كجزء من email-logo.svg) — SVG متجه فبيتحوّل بجودة كاملة لأي مقاس من غير أي تصميم جديد.
const src = path.join(__dirname, "pwa-icon.svg");
const outDir = path.join(__dirname, "..", "public");

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  // مقاس Apple الموصى بيه لـapple-touch-icon — خلفية معتمة بالكامل (بدون شفافية) زي ما iOS محتاج.
  { file: "apple-touch-icon.png", size: 180 },
];

Promise.all(
  targets.map(({ file, size }) =>
    sharp(src, { density: 288 })
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, file))
      .then((info) => console.log("wrote", file, `${info.width}x${info.height}`))
  )
).catch((err) => {
  console.error(err);
  process.exit(1);
});
