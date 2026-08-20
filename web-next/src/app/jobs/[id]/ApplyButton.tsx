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

  // بعد تسجيل حساب جديد (خصوصًا بجوجل، اللي مابيدّيش رقم تليفون خالص) job_seekers/{uid}
  // لسه معمولوش أصلًا — لو التقديم كمّل على طول من غير الاسم أو الموبايل، صاحب العمل بياخد
  // متقدم مفيش أي وسيلة يتواصل بيها معاه. بنسدّ الفجوة دي بفورم صغير بيطلب بس اللي ناقص.
  const [missingInfoOpen, setMissingInfoOpen] = useState(false);
  const [needsFullName, setNeedsFullName] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [missingFullName, setMissingFullName] = useState("");
  const [missingPhone, setMissingPhone] = useState("");
  const [savingMissingInfo, setSavingMissingInfo] = useState(false);
  const [missingInfoError, setMissingInfoError] = useState("");

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
  async function handleRegisterSuccess() {
    setShowRegisterModal(false);
    setLoggedIn(true);

    const user = auth.currentUser;
    if (!user) return;

    // job_seekers/{uid} لسه مايتعملش أصلًا عند أول تسجيل (بيتعمل بس لما المستخدم يكمّل
    // بروفايله من QuickSignupForm)، فبنجمع الاسم والموبايل من أي مصدر متاح فعليًا دلوقتي:
    // المستند لو موجود بالصدفة، وإلا بيانات حساب المصادقة نفسه (جوجل بيدّي الاسم من غير
    // موبايل، والتسجيل بالتليفون بيدّي الموبايل من غير الاسم في auth.currentUser).
    let existingFullName = "";
    let existingPhone = "";
    try {
      const seekerSnap = await getDoc(doc(db, "job_seekers", user.uid));
      if (seekerSnap.exists()) {
        existingFullName = seekerSnap.data().fullName || "";
        existingPhone = seekerSnap.data().phone || "";
      }
    } catch (err) {
      console.error("[ApplyButton] فشل التحقق من بيانات job_seekers الحالية", err);
    }
    const fullName = existingFullName || user.displayName || "";
    const phone = existingPhone || user.phoneNumber || "";

    if (!fullName.trim() || !phone.trim()) {
      setNeedsFullName(!fullName.trim());
      setNeedsPhone(!phone.trim());
      setMissingFullName(fullName);
      setMissingPhone(phone);
      setMissingInfoError("");
      setMissingInfoOpen(true);
      return;
    }

    // الاتنين متوفرين، بس ممكن يكون حد منهم جاي من auth.currentUser مش من المستند نفسه
    // (زي رقم موبايل مستخدم تسجيل التليفون) — بنضمن إنه متسجل في job_seekers قبل ما نكمّل،
    // عشان handleApply يلاقيه لما يقرا المستند تاني. من غير أي خطوة إضافية للمستخدم نفسه.
    if (fullName !== existingFullName || phone !== existingPhone) {
      try {
        await setDoc(
          doc(db, "job_seekers", user.uid),
          { fullName: fullName.trim(), phone: phone.trim(), updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (err) {
        console.error("[ApplyButton] فشل حفظ الاسم/الموبايل المتاحين من auth", err);
      }
    }

    handleApplyClick();
  }

  async function handleSubmitMissingInfo(e: React.FormEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    if (needsFullName && !missingFullName.trim()) {
      setMissingInfoError("اكتب اسمك بالكامل");
      return;
    }
    if (needsPhone && !missingPhone.trim()) {
      setMissingInfoError("اكتب رقم موبايلك");
      return;
    }
    setSavingMissingInfo(true);
    setMissingInfoError("");
    try {
      // merge:true عشان لو المستند موجود بالفعل (نادر هنا) منمسحش حقول تانية فيه — وده
      // كمان بيسيب البروفايل مكمّل من غير ما يحتاج يمر بـQuickSignupForm تاني في تطبيقات لاحقة.
      await setDoc(
        doc(db, "job_seekers", user.uid),
        { fullName: missingFullName.trim(), phone: missingPhone.trim(), updatedAt: serverTimestamp() },
        { merge: true }
      );
      setMissingInfoOpen(false);
      handleApplyClick();
    } catch (err) {
      console.error("[ApplyButton] فشل حفظ الاسم/الموبايل الناقصين", err);
      setMissingInfoError("حصلت مشكلة، حاول تاني");
    }
    setSavingMissingInfo(false);
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

      {missingInfoOpen && (
        <div
          onClick={() => setMissingInfoOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,33,61,0.55)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 420, width: "100%" }}
          >
            <h2 style={{ marginBottom: 6, fontSize: 19 }}>كمّل بياناتك عشان تقدر تقدّم</h2>
            <p style={{ color: "#4A5568", fontSize: 13.5, marginBottom: 16 }}>
              صاحب العمل محتاج يقدر يتواصل معاك — كمّل البيانات الناقصة دي وهنكمّل تقديمك على طول.
            </p>

            <form onSubmit={handleSubmitMissingInfo}>
              {needsFullName && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, color: "#14213D" }}>
                    الاسم بالكامل
                  </label>
                  <input
                    type="text"
                    value={missingFullName}
                    onChange={(e) => setMissingFullName(e.target.value)}
                    placeholder="اسمك الكامل"
                    style={{ width: "100%", padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
                  />
                </div>
              )}
              {needsPhone && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, color: "#14213D" }}>
                    رقم الموبايل
                  </label>
                  <input
                    type="tel"
                    value={missingPhone}
                    onChange={(e) => setMissingPhone(e.target.value)}
                    placeholder="01012345678"
                    style={{ width: "100%", padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
                  />
                </div>
              )}

              {missingInfoError && (
                <div style={{ color: "#B03A14", fontSize: 13, marginBottom: 12 }}>{missingInfoError}</div>
              )}

              <button
                type="submit"
                disabled={savingMissingInfo}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#14213D",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: savingMissingInfo ? "wait" : "pointer",
                  opacity: savingMissingInfo ? 0.7 : 1,
                }}
              >
                {savingMissingInfo ? "جاري الحفظ..." : "كمّل التقديم"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}