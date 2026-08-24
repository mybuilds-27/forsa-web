const { setGlobalOptions } = require("firebase-functions");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

// نفس القايمة المستخدمة في web-next (Navbar.tsx وadmin/page.tsx وpage.tsx) لتحديد حسابات
// الأدمن — هنا بنستخدمها لتحويل الإيميل لـuid عشان نبعت إشعار داخلي (notifications collection
// بتتفلتر بـuserId مش إيميل).
const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options.
setGlobalOptions({ maxInstances: 10 });

initializeApp();

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

// هيدر موحّد لكل قوالب الإيميل — لوجو PNG بدل النص، لأن بعض عملاء البريد (خصوصًا نسخ
// أوت لوك القديمة) مش بيدعموا الخطوط المرفوعة (Cairo/Tajawal) ولا SVG، فالنص كان بيظهر
// بخط النظام الافتراضي بلا هوية بصرية واضحة. الصورة مستضافة على نفس دومين الموقع
// (public/email-logo.png)، خلفية شفافة عشان تناسب أي لون هيدر.
function buildEmailHeader() {
  return `
            <td style="background-color:#14213D;padding:24px 28px;text-align:center;border-radius:14px 14px 0 0;">
              <img src="https://www.elshoghl.com/email-logo.png" width="160" height="40" alt="الشغل" style="display:block;margin:0 auto;border:0;outline:none;" />
              <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;color:#E8A33D;font-size:13px;margin-top:8px;">موقع توظيف مصري</div>
            </td>`;
}

function buildInvitationEmailHtml({ companyName, jobTitle, jobLink }) {
  const safeCompany = escapeHtml(companyName);
  const safeJobTitle = escapeHtml(jobTitle);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>دعوة للتقديم</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#FAF6EC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6EC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:14px;border:1px solid #DED2B5;">
          <tr>
            ${buildEmailHeader()}
          </tr>
          <tr>
            <td style="padding:28px;direction:rtl;text-align:right;">
              <p style="margin:0 0 18px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:15px;color:#14213D;line-height:1.8;">
                عندك دعوة جديدة للتقديم على وظيفة:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1EAD9;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 18px;direction:rtl;text-align:right;">
                    <div style="font-family:'Cairo',Tahoma,Arial,sans-serif;font-size:16px;font-weight:700;color:#14213D;margin-bottom:8px;">
                      ${safeJobTitle}
                    </div>
                    <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;color:#4A5568;">
                      من شركة <strong style="color:#14213D;">${safeCompany}</strong>
                    </div>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background-color:#14213D;">
                          <a href="${jobLink}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                            عرض الوظيفة والتقديم عليها
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#F1EAD9;text-align:center;border-radius:0 0 14px 14px;">
              <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:12px;color:#4A5568;">
                الشغل — موقع توظيف مصري ·
                <a href="https://www.elshoghl.com" style="color:#14213D;text-decoration:underline;">elshoghl.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildInvitationEmailText({ companyName, jobTitle, jobLink }) {
  return [
    `عندك دعوة جديدة للتقديم على وظيفة "${jobTitle}" من شركة ${companyName}.`,
    "",
    `اعرض الوظيفة وقدّم عليها من هنا: ${jobLink}`,
    "",
    "الشغل — موقع توظيف مصري · elshoghl.com",
  ].join("\n");
}

function buildJobReportEmailHtml({ jobTitle, reason, details, jobLink }) {
  const safeJobTitle = escapeHtml(jobTitle);
  const safeReason = escapeHtml(reason);
  const safeDetails = escapeHtml(details || "");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>بلاغ عن وظيفة</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#FAF6EC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6EC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:14px;border:1px solid #DED2B5;">
          <tr>
            ${buildEmailHeader()}
          </tr>
          <tr>
            <td style="padding:28px;direction:rtl;text-align:right;">
              <p style="margin:0 0 18px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:15px;color:#14213D;line-height:1.8;">
                🚩 بلاغ جديد من زائر عن وظيفة على الموقع:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1EAD9;border-radius:10px;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 18px;direction:rtl;text-align:right;">
                    <div style="font-family:'Cairo',Tahoma,Arial,sans-serif;font-size:16px;font-weight:700;color:#14213D;margin-bottom:10px;">
                      ${safeJobTitle}
                    </div>
                    <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;color:#4A5568;margin-bottom:${safeDetails ? "8px" : "0"};">
                      السبب: <strong style="color:#B03A14;">${safeReason}</strong>
                    </div>
                    ${
                      safeDetails
                        ? `<div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:13.5px;color:#4A5568;line-height:1.7;white-space:pre-wrap;">${safeDetails}</div>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background-color:#14213D;">
                          <a href="${jobLink}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                            عرض الوظيفة
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#F1EAD9;text-align:center;border-radius:0 0 14px 14px;">
              <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:12px;color:#4A5568;">
                الشغل — موقع توظيف مصري ·
                <a href="https://www.elshoghl.com" style="color:#14213D;text-decoration:underline;">elshoghl.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildJobReportEmailText({ jobTitle, reason, details, jobLink }) {
  return [
    `بلاغ جديد من زائر عن وظيفة "${jobTitle}".`,
    `السبب: ${reason}`,
    ...(details ? ["", `تفاصيل إضافية: ${details}`] : []),
    "",
    `اعرض الوظيفة من هنا: ${jobLink}`,
    "",
    "الشغل — موقع توظيف مصري · elshoghl.com",
  ].join("\n");
}

function buildPremiumExpiryEmailHtml({ employers }) {
  const rows = employers
    .map(
      (e) => `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #DED2B5;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;color:#14213D;text-align:right;">
                    ${escapeHtml(e.companyName)}
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #DED2B5;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;color:${e.daysLeft < 0 ? "#B03A14" : "#8A570D"};text-align:left;white-space:nowrap;">
                    ${e.daysLeft < 0 ? `منتهية من ${Math.abs(e.daysLeft)} يوم` : e.daysLeft === 0 ? "بتنتهي النهاردة" : `باقي ${e.daysLeft} يوم`}
                  </td>
                </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>باقات مدفوعة قربت تخلص</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#FAF6EC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6EC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:14px;border:1px solid #DED2B5;">
          <tr>
            ${buildEmailHeader()}
          </tr>
          <tr>
            <td style="padding:28px;direction:rtl;text-align:right;">
              <p style="margin:0 0 18px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:15px;color:#14213D;line-height:1.8;">
                ⏰ الباقات المدفوعة دي قربت تخلص (أو خلصت) — لازم تتابعها:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1EAD9;border-radius:10px;padding:4px 18px;">
                ${rows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#F1EAD9;text-align:center;border-radius:0 0 14px 14px;">
              <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:12px;color:#4A5568;">
                الشغل — موقع توظيف مصري ·
                <a href="https://www.elshoghl.com" style="color:#14213D;text-decoration:underline;">elshoghl.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPremiumExpiryEmailText({ employers }) {
  return [
    "الباقات المدفوعة دي قربت تخلص (أو خلصت) — لازم تتابعها:",
    "",
    ...employers.map(
      (e) =>
        `- ${e.companyName}: ${
          e.daysLeft < 0 ? `منتهية من ${Math.abs(e.daysLeft)} يوم` : e.daysLeft === 0 ? "بتنتهي النهاردة" : `باقي ${e.daysLeft} يوم`
        }`
    ),
    "",
    "الشغل — موقع توظيف مصري · elshoghl.com",
  ].join("\n");
}

function buildDailySummaryEmailHtml({ totalCount, jobs }) {
  const jobRows = jobs
    .map(
      (j) => `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #DED2B5;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;color:#14213D;text-align:right;">
                    ${escapeHtml(j.title)}
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #DED2B5;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;color:#4A5568;text-align:left;white-space:nowrap;">
                    ${j.count} متقدم
                  </td>
                </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ملخص المتقدمين اليومي</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#FAF6EC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6EC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:14px;border:1px solid #DED2B5;">
          <tr>
            ${buildEmailHeader()}
          </tr>
          <tr>
            <td style="padding:28px;direction:rtl;text-align:right;">
              <p style="margin:0 0 18px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:15px;color:#14213D;line-height:1.8;">
                عندك <strong>${totalCount}</strong> متقدم جديد على إعلاناتك خلال آخر 24 ساعة:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1EAD9;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${jobRows}
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background-color:#14213D;">
                          <a href="https://www.elshoghl.com/employer" target="_blank" style="display:inline-block;padding:13px 30px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                            عرض التفاصيل من لوحة صاحب العمل
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#F1EAD9;text-align:center;border-radius:0 0 14px 14px;">
              <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:12px;color:#4A5568;">
                الشغل — موقع توظيف مصري ·
                <a href="https://www.elshoghl.com" style="color:#14213D;text-decoration:underline;">elshoghl.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildDailySummaryEmailText({ totalCount, jobs }) {
  return [
    `عندك ${totalCount} متقدم جديد على إعلاناتك خلال آخر 24 ساعة:`,
    "",
    ...jobs.map((j) => `- ${j.title}: ${j.count} متقدم`),
    "",
    "اعرض التفاصيل من لوحة صاحب العمل: https://www.elshoghl.com/employer",
    "",
    "الشغل — موقع توظيف مصري · elshoghl.com",
  ].join("\n");
}

// لازم يفضل متطابق مع JOB_TYPE_LABELS في web-next/src/lib/jobCardStyles.ts
const JOB_TYPE_LABELS = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  remote: "عن بعد",
  freelance: "فريلانس",
};

function jobTypeLabel(jobType) {
  return JOB_TYPE_LABELS[jobType] || jobType || "";
}

// لازم يفضل متطابق مع APPLICATION_STATUS_LABELS في web-next/src/lib/jobCardStyles.ts
const APPLICATION_STATUS_LABELS = {
  submitted: "تقديم",
  shortlisted: "قيد المراجعة",
  interview: "مقابلة",
  accepted: "قبول",
  rejected: "رفض",
};

const APPLICATION_STATUS_MESSAGES = {
  submitted: (jobTitle, companyName) => `تقديمك على وظيفة "${jobTitle}" من ${companyName} رجع لحالة "تقديم".`,
  shortlisted: (jobTitle, companyName) => `تقديمك على وظيفة "${jobTitle}" من ${companyName} بقى قيد المراجعة.`,
  interview: (jobTitle, companyName) => `مبروك! ${companyName} عايزة تعمل معاك مقابلة على وظيفة "${jobTitle}".`,
  accepted: (jobTitle, companyName) => `مبروك! اتقبلت على وظيفة "${jobTitle}" من ${companyName}.`,
  rejected: (jobTitle, companyName) => `للأسف، ${companyName} قررت المتابعة مع مرشح تاني لوظيفة "${jobTitle}". فيه فرص تانية كتير مستنياك على الموقع.`,
};

function buildStatusUpdateEmailHtml({ jobTitle, companyName, status, jobLink }) {
  const safeMessage = escapeHtml(
    (APPLICATION_STATUS_MESSAGES[status] || APPLICATION_STATUS_MESSAGES.submitted)(jobTitle, companyName)
  );
  const statusLabel = escapeHtml(APPLICATION_STATUS_LABELS[status] || status);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تحديث حالة تقديمك</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#FAF6EC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6EC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:14px;border:1px solid #DED2B5;">
          <tr>
            ${buildEmailHeader()}
          </tr>
          <tr>
            <td style="padding:28px;direction:rtl;text-align:right;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="background-color:#F1EAD9;border-radius:999px;padding:5px 14px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:13px;font-weight:700;color:#14213D;">
                    الحالة الجديدة: ${statusLabel}
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:15px;color:#14213D;line-height:1.8;">
                ${safeMessage}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background-color:#14213D;">
                          <a href="${jobLink}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                            عرض الوظيفة
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#F1EAD9;text-align:center;border-radius:0 0 14px 14px;">
              <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:12px;color:#4A5568;">
                الشغل — موقع توظيف مصري ·
                <a href="https://www.elshoghl.com" style="color:#14213D;text-decoration:underline;">elshoghl.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildStatusUpdateEmailText({ jobTitle, companyName, status, jobLink }) {
  const message = (APPLICATION_STATUS_MESSAGES[status] || APPLICATION_STATUS_MESSAGES.submitted)(jobTitle, companyName);
  return [
    message,
    "",
    `اعرض الوظيفة من هنا: ${jobLink}`,
    "",
    "الشغل — موقع توظيف مصري · elshoghl.com",
  ].join("\n");
}

function buildJobRowHtml(j, ctaLabel) {
  const meta = [j.companyName, j.governorate, jobTypeLabel(j.jobType)].filter(Boolean).map(escapeHtml).join(" · ");
  return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1EAD9;border-radius:10px;margin-bottom:12px;">
                  <tr>
                    <td style="padding:14px 16px;direction:rtl;text-align:right;">
                      <div style="font-family:'Cairo',Tahoma,Arial,sans-serif;font-size:15px;font-weight:700;color:#14213D;margin-bottom:6px;">
                        ${escapeHtml(j.title)}
                      </div>
                      <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:13px;color:#4A5568;margin-bottom:10px;">
                        ${meta}
                      </div>
                      <a href="https://www.elshoghl.com/jobs/${j.id}" target="_blank" style="display:inline-block;padding:8px 18px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;background-color:#14213D;text-decoration:none;border-radius:6px;">
                        ${ctaLabel}
                      </a>
                    </td>
                  </tr>
                </table>`;
}

function buildWeeklyDigestEmailHtml({ newJobs, savedJobs, unsubscribeUrl }) {
  const newJobsHtml = newJobs.map((j) => buildJobRowHtml(j, "قدّم الآن")).join("");
  const savedJobsHtml =
    savedJobs.length > 0
      ? `
              <p style="margin:26px 0 12px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;font-weight:700;color:#14213D;">
                متنساش، وظايفك المحفوظة لسه متاحة:
              </p>
              ${savedJobs.map((j) => buildJobRowHtml(j, "عرض الوظيفة")).join("")}`
      : "";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>وظايف جديدة تناسبك</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#FAF6EC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6EC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:14px;border:1px solid #DED2B5;">
          <tr>
            ${buildEmailHeader()}
          </tr>
          <tr>
            <td style="padding:28px;direction:rtl;text-align:right;">
              <p style="margin:0 0 18px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:15px;color:#14213D;line-height:1.8;">
                لقينالك ${newJobs.length} وظيفة جديدة تناسب تخصصك الأسبوع ده:
              </p>
              ${newJobsHtml}
              ${savedJobsHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#F1EAD9;text-align:center;border-radius:0 0 14px 14px;">
              <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:12px;color:#4A5568;margin-bottom:8px;">
                الشغل — موقع توظيف مصري ·
                <a href="https://www.elshoghl.com" style="color:#14213D;text-decoration:underline;">elshoghl.com</a>
              </div>
              <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:11.5px;color:#4A5568;">
                <a href="${unsubscribeUrl}" style="color:#4A5568;text-decoration:underline;">إلغاء الاشتراك من الإيميلات دي</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildWeeklyDigestEmailText({ newJobs, savedJobs, unsubscribeUrl }) {
  const lines = [
    `لقينالك ${newJobs.length} وظيفة جديدة تناسب تخصصك الأسبوع ده:`,
    "",
    ...newJobs.map(
      (j) =>
        `- ${j.title} (${[j.companyName, j.governorate, jobTypeLabel(j.jobType)].filter(Boolean).join(" · ")}): https://www.elshoghl.com/jobs/${j.id}`
    ),
  ];
  if (savedJobs.length > 0) {
    lines.push("", "متنساش، وظايفك المحفوظة لسه متاحة:", "");
    lines.push(...savedJobs.map((j) => `- ${j.title}: https://www.elshoghl.com/jobs/${j.id}`));
  }
  lines.push("", "الشغل — موقع توظيف مصري · elshoghl.com", "", `إلغاء الاشتراك من الإيميلات دي: ${unsubscribeUrl}`);
  return lines.join("\n");
}

function buildSignupReminderEmailHtml({ userType, ctaLink }) {
  const isEmployer = userType === "employer";
  const heading = isEmployer ? "محتاج مساعدة في نشر أول وظيفة؟" : "محتاج مساعدة تكمّل بروفايلك؟";
  const body = isEmployer
    ? "لاحظنا إنك سجّلت دخول على موقع الشغل بس لسه ما استكملتش بيانات شركتك. الأمر بياخد دقايق بس، وبعدها تقدر تنشر أول وظيفة وتوصل لكوادر مناسبة."
    : "لاحظنا إنك سجّلت دخول على موقع الشغل بس لسه ما استكملتش بروفايلك. باقيلك دقيقة بس عشان تقدر تتصفح وتقدّم على الوظائف المناسبة ليك.";
  const ctaLabel = isEmployer ? "كمّل بيانات شركتك" : "كمّل بروفايلك";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${heading}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#FAF6EC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6EC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:14px;border:1px solid #DED2B5;">
          <tr>
            ${buildEmailHeader()}
          </tr>
          <tr>
            <td style="padding:28px;direction:rtl;text-align:right;">
              <div style="font-family:'Cairo',Tahoma,Arial,sans-serif;font-size:18px;font-weight:700;color:#14213D;margin-bottom:14px;">
                ${heading}
              </div>
              <p style="margin:0 0 24px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:15px;color:#4A5568;line-height:1.8;">
                ${body}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background-color:#14213D;">
                          <a href="${ctaLink}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                            ${ctaLabel}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#F1EAD9;text-align:center;border-radius:0 0 14px 14px;">
              <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:12px;color:#4A5568;">
                الشغل — موقع توظيف مصري ·
                <a href="https://www.elshoghl.com" style="color:#14213D;text-decoration:underline;">elshoghl.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSignupReminderEmailText({ userType, ctaLink }) {
  const isEmployer = userType === "employer";
  const heading = isEmployer ? "محتاج مساعدة في نشر أول وظيفة؟" : "محتاج مساعدة تكمّل بروفايلك؟";
  const body = isEmployer
    ? "لاحظنا إنك سجّلت دخول على موقع الشغل بس لسه ما استكملتش بيانات شركتك. الأمر بياخد دقايق بس."
    : "لاحظنا إنك سجّلت دخول على موقع الشغل بس لسه ما استكملتش بروفايلك. باقيلك دقيقة بس.";
  return [heading, "", body, "", `كمّل من هنا: ${ctaLink}`, "", "الشغل — موقع توظيف مصري · elshoghl.com"].join("\n");
}

function buildFirstJobReminderEmailHtml({ ctaLink }) {
  const heading = "محتاج مساعدة في نشر أول وظيفة؟";
  const body =
    "كمّلت بيانات شركتك على موقع الشغل من كام يوم، بس لسه ما نشرتش أول وظيفة. النشر مجاني بالكامل وبياخد دقايق بس — انشر وظيفتك الأولى دلوقتي ووصل لكوادر مناسبة.";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${heading}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#FAF6EC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6EC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:14px;border:1px solid #DED2B5;">
          <tr>
            ${buildEmailHeader()}
          </tr>
          <tr>
            <td style="padding:28px;direction:rtl;text-align:right;">
              <div style="font-family:'Cairo',Tahoma,Arial,sans-serif;font-size:18px;font-weight:700;color:#14213D;margin-bottom:14px;">
                ${heading}
              </div>
              <p style="margin:0 0 24px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:15px;color:#4A5568;line-height:1.8;">
                ${body}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background-color:#14213D;">
                          <a href="${ctaLink}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                            انشر أول وظيفة
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#F1EAD9;text-align:center;border-radius:0 0 14px 14px;">
              <div style="font-family:'Tajawal',Tahoma,Arial,sans-serif;font-size:12px;color:#4A5568;">
                الشغل — موقع توظيف مصري ·
                <a href="https://www.elshoghl.com" style="color:#14213D;text-decoration:underline;">elshoghl.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildFirstJobReminderEmailText({ ctaLink }) {
  const heading = "محتاج مساعدة في نشر أول وظيفة؟";
  const body =
    "كمّلت بيانات شركتك على موقع الشغل من كام يوم، بس لسه ما نشرتش أول وظيفة. النشر مجاني بالكامل وبياخد دقايق بس.";
  return [heading, "", body, "", `انشر أول وظيفة من هنا: ${ctaLink}`, "", "الشغل — موقع توظيف مصري · elshoghl.com"].join("\n");
}

function unsubscribePageHtml({ success, message }) {
  const title = success ? "تم إلغاء الاشتراك" : "حصلت مشكلة";
  const body = success
    ? "تم إيقاف إيميلات الوظائف الأسبوعية بنجاح. لسه هتوصلك إيميلات مهمة تانية زي تحديثات حالة تقديماتك."
    : message || "حصلت مشكلة، حاول تاني لاحقًا.";
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:40px 20px;background-color:#FAF6EC;font-family:Tahoma,Arial,sans-serif;text-align:center;">
  <div style="max-width:420px;margin:0 auto;background:#fff;border:1px solid #DED2B5;border-radius:14px;padding:32px 24px;">
    <div style="font-size:22px;font-weight:900;color:#14213D;margin-bottom:12px;">الشغل</div>
    <h2 style="color:#14213D;margin:0 0 12px;">${title}</h2>
    <p style="color:#4A5568;line-height:1.8;margin:0;">${body}</p>
    <a href="https://www.elshoghl.com" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#14213D;color:#fff;text-decoration:none;border-radius:8px;">رجوع للموقع</a>
  </div>
</body>
</html>`;
}

async function sendViaResend({ to, subject, html, text, logPrefix }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY.value()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: "الشغل <noreply@elshoghl.com>", to, subject, html, text }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error(`${logPrefix}: فشل إرسال الإيميل عبر Resend (HTTP ${res.status})`, errBody);
  }
}

async function createNotification({ userId, type, message, link }) {
  try {
    await getFirestore().collection("notifications").add({
      userId,
      type,
      message,
      link,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.error(`createNotification (${type}): فشل إنشاء إشعار لليوزر ${userId}`, err);
  }
}

// نفس createNotification بس بـbatch write واحد بدل .add() منفصل لكل إشعار — مهم لما العدد
// كبير (زي إشعار وظيفة جديدة لكل الباحثين المطابقين لتخصص معيّن دفعة واحدة). بيقسّم لدفعات
// 450 عشان حد الـ500 عملية لكل batch في Firestore.
async function createNotificationsBatch(notifications, logPrefix) {
  if (notifications.length === 0) return;
  const db = getFirestore();
  const CHUNK_SIZE = 450;
  for (let i = 0; i < notifications.length; i += CHUNK_SIZE) {
    const chunk = notifications.slice(i, i + CHUNK_SIZE);
    try {
      const batch = db.batch();
      chunk.forEach((n) => {
        const ref = db.collection("notifications").doc();
        batch.set(ref, {
          userId: n.userId,
          type: n.type,
          message: n.message,
          link: n.link,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (err) {
      logger.error(`${logPrefix || "createNotificationsBatch"}: فشل batch commit لـ${chunk.length} إشعار`, err);
    }
  }
}

exports.onNewInvitation = onDocumentCreated(
  { document: "invitations/{invitationId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const invitation = snap.data();
    const db = getFirestore();

    const companyName = invitation.employerCompanyName || "صاحب عمل";
    const jobTitle = invitation.jobTitle || "وظيفة";

    await createNotification({
      userId: invitation.seekerId,
      type: "new_invitation",
      message: `${companyName} دعتك للتقديم على وظيفة "${jobTitle}"`,
      link: `/jobs/${invitation.jobPostId}`,
    });

    try {
      const seekerUserSnap = await db.collection("users").doc(invitation.seekerId).get();
      const seekerEmail = seekerUserSnap.exists ? seekerUserSnap.data().email : null;

      if (!seekerEmail) {
        logger.error(
          `onNewInvitation: مفيش بريد إلكتروني مسجّل للباحث ${invitation.seekerId} — تم تجاهل الإيميل (الإشعار الداخلي اتعمل)`
        );
        return;
      }

      const jobLink = `https://www.elshoghl.com/jobs/${invitation.jobPostId}`;
      const emailFields = { companyName, jobTitle, jobLink };

      await sendViaResend({
        to: seekerEmail,
        subject: `${companyName} دعتك للتقديم على وظيفة ${jobTitle}`,
        html: buildInvitationEmailHtml(emailFields),
        text: buildInvitationEmailText(emailFields),
        logPrefix: "onNewInvitation",
      });
    } catch (err) {
      logger.error("onNewInvitation: حصلت مشكلة غير متوقعة", err);
    }
  }
);

exports.onApplicationStatusChanged = onDocumentUpdated(
  { document: "applications/{applicationId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!before || !after) return;

    const beforeStatus = before.status || "submitted";
    const afterStatus = after.status || "submitted";
    if (beforeStatus === afterStatus) return; // مفيش تغيير حقيقي في الحالة

    const db = getFirestore();
    const statusLabel = APPLICATION_STATUS_LABELS[afterStatus] || afterStatus;

    const jobSnap = await db.collection("job_posts").doc(after.jobPostId).get();
    const jobData = jobSnap.exists ? jobSnap.data() : null;
    const jobTitle = jobData?.title || "وظيفة";
    // نفس منطق الإخفاء المستخدم في الواجهة بالظبط (JobCard.tsx وغيره):
    // لو صاحب العمل ما فعّلش "أظهر اسم الشركة"، الإشعار/الإيميل يعرضوا نفس النص البديل زي أي مكان تاني في الموقع
    const companyName = jobData?.showCompanyName && jobData?.companyName ? jobData.companyName : "شركة غير معلنة";

    await createNotification({
      userId: after.seekerId,
      type: "status_changed",
      message: `تقديمك على وظيفة "${jobTitle}" بقى ${statusLabel}`,
      link: `/jobs/${after.jobPostId}`,
    });

    try {
      const seekerUserSnap = await db.collection("users").doc(after.seekerId).get();
      const seekerEmail = seekerUserSnap.exists ? seekerUserSnap.data().email : null;

      if (!seekerEmail) {
        logger.error(
          `onApplicationStatusChanged: مفيش بريد إلكتروني مسجّل للباحث ${after.seekerId} — تم تجاهل الإيميل (الإشعار الداخلي اتعمل)`
        );
        return;
      }

      const jobLink = `https://www.elshoghl.com/jobs/${after.jobPostId}`;
      const emailFields = { jobTitle, companyName, status: afterStatus, jobLink };

      await sendViaResend({
        to: seekerEmail,
        subject: `تحديث على تقديمك لوظيفة ${jobTitle}: ${statusLabel}`,
        html: buildStatusUpdateEmailHtml(emailFields),
        text: buildStatusUpdateEmailText(emailFields),
        logPrefix: "onApplicationStatusChanged",
      });
    } catch (err) {
      logger.error("onApplicationStatusChanged: حصلت مشكلة غير متوقعة", err);
    }
  }
);

// إشعار داخل الموقع بس لصاحب العمل عند أي تقديم جديد — من غير إيميل فوري
// (الإيميل الفوري لكل تقديم مش مطلوب، الملخص اليومي dailyApplicationsSummary already بيغطي الإيميل)
exports.onApplicationCreated = onDocumentCreated(
  { document: "applications/{applicationId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const application = snap.data();
    if (!application.employerId || !application.jobPostId) return;

    const db = getFirestore();
    const jobSnap = await db.collection("job_posts").doc(application.jobPostId).get();
    const jobTitle = jobSnap.exists ? jobSnap.data().title || "وظيفة" : "وظيفة";
    const applicantName = application.seekerSnapshot?.fullName;

    await createNotification({
      userId: application.employerId,
      type: "new_applicant",
      message: applicantName
        ? `متقدم جديد على وظيفة "${jobTitle}": ${applicantName}`
        : `متقدم جديد على وظيفة "${jobTitle}"`,
      link: `/employer?tab=company`,
    });
  }
);

exports.dailyApplicationsSummary = onSchedule(
  { schedule: "0 8 * * *", timeZone: "Africa/Cairo", secrets: [RESEND_API_KEY] },
  async () => {
    const db = getFirestore();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let appsSnap;
    try {
      appsSnap = await db.collection("applications").where("appliedAt", ">=", since).get();
    } catch (err) {
      logger.error("dailyApplicationsSummary: فشل جلب التقديمات", err);
      return;
    }

    if (appsSnap.empty) {
      logger.info("dailyApplicationsSummary: مفيش تقديمات جديدة في آخر 24 ساعة — مفيش إيميلات هتتبعت");
      return;
    }

    // تجميع التقديمات: لكل صاحب عمل، عدد المتقدمين لكل وظيفة من وظائفه
    const byEmployer = new Map(); // employerId -> Map(jobPostId -> count)
    for (const docSnap of appsSnap.docs) {
      const data = docSnap.data();
      const { employerId, jobPostId } = data;
      if (!employerId || !jobPostId) continue;

      if (!byEmployer.has(employerId)) byEmployer.set(employerId, new Map());
      const jobCounts = byEmployer.get(employerId);
      jobCounts.set(jobPostId, (jobCounts.get(jobPostId) || 0) + 1);
    }

    // قراءة عنوان كل وظيفة مرة واحدة بس، بغض النظر عن عدد المتقدمين عليها
    const allJobIds = new Set();
    for (const jobCounts of byEmployer.values()) {
      for (const jobId of jobCounts.keys()) allJobIds.add(jobId);
    }
    const jobTitleEntries = await Promise.all(
      Array.from(allJobIds).map(async (jobId) => {
        try {
          const jobSnap = await db.collection("job_posts").doc(jobId).get();
          return [jobId, jobSnap.exists ? jobSnap.data().title || "وظيفة" : "وظيفة محذوفة"];
        } catch (err) {
          logger.error(`dailyApplicationsSummary: فشل جلب job_posts/${jobId}`, err);
          return [jobId, "وظيفة"];
        }
      })
    );
    const jobTitles = new Map(jobTitleEntries);

    // إيميل واحد لكل صاحب عمل، حتى لو عنده تقديمات على أكتر من وظيفة
    for (const [employerId, jobCounts] of byEmployer.entries()) {
      try {
        const userSnap = await db.collection("users").doc(employerId).get();
        const employerEmail = userSnap.exists ? userSnap.data().email : null;

        if (!employerEmail) {
          logger.error(
            `dailyApplicationsSummary: مفيش بريد إلكتروني مسجّل لصاحب العمل ${employerId} — تم تجاهله`
          );
          continue;
        }

        const jobs = Array.from(jobCounts.entries()).map(([jobId, count]) => ({
          title: jobTitles.get(jobId) || "وظيفة",
          count,
        }));
        const totalCount = jobs.reduce((sum, j) => sum + j.count, 0);

        await sendViaResend({
          to: employerEmail,
          subject: `${totalCount} متقدم جديد على إعلاناتك اليوم`,
          html: buildDailySummaryEmailHtml({ totalCount, jobs }),
          text: buildDailySummaryEmailText({ totalCount, jobs }),
          logPrefix: "dailyApplicationsSummary",
        });
      } catch (err) {
        // خطأ مع صاحب عمل واحد ميوقفش معالجة باقي أصحاب الأعمال
        logger.error(`dailyApplicationsSummary: حصلت مشكلة مع صاحب العمل ${employerId}`, err);
      }
    }
  }
);

// إيميل أسبوعي مجمّع للباحثين: وظائف جديدة تطابق التخصص + تذكير بالمحفوظات، في إيميل واحد
// بدل ميزتين منفصلتين — لتقليل تكلفة Resend. الشرط الأساسي: لو مفيش وظائف جديدة تطابق
// تخصص الباحث الأسبوع ده، مفيش إيميل خالص — القسم بتاع المحفوظات إضافة على إيميل قايم
// بالفعل، مش سبب مستقل لإرسال إيميل.
exports.weeklySeekerDigest = onSchedule(
  { schedule: "0 9 * * 0", timeZone: "Africa/Cairo", secrets: [RESEND_API_KEY] },
  async () => {
    const db = getFirestore();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = Date.now();

    let newJobsSnap;
    try {
      newJobsSnap = await db
        .collection("job_posts")
        .where("isActive", "==", true)
        .where("createdAt", ">=", since)
        .get();
    } catch (err) {
      logger.error("weeklySeekerDigest: فشل جلب الوظائف الجديدة", err);
      return;
    }

    if (newJobsSnap.empty) {
      logger.info("weeklySeekerDigest: مفيش وظائف جديدة اتنشرت الأسبوع ده — مفيش إيميلات هتتبعت");
      return;
    }

    // تجميع الوظائف الجديدة حسب التخصص، عشان منعملش query منفصل لكل باحث
    const newJobsBySpecialization = new Map();
    newJobsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.expiresAt && data.expiresAt.toMillis() < now) return;
      if (!data.specialization) return;

      const job = {
        id: docSnap.id,
        title: data.title || "وظيفة",
        governorate: data.governorate || "",
        jobType: data.jobType,
        companyName: data.showCompanyName && data.companyName ? data.companyName : "شركة غير معلنة",
        featured: !!data.featured,
        createdAtMillis: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
      };
      if (!newJobsBySpecialization.has(data.specialization)) newJobsBySpecialization.set(data.specialization, []);
      newJobsBySpecialization.get(data.specialization).push(job);
    });
    for (const jobs of newJobsBySpecialization.values()) {
      jobs.sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAtMillis - a.createdAtMillis);
    }

    // كل الوظائف المحفوظة لكل الباحثين مرة واحدة، بدل query منفصل لكل باحث
    let savedJobIdsBySeeker = new Map();
    try {
      const savedJobsSnap = await db.collection("saved_jobs").get();
      savedJobsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.seekerId || !data.jobPostId) return;
        if (!savedJobIdsBySeeker.has(data.seekerId)) savedJobIdsBySeeker.set(data.seekerId, []);
        savedJobIdsBySeeker.get(data.seekerId).push(data.jobPostId);
      });
    } catch (err) {
      logger.error("weeklySeekerDigest: فشل جلب saved_jobs (هيتجاهل قسم المحفوظات بس مش هيوقف الإيميلات)", err);
    }

    // كاش لتفاصيل الوظائف المحفوظة عشان منقراش نفس المستند مرتين لو أكتر من باحث حافظ نفس الوظيفة
    const savedJobDetailsCache = new Map();
    async function getSavedJobDetails(jobPostId) {
      if (savedJobDetailsCache.has(jobPostId)) return savedJobDetailsCache.get(jobPostId);
      let details = null;
      try {
        const jobSnap = await db.collection("job_posts").doc(jobPostId).get();
        if (jobSnap.exists) {
          const data = jobSnap.data();
          const expired = data.expiresAt && data.expiresAt.toMillis() < now;
          if (data.isActive !== false && !expired) {
            details = {
              id: jobSnap.id,
              title: data.title || "وظيفة",
              governorate: data.governorate || "",
              jobType: data.jobType,
              companyName: data.showCompanyName && data.companyName ? data.companyName : "شركة غير معلنة",
            };
          }
        }
      } catch (err) {
        logger.error(`weeklySeekerDigest: فشل جلب تفاصيل الوظيفة المحفوظة ${jobPostId}`, err);
      }
      savedJobDetailsCache.set(jobPostId, details);
      return details;
    }

    let seekersSnap;
    try {
      seekersSnap = await db.collection("job_seekers").get();
    } catch (err) {
      logger.error("weeklySeekerDigest: فشل جلب job_seekers", err);
      return;
    }

    let sentCount = 0;
    for (const seekerDoc of seekersSnap.docs) {
      const seekerId = seekerDoc.id;
      const seeker = seekerDoc.data();

      // زي نفس منطق الافتراضي true المستخدم في الواجهة (PrivacyTab): غياب الحقل معناه
      // مفعّل، بس false الصريحة (بعد إلغاء الاشتراك) هي اللي بتوقف الإيميل
      if (seeker.emailNotificationsEnabled === false) continue;
      if (!seeker.specialization) continue;

      let candidates = newJobsBySpecialization.get(seeker.specialization) || [];
      if (seeker.governorate) {
        candidates = candidates.filter((j) => j.governorate === seeker.governorate);
      }
      if (candidates.length === 0) continue; // الشرط الأساسي لتقليل التكلفة

      const newJobsForEmail = candidates.slice(0, 8);
      const savedJobIds = savedJobIdsBySeeker.get(seekerId) || [];
      const savedJobsForEmail = (await Promise.all(savedJobIds.map(getSavedJobDetails))).filter(Boolean);

      try {
        const userSnap = await db.collection("users").doc(seekerId).get();
        const seekerEmail = userSnap.exists ? userSnap.data().email : null;

        if (!seekerEmail) {
          logger.error(`weeklySeekerDigest: مفيش بريد إلكتروني مسجّل للباحث ${seekerId} — تم تجاهله`);
          continue;
        }

        const unsubscribeUrl = `https://us-central1-recruitment-ccbea.cloudfunctions.net/unsubscribeSeekerEmails?uid=${seekerId}`;

        await sendViaResend({
          to: seekerEmail,
          subject: "وظايف جديدة تناسبك الأسبوع ده على الشغل",
          html: buildWeeklyDigestEmailHtml({ newJobs: newJobsForEmail, savedJobs: savedJobsForEmail, unsubscribeUrl }),
          text: buildWeeklyDigestEmailText({ newJobs: newJobsForEmail, savedJobs: savedJobsForEmail, unsubscribeUrl }),
          logPrefix: "weeklySeekerDigest",
        });
        sentCount++;
      } catch (err) {
        // خطأ مع باحث واحد ميوقفش معالجة الباقيين
        logger.error(`weeklySeekerDigest: حصلت مشكلة مع الباحث ${seekerId}`, err);
      }
    }

    logger.info(`weeklySeekerDigest: اتبعت ${sentCount} إيميل من إجمالي ${seekersSnap.size} باحث`);
  }
);

// رابط إلغاء اشتراك من غير تسجيل دخول — بيوقف بس إيميلات الوظائف الأسبوعية، مش أي حاجة تانية
// (زي تحديثات حالة التقديم أو الدعوات)، ومش بيمسح أو يأثر على الحساب نفسه
exports.unsubscribeSeekerEmails = onRequest(async (req, res) => {
  const uid = typeof req.query.uid === "string" ? req.query.uid : null;
  if (!uid) {
    res.status(400).send(unsubscribePageHtml({ success: false, message: "رابط غير صحيح." }));
    return;
  }

  try {
    const db = getFirestore();
    const ref = db.collection("job_seekers").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).send(unsubscribePageHtml({ success: false, message: "الحساب غير موجود." }));
      return;
    }
    await ref.update({ emailNotificationsEnabled: false });
    res.status(200).send(unsubscribePageHtml({ success: true }));
  } catch (err) {
    logger.error(`unsubscribeSeekerEmails: فشل تعطيل الإيميلات للباحث ${uid}`, err);
    res.status(500).send(unsubscribePageHtml({ success: false, message: "حصلت مشكلة، حاول تاني لاحقًا." }));
  }
});

// إشعار فوري داخل الجرس لكل باحث تخصصه بيطابق وظيفة جديدة اتنشرت — نفس منطق المطابقة
// المستخدم في weeklySeekerDigest (تخصص + محافظة لو الباحث محدد واحدة)، بس هنا فوري لحظة
// النشر مش أسبوعي. query واحد بس لكل الباحثين المطابقين للتخصص (مش query منفصل لكل باحث)،
// وbatch write واحد لكل الإشعارات دفعة واحدة.
exports.onNewJobPostMatchSeekers = onDocumentCreated(
  { document: "job_posts/{jobPostId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const job = snap.data();
    const jobPostId = event.params.jobPostId;
    if (job.isActive !== true || !job.specialization) return;

    const db = getFirestore();
    let seekersSnap;
    try {
      seekersSnap = await db.collection("job_seekers").where("specialization", "==", job.specialization).get();
    } catch (err) {
      logger.error(`onNewJobPostMatchSeekers: فشل جلب الباحثين المطابقين لوظيفة ${jobPostId}`, err);
      return;
    }
    if (seekersSnap.empty) return;

    // محافظة الباحث لو محددة لازم تطابق محافظة الوظيفة (زي weeklySeekerDigest بالظبط) —
    // لو الباحث مش محدد محافظة، بيتضمن بغض النظر عن محافظة الوظيفة
    const matchingSeekerIds = seekersSnap.docs
      .filter((d) => {
        const s = d.data();
        return !s.governorate || s.governorate === job.governorate;
      })
      .map((d) => d.id);
    if (matchingSeekerIds.length === 0) return;

    const jobTitle = job.title || "وظيفة";
    const notifications = matchingSeekerIds.map((userId) => ({
      userId,
      type: "matching_job",
      message: `وظيفة جديدة تناسب تخصصك: "${jobTitle}"`,
      link: `/jobs/${jobPostId}`,
    }));

    await createNotificationsBatch(notifications, "onNewJobPostMatchSeekers");
    logger.info(`onNewJobPostMatchSeekers: اتبعت ${notifications.length} إشعار لوظيفة ${jobPostId}`);
  }
);

// onDocumentCreated بيتنفذ مرة واحدة بالظبط لكل مستند job_posts جديد، فمفيش داعي لأي علامة
// "اتبعت قبل كده" زي savedJobExpiryReminders (اللي بتشتغل على جدول متكرر فوق نفس المستندات).
exports.onNewJobPostNotifyAdmins = onDocumentCreated(
  { document: "job_posts/{jobPostId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const job = snap.data();
    const jobPostId = event.params.jobPostId;
    if (job.isActive !== true) return;

    const jobTitle = job.title || "وظيفة";
    const companyName = job.companyName || "شركة غير معلنة";
    const message = `وظيفة جديدة منشورة: "${jobTitle}" من ${companyName}`;

    const notifications = [];
    for (const email of ADMIN_EMAILS) {
      try {
        const adminUser = await getAuth().getUserByEmail(email);
        notifications.push({
          userId: adminUser.uid,
          type: "new_job_post_admin",
          message,
          link: "/admin",
        });
      } catch (err) {
        logger.error(`onNewJobPostNotifyAdmins: فشل جلب حساب الأدمن ${email}`, err);
      }
    }

    await createNotificationsBatch(notifications, "onNewJobPostNotifyAdmins");
    logger.info(`onNewJobPostNotifyAdmins: اتبعت ${notifications.length} إشعار أدمن لوظيفة ${jobPostId}`);
  }
);

// بلاغ زائر عن وظيفة (زرار "🚩 بلغنا" في صفحة تفاصيل الوظيفة) — إيميل تنبيه بسيط للأدمن
// بس دلوقتي، مفيش لوحة مراجعة كاملة لسه. job_reports قاعدتها create-only من العميل
// (مفيش read/update/delete)، فمفيش خطر إن زائر يقرا بلاغات زائرين تانيين.
exports.onNewJobReport = onDocumentCreated(
  { document: "job_reports/{reportId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const report = snap.data();
    const jobTitle = report.jobTitle || "وظيفة";
    const jobLink = `https://www.elshoghl.com/jobs/${report.jobId}`;
    const emailFields = { jobTitle, reason: report.reason || "سبب غير محدد", details: report.details || "", jobLink };

    try {
      // بلاغات الوظايف بتتبعت لمحمد بس (مش كل ADMIN_EMAILS) — طلب صريح، عشان كده إيميل
      // ثابت هنا بدل الثابت المشترك اللي باقي الدوال (زي onNewJobPostNotifyAdmins) بتستخدمه.
      await sendViaResend({
        to: "mohamedzakaria2727@gmail.com",
        subject: `🚩 بلاغ عن وظيفة: ${jobTitle}`,
        html: buildJobReportEmailHtml(emailFields),
        text: buildJobReportEmailText(emailFields),
        logPrefix: "onNewJobReport",
      });
    } catch (err) {
      logger.error("onNewJobReport: حصلت مشكلة غير متوقعة", err);
    }
  }
);

// تذكير يومي لأي وظيفة محفوظة (saved_jobs) باقيلها 3 أيام أو أقل على الإغلاق — مرة واحدة بس
// لكل وظيفة محفوظة (reminderSent على مستند saved_jobs نفسه) عشان ميتكررش كل يوم لنفس الوظيفة
exports.savedJobExpiryReminders = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Africa/Cairo" },
  async () => {
    const db = getFirestore();

    let savedSnap;
    try {
      savedSnap = await db.collection("saved_jobs").get();
    } catch (err) {
      logger.error("savedJobExpiryReminders: فشل جلب saved_jobs", err);
      return;
    }
    if (savedSnap.empty) return;

    const now = Date.now();
    const jobCache = new Map(); // jobPostId -> بيانات الوظيفة أو null

    async function getJob(jobPostId) {
      if (jobCache.has(jobPostId)) return jobCache.get(jobPostId);
      let data = null;
      try {
        const jobSnap = await db.collection("job_posts").doc(jobPostId).get();
        if (jobSnap.exists) data = jobSnap.data();
      } catch (err) {
        logger.error(`savedJobExpiryReminders: فشل جلب job_posts/${jobPostId}`, err);
      }
      jobCache.set(jobPostId, data);
      return data;
    }

    // مطابق تمامًا لحساب "باقي X يوم" المستخدم في لوحة صاحب العمل (CompanyTab.tsx)
    const matches = [];
    for (const docSnap of savedSnap.docs) {
      const data = docSnap.data();
      if (data.reminderSent === true) continue;
      if (!data.jobPostId || !data.seekerId) continue;

      const job = await getJob(data.jobPostId);
      if (!job || job.isActive !== true || !job.expiresAt) continue;

      const daysLeft = Math.ceil((job.expiresAt.toMillis() - now) / 86400000);
      if (daysLeft > 3 || daysLeft < 0) continue;

      matches.push({
        ref: docSnap.ref,
        seekerId: data.seekerId,
        message: `وظيفة محفوظة عندك هتقفل قريبًا: "${job.title || "وظيفة"}"`,
        link: `/jobs/${data.jobPostId}`,
      });
    }

    if (matches.length === 0) {
      logger.info("savedJobExpiryReminders: مفيش وظائف محفوظة قربت تقفل النهاردة");
      return;
    }

    // batch واحد بيعمل الإشعار + يعلّم reminderSent مع بعض، عشان لو الإشعار اتبعت والتعليم
    // فشل (أو العكس) منقعش في حالة نص متسقة — الاتنين بيحصلوا مع بعض أو محدش منهم
    const CHUNK_SIZE = 225; // 225 عنصر × عمليتين (إشعار + تحديث) = 450 عملية لكل batch
    for (let i = 0; i < matches.length; i += CHUNK_SIZE) {
      const chunk = matches.slice(i, i + CHUNK_SIZE);
      try {
        const batch = db.batch();
        chunk.forEach((m) => {
          const notifRef = db.collection("notifications").doc();
          batch.set(notifRef, {
            userId: m.seekerId,
            type: "saved_job_expiring",
            message: m.message,
            link: m.link,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
          batch.update(m.ref, { reminderSent: true });
        });
        await batch.commit();
      } catch (err) {
        logger.error(`savedJobExpiryReminders: فشل batch commit لـ${chunk.length} تذكير`, err);
      }
    }

    logger.info(`savedJobExpiryReminders: اتبعت ${matches.length} تذكير`);
  }
);

// تذكير داخلي (إشعار بس، مفيش إيميل) لصاحب العمل لو عنده تقديمات status=="submitted" فضلت
// من غير أي تغيير حالة 3 أيام أو أكتر. staleReminderSent بيتحط على كل مستند application
// بعد الإرسال عشان مبعتش نفس التذكير كل يوم لنفس التقديم — أول ما الحالة تتغيّر (شوف
// onApplicationStatusChanged) التقديم بيخرج من "submitted" أصلًا فمعادش بيتفحص هنا تاني.
// وقت الجدولة (12 ظهرًا) مختار عشان يفضل متباعد عن باقي التذكيرات اليومية (8، 9، 10، 11).
exports.staleApplicationReminders = onSchedule(
  { schedule: "0 12 * * *", timeZone: "Africa/Cairo" },
  async () => {
    const db = getFirestore();

    let appsSnap;
    try {
      appsSnap = await db.collection("applications").get();
    } catch (err) {
      logger.error("staleApplicationReminders: فشل جلب applications", err);
      return;
    }
    if (appsSnap.empty) return;

    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    // نفس تعريف "submitted" المستخدم في applicationStatusOf (web-next/src/lib/jobCardStyles.ts)
    // — status غير موجود بيتحسب submitted كمان، مش بس القيمة الصريحة.
    const staleDocs = appsSnap.docs.filter((docSnap) => {
      const data = docSnap.data();
      const status = data.status || "submitted";
      if (status !== "submitted") return false;
      if (data.staleReminderSent === true) return false;
      if (!data.appliedAt) return false;
      return now - data.appliedAt.toMillis() >= THREE_DAYS_MS;
    });

    if (staleDocs.length === 0) {
      logger.info("staleApplicationReminders: مفيش تقديمات متأخرة النهاردة");
      return;
    }

    // تجميع حسب employerId — إشعار واحد مجمّع لكل صاحب عمل بدل إشعار منفصل لكل تقديم،
    // حتى لو عنده أكتر من تقديم متأخر في نفس اليوم.
    const byEmployer = new Map();
    staleDocs.forEach((docSnap) => {
      const employerId = docSnap.data().employerId;
      if (!employerId) return;
      if (!byEmployer.has(employerId)) byEmployer.set(employerId, []);
      byEmployer.get(employerId).push(docSnap);
    });

    // كل صاحب عمل = مجموعة عمليات (إشعار واحد + تعليم كل تقديماته المتأخرة) لازم تتنفذ مع
    // بعض في نفس الـbatch، عشان مفيش سيناريو نعلّم staleReminderSent من غير ما الإشعار
    // يتبعت فعليًا (أو العكس). بنقفل الـbatch الحالي ونبدأ واحد جديد لو المجموعة الجاية
    // هتخلي العدد يتخطى حد الـ500 عملية بتاع Firestore لكل batch.
    let batch = db.batch();
    let opsInBatch = 0;
    let notifiedEmployers = 0;

    for (const [employerId, docSnaps] of byEmployer) {
      const opsNeeded = 1 + docSnaps.length;
      if (opsInBatch > 0 && opsInBatch + opsNeeded > 450) {
        try {
          await batch.commit();
        } catch (err) {
          logger.error("staleApplicationReminders: فشل batch commit", err);
        }
        batch = db.batch();
        opsInBatch = 0;
      }

      const count = docSnaps.length;
      const message =
        count === 1
          ? "عندك تقديم لسه محدش راجعه من 3 أيام — يستاهل نظرة"
          : `عندك ${count} تقديمات لسه محدش راجعها من 3 أيام — يستاهلوا نظرة`;

      const notifRef = db.collection("notifications").doc();
      batch.set(notifRef, {
        userId: employerId,
        type: "stale_applications",
        message,
        link: "/employer?tab=company",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      docSnaps.forEach((docSnap) => batch.update(docSnap.ref, { staleReminderSent: true }));

      opsInBatch += opsNeeded;
      notifiedEmployers += 1;
    }

    if (opsInBatch > 0) {
      try {
        await batch.commit();
      } catch (err) {
        logger.error("staleApplicationReminders: فشل batch commit", err);
      }
    }

    logger.info(`staleApplicationReminders: اتبعت ${notifiedEmployers} إشعار مجمّع لـ${staleDocs.length} تقديم متأخر`);
  }
);

// تذكير للأدمن (مش للعميل نفسه خالص) بالباقات المدفوعة اللي قربت تخلص أو خلصت بالفعل —
// تمهيدًا لموضوع فترة اشتراك 3 شهور. planExpiresAt بيتحط يدويًا في Firestore وقت ما نفعّل
// أي عميل (مفيش أي واجهة أو تعديل تاني مرتبط بيه لسه). expiryReminderSent بيتحط بعد
// الإرسال عشان مبعتش نفس التذكير كل يوم لنفس الشركة — مرة واحدة بس لكل عميل، زي
// staleReminderSent/firstJobReminderSent بالظبط.
exports.premiumExpiryReminders = onSchedule(
  { schedule: "0 13 * * *", timeZone: "Africa/Cairo", secrets: [RESEND_API_KEY] },
  async () => {
    const db = getFirestore();

    let premiumSnap;
    try {
      premiumSnap = await db.collection("employers").where("plan", "==", "premium").get();
    } catch (err) {
      logger.error("premiumExpiryReminders: فشل جلب employers بالباقة المدفوعة", err);
      return;
    }
    if (premiumSnap.empty) return;

    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const candidates = [];
    premiumSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.planExpiresAt) return;
      if (data.expiryReminderSent === true) return;
      const daysLeft = Math.ceil((data.planExpiresAt.toMillis() - now) / 86400000);
      // بيشمل السالب (باقة خلصت بالفعل) كمان، مش بس اللي لسه قربت
      if (daysLeft > 7) return;
      candidates.push({ ref: docSnap.ref, companyName: data.companyName || "شركة غير معلنة", daysLeft });
    });

    if (candidates.length === 0) {
      logger.info("premiumExpiryReminders: مفيش باقات مدفوعة قربت تخلص النهاردة");
      return;
    }

    try {
      await sendViaResend({
        to: ADMIN_EMAILS,
        subject: `⏰ ${candidates.length} باقة مدفوعة قربت تخلص أو خلصت`,
        html: buildPremiumExpiryEmailHtml({ employers: candidates }),
        text: buildPremiumExpiryEmailText({ employers: candidates }),
        logPrefix: "premiumExpiryReminders",
      });
    } catch (err) {
      logger.error("premiumExpiryReminders: فشل إرسال الإيميل", err);
      return;
    }

    const batch = db.batch();
    candidates.forEach((c) => batch.update(c.ref, { expiryReminderSent: true }));
    try {
      await batch.commit();
    } catch (err) {
      logger.error("premiumExpiryReminders: فشل batch commit لتعليم expiryReminderSent", err);
    }

    logger.info(`premiumExpiryReminders: اتبعت إيميل واحد للأدمن عن ${candidates.length} باقة مدفوعة`);
  }
);

// إيميل متابعة لمرة واحدة بس للحسابات اللي سجّلت دخول (عندها مستند users) بس ماكملتش التسجيل
// الفعلي (مفيش مستند مطابق بنفس الـuid في job_seekers ولا employers) بعد 3 أيام من تاريخ
// إنشاء الحساب. signupReminderSent بيتحط على مستند users نفسه بعد الإرسال عشان الإيميل
// يتبعت مرة واحدة بس لكل حساب، مش يتكرر يوميًا.
exports.signupCompletionReminders = onSchedule(
  { schedule: "0 10 * * *", timeZone: "Africa/Cairo", secrets: [RESEND_API_KEY] },
  async () => {
    const db = getFirestore();

    let usersSnap, seekersSnap, employersSnap;
    try {
      [usersSnap, seekersSnap, employersSnap] = await Promise.all([
        db.collection("users").get(),
        db.collection("job_seekers").get(),
        db.collection("employers").get(),
      ]);
    } catch (err) {
      logger.error("signupCompletionReminders: فشل جلب users/job_seekers/employers", err);
      return;
    }

    const seekerIds = new Set(seekersSnap.docs.map((d) => d.id));
    const employerIds = new Set(employersSnap.docs.map((d) => d.id));

    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    // مستند users وuid بتاعه هو نفسه اللي بيتخزن بيه مستند job_seekers/employers، فمطابقة
    // الـid مباشرة كفاية لمعرفة هل الحساب أكمل التسجيل الفعلي ولا لسه
    const candidates = usersSnap.docs.filter((docSnap) => {
      const data = docSnap.data();
      if (data.signupReminderSent === true) return false;
      if (!data.createdAt) return false;
      if (now - data.createdAt.toMillis() < THREE_DAYS_MS) return false;
      if (!data.email || !data.userType) return false;
      if (seekerIds.has(docSnap.id) || employerIds.has(docSnap.id)) return false;
      return true;
    });

    if (candidates.length === 0) {
      logger.info("signupCompletionReminders: مفيش حسابات محتاجة تذكير النهاردة");
      return;
    }

    let sentCount = 0;
    for (const docSnap of candidates) {
      const data = docSnap.data();
      const userType = data.userType === "employer" ? "employer" : "job_seeker";
      const ctaLink = userType === "employer" ? "https://www.elshoghl.com/employer" : "https://www.elshoghl.com/seeker";

      try {
        await sendViaResend({
          to: data.email,
          subject: userType === "employer" ? "محتاج مساعدة في نشر أول وظيفة؟" : "محتاج مساعدة تكمّل بروفايلك؟",
          html: buildSignupReminderEmailHtml({ userType, ctaLink }),
          text: buildSignupReminderEmailText({ userType, ctaLink }),
          logPrefix: "signupCompletionReminders",
        });
        await docSnap.ref.update({
          signupReminderSent: true,
          signupReminderSentAt: FieldValue.serverTimestamp(),
        });
        sentCount += 1;
      } catch (err) {
        logger.error(`signupCompletionReminders: حصلت مشكلة مع اليوزر ${docSnap.id}`, err);
      }
    }

    logger.info(`signupCompletionReminders: اتبعت ${sentCount} إيميل تذكير من أصل ${candidates.length} حساب مؤهل`);
  }
);

// حالة مختلفة عن signupCompletionReminders فوق: صاحب عمل كمّل بيانات شركته بالفعل (عنده
// مستند employers/{uid})، بس عدى 3 أيام من إنشاء الحساب ولسه معندوش ولا إعلان وظيفة واحد
// في job_posts. فلاج الإرسال لمرة واحدة هنا محطوط على مستند employers نفسه (firstJobReminderSent)
// مش users، لأن الحالة دي مرتبطة بحالة الشركة (نشرت وظيفة ولا لأ) مش بحالة تسجيل الدخول.
exports.firstJobPostReminders = onSchedule(
  { schedule: "0 11 * * *", timeZone: "Africa/Cairo", secrets: [RESEND_API_KEY] },
  async () => {
    const db = getFirestore();

    let usersSnap, employersSnap, postsSnap;
    try {
      [usersSnap, employersSnap, postsSnap] = await Promise.all([
        db.collection("users").get(),
        db.collection("employers").get(),
        db.collection("job_posts").get(),
      ]);
    } catch (err) {
      logger.error("firstJobPostReminders: فشل جلب users/employers/job_posts", err);
      return;
    }

    // الإيميل نفسه متخزنش في مستند employers — بيتخزن في users/{uid} وقت التسجيل، فبنعملها map
    const emailByUid = new Map(usersSnap.docs.map((d) => [d.id, d.data().email]));
    const employerIdsWithPosts = new Set(postsSnap.docs.map((d) => d.data().employerId));

    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    const candidates = employersSnap.docs.filter((docSnap) => {
      const data = docSnap.data();
      if (data.firstJobReminderSent === true) return false;
      if (!data.createdAt) return false;
      if (now - data.createdAt.toMillis() < THREE_DAYS_MS) return false;
      if (employerIdsWithPosts.has(docSnap.id)) return false;
      if (!emailByUid.get(docSnap.id)) return false;
      return true;
    });

    if (candidates.length === 0) {
      logger.info("firstJobPostReminders: مفيش أصحاب أعمال محتاجين تذكير النهاردة");
      return;
    }

    const ctaLink = "https://www.elshoghl.com/employer?tab=postjob";

    let sentCount = 0;
    for (const docSnap of candidates) {
      const email = emailByUid.get(docSnap.id);
      try {
        await sendViaResend({
          to: email,
          subject: "محتاج مساعدة في نشر أول وظيفة؟",
          html: buildFirstJobReminderEmailHtml({ ctaLink }),
          text: buildFirstJobReminderEmailText({ ctaLink }),
          logPrefix: "firstJobPostReminders",
        });
        await docSnap.ref.update({
          firstJobReminderSent: true,
          firstJobReminderSentAt: FieldValue.serverTimestamp(),
        });
        sentCount += 1;
      } catch (err) {
        logger.error(`firstJobPostReminders: حصلت مشكلة مع صاحب العمل ${docSnap.id}`, err);
      }
    }

    logger.info(`firstJobPostReminders: اتبعت ${sentCount} إيميل تذكير من أصل ${candidates.length} صاحب عمل مؤهل`);
  }
);

// بيتأكد إن رقم التليفون ده مش مرتبط بحساب باحث أو صاحب عمل موجود بالفعل تحت UID تاني —
// بيتنادى من /register قبل ما نبعت كود الـOTP، عشان نمنع حساب مزدوج لو حد اتسجل قبل كده
// بجوجل أو الإيميل وبعدين حاول يسجل تاني بنفس رقم تليفونه (كل طريقة دخول في فايربيز بتعمل
// UID منفصل، فمفيش طريقة نكتشف التضارب ده غير بمطابقة رقم التليفون المخزّن في بروفايل
// الباحث/صاحب العمل). لازم Admin SDK هنا لأن بيانات تواصل صاحب العمل (employers/{uid}/
// private/contact) محمية بقاعدة Firestore بتسمح لصاحب الحساب بس يقراها.
//
// بيتنادى من غير مصادقة (المستخدم لسه ما دخلش بالتليفون خالص وقت الفحص ده)، فبيرجع
// boolean بس من غير أي تفاصيل عن الحساب الموجود، تقليلًا لأي تسريب معلومات.
//
// ملحوظة: أرقام التليفونات في job_seekers وemployers/private/contact اتكتبت يدويًا في
// حقل نص عادي من غير توحيد صيغة، فالمطابقة هنا بتغطي الصيغتين الأكتر شيوعًا (E.164 زي
// +201012345678، والصيغة المحلية زي 01012345678) بس مش أي صيغة تانية (مسافات/شرطات).
// هدف الميزة الحالي منع حسابات مزدوجة جديدة من دلوقتي، مش تنضيف بيانات قديمة.
exports.checkPhoneAlreadyRegistered = onCall(async (request) => {
  const rawPhone = typeof request.data?.phone === "string" ? request.data.phone : "";
  const digits = rawPhone.replace(/[\s-]/g, "");

  const localMatch = digits.match(/^01[0125]\d{8}$/);
  const e164Match = digits.match(/^\+201[0125]\d{8}$/);
  if (!localMatch && !e164Match) {
    throw new HttpsError("invalid-argument", "رقم تليفون غير صحيح");
  }
  const local = localMatch ? digits : "0" + digits.slice(3);
  const e164 = e164Match ? digits : "+20" + digits.slice(1);

  const db = getFirestore();
  try {
    const [seekersSnap, employerContactSnap] = await Promise.all([
      db.collection("job_seekers").where("phone", "in", [local, e164]).limit(1).get(),
      db.collectionGroup("private").where("phone", "in", [local, e164]).limit(1).get(),
    ]);
    return { alreadyRegistered: !seekersSnap.empty || !employerContactSnap.empty };
  } catch (err) {
    logger.error("checkPhoneAlreadyRegistered: فشل فحص تضارب رقم التليفون", err);
    throw new HttpsError("internal", "حصلت مشكلة في التحقق، حاول تاني");
  }
});
