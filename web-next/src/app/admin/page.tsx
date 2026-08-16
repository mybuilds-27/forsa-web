"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import ShareButton from "@/components/ShareButton";
import PostJobTab from "../employer/PostJobTab";
import Link from "next/link";
import { toggleJobActive, deleteJobPost, fetchApplicants, exportApplicantsCSV } from "@/lib/jobPostActions";
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

export default function AdminPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "allowed">("loading");
  const [stats, setStats] = useState<Stats | null>(null);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [seoData, setSeoData] = useState<{ governorates: string[]; specializations: string[]; combos: JobCombo[] } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [editingPost, setEditingPost] = useState<EditingPost>(null);
  const [openApplicantsFor, setOpenApplicantsFor] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);

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

  async function loadStats() {
    setLoadingStats(true);
    try {
      const oneDayAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

      const [
        seekersSnap,
        employersSnap,
        postsSnap,
        activePostsSnap,
        appsSnap,
        totalUsersSnap,
        activeUsersSnap,
        recentUsersSnap,
        funnelEventsSnap,
        jobsSeoData,
      ] = await Promise.all([
        getDocs(collection(db, "job_seekers")),
        getDocs(collection(db, "employers")),
        getDocs(collection(db, "job_posts")),
        getDocs(query(collection(db, "job_posts"), where("isActive", "==", true))),
        getDocs(collection(db, "applications")),
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "users"), where("lastActiveAt", ">=", oneDayAgo))),
        getDocs(query(collection(db, "users"), where("createdAt", ">=", sevenDaysAgo))),
        getDocs(query(collection(db, "registration_funnel_events"), where("timestamp", ">=", sevenDaysAgo))),
        getActiveJobsSeoData(),
      ]);

      // "أكمل التسجيل" مش ليها حدث قمع منفصل — بتتحسب مباشرة من users بنفس فترة الـ7 أيام
      // اللي بيتحسب فيها باقي القمع، عشان النسب تكون متسقة.
      setFunnelStats({
        roleSelected: funnelEventsSnap.docs.filter((d) => d.data().step === "role_selected").length,
        methodSelected: funnelEventsSnap.docs.filter((d) => d.data().step === "method_selected").length,
        completed: recentUsersSnap.size,
      });

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
    setLoadingStats(false);
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
        </div>
      )}

      {funnelStats && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>قمع التسجيل (آخر 7 أيام)</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <FunnelStepCard label="اختار دور" value={funnelStats.roleSelected} />
            <FunnelArrow from={funnelStats.roleSelected} to={funnelStats.methodSelected} />
            <FunnelStepCard label="اختار طريقة تسجيل" value={funnelStats.methodSelected} />
            <FunnelArrow from={funnelStats.methodSelected} to={funnelStats.completed} />
            <FunnelStepCard label="أكمل التسجيل" value={funnelStats.completed} />
          </div>
        </div>
      )}

      <button
        onClick={loadStats}
        disabled={loadingStats}
        style={{
          padding: "8px 16px",
          border: "1px solid #14213D",
          background: "transparent",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 30,
        }}
      >
        {loadingStats ? "جاري التحديث..." : "🔄 تحديث"}
      </button>

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
                    <button onClick={() => exportApplicantsCSV(p.id, p.title, p.employerId)} style={ghostActionStyle}>⬇ تحميل Excel</button>
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

function FunnelStepCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #14213D22", borderRadius: 8, padding: "12px 16px", textAlign: "center", minWidth: 120, flex: "1 1 120px" }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#4A5568" }}>{label}</div>
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
