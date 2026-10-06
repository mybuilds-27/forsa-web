export type AdminTab = "stats" | "employers";

const TABS: { key: AdminTab; label: string }[] = [
  { key: "stats", label: "📊 الإحصائيات" },
  { key: "employers", label: "🏢 أصحاب الأعمال" },
];

export default function AdminTabBar({ tab, onChange }: { tab: AdminTab; onChange: (tab: AdminTab) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: "1px solid #14213D33",
            background: tab === t.key ? "#14213D" : "#fff",
            color: tab === t.key ? "#fff" : "#14213D",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
