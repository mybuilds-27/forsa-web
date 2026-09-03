"use client";

import { logWhatsAppClick } from "@/lib/whatsappClicks";

type Props = {
  jobId: string;
  href: string;
  children: React.ReactNode;
};

// زرار "تواصل عبر واتساب" لوظائف receiveMethod === "contact" جوه jobs/[id]/page.tsx (Server
// Component، مش ممكن يحمل onClick مباشرة) — بيسجّل ضغطة وقت الدوسة (شوف lib/whatsappClicks.ts)
// من غير أي preventDefault، فتح واتساب نفسه بيكمل عادي زي ما هو بالظبط.
export default function WhatsAppContactLink({ jobId, href, children }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => logWhatsAppClick(jobId)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#25D366",
        color: "#fff",
        fontWeight: 700,
        fontSize: 14.5,
        padding: "10px 18px",
        borderRadius: 8,
        textDecoration: "none",
      }}
    >
      {children}
    </a>
  );
}
