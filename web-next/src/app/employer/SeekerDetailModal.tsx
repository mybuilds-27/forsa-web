"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { MILITARY_STATUS_LABELS, SKILL_LEVELS, LANGUAGE_LEVELS, EXPERIENCE_LEVELS } from "@/lib/constants";
import { educationDisplay, normalizeEntries, formatEntries } from "@/lib/profileFields";
import { revealSeekerContact } from "@/lib/seekerContact";
import EmailVerificationNotice from "@/components/EmailVerificationNotice";
import UpgradeModal from "./UpgradeModal";
import InviteToJobModal from "./InviteToJobModal";
import { buildWhatsAppChatLink, buildWhatsAppLink, talentWhatsAppMessage, whatsappButtonStyle } from "@/lib/whatsappLink";

// نفس حد الدعوات الشهري (30 للباقة المدفوعة) لكن على كشف بيانات التواصل — بنعتبر كشف
// بيانات نفس الباحث أكتر من مرة في نفس الشهر عملية واحدة بس (زي الدعوات بالظبط: doc id
// ثابت employerId_seekerId بيتحدّث بـsetDoc بدل ما يتكرر)، عشان الحد يبقى 30 باحث مختلف
// شهريًا مش 30 دوسة.
export const MONTHLY_CONTACT_REVEAL_LIMIT = 30;

// نفس القايمة المستخدمة في InviteToJobModal.tsx وgetApplicantProfileForAutoCV — الأدمن
// مستثنى تمامًا من حد الكشف الشهري (أغراض مراجعة وإشراف)، بغض النظر عن قيمة employerPlan
// اللي وصلته (ممكن يكون عنده حساب صاحب عمل خاص بيه بأي باقة).
const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

const EDUCATION_LABELS: Record<string, string> = {
  none: "بدون مؤهل دراسي",
  literacy: "محو أمية",
  primary: "ابتدائية",
  preparatory: "إعدادية",
  secondary: "ثانوية عامة / دبلوم",
  bachelor: "بكالوريوس/ليسانس",
  master: "ماجستير",
  phd: "دكتوراه",
};

// نفس صيغة formatDateTime المستخدمة في admin/page.tsx بالظبط — تاريخ ووقت دقيقين، مش
// مؤشر نسبي زي "نشط مؤخرًا" في البطاقة المختصرة (TalentSearchTab.tsx). ظاهرة هنا لكل من
// يفتح المودال (أدمن أو صاحب عمل) عمدًا — فتح المودال نفسه أصلًا محكوم برصيد صاحب العمل
// المحدود (كشف بيانات التواصل للباقة المدفوعة)، فمش نفس حساسية عرض تاريخ دقيق في قايمة
// بطاقات مفتوحة للتصفح الحر زي ApplicantCard.tsx.
function formatUpdatedAt(ts: { toDate?: () => Date } | undefined): string {
  if (!ts?.toDate) return "غير معروف";
  return ts.toDate().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  remote: "عن بعد",
  freelance: "فريلانس",
  no_preference: "لا يوجد تفضيل",
};

type Props = {
  seeker: any;
  employerPlan: string;
  defaultInviteJobId?: string;
  // زرار واتساب بيظهر بس لو اتبعت (من TalentSearchTab.tsx) وبعد الكشف، يعني لما التليفون ظاهر فعلًا.
  whatsappCompanyName?: string;
  onClose: () => void;
};

type ContactState =
  | "loading"
  | "allowed"
  | "limit-reached"
  | "email-unverified"
  | "plan-inactive"
  | "not-found"
  | "unauthenticated"
  | "error";

// أكواد Cloud Functions بتوصل للكلاينت بصيغة "functions/<code>"
function functionErrorCode(err: unknown): string {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
  return code.replace(/^functions\//, "");
}

export default function SeekerDetailModal({ seeker: s, employerPlan, defaultInviteJobId, whatsappCompanyName, onClose }: Props) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const isPremium = employerPlan === "premium";
  const education = educationDisplay(EDUCATION_LABELS[s.educationLevel] || s.educationLevel || "", s.fieldOfStudy);
  const isAdmin = ADMIN_EMAILS.includes(auth.currentUser?.email || "");
  // الكشف للباقة المدفوعة وللأدمن بس — الباقة المجانية بتشوف زرار الترقية من غير أي نداء للدالة
  const canReveal = isPremium || isAdmin;
  // النتيجة مربوطة بالباحث اللي اتجابت له (resultSeekerId): لو المودال فضل مفتوح واتغيّر الباحث،
  // contactState بيرجع "loading" لحد ما نتيجة الباحث الجديد توصل، فبيانات الأول متظهرش تحت اسم التاني.
  const [rawContactState, setContactState] = useState<ContactState>("loading");
  const [resultSeekerId, setResultSeekerId] = useState<string | null>(null);
  const contactState: ContactState = resultSeekerId === s.id ? rawContactState : "loading";
  const [contact, setContact] = useState<{ phone: string; email: string; cvFileURL: string }>({ phone: "", email: "", cvFileURL: "" });
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [revealLimit, setRevealLimit] = useState(MONTHLY_CONTACT_REVEAL_LIMIT);
  const [attempt, setAttempt] = useState(0);
  // نداء واحد بس لكل (باحث، محاولة) حتى لو الـeffect اتنفذ مرتين (StrictMode في dev بيعمل
  // mount/unmount/mount)، والنتيجة بتتطبق بس لو لسه هي آخر طلب والمودال لسه مفتوح. الدالة نفسها
  // بتحسب نفس الباحث مرة واحدة في الشهر كمان، فده بس عشان منبعتش طلبات زيادة.
  const inFlightRef = useRef<string | null>(null);
  const latestKeyRef = useRef("");
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!canReveal) return;
    const seekerId = s.id;
    const requestKey = `${seekerId}:${attempt}`;
    latestKeyRef.current = requestKey;
    if (inFlightRef.current === requestKey) return;
    inFlightRef.current = requestKey;
    const isCurrent = () => mountedRef.current && latestKeyRef.current === requestKey;
    // بيانات التواصل من Cloud Function (revealSeekerContact) مش من مستند job_seekers العام: الدالة
    // بتتحقق من الباقة السارية وتأكيد الإيميل وموافقة الباحث والحد الشهري، وبتسجّل contact_reveals
    // على السيرفر. الأدمن بيعدّي من الفحوصات دي ومبيتسجّلش له عداد (جوه الدالة).
    (async () => {
      try {
        const result = await revealSeekerContact(seekerId);
        if (!isCurrent()) return;
        setResultSeekerId(seekerId);
        if (result.status === "allowed") {
          setContact({ phone: result.phone || "", email: result.email || "", cvFileURL: result.cvFileURL || "" });
          setContactState("allowed");
        } else if (result.status === "limit-reached") {
          setRevealLimit(result.limit);
          setContactState("limit-reached");
        } else {
          setUnverifiedEmail(result.email);
          setContactState("email-unverified");
        }
      } catch (err) {
        if (!isCurrent()) return;
        setResultSeekerId(seekerId);
        const code = functionErrorCode(err);
        console.error("[SeekerDetailModal] فشل كشف بيانات التواصل", code, err);
        if (code === "permission-denied") setContactState("plan-inactive");
        else if (code === "not-found") setContactState("not-found");
        else if (code === "unauthenticated") setContactState("unauthenticated");
        else setContactState("error");
      } finally {
        if (inFlightRef.current === requestKey) inFlightRef.current = null;
      }
    })();
  }, [canReveal, s.id, attempt]);

  function retryReveal() {
    if (contactState === "loading") return;
    setContactState("loading");
    setAttempt((n) => n + 1);
  }

  const skills = normalizeEntries(s.skills);
  const languages = normalizeEntries(s.languages);
  const workExperience = s.workExperience || [];

  return (
    <>
      <div
        onClick={onClose}
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
            maxWidth: 600,
            width: "100%",
            maxHeight: "85vh",
            overflowY: "auto",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
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

          {s.photoURL && (
            <img src={s.photoURL} alt={s.fullName || "باحث عن عمل"} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%", marginBottom: 14 }} />
          )}
          <h2 style={{ marginBottom: 4 }}>{s.fullName || "بدون اسم"}</h2>
          <div style={{ color: "#4A5568", marginBottom: 4 }}>{s.jobTitle || ""}</div>
          <div style={{ fontSize: 12.5, color: "#4A5568", marginBottom: 12 }}>
            آخر تحديث للملف الشخصي: {formatUpdatedAt(s.updatedAt)}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {s.specialization && <span style={tagStyle}>{s.specialization}</span>}
            {(s.city || s.governorate) && <span style={tagStyle}>{s.city} - {s.governorate}</span>}
            <span style={tagStyle}>{s.yearsOfExperience || 0} سنوات خبرة</span>
            {s.jobLevel && <span style={tagStyle}>{EXPERIENCE_LEVELS[s.jobLevel] || s.jobLevel}</span>}
            {s.jobType && <span style={tagStyle}>{JOB_TYPE_LABELS[s.jobType] || s.jobType}</span>}
            {education && (
              <span style={tagStyle}>{education.label === "المؤهل" ? education.value : `${education.label}: ${education.value}`}</span>
            )}
          </div>

          {s.bio && <p style={{ lineHeight: 1.7, marginBottom: 12 }}>{s.bio}</p>}

          {skills.length > 0 && (
            <div style={{ marginBottom: 8, fontSize: 14 }}>
              <strong>المهارات:</strong> {formatEntries(skills, SKILL_LEVELS)}
            </div>
          )}
          {languages.length > 0 && (
            <div style={{ marginBottom: 8, fontSize: 14 }}>
              <strong>اللغات:</strong> {formatEntries(languages, LANGUAGE_LEVELS)}
            </div>
          )}
          {s.gender === "male" && s.militaryStatus && (
            <div style={{ marginBottom: 8, fontSize: 14 }}>
              <strong>حالة التجنيد:</strong> {MILITARY_STATUS_LABELS[s.militaryStatus] || s.militaryStatus}
            </div>
          )}
          {s.showSalaryToEmployers && s.expectedSalary && (
            <div style={{ marginBottom: 8, fontSize: 14 }}>
              <strong>الراتب المتوقع:</strong> {s.expectedSalary} جنيه
            </div>
          )}

          {workExperience.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>الخبرات السابقة</h3>
              {workExperience.map((row: any, i: number) => (
                <div key={i} style={{ background: "#F5EFDE", borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 13.5 }}>
                  <strong>{row.jobTitle || ""}</strong>
                  {!s.hideCompanyNames && row.company ? ` — ${row.company}` : ""}
                  <div style={{ color: "#4A5568", marginTop: 4 }}>
                    {row.fromDate || ""} {row.fromDate || row.toDate ? "—" : ""} {row.isCurrent ? "حتى الآن" : row.toDate || ""}
                  </div>
                  {row.responsibilities && <div style={{ marginTop: 4 }}>{row.responsibilities}</div>}
                </div>
              ))}
            </div>
          )}

          <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid #14213D22" }} />

          {canReveal && contactState === "loading" && (
            <div style={{ fontSize: 13.5, color: "#4A5568" }}>جارٍ تحميل بيانات التواصل...</div>
          )}

          {canReveal && contactState === "email-unverified" && (
            <EmailVerificationNotice email={unverifiedEmail} audience="employer" />
          )}

          {canReveal && contactState === "limit-reached" && (
            <div style={noticeBoxStyle}>
              <p style={{ fontSize: 13.5, color: "#B03A14", margin: 0 }}>
                لقد بلغت الحد الشهري لكشف بيانات التواصل في الباقة المدفوعة ({revealLimit} مرشحًا). يتجدد الرصيد في بداية الشهر القادم.
              </p>
            </div>
          )}

          {canReveal && contactState === "plan-inactive" && (
            <div style={noticeBoxStyle}>
              <p style={{ fontSize: 13.5, color: "#4A5568", marginBottom: 12 }}>
                انتهى اشتراك الباقة المدفوعة أو تم إيقاف الحساب، لذا لا يمكن عرض بيانات التواصل حاليًا.
              </p>
              <button onClick={() => setShowUpgrade(true)} style={upgradeButtonStyle}>
                تجديد الباقة المدفوعة
              </button>
            </div>
          )}

          {canReveal && contactState === "not-found" && (
            <div style={noticeBoxStyle}>
              <p style={{ fontSize: 13.5, color: "#4A5568", margin: 0 }}>
                هذا الملف لم يعد متاحًا، وربما أوقف صاحبه ظهوره لأصحاب الأعمال.
              </p>
            </div>
          )}

          {canReveal && contactState === "unauthenticated" && (
            <div style={noticeBoxStyle}>
              <p style={{ fontSize: 13.5, color: "#4A5568", margin: 0 }}>
                يرجى تسجيل الدخول مرة أخرى لعرض بيانات التواصل.
              </p>
            </div>
          )}

          {canReveal && contactState === "error" && (
            <div style={noticeBoxStyle}>
              <p style={{ fontSize: 13.5, color: "#4A5568", marginBottom: 12 }}>
                تعذّر تحميل بيانات التواصل. يرجى المحاولة مرة أخرى.
              </p>
              <button onClick={retryReveal} style={upgradeButtonStyle}>
                إعادة المحاولة
              </button>
            </div>
          )}

          {canReveal && contactState === "allowed" ? (
            <div>
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>بيانات التواصل</h3>
              <div style={{ fontSize: 14.5, marginBottom: 6 }}>الهاتف: <strong>{contact.phone || "—"}</strong></div>
              {(() => {
                // من البحث عن كوادر (اسم الشركة متبعت): برسالة جاهزة؛ من "مين شاف الوظيفة": من غير رسالة
                const whatsappLink = whatsappCompanyName
                  ? buildWhatsAppLink(contact.phone, talentWhatsAppMessage(whatsappCompanyName))
                  : buildWhatsAppChatLink(contact.phone);
                return whatsappLink ? (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ ...whatsappButtonStyle, marginBottom: 6 }}>
                    مراسلة عبر واتساب
                  </a>
                ) : null;
              })()}
              {contact.email && <div style={{ fontSize: 14.5, marginBottom: 6 }}>البريد الإلكتروني: {contact.email}</div>}
              {contact.cvFileURL && (
                <a href={contact.cvFileURL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, color: "#14213D" }}>
                  السيرة الذاتية
                </a>
              )}
              <button
                onClick={() => setShowInvite(true)}
                style={{ display: "block", marginTop: 14, padding: "8px 16px", background: "#14213D", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13.5 }}
              >
                ادعُه للتقديم على وظيفة
              </button>
            </div>
          ) : !canReveal ? (
            <div style={{ background: "#F5EFDE", padding: 16, borderRadius: 8 }}>
              <p style={{ fontSize: 13.5, color: "#4A5568", marginBottom: 12 }}>
                التواصل المباشر مع المرشحين (الهاتف، البريد الإلكتروني، السيرة الذاتية) متاح للباقة المدفوعة فقط.
              </p>
              <button
                onClick={() => setShowUpgrade(true)}
                style={{ padding: "8px 16px", background: "#E8A33D", color: "#14213D", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13.5 }}
              >
                اطلب الترقية للباقة المدفوعة
              </button>
              {/* الدعوة للتقديم متاحة للباقة المجانية كمان (InviteToJobModal بتدعمها فعليًا،
                  حد 5 دعوات شهريًا) — القيد على المدفوعة بس هو كشف بيانات التواصل فوق. */}
              <button
                onClick={() => setShowInvite(true)}
                style={{ display: "block", marginTop: 10, padding: "8px 16px", background: "#14213D", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13.5 }}
              >
                ادعُه للتقديم على وظيفة
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      {showInvite && (
        <InviteToJobModal
          seekerId={s.id}
          seekerName={s.fullName || ""}
          employerPlan={employerPlan}
          defaultJobId={defaultInviteJobId}
          onClose={() => setShowInvite(false)}
        />
      )}
    </>
  );
}

const tagStyle: React.CSSProperties = { fontSize: 12, background: "#F0EDE3", padding: "3px 10px", borderRadius: 999 };

const noticeBoxStyle: React.CSSProperties = { background: "#F5EFDE", padding: 16, borderRadius: 8 };

const upgradeButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#E8A33D",
  color: "#14213D",
  border: "none",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13.5,
};
