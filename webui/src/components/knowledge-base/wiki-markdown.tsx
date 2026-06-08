import Link from 'next/link';
import { resolveWikiMarkdownLink } from '@/lib/wiki-links';

type Block =
  | { type: 'h2'; text: string; id: string }
  | { type: 'h3'; text: string; id: string }
  | { type: 'p'; html: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '');
}

function inlineFormat(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-shell-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = resolveWikiMarkdownLink(link[2]);
      return (
        <Link
          key={i}
          href={href}
          className="font-medium text-brand-primary underline-offset-2 hover:underline"
        >
          {link[1]}
        </Link>
      );
    }
    return part;
  });
}

export function parseWikiMarkdown(md: string): { blocks: Block[]; title: string; meta: Record<string, string> } {
  const lines = md.trim().split('\n');
  const blocks: Block[] = [];
  const meta: Record<string, string> = {};
  let title = '';
  let i = 0;

  if (lines[0]?.startsWith('# ')) {
    title = lines[0].slice(2).trim();
    i = 1;
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim(), id: slugify(line.slice(3).trim()) });
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim(), id: slugify(line.slice(4).trim()) });
      i++;
      continue;
    }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }
    if (line.startsWith('**') && line.includes('：**')) {
      const m = line.match(/^\*\*([^*]+)：\*\*\s*(.*)$/);
      if (m) meta[m[1]] = m[2];
      i++;
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    blocks.push({ type: 'p', html: line });
    i++;
  }

  return { blocks, title, meta };
}

function ListBlock({ ordered, items }: { ordered: boolean; items: string[] }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <div className="rounded-xl border border-shell-border bg-shell-bg/60 px-4 py-3">
      <Tag className={`space-y-2 text-[14px] leading-7 text-shell-subtext ${ordered ? 'list-decimal pl-5' : 'list-disc pl-5'}`}>
        {items.map((item, j) => (
          <li key={j}>{inlineFormat(item)}</li>
        ))}
      </Tag>
    </div>
  );
}

export function WikiMarkdown({ md }: { md: string }) {
  const { blocks, title, meta } = parseWikiMarkdown(md);
  const sections = blocks.reduce<{ heading?: Block; content: Block[] }[]>((acc, block) => {
    if (block.type === 'h2') {
      acc.push({ heading: block, content: [] });
      return acc;
    }
    if (acc.length === 0) {
      acc.push({ content: [block] });
      return acc;
    }
    acc[acc.length - 1].content.push(block);
    return acc;
  }, []);

  return (
    <div>
      {title ? (
        <header className="mb-8">
          <h1 className="text-[26px] font-semibold tracking-tight text-shell-text md:text-[30px]">
            {title}
          </h1>
          {Object.keys(meta).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(meta).map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 rounded-full border border-shell-border bg-shell-bg px-3 py-1 text-[12px]"
                >
                  <span className="text-shell-muted">{k}</span>
                  <span className="font-medium text-shell-text">{v}</span>
                </span>
              ))}
            </div>
          )}
        </header>
      ) : null}

      <div className="space-y-6">
        {sections.map((section, sIdx) => (
          <section
            key={sIdx}
            className="rounded-2xl border border-shell-border bg-shell-panel p-5 shadow-sm md:p-6"
          >
            {section.heading && section.heading.type === 'h2' ? (
              <h2
                id={section.heading.id}
                className="scroll-mt-8 mb-4 flex items-center gap-2 text-[17px] font-semibold text-shell-text"
              >
                <span className="h-4 w-1 rounded-full bg-brand-primary" aria-hidden />
                {section.heading.text}
              </h2>
            ) : null}
            <div className="space-y-4">
              {section.content.map((block, idx) => {
                if (block.type === 'h3') {
                  return (
                    <h3
                      key={idx}
                      id={block.id}
                      className="scroll-mt-8 text-[15px] font-medium text-shell-text"
                    >
                      {block.text}
                    </h3>
                  );
                }
                if (block.type === 'p') {
                  return (
                    <p key={idx} className="text-[14px] leading-7 text-shell-subtext">
                      {inlineFormat(block.html)}
                    </p>
                  );
                }
                if (block.type === 'ul') {
                  return <ListBlock key={idx} ordered={false} items={block.items} />;
                }
                if (block.type === 'ol') {
                  return <ListBlock key={idx} ordered items={block.items} />;
                }
                return null;
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function extractHeadings(md: string) {
  const { blocks } = parseWikiMarkdown(md);
  return blocks.filter((b): b is Extract<Block, { type: 'h2' } | { type: 'h3' }> => b.type === 'h2' || b.type === 'h3');
}
