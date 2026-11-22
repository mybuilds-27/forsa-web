import type { HrTemplateBlock } from "@/lib/hrTemplateBlocks";

// محتوى مربع النموذج في /hr-templates/[slug] ونسخة الطباعة (HrTemplateActions.tsx)، من blocks بتاعة
// lib/hrTemplateBlocks.ts. block النص = نفس النص كـtext node جوه الحاوية (اللي عليها pre-wrap ومقاس الخط)،
// فالنموذج اللي مفيهوش جداول بيطلع بالظبط زي الأول. block الجدول = <table> جوه div بـoverflow-x: auto عشان
// الصفحة ماتعملش scroll أفقي على الموبايل. ألوان الإطار هنا للشاشة؛ الطباعة بتقلبها أسود من globals.css
// (.hr-template-print-view). من غير hooks، فينفع يتستخدم من server component ومن client component.
const BORDER_COLOR = "#14213D33"; // نفس لون إطار مربع النموذج

export default function HrTemplateBlocksView({ blocks }: { blocks: HrTemplateBlock[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.type === "text" ? (
          b.text
        ) : (
          // width 0 وminWidth 100%: الجدول العريض يعمل scroll جوه المربع بدل ما يوسّع الصفحة على الموبايل
          <div key={i} className="hr-template-table-wrap" style={{ overflowX: "auto", width: 0, minWidth: "100%" }}>
            <table className="hr-template-table" style={tableStyle}>
              {b.header && (
                <thead>
                  <tr>
                    {b.header.map((c, j) => (
                      <th key={j} style={{ ...cellStyle(c), fontWeight: 700, background: "#F3F4F6" }}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((c, j) => (
                      <td key={j} style={cellStyle(c)}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "inherit",
};

// الخانة الفاضية ارتفاعها مايقلش عن 28px (height في خانة الجدول بيشتغل كحد أدنى) عشان تتكتب فيها بخط اليد
function cellStyle(text: string): React.CSSProperties {
  return {
    border: `1px solid ${BORDER_COLOR}`,
    padding: "6px 8px",
    textAlign: "right",
    verticalAlign: "top",
    fontSize: "inherit",
    ...(text ? {} : { height: 28 }),
  };
}
