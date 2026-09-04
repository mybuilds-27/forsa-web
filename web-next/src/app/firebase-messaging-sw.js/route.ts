import { NextResponse } from "next/server";

// firebase-messaging-sw.js لازم يتقدّم من مسار الـroot بالظبط (عشان يحصل على الـscope
// الافتراضي "/" اللي FCM محتاجه) — هنا route handler بدل ملف static عادي في public/ عشان
// يقدر يقرا نفس قيم NEXT_PUBLIC_FIREBASE_* الموجودة فعلًا في env vars وقت الطلب، من غير أي
// نسخة تانية مكررة نحتاج نزامنها يدويًا لو القيم اتغيّرت في المستقبل.
export const dynamic = "force-dynamic";

export async function GET() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const body = `
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(firebaseConfig)});

const messaging = firebase.messaging();

// إشعارات وصلت والموقع/التاب مقفول أو في الخلفية — الحالة اللي Push Notifications عمومًا
// موجودة عشانها. لو التاب فاتح وشغال، الرسالة بتوصل بدل كده لـonMessage في كود العميل
// (لسه مش مضاف في المرحلة دي).
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const link = (payload.fcmOptions && payload.fcmOptions.link) || "/";
  self.registration.showNotification(notification.title || "الشغل", {
    body: notification.body || "",
    icon: "/icon-192.png",
    data: { link },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(clients.openWindow(link));
});
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
