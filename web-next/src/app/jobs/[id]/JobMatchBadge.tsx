"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { calculateMatchPercent, MatchJob, MatchSeeker } from "@/lib/applicantMatch";
import { matchPillStyle } from "@/lib/jobCardStyles";

type Props = { job: MatchJob };

// نسبة مطابقة الباحث نفسه مع الوظيفة دي — بتظهر قبل زرار التقديم مباشرة، بس للباحث المسجل
// دخول (محتاجة بيانات بروفايله، فمفيش معنى تتعرض لزائر مش مسجل). بتستخدم calculateMatchPercent
// نفسها المستخدمة بالفعل في جانب صاحب العمل/الأدمن (applicantMatch.ts، شوف CompanyTab.tsx/
// admin/page.tsx) من غير أي تكرار للمنطق أو الأوزان.
//
// منفصلة تمامًا عن SpecializationMismatchModal (تحذير عدم تطابق تخصص/خبرة قبل التقديم في
// ApplyButton.tsx) — الاتنين مستقلين وممكن يظهروا مع بعض، مفيش تعديل على المودال ده هنا.
export default function JobMatchBadge({ job }: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  // undefined يعني لسه بنستنى نتيجة auth/الجلب (أو المستخدم مش مسجل دخول) — الشارة مبتتعرضش
  // خالص في الحالة دي. null يعني اتأكدنا إن مفيش معايير كفاية للحساب (أو فشل الجلب) —
  // بيتعرض تنويه "أكمل بروفايلك" بدل ما نعرض رقم مضلل. رقم فعلي يعني النسبة جاهزة للعرض.
  const [matchPercent, setMatchPercent] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoggedIn(false);
        setMatchPercent(undefined);
        return;
      }
      setLoggedIn(true);
      try {
        const snap = await getDoc(doc(db, "job_seekers", user.uid));
        const s = snap.exists() ? snap.data() : {};
        // قيم undefined صراحة (مش 0/"" افتراضية زي buildSeekerSnapshot) لأي حقل ناقص —
        // calculateMatchPercent بتفرّق بين "معيار متاح بقيمة" و"معيار مش متاح خالص"، فلو
        // حطينا قيم افتراضية هنخلي المعيار يتحسب غلط (زي "0 سنة خبرة" بدل "الباحث مكتبش
        // خبرته خالص" اللي المفروض يستبعد المعيار من الحساب بالكامل).
        const seeker: MatchSeeker = {
          specialization: s.specialization || undefined,
          jobLevel: s.jobLevel || undefined,
          yearsOfExperience: typeof s.yearsOfExperience === "number" ? s.yearsOfExperience : undefined,
          keywords: Array.isArray(s.keywords) && s.keywords.length > 0 ? s.keywords : undefined,
          governorate: s.governorate || undefined,
        };
        setMatchPercent(calculateMatchPercent(job, seeker));
      } catch (err) {
        console.error("Failed to load seeker profile for match percent", err);
        setMatchPercent(null);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loggedIn || matchPercent === undefined) return null;

  if (matchPercent === null) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          background: "#F8F6F0",
          border: "1px solid #14213D1F",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 12,
          fontSize: 13.5,
          color: "#4A5568",
        }}
      >
        <span>🎯 أكمل بروفايلك عشان تشوف نسبة تطابقك مع الوظيفة دي</span>
        <Link
          href="/seeker?tab=profile"
          style={{
            padding: "6px 14px",
            background: "#14213D",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 12.5,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          كمّل بروفايلك
        </Link>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <span style={{ ...matchPillStyle(matchPercent), fontSize: 14, padding: "6px 16px" }}>
        🎯 {matchPercent}% مطابقة مع الوظيفة دي
      </span>
    </div>
  );
}
