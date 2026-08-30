"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getCountFromServer, getDocs, limit, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { GOVERNORATES, GOVERNORATE_CITIES, SPECIALIZATION_OPTIONS, EXPERIENCE_LEVELS, SCREENING_QUESTION_OPTIONS } from "@/lib/constants";
import { friendlyErrorMessage } from "@/lib/errorMessages";

const AGE_OPTIONS = Array.from({ length: 50 }, (_, i) => 16 + i);

// نفس فكرة الـrace مع timeout في ReportJobButton.tsx — لو addDoc/updateDoc اتعلقت لأي سبب
// (شبكة بطيئة، إضافة adblock، إلخ)، بعد 15 ثانية بنوريه رسالة واضحة بدل "جاري الحفظ..."
// معلّقة للأبد من غير أي تفسير.
const SAVE_TIMEOUT_MS = 15000;

// مسودة الفورم بتتحفظ محليًا (وضع النشر الجديد بس، مش التعديل) عشان لو حصل ريفريش بالغلط
// أثناء الكتابة متضيعش كل البيانات. مفيش أي حاجة حساسة بتتخزن هنا — نفس حقول الفورم العادية
// بس (مش uid المستخدم ولا أي بيانات تسجيل دخول)، وبتتمسح فورًا بعد ما النشر ينجح فعليًا.
const DRAFT_STORAGE_KEY = "postJobDraft";
const DRAFT_SAVE_DEBOUNCE_MS = 500;

type EditingPost = { id: string; data: any } | null;

type ScreeningQuestion = { id: string; text: string; type: "text" | "number"; required: boolean };

function generateQuestionId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type Props = {
  employerPlan: string;
  companyName: string;
  editingPost?: EditingPost;
  // إعداد "أظهر اسم شركتي افتراضيًا" من بروفايل الشركة (EmployerOnboardingForm) — بيحدد
  // القيمة الابتدائية لـshowCompanyName في وضع النشر الجديد بس (مش وضع التعديل).
  showCompanyNameDefault?: boolean;
  // jobId بيتبعت بس لنشر جديد (مش تعديل) — عشان الصفحة الأب تقدر توجّه المستخدم لتبويب
  // البحث عن كوادر ويلاقي الوظيفة اللي لسه نشرها محددة افتراضيًا في مودال الدعوة.
  onPosted: (jobId?: string) => void;
};

export default function PostJobTab({ employerPlan, companyName, editingPost, showCompanyNameDefault, onPosted }: Props) {
  const [title, setTitle] = useState("");
  const [specSelect, setSpecSelect] = useState("");
  const [specOther, setSpecOther] = useState("");
  const [jobType, setJobType] = useState("");
  const [jobLevel, setJobLevel] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [citySelect, setCitySelect] = useState("");
  const [cityOther, setCityOther] = useState("");
  const [description, setDescription] = useState("");

  const [vacancies, setVacancies] = useState("1");
  const [salaryNegotiable, setSalaryNegotiable] = useState(false);
  const [salaryFrom, setSalaryFrom] = useState("");
  const [salaryTo, setSalaryTo] = useState("");
  const [showSalary, setShowSalary] = useState(true);

  const [ageFrom, setAgeFrom] = useState("");
  const [ageTo, setAgeTo] = useState("");
  const [needsCar, setNeedsCar] = useState("");
  const [requirements, setRequirements] = useState("");

  const [hoursPerDay, setHoursPerDay] = useState("");
  const [daysOffPerMonth, setDaysOffPerMonth] = useState("");
  const [socialInsurance, setSocialInsurance] = useState("");
  const [privateHealthInsurance, setPrivateHealthInsurance] = useState("");
  const [transportationAvailable, setTransportationAvailable] = useState("");
  const [transportationAreas, setTransportationAreas] = useState("");
  const [housingForExpats, setHousingForExpats] = useState("");
  const [additionalBenefits, setAdditionalBenefits] = useState("");

  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[]>([]);
  const [newQuestionSelect, setNewQuestionSelect] = useState("");
  const [newQuestionOther, setNewQuestionOther] = useState("");

  const [showCompanyName, setShowCompanyName] = useState(showCompanyNameDefault ?? true);
  const [receiveMethod, setReceiveMethod] = useState<"platform" | "contact">("platform");
  const [contactMethod, setContactMethod] = useState("");
  const [contactValue, setContactValue] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const isEditMode = !!editingPost;

  // تعبئة الاستمارة ببيانات الوظيفة لو إحنا في وضع تعديل، وإلا نجرب نسترجع مسودة محفوظة
  // محليًا (لو موجودة) بدل ما نبدأ بفورم فاضي — نفس فكرة استرجاع الفورم بعد ريفريش بالغلط.
  useEffect(() => {
    if (!editingPost) {
      loadDraftOrReset();
      return;
    }
    const p = editingPost.data;
    setTitle(p.title || "");

    const savedSpec = p.specialization || "";
    if (savedSpec && !SPECIALIZATION_OPTIONS.includes(savedSpec)) {
      setSpecSelect("other");
      setSpecOther(savedSpec);
    } else {
      setSpecSelect(savedSpec);
    }

    setJobType(p.jobType || "");
    setJobLevel(p.jobLevel || "");
    setGovernorate(p.governorate || "");

    const savedCity = p.city || "";
    const cities = GOVERNORATE_CITIES[p.governorate || ""] || [];
    if (savedCity && !cities.includes(savedCity)) {
      setCitySelect("other");
      setCityOther(savedCity);
    } else {
      setCitySelect(savedCity);
    }

    setDescription(p.description || "");
    setVacancies(p.vacancies?.toString() || "1");
    setSalaryNegotiable(!!p.salaryNegotiable);
    setSalaryFrom(p.salaryFrom?.toString() || "");
    setSalaryTo(p.salaryTo?.toString() || "");
    setShowSalary(p.showSalary !== false);
    setAgeFrom(p.ageFrom?.toString() || "");
    setAgeTo(p.ageTo?.toString() || "");
    setNeedsCar(p.needsCar || "");
    setRequirements(p.requirements || "");
    setHoursPerDay(p.hoursPerDay?.toString() || "");
    setDaysOffPerMonth(p.daysOffPerMonth?.toString() || "");
    setSocialInsurance(p.socialInsurance || "");
    setPrivateHealthInsurance(p.privateHealthInsurance || "");
    setTransportationAvailable(p.transportationAvailable || "");
    setTransportationAreas(p.transportationAreas || "");
    setHousingForExpats(p.housingForExpats || "");
    setAdditionalBenefits(p.additionalBenefits || "");
    setScreeningQuestions(p.screeningQuestions || []);
    setShowCompanyName(!!p.showCompanyName);
    setReceiveMethod(p.receiveMethod === "contact" ? "contact" : "platform");
    setContactMethod(p.contactMethod || "");
    setContactValue(p.contactValue || "");
  }, [editingPost]);

  // كل حقول الفورم بتتحفظ في localStorage تحت مفتاح ثابت (debounce نص ثانية عشان منكتبش
  // مع كل حرف)، بس في وضع النشر الجديد — وضع التعديل بياخد بياناته من الوظيفة الأصلية
  // زي ما هو فوق، فمفيش داعي وملوش لازمة نستخدم localStorage هناك خالص.
  useEffect(() => {
    if (isEditMode) return;
    const timeoutId = setTimeout(() => {
      const draft = {
        title, specSelect, specOther, jobType, jobLevel, governorate, citySelect, cityOther,
        description, vacancies, salaryNegotiable, salaryFrom, salaryTo, showSalary,
        ageFrom, ageTo, needsCar, requirements, hoursPerDay, daysOffPerMonth,
        socialInsurance, privateHealthInsurance, transportationAvailable, transportationAreas,
        housingForExpats, additionalBenefits, screeningQuestions, newQuestionSelect, newQuestionOther,
        showCompanyName, receiveMethod, contactMethod, contactValue,
      };
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // localStorage ممكن يكون مش متاح (وضع تصفح خاص، أو مساحة ممتلئة) — مش حرج، نتجاهله
      }
    }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [
    isEditMode, title, specSelect, specOther, jobType, jobLevel, governorate, citySelect, cityOther,
    description, vacancies, salaryNegotiable, salaryFrom, salaryTo, showSalary,
    ageFrom, ageTo, needsCar, requirements, hoursPerDay, daysOffPerMonth,
    socialInsurance, privateHealthInsurance, transportationAvailable, transportationAreas,
    housingForExpats, additionalBenefits, screeningQuestions, newQuestionSelect, newQuestionOther,
    showCompanyName, receiveMethod, contactMethod, contactValue,
  ]);

  // بيحاول يسترجع مسودة محفوظة (لو موجودة وسليمة) بدل فورم فاضي، وإلا بيرجع لـresetForm العادية.
  function loadDraftOrReset() {
    let draft: any = null;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      draft = raw ? JSON.parse(raw) : null;
    } catch {
      draft = null;
    }
    if (!draft) {
      resetForm();
      return;
    }
    setTitle(draft.title || "");
    setSpecSelect(draft.specSelect || "");
    setSpecOther(draft.specOther || "");
    setJobType(draft.jobType || "");
    setJobLevel(draft.jobLevel || "");
    setGovernorate(draft.governorate || "");
    setCitySelect(draft.citySelect || "");
    setCityOther(draft.cityOther || "");
    setDescription(draft.description || "");
    setVacancies(draft.vacancies || "1");
    setSalaryNegotiable(!!draft.salaryNegotiable);
    setSalaryFrom(draft.salaryFrom || "");
    setSalaryTo(draft.salaryTo || "");
    setShowSalary(draft.showSalary !== false);
    setAgeFrom(draft.ageFrom || "");
    setAgeTo(draft.ageTo || "");
    setNeedsCar(draft.needsCar || "");
    setRequirements(draft.requirements || "");
    setHoursPerDay(draft.hoursPerDay || "");
    setDaysOffPerMonth(draft.daysOffPerMonth || "");
    setSocialInsurance(draft.socialInsurance || "");
    setPrivateHealthInsurance(draft.privateHealthInsurance || "");
    setTransportationAvailable(draft.transportationAvailable || "");
    setTransportationAreas(draft.transportationAreas || "");
    setHousingForExpats(draft.housingForExpats || "");
    setAdditionalBenefits(draft.additionalBenefits || "");
    setScreeningQuestions(Array.isArray(draft.screeningQuestions) ? draft.screeningQuestions : []);
    setNewQuestionSelect(draft.newQuestionSelect || "");
    setNewQuestionOther(draft.newQuestionOther || "");
    setShowCompanyName(draft.showCompanyName ?? (showCompanyNameDefault ?? true));
    setReceiveMethod(draft.receiveMethod === "contact" ? "contact" : "platform");
    setContactMethod(draft.contactMethod || "");
    setContactValue(draft.contactValue || "");
  }

  const cities = governorate ? GOVERNORATE_CITIES[governorate] || [] : [];

  const availableQuestionOptions = SCREENING_QUESTION_OPTIONS.filter(
    (q) => !screeningQuestions.some((added) => added.text === q.text)
  );

  const missingRequiredFields: string[] = [];
  if (title.trim() === "") missingRequiredFields.push("العنوان");
  if (governorate === "") missingRequiredFields.push("المحافظة");
  if (specSelect === "" || (specSelect === "other" && specOther.trim() === "")) missingRequiredFields.push("التخصص");
  if (jobType === "") missingRequiredFields.push("نوع الدوام");

  const readyToPost = missingRequiredFields.length === 0;

  function addScreeningQuestion() {
    const isOther = newQuestionSelect === "other";
    const text = isOther ? newQuestionOther.trim() : newQuestionSelect;
    if (!text) return;

    const preset = SCREENING_QUESTION_OPTIONS.find((q) => q.text === text);
    setScreeningQuestions([
      ...screeningQuestions,
      { id: generateQuestionId(), text, type: preset?.type || "text", required: false },
    ]);
    setNewQuestionSelect("");
    setNewQuestionOther("");
  }

  function removeScreeningQuestion(id: string) {
    setScreeningQuestions(screeningQuestions.filter((q) => q.id !== id));
  }

  function toggleScreeningQuestionRequired(id: string) {
    setScreeningQuestions(
      screeningQuestions.map((q) => (q.id === id ? { ...q, required: !q.required } : q))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // بيتقفل فورًا لحظة الضغط، قبل حتى فحص حد النشر الشهري (استعلام غير متزامن تحت) —
    // من غيره الزرار فاضل شغال أثناء الفحص وممكن يتضغط تاني بسرعة (خصوصًا على الموبايل)
    // ويسبب نشر مكرر. finally تحت بيضمن إعادة فتحه في كل الحالات (نجاح، فشل، أو أي return مبكر).
    setSubmitting(true);
    let saveTimeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const user = auth.currentUser;
      if (!user) return;

      // حد النشر الشهري بيتفعّل بس وقت النشر الجديد، مش وقت التعديل
      if (!isEditMode) {
        const monthlyLimit = employerPlan === "premium" ? 10 : 5;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // getCountFromServer بدل جلب كل إعلانات صاحب العمل من أول يوم وفلترتها بعد الجلب —
        // استعلام العدّ ده بيرجع الرقم بس من غير ما يجيب أي مستند فعليًا (نفس فكرة لوحة
        // الإدارة). محتاج composite index جديد (employerId + createdAt) — راجع firestore.indexes.json.
        const countSnap = await getCountFromServer(
          query(
            collection(db, "job_posts"),
            where("employerId", "==", user.uid),
            where("createdAt", ">=", Timestamp.fromDate(startOfMonth))
          )
        );
        if (countSnap.data().count >= monthlyLimit) {
          alert(
            employerPlan === "premium"
              ? `وصلت للحد الأقصى (${monthlyLimit} إعلانات) للباقة المدفوعة الشهر ده.`
              : `الباقة المجانية بتسمح بحد أقصى ${monthlyLimit} إعلانات جديدة شهريًا، وإنت وصلت للحد ده الشهر ده.`
          );
          return;
        }

        // فحص نشر مكرر: لو صاحب العمل بعت نفس العنوان بالظبط خلال آخر 10 دقايق (غالبًا بسبب
        // إعادة محاولة يدوية بعد بطء أو timeout حصل في الحفظ)، بنأكد منه قبل ما نكمل — بدل ما
        // نمنعه خالص، لأن ممكن يكون فعلاً قاصد ينشر نفس الوظيفة تاني (فرصة تانية بنفس المسمى).
        const tenMinutesAgo = new Date();
        tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
        const duplicateSnap = await getDocs(
          query(
            collection(db, "job_posts"),
            where("employerId", "==", user.uid),
            where("title", "==", title),
            where("createdAt", ">=", Timestamp.fromDate(tenMinutesAgo)),
            limit(1)
          )
        );
        if (!duplicateSnap.empty) {
          const confirmed = window.confirm(
            "يبدو إنك نشرت وظيفة بنفس الاسم ده قبل شوية، متأكد عايز تنشر تاني؟"
          );
          if (!confirmed) return;
        }
      }

      if (receiveMethod === "contact" && (!contactMethod || !contactValue.trim())) {
        alert('اخترت "إظهار وسيلة تواصل" — لازم تحدد طريقة التواصل وتكتب بياناتها.');
        return;
      }

      const finalCity = citySelect === "other" ? cityOther.trim() : citySelect;
      const finalSpecialization = specSelect === "other" ? specOther.trim() : specSelect;

      const postData: any = {
        employerId: isEditMode && editingPost ? editingPost.data.employerId : user.uid,
        companyName,
        showCompanyName,
        title,
        specialization: finalSpecialization,
        jobType,
        jobLevel,
        governorate,
        city: finalCity,
        vacancies: Number(vacancies || 1),
        salaryNegotiable,
        salaryFrom: salaryNegotiable ? null : (salaryFrom ? Number(salaryFrom) : null),
        salaryTo: salaryNegotiable ? null : (salaryTo ? Number(salaryTo) : null),
        showSalary,
        description,
        hoursPerDay: hoursPerDay ? Number(hoursPerDay) : null,
        daysOffPerMonth: daysOffPerMonth ? Number(daysOffPerMonth) : null,
        socialInsurance,
        privateHealthInsurance,
        transportationAvailable,
        transportationAreas: transportationAreas || "",
        housingForExpats,
        ageFrom: ageFrom ? Number(ageFrom) : null,
        ageTo: ageTo ? Number(ageTo) : null,
        needsCar: needsCar || "",
        requirements: requirements || "",
        receiveMethod,
        contactMethod: receiveMethod === "contact" ? contactMethod : "",
        contactValue: receiveMethod === "contact" ? contactValue : "",
        additionalBenefits: additionalBenefits || "",
        screeningQuestions,
        featured: employerPlan === "premium",
        isActive: true,
      };

      // Promise.race مع مهلة 15 ثانية — لو addDoc/updateDoc اتعلقت، بنرفض بـSAVE_TIMEOUT بدل
      // ما نسيب "جاري الحفظ..." معلّقة للأبد من غير أي رسالة.
      function withSaveTimeout<T>(promise: Promise<T>): Promise<T> {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            saveTimeoutId = setTimeout(() => reject(new Error("SAVE_TIMEOUT")), SAVE_TIMEOUT_MS);
          }),
        ]);
      }

      if (isEditMode && editingPost) {
        await withSaveTimeout(updateDoc(doc(db, "job_posts", editingPost.id), postData));
        alert("تم حفظ التعديلات ✓");
        resetForm();
        onPosted();
      } else {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + (employerPlan === "premium" ? 60 : 30));
        postData.expiresAt = Timestamp.fromDate(expiry);
        const docRef = await withSaveTimeout(
          addDoc(collection(db, "job_posts"), {
            ...postData,
            createdAt: serverTimestamp(),
          })
        );
        alert("تم نشر الإعلان بنجاح ✓");
        resetForm();
        // النشر نجح فعليًا، فمفيش داعي نفضل محتفظين بالمسودة المحلية بعد كده.
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // متجاهلينها زي أي فشل تاني في localStorage
        }
        onPosted(docRef.id);
      }
    } catch (err: any) {
      console.error("Job post save failed", err);
      if (err instanceof Error && err.message === "SAVE_TIMEOUT") {
        alert("الطلب مستني كتير — جرب تعمل ريفريش للصفحة وحاول تاني");
      } else {
        alert(friendlyErrorMessage(err));
      }
    } finally {
      clearTimeout(saveTimeoutId);
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTitle("");
    setSpecSelect("");
    setSpecOther("");
    setJobType("");
    setJobLevel("");
    setGovernorate("");
    setCitySelect("");
    setCityOther("");
    setDescription("");
    setVacancies("1");
    setSalaryNegotiable(false);
    setSalaryFrom("");
    setSalaryTo("");
    setShowSalary(true);
    setAgeFrom("");
    setAgeTo("");
    setNeedsCar("");
    setRequirements("");
    setHoursPerDay("");
    setDaysOffPerMonth("");
    setSocialInsurance("");
    setPrivateHealthInsurance("");
    setTransportationAvailable("");
    setTransportationAreas("");
    setHousingForExpats("");
    setAdditionalBenefits("");
    setScreeningQuestions([]);
    setNewQuestionSelect("");
    setNewQuestionOther("");
    setShowCompanyName(showCompanyNameDefault ?? true);
    setReceiveMethod("platform");
    setContactMethod("");
    setContactValue("");
  }

  const submitButton = (
    <button
      type="submit"
      disabled={submitting}
      style={{
        width: "100%",
        padding: "14px",
        background: "#14213D",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontSize: 16,
        fontWeight: 700,
        cursor: submitting ? "wait" : "pointer",
      }}
    >
      {submitting ? "جاري الحفظ..." : (isEditMode ? "حفظ التعديلات" : "نشر الإعلان")}
    </button>
  );

  return (
    <div dir="rtl" style={{ maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, marginBottom: 10 }}>
        {isEditMode ? "تعديل الإعلان" : "انشر إعلان وظيفة جديد"}
      </h2>

      <div style={progressBarStyle}>
        <span style={readyToPost ? readyBadgeStyle : pendingBadgeStyle}>
          {readyToPost ? "✓ الحد الأدنى للنشر جاهز" : `أكمل ${missingRequiredFields.join(" و")}`}
        </span>
        <span style={{ color: "#4A5568", fontSize: 12.5 }}>باقي التفاصيل تحت اختيارية بالكامل</span>
      </div>

      <form onSubmit={handleSubmit}>
        <fieldset style={basicSectionStyle}>
          <h3 style={basicH3Style}>📋 المعلومات الأساسية</h3>
          <div style={gridStyle}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>المسمى الوظيفي</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="مثال: محاسب أول" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>التخصص</label>
              <select value={specSelect} onChange={(e) => setSpecSelect(e.target.value)} required style={inputStyle}>
                <option value="">اختر التخصص</option>
                {SPECIALIZATION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="other">أخرى</option>
              </select>
            </div>
            {specSelect === "other" && (
              <div>
                <label style={labelStyle}>اكتب التخصص</label>
                <input type="text" value={specOther} onChange={(e) => setSpecOther(e.target.value)} required style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>نوع الدوام</label>
              <select value={jobType} onChange={(e) => setJobType(e.target.value)} required style={inputStyle}>
                <option value="">اختر نوع الدوام</option>
                <option value="full_time">دوام كامل</option>
                <option value="part_time">دوام جزئي</option>
                <option value="remote">عن بعد</option>
                <option value="freelance">فريلانس</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>مستوى الوظيفة (اختياري)</label>
              <select value={jobLevel} onChange={(e) => setJobLevel(e.target.value)} style={inputStyle}>
                <option value="">غير محدد</option>
                {Object.entries(EXPERIENCE_LEVELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>المحافظة</label>
              <select value={governorate} onChange={(e) => { setGovernorate(e.target.value); setCitySelect(""); }} required style={inputStyle}>
                <option value="">اختر المحافظة</option>
                {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>المدينة (اختياري)</label>
              <select value={citySelect} onChange={(e) => setCitySelect(e.target.value)} style={inputStyle}>
                <option value="">غير محدد</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="other">أخرى (اكتب بنفسك)</option>
              </select>
            </div>
            {citySelect === "other" && (
              <div>
                <label style={labelStyle}>اكتب المدينة</label>
                <input type="text" value={cityOther} onChange={(e) => setCityOther(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>وصف الوظيفة</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="المهام والمميزات..." style={{ ...inputStyle, minHeight: 80 }} />
            </div>
          </div>
        </fieldset>

        <CollapsibleSection title="💰 الراتب وعدد الفرص" subtitle="حدد نطاق الراتب — بيساعد يجذب مرشحين مناسبين أكتر">
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>عدد الفرص المتاحة</label>
              <input type="number" min="1" value={vacancies} onChange={(e) => setVacancies(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 22 }}>
              <input type="checkbox" id="salaryNegotiable" checked={salaryNegotiable} onChange={(e) => setSalaryNegotiable(e.target.checked)} />
              <label htmlFor="salaryNegotiable" style={{ fontSize: 13.5 }}>الراتب قابل للتفاوض / حسب الخبرة</label>
            </div>
            {!salaryNegotiable && (
              <>
                <div>
                  <label style={labelStyle}>الراتب من (جنيه)</label>
                  <input type="number" min="0" value={salaryFrom} onChange={(e) => setSalaryFrom(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>الراتب إلى (جنيه) — اختياري</label>
                  <input type="number" min="0" value={salaryTo} onChange={(e) => setSalaryTo(e.target.value)} style={inputStyle} />
                </div>
              </>
            )}
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" id="showSalary" checked={showSalary} onChange={(e) => setShowSalary(e.target.checked)} />
              <label htmlFor="showSalary" style={{ fontSize: 13.5 }}>أظهر الراتب في الإعلان (لو مش متعلّم، هيظهر "غير محدد")</label>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="📝 شروط المتقدم" subtitle="حدد سن أو شروط معينة لو محتاجها — سيب الحقول فاضية لو أي حد يقدر يقدّم">
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>السن من</label>
              <select value={ageFrom} onChange={(e) => setAgeFrom(e.target.value)} style={inputStyle}>
                <option value="">غير محدد</option>
                {AGE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>السن إلى</label>
              <select value={ageTo} onChange={(e) => setAgeTo(e.target.value)} style={inputStyle}>
                <option value="">غير محدد</option>
                {AGE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>محتاج عربية؟</label>
              <select value={needsCar} onChange={(e) => setNeedsCar(e.target.value)} style={inputStyle}>
                <option value="">غير محدد</option>
                <option value="yes">أيوة</option>
                <option value="no">لأ</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>شروط أخرى</label>
              <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="مثال: ذكور فقط، خبرة سابقة في مجال معين" style={{ ...inputStyle, minHeight: 80 }} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="❓ أسئلة فرز للمتقدمين" subtitle="ضيف أسئلة يجاوب عليها كل متقدم وقت التقديم — بتوفر عليك وقت الفرز">
          <p style={{ fontSize: 13, color: "#4A5568", marginBottom: 12 }}>
            المتقدم هيجاوب على الأسئلة دي وقت التقديم، وهتظهر إجاباته لك جنب باقي بياناته.
          </p>

          {screeningQuestions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {screeningQuestions.map((q) => (
                <div
                  key={q.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}
                >
                  <span style={{ fontSize: 13.5 }}>{q.text}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={() => toggleScreeningQuestionRequired(q.id)}
                      />
                      إجباري
                    </label>
                    <button
                      type="button"
                      onClick={() => removeScreeningQuestion(q.id)}
                      style={{ background: "none", border: "none", color: "#B03A14", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>اختر سؤال</label>
              <select value={newQuestionSelect} onChange={(e) => setNewQuestionSelect(e.target.value)} style={inputStyle}>
                <option value="">اختر من القائمة</option>
                {availableQuestionOptions.map((q) => (
                  <option key={q.text} value={q.text}>{q.text}</option>
                ))}
                <option value="other">أخرى (اكتب سؤالك)</option>
              </select>
            </div>
            {newQuestionSelect === "other" && (
              <div>
                <label style={labelStyle}>اكتب السؤال</label>
                <input type="text" value={newQuestionOther} onChange={(e) => setNewQuestionOther(e.target.value)} style={inputStyle} />
              </div>
            )}
          </div>
          <button type="button" onClick={addScreeningQuestion} style={{ ...ghostBtnStyle, marginTop: 12 }}>
            + إضافة السؤال
          </button>
        </CollapsibleSection>

        <CollapsibleSection title="⏰ ساعات العمل والمزايا" subtitle="وضّح ساعات العمل والمزايا زي التأمين والمواصلات — بيزود ثقة المتقدمين">
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>عدد ساعات العمل يوميًا</label>
              <input type="number" min="1" max="24" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>عدد أيام الراحة شهريًا</label>
              <input type="number" min="0" max="30" value={daysOffPerMonth} onChange={(e) => setDaysOffPerMonth(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>تأمين اجتماعي</label>
              <select value={socialInsurance} onChange={(e) => setSocialInsurance(e.target.value)} style={inputStyle}>
                <option value="">غير محدد</option>
                <option value="yes">متوفر</option>
                <option value="no">غير متوفر</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>تأمين صحي خاص</label>
              <select value={privateHealthInsurance} onChange={(e) => setPrivateHealthInsurance(e.target.value)} style={inputStyle}>
                <option value="">غير محدد</option>
                <option value="yes">متوفر</option>
                <option value="no">غير متوفر</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>مواصلات</label>
              <select value={transportationAvailable} onChange={(e) => setTransportationAvailable(e.target.value)} style={inputStyle}>
                <option value="">غير محدد</option>
                <option value="yes">متوفرة</option>
                <option value="no">غير متوفرة</option>
              </select>
            </div>
            {transportationAvailable === "yes" && (
              <div>
                <label style={labelStyle}>الأماكن اللي المواصلات متوفرة ليها</label>
                <input type="text" value={transportationAreas} onChange={(e) => setTransportationAreas(e.target.value)} placeholder="مثال: مدينة نصر، العبور" style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>سكن للمغتربين</label>
              <select value={housingForExpats} onChange={(e) => setHousingForExpats(e.target.value)} style={inputStyle}>
                <option value="">غير محدد</option>
                <option value="yes">متوفر</option>
                <option value="no">غير متوفر</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>مزايا أخرى</label>
              <input type="text" value={additionalBenefits} onChange={(e) => setAdditionalBenefits(e.target.value)} placeholder="مثال: بونص شهري، تدريب مجاني" style={inputStyle} />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="🏢 إعدادات الإعلان" subtitle="تحكم في ظهور اسم شركتك وطريقة استقبال المتقدمين">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            <input type="checkbox" id="showCompanyNamePost" checked={showCompanyName} onChange={(e) => setShowCompanyName(e.target.checked)} />
            <label htmlFor="showCompanyNamePost" style={{ fontSize: 13.5 }}>أظهر اسم الشركة في الإعلان</label>
          </div>

          <label style={labelStyle}>طريقة استقبال المتقدمين</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5 }}>
              <input type="radio" checked={receiveMethod === "platform"} onChange={() => setReceiveMethod("platform")} style={{ marginTop: 3 }} />
              <span><strong>استقبل الطلبات من خلال الموقع بس</strong> — تشوف المتقدمين من "عرض المتقدمين" في إعلاناتك</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5 }}>
              <input type="radio" checked={receiveMethod === "contact"} onChange={() => setReceiveMethod("contact")} style={{ marginTop: 3 }} />
              <span><strong>إظهار وسيلة تواصل مباشرة في الإعلان</strong> — الباحثين عن عمل يتواصلوا معاك مباشرة</span>
            </label>
          </div>

          {receiveMethod === "contact" && (
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>طريقة التواصل</label>
                <select value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} style={inputStyle}>
                  <option value="">اختر</option>
                  <option value="email">إيميل</option>
                  <option value="whatsapp">واتساب</option>
                  <option value="phone">تليفون</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>بيانات التواصل</label>
                <input type="text" value={contactValue} onChange={(e) => setContactValue(e.target.value)} placeholder="الإيميل أو الرقم" style={inputStyle} />
              </div>
            </div>
          )}
        </CollapsibleSection>

        <div style={{ marginTop: 20 }}>{submitButton}</div>
      </form>
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <details className="job-post-collapsible" style={collapsibleCardStyle}>
      <summary style={summaryStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={summaryTitleStyle}>{title}</span>
          <span className="chevron" style={chevronStyle}>▾</span>
        </div>
        <div style={summarySubtitleStyle}>{subtitle}</div>
      </summary>
      <div style={collapsibleBodyStyle}>{children}</div>
    </details>
  );
}

const basicSectionStyle: React.CSSProperties = {
  border: "1.5px solid #14213D33",
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
  background: "#fff",
};
const basicH3Style: React.CSSProperties = { marginBottom: 14, fontSize: 17, fontWeight: 800, color: "#14213D" };

const progressBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 10,
  marginBottom: 18,
};
const readyBadgeStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "#2F6F4E",
  background: "rgba(47,111,78,0.12)",
  padding: "5px 12px",
  borderRadius: 999,
};
const pendingBadgeStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "#8A570D",
  background: "rgba(232,163,61,0.18)",
  padding: "5px 12px",
  borderRadius: 999,
};

const collapsibleCardStyle: React.CSSProperties = {
  border: "1px solid #14213D1F",
  borderRadius: 12,
  marginBottom: 20,
  background: "#FFFDF8",
  overflow: "hidden",
};
const summaryStyle: React.CSSProperties = {
  cursor: "pointer",
  padding: "16px 18px",
  userSelect: "none",
};
const summaryTitleStyle: React.CSSProperties = { fontSize: 15.5, fontWeight: 800, color: "#14213D" };
const summarySubtitleStyle: React.CSSProperties = { fontSize: 12.5, color: "#4A5568", marginTop: 4, lineHeight: 1.6 };
const chevronStyle: React.CSSProperties = { fontSize: 15, color: "#4A5568", flexShrink: 0 };
const collapsibleBodyStyle: React.CSSProperties = {
  padding: "4px 18px 20px",
  borderTop: "1px solid #14213D14",
  paddingTop: 16,
};

const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 4, fontSize: 13.5, fontWeight: 600 };
const inputStyle: React.CSSProperties = { width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 };
const ghostBtnStyle: React.CSSProperties = { padding: "8px 16px", background: "transparent", border: "1px solid #14213D", borderRadius: 6, cursor: "pointer" };
