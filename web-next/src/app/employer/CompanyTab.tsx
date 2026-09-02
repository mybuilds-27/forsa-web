"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import EmployerOnboardingForm from "./EmployerOnboardingForm";
import { toggleJobActive, deleteJobPost, fetchApplicants, exportApplicantsExcel } from "@/lib/jobPostActions";
import { EXPERIENCE_LEVELS } from "@/lib/constants";
import { CONTACT_METHOD_LABELS, contactApplyText } from "@/lib/contactMethodLabels";
import ShareButton from "@/components/ShareButton";
import ApplicantCard from "@/components/ApplicantCard";
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

type JobPost = {
  id: string;
  title: string;
  specialization: string;
  city: string;
  governorate: string;
  jobType: string;
  jobLevel?: string;
  screeningQuestions?: { id: string; text: string; type: "text" | "number"; required: boolean }[];
  description?: string;
  isActive?: boolean;
  featured?: boolean;
  createdAt?: any;
  expiresAt?: any;
  vacancies?: number;
  salaryNegotiable?: boolean;
  salaryFrom?: number;
  salaryTo?: number;
  showSalary?: boolean;
  ageFrom?: number;
  ageTo?: number;
  needsCar?: string;
  requirements?: string;
  hoursPerDay?: number;
  daysOffPerMonth?: number;
  socialInsurance?: string;
  privateHealthInsurance?: string;
  transportationAvailable?: string;
  transportationAreas?: string;
  housingForExpats?: string;
  additionalBenefits?: string;
  showCompanyName?: boolean;
  receiveMethod?: string;
  contactMethod?: string;
  contactValue?: string;
};

function formatDate(ts: any) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ar-EG");
}

function salaryText(p: JobPost) {
  if (p.showSalary === false) return "غير محدد";
  if (p.salaryNegotiable) return "قابل للتفاوض / حسب الخبرة";
  if (p.salaryFrom && p.salaryTo) return `${p.salaryFrom} - ${p.salaryTo} جنيه`;
  if (p.salaryFrom) return `يبدأ من ${p.salaryFrom} جنيه`;
  return "غير محدد";
}

type Props = {
  companyData: any;
  onCompanyUpdated: () => void;
  onEditPost: (id: string, data: any) => void;
};

export default function CompanyTab({ companyData, onCompanyUpdated, onEditPost }: Props) {
  const [editing, setEditing] = useState(false);
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [openApplicantsFor, setOpenApplicantsFor] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [applicantsError, setApplicantsError] = useState("");
  const [detailPost, setDetailPost] = useState<JobPost | null>(null);

  async function loadMyJobPosts() {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);

    try {
      const snap = await getDocs(query(collection(db, "job_posts"), where("employerId", "==", user.uid)));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobPost));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      const now = Date.now();
      for (const p of list) {
        if (p.isActive !== false && p.expiresAt && p.expiresAt.toMillis() < now) {
          p.isActive = false;
          updateDoc(doc(db, "job_posts", p.id), { isActive: false }).catch(() => {});
        }
      }

      setPosts(list);

      // عدد المشاهدات لكل وظيفة (job_views/{jobPostId})، قراءة منفصلة لكل وظيفة (مش استعلام
      // على المجموعة كلها) عشان تتوافق مع قاعدة الأمان اللي بتسمح بقراءة مستند وظيفة واحدة
      // بس لصاحبها (أو الأدمن) — Promise.allSettled عشان فشل وظيفة واحدة ميمنعش باقي الأعداد.
      try {
        const viewResults = await Promise.allSettled(list.map((p) => getDoc(doc(db, "job_views", p.id))));
        const views: Record<string, number> = {};
        viewResults.forEach((result, i) => {
          if (result.status === "fulfilled") {
            views[list[i].id] = result.value.exists() ? result.value.data().count || 0 : 0;
          }
        });
        setViewCounts(views);
      } catch (err) {
        console.error("[loadMyJobPosts] فشل جلب عدد المشاهدات (job_views)", err);
      }
    } catch (err) {
      console.error("[loadMyJobPosts] فشل استعلام job_posts", err);
    }

    try {
      const appsSnap = await getDocs(query(collection(db, "applications"), where("employerId", "==", user.uid)));
      const counts: Record<string, number> = {};
      appsSnap.docs.forEach((d) => {
        const jid = d.data().jobPostId;
        counts[jid] = (counts[jid] || 0) + 1;
      });
      setApplicantCounts(counts);
    } catch (err) {
      console.error("[loadMyJobPosts] فشل استعلام applicantCounts (applications)", err);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadMyJobPosts();
  }, []);

  async function toggleActive(postId: string, makeActive: boolean) {
    await toggleJobActive(postId, makeActive);
    loadMyJobPosts();
  }

  async function handleDelete(postId: string) {
    if (!confirm('متأكد إنك عايز تحذف الإعلان نهائيًا؟ الأفضل تستخدم "إيقاف الإعلان" بدل الحذف لو ممكن ترجعله لاحقًا.')) return;
    await deleteJobPost(postId);
    setDetailPost(null);
    loadMyJobPosts();
  }

  async function toggleApplicants(postId: string) {
    const user = auth.currentUser;
    if (!user) return;
    if (openApplicantsFor === postId) {
      setOpenApplicantsFor(null);
      return;
    }
    setOpenApplicantsFor(postId);
    setApplicants([]);
    setApplicantsError("");
    setLoadingApplicants(true);
    try {
      setApplicants(await fetchApplicants(postId, user.uid));
    } catch (err) {
      console.error("Fetch applicants failed", err);
      setApplicantsError("حصل خطأ أثناء تحميل المتقدمين، حاول مرة أخرى.");
    } finally {
      setLoadingApplicants(false);
    }
  }

  function exportExcel(postId: string, jobTitle: string, screeningQuestions?: JobPost["screeningQuestions"]) {
    const user = auth.currentUser;
    if (!user) return;
    exportApplicantsExcel(postId, jobTitle, user.uid, screeningQuestions || []);
  }

  if (editing) {
    return (
      <EmployerOnboardingForm
        initialData={companyData}
        onSaved={() => {
          setEditing(false);
          onCompanyUpdated();
        }}
      />
    );
  }

  return (
    <div dir="rtl" style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 16 }}>بيانات شركتك</h2>

      <div style={{ border: "1px solid #14213D22", borderRadius: 10, padding: 20, marginBottom: 10 }}>
        {companyData.logoURL && (
          <img src={companyData.logoURL} alt="لوجو الشركة" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={tagStyle}>{companyData.companyName}</span>
          {companyData.industry && <span style={tagStyle}>{companyData.industry}</span>}
          <span style={tagStyle}>{companyData.city} - {companyData.governorate}</span>
        </div>
        <p style={{ color: "#4A5568", fontSize: 14 }}>
          مسؤول التواصل: {companyData.contactPerson || "—"} · {companyData.phone || "—"}
        </p>
      </div>

      <button
        onClick={() => setEditing(true)}
        style={{ padding: "10px 20px", background: "#14213D", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", marginBottom: 30 }}
      >
        تعديل بيانات الشركة
      </button>

      <h2 style={{ marginBottom: 16 }}>إعلاناتك المنشورة</h2>

      {loading && <p>جاري التحميل...</p>}
      {!loading && posts.length === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>لسه ما نشرتش أي إعلان وظيفة.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {posts.map((p) => {
          const appCount = applicantCounts[p.id] || 0;
          const views = viewCounts[p.id];
          const daysLeft = p.expiresAt ? Math.ceil((p.expiresAt.toMillis() - Date.now()) / 86400000) : null;
          const isPaused = p.isActive === false;
          const isContactMethod = p.receiveMethod === "contact";
          return (
            <div
              key={p.id}
              style={{
                ...jobCardContainerStyle,
                border: isPaused ? "1px solid #14213D22" : jobCardContainerStyle.border,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ cursor: "pointer", flex: 1, minWidth: 240 }} onClick={() => setDetailPost(p)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={isPaused ? pausedPillStyle : activePillStyle}>
                        {isPaused ? "⏸ متوقف" : "● نشط"}
                      </span>
                      {p.featured && <span style={featuredPillStyle}>⭐ مميز</span>}
                    </div>
                    <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#14213D" }}>{p.title}</h3>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: "#4A5568", marginBottom: 10 }}>
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
                    {p.description && (
                      <p style={{ fontSize: 14, color: "#37414F", lineHeight: 1.6, margin: "0 0 6px" }}>
                        {p.description.slice(0, 130)}{p.description.length > 130 ? "…" : ""}
                      </p>
                    )}
                    <span style={{ fontSize: 12.5, color: "#14213D", fontWeight: 700, textDecoration: "underline" }}>
                      عرض التفاصيل الكاملة
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span style={applicantBadgeStyle}>
                      {isContactMethod ? `📞 ${contactApplyText(p)}` : `👥 ${appCount} متقدم`}
                    </span>
                    {views !== undefined && (
                      <span style={{ fontSize: 12, color: "#4A5568", whiteSpace: "nowrap" }}>👁️ {views} مشاهدة</span>
                    )}
                    <span style={{ fontSize: 12, color: "#4A5568", whiteSpace: "nowrap" }}>
                      {formatDate(p.createdAt)}
                      {!isPaused && daysLeft !== null ? ` · باقي ${daysLeft} يوم` : ""}
                    </span>
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
                    <button onClick={() => toggleApplicants(p.id)} style={primaryActionStyle}>
                      {isContactMethod ? "👥 عرض المتقدمين" : `👥 عرض المتقدمين (${appCount})`}
                    </button>
                    {appCount > 0 && (
                      <button onClick={() => exportExcel(p.id, p.title, p.screeningQuestions)} style={ghostActionStyle}>⬇ تحميل Excel</button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => onEditPost(p.id, p)} style={toolBtnStyle}>✎ تعديل</button>
                    <button onClick={() => toggleActive(p.id, isPaused)} style={toolBtnStyle}>
                      {isPaused ? "▶ تفعيل" : "⏸ إيقاف"}
                    </button>
                    <ShareButton jobId={p.id} title={p.title} />
                    <button onClick={() => handleDelete(p.id)} style={dangerToolBtnStyle}>✕ حذف</button>
                  </div>
                </div>
              </div>

              {openApplicantsFor === p.id && (
                <div style={{ padding: "16px 20px 18px", borderTop: "1px solid #14213D14", display: "flex", flexDirection: "column", gap: 12 }}>
                  {loadingApplicants ? (
                    <div style={{ padding: 12, color: "#4A5568" }}>جاري التحميل...</div>
                  ) : applicantsError ? (
                    <div style={{ padding: 12, color: "#B03A14" }}>{applicantsError}</div>
                  ) : applicants.length === 0 ? (
                    <div style={{ padding: 12, color: "#4A5568" }}>
                      {isContactMethod
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

      {/* مودال تفاصيل الوظيفة الكاملة */}
      {detailPost && (
        <div
          onClick={() => setDetailPost(null)}
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
              maxWidth: 550,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <button
              onClick={() => setDetailPost(null)}
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

            <h2 style={{ marginBottom: 4 }}>{detailPost.title}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={tagStyle}>{detailPost.specialization}</span>
              <span style={tagStyle}>{detailPost.city} - {detailPost.governorate}</span>
              <span style={tagStyle}>{JOB_TYPE_LABELS[detailPost.jobType] || detailPost.jobType}</span>
              {detailPost.jobLevel && <span style={tagStyle}>{EXPERIENCE_LEVELS[detailPost.jobLevel] || detailPost.jobLevel}</span>}
              {detailPost.featured && <span style={tagStyle}>⭐ مميز</span>}
            </div>

            <p style={{ lineHeight: 1.7, marginBottom: 12 }}>{detailPost.description}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13.5 }}>
              <DetailRow label="الراتب" value={salaryText(detailPost)} />
              <DetailRow label="عدد الفرص المتاحة" value={detailPost.vacancies ? `${detailPost.vacancies} فرصة` : undefined} />
              <DetailRow
                label="السن المطلوب"
                value={
                  detailPost.ageFrom && detailPost.ageTo
                    ? `${detailPost.ageFrom} - ${detailPost.ageTo} سنة`
                    : detailPost.ageFrom
                    ? `من ${detailPost.ageFrom} سنة`
                    : detailPost.ageTo
                    ? `لحد ${detailPost.ageTo} سنة`
                    : undefined
                }
              />
              <DetailRow label="محتاج عربية" value={detailPost.needsCar === "yes" ? "أيوة ✓" : detailPost.needsCar === "no" ? "لأ" : undefined} />
              <DetailRow label="ساعات العمل يوميًا" value={detailPost.hoursPerDay ? `${detailPost.hoursPerDay} ساعات` : undefined} />
              <DetailRow label="أيام الراحة شهريًا" value={detailPost.daysOffPerMonth !== undefined && detailPost.daysOffPerMonth !== null ? `${detailPost.daysOffPerMonth} يوم` : undefined} />
              <DetailRow label="تأمين اجتماعي" value={detailPost.socialInsurance === "yes" ? "متوفر ✓" : detailPost.socialInsurance === "no" ? "غير متوفر" : undefined} />
              <DetailRow label="تأمين صحي خاص" value={detailPost.privateHealthInsurance === "yes" ? "متوفر ✓" : detailPost.privateHealthInsurance === "no" ? "غير متوفر" : undefined} />
              <DetailRow label="مواصلات" value={detailPost.transportationAvailable === "yes" ? "متوفرة ✓" : detailPost.transportationAvailable === "no" ? "غير متوفرة" : undefined} />
              <DetailRow label="سكن المغتربين" value={detailPost.housingForExpats === "yes" ? "متوفر ✓" : detailPost.housingForExpats === "no" ? "غير متوفر" : undefined} />
            </div>

            {detailPost.transportationAreas && (
              <p style={{ marginTop: 10 }}><strong>أماكن المواصلات:</strong> {detailPost.transportationAreas}</p>
            )}
            {detailPost.requirements && (
              <p style={{ marginTop: 10 }}><strong>الشروط:</strong> {detailPost.requirements}</p>
            )}
            {detailPost.additionalBenefits && (
              <p style={{ marginTop: 10 }}><strong>مزايا إضافية:</strong> {detailPost.additionalBenefits}</p>
            )}
            {detailPost.receiveMethod === "contact" && detailPost.contactValue && (
              <p style={{ marginTop: 10 }}>
                <strong>التواصل ({{ email: "إيميل", whatsapp: "واتساب", phone: "تليفون" }[detailPost.contactMethod || ""] || detailPost.contactMethod}):</strong> {detailPost.contactValue}
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { onEditPost(detailPost.id, detailPost); setDetailPost(null); }}
                style={{ padding: "10px 20px", background: "#14213D", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                ✎ تعديل الإعلان
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span style={{ fontWeight: 700 }}>{label}: </span>
      <span>{value}</span>
    </div>
  );
}

