"use client";

import { doc, increment, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// لينك تحميل ملف (زي Excel في public/tools) بعداد موحّد: file_downloads/{fileId} فيه حقل count بس.
// fileId = اسم الملف من الـhref من غير المسار والامتداد، بحروف صغيرة (مثلًا leave-balance-calculator).
// أي ملف جديد بيتعد تلقائيًا من غير قواعد جديدة. fire-and-forget: الفشل بيتسجل في console بس،
// والتحميل نفسه بيكمل عادي. مفيش أي بيانات عن الزائر.
const FILE_ID_RE = /^[a-z0-9-]{1,80}$/;

export function fileIdFromHref(href: string): string {
  const name = href.split(/[?#]/)[0].split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  return (dot > 0 ? name.slice(0, dot) : name).toLowerCase();
}

function trackDownload(href: string) {
  const fileId = fileIdFromHref(href);
  if (!FILE_ID_RE.test(fileId)) return;
  setDoc(doc(db, "file_downloads", fileId), { count: increment(1) }, { merge: true }).catch((err) =>
    console.error("[TrackedDownloadLink] فشل تسجيل تحميل الملف", err)
  );
}

export default function TrackedDownloadLink({
  href,
  children,
  style,
}: {
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <a href={href} download style={style} onClick={() => trackDownload(href)}>
      {children}
    </a>
  );
}
