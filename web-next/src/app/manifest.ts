import type { MetadataRoute } from "next";

// اللون نفسه المستخدم في COLORS.ink بمكونات الموقع (RegisterForm.tsx وغيرها) — بنكرره
// هنا كنص لأن ملف الـmanifest ده مش React component، مفيش import مشترك بينهم.
const INK_COLOR = "#14213D";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "الشغل - موقع توظيف مصري",
    short_name: "الشغل",
    description:
      "موقع الشغل بيساعدك تلاقي وظيفتك المناسبة أو توظف كوادر لشركتك مجانًا بالكامل وبدون أي رسوم.",
    start_url: "/",
    display: "standalone",
    background_color: INK_COLOR,
    theme_color: INK_COLOR,
    lang: "ar",
    dir: "rtl",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
