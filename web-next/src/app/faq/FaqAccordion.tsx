"use client";

import { useState } from "react";

type FaqItem = {
  q: string;
  a: React.ReactNode;
};

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set([0]));

  function toggle(index: number) {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => {
        const isOpen = openIndices.has(i);
        return (
          <div key={i} style={{ border: "1px solid #14213D22", borderRadius: 10, overflow: "hidden" }}>
            <button
              onClick={() => toggle(i)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                padding: "14px 16px",
                background: "#fff",
                border: "none",
                textAlign: "right",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "inherit",
                color: "#14213D",
              }}
            >
              <span>{item.q}</span>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{isOpen ? "−" : "+"}</span>
            </button>
            {/* الإجابة بتتعمل render دايمًا (عشان تبقى في HTML السيرفر لمحركات البحث)، والمقفولة مستخبية بـdisplay: none */}
            <div style={{ display: isOpen ? undefined : "none", padding: "0 16px 16px", color: "#4A5568", fontSize: 14, lineHeight: 1.8 }}>
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
