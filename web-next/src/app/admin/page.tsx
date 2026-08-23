"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, documentId, getDocs, orderBy, query, where, limit, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import ShareButton from "@/components/ShareButton";
import PostJobTab from "../employer/PostJobTab";
import Link from "next/link";
import { toggleJobActive, deleteJobPost, fetchApplicants, exportApplicantsExcel } from "@/lib/jobPostActions";
import { exportAllUsersExcel } from "@/lib/adminExports";
import { EXPERIENCE_LEVELS, slugify } from "@/lib/constants";
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
} from "@/lib/jobCardStyles";

const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

type EditingPost = { id: string; data: any } | null;

function formatDate(ts: any) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ar-EG");
}

// بيحسب عدد مستندات error_logs بـstep معيّن، وأكتر code تكرر بينهم (بدون أي استعلام إضافي —
// نفس الـdocs المجلوبة أصلًا من loadAuthErrorStats). code == null بيتحسب كقيمة لوحده (يعني
// "مفيش code مسجل")، فلو ده أكتر قيمة تكررت، topErrorCode بيرجع null والواجهة بتعرض رسالة توضيحية.
function computeAuthErrorDetail(docs: any[], step: string): AuthErrorDetail {
  const stepDocs = docs.filter((d) => d.data().step === step);
  const codeCounts = new Map<string | null, number>();
  stepDocs.forEach((d) => {
    const code = d.data().code ?? null;
    codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
  });

  let topErrorCode: string | null = null;
  let topErrorCodeCount = 0;
  codeCounts.forEach((count, code) => {
    if (count > topErrorCodeCount) {
      topErrorCode = code;
      topErrorCodeCount = count;
    }
  });

  return { count: stepDocs.length, topErrorCode, topErrorCodeCount };
}

// نص السطر الصغير تحت كل رقم في بطاقة أخطاء التسجيل — undefined (مفيش سطر خالص) لو الـstep
// ده معندهوش أي أخطاء أصلًا، عشان ميظهرش "كود مش متسجل" تحت رقم صفر بشكل مضلل.
function authErrorSubtitle(detail: AuthErrorDetail): string | undefined {
  if (detail.count === 0) return undefined;
  if (!detail.topErrorCode) return "(كود الخطأ مش متسجل)";
  return `${detail.topErrorCode} (${detail.topErrorCodeCount} مرة)`;
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
type AuthErrorDetail = { count: number; topErrorCode: string | null; topErrorCodeCount: number };

type AuthErrorStats = {
  phone_send_code: AuthErrorDetail;
  phone_verify_code: AuthErrorDetail;
  google_popup_signin: AuthErrorDetail;
  google_redirect_signin: AuthErrorDetail;
};

export default function AdminPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "allowed">("loading");
  const [stats, setStats] = useState<Stats | null>(null);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [funnelError, setFunnelError] = useState(false);
  const [signupMethodStats, setSignupMethodStats] = useState<SignupMethodStats | null>(null);
  const [signupMethodError, setSignupMethodError] = useState(false);
  const [authErrorStats, setAuthErrorStats] = useState<AuthErrorStats | null>(null);
  const [authErrorStatsError, setAuthErrorStatsError] = useState(false);
  const [visits30d, setVisits30d] = useState<number | null>(null);
  const [visitsError, setVisitsError] = useState(false);
  const [jobViewCounts, setJobViewCounts] = useState<Record<string, number> | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
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

  // معزول برضو — مقارنة المشاهدات بالتقديمات تحسين إضافي في القايمة، مش لازم يوقف عرض
  // القايمة نفسها (اسم الوظيفة، عدد المتقدمين، إلخ) لو مجموعة job_views فشلت لأي سبب.
  async function loadJobViewStats() {
    try {
      const snap = await getDocs(collection(db, "job_views"));
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        counts[d.id] = d.data().count || 0;
      });
      setJobViewCounts(counts);
    } catch (err) {
      console.error("Admin job view stats failed", err);
      setJobViewCounts(null);
    }
  }

  async function loadCoreStats() {
    try {
      const oneDayAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

      const [seekersSnap, employersSnap, postsSnap, activePostsSnap, appsSnap, totalUsersSnap, activeUsersSnap, jobsSeoData] =
        await Promise.all([
          getDocs(collection(db, "job_seekers")),
          getDocs(collection(db, "employers")),
          getDocs(collection(db, "job_posts")),
          getDocs(query(collection(db, "job_posts"), where("isActive", "==", true))),
          getDocs(collection(db, "applications")),
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

      // "شركة ظاهرة للعامة" — نفس تعريف getCompanies في companies/page.tsx بالظبط: صاحب
      // عمل عنده على الأقل إعلان نشط، اسمه ظاهر، ومش منتهي الصلاحية. بنحسبها من postsSnap
      // الموجودة بالفعل هنا بدل ما نعمل query إضافي.
      const now = Date.now();
      const visibleCompanyIds = new Set(
        postsSnap.docs
          .map((d) => d.data() as any)
          .filter((p) => p.isActive === true && p.showCompanyName === true && (!p.expiresAt || p.expiresAt.toMillis() > now))
          .map((p) => p.employerId)
      );

      setStats({
        seekers: seekersSnap.size,
        employers: employersSnap.size,
        premium: premiumCount,
        visibleCompanies: visibleCompanyIds.size,
        allPosts: postsSnap.size,
        activePosts: activePostsSnap.size,
        applications: appsSnap.size,
        totalUsers: totalUsersSnap.size,
        activeUsers24h: activeUsersSnap.size,
      });

      const appCounts: Record<string, number> = {};
      appsSnap.docs.forEach((d) => {
        const jid = d.data().jobPostId;
        appCounts[jid] = (appCounts[jid] || 0) + 1;
      });

      const postsList = postsSnap.docs
        .map((d) => ({ id: d.id, ...d.data(), applicantCount: appCounts[d.id] || 0 } as any))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      setPosts(postsList);
    } catch (err) {
      console.error("Admin stats failed", err);
    }
  }

  async function loadStats() {
    setLoadingStats(true);
    await Promise.all([loadCoreStats(), loadFunnelStats(), loadSignupMethodStats(), loadAuthErrorStats(), loadVisitStats(), loadJobViewStats()]);
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

  return (
    <div dir="rtl" style={{ maxWidth: 900, margin: "0 auto", padding: "30px 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>لوحة الإدارة</h1>
      <p style={{ color: "#4A5568", marginBottom: 20 }}>إحصائيات عامة عن الموقع</p>

      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard label="نشطين آخر 24 ساعة" value={stats.activeUsers24h} />
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

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
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
          // lo jobViewCounts نفسها فشلت تجيب خالص (null)، مش عارفين المشاهدات فعلاً فبنخفي
          // السطر كله زي الأول — لكن لو جبناها بنجاح وبس الوظيفة دي معندهاش مستند، الافتراض
          // 0 (مش إخفاء) عشان يبان إنها "لسه محدش شافها" مش إن الميزة نفسها مش شغالة.
          const views = jobViewCounts ? jobViewCounts[p.id] ?? 0 : null;
          const conversionRate = views && views > 0 ? Math.round((p.applicantCount / views) * 100) : null;
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
                  <span style={applicantBadgeStyle}>👥 {p.applicantCount} متقدم</span>
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
                    👥 عرض المتقدمين ({p.applicantCount})
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
                  <div style={{ padding: 12, color: "#4A5568" }}>لسه محدش قدّم على الإعلان ده.</div>
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
