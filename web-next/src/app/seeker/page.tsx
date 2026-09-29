"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import QuickSignupForm from "./QuickSignupForm";
import JobsTab from "./JobsTab";
import ProfileTab from "./ProfileTab";
import SavedJobsTab from "./SavedJobsTab";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";

type Status = "loading" | "no-profile" | "has-profile";
type Tab = "jobs" | "saved" | "profile";

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
  const activeTab: Tab = tabParam === "saved" || tabParam === "profile" ? tabParam : "jobs";
  // من زرار "كمّل دلوقتي" في Navbar.tsx — قيمة جديدة مع كل دوسة (Date.now())، فـProfileTab
  // تقدر تفرّق "دوسة جديدة" عن مجرد re-render وتفتح فورم التعديل حتى لو التاب ده كان مفتوح أصلًا.
  const openEditNonce = searchParams.get("openEdit");

  const [status, setStatus] = useState<Status>("loading");
  const [profileData, setProfileData] = useState<any>(null);

  async function loadProfile() {
    const user = auth.currentUser;
    if (!user) return;
    const profileRef = doc(db, "job_seekers", user.uid);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      setProfileData(profileSnap.data());
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
        </div>
        <QuickSignupForm onSaved={loadProfile} />
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
      </div>
    </div>
  );
}
