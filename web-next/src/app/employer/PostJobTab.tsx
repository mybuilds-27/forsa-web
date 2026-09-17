"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getCountFromServer, getDoc, getDocs, limit, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { GOVERNORATES, GOVERNORATE_CITIES, SPECIALIZATION_OPTIONS, EXPERIENCE_LEVELS, SCREENING_QUESTION_OPTIONS, KEYWORD_OPTIONS, SPECIALIZATION_KEYWORD_MAP } from "@/lib/constants";
import { friendlyErrorMessage } from "@/lib/errorMessages";
import { logClientError } from "@/lib/errorLog";
import { checkEmailVerificationGate } from "@/lib/emailVerificationGate";
import { withGracePeriod, getConnectionDiagnostics } from "@/lib/withGracePeriod";
import EmailVerificationNotice from "@/components/EmailVerificationNotice";
import KeywordsPicker, { MAX_KEYWORDS } from "@/components/KeywordsPicker";

const AGE_OPTIONS = Array.from({ length: 50 }, (_, i) => 16 + i);

// نفس القايمة المستخدمة في باقي الملفات (Navbar.tsx، admin/page.tsx، InviteToJobModal.tsx)
// لتحديد حساب الأدمن.
const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

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
  const [keywords, setKeywords] = useState<string[]>([]);

  // اقتراح كلمات مفتاحية من مصدرين: (1) الكلمات المرتبطة بالتخصص المختار عبر
  // SPECIALIZATION_KEYWORD_MAP (لو التخصص متعرّف فيها)، و(2) مطابقة نصية بسيطة بين المسمى
  // الوظيفي والقايمة الكاملة KEYWORD_OPTIONS. النتيجتين بتتجمعوا (كلمات التخصص الأول) من غير
  // تكرار، وبيتم استبعاد أي كلمة اتاختارت فعلًا. لو التخصص مش متعرّف في الربط (أو "أخرى")،
  // بيرجع لمطابقة العنوان بس زي ما كان — مفيش أي كسر في السلوك القديم. toLowerCase() بيفرق
  // بس مع الكلمات الإنجليزية (Excel, Word...)، وبيبقى no-op آمن للعربي.
  const keywordSuggestions = useMemo(() => {
    const trimmed = title.trim();
    const lowerTitle = trimmed.toLowerCase();
    const fromSpec = SPECIALIZATION_KEYWORD_MAP[specSelect] || [];
    const fromTitle = trimmed ? KEYWORD_OPTIONS.filter((k) => lowerTitle.includes(k.toLowerCase())) : [];
    const combined = [...fromSpec, ...fromTitle.filter((k) => !fromSpec.includes(k))];
    return combined.filter((k) => !keywords.includes(k));
  }, [title, specSelect, keywords]);
  const [jobType, setJobType] = useState("");
  const [jobLevel, setJobLevel] = useState("");
  // نطاق رقمي إضافي جنب jobLevel، مش بديل له — jobLevel بيحدد الدرجة الوظيفية (مبتدئ/مدير
  // قسم/إلخ)، والنطاق ده بيحدد عدد سنوات الخبرة المطلوبة رقميًا، بغض النظر عن الدرجة.
  const [minExperience, setMinExperience] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
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
  // بانر نجاح غير blocking بدل alert() القديمة — alert() كانت بتوقف تنفيذ الجافاسكريبت
  // بالكامل لحد ما المستخدم يقفلها يدويًا، يعني onPosted(docRef.id) (وبالتبعية الريديركت
  // لتبويب "البحث عن كوادر" في employer/page.tsx) كانت معلّقة على فعل يدوي منه. دلوقتي
  // onPosted بتتنادى فورًا، والبانر ده مجرد تأكيد بصري بيختفي لوحده (useEffect تحت).
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timeoutId);
  }, [successMessage]);

  // بانر غير blocking بيبان لو الحفظ عدّى SAVE_TIMEOUT_MS ولسه شغال — بديل لرسالة "اعمل
  // ريفريش" القديمة اللي كانت بتفترض فشل فوري. مبيتمسحش لوحده بعد فترة ثابتة زي successMessage
  // — بيتقفل بس لما الحفظ يخلص فعليًا (نجاح أو فشل حقيقي)، شوف withGracePeriod/handleSubmit.
  const [slowSaveNotice, setSlowSaveNotice] = useState(false);

  // بيمنع كامل تبويب نشر الوظيفة (مش بس لحظة الحفظ) لو الحساب لسه محتاج تأكيد إيميل —
  // شوف lib/emailVerificationGate.ts. null يعني لسه بنفحص، الفورم مبيتعرضش قبلها عشان
  // منورّيش المستخدم فورم كامل هيتمنع بعدين عند آخر لحظة.
  const [emailVerification, setEmailVerification] = useState<{ blocked: boolean; email?: string } | null>(null);

  useEffect(() => {
    (async () => {
      const result = await checkEmailVerificationGate();
      setEmailVerification(result.blocked ? { blocked: true, email: result.email } : { blocked: false });
    })();
  }, []);

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

    setKeywords(Array.isArray(p.keywords) ? p.keywords : []);
    setJobType(p.jobType || "");
    setJobLevel(p.jobLevel || "");
    setMinExperience(p.minExperience?.toString() || "");
    setMaxExperience(p.maxExperience?.toString() || "");
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
        title, specSelect, specOther, keywords, jobType, jobLevel, minExperience, maxExperience, governorate, citySelect, cityOther,
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
    isEditMode, title, specSelect, specOther, keywords, jobType, jobLevel, minExperience, maxExperience, governorate, citySelect, cityOther,
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
    setKeywords(Array.isArray(draft.keywords) ? draft.keywords : []);
    setJobType(draft.jobType || "");
    setJobLevel(draft.jobLevel || "");
    setMinExperience(draft.minExperience || "");
    setMaxExperience(draft.maxExperience || "");
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
    setSlowSaveNotice(false);
    try {
      const user = auth.currentUser;
      if (!user) return;

      // تحديث إجباري لتوكن المصادقة قبل أي كتابة — لو الجلسة طالت والتوكن المحفوظ محليًا
      // بقى منتهي/غير صالح، auth.currentUser فوق بيفضل شايله في الذاكرة عادي (مفيش أي مؤشر
      // بصري إنه مشكلة)، لكن أي كتابة Firestore بعد كده هترفض بـpermission-denied غامض —
      // ده أرجح تفسير وحيد بيغطي حادثة اتسجلت permission-denied من غير أي أثر في error_logs
      // (نفس السبب منع كتابة job_posts وerror_logs مع بعض في نفس اللحظة). getIdToken(true)
      // بيعمل رحلة شبكة حقيقية للتجديد؛ لو فشلت فعلًا (جلسة منتهية فعليًا مش مجرد تجديد
      // عادي)، بنوقف هنا برسالة واضحة بدل ما نكمل ونوصل لرفض غامض في الكتابة الفعلية.
      try {
        await user.getIdToken(true);
      } catch (err) {
        console.error("Failed to refresh auth token before posting", err);
        logClientError(isEditMode ? "job_post_update" : "job_post_create", err, { stage: "token_refresh" });
        alert("يظهر إن جلستك انتهت — سجّل دخولك تاني وجرب تنشر الوظيفة من جديد.");
        return;
      }

      // employerPlan (الـprop) بتتحمّل مرة واحدة بس وقت فتح صفحة /employer — لو الباقة
      // اتغيّرت (ترقية بعد طلب واتساب، أو انتهاء صلاحية) والمستخدم فاتح نفس الصفحة من فترة،
      // القيمة القديمة ممكن تبقى غير متطابقة مع employers/{uid}.plan الحقيقي وقت الحفظ.
      // بنجيب القيمة الحية دلوقتي ونستخدمها هنا بدل الـprop — أهم حاجة عشان featured تحت،
      // اللي قواعد Firestore غالبًا بتتحقق منها مقابل الباقة الفعلية وقت الكتابة، فمينفعش
      // نبعت featured:true وإحنا مش بريميوم فعليًا (ده أرجح سبب لـpermission-denied وقت
      // النشر). فشل الجلب (شبكة عابرة) بيرجّعنا للـprop القديمة بدل ما يمنع النشر بالكامل.
      // مهم: لازم نجيب باقة صاحب العمل الحقيقي (editingPost.data.employerId وقت التعديل)
      // مش user.uid على طول — الأدمن بيقدر يعدّل وظايف شركات تانية من لوحة التحكم
      // (admin/page.tsx)، فـuser.uid هناك بيكون uid الأدمن نفسه مش صاحب الوظيفة، وقراءة
      // employers/{user.uid} في الحالة دي كانت بترجع باقة الأدمن (لو عنده حساب صاحب عمل
      // بريميوم للاختبار مثلاً) وتتكتب على وظيفة شركة تانية بالكامل — نفس نمط employerId تحت.
      const planOwnerUid = isEditMode && editingPost ? editingPost.data.employerId : user.uid;
      let currentPlan = employerPlan;
      try {
        const employerSnap = await getDoc(doc(db, "employers", planOwnerUid));
        currentPlan = employerSnap.data()?.plan || "free";
      } catch (err) {
        console.error("Failed to refresh employer plan before posting", err);
      }

      // حد النشر الشهري بيتفعّل بس وقت النشر الجديد، مش وقت التعديل
      if (!isEditMode) {
        // الأدمن مستثنى تمامًا من الحد الشهري — نفس نمط حد الدعوات الشهرية في
        // InviteToJobModal.tsx (مش منطقي نطبقه عليه، بيستخدم حسابه لأغراض إدارية/اختبار
        // مش استهلاك رصيد شخصي فعلي).
        const isAdmin = ADMIN_EMAILS.includes(user.email || "");
        if (!isAdmin) {
          const monthlyLimit = currentPlan === "premium" ? 10 : 5;
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
              currentPlan === "premium"
                ? `وصلت للحد الأقصى (${monthlyLimit} إعلانات) للباقة المدفوعة الشهر ده.`
                : `الباقة المجانية بتسمح بحد أقصى ${monthlyLimit} إعلانات جديدة شهريًا، وإنت وصلت للحد ده الشهر ده.`
            );
            return;
          }
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

      if (minExperience && maxExperience && Number(minExperience) > Number(maxExperience)) {
        alert("الحد الأدنى لسنوات الخبرة أكبر من الحد الأقصى — راجع الرقمين.");
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
        keywords,
        jobType,
        jobLevel,
        minExperience: minExperience ? Number(minExperience) : null,
        maxExperience: maxExperience ? Number(maxExperience) : null,
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
        // لو الأدمن ميّز الوظيفة دي يدويًا (featuredByAdmin على المستند الحالي وقت التعديل)،
        // أي حفظ لاحق (حتى لو باقة صاحب العمل مجانية) لازم يحافظ على featured: true — من غيره
        // أول تعديل عادي (حتى من صاحب العمل نفسه) كان هيمسح التمييز اليدوي بالغلط، لأن السطر
        // ده كان بيعيد حسابها من الباقة بس في كل حفظ. featuredByAdmin نفسها متلمسش هنا خالص.
        featured: currentPlan === "premium" || (isEditMode && editingPost?.data.featuredByAdmin === true),
        isActive: true,
      };

      if (isEditMode && editingPost) {
        // updatedAt بتتحدث بس هنا (مسار التعديل) — postData نفسها مشتركة مع مسار النشر
        // الجديد تحت، فمينفعش نضيفها هناك عشان مبقاش لها معنى وقت الإنشاء الأول.
        const updatePromise = updateDoc(doc(db, "job_posts", editingPost.id), { ...postData, updatedAt: serverTimestamp() });
        await withGracePeriod(updatePromise, () => setSlowSaveNotice(true));
        setSlowSaveNotice(false);
        alert("تم حفظ التعديلات ✓");
        resetForm();
        onPosted();
      } else {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + (currentPlan === "premium" ? 60 : 30));
        postData.expiresAt = Timestamp.fromDate(expiry);
        const addPromise = addDoc(collection(db, "job_posts"), {
          ...postData,
          createdAt: serverTimestamp(),
        });
        const docRef = await withGracePeriod(addPromise, () => setSlowSaveNotice(true));
        setSlowSaveNotice(false);
        setSuccessMessage("تم نشر الإعلان بنجاح ✓");
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
      const isHardTimeout = err instanceof Error && err.message === "HARD_FAIL_TIMEOUT";
      logClientError(
        isEditMode ? "job_post_update" : "job_post_create",
        err,
        isHardTimeout ? getConnectionDiagnostics() : undefined
      );
      setSlowSaveNotice(false);
      if (isHardTimeout) {
        alert(
          "حصلت مشكلة في الاتصال ومقدرناش نتأكد من نجاح الحفظ خلال وقت معقول — تأكد من اتصال الإنترنت وجرب تاني. لو الوظيفة اتنشرت فعلاً هتلاقيها في قائمة إعلاناتك."
        );
      } else {
        alert(friendlyErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTitle("");
    setSpecSelect("");
    setSpecOther("");
    setKeywords([]);
    setJobType("");
    setJobLevel("");
    setMinExperience("");
    setMaxExperience("");
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

  if (emailVerification?.blocked) {
    return (
      <div dir="rtl" style={{ maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>
          {isEditMode ? "تعديل الإعلان" : "انشر إعلان وظيفة جديد"}
        </h2>
        <EmailVerificationNotice email={emailVerification.email || ""} />
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ maxWidth: 700, margin: "0 auto" }}>
      {successMessage && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            background: "#2F6F4E",
            color: "#fff",
            padding: "12px 22px",
            borderRadius: 10,
            fontSize: 14.5,
            fontWeight: 700,
            boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            pointerEvents: "none",
          }}
        >
          {successMessage}
        </div>
      )}

      {slowSaveNotice && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            background: "#E8A33D",
            color: "#14213D",
            padding: "12px 22px",
            borderRadius: 10,
            fontSize: 14.5,
            fontWeight: 700,
            boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            pointerEvents: "none",
          }}
        >
          ⏳ بياخد وقت أطول من المعتاد، برجاء الانتظار...
        </div>
      )}

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
            {keywordSuggestions.length > 0 && (
              <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#4A5568" }}>كلمات مقترحة من التخصص والعنوان:</span>
                {keywordSuggestions.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => keywords.length < MAX_KEYWORDS && setKeywords([...keywords, kw])}
                    disabled={keywords.length >= MAX_KEYWORDS}
                    style={{
                      fontSize: 12.5,
                      padding: "3px 10px",
                      borderRadius: 999,
                      border: "1px solid #14213D33",
                      background: "#F1EAD9",
                      color: "#14213D",
                      cursor: keywords.length >= MAX_KEYWORDS ? "not-allowed" : "pointer",
                      opacity: keywords.length >= MAX_KEYWORDS ? 0.5 : 1,
                      fontFamily: "inherit",
                    }}
                  >
                    + {kw}
                  </button>
                ))}
              </div>
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>الكلمات المفتاحية (اختياري) — بتساعد تظهر الوظيفة للباحثين المناسبين أكتر</label>
              <KeywordsPicker value={keywords} onChange={setKeywords} />
            </div>
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
              <label style={labelStyle}>الحد الأدنى لسنوات الخبرة (اختياري)</label>
              <input type="number" min="0" value={minExperience} onChange={(e) => setMinExperience(e.target.value)} placeholder="غير محدد" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>الحد الأقصى لسنوات الخبرة (اختياري)</label>
              <input type="number" min="0" value={maxExperience} onChange={(e) => setMaxExperience(e.target.value)} placeholder="غير محدد" style={inputStyle} />
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
