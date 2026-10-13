// مسح بيانات التواصل من مستند job_seekers العام (المرحلة 5ب من فصلها): بيمسح phone وemail وcvFileURL
// من job_seekers/{uid} بعد ما اتنقلوا لـjob_seekers/{uid}/private/contact (المرحلة 4).
//
// - dry-run هو الافتراضي: بيطبع أعداد بس، ومبيكتبش أي حاجة. الكتابة بـ--apply صريحة بس.
// - لكل حقل قيمته نص مش فاضي في العام: بيتمسح بـFieldValue.delete() بس لو نفس القيمة بالظبط (حرفيًا)
//   موجودة في الفرعي. لو الفرعي ناقص الحقل أو قيمته مختلفة، الحقل بيتساب في العام ويتعدّ "محتاج مراجعة".
//   حقل فاضي في العام (أو مش نص) مبيتلمسش.
// - المستند الفرعي قراءة بس، والكتابة على العام بشرط lastUpdateTime — لو الباحث عدّل في نفس اللحظة
//   الـbatch بيفشل، والصفحة بتتقري وتتحسب من جديد (لحد 3 مرات).
// - صفحات بالترتيب حسب الـid (PAGE_SIZE مستند = batch واحد بالكتير). في os.tmpdir() (مش في الريبو
//   ولا جنب مفتاح الخدمة): نقطة الاستكمال (آخر id اتكتبت صفحته)، وسجل بالحقول اللي اتمسحت لكل باحث
//   عشان --verify يتأكد إنها لسه موجودة في الفرعي. السجل فيه uids بس (من غير أي قيم)، ومبيتطبعش.
// - الناتج أعداد بس: مفيش اسم ولا رقم ولا إيميل ولا id.
//
// التشغيل من Command Prompt (من فولدر functions):
//   set "GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json"
//   chcp 65001
//   node scripts\remove-public-seeker-contact.js            (dry-run)
//   node scripts\remove-public-seeker-contact.js --apply    (مسح + تحقق بعده)
//   node scripts\remove-public-seeker-contact.js --verify   (تحقق بس)
//   node scripts\remove-public-seeker-contact.js --apply --restart   (يتجاهل نقطة الاستكمال، وسجل المسح بيفضل)
//   أي وضع + --include-different   (يمسح كمان الحقول اللي قيمتها في الفرعي مختلفة أو فاضية — مش الناقصة)

const fs = require("fs");
const os = require("os");
const path = require("path");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldPath, FieldValue } = require("firebase-admin/firestore");

const FIELDS = ["phone", "email", "cvFileURL"];
const PAGE_SIZE = 400;
const MAX_PAGE_ATTEMPTS = 3;

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const VERIFY_ONLY = args.has("--verify");
const RESTART = args.has("--restart");
// الفرعي هو المصدر الوحيد من 5أ، فقيمة العام المختلفة نسخة قديمة: مع الـflag ده الحقل بيتمسح من العام
// حتى لو قيمة الفرعي مختلفة أو فاضية — بشرط الحقل موجود في الفرعي كنص. الفرعي الناقص الحقل عمره ما بيتمسح.
const INCLUDE_DIFFERENT = args.has("--include-different");

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialsPath) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS مش متظبط — مفيش تشغيل.");
  process.exit(1);
}
let projectId;
try {
  projectId = JSON.parse(fs.readFileSync(credentialsPath, "utf8")).project_id;
} catch (err) {
  console.error("مش قادر أقرا ملف GOOGLE_APPLICATION_CREDENTIALS:", err.message);
  process.exit(1);
}
if (!projectId) {
  console.error("ملف GOOGLE_APPLICATION_CREDENTIALS مفيهوش project_id — مفيش تشغيل.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const checkpointPath = path.join(os.tmpdir(), `seeker-contact-remove-public-${projectId}.json`);
const deletedLogPath = path.join(os.tmpdir(), `seeker-contact-remove-public-${projectId}-deleted.json`);

const hasValue = (v) => typeof v === "string" && v.trim() !== "";
const zeroByField = () => ({ phone: 0, email: 0, cvFileURL: 0 });

async function readPage(lastId) {
  let q = db.collection("job_seekers").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
  if (lastId) q = q.startAfter(lastId);
  const snap = await q.get();
  if (snap.empty) return { docs: [], privates: [] };
  const privates = await db.getAll(...snap.docs.map((d) => d.ref.collection("private").doc("contact")));
  return { docs: snap.docs, privates };
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

// dry-run أو apply: نفس المرور على الصفحات، والفرق إن apply بيمسح ويحفظ نقطة الاستكمال وسجل المسح
async function removePublic() {
  const stats = {
    seekers: 0,
    withPublic: zeroByField(),
    toDelete: zeroByField(),
    seekersToDelete: 0,
    needsReviewMissing: zeroByField(),
    needsReviewDifferent: zeroByField(),
    batches: 0,
    retries: 0,
  };

  let lastId = null;
  // سجل المسح بيتجمّع عبر كل التشغيلات (حتى مع --restart) عشان --verify يغطي كل اللي اتمسح
  const deletedLog = APPLY ? readJson(deletedLogPath, {}) : {};
  if (APPLY && !RESTART) {
    lastId = readJson(checkpointPath, {}).lastId || null;
    if (lastId) console.log(`بيكمّل من نقطة استكمال محفوظة (${checkpointPath}) — الأعداد تحت للباحثين بعدها بس\n`);
  }

  for (;;) {
    let page;
    let pageStats;
    let pageDeleted;
    for (let attempt = 1; ; attempt++) {
      page = await readPage(lastId);
      if (page.docs.length === 0) break;

      pageStats = { seekers: 0, withPublic: zeroByField(), toDelete: zeroByField(), seekersToDelete: 0, needsReviewMissing: zeroByField(), needsReviewDifferent: zeroByField() };
      pageDeleted = {};
      const batch = db.batch();
      let writes = 0;
      page.docs.forEach((d, i) => {
        const publicData = d.data();
        const privateSnap = page.privates[i];
        const privateData = privateSnap.exists ? privateSnap.data() : {};
        pageStats.seekers++;
        const update = {};
        for (const field of FIELDS) {
          if (!hasValue(publicData[field])) continue;
          pageStats.withPublic[field]++;
          if (typeof privateData[field] !== "string") pageStats.needsReviewMissing[field]++;
          else if (privateData[field] !== publicData[field]) {
            pageStats.needsReviewDifferent[field]++;
            if (INCLUDE_DIFFERENT) update[field] = FieldValue.delete();
          } else {
            update[field] = FieldValue.delete();
            pageStats.toDelete[field]++;
          }
        }
        const fields = Object.keys(update);
        if (fields.length === 0) return;
        pageStats.seekersToDelete++;
        if (APPLY) {
          batch.update(d.ref, update, { lastUpdateTime: d.updateTime });
          pageDeleted[d.id] = fields;
          writes++;
        }
      });

      if (!APPLY || writes === 0) break;
      try {
        await batch.commit();
        stats.batches++;
        break;
      } catch (err) {
        // 9 = FAILED_PRECONDITION (المستند العام اتغيّر بعد ما اتقرا)
        if (err.code !== 9 || attempt >= MAX_PAGE_ATTEMPTS) throw err;
        stats.retries++;
        console.log(`  تعارض مع تعديل في نفس اللحظة — إعادة قراءة الصفحة (محاولة ${attempt + 1})`);
      }
    }
    if (page.docs.length === 0) break;

    stats.seekers += pageStats.seekers;
    stats.seekersToDelete += pageStats.seekersToDelete;
    for (const f of FIELDS) {
      stats.withPublic[f] += pageStats.withPublic[f];
      stats.toDelete[f] += pageStats.toDelete[f];
      stats.needsReviewMissing[f] += pageStats.needsReviewMissing[f];
      stats.needsReviewDifferent[f] += pageStats.needsReviewDifferent[f];
    }

    lastId = page.docs[page.docs.length - 1].id;
    if (APPLY) {
      Object.assign(deletedLog, pageDeleted);
      fs.writeFileSync(deletedLogPath, JSON.stringify(deletedLog));
      fs.writeFileSync(checkpointPath, JSON.stringify({ projectId, lastId, at: new Date().toISOString() }));
    }
    if (page.docs.length < PAGE_SIZE) break;
  }

  const fmt = (o) => `phone: ${o.phone} | email: ${o.email} | cvFileURL: ${o.cvFileURL}`;
  const verb = APPLY ? "اتمسح" : "هيتمسح";
  console.log(`الباحثين اللي اتراجعوا: ${stats.seekers}`);
  console.log(`  حقول فيها قيمة في المستند العام: ${fmt(stats.withPublic)}`);
  console.log(`  ${verb} (مطابق حرفيًا للفرعي): ${fmt(stats.toDelete)}${INCLUDE_DIFFERENT ? "" : ` — في ${stats.seekersToDelete} باحث`}`);
  console.log(`  محتاج مراجعة — الفرعي ناقص الحقل (اتساب في العام): ${fmt(stats.needsReviewMissing)}`);
  if (INCLUDE_DIFFERENT) {
    console.log(`  ${verb} كمان بـ--include-different (قيمة الفرعي مختلفة أو فاضية): ${fmt(stats.needsReviewDifferent)}`);
    console.log(`  إجمالي الباحثين اللي ${verb} لهم حقل: ${stats.seekersToDelete}`);
  } else {
    console.log(`  محتاج مراجعة — قيمة الفرعي مختلفة أو فاضية (اتساب في العام): ${fmt(stats.needsReviewDifferent)}`);
    console.log(`  هيتمسح لو استخدمت --include-different: ${fmt(stats.needsReviewDifferent)}`);
  }
  if (APPLY) console.log(`  batches: ${stats.batches} | إعادة محاولة بسبب تعارض: ${stats.retries}`);
}

// تحقق: (1) كام باحث لسه عنده أي حقل من التلاتة في العام، (2) كام باحث اتمسح له حقل من العام
// (حسب سجل المسح) والحقل ده مبقاش موجود في الفرعي
async function verify() {
  const deletedLog = readJson(deletedLogPath, null);
  let lastId = null;
  let seekers = 0;
  let stillPublicSeekers = 0;
  const stillPublic = zeroByField();
  let lostSeekers = 0;
  const lost = zeroByField();
  for (;;) {
    const page = await readPage(lastId);
    if (page.docs.length === 0) break;
    page.docs.forEach((d, i) => {
      seekers++;
      const publicData = d.data();
      const privateSnap = page.privates[i];
      const privateData = privateSnap.exists ? privateSnap.data() : {};
      const present = FIELDS.filter((f) => hasValue(publicData[f]));
      present.forEach((f) => stillPublic[f]++);
      if (present.length > 0) stillPublicSeekers++;
      const deleted = deletedLog?.[d.id] || [];
      const missing = deleted.filter((f) => typeof privateData[f] !== "string");
      missing.forEach((f) => lost[f]++);
      if (missing.length > 0) lostSeekers++;
    });
    lastId = page.docs[page.docs.length - 1].id;
    if (page.docs.length < PAGE_SIZE) break;
  }
  const fmt = (o) => `phone: ${o.phone} | email: ${o.email} | cvFileURL: ${o.cvFileURL}`;
  console.log("\nالتحقق:");
  console.log(`  الباحثين: ${seekers}`);
  console.log(`  لسه عندهم حقل في المستند العام: ${stillPublicSeekers} باحث (${fmt(stillPublic)}) — المتوقع صفر، أو عدد "محتاج مراجعة" لو فيه`);
  if (deletedLog) {
    console.log(`  اتمسح لهم حقل من العام والحقل مش موجود في الفرعي: ${lostSeekers} باحث (${fmt(lost)}) — المتوقع صفر`);
  } else {
    console.log(`  مفيش سجل مسح (${deletedLogPath}) — فحص "فقدوا حقل من الفرعي" اتخطى`);
  }
}

async function main() {
  const mode = VERIFY_ONLY ? "تحقق بس" : APPLY ? "APPLY (مسح فعلي من المستند العام)" : "dry-run (من غير أي كتابة)";
  console.log(`المشروع: ${projectId}`);
  console.log(`الوضع: ${mode}${INCLUDE_DIFFERENT && !VERIFY_ONLY ? " + --include-different" : ""}\n`);
  if (RESTART && fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
  if (VERIFY_ONLY) return verify();
  await removePublic();
  if (APPLY) {
    await verify();
    // نقطة الاستكمال بتتمسح بعد نجاح الكل، وسجل المسح بيفضل عشان --verify بعدين
    if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
  }
}

main().catch((err) => {
  console.error("فشل السكريبت:", err.code || "", err.message || err);
  if (APPLY) console.error(`نقطة الاستكمال محفوظة في ${checkpointPath} — شغّل --apply تاني يكمّل من بعدها.`);
  process.exit(1);
});
