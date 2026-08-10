import Link from "next/link";

export default function Footer() {
  return (
    <footer
      dir="rtl"
      style={{
        marginTop: "auto",
        padding: "20px",
        borderTop: "1px solid #14213D22",
        textAlign: "center",
        fontSize: 13,
        color: "#4A5568",
      }}
    >
      <div style={{ marginBottom: 8 }}>
        الشغل — منصة توظيف مصرية · بيانات المستخدمين محمية ومش بتتباع لأي طرف تالت
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <Link href="/about" style={linkStyle}>من نحن</Link>
        <Link href="/why-free" style={linkStyle}>ليه مجاني؟</Link>
        <Link href="/companies" style={linkStyle}>الشركات</Link>
        <Link href="/privacy" style={linkStyle}>سياسة الخصوصية</Link>
        <Link href="/terms" style={linkStyle}>الشروط والأحكام</Link>
        <Link href="/faq" style={linkStyle}>الأسئلة الشائعة</Link>
        <Link href="/contact" style={linkStyle}>تواصل معنا</Link>
        
<a href="https://www.facebook.com/profile.php?id=61592211902381" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          📘 صفحتنا على فيسبوك
        </a>
      </div>
      <div>© {new Date().getFullYear()} الشغل - منصة توظيف مصرية</div>
    </footer>
  );
}

const linkStyle: React.CSSProperties = {
  color: "#4A5568",
  textDecoration: "underline",
};