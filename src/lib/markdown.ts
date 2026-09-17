/**
 * A deliberately small Markdown reader for release notes.
 *
 * The update notice renders the release body, which `cliff.toml` generates:
 * `##`/`###` headings, bullet lists and bold scopes. Supporting exactly that
 * subset keeps the reader small, and returning blocks instead of HTML keeps
 * remote text out of the document — release notes are shown as elements, never
 * as markup, so a commit message containing `<script>` stays literal text.
 *
 * Inline support: `**bold**`, `` `code` `` and `[label](https://…)`. The cliff
 * template emits nothing else, and italics are left alone on purpose because
 * `*` shows up in ordinary commit subjects.
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string };

export type BlockNode =
  | { type: "heading"; level: number; content: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "paragraph"; content: InlineNode[] }
  | { type: "rule" };

const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const BULLET = /^[-*+]\s+(\S.*)$/;
const ORDERED = /^\d+[.)]\s+(\S.*)$/;
const INLINE = /\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)/g;

/** Splits a paragraph or list item into text, bold, code and link runs. */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let end = 0;

  for (const match of text.matchAll(INLINE)) {
    const start = match.index;
    if (start > end) nodes.push({ type: "text", value: text.slice(end, start) });
    nodes.push(inlineNode(match[0]));
    end = start + match[0].length;
  }

  if (end < text.length) nodes.push({ type: "text", value: text.slice(end) });
  return nodes;
}

function inlineNode(token: string): InlineNode {
  if (token.startsWith("**")) return { type: "strong", value: token.slice(2, -2) };
  if (token.startsWith("`")) return { type: "code", value: token.slice(1, -1) };

  const split = token.indexOf("](");
  return { type: "link", value: token.slice(1, split), href: token.slice(split + 2, -1) };
}

/** Reads release notes into the blocks the update notice renders. */
export function parseMarkdown(source: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, content: parseInline(heading[2]) });
      continue;
    }

    if (RULE.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "rule" });
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    const item = bullet?.[1] ?? ordered?.[1];
    if (item !== undefined) {
      flushParagraph();
      const isOrdered = ordered !== null;
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(item);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
