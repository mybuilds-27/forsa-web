export const metadata = {
  title: "من نحن - موقع الشغل",
  description: "موقع الشغل - موقع مصري للتوظيف يربط الباحثين عن عمل بأصحاب الأعمال مباشرة.",
};

export default function AboutPage() {
  return (
    <div dir="rtl" style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>من نحن</h1>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 16 }}>
        &quot;الشغل&quot; موقع مصري للتوظيف واستشارات الموارد البشرية، بيوصّل الباحثين عن عمل بأصحاب الأعمال مباشرة، من غير وسيط ومن غير تعقيد.
        التسجيل والتقديم على الوظائف <strong>مجاني ١٠٠٪ للباحثين عن عمل دائمًا</strong>.
        هدفنا إن أي حد بيدوّر على شغل يقدر يسجل بياناته مرة واحدة، وأي صاحب عمل يقدر يوصله بسهولة وسرعة.
      </p>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 16 }}>
        الموقع لسه في مراحله الأولى وبنطوره باستمرار بناءً على ملاحظات المستخدمين. لو عندك أي اقتراح
        أو واجهت مشكلة، تواصل معانا على البريد الإلكتروني تحت.
      </p>
      <p style={{ color: "#4A5568", lineHeight: 1.8 }}>
        <strong>للتواصل:</strong> elshoghl27@gmail.com
      </p>
    </div>
  );
}