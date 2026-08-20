"use client";

import { useState } from "react";
import PublicJobsList from "@/components/PublicJobsList";

const PAGE_SIZE = 10;

type Props = {
  jobs: any[];
};

// كل الوظائف المطابقة (لحد 50) بتوصل من السيرفر مرة واحدة بالفعل (getFilteredPublicJobs)،
// فالتحميل التدريجي هنا بس بيكشف المزيد من نفس الأراي اللي وصلت — من غير أي استعلام إضافي
// على Firestore لكل ضغطة "تحميل المزيد".
export default function PaginatedJobsList({ jobs }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleJobs = jobs.slice(0, visibleCount);
  const hasMore = visibleCount < jobs.length;

  return (
    <>
      <PublicJobsList jobs={visibleJobs} />

      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "1.5px solid #14213D",
              background: "transparent",
              color: "#14213D",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            تحميل المزيد
          </button>
        </div>
      )}
    </>
  );
}
