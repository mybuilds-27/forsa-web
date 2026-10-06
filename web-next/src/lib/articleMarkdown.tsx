import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

// Markdown مبسّط لنص المقالات (content/articles) من غير مكتبة خارجية: ## و### عناوين، "- " قايمة
// نقطية، "1. " قايمة مرقّمة، سطر فاضي يفصل الفقرات، **غامق**، و[نص](رابط). كل حاجة بتتحوّل
// لعناصر React مباشرة (مفيش dangerouslySetInnerHTML)، والروابط مسموح فيها "/..." أو http(s) بس.

type Block =
  | { type: "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let open: "p" | "ul" | "ol" | null = null;

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      open = null;
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: heading[1].length === 2 ? "h2" : "h3", text: heading[2] });
      open = null;
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    const item = bullet ?? numbered;
    const last = blocks[blocks.length - 1];
    if (item) {
      const listType = bullet ? "ul" : "ol";
      if (open === listType && last && (last.type === "ul" || last.type === "ol")) {
        last.items.push(item[1]);
      } else {
        blocks.push({ type: listType, items: [item[1]] });
      }
      open = listType;
      continue;
    }

    if (open === "p" && last && last.type === "p") {
      last.text += ` ${line}`;
    } else {
      blocks.push({ type: "p", text: line });
    }
    open = "p";
  }

  return blocks;
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/;

const inlineLinkStyle: CSSProperties = { color: "#14213D", fontWeight: 700, textDecoration: "underline" };

function renderInline(text: string): ReactNode[] {
  return text
    .split(INLINE_PATTERN)
    .filter(Boolean)
    .map((part, i) => {
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      if (bold) return <strong key={i}>{bold[1]}</strong>;

      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link) {
        const [, label, href] = link;
        if (href.startsWith("/")) {
          return (
            <Link key={i} href={href} style={inlineLinkStyle}>
              {label}
            </Link>
          );
        }
        if (/^https?:\/\//.test(href)) {
          return (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={inlineLinkStyle}>
              {label}
            </a>
          );
        }
      }
      return part;
    });
}

const bodyColor = "#2D3748";
const h2Style: CSSProperties = { fontSize: 22, fontWeight: 800, color: "#14213D", margin: "32px 0 12px", lineHeight: 1.5 };
const h3Style: CSSProperties = { fontSize: 18, fontWeight: 700, color: "#14213D", margin: "24px 0 10px", lineHeight: 1.5 };
const pStyle: CSSProperties = { fontSize: 16.5, color: bodyColor, lineHeight: 2, margin: "0 0 16px" };
const listStyle: CSSProperties = { fontSize: 16.5, color: bodyColor, lineHeight: 2, margin: "0 0 16px", paddingInlineStart: 24 };

export default function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div>
      {parseBlocks(markdown).map((block, i) => {
        switch (block.type) {
          case "h2":
            return <h2 key={i} style={h2Style}>{renderInline(block.text)}</h2>;
          case "h3":
            return <h3 key={i} style={h3Style}>{renderInline(block.text)}</h3>;
          case "p":
            return <p key={i} style={pStyle}>{renderInline(block.text)}</p>;
          case "ul":
            return (
              <ul key={i} style={listStyle}>
                {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} style={listStyle}>
                {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
              </ol>
            );
        }
      })}
    </div>
  );
}
