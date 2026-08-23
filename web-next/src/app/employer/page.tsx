"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import EmployerOnboardingForm from "./EmployerOnboardingForm";
import CompanyTab from "./CompanyTab";
import PostJobTab from "./PostJobTab";
import UpgradeModal from "./UpgradeModal";
import TalentSearchTab from "./TalentSearchTab";

type Status = "loading" | "no-profile" | "has-profile";
type EditingPost = { id: string; data: any } | null;
type Tab = "company" | "postjob" | "talent";

// نفس الرقم والنمط المستخدم في UpgradeModal.tsx
const WHATSAPP_NUMBER = "201012735333";

export default function EmployerPage() {
  return (
    <Suspense
      fallback={
        <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
          <p>جاري التحميل...</p>
        </div>
      }
    >
      <EmployerPageInner />
    </Suspense>
  );
}

function EmployerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: Tab = tabParam === "postjob" || tabParam === "talent" ? tabParam : "company";

  const [status, setStatus] = useState<Status>("loading");
  const [companyData, setCompanyData] = useState<any>(null);
  const [editingPost, setEditingPost] = useState<EditingPost>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  async function loadCompany() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const ref = doc(db, "employers", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setStatus("no-profile");
        return;
      }

      let contactData = {};
      try {
        const contactSnap = await getDoc(doc(db, "employers", user.uid, "private", "contact"));
        contactData = contactSnap.exists() ? contactSnap.data() : {};
      } catch (err) {
        console.error("[loadCompany] فشل قراءة employers/{uid}/private/contact", err);
      }

      setCompanyData({ ...snap.data(), ...contactData });
      setStatus("has-profile");
    } catch (err) {
      console.error("[loadCompany] فشل قراءة employers/{uid}", err);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      await loadCompany();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function handleEditRequest(id: string, data: any) {
    setEditingPost({ id, data });
    router.push("/employer?tab=postjob");
  }

  if (status === "loading") {
    return (
      <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (status === "no-profile") {
    return <EmployerOnboardingForm onSaved={loadCompany} />;
  }

  const isPremium = companyData?.plan === "premium";

  return (
    <div dir="rtl">
      <div style={{ padding: "24px 20px 60px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {!isPremium && (
            <button onClick={() => setUpgradeModalOpen(true)} style={upgradeBtnStyle}>
              🚀 طلب الترقية للباقة المدفوعة
            </button>
          )}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("أهلاً، محتاج مساعدة في حسابي كصاحب عمل على موقع الشغل.")}`}
            target="_blank"
            rel="noopener noreferrer"
            style={whatsappBtnStyle}
          >
            💬 محتاج مساعدة؟ كلمنا واتساب
          </a>
        </div>

        {activeTab === "company" && (
          <CompanyTab
            companyData={companyData}
            onCompanyUpdated={loadCompany}
            onEditPost={handleEditRequest}
          />
        )}
        {activeTab === "postjob" && (
          <PostJobTab
            employerPlan={companyData?.plan || "free"}
            companyName={companyData?.companyName || ""}
            editingPost={editingPost}
            onPosted={(jobId) => {
              loadCompany();
              setEditingPost(null);
              // jobId موجود بس لنشر جديد (مش تعديل) — نوجّه المستخدم لتبويب البحث عن كوادر
              // مباشرة بدل ما يستنى المتقدمين يجوله لوحدهم؛ التعديل يرجع لتبويب الشركة زي ما كان.
              router.push(jobId ? `/employer?tab=talent&justPosted=${jobId}` : "/employer?tab=company");
            }}
          />
        )}
        {activeTab === "talent" && (
          <TalentSearchTab employerPlan={companyData?.plan || "free"} />
        )}
      </div>

      {upgradeModalOpen && <UpgradeModal onClose={() => setUpgradeModalOpen(false)} />}
    </div>
  );
}

const upgradeBtnStyle: React.CSSProperties = { padding: "8px 16px", background: "#E8A33D", color: "#14213D", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13.5 };
const whatsappBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "rgba(47,111,78,0.12)",
  color: "#2F6F4E",
  border: "none",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13.5,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};
