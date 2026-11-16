// حساب صافي المرتب من الإجمالي والعكس (حاسبة /tools/salary-calculator). دوال pure من غير React.

// ===== ثوابت سنة 2026 — لازم تتحدث كل سنة =====
// حدود أجر الاشتراك التأميني بتتغير عادةً في أول يناير (قرار الهيئة القومية للتأمين الاجتماعي)،
// وكذلك أي تعديل في شرائح ضريبة الدخل أو الإعفاء الشخصي. حدّث الأرقام دي والشرائح في annualTax مع ملف
// Excel اللي في public/tools.
export const INS_MIN = 2700; // الحد الأدنى لأجر الاشتراك التأميني الشهري
export const INS_MAX = 16700; // الحد الأقصى لأجر الاشتراك التأميني الشهري
export const EMPLOYEE_INS_RATE = 0.11; // حصة العامل في التأمينات الاجتماعية
export const MARTYRS_FUND_RATE = 0.0005; // صندوق أسر الشهداء (5 جنيه لكل 10,000)
export const PERSONAL_EXEMPTION = 20000; // الإعفاء الشخصي السنوي

// أجر الاشتراك التأميني: المكتوب (لو أكبر من 0) أو تقدير الإجمالي ÷ 1.3، في حدود INS_MIN وINS_MAX
export function insuranceWage(gross: number, override?: number): number {
  if (override !== undefined && override > 0) return Math.min(INS_MAX, Math.max(INS_MIN, override));
  return Math.min(INS_MAX, Math.max(INS_MIN, Math.round(gross / 1.3)));
}

// الضريبة السنوية على الوعاء السنوي بعد الإعفاء الشخصي (J)، بالشرائح المتدرجة. فوق 600,000 الممول بيفقد
// الشرائح الأقل تدريجيًا (extra)، وفوق 1,200,000 بيتحاسب على أول 1,200,000 بـ25% والباقي بـ27.5%.
export function annualTax(J: number): number {
  if (J <= 40000) return 0;
  if (J <= 55000) return (J - 40000) * 0.1;
  if (J <= 70000) return (J - 55000) * 0.15 + 1500;
  if (J <= 200000) return (J - 70000) * 0.2 + 3750;
  if (J <= 400000) return (J - 200000) * 0.225 + 29750;
  if (J <= 600000) return (J - 400000) * 0.25 + 74750;
  if (J <= 1200000) {
    let extra = 0;
    if (J >= 900001) extra = 15250;
    else if (J >= 800001) extra = 10250;
    else if (J >= 700001) extra = 6750;
    else if (J >= 600001) extra = 4000;
    return (J - 400000) * 0.25 + 74750 + extra;
  }
  return (J - 1200000) * 0.275 + 300000;
}

export type SalaryBreakdown = {
  gross: number;
  insWage: number;
  employeeIns: number;
  martyrsFund: number;
  annualBase: number;
  annualTax: number;
  monthlyTax: number;
  net: number;
  // true لو أجر الاشتراك تقديري (مفيش override)
  estimatedIns: boolean;
};

export function grossToNet(gross: number, insOverride?: number): SalaryBreakdown {
  const insWage = insuranceWage(gross, insOverride);
  const employeeIns = insWage * EMPLOYEE_INS_RATE;
  const martyrsFund = gross * MARTYRS_FUND_RATE;
  // الوعاء السنوي مقرّب لأقل 10 جنيه، وبعدين الإعفاء الشخصي
  const annualBase = Math.floor(((gross - employeeIns) * 12) / 10) * 10 - PERSONAL_EXEMPTION;
  const yearlyTax = annualTax(annualBase);
  const monthlyTax = yearlyTax / 12;
  return {
    gross,
    insWage,
    employeeIns,
    martyrsFund,
    annualBase,
    annualTax: yearlyTax,
    monthlyTax,
    net: gross - employeeIns - martyrsFund - monthlyTax,
    estimatedIns: !(insOverride !== undefined && insOverride > 0),
  };
}

// من الصافي للإجمالي: مفيش معادلة مباشرة (الضريبة بتتغير مع الإجمالي)، فبنبدأ من الصافي ونزوّد الفرق 15 مرة.
export function netToGross(net: number, insOverride?: number): SalaryBreakdown {
  let G = net;
  for (let i = 0; i < 15; i++) G = G + (net - grossToNet(G, insOverride).net);
  return grossToNet(G, insOverride);
}
