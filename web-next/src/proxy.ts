import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GOVERNORATES, SPECIALIZATION_OPTIONS, slugify } from "@/lib/constants";

// مفاتيح تتبع (حملات وإعلانات وإحالات) — نفس القايمة اللي في app/jobs/page.tsx. مبتتنقلش للرابط النضيف.
const IGNORED_TRACKING_PARAM_PREFIX = "utm_";
const IGNORED_TRACKING_PARAMS = new Set(["fbclid", "gclid", "ref"]);

function isTrackingParam(key: string): boolean {
  return key.startsWith(IGNORED_TRACKING_PARAM_PREFIX) || IGNORED_TRACKING_PARAMS.has(key);
}

// ?governorate و/أو ?specialization لوحدهم (بقيم صحيحة) = نفس صفحة المحافظة/التخصص/التوليفة الثابتة، فبنحوّل لها
// تحويل دائم (308) بدل نسخة noindex من /jobs — نفس slugify اللي في BrowseBySpecialization. أي param قيمته فاضية بعد
// trim بيتشال الأول (فورم الرئيسية بيبعت q= وjobType= فاضيين). أي مفتاح تاني (q، city، jobType، مجهول)، أو قيمة مش
// في القايمة، أو مفتاح متكرر: null والصفحة تفضل زي ما هي (noindex + canonical لـ/jobs في generateMetadata).
function cleanListingPath(searchParams: URLSearchParams): string | null {
  const params = new Map<string, string[]>();
  for (const [key, value] of searchParams) {
    if (isTrackingParam(key) || !value.trim()) continue;
    params.set(key, [...(params.get(key) || []), value]);
  }
  if (params.size === 0 || [...params.keys()].some((key) => key !== "governorate" && key !== "specialization")) return null;
  const governorateValues = params.get("governorate");
  const specializationValues = params.get("specialization");
  if ((governorateValues && governorateValues.length > 1) || (specializationValues && specializationValues.length > 1)) return null;
  const governorate = governorateValues?.[0];
  const specialization = specializationValues?.[0];
  if (governorate !== undefined && !GOVERNORATES.includes(governorate)) return null;
  if (specialization !== undefined && !SPECIALIZATION_OPTIONS.includes(specialization)) return null;
  if (governorate && specialization) return `/jobs/${slugify(governorate)}/${slugify(specialization)}`;
  if (governorate) return `/jobs/${slugify(governorate)}`;
  if (specialization) return `/jobs/specialization/${slugify(specialization)}`;
  return null;
}

// بيشتغل على /jobs بس (مش /jobs/...) — قبل الرندر، فالتحويل بيطلع 308 حقيقي (من جوه الصفحة كان بيطلع meta refresh
// بـ200 بسبب Suspense بتاع app/loading.tsx). مفيش أي اتصال بقاعدة البيانات هنا.
export function proxy(request: NextRequest) {
  const cleanPath = cleanListingPath(request.nextUrl.searchParams);
  if (!cleanPath) return NextResponse.next();
  return NextResponse.redirect(new URL(cleanPath, request.url), 308);
}

export const config = {
  matcher: "/jobs",
};
