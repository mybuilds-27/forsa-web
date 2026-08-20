import { ImageResponse } from "next/og";

export const alt = "الشغل - موقع توظيف مصري مجاني بالكامل";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_NAME = "الشغل";
const SLOGAN = "موقع توظيف مصري مجاني بالكامل";
const DOMAIN = "elshoghl.com";

// UA بتاع Safari قديم — بيخلي جوجل فونتس يرجع صيغة خط satori (اللي بيستخدمها ImageResponse)
// قادرة تقرأها (woff/truetype/opentype) بدل الـwoff2 الحديثة اللي بترجع للمتصفحات العادية.
const LEGACY_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.57.2 (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2";

async function loadCairoFont(text: string, weight: 500 | 800) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Cairo:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(cssUrl, { headers: { "User-Agent": LEGACY_SAFARI_UA } })).text();
  const match = css.match(/src: url\(([^)]+)\) format\('(woff|truetype|opentype)'\)/);
  if (!match) throw new Error("Cairo font source not found in Google Fonts CSS response");
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

// صورة المشاركة الافتراضية (لينك الموقع نفسه، أو أي صفحة معندهاش صورة مخصصة زي تفاصيل
// الوظيفة) — اللوجو لوحده كان مش كافي لأن بعض المنصات بتعرض الصورة من غير العنوان النصي
// جنبها، فبقى اسم الموقع والسلوجن والدومين كلهم مطبوعين جوه الصورة نفسها.
export default async function OpengraphImage() {
  // نفس خط Cairo بوزنين بس — الاسم والدومين بالبولد (800)، السلوجن أخف (500). بنحمّل كل
  // وزن مرة واحدة بس بالحروف اللي محتاجينها فعليًا (subsetting)، عشان الصورة تتولّد أسرع.
  const [cairoBold, cairoMedium] = await Promise.all([
    loadCairoFont(SITE_NAME + DOMAIN, 800),
    loadCairoFont(SLOGAN, 500),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAF6EC",
        }}
      >
        <svg width="168" height="168" viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="480" height="480" rx="60" fill="#C97F1F" />
          <g transform="translate(95,95)" fill="none" stroke="#FAF6EC" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
            <rect x="16" y="12" width="88" height="60" rx="6" />
            <path d="M4 88 L116 88 L100 108 L20 108 Z" />
          </g>
          <g transform="translate(265,95)">
            <polygon points="20,110 88.4,23.8 101.6,36.2 38.9,103.1" fill="#FAF6EC" />
            <line x1="79" y1="33.8" x2="92.2" y2="46.2" stroke="#C97F1F" strokeWidth="6" strokeLinecap="round" />
          </g>
          <g transform="translate(95,265)" fill="none" stroke="#FAF6EC" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 84 A44 44 0 0 1 104 84" />
            <ellipse cx="60" cy="84" rx="54" ry="12" />
          </g>
          <g transform="translate(265,265)" fill="#FAF6EC">
            <polygon points="114.8,49.7 95.4,75.3 41.2,34.3 60.6,8.7" />
            <polygon points="33.6,112.2 83.6,46.2 72.4,37.8 22.4,103.8" />
          </g>
        </svg>

        <div
          style={{
            marginTop: 22,
            fontSize: 96,
            fontWeight: 800,
            color: "#14213D",
            fontFamily: "Cairo",
            direction: "rtl",
          }}
        >
          {SITE_NAME}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 30,
            fontWeight: 500,
            color: "#4A5568",
            fontFamily: "Cairo",
            direction: "rtl",
          }}
        >
          {SLOGAN}
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 36,
            fontWeight: 800,
            color: "#B03A14",
            fontFamily: "Cairo",
            direction: "ltr",
          }}
        >
          {DOMAIN}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cairo", data: cairoBold, weight: 800, style: "normal" },
        { name: "Cairo", data: cairoMedium, weight: 500, style: "normal" },
      ],
    }
  );
}
