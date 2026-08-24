import { ImageResponse } from "next/og";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { EXPERIENCE_LEVELS } from "@/lib/constants";
import { JOB_TYPE_LABELS, sanitizeJobDescription } from "@/lib/jobCardStyles";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_NAME = "الشغل";
const DOMAIN = "elshoghl.com";
const NOT_AVAILABLE_MESSAGE = "الوظيفة دي مش متاحة";

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

// نفس منطق getJob في web-next/src/app/jobs/[id]/page.tsx بالظبط (مش قابلة للاستيراد
// مباشرة لأنها دالة داخلية في ملف صفحة) — وظيفة مش موجودة أو مش نشطة أو منتهية بترجع null.
async function getJob(id: string): Promise<any> {
  try {
    const snap = await getDoc(doc(db, "job_posts", id));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.isActive !== true) return null;
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) return null;
    return { id: snap.id, ...data };
  } catch {
    return null;
  }
}

function isArabicText(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

// نفس حل انعكاس ترتيب الكلمات الموجود في opengraph-image.tsx (شرح كامل هناك)، بس هنا
// بيتطبق بس لما النص عربي فعلًا (isArabicText) — عنوان الوظيفة أو اسم الشركة ممكن يتكتب
// إنجليزي أو مختلط، وانعكاس نص إنجليزي زي ده هيقلب ترتيبه غلط بدل ما يصلحه.
function displayText(text: string): string {
  return isArabicText(text) ? text.split(" ").reverse().join(" ") : text;
}
function textDirStyle(text: string): React.CSSProperties {
  return isArabicText(text) ? { direction: "ltr", unicodeBidi: "bidi-override" } : { direction: "ltr" };
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trim() + "…" : text;
}

// نفس منطق salaryText الموجود في page.tsx بالظبط.
function salaryText(p: any): string {
  if (p.showSalary === false) return "غير محدد";
  if (p.salaryNegotiable) return "قابل للتفاوض / حسب الخبرة";
  if (p.salaryFrom && p.salaryTo) return `${p.salaryFrom} - ${p.salaryTo} جنيه`;
  if (p.salaryFrom) return `يبدأ من ${p.salaryFrom} جنيه`;
  return "غير محدد";
}

// نفس منطق splitBulletItems الموجود في page.tsx بالظبط.
function splitBulletItems(description: string): string[] | null {
  if (!description.includes("•")) return null;
  const items = description
    .split("•")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

const CONTACT_METHOD_LABELS: Record<string, string> = { email: "إيميل", whatsapp: "واتساب", phone: "تليفون" };

const LOGO_PATHS = (
  <g>
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
  </g>
);

function Logo({ size: s }: { size: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="480" height="480" rx="60" fill="#C97F1F" />
      {LOGO_PATHS}
    </svg>
  );
}

async function unavailableImage() {
  const cairoBold = await loadCairoFont(SITE_NAME + NOT_AVAILABLE_MESSAGE, 800);

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
          gap: 22,
          background: "#FAF6EC",
        }}
      >
        <Logo size={100} />
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: "#14213D", fontFamily: "Cairo", ...textDirStyle(NOT_AVAILABLE_MESSAGE) }}>
          {displayText(NOT_AVAILABLE_MESSAGE)}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Cairo", data: cairoBold, weight: 800, style: "normal" }] }
  );
}

// صورة مشاركة مخصصة لكل وظيفة — بتتولد لما زرار "مشاركة صورة" في صفحة تفاصيل الوظيفة يتضغط
// (ShareImageButton.tsx بيجيب الـroute ده كـblob بدل ما يبعت الصفحة نفسها).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    return unavailableImage();
  }

  const title = truncate(job.title || "", 70);
  const companyName = job.showCompanyName && job.companyName ? job.companyName : "شركة غير معلنة";
  const location = `${job.city || ""} - ${job.governorate || ""}`;
  const jobTypeLabel = JOB_TYPE_LABELS[job.jobType] || job.jobType || "";
  const levelLabel = job.jobLevel ? EXPERIENCE_LEVELS[job.jobLevel] || job.jobLevel : "";
  const metaLine = [jobTypeLabel, levelLabel].filter(Boolean).join(" · ");
  const featuredBadge = "⭐ مميز";

  const salary = salaryText(job);
  const showSalary = salary !== "غير محدد";

  // أهم 3 نقط من الوصف (لو مكتوب بصيغة "• نقطة • نقطة")، وإلا الشروط كـfallback نقطة
  // واحدة بدل ما نسيب القسم فاضي، وإلا مفيش قسم نقط خالص. sanitizeJobDescription بتحول
  // سطور الـ*/- (اللي بعض أصحاب العمل بيلصقوها من ChatGPT) لنفس رمز "•" اللي splitBulletItems
  // بتفهمه، عشان استخراج النقط يشتغل حتى لو الوصف الأصلي متكتبش بـ• صراحة.
  const bulletItems = splitBulletItems(sanitizeJobDescription(job.description || ""));
  const highlightPoints = (bulletItems ? bulletItems.slice(0, 3) : job.requirements ? [job.requirements] : []).map((item) =>
    truncate(item, 40)
  );

  const hasDirectContact = job.receiveMethod === "contact" && !!job.contactValue;
  const contactLabel = hasDirectContact ? CONTACT_METHOD_LABELS[job.contactMethod] || job.contactMethod : "";
  const bottomLine = hasDirectContact ? `التواصل (${contactLabel}): ${job.contactValue}` : `قدّم دلوقتي على ${DOMAIN}`;

  // نفس فكرة الـsubsetting في opengraph-image.tsx — نحمّل خط Cairo بوزنين بس بالحروف
  // المستخدمة فعليًا في الصورة دي (تختلف كل مرة حسب بيانات الوظيفة).
  const boldText = SITE_NAME + title + DOMAIN + (job.featured ? featuredBadge : "") + (showSalary ? salary : "");
  const mediumText = companyName + location + metaLine + highlightPoints.join("") + bottomLine;
  const [cairoBold, cairoMedium] = await Promise.all([
    loadCairoFont(boldText, 800),
    loadCairoFont(mediumText, 500),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FAF6EC",
          padding: "36px 56px",
          fontFamily: "Cairo",
        }}
      >
        <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <Logo size={40} />
          <div style={{ display: "flex", fontSize: 20, fontWeight: 800, color: "#14213D" }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          {job.featured && (
            <div
              style={{
                display: "flex",
                fontSize: 16,
                fontWeight: 700,
                background: "rgba(232,163,61,0.25)",
                color: "#8A570D",
                padding: "5px 16px",
                borderRadius: 999,
              }}
            >
              {featuredBadge}
            </div>
          )}

          <div
            style={{
              display: "flex",
              width: 1000,
              justifyContent: "flex-end",
              fontSize: 42,
              fontWeight: 800,
              lineHeight: 1.2,
              color: "#14213D",
              textAlign: "right",
              ...textDirStyle(title),
            }}
          >
            {displayText(title)}
          </div>

          <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, fontSize: 24, fontWeight: 500, color: "#4A5568" }}>
            <div style={{ display: "flex" }}>🏢</div>
            <div style={{ display: "flex", ...textDirStyle(companyName) }}>{displayText(companyName)}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, fontSize: 19, fontWeight: 500, color: "#4A5568" }}>
              <div style={{ display: "flex" }}>📍</div>
              <div style={{ display: "flex", ...textDirStyle(location) }}>{displayText(location)}</div>
            </div>
            {metaLine && (
              <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, fontSize: 19, fontWeight: 500, color: "#4A5568" }}>
                <div style={{ display: "flex" }}>🕒</div>
                <div style={{ display: "flex", ...textDirStyle(metaLine) }}>{displayText(metaLine)}</div>
              </div>
            )}
          </div>

          {showSalary && (
            <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 800, color: "#2F6F4E" }}>
              <div style={{ display: "flex" }}>💰</div>
              <div style={{ display: "flex", ...textDirStyle(salary) }}>{displayText(salary)}</div>
            </div>
          )}

          {highlightPoints.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, marginTop: 2 }}>
              {highlightPoints.map((point, i) => (
                <div
                  key={i}
                  style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 500, color: "#4A5568" }}
                >
                  {/* إيموجي مش حرف عادي — بيترسم عن طريق twemoji (نفس آلية باقي الأيقونات
                      في الصورة دي)، مش عن طريق خط Cairo، فمش محتاج يتضاف لأي subset فوق. */}
                  <div style={{ display: "flex" }}>✅</div>
                  <div style={{ display: "flex", ...textDirStyle(point) }}>{displayText(point)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, fontSize: 19, fontWeight: 500, color: "#4A5568" }}>
            {hasDirectContact && <div style={{ display: "flex" }}>📞</div>}
            <div style={{ display: "flex", ...textDirStyle(bottomLine) }}>{displayText(bottomLine)}</div>
          </div>
          <div style={{ display: "flex", fontSize: 21, fontWeight: 800, color: "#B03A14" }}>{DOMAIN}</div>
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
