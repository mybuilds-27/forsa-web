"use client";

import { useState } from "react";
import Link from "next/link";
import { isPublicCompanyJob, type PublicJobFields } from "@/lib/companyVisibility";

// قسم "حالة الظهور" جوه كارت بيانات الشركة في CompanyTab — كله محسوب من companyData والوظائف
// المحمّلة بالفعل في CompanyTab، من غير أي قراءة Firestore إضافية.
const COMPANY_SIZE_LABELS: Record<string, string> = {
  under20: "أقل من 20 موظفًا",
  "20to100": "من 20 إلى 100 موظف",
  "100to500": "من 100 إلى 500 موظف",
  "500to1000": "من 500 إلى 1000 موظف",
  over1000: "أكثر من 1000 موظف",
};

type CompanyVisibilityData = {
  createdAt?: { toDate(): Date } | null;
  companySize?: string;
  showCompanyNameDefault?: boolean;
  banned?: boolean;
};

function formatDate(ts: CompanyVisibilityData["createdAt"]): string {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleDateString("ar-EG");
}

type Props = {
  employerId: string | null;
  companyData: CompanyVisibilityData | null;
  posts: PublicJobFields[];
  loading: boolean;
  loadError: boolean;
};

export default function CompanyVisibilitySection({ employerId, companyData, posts, loading, loadError }: Props) {
  // لحظة أول عرض — كفاية لمقارنة expiresAt (بالأيام)، ومن غير Date.now() جوه الـrender
  const [now] = useState(() => Date.now());
  const activeJobs = posts.filter((p) => p.isActive === true && (!p.expiresAt || p.expiresAt.toMillis() > now));
  const publicJobs = activeJobs.filter((p) => isPublicCompanyJob(p, now));
  const jobsUnknown = loading || loadError;
  const unknownText = loading ? "جارٍ التحقق..." : "تعذّر التحقق";

  let nameInActiveJobs: string;
  if (jobsUnknown) nameInActiveJobs = unknownText;
  else if (activeJobs.length === 0) nameInActiveJobs = "لا توجد وظائف نشطة";
  else if (publicJobs.length === activeJobs.length) nameInActiveJobs = "ظاهر في جميع الوظائف النشطة";
  else if (publicJobs.length === 0) nameInActiveJobs = "مخفي في جميع الوظائف النشطة";
  else nameInActiveJobs = `ظاهر في ${publicJobs.length} من ${activeJobs.length} وظيفة نشطة`;

  let publicPage: React.ReactNode;
  if (jobsUnknown) {
    publicPage = unknownText;
  } else if (publicJobs.length > 0) {
    publicPage = (
      <>
        <span style={{ color: "#2F6F4E" }}>متاحة</span>
        {employerId && (
          <>
            {" · "}
            <Link href={`/companies/${employerId}`} style={{ color: "#14213D", fontWeight: 400, fontSize: 13 }}>
              عرض الصفحة
            </Link>
          </>
        )}
      </>
    );
  } else {
    publicPage = (
      <>
        <span style={{ color: "#8A570D" }}>غير متاحة</span>
        <span style={{ display: "block", fontWeight: 400, fontSize: 12.5, color: "#4A5568", marginTop: 2 }}>
          {activeJobs.length === 0 ? "لا توجد وظيفة نشطة" : "اسم الشركة مخفي في جميع الوظائف النشطة"}
        </span>
      </>
    );
  }

  const createdAt = formatDate(companyData?.createdAt);
  const companySize = COMPANY_SIZE_LABELS[companyData?.companySize || ""] || "";

  return (
    <div style={{ borderTop: "1px solid #14213D14", marginTop: 14, paddingTop: 14 }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: "#4A5568", margin: "0 0 10px" }}>حالة الظهور</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", columnGap: 24 }}>
        {companyData?.banned === true && (
          <Item label="حالة الحساب" value={<span style={{ color: "#B03A14" }}>موقوف من الإدارة</span>} />
        )}
        <Item label="الصفحة العامة للشركة" value={publicPage} />
        <Item label="اسم الشركة في الوظائف النشطة" value={nameInActiveJobs} />
        <Item
          label="اسم الشركة في الوظائف الجديدة"
          value={companyData?.showCompanyNameDefault !== false ? "يظهر افتراضيًا" : "مخفي افتراضيًا"}
        />
        <Item label="الوظائف النشطة" value={jobsUnknown ? unknownText : activeJobs.length} />
        {createdAt && <Item label="تاريخ إنشاء الشركة" value={createdAt} />}
        {companySize && <Item label="حجم الشركة" value={companySize} />}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "8px 0", borderBottom: "1px solid #14213D0F", minWidth: 0 }}>
      <div style={{ fontSize: 13, color: "#4A5568" }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#14213D", textAlign: "left" }}>{value}</div>
    </div>
  );
}
