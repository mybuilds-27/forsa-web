import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

// wrappers للـCloud Functions الأربعة في functions/index.js (قسم "إدارة أصحاب الأعمال") —
// محمية للأدمن بس على السيرفر. timeout أطول من الافتراضي (70 ثانية) لأن الحظر والحذف النهائي
// ممكن يمسّوا عدد كبير من المستندات.
const CALLABLE_TIMEOUT_MS = 300_000;

function callable<Req, Res>(name: string) {
  return httpsCallable<Req, Res>(functions, name, { timeout: CALLABLE_TIMEOUT_MS });
}

export type BanResult =
  | { banned: true; jobsDeactivated: number }
  | { banned: false; jobsReactivated: number; jobsSkippedExpired: number };

export async function adminSetEmployerBanned(employerId: string, banned: boolean): Promise<BanResult> {
  const res = await callable<{ employerId: string; banned: boolean }, BanResult>("adminSetEmployerBanned")({ employerId, banned });
  return res.data;
}

export type JobsActiveResult = { active: boolean; changed: number; skippedExpired: number };

export async function adminSetEmployerJobsActive(employerId: string, active: boolean): Promise<JobsActiveResult> {
  const res = await callable<{ employerId: string; active: boolean }, JobsActiveResult>("adminSetEmployerJobsActive")({ employerId, active });
  return res.data;
}

export type PlanResult = { plan: "premium" | "free"; planExpiresAtMillis: number | null };

export async function adminSetEmployerPlan(employerId: string, plan: "premium" | "free", months?: number): Promise<PlanResult> {
  const res = await callable<{ employerId: string; plan: "premium" | "free"; months?: number }, PlanResult>("adminSetEmployerPlan")({ employerId, plan, months });
  return res.data;
}

export type DeleteResult = { deleted: true; counts: Record<string, number> };

export async function adminDeleteEmployer(employerId: string, confirmCompanyName: string): Promise<DeleteResult> {
  const res = await callable<{ employerId: string; confirmCompanyName: string }, DeleteResult>("adminDeleteEmployer")({ employerId, confirmCompanyName });
  return res.data;
}

// رسالة الخطأ اللي بتظهر للأدمن — HttpsError من السيرفر بتوصل هنا بنص عربي جاهز في message.
export function adminActionErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "حصلت مشكلة، حاول تاني";
}
