import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { isForceLongPollingActive, recordForcedLongPolling } from "./withGracePeriod";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
// لو المتصفح ده فشل عنده HARD_FAIL_TIMEOUT قبل كده (شوف isForceLongPollingActive في
// withGracePeriod.ts) بنشغّل long-polling إجباري عليه بس، غير كده الإعداد العادي (الـauto-detect
// شغال افتراضيًا من v9.22). initializeFirestore بترمي لو Firestore اتعمله initialize قبل كده
// بإعدادات مختلفة (بيحصل بس مع HMR وقت التطوير) — فبنرجع لـgetFirestore اللي بيرجّع الـinstance
// الموجود. الشرط typeof window لأن الملف ده بيتستورد كمان من server components (Node)، والخيار
// ده مش مدعوم هناك.
function createDb() {
  if (typeof window !== "undefined" && isForceLongPollingActive()) {
    try {
      const forced = initializeFirestore(app, { experimentalForceLongPolling: true });
      recordForcedLongPolling(true);
      return forced;
    } catch {
      // already initialized — نكمل بالـinstance الموجود تحت
    }
  }
  return getFirestore(app);
}

export const db = createDb();
export const storage = getStorage(app);
export const functions = getFunctions(app);