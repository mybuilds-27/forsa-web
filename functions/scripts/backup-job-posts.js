// نسخة احتياطية من job_posts قبل ترحيل بيانات التواصل (الخطوة B): بيقرا كل المستندات بالـadmin SDK ويكتبها
// كاملة (الـid + كل الحقول، والـTimestamps بصيغة ISO) في ملف JSON برّه الريبو. قراءة بس، مفيش أي كتابة في Firestore.
// - مبيكتبش فوق ملف موجود (لو الملف موجود بيقف) عشان نسخة سابقة متضيعش.
// - الناتج: عدد الوظايف ومسار الملف بس، من غير أي قيمة.
//
// التشغيل من Command Prompt (من فولدر functions):
//   set "GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json"
//   node scripts\backup-job-posts.js

const fs = require("fs");
const path = require("path");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldPath, Timestamp, GeoPoint, DocumentReference } = require("firebase-admin/firestore");

const OUT_FILE = "C:\\Users\\Mzakaria\\Documents\\elshoghl-backups\\job_posts-2026-11-15.json";
const PAGE_SIZE = 500;

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
if (fs.existsSync(OUT_FILE)) {
  console.error(`الملف موجود بالفعل، ومش هكتب فوقه: ${OUT_FILE}`);
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

// تحويل قيم Firestore لـJSON: Timestamp → ISO، وGeoPoint وDocumentReference لشكل واضح، والباقي زي ما هو
function toJson(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { path: value.path };
  if (Array.isArray(value)) return value.map(toJson);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJson(v);
    return out;
  }
  return value;
}

async function main() {
  const jobs = [];
  let lastId = null;
  for (;;) {
    let q = db.collection("job_posts").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;
    snap.docs.forEach((d) => jobs.push({ id: d.id, ...toJson(d.data()) }));
    lastId = snap.docs[snap.docs.length - 1].id;
    if (snap.docs.length < PAGE_SIZE) break;
  }
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ projectId, collection: "job_posts", exportedAt: new Date().toISOString(), count: jobs.length, docs: jobs }, null, 2));
  console.log(`عدد الوظايف: ${jobs.length}`);
  console.log(`الملف: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("فشل السكريبت:", err.code || "", err.message || err);
  process.exit(1);
});
