import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SiteVisitTracker from "@/components/SiteVisitTracker";
import AppInstallTracker from "@/components/AppInstallTracker";

const META_PIXEL_ID = "1678267889939692";
const GA_MEASUREMENT_ID = "G-3J7CEB9JRC";
const ADSENSE_CLIENT_ID = "ca-pub-3556923690765050";

// الخطوط محفوظة جوه الريبو (app/fonts، مصدرها github.com/google/fonts، رخصة OFL) بدل خطوط جوجل الأونلاين،
// عشان الـbuild ميعتمدش على تحميل الخطوط من جوجل. نفس الأوزان بالظبط اللي كانت متحمّلة قبل كده،
// فاختيار المتصفح لأقرب وزن (زي 800) مبيتغيرش. Cairo نسخ ثابتة من الـvariable font (slnt = 0).
const cairo = localFont({
  variable: "--font-cairo",
  display: "swap",
  src: [
    { path: "./fonts/cairo/Cairo-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cairo/Cairo-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cairo/Cairo-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/cairo/Cairo-Black.woff2", weight: "900", style: "normal" },
  ],
});

const tajawal = localFont({
  variable: "--font-tajawal",
  display: "swap",
  src: [
    { path: "./fonts/tajawal/Tajawal-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/tajawal/Tajawal-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/tajawal/Tajawal-Bold.woff2", weight: "700", style: "normal" },
  ],
});

const SITE_URL = "https://www.elshoghl.com";

// نفس قيمة COLORS.ink المستخدمة في مكونات الموقع — بنكررها هنا كنص لأن layout.tsx مالوش
// import مشترك مع مكونات زي RegisterForm.tsx. نفس القيمة كمان في src/app/manifest.ts.
const INK_COLOR = "#14213D";

const HOME_TITLE = "الشغل - موقع وظايف مصر المجاني | دوّر على شغل بسهولة";
const HOME_DESCRIPTION =
  "موقع الشغل بيساعدك تلاقي وظيفتك المناسبة أو توظف كوادر لشركتك مجانًا بالكامل وبدون أي رسوم. آلاف وظايف الشغل في كل محافظات مصر - سجّل دلوقتي وابدأ.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  // مفيش images هنا عمدًا — app/opengraph-image.tsx (ملف الـconvention) بيولّد الصورة
  // ديناميكيًا وبيغلب أي صورة معرّفة هنا في نفس الـsegment، فتعريفها هنا تاني هيبقى كود ميت.
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: SITE_URL,
    siteName: "الشغل",
    locale: "ar_EG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // بيولّد meta tags الـPWA الخاصة بـiOS تلقائيًا (apple-mobile-web-app-capable وغيرها) —
  // Safari محتاجها منفصلة عن manifest.ts العادي.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "الشغل",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: INK_COLOR,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${tajawal.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
        <Script
          id="ga-gtag-src"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <Script
          id="adsbygoogle-init"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        <SiteVisitTracker />
        <AppInstallTracker />
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}