// ترحيل بيانات تواصل الوظايف الحالية (الخطوة B): بينسخ contactMethod وcontactValue من job_posts/{id}
// لـjob_posts/{id}/private/contact، لأي وظيفة فيها contactValue مش فاضي، مهما كان receiveMethod.
//
// - dry-run هو الافتراضي: بيطبع أعداد بس، ومبيكتبش أي حاجة. الكتابة بـ--apply صريحة بس.
// - المستند العام قراءة بس: مفيش أي حذف أو تعديل فيه (مسح الحقول من العام خطوة D منفصلة).
// - بيكتب بس لو private/contact مش موجود (create، فلو اتكتب في نفس اللحظة الـbatch بيفشل ويتقري من جديد).
//   لو موجود وقيمته مختلفة: مبيكتبش فوقه، وبيتحسب في "مختلف".
// - صفحات بالترتيب حسب الـid، ونقطة الاستكمال في ملف جوه os.tmpdir() — مش في الريبو.
// - الناتج أعداد بس: مفيش قيمة ولا id ولا اسم.
//
// التشغيل من Command Prompt (من فولدر functions):
//   set "GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json"
//   chcp 65001
//   node scripts\migrate-job-contact.js            (dry-run)
//   node scripts\migrate-job-contact.js --apply    (كتابة + تحقق بعدها)
//   node scripts\migrate-job-contact.js --verify   (تحقق بس: ناقص = 0 ومختلف = 0)
//   node scripts\migrate-job-contact.js --apply --restart   (يتجاهل نقطة الاستكمال)

const fs = require("fs");
const os = require("os");
const path = require("path");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldPath } = require("firebase-admin/firestore");

const PAGE_SIZE = 400;
const MAX_PAGE_ATTEMPTS = 3;
// وقت نجاح نشر الخطوة A على Production (ec0e970 اتنشر مع 04402d3): الوظايف اللي اتعملت بعده مفروض private بتاعها موجود
const STEP_A_DEPLOYED_AT = new Date("2026-11-14T09:38:18Z");

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
const checkpointPath = path.join(os.tmpdir(), `job-contact-migration-${projectId}.json`);

const hasValue = (v) => typeof v === "string" && v.trim() !== "";

// حالة وظيفة واحدة: none (مفيش contactValue) | match | missing | differ
function classify(publicData, privateData) {
  if (!hasValue(publicData.contactValue)) return "none";
  if (!privateData) return "missing";
  const same = privateData.contactValue === publicData.contactValue && (privateData.contactMethod || "") === (publicData.contactMethod || "");
  return same ? "match" : "differ";
}

async function readPage(lastId) {
  let q = db.collection("job_posts").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
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

const emptyStats = () => ({ jobs: 0, withValue: 0, withValueContact: 0, withValueOther: 0, match: 0, missing: 0, differ: 0, afterA: 0, afterAContact: 0, afterAContactMatch: 0 });

function count(stats, publicData, privateData) {
  stats.jobs++;
  const state = classify(publicData, privateData);
  const created = publicData.createdAt?.toDate ? publicData.createdAt.toDate() : null;
  if (created && created > STEP_A_DEPLOYED_AT) {
    stats.afterA++;
    if (publicData.receiveMethod === "contact") {
      stats.afterAContact++;
      if (state === "match") stats.afterAContactMatch++;
    }
  }
  if (state === "none") return state;
  stats.withValue++;
  if (publicData.receiveMethod === "contact") stats.withValueContact++;
  else stats.withValueOther++;
  stats[state]++;
  return state;
}

function printStats(stats, title) {
  console.log(title);
  console.log(`  إجمالي الوظايف: ${stats.jobs}`);
  console.log(`  فيها contactValue: ${stats.withValue} (receiveMethod=contact: ${stats.withValueContact} | من غيره: ${stats.withValueOther})`);
  console.log(`  private/contact: موجود ومطابق ${stats.match} | ناقص ${stats.missing} | مختلف ${stats.differ}`);
  console.log(`  اتعملت بعد نشر الخطوة A (${STEP_A_DEPLOYED_AT.toISOString()}): ${stats.afterA} | منها تواصل: ${stats.afterAContact} | منها private مطابق: ${stats.afterAContactMatch}`);
}

// dry-run أو apply: نفس المرور، والفرق إن apply بيعمل create للناقص ويحفظ نقطة الاستكمال
async function migrate() {
  const stats = emptyStats();
  let written = 0;
  let batches = 0;
  let retries = 0;
  let lastId = null;
  if (APPLY && !RESTART) {
    lastId = readCheckpoint();
    if (lastId) console.log(`بيكمّل من نقطة استكمال محفوظة (${checkpointPath}) — الأعداد تحت للوظايف بعدها بس\n`);
  }

  for (;;) {
    let page;
    let pageStats;
    let pageWrites;
    for (let attempt = 1; ; attempt++) {
      page = await readPage(lastId);
      if (page.docs.length === 0) break;
      pageStats = emptyStats();
      pageWrites = 0;
      const batch = db.batch();
      page.docs.forEach((d, i) => {
        const publicData = d.data();
        const privateSnap = page.privates[i];
        const state = count(pageStats, publicData, privateSnap.exists ? privateSnap.data() : null);
        if (APPLY && state === "missing") {
          batch.create(privateSnap.ref, { contactMethod: publicData.contactMethod || "", contactValue: publicData.contactValue });
          pageWrites++;
        }
      });
      if (!APPLY || pageWrites === 0) break;
      try {
        await batch.commit();
        batches++;
        break;
      } catch (err) {
        // 6 = ALREADY_EXISTS: private/contact اتكتب في نفس اللحظة (من PostJobTab) — نقرا الصفحة تاني
        if (err.code !== 6 || attempt >= MAX_PAGE_ATTEMPTS) throw err;
        retries++;
        console.log(`  تعارض مع كتابة في نفس اللحظة — إعادة قراءة الصفحة (محاولة ${attempt + 1})`);
      }
    }
    if (page.docs.length === 0) break;
    for (const k of Object.keys(stats)) stats[k] += pageStats[k];
    if (APPLY) written += pageWrites;
    lastId = page.docs[page.docs.length - 1].id;
    if (APPLY) writeCheckpoint(lastId);
    if (page.docs.length < PAGE_SIZE) break;
  }

  printStats(stats, APPLY ? "قبل الكتابة:" : "dry-run:");
  if (APPLY) console.log(`  اتكتب (create): ${written} | batches: ${batches} | إعادة محاولة بسبب تعارض: ${retries}`);
  else console.log(`  هيتكتب بـ--apply (الناقص بس): ${stats.missing}`);
}

// تحقق: كل وظيفة فيها contactValue لازم private/contact بتاعها موجود ومطابق
async function verify() {
  const stats = emptyStats();
  let lastId = null;
  for (;;) {
    const page = await readPage(lastId);
    if (page.docs.length === 0) break;
    page.docs.forEach((d, i) => count(stats, d.data(), page.privates[i].exists ? page.privates[i].data() : null));
    lastId = page.docs[page.docs.length - 1].id;
    if (page.docs.length < PAGE_SIZE) break;
  }
  printStats(stats, "\nالتحقق:");
  console.log(`  ناقص = 0: ${stats.missing === 0} | مختلف = 0: ${stats.differ === 0}`);
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
