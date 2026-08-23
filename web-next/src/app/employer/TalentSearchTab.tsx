"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, limit, query, startAfter, where, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  GOVERNORATES,
  SPECIALIZATION_OPTIONS,
  EXPERIENCE_LEVELS,
} from "@/lib/constants";
import SeekerDetailModal from "./SeekerDetailModal";
import { friendlyErrorMessage } from "@/lib/errorMessages";

const PAGE_SIZE = 12;

type Props = {
  employerPlan: string;
};

export default function TalentSearchTab({ employerPlan }: Props) {
  const searchParams = useSearchParams();
  // موجود بس لما صاحب العمل يجي على طول من نشر وظيفة جديدة (شوف employer/page.tsx) —
  // مش state دائم، فلو رجع للتبويب من غير ما يمر بنشر وظيفة تاني، مش هيلاقي البانر تاني.
  const justPostedJobId = searchParams.get("justPosted");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [specFilter, setSpecFilter] = useState("");
  const [govFilter, setGovFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [jobLevelFilter, setJobLevelFilter] = useState("");
  const [minYears, setMinYears] = useState("");

  const [results, setResults] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selectedSeeker, setSelectedSeeker] = useState<any | null>(null);

  // الحد الأدنى للخبرة لوحده متكفيش لتفعيل البحث — لازم فلتر تاني معاه
  const hasActiveFilter = !!(specFilter || govFilter || jobTypeFilter || jobLevelFilter);

  // البانر بيختفي أوتوماتيك أول ما يبدأ يفلتر (وبالتبعية أي دعوة، لأنها مش متاحة غير بعد
  // ظهور نتايج بحث فعلية أصلًا)، أو بزرار الإغلاق اليدوي.
  const showJustPostedBanner = !!justPostedJobId && !bannerDismissed && !hasActiveFilter;

  async function fetchSeekers(reset: boolean) {
    if (!hasActiveFilter) {
      setResults([]);
      setLastDoc(null);
      setHasMore(false);
      return;
    }

    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const constraints: any[] = [where("consentToShare", "==", true)];
      if (specFilter) constraints.push(where("specialization", "==", specFilter));
      if (govFilter) constraints.push(where("governorate", "==", govFilter));
      if (jobTypeFilter) constraints.push(where("jobType", "==", jobTypeFilter));
      if (jobLevelFilter) constraints.push(where("jobLevel", "==", jobLevelFilter));
      constraints.push(limit(PAGE_SIZE));
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc));

      const snap = await getDocs(query(collection(db, "job_seekers"), ...constraints));
      const newResults = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));

      setResults((prev) => (reset ? newResults : [...prev, ...newResults]));
      setLastDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === PAGE_SIZE);
      setError("");
    } catch (err) {
      console.error("Seeker search failed", err);
      setError(friendlyErrorMessage(err));
    }

    if (reset) setLoading(false);
    else setLoadingMore(false);
  }

  useEffect(() => {
    fetchSeekers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specFilter, govFilter, jobTypeFilter, jobLevelFilter]);

  async function handleLoadMore() {
    await fetchSeekers(false);
  }

  const minYearsNum = Number(minYears || 0);
  const displayedResults = results.filter(
    (s) => !minYearsNum || (s.yearsOfExperience || 0) >= minYearsNum
  );

  return (
    <div dir="rtl">
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>🔍 البحث عن كوادر</h2>

      {showJustPostedBanner && (
        <div
          style={{
            position: "relative",
            background: "rgba(47,111,78,0.1)",
            border: "1px solid #2F6F4E33",
            borderRadius: 10,
            padding: "14px 40px 14px 16px",
            marginBottom: 20,
          }}
        >
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="إغلاق"
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: "#4A5568",
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
          <p style={{ margin: 0, fontSize: 14, color: "#14213D", lineHeight: 1.7 }}>
            🎉 الوظيفة اتنشرت! بدل ما تستنى حد يقدّم، تقدر تدوّر على كوادر مناسبة بنفسك
            وتبعتلهم دعوة مباشرة للتقديم على الوظيفة دي.
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#2F6F4E", fontWeight: 700 }}>
            {employerPlan === "premium" ? "عندك 30 دعوة مباشرة شهريًا" : "عندك 5 دعوات مباشرة شهريًا"}
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>التخصص</label>
          <select value={specFilter} onChange={(e) => setSpecFilter(e.target.value)} style={inputStyle}>
            <option value="">كل التخصصات</option>
            {SPECIALIZATION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>المحافظة</label>
          <select value={govFilter} onChange={(e) => setGovFilter(e.target.value)} style={inputStyle}>
            <option value="">الكل</option>
            {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>الحد الأدنى لسنوات الخبرة</label>
          <input type="number" min="0" value={minYears} onChange={(e) => setMinYears(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>مستوى الوظيفة المطلوب</label>
          <select value={jobLevelFilter} onChange={(e) => setJobLevelFilter(e.target.value)} style={inputStyle}>
            <option value="">الكل</option>
            {Object.entries(EXPERIENCE_LEVELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>نوع الدوام المطلوب</label>
          <select value={jobTypeFilter} onChange={(e) => setJobTypeFilter(e.target.value)} style={inputStyle}>
            <option value="">الكل</option>
            <option value="full_time">دوام كامل</option>
            <option value="part_time">دوام جزئي</option>
            <option value="remote">عن بعد</option>
            <option value="freelance">فريلانس</option>
          </select>
        </div>
      </div>

      {!hasActiveFilter && (
        <div style={{ padding: 30, textAlign: "center", color: "#4A5568", border: "1px dashed #14213D22", borderRadius: 10 }}>
          اختر تخصص أو محافظة أو مستوى وظيفة أو نوع دوام عشان تبدأ البحث عن الكوادر المناسبة.
        </div>
      )}

      {hasActiveFilter && loading && <p>جاري التحميل...</p>}
      {hasActiveFilter && error && <div style={{ color: "#B03A14", padding: 12 }}>{error}</div>}

      {hasActiveFilter && !loading && !error && (
        <>
          <div style={{ fontSize: 13, color: "#4A5568", marginBottom: 10 }}>
            {displayedResults.length} نتيجة معروضة حاليًا
          </div>

          {displayedResults.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>
              مفيش نتائج مطابقة دلوقتي — جرب توسّع الفلاتر
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayedResults.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedSeeker(s)}
                style={{
                  border: "1px solid #14213D22",
                  borderRadius: 10,
                  padding: 16,
                  cursor: "pointer",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                {s.photoURL && (
                  <img src={s.photoURL} alt={s.fullName || "باحث عن عمل"} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: 16 }}>{s.fullName || "بدون اسم"}</h4>
                  <div style={{ fontSize: 13, color: "#4A5568", marginTop: 2 }}>{s.jobTitle || ""}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {s.specialization && <span style={tagStyle}>{s.specialization}</span>}
                    {s.governorate && <span style={tagStyle}>{s.governorate}</span>}
                    <span style={tagStyle}>{s.yearsOfExperience || 0} سنوات خبرة</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ padding: "8px 20px", border: "1px solid #14213D", borderRadius: 6, background: "transparent", cursor: "pointer" }}
              >
                {loadingMore ? "جاري التحميل..." : "تحميل المزيد"}
              </button>
            </div>
          )}
        </>
      )}

      {selectedSeeker && (
        <SeekerDetailModal
          seeker={selectedSeeker}
          employerPlan={employerPlan}
          defaultInviteJobId={justPostedJobId || undefined}
          onClose={() => setSelectedSeeker(null)}
        />
      )}
    </div>
  );
}

const tagStyle: React.CSSProperties = { fontSize: 12, background: "#F0EDE3", padding: "3px 10px", borderRadius: 999 };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 };
