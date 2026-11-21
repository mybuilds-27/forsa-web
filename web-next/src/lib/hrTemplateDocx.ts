// ملف Word (.docx) لنموذج موارد بشرية، من نص template بتاع النموذج نفسه (نفس القيمة اللي بتتعرض في المربع).
// مكتبة docx بتتحمّل بـdynamic import هنا بس (جوه الدالة)، فبتبقى في chunk منفصل ومش بتدخل في JS الصفحة الأساسي.
// النص بيتقسم blocks (lib/hrTemplateBlocks.ts، نفس تقسيم المربع والطباعة):
// - block النص: كل سطر = فقرة لوحده (السطور الفاضية بتفضل فاضية)، والفقرات كلها RTL بالعربي (ar-EG)، وArial 12؛
//   أول سطر في النموذج (عنوانه) bold مقاس 16 ومتوسط.
// - block الجدول: Table من اليمين للشمال (visuallyRightToLeft)، عرض 100%، خانات بعرض متساوي، وإطار single 4 أسود؛
//   كل خانة فقرة RTL بـArial 11، والـheader bold بخلفية F3F4F6، والخانة الفاضية فقرة فاضية، وكل صف ارتفاعه 400 twip على الأقل.
// الصفحة A4 بهوامش 2 سم، وفي الآخر سطر رمادي صغير برابط النموذج على الموقع.
// بيرجّع Packer مع المستند: المتصفح بيستخدم toBlob، واختبار node بيستخدم toBuffer.
import { parseHrTemplateBlocks } from "./hrTemplateBlocks";

const SITE_URL = "https://www.elshoghl.com";
const CM = 567; // سنتيمتر بالـtwips (1440 / 2.54)
const PAGE_WIDTH = 11906; // A4
const CONTENT_WIDTH = PAGE_WIDTH - 4 * CM; // عرض المساحة بين الهامشين

export async function buildHrTemplateDocx(template: string, slug: string) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeightRule,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const run = (text: string, opts: { size: number; bold?: boolean; color?: string }) =>
    new TextRun({
      text,
      rightToLeft: true,
      font: "Arial",
      size: opts.size,
      sizeComplexScript: opts.size,
      bold: opts.bold,
      boldComplexScript: opts.bold,
      color: opts.color,
      language: { value: "ar-EG", bidirectional: "ar-EG" },
    });

  const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

  const table = (header: string[] | null, rows: string[][]) => {
    const columns = (header || rows[0]).length;
    const cellWidth = Math.floor(CONTENT_WIDTH / columns);
    const row = (cells: string[], isHeader: boolean) =>
      new TableRow({
        tableHeader: isHeader,
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: cells.map(
          (text) =>
            new TableCell({
              width: { size: 100 / columns, type: WidthType.PERCENTAGE },
              shading: isHeader ? { fill: "F3F4F6", type: ShadingType.CLEAR, color: "auto" } : undefined,
              children: [new Paragraph({ bidirectional: true, children: text ? [run(text, { size: 22, bold: isHeader })] : [] })],
            })
        ),
      });
    return new Table({
      visuallyRightToLeft: true,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: Array.from({ length: columns }, () => cellWidth),
      borders,
      rows: [...(header ? [row(header, true)] : []), ...rows.map((r) => row(r, false))],
    });
  };

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  let isFirstLine = true;
  for (const block of parseHrTemplateBlocks(template, slug)) {
    if (block.type === "table") {
      children.push(table(block.header, block.rows));
      isFirstLine = false;
      continue;
    }
    for (const line of block.text.split("\n")) {
      children.push(
        new Paragraph({
          bidirectional: true,
          alignment: isFirstLine ? AlignmentType.CENTER : undefined,
          children: line ? [run(line, isFirstLine ? { size: 32, bold: true } : { size: 24 })] : [],
        })
      );
      isFirstLine = false;
    }
  }
  children.push(new Paragraph({ bidirectional: true, children: [] }));
  children.push(
    new Paragraph({
      bidirectional: true,
      children: [run(`نموذج من موقع الشغل: ${SITE_URL}/hr-templates/${slug}`, { size: 18, color: "808080" })],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: 16838 }, // A4
            margin: { top: 2 * CM, right: 2 * CM, bottom: 2 * CM, left: 2 * CM },
          },
        },
        children,
      },
    ],
  });
  return { doc, Packer };
}
