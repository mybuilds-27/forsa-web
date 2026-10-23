import Link from "next/link";
import { pageSeo } from "@/lib/seoMetadata";

export const metadata = pageSeo({
  title: "من نحن - موقع الشغل",
  description: "موقع الشغل - موقع مصري للتوظيف يربط الباحثين عن عمل بأصحاب الأعمال مباشرة.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div dir="rtl" style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>من نحن</h1>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 16 }}>
        &quot;الشغل&quot; موقع مصري للتوظيف واستشارات الموارد البشرية، بيوصّل الباحثين عن عمل بأصحاب الأعمال مباشرة، من غير وسيط ومن غير تعقيد.
        التسجيل والتقديم على الوظايف <strong>مجاني ١٠٠٪ للباحثين عن عمل دائمًا</strong>، وأصحاب الأعمال بينشروا لحد ٥ وظايف
        شهريًا مجانًا.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>هدفنا</h2>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 16 }}>
        إن أي حد بيدوّر على شغل يسجّل بياناته مرة واحدة ويقدّم بضغطة، وإن أي صاحب عمل، خصوصًا الشركات الصغيرة والمتوسطة،
        يلاقي الكوادر المناسبة بسهولة وسرعة وبدون عبء مادي.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>إيه اللي هتلاقيه على الموقع</h2>
      <ul style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 16, paddingInlineStart: 20 }}>
        <li>وظايف مرتبة بالمحافظة والتخصص.</li>
        <li>بروفايل بتسجّل فيه بياناتك مرة واحدة وتطبع منه سيرة ذاتية عربية جاهزة.</li>
        <li>لوحة لأصحاب الأعمال لنشر الوظايف ومتابعة المتقدمين.</li>
        <li>
          أدلة ومقالات مجانية عن البحث عن شغل والسيرة الذاتية والمقابلات وحقوق العامل (
          <Link href="/articles" style={{ color: "#14213D" }}>
            تصفح المقالات
          </Link>
          ).
        </li>
      </ul>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>مين بيدير الموقع</h2>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 16 }}>
        الشغل موقع مصري مستقل بيديره صاحبه مباشرة. الموقع لسه في مراحله الأولى وبنطوره باستمرار بناءً على ملاحظات
        المستخدمين.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>إزاي بنكتب مقالاتنا</h2>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 16 }}>
        بنكتب مقالاتنا لغرض إفادة الباحث عن عمل وصاحب العمل. وفي المقالات اللي بتتكلم عن القانون بنعتمد على نص القانون
        وبنذكر رقم المادة، وبنوضّح لو النسخة اللي رجعنا لها مش النسخة الرسمية من الجريدة الرسمية، وكل ده معلومات عامة مش
        استشارة قانونية.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>إزاي الموقع بيمشي</h2>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 16 }}>
        الموقع مجاني للباحثين عن عمل. التكاليف بتتغطى من باقة مدفوعة اختيارية لأصحاب الأعمال (
        <Link href="/why-free" style={{ color: "#14213D" }}>
          ليه مجاني؟
        </Link>
        )، وممكن الموقع يعرض إعلانات من جهات خارجية زي Google AdSense حسب{" "}
        <Link href="/privacy" style={{ color: "#14213D" }}>
          سياسة الخصوصية
        </Link>
        .
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>لو شفت إعلان مشبوه</h2>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 16 }}>
        استخدم زرار الإبلاغ في صفحة الوظيفة، وبنراجع البلاغات. وللمزيد اقرا{" "}
        <Link href="/articles/avoid-fake-job-scams" style={{ color: "#14213D" }}>
          إزاي تتجنب نصب الوظايف الوهمية
        </Link>
        .
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>تواصل معانا</h2>
      <p style={{ color: "#4A5568", lineHeight: 1.8 }}>
        للاقتراحات والشكاوى والاستفسارات تواصل معانا على elshoghl27@gmail.com أو من{" "}
        <Link href="/contact" style={{ color: "#14213D" }}>
          صفحة تواصل معنا
        </Link>
        .
      </p>
    </div>
  );
}
