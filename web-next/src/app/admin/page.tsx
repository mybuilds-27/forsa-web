"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  documentId,
  getCountFromServer,
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
import { toggleJobActive, deleteJobPost, fetchApplicants, exportApplicantsExcel } from "@/lib/jobPostActions";
import { exportAllUsersExcel } from "@/lib/adminExports";
import { EXPERIENCE_LEVELS, slugify } from "@/lib/constants";
import { CONTACT_METHOD_LABELS, contactApplyText } from "@/lib/contactMethodLabels";
import { getActiveJobsSeoData, type JobCombo } from "@/lib/publicJobsQuery";
import ApplicantCard from "@/components/ApplicantCard";
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

// حجم دفعة "كل الإعلانات المنشورة على الموقع" — نفس الرقم مستخدم في in query لـjob_views/
// applications تحت (حد الـin في Firestore بيسمح بأكتر بكتير، بس مفيش داعي نتخطى حجم الصفحة نفسها)
const POSTS_PAGE_SIZE = 10;

type EditingPost = { id: string; data: any } | null;

function formatDate(ts: any) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ar-EG");
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

// بيحسب عدد مستندات error_logs بـstep معيّن، وأكتر code تكرر بينهم، وأكتر message تكرر
// كـfallback لو مفيش code مسجل خالص (بدون أي استعلام إضافي — نفس الـdocs المجلوبة أصلًا
// من loadAuthErrorStats).
function computeAuthErrorDetail(docs: any[], step: string): AuthErrorDetail {
  const stepDocs = docs.filter((d) => d.data().step === step);
  const topCode = mostFrequentValue(stepDocs.map((d) => d.data().code ?? null));
  const topMessage = mostFrequentValue(stepDocs.map((d) => d.data().message ?? null));

  return {
    count: stepDocs.length,
    topErrorCode: topCode.value,
    topErrorCodeCount: topCode.count,
    topErrorMessage: topMessage.value,
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
};

type FunnelStats = {
  roleSelected: number;
  methodSelected: number;
  completed: number;
};

type SignupMethodStats = {
  phone: number;
  google: number;
  email: number;
};

// count إجمالي الأخطاء المسجّلة للـstep ده، وtopErrorCode/topErrorCodeCount أكتر code
// (زي auth/quota-exceeded) تكرر بينهم — null لو كل المستندات معندهاش code مسجل خالص.
type AuthErrorDetail = {
  count: number;
  topErrorCode: string | null;
  topErrorCodeCount: number;
  topErrorMessage: string | null;
};

type AuthErrorStats = {
  phone_send_code: AuthErrorDetail;
  phone_verify_code: AuthErrorDetail;
  google_popup_signin: AuthErrorDetail;
  google_redirect_signin: AuthErrorDetail;
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
  const [whatsappClickCounts, setWhatsappClickCounts] = useState<Record<string, number> | null>(null);
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
      setFunnelStats({
        roleSelected: funnelEventsSnap.docs.filter((d) => d.data().step === "role_selected").length,
        methodSelected: funnelEventsSnap.docs.filter((d) => d.data().step === "method_selected").length,
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
      });
    } catch (err) {
      console.error("Admin stats failed", err);
    }
  }

  // job_views وwhatsapp_clicks وapplications للدفعة الحالية بس (مش المجموعة كاملة) — أقصى
  // POSTS_PAGE_SIZE (10) IDs في المرة الواحدة، متوافق مع limit الصفحة نفسها. معزولين عن بعض
  // بـtry/catch منفصل، عشان فشل واحد فيهم (زي عدد المشاهدات) ميمنعش عرض الباقي.
  async function fetchJobViewsAndAppCounts(postIds: string[]) {
    const views: Record<string, number> = {};
    const whatsappClicks: Record<string, number> = {};
    const appCounts: Record<string, number> = {};
    if (postIds.length === 0) return { views, whatsappClicks, appCounts };

    try {
      const viewsSnap = await getDocs(query(collection(db, "job_views"), where(documentId(), "in", postIds)));
      viewsSnap.docs.forEach((d) => {
        views[d.id] = d.data().count || 0;
      });
    } catch (err) {
      console.error("Admin job views (page) failed", err);
    }

    try {
      const clicksSnap = await getDocs(query(collection(db, "whatsapp_clicks"), where(documentId(), "in", postIds)));
      clicksSnap.docs.forEach((d) => {
        whatsappClicks[d.id] = d.data().count || 0;
      });
    } catch (err) {
      console.error("Admin whatsapp clicks (page) failed", err);
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

    return { views, whatsappClicks, appCounts };
  }

  // أول صفحة من "كل الإعلانات المنشورة على الموقع" — orderBy(createdAt desc) + limit بدل
  // جلب كل job_posts زي الأول. معزولة عن loadCoreStats (فشلها ميأثرش على كروت الإحصائيات).
  async function loadJobsList() {
    try {
      const snap = await getDocs(query(collection(db, "job_posts"), orderBy("createdAt", "desc"), limit(POSTS_PAGE_SIZE)));
      const docs = snap.docs;
      const postIds = docs.map((d) => d.id);
      const { views, whatsappClicks, appCounts } = await fetchJobViewsAndAppCounts(postIds);

      const postsList = docs.map((d) => ({ id: d.id, ...d.data(), applicantCount: appCounts[d.id] || 0 } as any));

      setPosts(postsList);
      setJobViewCounts(views);
      setWhatsappClickCounts(whatsappClicks);
      setLastVisiblePost(docs.length > 0 ? docs[docs.length - 1] : null);
      setHasMorePosts(docs.length === POSTS_PAGE_SIZE);
    } catch (err) {
      console.error("Admin jobs list failed", err);
    }
  }

  // "تحميل المزيد" — بيضيف للقايمة الموجودة بدل ما يستبديها، وبيدمج job_views/whatsappClicks/
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
      const { views, whatsappClicks, appCounts } = await fetchJobViewsAndAppCounts(postIds);

      const newPosts = docs.map((d) => ({ id: d.id, ...d.data(), applicantCount: appCounts[d.id] || 0 } as any));

      setPosts((prev) => [...prev, ...newPosts]);
      setJobViewCounts((prev) => ({ ...(prev || {}), ...views }));
      setWhatsappClickCounts((prev) => ({ ...(prev || {}), ...whatsappClicks }));
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
    setApplicants(await fetchApplicants(postId, employerId));
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
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>طريقة التسجيل (كل الوقت)</h2>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <FunnelStepCard label="فشل إرسال كود التليفون" value={authErrorStats.phone_send_code.count} subtitle={authErrorSubtitle(authErrorStats.phone_send_code)} />
                <FunnelStepCard label="فشل تأكيد كود التليفون" value={authErrorStats.phone_verify_code.count} subtitle={authErrorSubtitle(authErrorStats.phone_verify_code)} />
                <FunnelStepCard label="فشل نافذة جوجل المنبثقة" value={authErrorStats.google_popup_signin.count} subtitle={authErrorSubtitle(authErrorStats.google_popup_signin)} />
                <FunnelStepCard label="فشل تسجيل جوجل بالكامل" value={authErrorStats.google_redirect_signin.count} subtitle={authErrorSubtitle(authErrorStats.google_redirect_signin)} />
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
          // معدل التحويل مالوش معنى لوظايف التواصل المباشر (contact) — applicantCount عندهم
          // دايمًا 0 لأن مفيش applications متسجلة في Firestore أصلاً، مش لأن محدش قدّم فعليًا.
          const conversionRate =
            !isContactMethod && views && views > 0 ? Math.round((p.applicantCount / views) * 100) : null;
          // بس لو jobViewCounts (وبالتبعية whatsappClickCounts، بيتحملوا مع بعض) فعلاً اتحمّلت
          // بنجاح — لو null (فشل الجلب) بيفضل يعرض النص العام (contactApplyText) بدل "0" مضلل.
          const whatsappClicks = whatsappClickCounts ? whatsappClickCounts[p.id] ?? 0 : undefined;
          const isWhatsAppWithCount = isContactMethod && p.contactMethod === "whatsapp" && whatsappClicks !== undefined;
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
                    {isWhatsAppWithCount
                      ? `📞 ${whatsappClicks} شخص تواصل عبر واتساب`
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
                    {isWhatsAppWithCount
                      ? `📞 عرض التفاصيل (${whatsappClicks})`
                      : isContactMethod
                      ? "👥 عرض المتقدمين"
                      : `👥 عرض المتقدمين (${p.applicantCount})`}
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
                  <ShareButton jobId={p.id} title={p.title} />
                  <button onClick={() => handleDelete(p.id)} style={dangerToolBtnStyle}>✕ حذف</button>
                </div>
              </div>
            </div>

            {openApplicantsFor === p.id && (
              <div style={{ padding: "16px 20px 18px", borderTop: "1px solid #14213D14", display: "flex", flexDirection: "column", gap: 12 }}>
                {applicants.length === 0 ? (
                  <div style={{ padding: 12, color: "#4A5568" }}>
                    {isWhatsAppWithCount
                      ? `${whatsappClicks} شخص تواصل عبر واتساب مع الشركة على الوظيفة دي مباشرة، مش من خلال الموقع.`
                      : isContactMethod
                      ? `التقديم على الوظيفة دي بيتم عبر ${CONTACT_METHOD_LABELS[p.contactMethod || ""] || "التواصل المباشر"} مباشرة، مش من خلال الموقع.`
                      : "لسه محدش قدّم على الإعلان ده."}
                  </div>
                ) : (
                  applicants.map((a, i) => (
                    <ApplicantCard key={i} applicant={a} screeningQuestions={p.screeningQuestions} />
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
