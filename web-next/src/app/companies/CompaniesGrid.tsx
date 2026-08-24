"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCompanyLogos, type CompanyCard } from "@/lib/companiesQuery";

const COMPANIES_PAGE_SIZE = 24;

export default function CompaniesGrid({ companies }: { companies: CompanyCard[] }) {
  const [visibleCount, setVisibleCount] = useState(Math.min(COMPANIES_PAGE_SIZE, companies.length));
  const [logos, setLogos] = useState<Record<string, string | null>>({});
  const [loadingMore, setLoadingMore] = useState(false);

  // أول دفعة بس هنا — كل دفعة بعد كده بتتحمّل من loadMore، عشان قراءات اللوجو (getDoc لكل
  // شركة) تقتصر على الشركات المعروضة فعليًا بدل كل الشركات دفعة واحدة.
  useEffect(() => {
    const firstBatchIds = companies.slice(0, COMPANIES_PAGE_SIZE).map((c) => c.employerId);
    if (firstBatchIds.length === 0) return;
    getCompanyLogos(firstBatchIds).then((result) => setLogos((prev) => ({ ...prev, ...result })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextCount = Math.min(visibleCount + COMPANIES_PAGE_SIZE, companies.length);
    const newIds = companies.slice(visibleCount, nextCount).map((c) => c.employerId);
    const newLogos = await getCompanyLogos(newIds);
    setLogos((prev) => ({ ...prev, ...newLogos }));
    setVisibleCount(nextCount);
    setLoadingMore(false);
  }

  const visibleCompanies = companies.slice(0, visibleCount);
  const hasMore = visibleCount < companies.length;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {visibleCompanies.map((c) => {
          const logoURL = logos[c.employerId];
          return (
            <Link
              key={c.employerId}
              href={`/companies/${c.employerId}`}
              style={{
                display: "block",
                border: "1px solid #14213D22",
                borderRadius: 10,
                padding: 16,
                textDecoration: "none",
                color: "inherit",
                textAlign: "center",
              }}
            >
              {logoURL ? (
                <img
                  src={logoURL}
                  alt={c.companyName}
                  style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10, margin: "0 auto 10px" }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 10,
                    background: "#F0EDE3",
                    margin: "0 auto 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  🏢
                </div>
              )}
              <h4 style={{ margin: "0 0 6px", fontSize: 15 }}>{c.companyName}</h4>
              <div style={{ fontSize: 12.5, color: "#4A5568" }}>{c.count} وظيفة مفتوحة</div>
            </Link>
          );
        })}
      </div>

      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              padding: "10px 24px",
              border: "1px solid #14213D",
              background: "transparent",
              borderRadius: 6,
              color: "#14213D",
              fontSize: 14,
              fontWeight: 700,
              cursor: loadingMore ? "wait" : "pointer",
              opacity: loadingMore ? 0.7 : 1,
              fontFamily: "inherit",
            }}
          >
            {loadingMore ? "جاري التحميل..." : "تحميل المزيد"}
          </button>
        </div>
      )}
    </>
  );
}
