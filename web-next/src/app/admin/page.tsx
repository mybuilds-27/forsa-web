"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  limit,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import ShareButton from "@/components/ShareButton";
import PostJobTab from "../employer/PostJobTab";
import Link from "next/link";
import { toggleJobActive, toggleJobFeatured, deleteJobPost, fetchApplicants, exportApplicantsExcel } from "@/lib/jobPostActions";
import { calculateMatchPercent } from "@/lib/applicantMatch";
import { exportAllUsersExcel } from "@/lib/adminExports";
import { EXPERIENCE_LEVELS, slugify } from "@/lib/constants";
import { CONTACT_METHOD_LABELS, contactApplyText } from "@/lib/contactMethodLabels";
import { getActiveJobsSeoData, type JobCombo } from "@/lib/publicJobsQuery";
import ApplicantCard from "@/components/ApplicantCard";
import ContactRevealViewers from "@/components/ContactRevealViewers";
import { fetchContactRevealViewerCount } from "@/lib/contactReveal";
import BrowseByCombos from "@/components/BrowseByCombos";
import {
  jobCardContainerStyle,
  tagStyle,
  activePillStyle,
  pausedPillStyle,
  featuredPillStyle,
  applicantBadgeStyle,
  primaryActionStyle,
  ghostActionStyle,
  toolBtnStyle,
  dangerToolBtnStyle,
  JOB_TYPE_LABELS,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_ORDER,
  applicationStatusOf,
  type ApplicationStatus,
} from "@/lib/jobCardStyles";

const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

// نفس الشكل بالظبط المستخدم في PostJobTab.tsx/ApplicantCard.tsx/ScreeningQuestionsModal.tsx —
// مخزّن كـscreeningQuestions على مستند job_posts نفسه (مش جوه إجابات المتقدمين).
type ScreeningQuestion = { id: string; text: string; type: "text" | "number"; required: boolean };

// حجم دفعة "كل الإعلانات المنشورة على الموقع" — نفس الرقم مستخدم في in query لـjob_views/
// applications تحت (حد الـin في Firestore بيسمح بأكتر بكتير، بس مفيش داعي نتخطى حجم الصفحة نفسها)
const POSTS_PAGE_SIZE = 10;

type EditingPost = { id: string; data: any } | null;

function formatDate(ts: any) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ar-EG");
}

// تاريخ ووقت مع بعض (مش تاريخ بس زي formatDate) — مستخدمة في تفاصيل حالات أخطاء التسجيل
// القابلة للتوسيع تحت، عشان الأدمن يقدر يميّز بين حالتين في نفس اليوم.
function formatDateTime(ts: Timestamp | undefined): string {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

// أكتر قيمة تكررت في مصفوفة (code أو message)، وعدد تكرارها — null بيتحسب كقيمة لوحدها
// (يعني "مفيش قيمة مسجلة")، فلو ده الأكتر تكرارًا، القيمة الراجعة بتبقى null.
function mostFrequentValue(values: (string | null)[]): { value: string | null; count: number } {
  const counts = new Map<string | null, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));

  let value: string | null = null;
  let count = 0;
  counts.forEach((c, v) => {
    if (c > count) {
      value = v;
      count = c;
    }
  });

  return { value, count };
}

// أعلى عدد حالات فردية بنعرضها في تفاصيل الكارت القابلة للتوسيع — كفاية عمليًا لمراجعة آخر
// حالات، ومحتاجة حد أقصى عشان لو فيه سبيك حالات كتير الكارت ميتكسرش بقايمة طويلة أوي.
const MAX_AUTH_ERROR_ENTRIES = 20;

// مفتاح يوم محلي (مش UTC) بصيغة YYYY-MM-DD — نفس نمط localDateKey في employerStats.ts.
function authErrorDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// بيوزّع كل مستندات الـstep (مش بس أول MAX_AUTH_ERROR_ENTRIES المعروضين في entries) على آخر
// 7 أيام بتاريخ محلي، عشان يبان فين تركّزت الزيادة فعليًا لو حصلت. أيام من غير أي حالة بتظهر
// بصفر (مش بتتشال) عشان يبان الفرق بين يوم هادي ويوم فيه تركّز واضح.
function computeDailyErrorCounts(stepDocs: QueryDocumentSnapshot[], days = 7): { date: string; label: string; count: number }[] {
  const buckets = new Map<string, number>();
  const order: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = authErrorDateKey(d);
    buckets.set(key, 0);
    order.push(key);
  }
  for (const doc of stepDocs) {
    const ts = doc.data().createdAt;
    if (!ts?.toDate) continue;
    const key = authErrorDateKey(ts.toDate());
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return order.map((key) => {
    const [, m, day] = key.split("-");
    return { date: key, label: `${day}/${m}`, count: buckets.get(key) || 0 };
  });
}

// نفس الـregex المستخدم في isInAppWebView() جوه RegisterForm.tsx (مكرر هنا بدل import مشترك،
// زي نمط تكرار ADMIN_EMAILS في أكتر من ملف في المشروع ده) — بيكتشف لو userAgent المسجّل جاي
// من متصفح فيسبوك/إنستجرام المدمج (WebView)، اللي معروف إن reCAPTCHA بتفشل فيه بشكل شائع
// (شوف تعليق phoneAuthErrorMessage في RegisterForm.tsx).
const WEBVIEW_USER_AGENT_PATTERN = /FBAN|FBAV|Instagram/i;

// null لو مفيش حالات خالص (مفيش نسبة تتحسب) — بيحسب من كل مستندات الـstep (مش بس أول
// MAX_AUTH_ERROR_ENTRIES)، من نفس الـdocs المجلوبة أصلًا، بدون أي قراءة إضافية.
function computeWebViewFailurePercent(stepDocs: QueryDocumentSnapshot[]): number | null {
  if (stepDocs.length === 0) return null;
  const webViewCount = stepDocs.filter((d) => WEBVIEW_USER_AGENT_PATTERN.test(d.data().userAgent || "")).length;
  return Math.round((webViewCount / stepDocs.length) * 100);
}

// نسبة الحالات اللي عندها code فايربيز رسمي مسجّل (مش null) — بيفرّق بين "خطأ Firebase Auth
// معروف بكود قياسي" و"استثناء JS خام (زي reCAPTCHA) من غير كود مخصص" من غير ما نضطر نفتح كل
// حالة لوحدها.
function computeCodePresentPercent(stepDocs: QueryDocumentSnapshot[]): number | null {
  if (stepDocs.length === 0) return null;
  const withCode = stepDocs.filter((d) => !!d.data().code).length;
  return Math.round((withCode / stepDocs.length) * 100);
}

// أعلى (code + message) مختلفين تكرارًا (مش بس الأكتر واحد زي topErrorCode/topErrorMessage) —
// عشان نتأكد الـcount الكلي مش خليط رسائل مختلفة مقنّع في رقم واحد. مجمّعة سوا (مش كل واحد
// لوحده) لأن نفس الـcode ممكن يترافق مع أكتر من رسالة، والعكس.
type ErrorVariant = { code: string | null; message: string | null; count: number };
function topErrorVariants(stepDocs: QueryDocumentSnapshot[], topN = 3): ErrorVariant[] {
  const counts = new Map<string, ErrorVariant>();
  for (const doc of stepDocs) {
    const code: string | null = doc.data().code ?? null;
    const message: string | null = doc.data().message ?? null;
    const key = `${code ?? ""}|${message ?? ""}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { code, message, count: 1 });
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// تصنيف مبسّط لمتصفح/نظام userAgent — مش parser شامل، بس كافي لتمييز الفئات الكبيرة المهمة
// هنا (خصوصًا Safari/iOS اللي بيفعّل "Prevent Cross-Site Tracking" افتراضيًا وده سبب موثّق
// لمشاكل reCAPTCHA/Firebase Phone Auth). الترتيب مهم: لازم نفحص العلامات الأكتر تحديدًا
// (CriOS/FxiOS/SamsungBrowser) قبل العلامات العامة (Safari/Chrome)، لأن متصفحات تانية بتحط
// "Safari" في الـuserAgent بتاعها كمان (زي كروم على iOS).
function classifyBrowser(userAgent: string): string {
  if (!userAgent) return "غير معروف";
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  if (/SamsungBrowser/i.test(userAgent)) return "Samsung Internet";
  if (/CriOS/i.test(userAgent)) return "Chrome / iOS";
  if (/FxiOS/i.test(userAgent)) return "Firefox / iOS";
  if (/EdgiOS|Edge|EdgA/i.test(userAgent)) return "Edge";
  if (/OPR|Opera/i.test(userAgent)) return "Opera";
  if (/Firefox/i.test(userAgent)) return "Firefox";
  if (/Chrome/i.test(userAgent)) return isAndroid ? "Chrome / Android" : "Chrome";
  if (/Safari/i.test(userAgent) && isIOS) return "Safari / iOS";
  if (/Safari/i.test(userAgent)) return "Safari";
  return "تاني";
}

type BrowserBreakdownEntry = { label: string; count: number };
function computeBrowserBreakdown(stepDocs: QueryDocumentSnapshot[], topN = 4): BrowserBreakdownEntry[] {
  const counts = new Map<string, number>();
  for (const doc of stepDocs) {
    const label = classifyBrowser(doc.data().userAgent || "");
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// نسبة الحالات اللي حصلت على /register مباشرة، مقابل أي مسار تاني (يعني جوه مودال — مودال
// التقديم على وظيفة، مودال حفظ وظيفة، أو زرار كشف وسيلة التواصل) — عشان نعرف هل المشكلة
// متركّزة في مسار تسجيل واحد بعينه. page بيتسجّل بالفعل مع كل خطأ (window.location.pathname
// وقت حدوثه)، فمفيش أي قراءة إضافية مطلوبة.
function computeRegisterPagePercent(stepDocs: QueryDocumentSnapshot[]): number | null {
  if (stepDocs.length === 0) return null;
  const onRegisterPage = stepDocs.filter((d) => (d.data().page ?? "") === "/register").length;
  return Math.round((onRegisterPage / stepDocs.length) * 100);
}

// اكتشفنا إن حالات step واحد ممكن تكون فعليًا خليط نوعين مختلفين تمامًا من الأخطاء (زي
// phone_send_code: 67% "reCAPTCHA already rendered" من غير code، و33% auth/error-code:-39 -
// حظر Firebase لمنطقة/شبكة اتصال، سبب مختلف تمامًا) — فحساب WebView/المتصفح/الصفحة على
// الـstep كله مع بعض كان بيخلط بين مشكلتين مختلفتين في رقم واحد مضلل. بنقسّم كل الـstepDocs
// لمجموعتين (عندها code فايربيز رسمي / من غيره) ونحسب نفس التفاصيل لكل مجموعة لوحدها.
type ErrorGroupBreakdown = {
  count: number;
  webViewFailurePercent: number | null;
  browserBreakdown: BrowserBreakdownEntry[];
  registerPagePercent: number | null;
};
function computeErrorGroupBreakdown(groupDocs: QueryDocumentSnapshot[]): ErrorGroupBreakdown {
  return {
    count: groupDocs.length,
    webViewFailurePercent: computeWebViewFailurePercent(groupDocs),
    browserBreakdown: computeBrowserBreakdown(groupDocs),
    registerPagePercent: computeRegisterPagePercent(groupDocs),
  };
}

// بيحسب عدد مستندات error_logs بـstep معيّن، وأكتر code تكرر بينهم، وأكتر message تكرر
// كـfallback لو مفيش code مسجل خالص، وكمان قايمة بآخر الحالات الفردية (تاريخ/وقت + الصفحة
// + الكود بتاع كل حالة) للتفاصيل القابلة للتوسيع، وتوزيع يومي لآخر 7 أيام، وأعلى الرسائل/
// الأكواد تنوعًا، ونسبة وجود code، وتفصيل WebView/المتصفح/الصفحة مقسّم بين مجموعة "عندها
// code" ومجموعة "من غيره" (بدل رقم واحد مخلوط) — كله من غير أي استعلام إضافي (نفس الـdocs
// المجلوبة أصلًا من loadAuthErrorStats).
function computeAuthErrorDetail(docs: any[], step: string): AuthErrorDetail {
  const stepDocs = docs.filter((d) => d.data().step === step);
  const topCode = mostFrequentValue(stepDocs.map((d) => d.data().code ?? null));
  const topMessage = mostFrequentValue(stepDocs.map((d) => d.data().message ?? null));

  const entries = stepDocs
    .map((d) => ({ id: d.id, createdAt: d.data().createdAt, page: d.data().page ?? null, code: d.data().code ?? null }))
    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
    .slice(0, MAX_AUTH_ERROR_ENTRIES);

  const withCodeDocs = stepDocs.filter((d) => !!d.data().code);
  const withoutCodeDocs = stepDocs.filter((d) => !d.data().code);

  return {
    count: stepDocs.length,
    topErrorCode: topCode.value,
    topErrorCodeCount: topCode.count,
    topErrorMessage: topMessage.value,
    entries,
    dailyCounts: computeDailyErrorCounts(stepDocs),
    codePresentPercent: computeCodePresentPercent(stepDocs),
    topVariants: topErrorVariants(stepDocs),
    codeGroupBreakdown: computeErrorGroupBreakdown(withCodeDocs),
    noCodeGroupBreakdown: computeErrorGroupBreakdown(withoutCodeDocs),
  };
}

const ERROR_SUBTITLE_MAX_LENGTH = 60;

// نص السطر الصغير تحت كل رقم في بطاقة أخطاء التسجيل — undefined (مفيش سطر خالص) لو الـstep
// ده معندهوش أي أخطاء أصلًا، عشان ميظهرش "كود مش متسجل" تحت رقم صفر بشكل مضلل. لو مفيش code
// مسجل، بنرجع لأكتر message تكرر بدل النص الثابت — وبنقصّها لو طويلة عشان متكسرش شكل الكارت.
function authErrorSubtitle(detail: AuthErrorDetail): string | undefined {
  if (detail.count === 0) return undefined;
  if (detail.topErrorCode) return `${detail.topErrorCode} (${detail.topErrorCodeCount} مرة)`;
  if (detail.topErrorMessage) {
    return detail.topErrorMessage.length > ERROR_SUBTITLE_MAX_LENGTH
      ? `${detail.topErrorMessage.slice(0, ERROR_SUBTITLE_MAX_LENGTH)}...`
      : detail.topErrorMessage;
  }
  return "(كود الخطأ مش متسجل)";
}

type Stats = {
  seekers: number;
  employers: number;
  premium: number;
  visibleCompanies: number;
  allPosts: number;
  activePosts: number;
  applications: number;
  totalUsers: number;
  activeUsers24h: number;
  // تفصيل لنفس الرقم أعلاه: "جديد" يعني اتسجل وقعّل نشط في نفس الجلسة تقريبًا (مش عائد
  // فعليًا)، و"عائد" يعني حساب قديم رجع يستخدم الموقع. شوف الحساب في loadCoreStats.
  activeUsers24hNew: number;
  activeUsers24hReturning: number;
  appInstalls: number;
  pushEnabledUsers: number;
  // تقسيم totalUsers بالطريقة المستنتجة (شوف inferSignupMethod) — مجموعهم = totalUsers بالظبط.
  signupMethodInferred: Record<InferredSignupMethod, number>;
};

type FunnelStats = {
  roleSelected: number;
  methodSelected: number;
  // تقسيم methodSelected بالطريقة (تليفون/جوجل/إيميل) لنفس فترة الـ7 أيام بالظبط — من نفس
  // funnelEventsSnap المجلوب أصلًا في loadFunnelStats، بدون أي استعلام إضافي. بيدّي المقام
  // الصح لحساب نسبة فشل reCAPTCHA (بدل signupMethodStats اللي بيحسب كل الوقت من غير فلتر
  // تاريخ، فمش قابل للمقارنة بعدد أخطاء الـ7-أيام).
  methodSelectedByMethod: { phone: number; google: number; email: number };
  completed: number;
};

type SignupMethodStats = {
  phone: number;
  google: number;
  email: number;
};

// طريقة التسجيل الفعلية بالتقريب لكل مستند users — مستند users مابيخزنش الطريقة صراحةً (شوف
// routeAfterAuth في RegisterForm.tsx)، فبنستنتجها من الحقول المتاحة: phoneNumber (أو إيميل وهمي
// @elshoghl.internal اللي بيتربط بحسابات التليفون) = تليفون، requiresEmailVerification (بيتحط بس
// وقت تسجيل جديد بإيميل/باسورد) = إيميل، displayName من غير الاتنين = جوجل (تسجيل الإيميل مابيحطش
// اسم)، وأي حاجة تانية فيها إيميل = إيميل (حسابات قديمة). "unknown" لو مفيش أي مؤشر. استنتاج
// تقريبي مش مضمون — شوف سكريبت functions/scripts/verify-signup-method-inference.js للمقارنة بالفعلي.
type InferredSignupMethod = "phone" | "google" | "email" | "unknown";
type SignupMethodUserFields = {
  phoneNumber?: unknown;
  email?: unknown;
  displayName?: unknown;
  requiresEmailVerification?: unknown;
};
function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}
function inferSignupMethod(u: SignupMethodUserFields): InferredSignupMethod {
  if (nonEmptyString(u.phoneNumber) || (nonEmptyString(u.email) && u.email.endsWith("@elshoghl.internal"))) return "phone";
  if (u.requiresEmailVerification === true) return "email";
  if (nonEmptyString(u.displayName)) return "google";
  if (nonEmptyString(u.email)) return "email";
  return "unknown";
}

// count إجمالي الأخطاء المسجّلة للـstep ده، وtopErrorCode/topErrorCodeCount أكتر code
// (زي auth/quota-exceeded) تكرر بينهم — null لو كل المستندات معندهاش code مسجل خالص.
type AuthErrorEntry = { id: string; createdAt: Timestamp | undefined; page: string | null; code: string | null };

type AuthErrorDetail = {
  count: number;
  topErrorCode: string | null;
  topErrorCodeCount: number;
  topErrorMessage: string | null;
  entries: AuthErrorEntry[];
  dailyCounts: { date: string; label: string; count: number }[];
  codePresentPercent: number | null;
  topVariants: ErrorVariant[];
  codeGroupBreakdown: ErrorGroupBreakdown;
  noCodeGroupBreakdown: ErrorGroupBreakdown;
};

type AuthErrorStats = {
  phone_send_code: AuthErrorDetail;
  phone_verify_code: AuthErrorDetail;
  google_popup_signin: AuthErrorDetail;
  google_redirect_signin: AuthErrorDetail;
  // مش أخطاء تسجيل فعليًا، بس بتتحسب من نفس error_logs المجلوبة أصلًا هنا (بدون استعلام
  // إضافي) — بتتعرض في قسم منفصل "أخطاء نشر الوظائف" تحت (شوف job_post_create/
  // job_post_update في PostJobTab.tsx، اللي كانت بتفشل من غير أي تسجيل خالص قبل كده).
  job_post_create: AuthErrorDetail;
  job_post_update: AuthErrorDetail;
  // نفس فكرة job_post_create/update بالظبط، بس لحفظ بيانات الشركة (EmployerOnboardingForm.tsx)
  // — كانت بتفشل من غير try/catch ولا timeout ولا أي تسجيل خالص قبل كده، شوف lib/withGracePeriod.ts.
  employer_profile_create: AuthErrorDetail;
  employer_profile_update: AuthErrorDetail;
};

// reviewed مش موجود في المستندات القديمة خالص (لسه محدش راجعها) — undefined بيتعامل معاه
// زي false في كل مكان هنا، مش حقل لازم يتحط وقت الإنشاء في ReportJobButton.tsx.
type JobReport = {
  id: string;
  jobId: string;
  employerId: string;
  jobTitle: string;
  reason: string;
  details?: string;
  reporterId: string | null;
  createdAt: any;
  reviewed?: boolean;
};

type ApplicationStatusStats = Record<ApplicationStatus, number>;

export default function AdminPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "allowed">("loading");
  const [stats, setStats] = useState<Stats | null>(null);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [funnelError, setFunnelError] = useState(false);
  const [signupMethodStats, setSignupMethodStats] = useState<SignupMethodStats | null>(null);
  const [signupMethodError, setSignupMethodError] = useState(false);
  const [authErrorStats, setAuthErrorStats] = useState<AuthErrorStats | null>(null);
  const [authErrorStatsError, setAuthErrorStatsError] = useState(false);
  const [jobReports, setJobReports] = useState<JobReport[] | null>(null);
  const [jobReportsError, setJobReportsError] = useState(false);
  const [reviewingReportId, setReviewingReportId] = useState<string | null>(null);
  const [applicationStatusStats, setApplicationStatusStats] = useState<ApplicationStatusStats | null>(null);
  const [applicationStatusStatsError, setApplicationStatusStatsError] = useState(false);
  const [staleSubmittedCount, setStaleSubmittedCount] = useState(0);
  const [visits30d, setVisits30d] = useState<number | null>(null);
  const [visitsError, setVisitsError] = useState(false);
  const [jobViewCounts, setJobViewCounts] = useState<Record<string, number> | null>(null);
  // عدد اللي شافوا وسيلة التواصل (job_contact_views) لوظايف التواصل المباشر بس. مفتاح ناقص =
  // مش معروف (لسه بيتحمّل أو فشل جلبه)، مش صفر.
  const [contactViewerCounts, setContactViewerCounts] = useState<Record<string, number>>({});
  const [posts, setPosts] = useState<any[]>([]);
  const [lastVisiblePost, setLastVisiblePost] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [seoData, setSeoData] = useState<{ governorates: string[]; specializations: string[]; combos: JobCombo[] } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [editingPost, setEditingPost] = useState<EditingPost>(null);
  const [openApplicantsFor, setOpenApplicantsFor] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [exportingUsers, setExportingUsers] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
        setStatus("denied");
        return;
      }
      setStatus("allowed");
      loadStats();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // قمع التسجيل معزول في تحميله الخاص، منفصل تمامًا عن باقي الإحصائيات — لو فشل (زي مشكلة
  // صلاحيات Firestore على المجموعة الجديدة registration_funnel_events)، القسم ده بس بيعرض
  // رسالة خطأ بدل ما يوقف باقي لوحة الأدمن كلها (الإحصائيات الأساسية وقائمة الوظائف). ده
  // حصل فعليًا لما Promise.all واحد كان بيجمع كل الاستعلامات مع بعض — فشل استعلام واحد كان
  // كافي يمنع أي حاجة من الظهور خالص من غير أي رسالة توضح السبب.
  async function loadFunnelStats() {
    try {
      const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const [recentUsersSnap, funnelEventsSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("createdAt", ">=", sevenDaysAgo))),
        getDocs(query(collection(db, "registration_funnel_events"), where("timestamp", ">=", sevenDaysAgo))),
      ]);

      // "أكمل التسجيل" مش ليها حدث قمع منفصل — بتتحسب مباشرة من users بنفس فترة الـ7 أيام
      // اللي بيتحسب فيها باقي القمع، عشان النسب تكون متسقة.
      const methodSelectedDocs = funnelEventsSnap.docs.filter((d) => d.data().step === "method_selected");
      setFunnelStats({
        roleSelected: funnelEventsSnap.docs.filter((d) => d.data().step === "role_selected").length,
        methodSelected: methodSelectedDocs.length,
        methodSelectedByMethod: {
          phone: methodSelectedDocs.filter((d) => d.data().method === "phone").length,
          google: methodSelectedDocs.filter((d) => d.data().method === "google").length,
          email: methodSelectedDocs.filter((d) => d.data().method === "email").length,
        },
        completed: recentUsersSnap.size,
      });
      setFunnelError(false);
    } catch (err) {
      console.error("Admin funnel stats failed", err);
      setFunnelStats(null);
      setFunnelError(true);
    }
  }

  // معزول تمامًا زي loadFunnelStats (وبنفس نمط try/catch)، بس من غير فلتر تاريخ — إجمالي
  // طرق التسجيل من أول ما بدأ التتبّع، مش آخر 7 أيام بس. نفس الفلترة بعد الجلب (client-side)
  // زي باقي استخدامات step في loadFunnelStats بالظبط.
  async function loadSignupMethodStats() {
    try {
      const snap = await getDocs(query(collection(db, "registration_funnel_events"), where("step", "==", "method_selected")));
      setSignupMethodStats({
        phone: snap.docs.filter((d) => d.data().method === "phone").length,
        google: snap.docs.filter((d) => d.data().method === "google").length,
        email: snap.docs.filter((d) => d.data().method === "email").length,
      });
      setSignupMethodError(false);
    } catch (err) {
      console.error("Admin signup method stats failed", err);
      setSignupMethodStats(null);
      setSignupMethodError(true);
    }
  }

  // معزول تمامًا زي باقي الأقسام — بيستخدم logClientError الموجود بالفعل (RegisterForm.tsx)
  // عشان يشخّص سبب الانسحاب بين "اختار طريقة تسجيل" و"أكمل التسجيل" في قمع التسجيل. نفس
  // فترة الـ7 أيام بالظبط عشان المقارنة بينهم تبقى منطقية.
  async function loadAuthErrorStats() {
    try {
      const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const snap = await getDocs(query(collection(db, "error_logs"), where("createdAt", ">=", sevenDaysAgo)));
      setAuthErrorStats({
        phone_send_code: computeAuthErrorDetail(snap.docs, "phone_send_code"),
        phone_verify_code: computeAuthErrorDetail(snap.docs, "phone_verify_code"),
        google_popup_signin: computeAuthErrorDetail(snap.docs, "google_popup_signin"),
        google_redirect_signin: computeAuthErrorDetail(snap.docs, "google_redirect_signin"),
        job_post_create: computeAuthErrorDetail(snap.docs, "job_post_create"),
        job_post_update: computeAuthErrorDetail(snap.docs, "job_post_update"),
        employer_profile_create: computeAuthErrorDetail(snap.docs, "employer_profile_create"),
        employer_profile_update: computeAuthErrorDetail(snap.docs, "employer_profile_update"),
      });
      setAuthErrorStatsError(false);
    } catch (err) {
      console.error("Admin auth error stats failed", err);
      setAuthErrorStats(null);
      setAuthErrorStatsError(true);
    }
  }

  // معزول بنفس منطق باقي الأقسام — آخر 50 بلاغ بس (حد أقصى معقول)، الأحدث أول.
  async function loadJobReports() {
    try {
      const snap = await getDocs(query(collection(db, "job_reports"), orderBy("createdAt", "desc"), limit(50)));
      setJobReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobReport)));
      setJobReportsError(false);
    } catch (err) {
      console.error("Admin job reports failed", err);
      setJobReports(null);
      setJobReportsError(true);
    }
  }

  async function handleMarkReviewed(reportId: string) {
    setReviewingReportId(reportId);
    try {
      await updateDoc(doc(db, "job_reports", reportId), { reviewed: true });
      setJobReports((prev) => (prev ? prev.map((r) => (r.id === reportId ? { ...r, reviewed: true } : r)) : prev));
    } catch (err) {
      console.error("Mark report reviewed failed", err);
      alert("حصلت مشكلة، حاول تاني.");
    }
    setReviewingReportId(null);
  }

  // معزول بنفس منطق باقي الأقسام — applicationStatusOf() هي نفسها المستخدمة في JobsTab.tsx،
  // من غير أي فلترة يدوية جديدة. ملحوظة: حقل تاريخ التقديم اسمه appliedAt فعليًا (شوف
  // ApplyButton.tsx)، مش createdAt — استخدمناه هنا عشان يطابق البيانات الحقيقية.
  async function loadApplicationStatusStats() {
    try {
      const snap = await getDocs(collection(db, "applications"));
      const counts = Object.fromEntries(APPLICATION_STATUS_ORDER.map((s) => [s, 0])) as ApplicationStatusStats;
      const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
      let staleSubmitted = 0;

      snap.docs.forEach((d) => {
        const data = d.data();
        const status = applicationStatusOf(data);
        counts[status] += 1;
        if (status === "submitted" && data.appliedAt?.toMillis && data.appliedAt.toMillis() < fiveDaysAgo) {
          staleSubmitted += 1;
        }
      });

      setApplicationStatusStats(counts);
      setStaleSubmittedCount(staleSubmitted);
      setApplicationStatusStatsError(false);
    } catch (err) {
      console.error("Admin application status stats failed", err);
      setApplicationStatusStats(null);
      setStaleSubmittedCount(0);
      setApplicationStatusStatsError(true);
    }
  }

  // معزول في تحميله الخاص بنفس منطق loadFunnelStats — لو مجموعة site_visits لسه معندهاش
  // قاعدة أمان مطبّقة (أو أي مشكلة تانية)، القسم ده بس بيفشل من غير ما يأثر على باقي اللوحة.
  async function loadVisitStats() {
    try {
      // مستندات site_visits معمولة بمعرّف YYYY-MM-DD، فترتيبها أبجديًا = ترتيبها زمنيًا —
      // آخر 30 مستند بترتيب تنازلي حسب المعرّف نفسه بيدّي آخر 30 يوم فعليًا من غير الحاجة
      // لحقل تاريخ منفصل نعمله عليه index.
      const snap = await getDocs(query(collection(db, "site_visits"), orderBy(documentId(), "desc"), limit(30)));
      const total = snap.docs.reduce((sum, d) => sum + (d.data().count || 0), 0);
      setVisits30d(total);
      setVisitsError(false);
    } catch (err) {
      console.error("Admin visit stats failed", err);
      setVisits30d(null);
      setVisitsError(true);
    }
  }

  async function loadCoreStats() {
    try {
      const oneDayAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

      // allPosts/activePosts/applications بقوا عدّ بس (getCountFromServer) — استعلام رخيص
      // جدًا مبيجيبش بيانات المستندات خالص، بدل ما نجيب كل المستندات فعليًا بس عشان نعدهم.
      const [
        seekersSnap,
        employersSnap,
        allPostsCountSnap,
        activePostsCountSnap,
        applicationsCountSnap,
        visibleCompanyPostsSnap,
        totalUsersSnap,
        activeUsersSnap,
        jobsSeoData,
        appInstallsDoc,
        pushEnabledCountSnap,
      ] = await Promise.all([
        getDocs(collection(db, "job_seekers")),
        getDocs(collection(db, "employers")),
        getCountFromServer(collection(db, "job_posts")),
        getCountFromServer(query(collection(db, "job_posts"), where("isActive", "==", true))),
        getCountFromServer(collection(db, "applications")),
        // "شركة ظاهرة للعامة" محتاجة بيانات فعلية (employerId، expiresAt) مش عدّ بس — استعلام
        // مصغّر (isActive + showCompanyName) بدل جلب كل job_posts زي الأول عشان نوفر قراءات.
        getDocs(query(collection(db, "job_posts"), where("isActive", "==", true), where("showCompanyName", "==", true))),
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "users"), where("lastActiveAt", ">=", oneDayAgo))),
        getActiveJobsSeoData(),
        // عداد تراكمي بسيط (مستند واحد) — شوف lib/appInstalls.ts.
        getDoc(doc(db, "app_installs", "total")),
        // getCountFromServer برضه هنا (زي allPosts/activePosts) — استعلام عدّ رخيص من غير
        // قراءة مستندات فعليًا، بدل collectionGroup على fcmTokens اللي كانت هتحتاج قراءة كل
        // توكن لكل جهاز لكل مستخدم بس عشان نعدّ المستخدمين الفريدين.
        getCountFromServer(query(collection(db, "users"), where("pushEnabled", "==", true))),
      ]);

      setSeoData({
        governorates: jobsSeoData.governorates,
        specializations: jobsSeoData.specializations,
        combos: jobsSeoData.combos,
      });

      const premiumCount = employersSnap.docs.filter((d) => d.data().plan === "premium").length;

      // نفس تعريف getCompanies في companies/page.tsx بالظبط: صاحب عمل عنده على الأقل إعلان
      // نشط، اسمه ظاهر، ومش منتهي الصلاحية. isActive/showCompanyName اتفلتروا في الاستعلام
      // نفسه فوق، وهنا بس بنفلتر expiresAt (مش قابل لفلترة Firestore بسهولة في نفس الاستعلام).
      const now = Date.now();
      const visibleCompanyIds = new Set(
        visibleCompanyPostsSnap.docs
          .map((d) => d.data() as any)
          .filter((p) => !p.expiresAt || p.expiresAt.toMillis() > now)
          .map((p) => p.employerId)
      );

      // تفصيل "نشطين آخر 24 ساعة": مستخدم "جديد" لو سجّل حسابه وبقى نشط في نفس الجلسة
      // تقريبًا (فرق أقل من ساعة بين createdAt وlastActiveAt) — من غير كده بيتحسب "عائد".
      // مستخدم من غير createdAt أصلًا (سجلات قديمة جدًا) بيتحسب عائد افتراضيًا، مش جديد.
      const NEW_USER_WINDOW_MS = 60 * 60 * 1000;
      let activeUsers24hNew = 0;
      let activeUsers24hReturning = 0;
      for (const d of activeUsersSnap.docs) {
        const data = d.data() as any;
        const lastActiveMs = data.lastActiveAt?.toMillis?.();
        const createdMs = data.createdAt?.toMillis?.();
        if (createdMs != null && lastActiveMs != null && lastActiveMs - createdMs < NEW_USER_WINDOW_MS) {
          activeUsers24hNew += 1;
        } else {
          activeUsers24hReturning += 1;
        }
      }

      // من نفس totalUsersSnap المجلوب أصلًا — بدون أي قراءة إضافية من Firestore.
      const signupMethodInferred: Record<InferredSignupMethod, number> = { phone: 0, google: 0, email: 0, unknown: 0 };
      for (const d of totalUsersSnap.docs) {
        signupMethodInferred[inferSignupMethod(d.data() as SignupMethodUserFields)] += 1;
      }

      setStats({
        seekers: seekersSnap.size,
        employers: employersSnap.size,
        premium: premiumCount,
        visibleCompanies: visibleCompanyIds.size,
        allPosts: allPostsCountSnap.data().count,
        activePosts: activePostsCountSnap.data().count,
        applications: applicationsCountSnap.data().count,
        totalUsers: totalUsersSnap.size,
        activeUsers24h: activeUsersSnap.size,
        activeUsers24hNew,
        activeUsers24hReturning,
        appInstalls: appInstallsDoc.data()?.count || 0,
        pushEnabledUsers: pushEnabledCountSnap.data().count,
        signupMethodInferred,
      });
    } catch (err) {
      console.error("Admin stats failed", err);
    }
  }

  // job_views وعدد اللي شافوا وسيلة التواصل (job_contact_views) وapplications للدفعة الحالية
  // بس (مش المجموعة كاملة) — أقصى POSTS_PAGE_SIZE (10) IDs في المرة الواحدة، متوافق مع limit
  // الصفحة نفسها. contactPostIds هي وظايف التواصل المباشر بس من نفس الدفعة. معزولين عن بعض
  // بـtry/catch منفصل، عشان فشل واحد فيهم (زي عدد المشاهدات) ميمنعش عرض الباقي.
  async function fetchJobViewsAndAppCounts(postIds: string[], contactPostIds: string[]) {
    const views: Record<string, number> = {};
    const contactViewers: Record<string, number> = {};
    const appCounts: Record<string, number> = {};
    if (postIds.length === 0) return { views, contactViewers, appCounts };

    try {
      const viewsSnap = await getDocs(query(collection(db, "job_views"), where(documentId(), "in", postIds)));
      viewsSnap.docs.forEach((d) => {
        views[d.id] = d.data().count || 0;
      });
    } catch (err) {
      console.error("Admin job views (page) failed", err);
    }

    try {
      const viewerResults = await Promise.allSettled(contactPostIds.map((id) => fetchContactRevealViewerCount(id)));
      viewerResults.forEach((result, i) => {
        if (result.status === "fulfilled") contactViewers[contactPostIds[i]] = result.value;
      });
    } catch (err) {
      console.error("Admin contact viewers (page) failed", err);
    }

    try {
      const appsSnap = await getDocs(query(collection(db, "applications"), where("jobPostId", "in", postIds)));
      appsSnap.docs.forEach((d) => {
        const jid = d.data().jobPostId;
        appCounts[jid] = (appCounts[jid] || 0) + 1;
      });
    } catch (err) {
      console.error("Admin applications (page) failed", err);
    }

    return { views, contactViewers, appCounts };
  }

  // أول صفحة من "كل الإعلانات المنشورة على الموقع" — orderBy(createdAt desc) + limit بدل
  // جلب كل job_posts زي الأول. معزولة عن loadCoreStats (فشلها ميأثرش على كروت الإحصائيات).
  async function loadJobsList() {
    try {
      const snap = await getDocs(query(collection(db, "job_posts"), orderBy("createdAt", "desc"), limit(POSTS_PAGE_SIZE)));
      const docs = snap.docs;
      const postIds = docs.map((d) => d.id);
      const contactPostIds = docs.filter((d) => d.data().receiveMethod === "contact").map((d) => d.id);
      const { views, contactViewers, appCounts } = await fetchJobViewsAndAppCounts(postIds, contactPostIds);

      const postsList = docs.map((d) => ({ id: d.id, ...d.data(), applicantCount: appCounts[d.id] || 0 } as any));

      setPosts(postsList);
      setJobViewCounts(views);
      setContactViewerCounts(contactViewers);
      setLastVisiblePost(docs.length > 0 ? docs[docs.length - 1] : null);
      setHasMorePosts(docs.length === POSTS_PAGE_SIZE);
    } catch (err) {
      console.error("Admin jobs list failed", err);
    }
  }

  // "تحميل المزيد" — بيضيف للقايمة الموجودة بدل ما يستبديها، وبيدمج job_views/contactViewers/
  // appCounts الجداد مع الموجودين بدل الاستبدال.
  async function loadMoreJobPosts() {
    if (!hasMorePosts || loadingMorePosts || !lastVisiblePost) return;
    setLoadingMorePosts(true);
    try {
      const snap = await getDocs(
        query(collection(db, "job_posts"), orderBy("createdAt", "desc"), startAfter(lastVisiblePost), limit(POSTS_PAGE_SIZE))
      );
      const docs = snap.docs;
      const postIds = docs.map((d) => d.id);
      const contactPostIds = docs.filter((d) => d.data().receiveMethod === "contact").map((d) => d.id);
      const { views, contactViewers, appCounts } = await fetchJobViewsAndAppCounts(postIds, contactPostIds);

      const newPosts = docs.map((d) => ({ id: d.id, ...d.data(), applicantCount: appCounts[d.id] || 0 } as any));

      setPosts((prev) => [...prev, ...newPosts]);
      setJobViewCounts((prev) => ({ ...(prev || {}), ...views }));
      setContactViewerCounts((prev) => ({ ...prev, ...contactViewers }));
      if (docs.length > 0) setLastVisiblePost(docs[docs.length - 1]);
      setHasMorePosts(docs.length === POSTS_PAGE_SIZE);
    } catch (err) {
      console.error("Admin load more jobs failed", err);
    }
    setLoadingMorePosts(false);
  }

  async function loadStats() {
    setLoadingStats(true);
    await Promise.all([loadCoreStats(), loadJobsList(), loadFunnelStats(), loadSignupMethodStats(), loadAuthErrorStats(), loadJobReports(), loadApplicationStatusStats(), loadVisitStats()]);
    setLoadingStats(false);
  }

  async function handleExportAllUsers() {
    setExportingUsers(true);
    try {
      await exportAllUsersExcel();
    } catch (err) {
      console.error("Export all users failed", err);
      alert("حصلت مشكلة في تصدير الملف — حاول تاني.");
    }
    setExportingUsers(false);
  }

  async function handleToggleActive(postId: string, makeActive: boolean) {
    await toggleJobActive(postId, makeActive);
    loadStats();
  }

  // تمييز/إلغاء تمييز وظيفة يدويًا، بغض النظر عن باقة صاحب العمل — شوف toggleJobFeatured
  // في jobPostActions.ts للتفاصيل (featuredByAdmin كعلامة حماية من الشيل التلقائي).
  async function handleToggleFeatured(postId: string, makeFeatured: boolean) {
    await toggleJobFeatured(postId, makeFeatured);
    loadStats();
  }

  async function handleDelete(postId: string) {
    if (!confirm('متأكد إنك عايز تحذف الإعلان نهائيًا؟ ده إجراء نهائي ومش هينفع ترجع فيه.')) return;
    await deleteJobPost(postId);
    loadStats();
  }

  async function handleToggleApplicants(postId: string, employerId: string) {
    if (openApplicantsFor === postId) {
      setOpenApplicantsFor(null);
      return;
    }
    setOpenApplicantsFor(postId);
    const fetched = await fetchApplicants(postId, employerId);
    // نفس منطق CompanyTab.tsx بالظبط — بنرتّب من الأعلى مطابقة للأقل بنفس job post object
    // اللي بيتستخدم بعدين في الـrender نفسه (شوف matchPercent جوه applicants.map تحت).
    const job = posts.find((p) => p.id === postId);
    const sorted = job
      ? [...fetched].sort(
          (a, b) =>
            (calculateMatchPercent(job, b.seekerSnapshot || {}) ?? -1) -
            (calculateMatchPercent(job, a.seekerSnapshot || {}) ?? -1)
        )
      : fetched;
    setApplicants(sorted);
  }

  if (status === "loading") {
    return (
      <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
        <h2>الصفحة دي مش متاحة ليك</h2>
      </div>
    );
  }

  // reviewed غير موجود بيتعامل معاه زي false — البلاغات الجديدة (لسه محدش راجعها) هي البارزة،
  // والمتراجعة بتتطوي في قسم صغير منفصل تحت.
  const pendingReports = jobReports?.filter((r) => !r.reviewed) || [];
  const reviewedReports = jobReports?.filter((r) => r.reviewed) || [];

  return (
    <div dir="rtl" style={{ maxWidth: 900, margin: "0 auto", padding: "30px 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>لوحة الإدارة</h1>
      <p style={{ color: "#4A5568", marginBottom: 20 }}>إحصائيات عامة عن الموقع</p>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button
          onClick={loadStats}
          disabled={loadingStats}
          style={{
            padding: "8px 16px",
            border: "1px solid #14213D",
            background: "transparent",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {loadingStats ? "جاري التحديث..." : "🔄 تحديث"}
        </button>
      </div>

      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard
            label="نشطين آخر 24 ساعة"
            value={stats.activeUsers24h}
            subtitle={`منهم ${stats.activeUsers24hNew} جدد، ${stats.activeUsers24hReturning} عائدين`}
          />
          <StatCard label="إجمالي المستخدمين المسجلين" value={stats.totalUsers} />
          <StatCard
            label="معدل إتمام التسجيل"
            value={
              stats.totalUsers > 0
                ? `${Math.round(((stats.seekers + stats.employers) / stats.totalUsers) * 100)}%`
                : "—"
            }
            subtitle={`${stats.seekers + stats.employers} من ${stats.totalUsers} أكملوا التسجيل`}
          />
          <StatCard label="الباحثين عن عمل" value={stats.seekers} />
          <StatCard label="أصحاب الأعمال" value={stats.employers} />
          <StatCard label="الشركات الظاهرة للعامة" value={stats.visibleCompanies} />
          <StatCard label="منهم باقة مدفوعة" value={stats.premium} />
          <StatCard label="كل الإعلانات" value={stats.allPosts} />
          <StatCard label="الإعلانات النشطة" value={stats.activePosts} />
          <StatCard label="كل التقديمات" value={stats.applications} />
          {visits30d !== null && <StatCard label="الزيارات آخر 30 يوم" value={visits30d} />}
          <StatCard label="تثبيتات التطبيق" value={stats.appInstalls} />
          <StatCard label="مفعّلين التنبيهات" value={stats.pushEnabledUsers} />
        </div>
      )}

      {visitsError && (
        <div style={{ fontSize: 13, color: "#B03A14", background: "#FBEAE3", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
          تعذر تحميل عداد الزيارات — باقي الإحصائيات تحت شغالة عادي.
        </div>
      )}

      {(applicationStatusStats || applicationStatusStatsError) && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>توزيع حالة التقديمات</h2>
          {applicationStatusStatsError && (
            <div style={{ fontSize: 13, color: "#B03A14", background: "#FBEAE3", borderRadius: 8, padding: "10px 14px" }}>
              تعذر تحميل توزيع حالة التقديمات — باقي الإحصائيات تحت شغالة عادي.
            </div>
          )}
          {applicationStatusStats && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {APPLICATION_STATUS_ORDER.map((status) => (
                  <FunnelStepCard key={status} label={APPLICATION_STATUS_LABELS[status]} value={applicationStatusStats[status]} />
                ))}
              </div>
              {staleSubmittedCount > 0 && (
                <div style={{ fontSize: 13, color: "#8A570D", background: "rgba(232,163,61,0.15)", borderRadius: 8, padding: "10px 14px", marginTop: 10 }}>
                  ⚠️ {staleSubmittedCount} تقديم لسه في انتظار مراجعة من أكتر من 5 أيام
                </div>
              )}
            </>
          )}
        </div>
      )}

      {(funnelStats || funnelError) && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>قمع التسجيل (آخر 7 أيام)</h2>
          {funnelError && (
            <div style={{ fontSize: 13, color: "#B03A14", background: "#FBEAE3", borderRadius: 8, padding: "10px 14px" }}>
              تعذر تحميل بيانات القمع — باقي الإحصائيات تحت شغالة عادي.
            </div>
          )}
          {funnelStats && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <FunnelStepCard label="اختار دور" value={funnelStats.roleSelected} />
              <FunnelArrow from={funnelStats.roleSelected} to={funnelStats.methodSelected} />
              <FunnelStepCard label="اختار طريقة تسجيل" value={funnelStats.methodSelected} />
              <FunnelArrow from={funnelStats.methodSelected} to={funnelStats.completed} />
              <FunnelStepCard label="أكمل التسجيل" value={funnelStats.completed} />
            </div>
          )}
        </div>
      )}

      {(signupMethodStats || signupMethodError) && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 4 }}>محاولات اختيار طريقة التسجيل (كل الوقت)</h2>
          <p style={{ fontSize: 12.5, color: "#4A5568", margin: "0 0 12px" }}>
            بيعدّ كل ضغطة، بما فيها الإعادة وتسجيل دخول مستخدمين قدامى، مش حسابات جديدة
          </p>
          {signupMethodError && (
            <div style={{ fontSize: 13, color: "#B03A14", background: "#FBEAE3", borderRadius: 8, padding: "10px 14px" }}>
              تعذر تحميل بيانات طرق التسجيل — باقي الإحصائيات تحت شغالة عادي.
            </div>
          )}
          {signupMethodStats && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <FunnelStepCard label="📱 تليفون" value={signupMethodStats.phone} />
              <FunnelStepCard label="🔍 جوجل" value={signupMethodStats.google} />
              <FunnelStepCard label="✉️ إيميل" value={signupMethodStats.email} />
            </div>
          )}
        </div>
      )}

      {stats && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 4 }}>طريقة التسجيل الفعلية (تقريبي)</h2>
          <p style={{ fontSize: 12.5, color: "#4A5568", margin: "0 0 12px" }}>
            حسابات فعلية مش محاولات — مستنتجة من بيانات كل مستخدم (رقم التليفون/الاسم/تأكيد الإيميل) مش من
            مزوّد الدخول نفسه، فنسبة صغيرة ممكن تتصنّف غلط. المجموع = إجمالي المستخدمين المسجلين.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {(
              [
                ["📱 تليفون", "phone"],
                ["🔍 جوجل", "google"],
                ["✉️ إيميل", "email"],
                ["❔ غير معروف", "unknown"],
              ] as const
            )
              .filter(([, key]) => key !== "unknown" || stats.signupMethodInferred.unknown > 0)
              .map(([label, key]) => (
                <FunnelStepCard
                  key={key}
                  label={label}
                  value={stats.signupMethodInferred[key]}
                  subtitle={
                    stats.totalUsers > 0
                      ? `${Math.round((stats.signupMethodInferred[key] / stats.totalUsers) * 100)}% من ${stats.totalUsers}`
                      : undefined
                  }
                />
              ))}
          </div>
        </div>
      )}

      {(authErrorStats || authErrorStatsError) && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>أخطاء التسجيل (آخر 7 أيام)</h2>
          {authErrorStatsError && (
            <div style={{ fontSize: 13, color: "#B03A14", background: "#FBEAE3", borderRadius: 8, padding: "10px 14px" }}>
              تعذر تحميل بيانات الأخطاء — باقي الإحصائيات تحت شغالة عادي.
            </div>
          )}
          {authErrorStats && (
            (authErrorStats.phone_send_code.count +
              authErrorStats.phone_verify_code.count +
              authErrorStats.google_popup_signin.count +
              authErrorStats.google_redirect_signin.count) === 0 ? (
              <div style={{ fontSize: 13.5, color: "#2F6F4E", background: "rgba(47,111,78,0.1)", borderRadius: 8, padding: "10px 14px" }}>
                مفيش أخطاء تسجيل مسجّلة آخر 7 أيام 👍
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <AuthErrorCard
                  label="فشل إرسال كود التليفون"
                  detail={authErrorStats.phone_send_code}
                  attemptsTotal={funnelStats?.methodSelectedByMethod.phone}
                />
                <AuthErrorCard label="فشل تأكيد كود التليفون" detail={authErrorStats.phone_verify_code} />
                <AuthErrorCard label="فشل نافذة جوجل المنبثقة" detail={authErrorStats.google_popup_signin} />
                <AuthErrorCard label="فشل تسجيل جوجل بالكامل" detail={authErrorStats.google_redirect_signin} />
              </div>
            )
          )}
        </div>
      )}

      {(authErrorStats || authErrorStatsError) && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>أخطاء نشر الوظائف (آخر 7 أيام)</h2>
          {authErrorStatsError && (
            <div style={{ fontSize: 13, color: "#B03A14", background: "#FBEAE3", borderRadius: 8, padding: "10px 14px" }}>
              تعذر تحميل بيانات الأخطاء — باقي الإحصائيات تحت شغالة عادي.
            </div>
          )}
          {authErrorStats && (
            (authErrorStats.job_post_create.count + authErrorStats.job_post_update.count) === 0 ? (
              <div style={{ fontSize: 13.5, color: "#2F6F4E", background: "rgba(47,111,78,0.1)", borderRadius: 8, padding: "10px 14px" }}>
                مفيش أخطاء نشر/تعديل وظايف مسجّلة آخر 7 أيام 👍
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <AuthErrorCard label="فشل نشر وظيفة جديدة" detail={authErrorStats.job_post_create} />
                <AuthErrorCard label="فشل حفظ تعديل وظيفة" detail={authErrorStats.job_post_update} />
              </div>
            )
          )}
        </div>
      )}

      {(authErrorStats || authErrorStatsError) && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>أخطاء حفظ بيانات الشركة (آخر 7 أيام)</h2>
          {authErrorStatsError && (
            <div style={{ fontSize: 13, color: "#B03A14", background: "#FBEAE3", borderRadius: 8, padding: "10px 14px" }}>
              تعذر تحميل بيانات الأخطاء — باقي الإحصائيات تحت شغالة عادي.
            </div>
          )}
          {authErrorStats && (
            (authErrorStats.employer_profile_create.count + authErrorStats.employer_profile_update.count) === 0 ? (
              <div style={{ fontSize: 13.5, color: "#2F6F4E", background: "rgba(47,111,78,0.1)", borderRadius: 8, padding: "10px 14px" }}>
                مفيش أخطاء حفظ بيانات شركة مسجّلة آخر 7 أيام 👍
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <AuthErrorCard label="فشل إنشاء بيانات شركة جديدة" detail={authErrorStats.employer_profile_create} />
                <AuthErrorCard label="فشل تعديل بيانات شركة" detail={authErrorStats.employer_profile_update} />
              </div>
            )
          )}
        </div>
      )}

      {(jobReports || jobReportsError) && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>بلاغات الوظائف</h2>
          {jobReportsError && (
            <div style={{ fontSize: 13, color: "#B03A14", background: "#FBEAE3", borderRadius: 8, padding: "10px 14px" }}>
              تعذر تحميل بلاغات الوظائف — باقي الإحصائيات تحت شغالة عادي.
            </div>
          )}
          {jobReports && (
            <>
              {pendingReports.length === 0 ? (
                <div style={{ fontSize: 13.5, color: "#2F6F4E", background: "rgba(47,111,78,0.1)", borderRadius: 8, padding: "10px 14px" }}>
                  مفيش بلاغات جديدة 👍
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pendingReports.map((r) => (
                    <JobReportRow key={r.id} report={r} onMarkReviewed={handleMarkReviewed} reviewing={reviewingReportId === r.id} />
                  ))}
                </div>
              )}

              {reviewedReports.length > 0 && (
                <details style={{ marginTop: 14 }}>
                  <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#4A5568" }}>
                    بلاغات اتراجعت ({reviewedReports.length})
                  </summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                    {reviewedReports.map((r) => (
                      <JobReportRow key={r.id} report={r} dimmed />
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
        <button
          onClick={handleExportAllUsers}
          disabled={exportingUsers}
          style={{
            padding: "8px 16px",
            border: "1px solid #14213D",
            background: "transparent",
            borderRadius: 6,
            cursor: exportingUsers ? "wait" : "pointer",
            opacity: exportingUsers ? 0.7 : 1,
          }}
        >
          {exportingUsers ? "جاري التحميل..." : "⬇ تحميل كل المستخدمين Excel"}
        </button>
      </div>

      {seoData && (seoData.combos.length > 0 || seoData.governorates.length > 0 || seoData.specializations.length > 0) && (
        <details style={{ marginBottom: 30, border: "1px solid #14213D22", borderRadius: 8, padding: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#14213D" }}>
            🔍 تصفح حسب (نفس الروابط اللي الزوار بيشوفوها)
          </summary>

          {seoData.combos.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4A5568", marginBottom: 8 }}>
                أشهر التركيبات (محافظة + تخصص)
              </div>
              <BrowseByCombos combos={seoData.combos.slice(0, 12)} variant="inline" />
            </div>
          )}

          {seoData.governorates.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4A5568", marginBottom: 8 }}>المحافظات</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {seoData.governorates.map((g) => (
                  <Link key={g} href={`/jobs/${slugify(g)}`} style={{ ...tagStyle, textDecoration: "none", color: "#14213D", padding: "8px 14px", fontSize: 13.5 }}>
                    وظائف {g}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {seoData.specializations.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4A5568", marginBottom: 8 }}>التخصصات</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {seoData.specializations.map((s) => (
                  <Link key={s} href={`/jobs/specialization/${slugify(s)}`} style={{ ...tagStyle, textDecoration: "none", color: "#14213D", padding: "8px 14px", fontSize: 13.5 }}>
                    وظائف {s}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </details>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 16 }}>كل الإعلانات المنشورة على الموقع</h2>

      {posts.length === 0 && <div style={{ color: "#4A5568" }}>مفيش إعلانات لسه.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {posts.map((p) => {
          const isPaused = p.isActive === false;
          const isContactMethod = p.receiveMethod === "contact";
          // lo jobViewCounts نفسها فشلت تجيب خالص (null)، مش عارفين المشاهدات فعلاً فبنخفي
          // السطر كله زي الأول — لكن لو جبناها بنجاح وبس الوظيفة دي معندهاش مستند، الافتراض
          // 0 (مش إخفاء) عشان يبان إنها "لسه محدش شافها" مش إن الميزة نفسها مش شغالة.
          const views = jobViewCounts ? jobViewCounts[p.id] ?? 0 : null;
          // معدل التحويل مالوش معنى لوظايف التواصل المباشر (contact) — التقديم الفعلي بيتم
          // برّه الموقع في الغالب، فـapplicantCount مش مقياس صادق لعدد المهتمين (عدد المتقدمين
          // الفعليين، لو فيه، بيظهر بس على الزرار تحت).
          const conversionRate =
            !isContactMethod && views && views > 0 ? Math.round((p.applicantCount / views) * 100) : null;
          // عدد اللي شافوا وسيلة التواصل (job_contact_views) — بس لو اتحمّل بنجاح وأكبر من صفر،
          // وإلا (لسه بيحمّل / فشل / صفر) بيفضل النص العام (contactApplyText) بدل رقم مضلل.
          const viewerCount = contactViewerCounts[p.id];
          const hasViewers = isContactMethod && viewerCount !== undefined && viewerCount > 0;
          return (
          <div key={p.id} style={jobCardContainerStyle}>
            <div style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={isPaused ? pausedPillStyle : activePillStyle}>{isPaused ? "⏸ متوقف" : "● نشط"}</span>
                    {p.featured && <span style={featuredPillStyle}>⭐ مميز</span>}
                  </div>
                  <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#14213D" }}>{p.title}</h3>
                  <div style={{ fontSize: 13, color: "#4A5568", marginBottom: 10 }}>
                    {p.companyName || "بدون اسم شركة"}
                    {!p.showCompanyName ? " (مخفي عن الباحثين)" : ""}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: "#4A5568" }}>
                    <span>📍 {p.city} - {p.governorate}</span>
                    <span aria-hidden>·</span>
                    <span>🕐 {JOB_TYPE_LABELS[p.jobType] || p.jobType}</span>
                    {p.jobLevel && (
                      <>
                        <span aria-hidden>·</span>
                        <span>🎯 {EXPERIENCE_LEVELS[p.jobLevel] || p.jobLevel}</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <span style={applicantBadgeStyle}>
                    {hasViewers
                      ? `📞 ${viewerCount} شخص شاف وسيلة التواصل`
                      : isContactMethod
                      ? `📞 ${contactApplyText(p)}`
                      : `👥 ${p.applicantCount} متقدم`}
                  </span>
                  {views !== null && (
                    <span style={{ fontSize: 12, color: "#4A5568", whiteSpace: "nowrap" }}>
                      👁️ {views} مشاهدة{conversionRate !== null ? ` · تحويل ${conversionRate}%` : ""}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "#4A5568", whiteSpace: "nowrap" }}>{formatDate(p.createdAt)}</span>
                </div>
              </div>

              {p.screeningQuestions && p.screeningQuestions.length > 0 && (
                <div style={{ marginTop: 14, padding: "10px 14px", background: "#FAF6EC", borderRadius: 8, border: "1px solid #14213D14" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#14213D", marginBottom: 6 }}>
                    ❓ أسئلة الفرز ({p.screeningQuestions.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {p.screeningQuestions.map((q: ScreeningQuestion) => (
                      <div key={q.id} style={{ fontSize: 13.5, color: "#14213D" }}>
                        • {q.text}
                        {!q.required && <span style={{ color: "#4A5568" }}> (اختياري)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid #14213D14",
                }}
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => handleToggleApplicants(p.id, p.employerId)} style={primaryActionStyle}>
                    {p.applicantCount > 0 || !isContactMethod
                      ? `👥 عرض المتقدمين (${p.applicantCount})`
                      : hasViewers
                      ? `📞 عرض التفاصيل (${viewerCount})`
                      : "👥 عرض المتقدمين"}
                  </button>
                  {p.applicantCount > 0 && (
                    <button onClick={() => exportApplicantsExcel(p.id, p.title, p.employerId, p.screeningQuestions || [])} style={ghostActionStyle}>⬇ تحميل Excel</button>
                  )}
                  <a href={`/jobs/${p.id}`} target="_blank" rel="noopener noreferrer" style={{ ...ghostActionStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                    🔗 الصفحة العامة
                  </a>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => setEditingPost({ id: p.id, data: p })} style={toolBtnStyle}>✎ تعديل</button>
                  <button onClick={() => handleToggleActive(p.id, isPaused)} style={toolBtnStyle}>
                    {isPaused ? "▶ تفعيل" : "⏸ إيقاف"}
                  </button>
                  <button onClick={() => handleToggleFeatured(p.id, !p.featured)} style={toolBtnStyle}>
                    {p.featured ? "☆ إلغاء التمييز" : "⭐ تمييز الوظيفة"}
                  </button>
                  <ShareButton jobId={p.id} title={p.title} />
                  <button onClick={() => handleDelete(p.id)} style={dangerToolBtnStyle}>✕ حذف</button>
                </div>
              </div>
            </div>

            {openApplicantsFor === p.id && (
              <div style={{ padding: "16px 20px 18px", borderTop: "1px solid #14213D14", display: "flex", flexDirection: "column", gap: 12 }}>
                {applicants.length === 0 ? (
                  <div style={{ padding: 12, color: "#4A5568" }}>
                    {isContactMethod
                      ? `التقديم على الوظيفة دي بيتم عبر ${CONTACT_METHOD_LABELS[p.contactMethod || ""] || "التواصل المباشر"} مباشرة، مش من خلال الموقع.`
                      : "لسه محدش قدّم على الإعلان ده."}
                    {isContactMethod && <ContactRevealViewers jobPostId={p.id} />}
                  </div>
                ) : (
                  applicants.map((a, i) => (
                    <ApplicantCard
                      key={i}
                      applicant={a}
                      screeningQuestions={p.screeningQuestions}
                      isAdmin
                      matchPercent={calculateMatchPercent(p, a.seekerSnapshot || {})}
                    />
                  ))
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {hasMorePosts && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={loadMoreJobPosts}
            disabled={loadingMorePosts}
            style={{
              padding: "10px 24px",
              border: "1px solid #14213D",
              background: "transparent",
              borderRadius: 6,
              cursor: loadingMorePosts ? "wait" : "pointer",
              opacity: loadingMorePosts ? 0.7 : 1,
            }}
          >
            {loadingMorePosts ? "جاري التحميل..." : "تحميل المزيد"}
          </button>
        </div>
      )}

      {editingPost && (
        <div
          onClick={() => setEditingPost(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,33,61,0.55)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: 750,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <button
              onClick={() => setEditingPost(null)}
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1.5px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
            <PostJobTab
              employerPlan={editingPost.data.featured ? "premium" : "free"}
              companyName={editingPost.data.companyName || ""}
              editingPost={editingPost}
              onPosted={() => {
                setEditingPost(null);
                loadStats();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: number | string; subtitle?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #14213D22", borderRadius: 8, padding: 12, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#4A5568" }}>{label}</div>
      {subtitle && <div style={{ fontSize: 11, color: "#4A5568", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

function JobReportRow({
  report,
  onMarkReviewed,
  reviewing,
  dimmed,
}: {
  report: JobReport;
  onMarkReviewed?: (id: string) => void;
  reviewing?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div style={{ border: "1px solid #14213D22", borderRadius: 8, padding: 14, opacity: dimmed ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <Link href={`/jobs/${report.jobId}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: "#14213D", fontSize: 14.5, textDecoration: "none" }}>
            {report.jobTitle || "وظيفة"}
          </Link>
          <div style={{ fontSize: 13, color: "#B03A14", marginTop: 4 }}>السبب: {report.reason}</div>
          {report.details && <div style={{ fontSize: 13, color: "#4A5568", marginTop: 4 }}>{report.details}</div>}
          <div style={{ fontSize: 11.5, color: "#4A5568", marginTop: 4 }}>{formatDate(report.createdAt)}</div>
        </div>
        {onMarkReviewed && (
          <button
            onClick={() => onMarkReviewed(report.id)}
            disabled={reviewing}
            style={{
              padding: "6px 12px",
              background: "#14213D",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: reviewing ? "wait" : "pointer",
              opacity: reviewing ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {reviewing ? "جاري الحفظ..." : "✓ تمت المراجعة"}
          </button>
        )}
      </div>
    </div>
  );
}

function FunnelStepCard({ label, value, subtitle }: { label: string; value: number; subtitle?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #14213D22", borderRadius: 8, padding: "12px 16px", textAlign: "center", minWidth: 120, flex: "1 1 120px" }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#4A5568" }}>{label}</div>
      {subtitle && <div style={{ fontSize: 11, color: "#4A5568", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

// نسخة من FunnelStepCard مخصّصة بس لكروت أخطاء التسجيل التلاتة — بتضيف زرار توسيع يعرض آخر
// الحالات الفردية (تاريخ/وقت، الصفحة، الكود) من غير ما تلمس FunnelStepCard نفسها (مستخدمة في
// 3 أقسام تانية مالهاش علاقة بالتفاصيل دي: حالة التقديمات، قمع التسجيل، طرق التسجيل).
function AuthErrorCard({
  label,
  detail,
  attemptsTotal,
}: {
  label: string;
  detail: AuthErrorDetail;
  // إجمالي محاولات (نفس فترة الـ7 أيام) عشان تتحسب نسبة الفشل — undefined لو مفيش مقام
  // منطقي متاح للـstep ده (زي أخطاء نشر الوظايف، أو أخطاء تأكيد الكود اللي مقامها مختلف).
  attemptsTotal?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const subtitle = authErrorSubtitle(detail);
  const maxDailyCount = Math.max(...detail.dailyCounts.map((d) => d.count), 1);

  return (
    <div style={{ background: "#fff", border: "1px solid #14213D22", borderRadius: 8, padding: "12px 16px", minWidth: 180, flex: "1 1 180px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{detail.count}</div>
        <div style={{ fontSize: 12, color: "#4A5568" }}>{label}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#4A5568", marginTop: 4 }}>{subtitle}</div>}
        {attemptsTotal !== undefined && attemptsTotal > 0 && (
          <div style={{ fontSize: 11, color: "#4A5568", marginTop: 2 }}>
            نسبة الفشل: {detail.count} من {attemptsTotal} محاولة ({Math.round((detail.count / attemptsTotal) * 100)}%)
          </div>
        )}
        {detail.codePresentPercent !== null && (
          <div style={{ fontSize: 11, color: "#4A5568", marginTop: 2 }}>
            عندها code فايربيز: {detail.codePresentPercent}%
          </div>
        )}
      </div>

      {/* توزيع الحالات على آخر 7 أيام (تاريخ محلي) — بيبان فورًا لو الزيادة متركزة في يوم أو
          يومين معينين بدل ما تكون موزعة بالتساوي، من غير ما يحتاج الأدمن يضغط "عرض التفاصيل".
          عمود لكل يوم حتى لو صفر (مش بيتشال) عشان يبان الفرق بصريًا. */}
      {detail.count > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: "#4A5568", fontWeight: 700, marginBottom: 4 }}>توزيع آخر 7 أيام</div>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 40 }}>
            {detail.dailyCounts.map((d) => (
              <div
                key={d.date}
                title={`${d.label}: ${d.count}`}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
              >
                <div
                  style={{
                    width: "100%",
                    height: d.count > 0 ? Math.max(Math.round((d.count / maxDailyCount) * 32), 3) : 1,
                    background: d.count > 0 ? "#B03A14" : "#14213D14",
                    borderRadius: 2,
                  }}
                />
                <div style={{ fontSize: 8.5, color: "#4A5568" }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* أعلى 3 (code + message) مختلفين تكرارًا (بدل رسالة واحدة مجمّعة في subtitle فوق) —
          عشان نتأكد الـcount مش خليط مشاكل مختلفة مقنّع في رقم واحد. */}
      {detail.topVariants.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: "#4A5568", fontWeight: 700, marginBottom: 4 }}>أعلى الرسائل/الأكواد تكرارًا</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {detail.topVariants.map((v, i) => (
              <div key={i} style={{ fontSize: 10.5, color: "#4A5568", borderTop: i > 0 ? "1px solid #14213D14" : undefined, paddingTop: i > 0 ? 5 : 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {v.code || "(من غير code)"} — {v.count} مرة
                </div>
                {v.message && (
                  <div style={{ wordBreak: "break-all" }}>
                    {v.message.length > 70 ? `${v.message.slice(0, 70)}...` : v.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* توزيع WebView/المتصفح/الصفحة مقسّم بين مجموعة "عندها code فايربيز" ومجموعة "من غيره"
          لوحدهم — بدل رقم واحد مخلوط بين نوعين مختلفين من الأخطاء (شوف تعليق
          computeErrorGroupBreakdown فوق). Safari/iOS بالذات مهم هنا لأن "Prevent Cross-Site
          Tracking" الافتراضي فيه سبب موثّق لمشاكل reCAPTCHA/Firebase Phone Auth. */}
      <ErrorGroupSection title="عندها code فايربيز" group={detail.codeGroupBreakdown} />
      <ErrorGroupSection title="من غير code (JS خام)" group={detail.noCodeGroupBreakdown} />

      {detail.count > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              padding: "4px 8px",
              fontSize: 11,
              background: "transparent",
              border: "1px solid #14213D22",
              borderRadius: 6,
              color: "#14213D",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {expanded ? "إخفاء التفاصيل ▲" : `عرض آخر ${detail.entries.length} حالة ▼`}
          </button>

          {expanded && (
            <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {detail.entries.map((entry) => (
                <div key={entry.id} style={{ fontSize: 11, color: "#4A5568", borderTop: "1px solid #14213D14", paddingTop: 6 }}>
                  <div>{formatDateTime(entry.createdAt)}</div>
                  <div style={{ wordBreak: "break-all" }}>
                    {entry.page || "صفحة غير مسجّلة"}
                    {entry.code ? ` — ${entry.code}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// قسم فرعي جوه AuthErrorCard بيعرض تفاصيل WebView/المتصفح/الصفحة لمجموعة واحدة بس (عندها code
// أو من غيره) — null لو المجموعة فاضية (زي step معندوش أي حالات code خالص) عشان مايظهرش قسم
// فاضي بعنوان بس.
function ErrorGroupSection({ title, group }: { title: string; group: ErrorGroupBreakdown }) {
  if (group.count === 0) return null;
  return (
    <div style={{ marginTop: 10, background: "#F8F6F0", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#14213D", marginBottom: 4 }}>
        {title} ({group.count})
      </div>
      {group.webViewFailurePercent !== null && (
        <div style={{ fontSize: 10, color: "#4A5568" }}>من WebView: {group.webViewFailurePercent}%</div>
      )}
      {group.registerPagePercent !== null && (
        <div style={{ fontSize: 10, color: "#4A5568" }}>من /register مباشرة: {group.registerPagePercent}%</div>
      )}
      {group.browserBreakdown.length > 0 && (
        <div style={{ marginTop: 3, display: "flex", flexDirection: "column", gap: 1 }}>
          {group.browserBreakdown.map((b) => (
            <div key={b.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4A5568" }}>
              <span>{b.label}</span>
              <span style={{ fontWeight: 700 }}>{Math.round((b.count / group.count) * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// نسبة السقوط من الخطوة اللي قبلها — لو الخطوة السابقة صفر، مفيش نسبة تتحسب (تجنبًا لقسمة
// على صفر)، وده متوقع للـ7 أيام الأولى بعد إضافة التتبّع ده لحد ما يتراكم بيانات كفاية.
function FunnelArrow({ from, to }: { from: number; to: number }) {
  const dropPercent = from > 0 ? Math.round((1 - to / from) * 100) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: "0 0 auto" }}>
      <span style={{ fontSize: 18, color: "#4A5568" }}>←</span>
      {dropPercent !== null && (
        <span style={{ fontSize: 11, fontWeight: 700, color: dropPercent >= 0 ? "#B03A14" : "#2F6F4E", whiteSpace: "nowrap" }}>
          {dropPercent >= 0 ? `-${dropPercent}%` : `+${-dropPercent}%`}
        </span>
      )}
    </div>
  );
}
