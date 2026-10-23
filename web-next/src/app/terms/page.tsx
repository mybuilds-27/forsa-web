import Link from "next/link";
import { pageSeo } from "@/lib/seoMetadata";

export const metadata = pageSeo({
  title: "الشروط والأحكام - موقع الشغل",
  description: "الشروط والأحكام الخاصة باستخدام موقع الشغل.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div dir="rtl" style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>الشروط والأحكام</h1>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>١. طبيعة الموقع</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        &quot;الشغل&quot; موقع وسيط بيربط الباحثين عن عمل بأصحاب الأعمال، ومش طرف في أي تعاقد فعلي بينهم. الموقع
        مش مسؤول عن دقة البيانات اللي بيدخلها المستخدمين (باحثين عن عمل أو أصحاب أعمال)، ولا عن نتيجة
        أي تقديم أو توظيف يحصل عن طريقه.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>٢. مسؤولية المستخدم</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        المستخدم مسؤول بالكامل عن صحة البيانات اللي بيسجلها. ممنوع تسجيل بيانات وهمية، انتحال شخصية،
        أو نشر إعلانات وظائف غير حقيقية أو مخالفة للقانون المصري. الموقع بيحتفظ بحقه في إيقاف أو حذف
        أي حساب يخالف الشروط دي من غير إنذار مسبق.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>٣. الاستخدام المجاني</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        التسجيل والتقديم على الوظائف مجاني ١٠٠٪ للباحثين عن عمل، وهيفضل مجاني دائمًا. أصحاب الأعمال
        عندهم باقة مجانية بحد أقصى للإعلانات الشهرية، وباقة مدفوعة اختيارية بمميزات إضافية.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>٤. حدود المسؤولية</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        الموقع بيبذل جهده إن الخدمة تكون متاحة ومستقرة، لكن مش بيضمن عدم وجود أعطال تقنية مؤقتة.
        الموقع مش مسؤول عن أي خسارة أو ضرر ناتج عن استخدام أو عدم القدرة على استخدام الموقع.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>٥. حساب المستخدم وأمانه</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        المستخدم مسؤول عن الحفاظ على سرية بيانات دخوله وعن أي نشاط بيتم من حسابه، ولازم يبلّغنا لو حس إن حسابه
        اتستخدم من غيره.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>٦. الاستخدام المقبول</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        ممنوع استخدام الموقع في أي نشاط مخالف للقانون، أو نشر محتوى مسيء أو مضلل، أو طلب فلوس أو بيانات حساسة من
        الباحثين عن عمل، أو نسخ بيانات الموقع آليًا بشكل مفرط، أو محاولة اختراق الموقع أو تعطيله.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>٧. محتوى المستخدمين وإعلانات الوظائف</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        صاحب الإعلان مسؤول عن صحة المعلومات اللي بينشرها، ويقدر الموقع يعدّل أو يوقف أي إعلان مخالف أو مشبوه.
        وبتمنح الموقع حق عرض المحتوى اللي بتنشره داخل الموقع بغرض تقديم الخدمة.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>٨. الإعلانات والروابط الخارجية</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        الموقع ممكن يعرض إعلانات من جهات خارجية (زي Google AdSense) أو يحتوي روابط لمواقع تانية، والموقع مش مسؤول
        عن محتواها أو عن أي تعامل بينك وبين أصحابها.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>٩. الباقة المدفوعة</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        تفاصيل المميزات والحدود مذكورة في صفحة{" "}
        <Link href="/why-free" style={{ color: "#14213D" }}>
          ليه مجاني؟
        </Link>{" "}
        وفي{" "}
        <Link href="/faq" style={{ color: "#14213D" }}>
          الأسئلة الشائعة
        </Link>
        ، وأي ترقية بتتم بالتواصل معانا.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>١٠. إيقاف الحساب</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        تقدر تطلب حذف حسابك في أي وقت من صفحة تواصل معنا، وللموقع حق إيقاف الحسابات المخالفة.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>١١. القانون المطبّق</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        بتخضع الشروط دي للقانون المصري، وأي نزاع بيخضع لاختصاص المحاكم المصرية المختصة.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>١٢. التواصل</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        لأي استفسار عن الشروط، تواصل معانا من{" "}
        <Link href="/contact" style={{ color: "#14213D" }}>
          صفحة تواصل معنا
        </Link>
        .
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>١٣. التعديلات</h2>
      <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8 }}>
        الموقع بيحتفظ بحقه في تعديل الشروط دي أو سياسة الخصوصية في أي وقت، وأي تعديل بيسري بمجرد نشره
        على الموقع.
      </p>
    </div>
  );
}