// شعار الشركة بشكل موحّد في كل الأماكن اللي بيظهر فيها (الصفحة الرئيسية، /companies، صفحة
// الشركة، لوحة صاحب العمل). كان بيتعرض قبل كده بـobjectFit: "cover" جوه مربع/دايرة، وده كان
// بيقص الشعارات العريضة (نسبة عرض:ارتفاع من 1.5 لـ3.6+) — الصورة الأصلية متخزنة كاملة من غير
// أي قص وقت الرفع، فالقص كان CSS بس. دلوقتي مستطيل بحواف مدورة بـ"contain" وخلفية بيضاء، فالشعار
// يظهر كامل مهما كانت نسبته. الـpadding الصغير بيمنع الشعار من الالتصاق بالحدود أو قص أركانه
// بسبب الحواف المدورة. بدون hooks، فبيشتغل من server components وclient components على حد سواء.
type Props = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
};

export default function CompanyLogo({ src, alt, width = 92, height = 64, style }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- روابط Firebase Storage خام، زي باقي الصور في الموقع
    <img
      src={src}
      alt={alt}
      style={{
        width,
        height,
        objectFit: "contain",
        borderRadius: 12,
        border: "1px solid #14213D22",
        background: "#fff",
        padding: 4,
        boxSizing: "border-box",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
