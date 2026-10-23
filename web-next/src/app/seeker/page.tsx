"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { readOwnSeekerProfile } from "@/lib/seekerContact";
import QuickSignupForm from "./QuickSignupForm";
import JobsTab from "./JobsTab";
import ProfileTab from "./ProfileTab";
import SavedJobsTab from "./SavedJobsTab";
import CvPrintCard from "./CvPrintCard";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";

type Status = "loading" | "no-profile" | "has-profile";
type Tab = "jobs" | "saved" | "profile" | "cv";

export default function SeekerPage() {
  return (
    <Suspense
      fallback={
        <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
          <p>جاري التحميل...</p>
        </div>
      }
    >
      <SeekerPageInner />
    </Suspense>
  );
}

function SeekerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: Tab = tabParam === "saved" || tabParam === "profile" || tabParam === "cv" ? tabParam : "jobs";
  // من زرار "كمّل دلوقتي" في Navbar.tsx — قيمة جديدة مع كل دوسة (Date.now())، فـProfileTab
  // تقدر تفرّق "دوسة جديدة" عن مجرد re-render وتفتح فورم التعديل حتى لو التاب ده كان مفتوح أصلًا.
  const openEditNonce = searchParams.get("openEdit");

  const [status, setStatus] = useState<Status>("loading");
  const [profileData, setProfileData] = useState<any>(null);

  async function loadProfile() {
    const user = auth.currentUser;
    if (!user) return;
    // مدموج مع private/contact (الهاتف والإيميل والـCV) — كل التابات وCVPreview ونسبة الاكتمال بتاخده من هنا
    const profile = await readOwnSeekerProfile(user.uid);

    if (profile.exists) {
      setProfileData(profile.data);
      setStatus("has-profile");
    } else {
      setStatus("no-profile");
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      await loadProfile();
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // openEdit بيتعامل معاه ProfileTab/OnboardingForm (بيفتحوا فورم التعديل ويعملوا scroll)
  // في نفس الـrender اللي بيوصلهم فيه — الـeffect ده بيشيله من الـURL بعد كده (بعد الـcommit،
  // فمبيأثرش على فتح الفورم أو الـscroll اللي خلص بالفعل). لازم نشيله عشان لو ProfileTab
  // اتعمله unmount/mount تاني (زي التنقل لتاب "الوظائف" والرجوع لتاب "بروفايلي")، مبيفتحش
  // فورم التعديل تلقائي تاني من غير ما المستخدم يطلب.
  useEffect(() => {
    if (!openEditNonce || status !== "has-profile" || activeTab !== "profile") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openEdit");
    router.replace(`/seeker${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditNonce, status, activeTab]);

  if (status === "loading") {
    return (
      <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (status === "no-profile") {
    return (
      <>
        <div dir="rtl" style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "16px 20px 0" }}>
          <EmailVerificationBanner />
          {/* تاب "السيرة الذاتية" من غير بروفايل: رسالة + رابط لنفس فورم التسجيل السريع اللي تحتها */}
          {activeTab === "cv" && (
            <div style={{ background: "#F8F6F0", border: "1px solid #14213D33", borderRadius: 10, padding: 16, marginBottom: 8 }}>
              <p style={{ margin: "0 0 10px", fontWeight: 700, color: "#14213D" }}>
                كمّل بياناتك الأول عشان تقدر تطبع سيرتك الذاتية
              </p>
              <a href="#quick-signup" style={{ color: "#14213D", fontWeight: 700 }}>كمّل بياناتك</a>
            </div>
          )}
        </div>
        <div id="quick-signup">
          <QuickSignupForm onSaved={loadProfile} />
        </div>
      </>
    );
  }

  const completionPercent = calculateProfileCompletion(profileData);

  return (
    <div dir="rtl">
      <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" }}>
        <EmailVerificationBanner />
        {activeTab === "jobs" && (
          <JobsTab
            completionPercent={completionPercent}
            specialization={profileData.specialization}
            keywords={profileData.keywords}
            jobLevel={profileData.jobLevel}
            governorate={profileData.governorate}
            yearsOfExperience={profileData.yearsOfExperience}
          />
        )}
        {activeTab === "saved" && <SavedJobsTab />}
        {activeTab === "profile" && (
          <ProfileTab data={profileData} onUpdated={loadProfile} openEditNonce={openEditNonce} />
        )}
        {activeTab === "cv" && (
          <div style={{ maxWidth: 700, margin: "0 auto", padding: "30px 20px" }}>
            <CvPrintCard data={profileData} />
          </div>
        )}
      </div>
    </div>
  );
}
