"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ReporterInfoData = {
  kind: "seeker" | "employer" | "unknown";
  name: string;
  phone: string;
  email: string;
};

async function readDoc(...path: [string, ...string[]]): Promise<DocumentData | null> {
  try {
    const snap = await getDoc(doc(db, ...path));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error(`[ReporterInfo] فشل قراءة ${path.join("/")}`, err);
    return null;
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// حسابات التسجيل بالتليفون بتستخدم إيميل داخلي وهمي (phone+...@elshoghl.internal) للربط
// بمصادقة فايربيز بس — مش إيميل حقيقي (نفس منطق realEmail في lib/adminExports.ts).
function realEmail(v: unknown): string {
  const email = str(v);
  return email.includes("@elshoghl.internal") ? "" : email;
}

// users/{uid} أولًا (فيه userType والإيميل/التليفون الأساسيين لأي نوع حساب)، وبعدين مستند
// النوع الفعلي: job_seekers للباحث، أو employers (+ private/contact لاسم المسؤول وتليفونه)
// لصاحب العمل. لو users مش موجود بنجرب job_seekers ثم employers. فشل أي قراءة (زي قاعدة
// Firestore مش مسموحة) بيرجّع null لمستندها بس، والباقي بيتعرض عادي.
async function loadReporter(uid: string): Promise<ReporterInfoData> {
  const user = await readDoc("users", uid);

  const isEmployerUser = user?.userType === "employer";
  const seeker = isEmployerUser ? null : await readDoc("job_seekers", uid);
  let employer: DocumentData | null = null;
  let contact: DocumentData | null = null;
  if (isEmployerUser || (!seeker && !user)) {
    [employer, contact] = await Promise.all([readDoc("employers", uid), readDoc("employers", uid, "private", "contact")]);
  }

  if (employer) {
    const contactPerson = str(contact?.contactPerson);
    const companyName = str(employer.companyName);
    return {
      kind: "employer",
      name: [contactPerson, companyName && `(${companyName})`].filter(Boolean).join(" ") || str(user?.displayName),
      phone: str(contact?.phone) || str(user?.phoneNumber),
      email: realEmail(user?.email),
    };
  }

  if (seeker || user) {
    return {
      kind: seeker ? "seeker" : "unknown",
      name: str(seeker?.fullName) || str(user?.displayName),
      phone: str(seeker?.phone) || str(user?.phoneNumber),
      email: realEmail(seeker?.email) || realEmail(user?.email),
    };
  }

  return { kind: "unknown", name: "", phone: "", email: "" };
}

// نفس المبلّغ ممكن يبلّغ أكتر من مرة (أو أكتر من بلاغ في القايمة)، فبنخزّن الوعد لكل uid عشان
// القراءات تحصل مرة واحدة بس طول جلسة لوحة الأدمن.
const reporterCache = new Map<string, Promise<ReporterInfoData>>();

function getReporter(uid: string): Promise<ReporterInfoData> {
  let promise = reporterCache.get(uid);
  if (!promise) {
    promise = loadReporter(uid);
    reporterCache.set(uid, promise);
    promise.catch(() => reporterCache.delete(uid));
  }
  return promise;
}

const KIND_LABELS: Record<ReporterInfoData["kind"], string> = {
  seeker: "باحث عن عمل",
  employer: "صاحب عمل",
  unknown: "مستخدم مسجّل",
};

type LoadState = { uid: string; info: ReporterInfoData | null; error: boolean };

export default function ReporterInfo({ reporterId }: { reporterId?: string | null }) {
  const [state, setState] = useState<LoadState | null>(null);

  useEffect(() => {
    if (!reporterId) return;
    let cancelled = false;
    getReporter(reporterId)
      .then((info) => {
        if (!cancelled) setState({ uid: reporterId, info, error: false });
      })
      .catch((err) => {
        console.error("[ReporterInfo] فشل تحميل بيانات المبلّغ", err);
        if (!cancelled) setState({ uid: reporterId, info: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [reporterId]);

  const boxStyle = { fontSize: 12.5, color: "#4A5568", marginTop: 6, background: "#F8F6F0", borderRadius: 6, padding: "6px 10px" } as const;

  if (!reporterId) {
    return <div style={boxStyle}>👤 المبلّغ: زائر غير مسجّل</div>;
  }

  if (state?.uid !== reporterId) {
    return <div style={boxStyle}>👤 جاري تحميل بيانات المبلّغ...</div>;
  }

  if (state.error || !state.info) {
    return <div style={{ ...boxStyle, color: "#B03A14" }}>👤 تعذّر تحميل بيانات المبلّغ</div>;
  }

  const { kind, name, phone, email } = state.info;
  if (!name && !phone && !email) {
    return <div style={boxStyle}>👤 المبلّغ: حساب غير موجود أو محذوف</div>;
  }

  return (
    <div style={boxStyle}>
      👤 المبلّغ ({KIND_LABELS[kind]}): <strong>{name || "—"}</strong>
      {" • "}📞 <span dir="ltr">{phone || "—"}</span>
      {" • "}✉️ <span dir="ltr">{email || "—"}</span>
    </div>
  );
}
