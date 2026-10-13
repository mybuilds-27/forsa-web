// ترحيل بيانات تواصل الباحثين الحاليين (المرحلة 4 من فصلها عن مستند job_seekers العام): بينسخ
// phone وemail وcvFileURL من job_seekers/{uid} لـjob_seekers/{uid}/private/contact.
//
// - dry-run هو الافتراضي: بيطبع أعداد بس، ومبيكتبش أي حاجة. الكتابة بـ--apply صريحة بس.
// - المستند العام قراءة بس: مفيش أي حذف أو تعديل فيه (مسح الحقول من العام مرحلة لاحقة منفصلة).
// - بيكتب الحقل بس لو قيمته نص مش فاضي في العام، ومش موجود خالص في الفرعي. أي حقل موجود في الفرعي
//   (حتى لو فاضي = الباحث مسحه عمدًا بعد الكتابة المزدوجة في المرحلة 3) بيتساب زي ما هو.
// - الكتابة بشرط: create لو الفرعي مش موجود، وupdate بشرط lastUpdateTime لو موجود — لو الباحث عدّل
//   في نفس اللحظة الـbatch بيفشل، والصفحة بتتقري وتتحسب من جديد (لحد 3 مرات)، فمفيش قيمة قديمة
//   بتتكتب فوق قيمة أحدث.
// - صفحات بالترتيب حسب الـid (PAGE_SIZE مستند = batch واحد بالكتير)، ونقطة الاستكمال (آخر id
//   اتكتبت صفحته بنجاح) في ملف جوه os.tmpdir() — مش في الريبو ولا جنب مفتاح الخدمة.
// - الناتج أعداد بس: مفيش اسم ولا رقم ولا إيميل ولا id.
//
// التشغيل من Command Prompt (من فولدر functions):
//   set "GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json"
//   chcp 65001
//   node scripts\migrate-seeker-contact.js            (dry-run)
//   node scripts\migrate-seeker-contact.js --apply    (كتابة + تحقق بعدها)
//   node scripts\migrate-seeker-contact.js --verify   (تحقق بس)
//   node scripts\migrate-seeker-contact.js --apply --restart   (يتجاهل نقطة الاستكمال)

const fs = require("fs");
const os = require("os");
const path = require("path");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldPath } = require("firebase-admin/firestore");

const FIELDS = ["phone", "email", "cvFileURL"];
const PAGE_SIZE = 400;
const MAX_PAGE_ATTEMPTS = 3;

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const VERIFY_ONLY = args.has("--verify");
const RESTART = args.has("--restart");

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
const checkpointPath = path.join(os.tmpdir(), `seeker-contact-migration-${projectId}.json`);

const hasValue = (v) => typeof v === "string" && v.trim() !== "";

// الحقول اللي محتاجة تتكتب في الفرعي لباحث واحد
function plan(publicData, privateData) {
  const fields = {};
  for (const field of FIELDS) {
    if (hasValue(publicData[field]) && typeof privateData?.[field] !== "string") fields[field] = publicData[field];
  }
  return fields;
}

async function readPage(lastId) {
  let q = db.collection("job_seekers").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
  if (lastId) q = q.startAfter(lastId);
  const snap = await q.get();
  if (snap.empty) return { docs: [], privates: [] };
  const privates = await db.getAll(...snap.docs.map((d) => d.ref.collection("private").doc("contact")));
  return { docs: snap.docs, privates };
}

function readCheckpoint() {
  try {
    return JSON.parse(fs.readFileSync(checkpointPath, "utf8")).lastId || null;
  } catch {
    return null;
  }
}

function writeCheckpoint(lastId) {
  fs.writeFileSync(checkpointPath, JSON.stringify({ projectId, lastId, at: new Date().toISOString() }));
}

// dry-run أو apply: نفس المرور على الصفحات، والفرق إن apply بيكتب ويحفظ نقطة الاستكمال
async function migrate() {
  const stats = {
    seekers: 0,
    withField: { phone: 0, email: 0, cvFileURL: 0 },
    noContact: 0,
    alreadyDone: 0,
    toWrite: 0,
    toWriteByField: { phone: 0, email: 0, cvFileURL: 0 },
    batches: 0,
    retries: 0,
  };

  let lastId = null;
  if (APPLY && !RESTART) {
    lastId = readCheckpoint();
    if (lastId) console.log(`بيكمّل من نقطة استكمال محفوظة (${checkpointPath}) — الأعداد تحت للباحثين بعدها بس\n`);
  }

  for (;;) {
    let page;
    let pageStats;
    for (let attempt = 1; ; attempt++) {
      page = await readPage(lastId);
      if (page.docs.length === 0) break;

      pageStats = { seekers: 0, withField: { phone: 0, email: 0, cvFileURL: 0 }, noContact: 0, alreadyDone: 0, toWrite: 0, toWriteByField: { phone: 0, email: 0, cvFileURL: 0 } };
      const batch = db.batch();
      let writes = 0;
      page.docs.forEach((d, i) => {
        const publicData = d.data();
        const privateSnap = page.privates[i];
        const privateData = privateSnap.exists ? privateSnap.data() : null;
        pageStats.seekers++;
        const present = FIELDS.filter((f) => hasValue(publicData[f]));
        present.forEach((f) => pageStats.withField[f]++);
        if (present.length === 0) {
          pageStats.noContact++;
          return;
        }
        const fields = plan(publicData, privateData);
        const keys = Object.keys(fields);
        if (keys.length === 0) {
          pageStats.alreadyDone++;
          return;
        }
        pageStats.toWrite++;
        keys.forEach((f) => pageStats.toWriteByField[f]++);
        if (APPLY) {
          if (privateSnap.exists) batch.update(privateSnap.ref, fields, { lastUpdateTime: privateSnap.updateTime });
          else batch.create(privateSnap.ref, fields);
          writes++;
        }
      });

      if (!APPLY || writes === 0) break;
      try {
        await batch.commit();
        stats.batches++;
        break;
      } catch (err) {
        // 6 = ALREADY_EXISTS (create)، 9 = FAILED_PRECONDITION (update بشرط lastUpdateTime)
        const conflict = err.code === 6 || err.code === 9;
        if (!conflict || attempt >= MAX_PAGE_ATTEMPTS) throw err;
        stats.retries++;
        console.log(`  تعارض مع تعديل في نفس اللحظة — إعادة قراءة الصفحة (محاولة ${attempt + 1})`);
      }
    }
    if (page.docs.length === 0) break;

    stats.seekers += pageStats.seekers;
    FIELDS.forEach((f) => {
      stats.withField[f] += pageStats.withField[f];
      stats.toWriteByField[f] += pageStats.toWriteByField[f];
    });
    stats.noContact += pageStats.noContact;
    stats.alreadyDone += pageStats.alreadyDone;
    stats.toWrite += pageStats.toWrite;

    lastId = page.docs[page.docs.length - 1].id;
    if (APPLY) writeCheckpoint(lastId);
    if (page.docs.length < PAGE_SIZE) break;
  }

  const verb = APPLY ? "اتكتب" : "هيتكتب";
  console.log(`الباحثين اللي اتراجعوا: ${stats.seekers}`);
  console.log(`  عندهم phone: ${stats.withField.phone} | email: ${stats.withField.email} | cvFileURL: ${stats.withField.cvFileURL}`);
  console.log(`  من غير أي بيانات تواصل: ${stats.noContact}`);
  console.log(`  جاهزين أصلًا (المستند الفرعي فيه كل حقولهم): ${stats.alreadyDone}`);
  console.log(`  ${verb} لهم: ${stats.toWrite} (phone: ${stats.toWriteByField.phone} | email: ${stats.toWriteByField.email} | cvFileURL: ${stats.toWriteByField.cvFileURL})`);
  if (APPLY) console.log(`  batches: ${stats.batches} | إعادة محاولة بسبب تعارض: ${stats.retries}`);
}

// تحقق: كل باحث عنده حقل واحد على الأقل في العام لازم يبقى له مستند فرعي فيه كل حقوله
async function verify() {
  let lastId = null;
  let seekers = 0;
  let expected = 0;
  let actual = 0;
  let privateDocs = 0;
  const differs = { phone: 0, email: 0, cvFileURL: 0 };
  for (;;) {
    const page = await readPage(lastId);
    if (page.docs.length === 0) break;
    page.docs.forEach((d, i) => {
      seekers++;
      const publicData = d.data();
      const privateSnap = page.privates[i];
      const privateData = privateSnap.exists ? privateSnap.data() : null;
      if (privateSnap.exists) privateDocs++;
      const present = FIELDS.filter((f) => hasValue(publicData[f]));
      present.forEach((f) => {
        if (typeof privateData?.[f] === "string" && privateData[f] !== publicData[f]) differs[f]++;
      });
      if (present.length === 0) return;
      expected++;
      if (present.every((f) => typeof privateData?.[f] === "string")) actual++;
    });
    lastId = page.docs[page.docs.length - 1].id;
    if (page.docs.length < PAGE_SIZE) break;
  }
  console.log("\nالتحقق:");
  console.log(`  الباحثين: ${seekers} | مستندات private/contact موجودة: ${privateDocs}`);
  console.log(`  متوقع (عندهم حقل واحد على الأقل): ${expected} | فعلي (المستند الفرعي فيه كل حقولهم): ${actual} | ناقص: ${expected - actual}`);
  console.log(`  قيم مختلفة بين العام والفرعي (طبيعي لو الباحث عدّل/مسح بعد المرحلة 3): phone: ${differs.phone} | email: ${differs.email} | cvFileURL: ${differs.cvFileURL}`);
  if (expected - actual > 0) console.log("  فيه ناقص — شغّل --apply تاني.");
}

async function main() {
  const mode = VERIFY_ONLY ? "تحقق بس" : APPLY ? "APPLY (كتابة فعلية)" : "dry-run (من غير أي كتابة)";
  console.log(`المشروع: ${projectId}`);
  console.log(`الوضع: ${mode}\n`);
  if (RESTART && fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
  if (VERIFY_ONLY) return verify();
  await migrate();
  if (APPLY) {
    await verify();
    if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
  }
}

main().catch((err) => {
  console.error("فشل السكريبت:", err.code || "", err.message || err);
  if (APPLY) console.error(`نقطة الاستكمال محفوظة في ${checkpointPath} — شغّل --apply تاني يكمّل من بعدها.`);
  process.exit(1);
});
