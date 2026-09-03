"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, getDocs, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type NotificationDoc = {
  id: string;
  type: string;
  message: string;
  link: string;
  read: boolean;
  createdAt?: Timestamp;
};

export default function NotificationBell() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationDoc)));
      },
      (err) => {
        console.error("[NotificationBell] فشل تحميل الإشعارات", err);
      }
    );
    return () => unsubscribe();
  }, [uid]);

  // بنقفل كل الإشعارات غير المقروءة وقت *قفل* القايمة مش وقت فتحها، عشان المستخدم يقدر يشوف
  // مين جديد قبل ما يتحول لمقروء. بنجيب الإشعارات غير المقروءة بقراءة مباشرة من Firestore
  // (مش من notifications state) عشان الدالة تفضل صحيحة حتى لو اتنادت من جوه useEffect
  // بيتسجل مرة واحدة بس (زي handleClickOutside تحت).
  async function markAllAsRead(userId: string) {
    try {
      const q = query(collection(db, "notifications"), where("userId", "==", userId), where("read", "==", false));
      const snap = await getDocs(q);
      if (snap.empty) return;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
    } catch (err) {
      console.error("[NotificationBell] فشل تحديد كل الإشعارات كمقروءة", err);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen((wasOpen) => {
          if (wasOpen && uid) markAllAsRead(uid);
          return false;
        });
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  if (!uid) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleBellClick() {
    setOpen((wasOpen) => {
      if (wasOpen) markAllAsRead(uid!);
      return !wasOpen;
    });
  }

  async function handleNotificationClick(n: NotificationDoc) {
    setOpen(false);
    if (!n.read) {
      try {
        await updateDoc(doc(db, "notifications", n.id), { read: true });
      } catch (err) {
        console.error("[NotificationBell] فشل تحديث حالة القراءة", err);
      }
    }
    router.push(n.link);
  }

  function formatTime(ts?: Timestamp) {
    if (!ts) return "";
    return ts.toDate().toLocaleDateString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={handleBellClick}
        title="الإشعارات"
        style={{
          position: "relative",
          background: "transparent",
          border: "1px solid #14213D22",
          borderRadius: 6,
          padding: "6px 14px",
          fontSize: 14,
          fontWeight: 600,
          color: "#14213D",
          cursor: "pointer",
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        🔔 إشعارات
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              insetInlineStart: -6,
              background: "#B03A14",
              color: "#fff",
              fontSize: 10.5,
              fontWeight: 700,
              borderRadius: 999,
              minWidth: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // notification-backdrop مبيبقاش ليه أي box خالص على الديسكتوب (display:contents في
        // globals.css)، فـnotification-panel بتتموضع absolute زي ما كانت بالظبط قبل كده. على
        // الموبايل بس بيتحول لـoverlay كامل الشاشة (نفس نمط ScreeningQuestionsModal.tsx)،
        // عشان زرار الجرس بيتلف مكان مش متوقع جوه صف روابط Navbar.tsx على الشاشات الضيقة.
        <div
          className="notification-backdrop"
          onClick={() => {
            setOpen(false);
            if (uid) markAllAsRead(uid);
          }}
        >
          <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
            <button
              className="notification-close-btn"
              onClick={() => {
                setOpen(false);
                if (uid) markAllAsRead(uid);
              }}
              aria-label="إغلاق"
            >
              ✕
            </button>
            <div style={{ padding: "10px 14px", fontWeight: 700, borderBottom: "1px solid #14213D14", fontSize: 14, color: "#14213D" }}>
              الإشعارات
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#4A5568", fontSize: 13.5 }}>
                مفيش إشعارات لسه
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "right",
                    padding: "10px 14px",
                    background: n.read ? "transparent" : "rgba(232,163,61,0.1)",
                    border: "none",
                    borderBottom: "1px solid #14213D0F",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontSize: 13.5, color: "#14213D", fontWeight: n.read ? 400 : 700, lineHeight: 1.5 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: 11, color: "#4A5568", marginTop: 4 }}>{formatTime(n.createdAt)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
