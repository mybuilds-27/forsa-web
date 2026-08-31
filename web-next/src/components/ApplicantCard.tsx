"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { normalizeEntries, SkillEntry } from "@/lib/profileFields";
import { MILITARY_STATUS_LABELS, SKILL_LEVELS, LANGUAGE_LEVELS } from "@/lib/constants";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import CVPreview from "./CVPreview";
import {
  jobCardContainerStyle,
  tagStyle,
  ghostActionStyle,
  ApplicationStatus,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_ORDER,
  APPLICATION_STATUS_STYLES,
  applicationStatusOf,
} from "@/lib/jobCardStyles";
import { TagIcon, PinIcon, BriefcaseIcon, ShieldIcon, DocumentIcon } from "./icons";

// تحت النسبة دي، البروفايل شحيح جدًا (مش بس ناقص شوية) — لسه بنعرض السيرة الذاتية عادي
// (المتاح من البيانات، مهما قلّ)، بس بنضيف تنويه فوقها إن البيانات لسه غير مكتملة.
const LOW_COMPLETION_WARNING_THRESHOLD = 25;

type ScreeningQuestion = { id: string; text: string; type: "text" | "number"; required: boolean };

type Props = {
  applicant: { seekerSnapshot?: any; screeningAnswers?: Record<string, string>; jobPostId?: string; seekerId?: string; status?: string };
  screeningQuestions?: ScreeningQuestion[];
};

// نسخة مكبّرة من tagStyle/ghostActionStyle المشتركة، خاصة بكارت المتقدم بس — عشان متأثرش على كروت الوظائف في باقي الموقع
const bigTagStyle: React.CSSProperties = { ...tagStyle, fontSize: 14, padding: "4px 12px" };
const bigGhostActionStyle: React.CSSProperties = { ...ghostActionStyle, fontSize: 15, padding: "10px 16px" };

export default function ApplicantCard({ applicant: a, screeningQuestions }: Props) {
  const s = a.seekerSnapshot || {};
  const skills = normalizeEntries(s.skills);
  const languages = normalizeEntries(s.languages);

  const [status, setStatus] = useState<ApplicationStatus>(applicationStatusOf(a));
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [showAutoCV, setShowAutoCV] = useState(false);

  async function handleStatusChange(newStatus: ApplicationStatus) {
    if (!a.jobPostId || !a.seekerId) {
      setStatusError("متقدرش نحدّث الحالة — بيانات التقديم ناقصة");
      return;
    }
    const previous = status;
    setStatus(newStatus);
    setSavingStatus(true);
    setStatusError("");
    try {
      await updateDoc(doc(db, "applications", `${a.jobPostId}_${a.seekerId}`), { status: newStatus });
    } catch (err) {
      console.error("[ApplicantCard] فشل تحديث حالة التقديم", err);
      setStatus(previous);
      setStatusError("حصلت مشكلة، حاول تاني");
    }
    setSavingStatus(false);
  }

  return (
    <div style={{ ...jobCardContainerStyle, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {s.photoURL && (
            <img
              src={s.photoURL}
              alt={s.fullName || "المتقدم"}
              style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }}
            />
          )}
          <div>
            <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#14213D" }}>{s.fullName || "بدون اسم"}</h4>
            {s.jobTitle && <div style={{ fontSize: 16, color: "#4A5568" }}>{s.jobTitle}</div>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ ...sectionLabelStyle, fontSize: 16, marginBottom: 0 }}>حالة المتقدم:</span>
            <select
              value={status}
              disabled={savingStatus}
              onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
              style={{
                ...APPLICATION_STATUS_STYLES[status],
                fontSize: 14,
                padding: "6px 12px",
                border: "1px solid rgba(20,33,61,0.15)",
                cursor: savingStatus ? "wait" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {APPLICATION_STATUS_ORDER.map((key) => (
                <option key={key} value={key}>
                  {APPLICATION_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          {savingStatus && <span style={{ fontSize: 11.5, color: "#4A5568" }}>جاري الحفظ...</span>}
          {statusError && <span style={{ fontSize: 11.5, color: "#B03A14" }}>{statusError}</span>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {s.specialization && <span style={bigTagStyle}><TagIcon size={15} /> التخصص: {s.specialization}</span>}
        <span style={bigTagStyle}><PinIcon size={15} /> المحافظة: {s.city || ""} - {s.governorate || ""}</span>
        <span style={bigTagStyle}><BriefcaseIcon size={15} /> سنوات الخبرة: {s.yearsOfExperience || 0} سنوات</span>
        {s.militaryStatus && <span style={bigTagStyle}><ShieldIcon size={15} /> موقف التجنيد: {MILITARY_STATUS_LABELS[s.militaryStatus] || s.militaryStatus}</span>}
      </div>

      {skills.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={sectionLabelStyle}>المهارات</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {skills.map((skill, i) => (
              <EntryTag key={i} entry={skill} levelLabels={SKILL_LEVELS} />
            ))}
          </div>
        </div>
      )}

      {languages.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={sectionLabelStyle}>اللغات</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {languages.map((lang, i) => (
              <EntryTag key={i} entry={lang} levelLabels={LANGUAGE_LEVELS} />
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #14213D14", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 16 }}>📞 <strong>{s.phone || "—"}</strong></div>
        {s.email && <div style={{ fontSize: 16 }}>✉️ {s.email}</div>}
        {s.cvFileURL ? (
          <a
            href={s.cvFileURL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...bigGhostActionStyle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              marginTop: 6,
            }}
          >
            <DocumentIcon size={17} /> عرض السيرة الذاتية
          </a>
        ) : (
          a.seekerId && (
            <button
              onClick={() => setShowAutoCV(true)}
              style={{
                ...bigGhostActionStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 6,
                cursor: "pointer",
              }}
            >
              <DocumentIcon size={17} /> عرض سيرة ذاتية تلقائية (من البروفايل)
            </button>
          )
        )}
      </div>

      {a.screeningAnswers && screeningQuestions && screeningQuestions.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #14213D14" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 8, color: "#14213D" }}>إجابات أسئلة الفرز</div>
          {screeningQuestions.map((q) =>
            a.screeningAnswers![q.id] ? (
              <div key={q.id} style={{ fontSize: 15, marginTop: 6 }}>
                <strong>{q.text}:</strong> {a.screeningAnswers![q.id]}
              </div>
            ) : null
          )}
        </div>
      )}

      {showAutoCV && a.seekerId && <AutoCVModal seekerId={a.seekerId} onClose={() => setShowAutoCV(false)} />}
    </div>
  );
}

function AutoCVModal({ seekerId, onClose }: { seekerId: string; onClose: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [data, setData] = useState<any>(null);
  const [completion, setCompletion] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        // مش قراءة مباشرة من job_seekers (قاعدة الأمان بتمنعها لغير الباحث نفسه/الأدمن) —
        // Cloud Function بتتحقق من السيرفر إن صاحب العمل الحالي فعلاً عنده تقديم من الباحث
        // ده على وظايفه قبل ما ترجع أي بيانات.
        const getProfile = httpsCallable(functions, "getApplicantProfileForAutoCV");
        const result = await getProfile({ seekerId });
        const seekerData = result.data as any;
        // "empty" هي الحالة الوحيدة اللي بنمنع فيها العرض بالكامل — لما مفيش حتى اسم أو
        // تخصص (أقل حد ممكن نعرض بيه سيرة ذاتية ليها معنى). أي حاجة تحت كده لسه بتتعرض
        // عادي مع تنويه (شوف الـLOW_COMPLETION_WARNING_THRESHOLD وrender الـready تحت).
        if (!seekerData?.fullName && !seekerData?.specialization) {
          setState("empty");
          return;
        }
        setData(seekerData);
        setCompletion(calculateProfileCompletion(seekerData));
        setState("ready");
      } catch (err) {
        console.error("[ApplicantCard] فشل جلب بيانات الباحث لتوليد السيرة الذاتية التلقائية", err);
        setState("error");
      }
    })();
  }, [seekerId]);

  return (
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
          maxWidth: 750,
          width: "100%",
          maxHeight: "90vh",
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

        {state === "loading" && <p style={{ textAlign: "center", padding: 40, color: "#4A5568" }}>جاري تجهيز السيرة الذاتية...</p>}
        {state === "error" && <p style={{ textAlign: "center", padding: 40, color: "#B03A14" }}>حصلت مشكلة في جلب بيانات الباحث، حاول تاني.</p>}
        {state === "empty" && (
          <p style={{ textAlign: "center", padding: 40, color: "#4A5568" }}>
            الباحث لسه ما حددش حتى اسمه أو تخصصه، فمفيش بيانات كافية لتوليد سيرة ذاتية.
          </p>
        )}
        {state === "ready" && data && (
          <>
            {completion < LOW_COMPLETION_WARNING_THRESHOLD && (
              <div
                style={{
                  background: "#FDF3E1",
                  border: "1px solid #E8A33D66",
                  color: "#8A570D",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: "center",
                  marginBottom: 18,
                }}
              >
                ⚠️ بيانات الباحث لسه غير مكتملة، السيرة دي مبنية على المتاح بس
              </div>
            )}
            <CVPreview data={data} skills={normalizeEntries(data.skills)} languages={normalizeEntries(data.languages)} autoGenerated />
          </>
        )}
      </div>
    </div>
  );
}

function EntryTag({ entry, levelLabels }: { entry: SkillEntry; levelLabels: Record<string, string> }) {
  return (
    <span style={bigTagStyle}>
      {entry.name}
      {entry.level && (
        <span style={{ color: "#4A5568", fontSize: 13 }}> · {levelLabels[entry.level] || entry.level}</span>
      )}
    </span>
  );
}

const sectionLabelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "#4A5568", marginBottom: 6 };
