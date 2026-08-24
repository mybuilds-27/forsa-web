import type { CSSProperties } from "react";

// بعض أصحاب العمل بيلصقوا وصف الوظيفة زي ما هو من ChatGPT، فبيفضل فيه رموز Markdown
// حرفية (##, **نص**, سطور بـ*/-) بدل ما تتحول لتنسيق حقيقي. الدالة دي بتنضف العرض بس
// (النص الخام في Firestore متتغيرش) — وبتحول سطور القوائم لنفس رمز "•" اللي splitBulletItems
// بتفهمه، عشان استخراج النقط يشتغل حتى لو الوصف الأصلي كان بـ*/- بدل •.
export function sanitizeJobDescription(text: string): string {
  if (!text) return text;
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[*-]\s+/gm, "• ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*/g, "");
}

export const jobCardContainerStyle: CSSProperties = {
  border: "1px solid #14213D33",
  borderRadius: 14,
  background: "#fff",
  boxShadow: "0 1px 3px rgba(20,33,61,0.06)",
};

export const tagStyle: CSSProperties = { fontSize: 12, background: "#F0EDE3", padding: "3px 10px", borderRadius: 999 };

export const activePillStyle: CSSProperties = { fontSize: 12, fontWeight: 700, background: "rgba(47,111,78,0.12)", color: "#2F6F4E", padding: "3px 10px", borderRadius: 999 };
export const pausedPillStyle: CSSProperties = { fontSize: 12, fontWeight: 700, background: "#F0EDE3", color: "#4A5568", padding: "3px 10px", borderRadius: 999 };
export const featuredPillStyle: CSSProperties = { fontSize: 12, fontWeight: 700, background: "rgba(232,163,61,0.2)", color: "#8A570D", padding: "3px 10px", borderRadius: 999 };
export const appliedPillStyle: CSSProperties = { fontSize: 12, fontWeight: 700, background: "rgba(47,111,78,0.15)", color: "#2F6F4E", padding: "3px 10px", borderRadius: 999 };
export const applicantBadgeStyle: CSSProperties = { fontSize: 13, fontWeight: 700, background: "#F0EDE3", color: "#14213D", padding: "5px 14px", borderRadius: 999, whiteSpace: "nowrap" };

export const primaryActionStyle: CSSProperties = { padding: "8px 16px", fontSize: 13.5, fontWeight: 700, border: "none", background: "#14213D", color: "#fff", borderRadius: 8, cursor: "pointer" };
export const ghostActionStyle: CSSProperties = { padding: "8px 14px", fontSize: 13, border: "1px solid #14213D33", background: "transparent", color: "#14213D", borderRadius: 8, cursor: "pointer" };
export const toolBtnStyle: CSSProperties = { padding: "7px 12px", fontSize: 13, border: "1px solid #14213D33", background: "#fff", color: "#14213D", borderRadius: 8, cursor: "pointer" };
export const dangerToolBtnStyle: CSSProperties = { ...toolBtnStyle, color: "#B03A14", borderColor: "#B03A1440" };

export const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  remote: "عن بعد",
  freelance: "فريلانس",
};

export type ApplicationStatus = "submitted" | "shortlisted" | "interview" | "accepted" | "rejected";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "تقديم",
  shortlisted: "قيد المراجعة",
  interview: "مقابلة",
  accepted: "قبول",
  rejected: "رفض",
};

export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = ["submitted", "shortlisted", "interview", "accepted", "rejected"];

export const APPLICATION_STATUS_STYLES: Record<ApplicationStatus, CSSProperties> = {
  submitted: { fontSize: 12, fontWeight: 700, background: "#F0EDE3", color: "#4A5568", padding: "3px 10px", borderRadius: 999 },
  shortlisted: { fontSize: 12, fontWeight: 700, background: "rgba(232,163,61,0.2)", color: "#8A570D", padding: "3px 10px", borderRadius: 999 },
  interview: { fontSize: 12, fontWeight: 700, background: "rgba(43,108,176,0.14)", color: "#1D4E8F", padding: "3px 10px", borderRadius: 999 },
  accepted: { fontSize: 12, fontWeight: 700, background: "rgba(47,111,78,0.12)", color: "#2F6F4E", padding: "3px 10px", borderRadius: 999 },
  rejected: { fontSize: 12, fontWeight: 700, background: "rgba(176,58,20,0.12)", color: "#B03A14", padding: "3px 10px", borderRadius: 999 },
};

export function applicationStatusOf(data: { status?: string }): ApplicationStatus {
  return (data.status as ApplicationStatus) || "submitted";
}
