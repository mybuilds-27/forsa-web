import LogoMark from "@/components/LogoMark";

// Next.js بيولّد Suspense boundary تلقائي حوالين الـroute segment (وأي حاجة متداخلة تحته
// من غير loading.tsx خاص بيها) — بيظهر أول تحميل حقيقي للموقع (أو انتقال RSC بطيء)، مش
// كل ما صفحة معيّنة (زي JobsTab) بتجيب بياناتها من Firestore عبر useEffect — دي عندها
// spinners خاصة منفصلة تمامًا عن الملف ده. Server Component عادي (مفيش تفاعل، مفيش
// داعي لـ"use client")، وبنفس لون خلفية الموقع الحقيقي (--paper في globals.css) عشان
// الانتقال من شاشة الـsplash (manifest.ts) يبقى سلس بصريًا من غير قفزة لون.
export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#FAF6EC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
      }}
    >
      <LogoMark size={72} />
      <div style={{ display: "flex", gap: 8 }} aria-hidden="true">
        <span style={{ ...dotStyle, animationDelay: "0s" }} />
        <span style={{ ...dotStyle, animationDelay: "0.2s" }} />
        <span style={{ ...dotStyle, animationDelay: "0.4s" }} />
      </div>
      <style>{`
        @keyframes elshoghl-loading-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

const dotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#C97F1F",
  animationName: "elshoghl-loading-pulse",
  animationDuration: "1.2s",
  animationIterationCount: "infinite",
  animationTimingFunction: "ease-in-out",
};
