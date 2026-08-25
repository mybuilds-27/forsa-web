import { ImageResponse } from "next/og";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { EXPERIENCE_LEVELS } from "@/lib/constants";
import { JOB_TYPE_LABELS, sanitizeJobDescription } from "@/lib/jobCardStyles";

// نفس مشكلة الـstatic prerender اللي لقيناها في jobs/[id]/page.tsx وjobs/page.tsx وغيرهم —
// من غيرها الصورة ممكن تتجمد على أول نسخة اتولدت وقت أول زيارة للرابط، وتفضل قديمة حتى لو
// بيانات الوظيفة اتغيرت بعد كده. force-dynamic بيضمن قراءة فريش من Firestore في كل طلب.
export const dynamic = "force-dynamic";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_NAME = "الشغل";
const DOMAIN = "elshoghl.com";
const NOT_AVAILABLE_MESSAGE = "الوظيفة دي مش متاحة";
const MAX_HIGHLIGHT_POINTS = 15;

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

// بتقطع عند حدود الكلمات بس — قص حرفي عند حرف رقم max بالظبط ممكن يقطع في نص كلمة (خصوصًا
// مع displayText اللي بتقلب ترتيب الكلمات للنص العربي، فالكلمة المبتورة بتطلع مشوّهة زي
// "...مج" بدل قص نضيف). لو مفيش مسافة خالص قبل نقطة القطع (كلمة واحدة أطول من max)، بترجع
// للقص الحرفي كـfallback. بترجع النص المقطوع بس، من غير أي "…" ملزوقة — لو "…" اتلزقت هنا
// وبعدين عدّت على displayText، بتتحسب كجزء من آخر "كلمة" (نص+رمز مختلط)، وده بيكسر مكانها
// البصري لما ترتيب الكلمات بينعكس. المستدعي هو اللي بيقرر يعرض "…" كعنصر JSX منفصل تمامًا.
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const sliced = text.slice(0, max);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced;
  return cut.trim();
}

// نفس منطق salaryText الموجود في page.tsx بالظبط.
function salaryText(p: any): string {
  if (p.showSalary === false) return "غير محدد";
  if (p.salaryNegotiable) return "قابل للتفاوض / حسب الخبرة";
  if (p.salaryFrom && p.salaryTo) return `${p.salaryFrom} - ${p.salaryTo} جنيه`;
  if (p.salaryFrom) return `يبدأ من ${p.salaryFrom} جنيه`;
  return "غير محدد";
}

// دالة عامة واحدة لاستخراج نقط من نص حر — مش مربوطة بحالة معينة (بولت صريح أو أسطر منفصلة
// بس)، بتجرب أي تنسيق منطقي شائع بالترتيب ده:
// 1) sanitizeJobDescription بتحول */- في أول السطر لـ• (وتشيل باقي رموز Markdown).
// 2) لو النتيجة فيها "•"، بتتقسم عليها — .slice(1) بيتجاهل أي مقدمة قبل أول "•" فعلي
//    (نفس منطق splitBulletItems القديمة اللي كانت هنا وفي page.tsx بالظبط).
// 3) لو مفيش "•" خالص، بتجرب تقسيم على الأسطر (\n) — كل سطر غير فاضي وعدد كلماته 4 أو
//    أكتر بيبقى نقطة (السطور الأقصر زي "وصف الوظيفة" أو "الشروط" غالبًا عناوين/تسميات
//    قبل المحتوى الحقيقي، مش نقط فعلية، فبتتشال). لو النتيجة بعد الفلترة دي أقل من عنصرين
//    (نص متصل من غير فواصل واضحة) بترجع null بدل ما تعتبره نقطة وهمية.
function extractBulletPoints(rawText: string): string[] | null {
  const sanitized = sanitizeJobDescription(rawText || "");
  if (!sanitized) return null;

  if (sanitized.includes("•")) {
    const items = sanitized
      .split("•")
      .slice(1)
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length > 0 ? items : null;
  }

  const lines = sanitized
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((line) => line.split(/\s+/).filter(Boolean).length >= 4);
  return lines.length >= 2 ? lines : null;
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

  const rawTitle = job.title || "";
  const title = truncate(rawTitle, 70);
  const titleTruncated = title.length < rawTitle.length;
  const companyName = job.showCompanyName && job.companyName ? job.companyName : "شركة غير معلنة";
  const location = `${job.city || ""} - ${job.governorate || ""}`;
  const jobTypeLabel = JOB_TYPE_LABELS[job.jobType] || job.jobType || "";
  const levelLabel = job.jobLevel ? EXPERIENCE_LEVELS[job.jobLevel] || job.jobLevel : "";
  const metaLine = [jobTypeLabel, levelLabel].filter(Boolean).join(" · ");
  const featuredBadge = "⭐ مميز";

  const salary = salaryText(job);
  const showSalary = salary !== "غير محدد";

  // كل نقط الوصف لو extractBulletPoints لقت حاجة فيه، وإلا كل نقط الشروط كـfallback، وإلا
  // مفيش قسم نقط خالص.
  const highlightSource = extractBulletPoints(job.description || "") ?? extractBulletPoints(job.requirements || "") ?? [];
  // حد أقصى أمان (15 نقطة) لمنع وصف شاذ فيه عشرات النقط من إطالة الصورة بلا حدود — أي زيادة
  // عن الحد بتتلخص في سطر "+ N نقطة إضافية" بدل ما تتقطع فجأة.
  const extraPointsCount = Math.max(0, highlightSource.length - MAX_HIGHLIGHT_POINTS);
  const highlightPoints = highlightSource.slice(0, MAX_HIGHLIGHT_POINTS).map((item) => {
    const text = truncate(item, 40);
    return { text, truncated: text.length < item.length };
  });
  const extraPointsLine = extraPointsCount > 0 ? `+ ${extraPointsCount} نقطة إضافية` : "";

  const hasDirectContact = job.receiveMethod === "contact" && !!job.contactValue;
  const contactLabel = hasDirectContact ? CONTACT_METHOD_LABELS[job.contactMethod] || job.contactMethod : "";
  const bottomLine = hasDirectContact ? `التواصل (${contactLabel}): ${job.contactValue}` : `قدّم دلوقتي على ${DOMAIN}`;

  // الصورة بتطول ديناميكيًا حسب عدد النقط بدل ما تفضل ثابتة 630 دايمًا: 480 بيغطي الهيدر
  // والعنوان والشركة والموقع والراتب، +32px لكل سطر نقطة (نفس تقريبًا ارتفاع سطرها الفعلي)،
  // +110px هامش سفلي كافي لسطر التواصل/الدومين. لو مفيش نقط خالص، بترجع للارتفاع القديم
  // الثابت (630) من غير أي حساب — التطويل الديناميكي ده بس لما فيه نقط فعلية.
  const pointsLineCount = highlightPoints.length + (extraPointsLine ? 1 : 0);
  const imageHeight = pointsLineCount > 0 ? 480 + pointsLineCount * 32 + 110 : 630;

  // نفس فكرة الـsubsetting في opengraph-image.tsx — نحمّل خط Cairo بوزنين بس بالحروف
  // المستخدمة فعليًا في الصورة دي (تختلف كل مرة حسب بيانات الوظيفة). "…" بقت بتترسم كعنصر
  // JSX منفصل (مش ملزوقة جوه أي نص)، فبنضيفها هنا صراحة في الوزنين عشان نضمن وجودها في الـ
  // subset حتى لو مفيش أي نص تاني فيه فعلًا — نفس درس الرمز "✓" اللي واجهنا فشل تحميله قبل كده.
  const boldText = SITE_NAME + title + DOMAIN + (job.featured ? featuredBadge : "") + (showSalary ? salary : "") + "…";
  const mediumText = companyName + location + metaLine + highlightPoints.map((p) => p.text).join("") + extraPointsLine + bottomLine + "…";
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

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 1000 }}>
            <div
              style={{
                display: "flex",
                width: "100%",
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
            {/* "…" عنصر منفصل تمامًا عن displayText — لو اتلزقت جوه النص المقلوب هتتحسب
                جزء من آخر "كلمة" وتتحرك مكانها غلط بصريًا. العنوان بيلف على أكتر من سطر
                فمفيش طريقة نخليها "تكمل" آخر سطر تلقائيًا زي text-overflow، فبتظهر تحته مباشرة. */}
            {titleTruncated && (
              <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: "#14213D", marginTop: -6 }}>…</div>
            )}
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
                  {/* "…" عنصر JSX منفصل عن point.text — لو اتلزقت جوه النص قبل ما يعدي على
                      displayText، بتتحسب جزء من آخر "كلمة" (نص عربي + رمز مختلط) وتتحرك
                      مكانها غلط بصريًا لما ترتيب الكلمات بينعكس. هنا ثابتة دايمًا آخر السطر. */}
                  <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 1 }}>
                    <div style={{ display: "flex", ...textDirStyle(point.text) }}>{displayText(point.text)}</div>
                    {point.truncated && <div style={{ display: "flex" }}>…</div>}
                  </div>
                </div>
              ))}
              {extraPointsLine && (
                <div style={{ display: "flex", fontSize: 15, fontWeight: 500, color: "#8A8F98", marginTop: 2, ...textDirStyle(extraPointsLine) }}>
                  {displayText(extraPointsLine)}
                </div>
              )}
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
      width: 1200,
      height: imageHeight,
      fonts: [
        { name: "Cairo", data: cairoBold, weight: 800, style: "normal" },
        { name: "Cairo", data: cairoMedium, weight: 500, style: "normal" },
      ],
    }
  );
}
