import { auth } from "./firebase";
import { logClientError } from "./errorLog";
import { getConnectionDiagnostics } from "./withGracePeriod";

// تحقق من حالة السيرور الفعلية بعد HARD_FAIL_TIMEOUT (شوف withGracePeriod.ts) — بيتنادى بس في حالة
// الفشل، مفيش قراءة في المسار العادي. بيستخدم REST API بتاع Firestore (مش getDocFromServer/getDocs)
// عن قصد: Firestore SDK بيرجّع للقراءات نتيجة "latency-compensated" فيها الكتابة المعلّقة محليًا
// (اللي هي بالظبط اللي معلّقة)، فالمستند هيبان موجود حتى لو السيرفر ماستلمهوش — REST بيرجّع حالة
// السيرفر الحقيقية من غير أي overlay محلي.
//
// المهلة الكلية لأي تحقق VERIFY_TIMEOUT_MS (التوكن + الطلب مع بعض)، وأي خطأ (شبكة، CORS، 403،
// timeout) بيرجّع false/null = "مش متأكدين" فالمسار الأصلي (رسالة الفشل) هو اللي بيكمّل.
export const VERIFY_TIMEOUT_MS = 8000;

// كل محاولة تحقق ناجحة مبتسجّلش حاجة (hard_timeout_recovered بيسجّلها المستدعي)، لكن أي محاولة رجعت
// "مش مؤكد" بتسجّل سطر واحد hard_timeout_verify_failed بـreason واحدة من:
//   NO_USER | VERIFY_TIMEOUT | REST_<status> | NETWORK  → التحقق نفسه فشل
//   NOT_FOUND | MISMATCH                                  → التحقق اشتغل وقال لأ (طبيعي، مش خطأ)
// عشان نفرّق "التحقق شغال وقال لأ" من "التحقق نفسه مفيش فايدة منه".
function reasonOf(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === "NO_USER" || err.message === "VERIFY_TIMEOUT" || err.message.startsWith("REST_")) return err.message;
    if (err.name === "AbortError") return "VERIFY_TIMEOUT";
  }
  return "NETWORK";
}

function logVerifyOutcome(originalStep: string, reason: string): void {
  void logClientError("hard_timeout_verify_failed", undefined, { originalStep, reason, ...getConnectionDiagnostics() });
}

type RestValue = { stringValue?: string; booleanValue?: boolean; timestampValue?: string };
type RestDocument = { name: string; fields?: Record<string, RestValue> };

function documentsBase(): string {
  return `https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

async function authHeaders(deadline: Promise<never>): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error("NO_USER");
  const token = await Promise.race([user.getIdToken(), deadline]);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// بينفّذ fn بمهلة كلية، ويدّيها signal للـfetch وdeadline للـawait على التوكن.
async function withDeadline<T>(fn: (signal: AbortSignal, deadline: Promise<never>) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("VERIFY_TIMEOUT"));
    }, VERIFY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([fn(controller.signal, deadline), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function restGetDocument(path: string): Promise<RestDocument | null> {
  return withDeadline(async (signal, deadline) => {
    const res = await fetch(`${documentsBase()}/${path}`, { headers: await authHeaders(deadline), signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`REST_${res.status}`);
    return (await res.json()) as RestDocument;
  });
}

function timestampMs(doc: RestDocument, field: string): number | null {
  const iso = doc.fields?.[field]?.timestampValue;
  return iso ? Date.parse(iso) : null;
}

// employers/{uid}: موجود وفيه نفس القيم اللي اتبعتت في الـbatch (حقول الشركة بس — مستند contact
// بيتكتب في نفس الـbatch الذري، فوجود الأول يكفي). القيم لازم تطابق عشان محاولة قديمة ناجحة بقيم
// مختلفة متتحسبش نجاح للمحاولة دي.
export async function verifyEmployerProfileSaved(
  uid: string,
  expected: Record<string, string | boolean | undefined>,
  originalStep: string
): Promise<boolean> {
  try {
    const doc = await restGetDocument(`employers/${uid}`);
    if (!doc) {
      logVerifyOutcome(originalStep, "NOT_FOUND");
      return false;
    }
    const matches = Object.entries(expected).every(([key, value]) => {
      if (value === undefined) return true;
      const field = doc.fields?.[key];
      if (typeof value === "boolean") return field?.booleanValue === value;
      return field?.stringValue === value;
    });
    if (!matches) logVerifyOutcome(originalStep, "MISMATCH");
    return matches;
  } catch (err) {
    logVerifyOutcome(originalStep, reasonOf(err));
    return false;
  }
}

// وظيفة جديدة بنفس employerId والعنوان وcreatedAt بعد (وقت البداية - 60 ثانية): الـ60 ثانية هامش
// لاختلاف ساعة الجهاز عن ساعة السيرفر (createdAt بيتحط بساعة السيرفر). نفس شكل استعلام فحص التكرار
// في PostJobTab.tsx، فنفس الـcomposite index (employerId + title + createdAt). بيرجّع id الوظيفة.
export async function findRecentlyCreatedJobPost(uid: string, title: string, startedAtMs: number): Promise<string | null> {
  try {
    const found = await withDeadline(async (signal, deadline) => {
      const since = new Date(startedAtMs - 60_000).toISOString();
      const res = await fetch(`${documentsBase()}:runQuery`, {
        method: "POST",
        headers: await authHeaders(deadline),
        signal,
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "job_posts" }],
            where: {
              compositeFilter: {
                op: "AND",
                filters: [
                  { fieldFilter: { field: { fieldPath: "employerId" }, op: "EQUAL", value: { stringValue: uid } } },
                  { fieldFilter: { field: { fieldPath: "title" }, op: "EQUAL", value: { stringValue: title } } },
                  { fieldFilter: { field: { fieldPath: "createdAt" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: since } } },
                ],
              },
            },
            limit: 1,
          },
        }),
      });
      if (!res.ok) throw new Error(`REST_${res.status}`);
      const rows = (await res.json()) as Array<{ document?: RestDocument }>;
      const name = rows.find((r) => r.document)?.document?.name;
      return name ? name.split("/").pop() ?? null : null;
    });
    if (!found) logVerifyOutcome("job_post_create", "NOT_FOUND");
    return found;
  } catch (err) {
    logVerifyOutcome("job_post_create", reasonOf(err));
    return null;
  }
}

// تعديل وظيفة: updatedAt (اللي الـupdateDoc بيكتبه) بعد (وقت البداية - 60 ثانية).
export async function verifyJobPostUpdated(postId: string, startedAtMs: number): Promise<boolean> {
  try {
    const doc = await restGetDocument(`job_posts/${postId}`);
    if (!doc) {
      logVerifyOutcome("job_post_update", "NOT_FOUND");
      return false;
    }
    const updatedMs = timestampMs(doc, "updatedAt");
    const fresh = updatedMs !== null && updatedMs >= startedAtMs - 60_000;
    if (!fresh) logVerifyOutcome("job_post_update", "MISMATCH");
    return fresh;
  } catch (err) {
    logVerifyOutcome("job_post_update", reasonOf(err));
    return false;
  }
}
