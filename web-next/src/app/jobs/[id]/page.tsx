import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { notFound } from "next/navigation";
import { db } from "@/lib/firebase";
import ApplyButton from "./ApplyButton";
import ShareButton from "@/components/ShareButton";
import ReportJobButton from "./ReportJobButton";
import JobViewTracker from "@/components/JobViewTracker";
import RelatedJobs from "./RelatedJobs";
import WhatsAppContactLink from "@/components/WhatsAppContactLink";
import { EXPERIENCE_LEVELS, findGovernorateBySlug, getAreasForGovernorate, slugify } from "@/lib/constants";
import { toWhatsAppNumber } from "@/lib/phoneAuth";
import { featuredPillStyle, JOB_TYPE_LABELS, salaryText, sanitizeJobDescription, tagStyle } from "@/lib/jobCardStyles";
import { getActivePublicJobs, getActiveJobsSeoData } from "@/lib/publicJobsQuery";
import BrowseSidebar from "@/components/BrowseSidebar";
import PublicJobsList from "@/components/PublicJobsList";

// نفس مشكلة الـstatic prerender اللي لقيناها في companies/page.tsx وjobs/page.tsx —
// من غيرها، صفحة المحافظة لوحدها (فرع findGovernorateBySlug تحت) ممكن تفضل بالبيانات
// القديمة لحد أول deploy جديد. force-dynamic بيضمن قراءة فريش من Firestore في كل طلب.
export const dynamic = "force-dynamic";

const POPULAR_COMBOS_COUNT = 40;

async function getJob(id: string): Promise<any> {
  try {
    const snap = await getDoc(doc(db, "job_posts", id));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.isActive !== true) return null;
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) return null;
    return { id: snap.id, ...data };
  } catch {
    // قواعد Firestore بترجع permission-denied مش "غير موجود" لما الدوكيومنت مش موجود أصلاً،
    // فأي id غلط (زي محاولة زيارة /jobs/{slug} بمحافظة مش موجودة) لازم يتعامل معاه كـ"مش موجود".
    return null;
  }
}

// [id] بيمثل إما رقم وظيفة أو slug محافظة (زي القاهرة) — Next.js مش بيسمح بـ [id] و[governorate]
// كـsegment names مختلفة في نفس المكان من شجرة الروابط، فدمجنا الحالتين هنا.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const governorate = findGovernorateBySlug(decodeURIComponent(id));
  if (governorate) {
    const jobs = await getActivePublicJobs({ governorate });
    const title = `وظايف شغل في ${governorate} | الشغل`;
    const description =
      jobs.length > 0
        ? `${jobs.length} وظيفة شغل متاحة حاليًا في ${governorate} على موقع الشغل — تصفح وقدّم دلوقتي.`
        : `دوّر على وظايف شغل في ${governorate} على موقع الشغل.`;
    return {
      title,
      description,
      ...(jobs.length === 0 ? { robots: { index: false, follow: true } } : {}),
    };
  }

  const job = await getJob(id);
  if (!job) {
    return { title: "وظيفة غير متاحة - الشغل" };
  }
  const title = `${job.title} - وظيفة على موقع الشغل`;
  const description = `${job.title} في ${job.city} - ${job.governorate}. ${sanitizeJobDescription(job.description || "").slice(0, 120)}`;
  const companyName = job.showCompanyName && job.companyName ? job.companyName : "شركة غير معلنة";
  const ogTitle = `${job.title} - ${companyName}`;
  const url = `https://www.elshoghl.com/jobs/${job.id}`;
  // OG_IMAGE هنا مبدئي (نفس لوجو الموقع العام) — المرحلة الجاية: صورة مولّدة لكل وظيفة
  // بعنوانها واسم الشركة عن طريق Next.js ImageResponse بدل الصورة الثابتة دي.
  const ogImage = { url: "/og-image.png", width: 1200, height: 630, alt: title };

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description,
      url,
      siteName: "الشغل",
      images: [ogImage],
      locale: "ar_EG",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [ogImage.url],
    },
  };
}

const EMPLOYMENT_TYPE_SCHEMA: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  freelance: "CONTRACTOR",
};

// بيانات JobPosting المنظمة (schema.org) عشان الوظيفة تبقى مؤهلة للظهور في Google for Jobs.
// datePosted وvalidThrough بياخدوا نفس createdAt/expiresAt المخزنين فعليًا وقت النشر، فمفيش
// حساب مضاعف هنا. لو مفيش createdAt (سجل قديم جدًا ماكانش بيتسجل فيه التاريخ) بنرجع null
// ومنعرضش الـscript خالص بدل ما نبعت بيانات ناقصة لجوجل.
function buildJobPostingJsonLd(job: any) {
  if (!job.createdAt?.toDate) return null;

  const hasSalary = job.showSalary !== false && !job.salaryNegotiable && (job.salaryFrom || job.salaryTo);
  const employmentType = EMPLOYMENT_TYPE_SCHEMA[job.jobType];

  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: sanitizeJobDescription(job.description || "") || job.title,
    identifier: { "@type": "PropertyValue", name: "الشغل", value: job.id },
    datePosted: job.createdAt.toDate().toISOString(),
    ...(job.expiresAt?.toDate ? { validThrough: job.expiresAt.toDate().toISOString() } : {}),
    ...(employmentType ? { employmentType } : {}),
    hiringOrganization: {
      "@type": "Organization",
      name: job.showCompanyName && job.companyName ? job.companyName : "شركة غير معلنة",
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city,
        addressRegion: job.governorate,
        addressCountry: "EG",
      },
    },
    ...(job.jobType === "remote"
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "Country", name: "Egypt" },
        }
      : {}),
    ...(hasSalary
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "EGP",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salaryFrom || job.salaryTo,
              maxValue: job.salaryTo || job.salaryFrom,
              unitText: "MONTH",
            },
          },
        }
      : {}),
  };
}

// وصف الوظيفة ممكن يتكتب بالعربي أو الإنجليزي بالكامل — التوسيط الافتراضي بيبقى صعب القراءة
// في الحالتين، فبنحدد اتجاه المحاذاة حسب وجود حروف عربية فعليًا في النص بدل ما نفترض لغة ثابتة.
function isArabicText(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

// أصحاب العمل كتير بيكتبوا وصف الوظيفة كنقط مفصولة بـ"•" يدوي جوه نص واحد متصل. لو النقطة
// دي موجودة فعلًا، بنقسم النص لعناصر قايمة حقيقية (list-style من CSS بدل الرمز اليدوي) —
// ده بيحل مشكلة اتجاه الرمز (bidi) تلقائيًا لأن نقطة الـCSS مالهاش اتجاه نصي يتأثر بيه،
// عكس "•" لما يتكتب كحرف عادي جوه نص وارث dir="rtl". لو مفيش "•" في النص، الوصف بيتعرض
// كفقرة عادية زي ما كان. أي نص قبل أول "•" (مقدمة عادية قبل ما البولت الأول يبدأ) بيتجاهل
// تمامًا (.slice(1)) ومبيتحسبش كنقطة أولى وهمية.
function splitBulletItems(description: string): string[] | null {
  if (!description.includes("•")) return null;
  const items = description
    .split("•")
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const governorate = findGovernorateBySlug(decodeURIComponent(id));
  if (governorate) {
    const [jobs, seoData] = await Promise.all([
      getActivePublicJobs({ governorate }),
      getActiveJobsSeoData(),
    ]);
    const popularCombos = seoData.combos.slice(0, POPULAR_COMBOS_COUNT);
    const specialtiesForGovernorate = seoData.combos
      .filter((c) => c.governorate === governorate)
      .sort((a, b) => b.count - a.count);
    // مفيش عدد وظائف لكل منطقة هنا (مكانش هيستاهل استعلام إضافي لكل منطقة) — بس أسماء
    // المناطق المعرّفة لنفس المحافظة دي (SEO_AREAS)، وبيرجع array فاضية للمحافظات اللي
    // معندهاش مناطق معرّفة لسه، فالقسم بيختفي تلقائيًا.
    const areasForGovernorate = getAreasForGovernorate(governorate);
    return (
      <div dir="rtl" style={{ width: "100%", maxWidth: 1120, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>وظائف في {governorate}</h1>
        <p style={{ color: "#4A5568", marginBottom: 24 }}>
          {jobs.length > 0 ? `${jobs.length} وظيفة متاحة حاليًا في ${governorate}` : `مفيش وظائف نشطة في ${governorate} دلوقتي`}
        </p>

        <div className="browse-layout">
          <div className="browse-main">
            {jobs.length === 0 && (
              <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>
                مفيش وظائف متاحة في {governorate} دلوقتي — <Link href="/jobs" style={{ color: "#14213D" }}>تصفح كل الوظائف</Link>
              </div>
            )}

            <PublicJobsList jobs={jobs} />

            {specialtiesForGovernorate.length > 0 && (
              <div style={{ marginTop: 30, paddingTop: 20, borderTop: "1px solid #DED2B5" }}>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>وظائف {governorate} حسب التخصص</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {specialtiesForGovernorate.map((c) => (
                    <Link
                      key={c.specialization}
                      href={`/jobs/${slugify(c.governorate)}/${slugify(c.specialization)}`}
                      style={{
                        fontSize: 13,
                        background: "#F0EDE3",
                        padding: "6px 14px",
                        borderRadius: 999,
                        color: "#14213D",
                        textDecoration: "none",
                      }}
                    >
                      {c.specialization} ({c.count})
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {areasForGovernorate.length > 0 && (
              <div style={{ marginTop: 30, paddingTop: 20, borderTop: "1px solid #DED2B5" }}>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>وظائف {governorate} حسب المنطقة</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {areasForGovernorate.map((city) => (
                    <Link
                      key={city}
                      href={`/jobs/${slugify(governorate)}/area/${slugify(city)}`}
                      style={{
                        fontSize: 13,
                        background: "#F0EDE3",
                        padding: "6px 14px",
                        borderRadius: 999,
                        color: "#14213D",
                        textDecoration: "none",
                      }}
                    >
                      {city}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <BrowseSidebar combos={popularCombos} />
        </div>
      </div>
    );
  }

  const job = await getJob(id);

  if (!job) {
    notFound();
  }

  const seoData = await getActiveJobsSeoData();
  const popularCombos = seoData.combos.slice(0, POPULAR_COMBOS_COUNT);
  const jobPostingJsonLd = buildJobPostingJsonLd(job);
  // تنضيف رموز Markdown اللي بعض أصحاب العمل بيسيبوها زي ما هي لما بيلصقوا وصف من
  // ChatGPT (##, **نص**, سطور بـ*/-) — النص الأصلي في Firestore زي ما هو، ده بس للعرض.
  const description = sanitizeJobDescription(job.description || "");

  // لينك واتساب محتاج الرقم بصيغة دولية (20xxxxxxxxxx) — contactValue في Firestore زي ما
  // هو (ممكن يكون محلي 01xxxxxxxxx من غير كود الدولة)، ده بس تصحيح للعرض وقت بناء اللينك.
  // fallback آمن للسلوك القديم (تنضيف الرموز بس) لو الرقم مش بصيغة مصرية معروفة، مع تحذير
  // في لوج السيرفر عشان نلاحظ أرقام غريبة بدل ما اللينك يفضل يكسر بصمت.
  let whatsappNumber: string | null = null;
  if (job.receiveMethod === "contact" && job.contactMethod === "whatsapp" && job.contactValue) {
    whatsappNumber = toWhatsAppNumber(job.contactValue);
    if (!whatsappNumber) {
      console.warn(`[jobs/${job.id}] contactValue مش بصيغة رقم مصري معروف: "${job.contactValue}"`);
      whatsappNumber = job.contactValue.replace(/\D/g, "");
    }
  }
  const descriptionIsArabic = isArabicText(description);
  const descriptionBulletItems = splitBulletItems(description);

  // نفس مشكلة الوصف بالظبط موجودة في "الشروط" و"مزايا إضافية" (نفس النسخ واللصق من
  // ChatGPT)، فبتتنضف بنفس sanitizeJobDescription. "الشروط" كمان ممكن تتكتب كنقط، فبتتحول
  // لقايمة زي الوصف لو فيها "•" بعد التنضيف.
  const requirements = sanitizeJobDescription(job.requirements || "");
  const requirementsIsArabic = isArabicText(requirements);
  const requirementsBulletItems = splitBulletItems(requirements);
  const additionalBenefits = sanitizeJobDescription(job.additionalBenefits || "");

  return (
    <div dir="rtl" style={{ width: "100%", maxWidth: 1020, margin: "0 auto", padding: "40px 20px" }}>
      <JobViewTracker jobId={job.id} />
      {jobPostingJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <div className="browse-layout">
        <div className="browse-main">
      <div style={{ fontSize: 12.5, color: "#2D3748", fontWeight: 600, marginBottom: 2 }}>المسمى الوظيفي</div>
      <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 6 }}>{job.title}</h1>
      <div style={{ fontSize: 14.5, color: "#14213D", fontWeight: 600, marginBottom: 16 }}>
        {/* fontFamily صريح هنا (بدل الاعتماد على fallback المتصفح التلقائي بس) — بعض
            المتصفحات على ويندوز بتفشل تلاقي خط إيموجي مناسب لـTajawal تلقائيًا وترسم
            مربع (tofu) بدل الإيموجي، فبنحدد خطوط الإيموجي الشائعة صراحة كـfallback. */}
        <span style={{ fontFamily: '"Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif' }}>🏢</span>{" "}
        {job.showCompanyName && job.companyName ? job.companyName : "شركة غير معلنة"}
      </div>

      {job.featured && (
        <div style={{ marginBottom: 12 }}>
          <span style={featuredPillStyle}>⭐ مميز</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <InfoChip icon="📍" label="الموقع" value={`${job.city} - ${job.governorate}`} />
        <InfoChip icon="🕒" label="نوع الدوام" value={JOB_TYPE_LABELS[job.jobType] || job.jobType} />
        {job.jobLevel && (
          <InfoChip icon="📊" label="المستوى" value={EXPERIENCE_LEVELS[job.jobLevel] || job.jobLevel} />
        )}
        {job.specialization && <InfoChip icon="🏷️" label="التخصص" value={job.specialization} />}
      </div>

      {Array.isArray(job.keywords) && job.keywords.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>المهارات المطلوبة</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {job.keywords.map((keyword: string) => (
              <span key={keyword} style={tagStyle}>{keyword}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        {job.receiveMethod === "contact" && job.contactMethod === "whatsapp" && job.contactValue && whatsappNumber ? (
          <WhatsAppContactLink
            jobId={job.id}
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
              `مرحبًا، شفت إعلان وظيفة ${job.title} على موقع الشغل وحابب أتقدملها`
            )}`}
          >
            <WhatsAppIcon size={18} /> تواصل عبر واتساب
          </WhatsAppContactLink>
        ) : job.receiveMethod === "contact" && job.contactValue ? (
          <p style={{ color: "#4A5568", margin: 0 }}>
            <strong>التواصل ({({ email: "إيميل", whatsapp: "واتساب", phone: "تليفون" } as Record<string,string>)[job.contactMethod] || job.contactMethod}):</strong> {job.contactValue}
          </p>
        ) : (
          <ApplyButton
            jobId={job.id}
            employerId={job.employerId}
            jobSpecialization={job.specialization}
            jobLevel={job.jobLevel}
            screeningQuestions={job.screeningQuestions || []}
          />
        )}
        <ShareButton
          jobId={job.id}
          title={job.title}
          style={{ background: "transparent", border: "1px solid #14213D33", color: "#4A5568", fontSize: 11.5, padding: "3px 9px" }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <ReportJobButton jobId={job.id} employerId={job.employerId} jobTitle={job.title} />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>وصف الوظيفة</h2>

      {descriptionBulletItems ? (
        <ul
          dir={descriptionIsArabic ? "rtl" : "ltr"}
          style={{
            lineHeight: 1.8,
            marginBottom: 20,
            textAlign: descriptionIsArabic ? "right" : "left",
            paddingInlineStart: 20,
            listStyleType: "disc",
          }}
        >
          {descriptionBulletItems.map((item, i) => (
            <li key={i} style={{ whiteSpace: "pre-wrap", marginBottom: 4 }}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p
          dir={descriptionIsArabic ? "rtl" : "ltr"}
          style={{
            lineHeight: 1.8,
            marginBottom: 20,
            whiteSpace: "pre-wrap",
            textAlign: descriptionIsArabic ? "right" : "left",
          }}
        >
          {description}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 14, marginBottom: 20 }}>
        <DetailRow label="الراتب" value={salaryText(job)} />
        <DetailRow label="عدد الفرص المتاحة" value={job.vacancies ? `${job.vacancies} فرصة` : undefined} />
        <DetailRow
          label="السن المطلوب"
          value={
            job.ageFrom && job.ageTo
              ? `${job.ageFrom} - ${job.ageTo} سنة`
              : job.ageFrom
              ? `من ${job.ageFrom} سنة`
              : job.ageTo
              ? `لحد ${job.ageTo} سنة`
              : undefined
          }
        />
        <DetailRow label="محتاج عربية" value={job.needsCar === "yes" ? "أيوة ✓" : job.needsCar === "no" ? "لأ" : undefined} />
        <DetailRow label="ساعات العمل يوميًا" value={job.hoursPerDay ? `${job.hoursPerDay} ساعات` : undefined} />
        <DetailRow label="التأمين الاجتماعي" value={job.socialInsurance === "yes" ? "متوفر ✓" : job.socialInsurance === "no" ? "غير متوفر" : undefined} />
        <DetailRow label="المواصلات" value={job.transportationAvailable === "yes" ? "متوفرة ✓" : job.transportationAvailable === "no" ? "غير متوفرة" : undefined} />
        <DetailRow label="سكن المغتربين" value={job.housingForExpats === "yes" ? "متوفر ✓" : job.housingForExpats === "no" ? "غير متوفر" : undefined} />
      </div>

      {requirements && (
        requirementsBulletItems ? (
          <div style={{ marginBottom: 10 }}>
            <strong>الشروط:</strong>
            <ul
              dir={requirementsIsArabic ? "rtl" : "ltr"}
              style={{
                lineHeight: 1.8,
                marginTop: 4,
                textAlign: requirementsIsArabic ? "right" : "left",
                paddingInlineStart: 20,
                listStyleType: "disc",
              }}
            >
              {requirementsBulletItems.map((item, i) => (
                <li key={i} style={{ whiteSpace: "pre-wrap", marginBottom: 4 }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p style={{ marginBottom: 10, whiteSpace: "pre-wrap" }}><strong>الشروط:</strong> {requirements}</p>
        )
      )}
      {additionalBenefits && (
        <p style={{ marginBottom: 20, whiteSpace: "pre-wrap" }}><strong>مزايا إضافية:</strong> {additionalBenefits}</p>
      )}

      <RelatedJobs jobId={job.id} specialization={job.specialization} governorate={job.governorate} />
        </div>

        <BrowseSidebar combos={popularCombos} />
      </div>
    </div>
  );
}

// نفس أيقونة WhatsAppFloatingButton.tsx بالظبط، بس بحجم قابل للتحكم عشان تتحط جوه زرار
// التواصل هنا (مش عائمة).
function WhatsAppIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="#fff" aria-hidden="true">
      <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.36.687 4.56 1.872 6.41L4 29l7.77-1.836A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.818a9.77 9.77 0 0 1-4.98-1.362l-.357-.212-4.612 1.09 1.104-4.49-.233-.368A9.77 9.77 0 0 1 5.182 15c0-5.972 4.85-10.818 10.822-10.818S26.818 9.028 26.818 15 21.976 24.818 16.004 24.818Zm5.98-8.14c-.328-.164-1.94-.957-2.24-1.066-.3-.11-.518-.164-.737.164-.219.328-.846 1.066-1.037 1.285-.19.219-.382.246-.71.082-.328-.164-1.384-.51-2.636-1.626-.975-.87-1.633-1.943-1.824-2.271-.19-.328-.02-.505.144-.669.148-.147.328-.383.492-.574.164-.192.219-.328.328-.547.11-.219.055-.41-.027-.574-.082-.164-.737-1.776-1.01-2.434-.266-.64-.537-.554-.737-.564l-.628-.01c-.219 0-.574.082-.874.41-.3.328-1.147 1.12-1.147 2.732s1.174 3.17 1.338 3.389c.164.219 2.31 3.526 5.596 4.945.782.338 1.393.54 1.869.69.785.25 1.499.214 2.064.13.63-.094 1.94-.793 2.213-1.559.273-.766.273-1.422.191-1.559-.082-.137-.301-.219-.629-.383Z" />
    </svg>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span style={{ fontWeight: 700 }}>{label}: </span>
      <span>{value}</span>
    </div>
  );
}

// خانة معلومة واحدة جوه grid الـ2×2 فوق تفاصيل الوظيفة — أيقونة + تسمية رمادية صغيرة
// توضح إيه القيمة دي، بدل ما تكون نص عايم من غير سياق.
function InfoChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        border: "1px solid #14213D1F",
        borderRadius: 8,
        padding: "8px 10px",
        background: "#fff",
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1.4 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, color: "#4A5568" }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#14213D" }}>{value}</div>
      </div>
    </div>
  );
}
