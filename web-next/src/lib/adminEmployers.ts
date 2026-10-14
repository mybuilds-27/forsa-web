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

// مكافآت الإحالة (adminListReferralCandidates وadminGrantReferralReward في functions/index.js)
export type ReferralReferred = {
  employerId: string;
  companyName: string;
  createdAtMillis: number | null;
  referredAtMillis: number | null;
  verified: boolean;
  jobCount: number;
  banned: boolean;
  exists: boolean;
  suspicious: string[];
  qualified: boolean;
  used: boolean;
};

export type ReferralCandidate = {
  referrerId: string;
  companyName: string;
  plan: string;
  planExpiresAtMillis: number | null;
  banned: boolean;
  qualifiedAvailable: number;
  rewardsGranted: number;
  referred: ReferralReferred[];
};

export type ReferralCandidatesResult = { candidates: ReferralCandidate[]; rewardSize: number; rewardMonths: number };

export async function adminListReferralCandidates(): Promise<ReferralCandidatesResult> {
  const res = await callable<Record<string, never>, ReferralCandidatesResult>("adminListReferralCandidates")({});
  return res.data;
}

export type ReferralRewardResult = { status: "granted" | "rejected"; rewardId: string; planExpiresAtMillis: number | null };

export async function adminGrantReferralReward(
  referrerId: string,
  action: "grant" | "reject",
  reason?: string
): Promise<ReferralRewardResult> {
  const res = await callable<{ referrerId: string; action: "grant" | "reject"; reason?: string }, ReferralRewardResult>(
    "adminGrantReferralReward"
  )({ referrerId, action, reason });
  return res.data;
}

// رسالة الخطأ اللي بتظهر للأدمن — HttpsError من السيرفر بتوصل هنا بنص عربي جاهز في message.
export function adminActionErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "حصلت مشكلة، حاول تاني";
}
