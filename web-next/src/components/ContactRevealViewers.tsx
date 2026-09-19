"use client";

import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchContactRevealViewers, ContactRevealViewer } from "@/lib/contactReveal";
import { calculateMatchPercent, MatchJob } from "@/lib/applicantMatch";
import { buildSeekerSnapshot } from "@/lib/seekerSnapshot";
import SeekerDetailModal, { MONTHLY_CONTACT_REVEAL_LIMIT } from "@/app/employer/SeekerDetailModal";
import ApplicantCard from "./ApplicantCard";

// أقصى عدد بروفايلات بنجيبها (الأحدث فتحًا أولًا) — الترتيب بنسبة المطابقة محتاج كل البروفايلات
// قدامنا، فلازم سقف عشان عدد القراءات ميبقاش مفتوح لو الوظيفة شافها ناس كتير.
const MAX_PROFILES_LOADED = 50;
// أقصى عدد كروت بتظهر تلقائيًا — القسم ده معلومات ثانوية (مش متقدمين فعليين)، فمش ماخد نفس
// مساحة قايمة المتقدمين. الباقي بيظهر بزرار "عرض الباقي".
const INITIAL_VISIBLE_COUNT = 10;

type Profile = { id: string; [key: string]: unknown };
type Entry = { viewer: ContactRevealViewer; profile: Profile | null; match: number | null };

type Props = {
  jobPostId: string;
  // بيانات الوظيفة لحساب نسبة المطابقة (applicantMatch.ts) — نفس اللي بتتبعت لكروت المتقدمين.
  job: MatchJob;
  // باقة صاحب العمل الحالي — بتتبعت لـSeekerDetailModal (بوابة كشف بيانات التواصل).
  employerPlan: string;
  // الأدمن مستثنى من حد الكشف الشهري (SeekerDetailModal بيتعامل معاه بنفسه بالإيميل) — الفلاج ده
  // للنص التوضيحي بس.
  isAdmin?: boolean;
  // اللي قدّموا فعلًا على الوظيفة (بيظهروا في قايمة المتقدمين فوق) — بيتستبعدوا من هنا.
  excludeSeekerIds?: string[];
};

function formatViewedAt(viewer: ContactRevealViewer): string {
  return viewer.viewedAt ? viewer.viewedAt.toDate().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "";
}

// قسم قابل للتوسيع بيعرض الباحثين اللي فتحوا صفحة وظيفة التواصل المباشر وهم مسجّلين دخول
// (job_contact_views/{jobPostId}/viewers) — لصاحب العمل والأدمن مع بعض. مش متقدمين ومش
// بالضرورة مهتمين: التسجيل بيحصل بمجرد فتح الصفحة (شوف ContactReveal.tsx). للباحث اللي موافق
// على الظهور (consentToShare !== false) بنعرض بروفايله بكارت ApplicantCard بوضع viewerMode من
// غير تليفون/إيميل؛ اللي مش موافق (أو القراءة اتمنعت بقاعدة الأمان) بنعرض اسمه وتاريخ الفتح بس.
// كشف بيانات التواصل عن طريق SeekerDetailModal (الباقة المدفوعة + الحد الشهري + contact_reveals).
// البيانات بتتجاب أول مرة بس القسم يتفتح (مش مع باقي بيانات الوظيفة)، وبتتخزّن جوه الكومبوننت.
export default function ContactRevealViewers({ jobPostId, job, employerPlan, isAdmin, excludeSeekerIds }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [omittedCount, setOmittedCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [modalSeeker, setModalSeeker] = useState<Profile | null>(null);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const allViewers = await fetchContactRevealViewers(jobPostId);
      const excluded = new Set(excludeSeekerIds || []);
      const candidates = allViewers.filter((v) => !excluded.has(v.uid));
      const toLoad = candidates.slice(0, MAX_PROFILES_LOADED);

      // قراءة مباشرة لكل بروفايل — مسموحة (حسب قاعدة job_seekers) للي موافق على الظهور بس؛ اللي
      // القراءة اتمنعت معاه بيتعرض بالاسم بس. allSettled عشان رفض واحد ميوقفش الباقي.
      const results = await Promise.allSettled(toLoad.map((v) => getDoc(doc(db, "job_seekers", v.uid))));
      const loaded: Entry[] = toLoad.map((viewer, i) => {
        const result = results[i];
        if (result.status !== "fulfilled" || !result.value.exists()) return { viewer, profile: null, match: null };
        const data = result.value.data();
        if (data.consentToShare === false) return { viewer, profile: null, match: null };
        const profile: Profile = { id: viewer.uid, ...data };
        return { viewer, profile, match: calculateMatchPercent(job, buildSeekerSnapshot(profile)) };
      });

      const withProfile = loaded.filter((e) => e.profile).sort((a, b) => (b.match ?? -1) - (a.match ?? -1));
      const withoutProfile = loaded.filter((e) => !e.profile);
      setEntries([...withProfile, ...withoutProfile]);
      setOmittedCount(candidates.length - toLoad.length);
      setVisibleCount(INITIAL_VISIBLE_COUNT);
    } catch (err) {
      console.error("[ContactRevealViewers] فشل جلب قايمة اللي شافوا الوظيفة", err);
      setError(true);
    }
    setLoading(false);
  }

  function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (entries === null) load();
  }

  const revealHint = isAdmin
    ? "أنت أدمن — مستثنى من الحد الشهري لكشف بيانات التواصل."
    : employerPlan === "premium"
    ? `الضغط بيستهلك واحدة من ${MONTHLY_CONTACT_REVEAL_LIMIT} كشف شهريًا، وبيظهر للباحث في إحصائياته.`
    : "التواصل المباشر متاح للباقة المدفوعة بس — الضغط بيفتح تفاصيل الباحث وخيار الترقية.";

  const visibleEntries = entries ? entries.slice(0, visibleCount) : [];
  const remaining = entries ? entries.length - visibleEntries.length : 0;

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={handleToggle}
        style={{
          padding: "4px 10px",
          fontSize: 12,
          background: "transparent",
          border: "1px solid #14213D22",
          borderRadius: 6,
          color: "#14213D",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {expanded ? "إخفاء ▲" : "👁 مين شاف صفحة الوظيفة (مش متقدمين)؟ ▼"}
      </button>

      {expanded && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div style={{ fontSize: 12, color: "#4A5568" }}>جاري التحميل...</div>
          ) : error ? (
            <div style={{ fontSize: 13, color: "#B03A14" }}>حصلت مشكلة في جلب القايمة، اقفل القسم وافتحه تاني.</div>
          ) : entries ? (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "#14213D" }}>
                👁 باحثين شافوا صفحة الوظيفة دي ({entries.length}
                {omittedCount > 0 ? "+" : ""})
              </h3>

              {entries.length === 0 ? (
                <div style={{ fontSize: 12, color: "#4A5568" }}>
                  لسه محدش (غير المتقدمين فوق) شاف صفحة الوظيفة دي وهو مسجّل دخول.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      background: "#FDF3E1",
                      border: "1px solid #E8A33D66",
                      color: "#8A570D",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    دول مستخدمين مسجلين <strong>فتحوا صفحة الوظيفة بس</strong> — مش متقدمين، ومش بالضرورة مهتمين أو اتواصلوا
                    معاك. بنعرض بروفايل اللي وافق على الظهور لأصحاب الأعمال فقط، من غير تليفون أو إيميل. كشف بيانات التواصل
                    بيتحسب من الحد الشهري ({MONTHLY_CONTACT_REVEAL_LIMIT}) للباقة المدفوعة.
                  </div>

                  {visibleEntries.map(({ viewer, profile, match }) =>
                    profile ? (
                      <ApplicantCard
                        key={viewer.uid}
                        applicant={{ seekerSnapshot: buildSeekerSnapshot(profile), seekerId: viewer.uid }}
                        matchPercent={match}
                        viewerMode
                        viewedAtLabel={formatViewedAt(viewer)}
                        onRevealContact={() => setModalSeeker(profile)}
                        revealHint={revealHint}
                      />
                    ) : (
                      <div
                        key={viewer.uid}
                        style={{
                          border: "1px dashed #14213D33",
                          borderRadius: 10,
                          padding: "10px 14px",
                          background: "#fff",
                          fontSize: 13,
                          color: "#4A5568",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          <strong style={{ color: "#14213D" }}>{viewer.fullName}</strong>
                          {formatViewedAt(viewer) ? ` — شاف الصفحة ${formatViewedAt(viewer)}` : ""}
                        </span>
                        <span>بروفايله مش متاح لأصحاب الأعمال</span>
                      </div>
                    )
                  )}

                  {remaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount(entries.length)}
                      style={{
                        alignSelf: "center",
                        padding: "6px 14px",
                        fontSize: 13,
                        background: "transparent",
                        border: "1px solid #14213D33",
                        borderRadius: 8,
                        color: "#14213D",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      عرض الباقي ({remaining})
                    </button>
                  )}

                  {omittedCount > 0 && (
                    <div style={{ fontSize: 12, color: "#4A5568" }}>
                      بنعرض أحدث {MAX_PROFILES_LOADED} شخص بس ({omittedCount} تانيين مش معروضين).
                    </div>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>
      )}

      {modalSeeker && (
        <SeekerDetailModal
          seeker={modalSeeker}
          employerPlan={employerPlan}
          defaultInviteJobId={jobPostId}
          onClose={() => setModalSeeker(null)}
        />
      )}
    </div>
  );
}
