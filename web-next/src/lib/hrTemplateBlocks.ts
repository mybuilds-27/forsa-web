// تقسيم نص template بتاع نموذج الموارد البشرية لـblocks: نص عادي، أو جدول. حقل template نفسه بيفضل نص عادي.
// أي سطور ورا بعض كل سطر فيها (بعد trim) بيبدأ بـ| وبيخلص بـ| = جدول، والخانات = اللي بين الـ| (كل خانة trim).
// لو تاني سطر في الجدول كل خاناته شَرط بس (|---|---|)، أول سطر بيبقى header وسطر الشَرط مايتعرضش.
// السطور العادية ورا بعض بتتجمع في block نص واحد بنفس الـnewlines، فالنموذج اللي مفيهوش جداول = block نص واحد
// بنفس النص بالظبط. نفس الـblocks بتستخدمها: مربع النموذج والطباعة (HrTemplateBlocksView.tsx)، والنسخ
// (hrTemplatePlainText تحت)، وملف Word (hrTemplateDocx.ts).

export type HrTemplateBlock =
  | { type: "text"; text: string }
  | { type: "table"; header: string[] | null; rows: string[][] };

const isTableLine = (line: string) => {
  const t = line.trim();
  return t.length >= 2 && t.startsWith("|") && t.endsWith("|");
};
const cellsOf = (line: string) => line.trim().slice(1, -1).split("|").map((c) => c.trim());
const isSeparator = (cells: string[]) => cells.length > 0 && cells.every((c) => /^-+$/.test(c));

// بيرمي Error فيه الـslug ورقم السطر (من 1) لو صفوف جدول (مع الـheader) عدد خاناتها مختلف.
export function parseHrTemplateBlocks(template: string, slug = ""): HrTemplateBlock[] {
  const lines = template.split("\n");
  const blocks: HrTemplateBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!isTableLine(lines[i])) {
      const start = i;
      while (i < lines.length && !isTableLine(lines[i])) i++;
      blocks.push({ type: "text", text: lines.slice(start, i).join("\n") });
      continue;
    }
    const start = i;
    while (i < lines.length && isTableLine(lines[i])) i++;
    const tableLines = lines.slice(start, i).map((line, j) => ({ cells: cellsOf(line), lineNo: start + j + 1 }));
    const hasHeader = tableLines.length >= 2 && isSeparator(tableLines[1].cells);
    const shown = hasHeader ? [tableLines[0], ...tableLines.slice(2)] : tableLines;
    const width = shown[0].cells.length;
    for (const row of shown) {
      if (row.cells.length !== width) {
        throw new Error(
          `جدول في نموذج "${slug}": السطر ${row.lineNo} فيه ${row.cells.length} خانات، وأول صف في الجدول (السطر ${shown[0].lineNo}) فيه ${width}`
        );
      }
    }
    blocks.push({
      type: "table",
      header: hasHeader ? shown[0].cells : null,
      rows: (hasHeader ? shown.slice(1) : shown).map((r) => r.cells),
    });
  }
  return blocks;
}

// الخانة الفاضية في النص المنسوخ (مكان يتكتب فيه)
const EMPTY_CELL_TEXT = "....................";

// النص المنسوخ بزرار "نسخ النموذج": النص زي ما هو، وكل صف جدول (والـheader) سطر خاناته مفصولة بـ3 مسافات،
// والخانة الفاضية "....................". سطر الشَرط مش من الـblocks أصلًا فمش بيتنسخ.
export function hrTemplatePlainText(blocks: HrTemplateBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "text") return b.text;
      const rows = b.header ? [b.header, ...b.rows] : b.rows;
      return rows.map((r) => r.map((c) => c || EMPTY_CELL_TEXT).join("   ")).join("\n");
    })
    .join("\n");
}
