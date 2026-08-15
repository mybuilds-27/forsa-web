"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { buildSeekerSnapshot } from "@/lib/seekerSnapshot";
import ScreeningQuestionsModal, { ScreeningQuestion } from "@/components/ScreeningQuestionsModal";
import RegisterModal from "@/components/RegisterModal";

type Props = {
  jobId: string;
  employerId: string;
  screeningQuestions?: ScreeningQuestion[];
};

export default function ApplyButton({ jobId, employerId, screeningQuestions = [] }: Props) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }
      setLoggedIn(true);
      const appId = `${jobId}_${user.uid}`;
      try {
        const appSnap = await getDoc(doc(db, "applications", appId));
        setApplied(appSnap.exists());
      } catch (err) {
        // قواعد Firestore بترفض قراءة مستند applications/{id} لما لسه مش موجود (أول تقديم
        // من المستخدم ده على الوظيفة دي) بـpermission-denied بدل ما ترجعه "مش موجود" —
        // من غير الـcatch ده، setLoading(false) تحت مبتتنفذش خالص وزرار "قدم الآن" بيفضل
        // مختفي للأبد. لو القراءة فشلت لأي سبب، الافتراض الآمن إن المستخدم لسه ما قدّمش.
        console.error("[ApplyButton] فشل التحقق من حالة التقديم السابق", err);
        setApplied(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [jobId]);

  async function handleApply(answers: Record<string, string> = {}) {
    const user = auth.currentUser;
    if (!user) return;
    setBusy(true);
    try {
      const seekerDoc = await getDoc(doc(db, "job_seekers", user.uid));
      const s = seekerDoc.exists() ? seekerDoc.data() : {};
      const appId = `${jobId}_${user.uid}`;
      await setDoc(doc(db, "applications", appId), {
        jobPostId: jobId,
        employerId,
        seekerId: user.uid,
        seekerSnapshot: buildSeekerSnapshot(s),
        screeningAnswers: answers,
        appliedAt: serverTimestamp(),
      });
      setApplied(true);
      setShowQuestionsModal(false);
    } catch (err) {
      console.error("Apply failed", err);
    }
    setBusy(false);
  }

  function handleApplyClick() {
    if (screeningQuestions.length > 0) {
      setShowQuestionsModal(true);
    } else {
      handleApply();
    }
  }

  // بيتنادى بعد ما مودال التسجيل ينجح — auth.currentUser بقى متاح فورًا (متزامن مع نجاح
  // signIn نفسه، قبل ما listener الأعلى يتفاعل)، فتكملة التقديم بنفس منطق handleApplyClick
  // بتشتغل صح على طول. setLoggedIn(true) هنا بس عشان الزرار يعكس الحالة فورًا من غير
  // انتظار الـlistener، مش لازم لصحة المنطق نفسه.
  function handleRegisterSuccess() {
    setShowRegisterModal(false);
    setLoggedIn(true);
    handleApplyClick();
  }

  async function handleCancel() {
    const user = auth.currentUser;
    if (!user) return;
    if (!confirm("متأكد إنك عايز تلغي التقديم على الوظيفة دي؟")) return;
    setBusy(true);
    try {
      const appId = `${jobId}_${user.uid}`;
      await deleteDoc(doc(db, "applications", appId));
      setApplied(false);
    } catch (err) {
      console.error("Cancel failed", err);
    }
    setBusy(false);
  }

  if (loading) return null;

  return (
    <>
      {!loggedIn && (
        <button
          onClick={() => setShowRegisterModal(true)}
          style={{ padding: "12px 24px", background: "#14213D", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          📩 قدم الآن
        </button>
      )}

      {loggedIn && (
        applied ? (
          <button
            onClick={handleCancel}
            disabled={busy}
            style={{ padding: "12px 24px", border: "1px solid #B03A14", color: "#B03A14", background: "transparent", borderRadius: 8, cursor: "pointer" }}
          >
            ✕ إلغاء التقديم
          </button>
        ) : (
          <button
            onClick={handleApplyClick}
            disabled={busy}
            style={{ padding: "12px 24px", background: "#14213D", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            📩 قدم الآن
          </button>
        )
      )}

      {showRegisterModal && (
        <RegisterModal onClose={() => setShowRegisterModal(false)} onSuccess={handleRegisterSuccess} />
      )}

      {showQuestionsModal && (
        <ScreeningQuestionsModal
          questions={screeningQuestions}
          submitting={busy}
          onCancel={() => setShowQuestionsModal(false)}
          onSubmit={(answers) => handleApply(answers)}
        />
      )}
    </>
  );
}