"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  collection,
  documentId,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  adminActionErrorMessage,
  adminDeleteEmployer,
  adminSetEmployerBanned,
  adminSetEmployerJobsActive,
  adminSetEmployerPlan,
} from "@/lib/adminEmployers";
import { activePillStyle, pausedPillStyle, featuredPillStyle, toolBtnStyle, dangerToolBtnStyle } from "@/lib/jobCardStyles";

const PAGE_SIZE = 20;
// فلتر "محظور" و"عليه بلاغات" بيشتغلوا على مجموعة صغيرة بتتحمّل مرة واحدة وتتقسّم صفحات في
// الكلاينت (مفيش طريقة نفلتر employers بعدد البلاغات من Firestore من غير حقل مجمّع)، فبنحط
// سقف لحجم المجموعة دي عشان القراءات ماتزيدش.
const BANNED_SET_LIMIT = 200;
const REPORTS_SCAN_LIMIT = 500;
const IN_QUERY_CHUNK = 30;
const JOBS_PANEL_LIMIT = 50;
const PLAN_MONTH_OPTIONS = [1, 3, 6, 12];
// أعلى code point في نطاق Unicode الخاص — حد أعلى لاستعلام "يبدأ بـ" في Firestore.
const PREFIX_QUERY_END = String.fromCharCode(0xf8ff);

type Filter = "all" | "reported" | "banned";

type EmployerRow = {
  id: string;
  companyName: string;
  governorate: string;
  plan: "premium" | "free";
  planExpiresAtMillis: number | null;
  createdAtMillis: number | null;
  banned: boolean;
};

// null = لسه بيتحمّل (قبل ما الاستعلام يرجع) أو فشل؛ بنفرّق في العرض بين "…" و"—" بوجود المفتاح.
type EmployerCounts = { jobs: number | null; applicants: number | null; reports: number | null };

type PageData = { rows: EmployerRow[]; hasNext: boolean; lastDoc: QueryDocumentSnapshot<DocumentData> | null };

type LoadedState = {
  key: string;
  pages: PageData[];
  localRows: EmployerRow[];
  total: number | null;
  reportsCapped: boolean;
  error: boolean;
};

type JobItem = { id: string; title: string; isActive: boolean; expired: boolean; createdAtMillis: number | null };

function toRow(d: QueryDocumentSnapshot<DocumentData>): EmployerRow {
  const data = d.data();
  const planExpiresAt = data.planExpiresAt as Timestamp | undefined;
  const createdAt = data.createdAt as Timestamp | undefined;
  return {
    id: d.id,
    companyName: typeof data.companyName === "string" ? data.companyName : "",
    governorate: typeof data.governorate === "string" ? data.governorate : "",
    plan: data.plan === "premium" ? "premium" : "free",
    planExpiresAtMillis: planExpiresAt?.toMillis ? planExpiresAt.toMillis() : null,
    createdAtMillis: createdAt?.toMillis ? createdAt.toMillis() : null,
    banned: data.banned === true,
  };
}

function formatMillis(ms: number | null): string {
  return ms === null ? "—" : new Date(ms).toLocaleDateString("ar-EG");
}

async function countByEmployer(collectionName: string, employerId: string): Promise<number> {
  const snap = await getCountFromServer(query(collection(db, collectionName), where("employerId", "==", employerId)));
  return snap.data().count;
}

async function fetchCounts(employerId: string): Promise<EmployerCounts> {
  const [jobs, applicants, reports] = await Promise.allSettled([
    countByEmployer("job_posts", employerId),
    countByEmployer("applications", employerId),
    countByEmployer("job_reports", employerId),
  ]);
  const value = (r: PromiseSettledResult<number>) => (r.status === "fulfilled" ? r.value : null);
  return { jobs: value(jobs), applicants: value(applicants), reports: value(reports) };
}

// صفحات الوضع "الكل": cursor على آخر مستند معروض (مفيش offset، فمفيش قراءات زيادة)، وبنجيب
// مستند زيادة واحد (PAGE_SIZE + 1) بس عشان نعرف فيه صفحة تالية من غير صفحة فاضية في الآخر.
// البحث بأول الاسم (prefix) لأن Firestore مفيهوش بحث "يحتوي على" — بيستخدم نفس حقل
// companyName في الـorderBy فمفيش composite index جديد مطلوب.
async function fetchEmployersPage(search: string, cursor: QueryDocumentSnapshot<DocumentData> | null): Promise<PageData> {
  const constraints: QueryConstraint[] = search
    ? [where("companyName", ">=", search), where("companyName", "<=", search + PREFIX_QUERY_END), orderBy("companyName")]
    : [orderBy("createdAt", "desc")];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(PAGE_SIZE + 1));
  const snap = await getDocs(query(collection(db, "employers"), ...constraints));
  const shown = snap.docs.slice(0, PAGE_SIZE);
  return { rows: shown.map(toRow), hasNext: snap.docs.length > PAGE_SIZE, lastDoc: shown[shown.length - 1] ?? null };
}

async function loadInitial(filter: Filter, search: string, key: string): Promise<LoadedState> {
  if (filter === "all") {
    const [firstPage, total] = await Promise.all([
      fetchEmployersPage(search, null),
      search
        ? Promise.resolve<number | null>(null)
        : getCountFromServer(collection(db, "employers"))
            .then((s) => s.data().count as number | null)
            .catch(() => null),
    ]);
    return { key, pages: [firstPage], localRows: [], total, reportsCapped: false, error: false };
  }

  if (filter === "banned") {
    const snap = await getDocs(query(collection(db, "employers"), where("banned", "==", true), limit(BANNED_SET_LIMIT)));
    const rows = snap.docs.map(toRow).sort((a, b) => (b.createdAtMillis ?? 0) - (a.createdAtMillis ?? 0));
    return { key, pages: [], localRows: rows, total: null, reportsCapped: false, error: false };
  }

  // عليه بلاغات: أصحاب الأعمال اللي ظاهرين في آخر REPORTS_SCAN_LIMIT بلاغ (الأحدث الأول)،
  // مترتبين حسب أحدث بلاغ على كل واحد.
  const reportsSnap = await getDocs(query(collection(db, "job_reports"), orderBy("createdAt", "desc"), limit(REPORTS_SCAN_LIMIT)));
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  reportsSnap.docs.forEach((d) => {
    const employerId = d.data().employerId;
    if (typeof employerId === "string" && employerId && !seen.has(employerId)) {
      seen.add(employerId);
      orderedIds.push(employerId);
    }
  });
  const rows: EmployerRow[] = [];
  for (let i = 0; i < orderedIds.length; i += IN_QUERY_CHUNK) {
    const chunk = orderedIds.slice(i, i + IN_QUERY_CHUNK);
    const snap = await getDocs(query(collection(db, "employers"), where(documentId(), "in", chunk)));
    rows.push(...snap.docs.map(toRow));
  }
  rows.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
  return { key, pages: [], localRows: rows, total: null, reportsCapped: reportsSnap.size === REPORTS_SCAN_LIMIT, error: false };
}

export default function EmployersAdminTab() {
  const [filter, setFilter] = useState<Filter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  const [paging, setPaging] = useState(false);
  const [pagingError, setPagingError] = useState(false);
  const [counts, setCounts] = useState<Record<string, EmployerCounts>>({});
  const requestedCountsRef = useRef<Set<string>>(new Set());

  // في الفلاتر المحلية (محظور/عليه بلاغات) البحث بيتطبق على المجموعة المحمّلة في الكلاينت،
  // فمش بيدخل في المفتاح عشان تغيير البحث ما يعيدش الجلب.
  const serverSearch = filter === "all" ? appliedSearch : "";
  const queryKey = `${filter}|${serverSearch}|${refreshToken}`;
  const loading = !loaded || loaded.key !== queryKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: LoadedState;
      try {
        next = await loadInitial(filter, serverSearch, queryKey);
      } catch (err) {
        console.error("Admin employers load failed", err);
        next = { key: queryKey, pages: [], localRows: [], total: null, reportsCapped: false, error: true };
      }
      if (!cancelled) setLoaded(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, serverSearch, queryKey]);

  const searchTerm = appliedSearch.toLowerCase();
  let visibleRows: EmployerRow[] = [];
  let hasNext = false;
  let totalPages: number | null = null;
  if (loaded && !loading && !loaded.error) {
    if (filter === "all") {
      const page = loaded.pages[pageIndex];
      visibleRows = page?.rows ?? [];
      hasNext = !!page?.hasNext || !!loaded.pages[pageIndex + 1];
      totalPages = loaded.total !== null ? Math.max(1, Math.ceil(loaded.total / PAGE_SIZE)) : null;
    } else {
      const filtered = searchTerm ? loaded.localRows.filter((r) => r.companyName.toLowerCase().includes(searchTerm)) : loaded.localRows;
      visibleRows = filtered.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
      hasNext = (pageIndex + 1) * PAGE_SIZE < filtered.length;
      totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    }
  }

  // عدّادات الوظايف/المتقدمين/البلاغات لصفوف الصفحة الظاهرة بس (3 استعلامات عدّ لكل صف، من
  // غير قراءة مستندات)، ومتخزّنة — الرجوع لصفحة اتشافت قبل كده مبيعيدش أي قراءة.
  const visibleIdsKey = visibleRows.map((r) => r.id).join(",");
  useEffect(() => {
    const ids = visibleIdsKey ? visibleIdsKey.split(",") : [];
    ids
      .filter((id) => !requestedCountsRef.current.has(id))
      .forEach((id) => {
        requestedCountsRef.current.add(id);
        void fetchCounts(id).then((c) => setCounts((prev) => ({ ...prev, [id]: c })));
      });
  }, [visibleIdsKey]);

  function changeFilter(next: Filter) {
    if (next === filter) return;
    setFilter(next);
    setPageIndex(0);
  }

  function applySearch() {
    setAppliedSearch(searchInput.trim());
    setPageIndex(0);
  }

  function clearSearch() {
    setSearchInput("");
    setAppliedSearch("");
    setPageIndex(0);
  }

  function refresh() {
    requestedCountsRef.current = new Set();
    setCounts({});
    setRefreshToken((t) => t + 1);
    setPageIndex(0);
  }

  async function goNext() {
    if (!loaded || paging) return;
    if (filter !== "all") {
      setPageIndex((i) => i + 1);
      return;
    }
    const target = pageIndex + 1;
    if (loaded.pages[target]) {
      setPageIndex(target);
      return;
    }
    const current = loaded.pages[pageIndex];
    if (!current?.hasNext) return;
    setPaging(true);
    setPagingError(false);
    try {
      const nextPage = await fetchEmployersPage(appliedSearch, current.lastDoc);
      setLoaded((prev) => (prev && prev.key === loaded.key ? { ...prev, pages: [...prev.pages, nextPage] } : prev));
      setPageIndex(target);
    } catch (err) {
      console.error("Admin employers next page failed", err);
      setPagingError(true);
    } finally {
      setPaging(false);
    }
  }

  function patchRow(updated: EmployerRow) {
    setLoaded((prev) =>
      prev && {
        ...prev,
        pages: prev.pages.map((p) => ({ ...p, rows: p.rows.map((r) => (r.id === updated.id ? updated : r)) })),
        localRows: prev.localRows.map((r) => (r.id === updated.id ? updated : r)),
      }
    );
  }

  function removeRow(id: string) {
    setLoaded((prev) =>
      prev && {
        ...prev,
        pages: prev.pages.map((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== id) })),
        localRows: prev.localRows.filter((r) => r.id !== id),
        total: prev.total !== null ? Math.max(0, prev.total - 1) : null,
      }
    );
  }

  const filterButtons: { key: Filter; label: string }[] = [
    { key: "all", label: "الكل" },
    { key: "reported", label: "عليه بلاغات" },
    { key: "banned", label: "محظور" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applySearch();
          }}
          placeholder={filter === "all" ? "ابحث بأول اسم الشركة" : "ابحث باسم الشركة"}
          style={{ flex: "1 1 220px", padding: "9px 12px", border: "1px solid #14213D33", borderRadius: 8, fontSize: 14 }}
        />
        <button type="button" onClick={applySearch} style={toolBtnStyle}>بحث</button>
        {appliedSearch && (
          <button type="button" onClick={clearSearch} style={toolBtnStyle}>مسح البحث</button>
        )}
        <button type="button" onClick={refresh} style={toolBtnStyle}>🔄 تحديث</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {filterButtons.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => changeFilter(f.key)}
            style={{
              ...toolBtnStyle,
              background: filter === f.key ? "#14213D" : "#fff",
              color: filter === f.key ? "#fff" : "#14213D",
              fontWeight: 700,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === "reported" && loaded?.reportsCapped && !loading && (
        <div style={{ fontSize: 12.5, color: "#4A5568", marginBottom: 12 }}>
          بيعرض أصحاب الأعمال اللي ظاهرين في آخر {REPORTS_SCAN_LIMIT} بلاغ بس.
        </div>
      )}

      {loading && <p style={{ textAlign: "center", padding: 30 }}>جاري التحميل...</p>}

      {!loading && loaded?.error && (
        <div style={{ fontSize: 13.5, color: "#B03A14", background: "#FBEAE3", borderRadius: 8, padding: "10px 14px" }}>
          تعذّر تحميل القايمة — راجع الـconsole (غالبًا قواعد Firestore لسه مش متحدّثة).
        </div>
      )}

      {!loading && !loaded?.error && visibleRows.length === 0 && (
        <p style={{ textAlign: "center", padding: 30, color: "#4A5568" }}>مفيش نتائج.</p>
      )}

      {!loading && !loaded?.error && visibleRows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleRows.map((row) => (
            <EmployerCard key={row.id} row={row} counts={counts[row.id]} onRowChange={patchRow} onDeleted={removeRow} />
          ))}
        </div>
      )}

      {!loading && !loaded?.error && (pageIndex > 0 || hasNext) && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18 }}>
          <button type="button" disabled={pageIndex === 0 || paging} onClick={() => setPageIndex((i) => Math.max(0, i - 1))} style={toolBtnStyle}>
            → السابق
          </button>
          <span style={{ fontSize: 13.5, color: "#4A5568" }}>
            صفحة {pageIndex + 1}
            {totalPages !== null ? ` من ${totalPages}` : ""}
          </span>
          <button type="button" disabled={!hasNext || paging} onClick={goNext} style={toolBtnStyle}>
            {paging ? "جاري التحميل..." : "التالي ←"}
          </button>
        </div>
      )}
      {pagingError && (
        <p style={{ textAlign: "center", fontSize: 13, color: "#B03A14", marginTop: 8 }}>تعذّر تحميل الصفحة التالية، جرّب تاني.</p>
      )}
    </div>
  );
}

function CountBox({ label, value, danger }: { label: string; value: number | null | undefined; danger?: boolean }) {
  const text = value === undefined ? "…" : value === null ? "—" : String(value);
  return (
    <div
      style={{
        flex: "1 1 90px",
        textAlign: "center",
        background: danger && value ? "#FBEAE3" : "#F8F6F0",
        borderRadius: 8,
        padding: "8px 6px",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900, color: danger && value ? "#B03A14" : "#14213D" }}>{text}</div>
      <div style={{ fontSize: 11.5, color: "#4A5568" }}>{label}</div>
    </div>
  );
}

function EmployerCard({
  row,
  counts,
  onRowChange,
  onDeleted,
}: {
  row: EmployerRow;
  counts: EmployerCounts | undefined;
  onRowChange: (row: EmployerRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [months, setMonths] = useState(3);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [jobs, setJobs] = useState<JobItem[] | null>(null);
  const [jobsError, setJobsError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typedName, setTypedName] = useState("");

  const displayName = row.companyName.trim() || "(بدون اسم)";
  // نفس شرط الدالة على السيرفر (adminDeleteEmployer): اسم الشركة، أو الـuid لو الاسم فاضي.
  const expectedName = row.companyName.trim() || row.id;

  async function loadJobs() {
    setJobsError(false);
    try {
      const snap = await getDocs(
        query(collection(db, "job_posts"), where("employerId", "==", row.id), orderBy("createdAt", "desc"), limit(JOBS_PANEL_LIMIT))
      );
      const nowMs = Date.now();
      setJobs(
        snap.docs.map((d) => {
          const data = d.data();
          const expiresAt = data.expiresAt as Timestamp | undefined;
          const createdAt = data.createdAt as Timestamp | undefined;
          return {
            id: d.id,
            title: typeof data.title === "string" ? data.title : "وظيفة",
            isActive: data.isActive === true,
            expired: !!expiresAt?.toMillis && expiresAt.toMillis() <= nowMs,
            createdAtMillis: createdAt?.toMillis ? createdAt.toMillis() : null,
          };
        })
      );
    } catch (err) {
      console.error("Admin employer jobs load failed", err);
      setJobsError(true);
    }
  }

  async function toggleJobsPanel() {
    if (jobsOpen) {
      setJobsOpen(false);
      return;
    }
    setJobsOpen(true);
    if (jobs === null) await loadJobs();
  }

  async function runAction(name: string, action: () => Promise<string>) {
    setBusy(name);
    setMessage(null);
    try {
      const text = await action();
      setMessage({ ok: true, text });
      if (jobsOpen) await loadJobs();
      else setJobs(null);
    } catch (err) {
      console.error(`Admin employer action ${name} failed`, err);
      setMessage({ ok: false, text: adminActionErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  function toggleBan() {
    const next = !row.banned;
    const confirmed = window.confirm(
      next
        ? `تحظر "${displayName}"؟ هتتوقف كل وظايفه ويتعطّل حسابه ومش هيقدر ينشر أو يعدّل.`
        : `تفك الحظر عن "${displayName}"؟ هيتفعّل حسابه وترجع وظايفه اللي اتوقفت بسبب الحظر (غير المنتهية).`
    );
    if (!confirmed) return;
    void runAction("ban", async () => {
      const res = await adminSetEmployerBanned(row.id, next);
      onRowChange({ ...row, banned: next });
      return res.banned
        ? `✓ اتحظر الحساب وتوقفت ${res.jobsDeactivated} وظيفة`
        : `✓ اتفك الحظر ورجعت ${res.jobsReactivated} وظيفة${res.jobsSkippedExpired ? ` (${res.jobsSkippedExpired} منتهية فمرجعتش)` : ""}`;
    });
  }

  function setAllJobsActive(active: boolean) {
    const confirmed = window.confirm(active ? `تفعّل كل وظايف "${displayName}"؟ (المنتهية مش هتتفعّل)` : `توقف كل وظايف "${displayName}"؟`);
    if (!confirmed) return;
    void runAction(active ? "jobs-on" : "jobs-off", async () => {
      const res = await adminSetEmployerJobsActive(row.id, active);
      return active
        ? `✓ اتفعّلت ${res.changed} وظيفة${res.skippedExpired ? ` (${res.skippedExpired} منتهية فمتفعّلتش)` : ""}`
        : `✓ اتوقفت ${res.changed} وظيفة`;
    });
  }

  function upgradePlan() {
    const confirmed = window.confirm(
      `${row.plan === "premium" ? "تمدّد" : "ترقّي"} "${displayName}" للباقة المدفوعة ${months} شهر؟`
    );
    if (!confirmed) return;
    void runAction("plan-up", async () => {
      const res = await adminSetEmployerPlan(row.id, "premium", months);
      onRowChange({ ...row, plan: "premium", planExpiresAtMillis: res.planExpiresAtMillis });
      return `✓ الباقة المدفوعة سارية لحد ${formatMillis(res.planExpiresAtMillis)}`;
    });
  }

  function downgradePlan() {
    const confirmed = window.confirm(`تلغي الباقة المدفوعة لـ"${displayName}"؟ هترجع مجانية وهيتلغي تمييز وظايفه (غير اللي ميّزتها يدويًا).`);
    if (!confirmed) return;
    void runAction("plan-down", async () => {
      await adminSetEmployerPlan(row.id, "free");
      onRowChange({ ...row, plan: "free", planExpiresAtMillis: null });
      return "✓ رجعت الباقة مجانية";
    });
  }

  function deleteForever() {
    void runAction("delete", async () => {
      const res = await adminDeleteEmployer(row.id, typedName);
      onDeleted(row.id);
      return `✓ اتمسح نهائيًا (${res.counts.jobs ?? 0} وظيفة)`;
    });
  }

  const disabled = busy !== null;

  return (
    <div style={{ border: "1px solid #14213D22", borderRadius: 10, padding: 14, background: row.banned ? "#FBF3F0" : "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#14213D" }}>{displayName}</div>
          <div style={{ fontSize: 12.5, color: "#4A5568", marginTop: 4 }}>
            {row.governorate || "—"} • سجّل {formatMillis(row.createdAtMillis)}
          </div>
          <div style={{ fontSize: 11, color: "#4A5568", marginTop: 2, direction: "ltr", textAlign: "right" }}>{row.id}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {row.banned ? (
            <span style={{ fontSize: 12, fontWeight: 700, background: "rgba(176,58,20,0.12)", color: "#B03A14", padding: "3px 10px", borderRadius: 999 }}>
              محظور
            </span>
          ) : (
            <span style={activePillStyle}>نشط</span>
          )}
          {row.plan === "premium" ? (
            <span style={featuredPillStyle}>
              ⭐ مدفوعة{row.planExpiresAtMillis !== null ? ` حتى ${formatMillis(row.planExpiresAtMillis)}` : ""}
            </span>
          ) : (
            <span style={pausedPillStyle}>مجانية</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <CountBox label="الوظايف" value={counts?.jobs} />
        <CountBox label="المتقدمين" value={counts?.applicants} />
        <CountBox label="البلاغات" value={counts?.reports} danger />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" onClick={toggleJobsPanel} style={toolBtnStyle}>
          {jobsOpen ? "إخفاء وظايفه" : "📋 عرض وظايفه"}
        </button>
        <button type="button" disabled={disabled} onClick={() => setAllJobsActive(false)} style={toolBtnStyle}>
          {busy === "jobs-off" ? "جاري..." : "⏸ إيقاف كل وظايفه"}
        </button>
        <button type="button" disabled={disabled || row.banned} onClick={() => setAllJobsActive(true)} style={toolBtnStyle}>
          {busy === "jobs-on" ? "جاري..." : "▶ تفعيل كل وظايفه"}
        </button>
        <button type="button" disabled={disabled} onClick={toggleBan} style={row.banned ? toolBtnStyle : dangerToolBtnStyle}>
          {busy === "ban" ? "جاري..." : row.banned ? "✓ فك الحظر" : "🚫 حظر"}
        </button>
        <button type="button" disabled={disabled} onClick={() => setDeleteOpen((o) => !o)} style={dangerToolBtnStyle}>
          🗑 حذف نهائي
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          disabled={disabled}
          style={{ padding: "7px 8px", border: "1px solid #14213D33", borderRadius: 8, fontSize: 13 }}
        >
          {PLAN_MONTH_OPTIONS.map((m) => (
            <option key={m} value={m}>{m} شهر</option>
          ))}
        </select>
        <button type="button" disabled={disabled} onClick={upgradePlan} style={toolBtnStyle}>
          {busy === "plan-up" ? "جاري..." : row.plan === "premium" ? "⭐ تمديد الباقة" : "⭐ ترقية للمدفوعة"}
        </button>
        {row.plan === "premium" && (
          <button type="button" disabled={disabled} onClick={downgradePlan} style={dangerToolBtnStyle}>
            {busy === "plan-down" ? "جاري..." : "إلغاء الباقة"}
          </button>
        )}
      </div>

      {message && (
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            borderRadius: 8,
            padding: "8px 12px",
            color: message.ok ? "#2F6F4E" : "#B03A14",
            background: message.ok ? "rgba(47,111,78,0.1)" : "#FBEAE3",
          }}
        >
          {message.text}
        </div>
      )}

      {deleteOpen && (
        <div style={{ marginTop: 10, border: "1px solid #B03A1440", borderRadius: 8, padding: 12, background: "#FBF3F0" }}>
          <div style={{ fontSize: 13, color: "#B03A14", lineHeight: 1.8, marginBottom: 8 }}>
            حذف نهائي ومش بيترجّع: الحساب كله ووظايفه وتقديماتها ودعواته وبلاغاته. اكتب اسم الشركة بالظبط للتأكيد:{" "}
            <strong>{expectedName}</strong>
          </div>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            disabled={disabled}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #B03A1440", borderRadius: 8, fontSize: 14 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              disabled={disabled || typedName.trim() !== expectedName}
              onClick={deleteForever}
              style={{
                ...dangerToolBtnStyle,
                background: "#B03A14",
                color: "#fff",
                opacity: disabled || typedName.trim() !== expectedName ? 0.5 : 1,
              }}
            >
              {busy === "delete" ? "جاري الحذف..." : "احذف نهائيًا"}
            </button>
            <button type="button" disabled={disabled} onClick={() => { setDeleteOpen(false); setTypedName(""); }} style={toolBtnStyle}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {jobsOpen && (
        <div style={{ marginTop: 10, borderTop: "1px solid #14213D1A", paddingTop: 10 }}>
          {jobsError && <div style={{ fontSize: 13, color: "#B03A14" }}>تعذّر تحميل الوظايف.</div>}
          {!jobsError && jobs === null && <div style={{ fontSize: 13, color: "#4A5568" }}>جاري التحميل...</div>}
          {!jobsError && jobs !== null && jobs.length === 0 && <div style={{ fontSize: 13, color: "#4A5568" }}>مفيش وظايف.</div>}
          {!jobsError && jobs !== null && jobs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {jobs.map((j) => (
                <div key={j.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13.5 }}>
                  <Link href={`/jobs/${j.id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#14213D", fontWeight: 600, textDecoration: "none" }}>
                    {j.title}
                  </Link>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#4A5568" }}>{formatMillis(j.createdAtMillis)}</span>
                    <span style={j.isActive ? activePillStyle : pausedPillStyle}>
                      {j.isActive ? "نشطة" : j.expired ? "منتهية" : "موقوفة"}
                    </span>
                  </span>
                </div>
              ))}
              {jobs.length === JOBS_PANEL_LIMIT && (
                <div style={{ fontSize: 12, color: "#4A5568" }}>بيعرض آخر {JOBS_PANEL_LIMIT} وظيفة بس.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
