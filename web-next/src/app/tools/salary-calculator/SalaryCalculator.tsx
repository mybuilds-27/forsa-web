"use client";

import { useEffect, useRef, useState } from "react";
import { doc, increment, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { grossToNet, netToGross, INS_MAX, INS_MIN } from "@/lib/salaryCalc";

// عداد استخدام الحاسبة (tool_usage/salary-calculator): +1 في حقل واحد بس، من غير أي بيانات عن الزائر
// ولا المبلغ. fire-and-forget: الفشل بيتسجل في console بس، ومبيأثرش على الحاسبة. القواعد بتسمح بزيادة 1 بس.
type UsageField = "grossToNet" | "netToGross" | "excelDownload";
function trackUsage(field: UsageField) {
  setDoc(doc(db, "tool_usage", "salary-calculator"), { [field]: increment(1) }, { merge: true }).catch((err) =>
    console.error("[SalaryCalculator] فشل تسجيل استخدام الحاسبة", err)
  );
}

// الاستخدام بيتحسب بعد ما المبلغ يثبت 1.5 ثانية ومعاه نتيجة صحيحة ظاهرة
const USAGE_DEBOUNCE_MS = 1500;

// حاسبة المرتب في /tools/salary-calculator: من الإجمالي للصافي أو العكس، والحساب بيتعمل مع الكتابة.
// المنطق كله في lib/salaryCalc.ts (نفس قواعد ملف Excel اللي في public/tools).
type Mode = "grossToNet" | "netToGross";

const MAX_AMOUNT = 10_000_000;
const money = new Intl.NumberFormat("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("ar-EG-u-nu-latn");

// النص اللي الزائر كتبه → نص رقمي: الأرقام العربية (٠-٩) والفارسية (۰-۹) لـ 0-9، والفاصلة العشرية "٫" لـ "."،
// وشيل فواصل الآلاف ("," و"٬") والمسافات. الخانة نفسها بتعرض المكتوب زي ما هو.
function normalizeNumberText(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/[,٬\s]/g, "");
}

export default function SalaryCalculator() {
  const [mode, setMode] = useState<Mode>("grossToNet");
  const [amountText, setAmountText] = useState("");
  const [knowsIns, setKnowsIns] = useState(false);
  const [insText, setInsText] = useState("");

  const amountNorm = normalizeNumberText(amountText);
  const amount = Number(amountNorm);
  const amountValid = amountNorm !== "" && Number.isFinite(amount) && amount >= 1 && amount <= MAX_AMOUNT;
  const insNorm = normalizeNumberText(insText);
  const insNumber = Number(insNorm);
  const override = knowsIns && insNorm !== "" && Number.isFinite(insNumber) && insNumber > 0 ? insNumber : undefined;
  const result = amountValid ? (mode === "grossToNet" ? grossToNet(amount, override) : netToGross(amount, override)) : null;
  const clamped = result && override !== undefined && override !== result.insWage ? (override < INS_MIN ? "min" : "max") : null;

  // مرة واحدة بس لكل تاب في نفس تحميل الصفحة: أي تغيير في المبلغ أو التاب قبل 1.5 ثانية بيلغي التايمر،
  // وبعد ما التاب يتحسب مبيتحسبش تاني حتى لو الزائر غيّر الرقم.
  const countedModes = useRef(new Set<Mode>());
  useEffect(() => {
    if (!amountValid || countedModes.current.has(mode)) return;
    const timer = setTimeout(() => {
      countedModes.current.add(mode);
      trackUsage(mode);
    }, USAGE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [mode, amountText, amountValid]);

  const rows: { label: string; value: number; main?: boolean }[] = result
    ? [
        { label: "إجمالي المرتب", value: result.gross, main: mode === "netToGross" },
        { label: "أجر الاشتراك التأميني", value: result.insWage },
        { label: "حصة العامل في التأمينات (11%)", value: result.employeeIns },
        { label: "صندوق أسر الشهداء", value: result.martyrsFund },
        { label: "الضريبة الشهرية", value: result.monthlyTax },
        { label: "صافي المرتب", value: result.net, main: mode === "grossToNet" },
      ]
    : [];

  return (
    <div style={boxStyle}>
      <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {(
          [
            ["grossToNet", "من الإجمالي للصافي"],
            ["netToGross", "من الصافي للإجمالي"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            style={mode === key ? activeTabStyle : tabStyle}
          >
            {label}
          </button>
        ))}
      </div>

      <label htmlFor="salary-amount" style={labelStyle}>
        {mode === "grossToNet" ? "إجمالي المرتب الشهري (جنيه)" : "صافي المرتب المطلوب شهريًا (جنيه)"}
      </label>
      <input
        id="salary-amount"
        type="text"
        inputMode="decimal"
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
        placeholder="مثال: 10000"
        style={inputStyle}
      />
      {amountText.trim() !== "" && !amountValid && (
        <p style={noteStyle}>اكتب مبلغًا من 1 إلى {whole.format(MAX_AMOUNT)} جنيه.</p>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={knowsIns} onChange={(e) => setKnowsIns(e.target.checked)} />
        أعرف أجر الاشتراك التأميني
      </label>
      {knowsIns && (
        <div style={{ marginTop: 8 }}>
          <label htmlFor="salary-ins" style={labelStyle}>أجر الاشتراك التأميني الشهري (جنيه)</label>
          <input
            id="salary-ins"
            type="text"
            inputMode="decimal"
            value={insText}
            onChange={(e) => setInsText(e.target.value)}
            placeholder="من كشف التأمينات أو قسيمة المرتب"
            style={inputStyle}
          />
        </div>
      )}

      {result && (
        <div style={{ marginTop: 18 }}>
          <dl style={{ margin: 0 }}>
            {rows.map((r) => (
              <div key={r.label} style={r.main ? mainRowStyle : rowStyle}>
                <dt style={{ fontSize: r.main ? 16 : 14, fontWeight: r.main ? 800 : 400 }}>{r.label}</dt>
                <dd data-testid={r.main ? "main-result" : undefined} style={{ margin: 0, fontSize: r.main ? 20 : 14, fontWeight: r.main ? 800 : 600 }}>
                  {money.format(r.value)} جنيه
                </dd>
              </div>
            ))}
          </dl>
          {result.estimatedIns && (
            <p style={noteStyle}>
              أجر الاشتراك هنا تقديري (الإجمالي ÷ 1.3 في حدود {whole.format(INS_MIN)} و{whole.format(INS_MAX)} جنيه)، والأدق
              كتابة الأجر المسجل في التأمينات.
            </p>
          )}
          {clamped && (
            <p style={noteStyle}>
              تم تطبيق {clamped === "min" ? `الحد الأدنى لأجر الاشتراك (${whole.format(INS_MIN)} جنيه)` : `الحد الأقصى لأجر الاشتراك (${whole.format(INS_MAX)} جنيه)`}{" "}
              بدل الأجر المكتوب.
            </p>
          )}
        </div>
      )}

      <a href="/tools/salary-calculator-2026.xlsx" download onClick={() => trackUsage("excelDownload")} style={downloadStyle}>
        تحميل الحاسبة كملف Excel
      </a>
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  border: "1px solid #14213D22",
  borderRadius: 10,
  padding: 18,
  background: "#fff",
  boxSizing: "border-box",
  width: "100%",
};
const tabStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #14213D",
  background: "transparent",
  color: "#14213D",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "inherit",
};
const activeTabStyle: React.CSSProperties = { ...tabStyle, background: "#14213D", color: "#fff" };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: 16,
  fontFamily: "inherit",
};
const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  flexWrap: "wrap",
  padding: "8px 0",
  borderBottom: "1px solid #14213D14",
};
const mainRowStyle: React.CSSProperties = { ...rowStyle, background: "#F8F6F0", padding: "10px 12px", borderRadius: 8, borderBottom: "none", margin: "4px 0" };
const noteStyle: React.CSSProperties = { fontSize: 12.5, color: "#4A5568", lineHeight: 1.8, margin: "8px 0 0" };
const downloadStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 18,
  padding: "10px 20px",
  border: "1px solid #14213D",
  borderRadius: 8,
  color: "#14213D",
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
  background: "#F8F6F0",
};
