// سكريبت لمرة واحدة (أو دوري لما تحب تحدّث الترتيب): بيحسب عدد مرات استخدام كل كلمة
// مفتاحية فعليًا (من حقل keywords في job_seekers وjob_posts مع بعض) ويخزن النتيجة في
// مستند واحد (stats/keyword_usage، حقل counts) — KeywordsPicker.tsx بيقرأ منه عشان يرتّب
// الكلمات جوه كل فئة بالأكتر استخدامًا أولًا. مفيش composite index مطلوب (قراءة كاملة
// للمجموعتين من غير where/orderBy)، ومفيش Cloud Function جديدة — سكريبت تشغّله يدويًا.
//
// وضع المعاينة هو الافتراضي دايمًا — بيطبع أعلى الكلمات استخدامًا من غير أي كتابة فعلية.
// الكتابة الفعلية لمستند stats/keyword_usage محتاجة فلاج --write صريح.
//
// طريقة التشغيل:
//   cd functions
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
//   node scripts/compute-keyword-usage.js            # معاينة بس — مفيش كتابة
//   node scripts/compute-keyword-usage.js --write    # كتابة فعلية لـstats/keyword_usage

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp({ credential: applicationDefault(), projectId: "recruitment-ccbea" });
const db = getFirestore();

function countKeywords(docs, counts) {
  for (const docSnap of docs) {
    const keywords = docSnap.data().keywords;
    if (!Array.isArray(keywords)) continue;
    for (const k of keywords) {
      if (typeof k !== "string" || !k) continue;
      counts[k] = (counts[k] || 0) + 1;
    }
  }
}

async function main() {
  const isWrite = process.argv.includes("--write");

  const [seekersSnap, jobsSnap] = await Promise.all([
    db.collection("job_seekers").get(),
    db.collection("job_posts").get(),
  ]);

  const counts = {};
  countKeywords(seekersSnap.docs, counts);
  countKeywords(jobsSnap.docs, counts);

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  console.log(`إجمالي job_seekers: ${seekersSnap.size}, إجمالي job_posts: ${jobsSnap.size}`);
  console.log(`عدد الكلمات المفتاحية المستخدمة فعليًا: ${sorted.length}\n`);
  console.log("=== أعلى 30 كلمة استخدامًا ===");
  sorted.slice(0, 30).forEach(([k, c]) => console.log(`${c}\t${k}`));

  if (!isWrite) {
    console.log("\n(معاينة بس — مفيش أي كتابة حصلت. شغّل السكريبت بـ--write للحفظ في stats/keyword_usage.)");
    return;
  }

  await db.collection("stats").doc("keyword_usage").set({ counts, updatedAt: new Date() });
  console.log("\nتم الحفظ في stats/keyword_usage ✓");
}

main().catch((err) => {
  console.error("السكريبت فشل بالكامل:", err);
  process.exit(1);
});
