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

  if (status === "loading") {
    return (
      <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (status === "no-profile") {
    return <QuickSignupForm onSaved={loadProfile} />;
  }

  const completionPercent = calculateProfileCompletion(profileData);

  return (
    <div dir="rtl">
      <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" }}>
        {activeTab === "jobs" && (
          <JobsTab
            completionPercent={completionPercent}
            specialization={profileData.specialization}
            keywords={profileData.keywords}
            jobLevel={profileData.jobLevel}
            governorate={profileData.governorate}
          />
        )}
        {activeTab === "saved" && <SavedJobsTab />}
        {activeTab === "profile" && (
          <ProfileTab data={profileData} onUpdated={loadProfile} />
        )}
      </div>
    </div>
  );
}
