// ملف Word (.docx) لنموذج موارد بشرية، من نص template بتاع النموذج نفسه (نفس القيمة اللي بتتعرض في المربع).
// مكتبة docx بتتحمّل بـdynamic import هنا بس (جوه الدالة)، فبتبقى في chunk منفصل ومش بتدخل في JS الصفحة الأساسي.
// كل سطر = فقرة لوحده (السطور الفاضية بتفضل فاضية)، والفقرات كلها RTL بالعربي (ar-EG)، وArial 12؛ أول سطر
// (عنوان النموذج) bold مقاس 16 ومتوسط. الصفحة A4 بهوامش 2 سم، وفي الآخر سطر رمادي صغير برابط النموذج على الموقع.
// بيرجّع Packer مع المستند: المتصفح بيستخدم toBlob، واختبار node بيستخدم toBuffer.

const SITE_URL = "https://www.elshoghl.com";
const CM = 567; // سنتيمتر بالـtwips (1440 / 2.54)

export async function buildHrTemplateDocx(template: string, slug: string) {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } = await import("docx");

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

  const lines = template.split("\n");
  const paragraphs = lines.map(
    (line, i) =>
      new Paragraph({
        bidirectional: true,
        alignment: i === 0 ? AlignmentType.CENTER : undefined,
        children: line ? [run(line, i === 0 ? { size: 32, bold: true } : { size: 24 })] : [],
      })
  );
  paragraphs.push(new Paragraph({ bidirectional: true, children: [] }));
  paragraphs.push(
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
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 2 * CM, right: 2 * CM, bottom: 2 * CM, left: 2 * CM },
          },
        },
        children: paragraphs,
      },
    ],
  });
  return { doc, Packer };
}
