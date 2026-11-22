import { Fragment, type ReactNode } from "react";

// Tiny, safe markdown renderer for agent replies: **bold**, _italic_, `code`, lists, code blocks.
// Builds React elements (never raw HTML), so model output can't inject markup.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded bg-paper-2 px-1 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k} className="text-ink-2">{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: string[] = [];
  let code: string[] | null = null;

  const flushList = () => {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
        {items.map((it, i) => <li key={i}>{inline(it, `li-${blocks.length}-${i}`)}</li>)}
      </ul>,
    );
  };

  lines.forEach((line, idx) => {
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push(<pre key={`pre-${idx}`} className="my-2 overflow-x-auto rounded-lg bg-ink p-3 font-mono text-xs text-paper">{code.join("\n")}</pre>);
        code = null;
      } else {
        flushList();
        code = [];
      }
      return;
    }
    if (code) {
      code.push(line);
      return;
    }
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList();
    if (line.trim() === "") return;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(h ? <p key={`h-${idx}`} className="mt-2 font-semibold">{inline(h[1], `h-${idx}`)}</p> : <p key={`p-${idx}`} className="my-1">{inline(line, `p-${idx}`)}</p>);
  });
  flushList();
  if (code) blocks.push(<pre key="pre-end" className="my-2 overflow-x-auto rounded-lg bg-ink p-3 font-mono text-xs text-paper">{(code as string[]).join("\n")}</pre>);
  return <Fragment>{blocks}</Fragment>;
}
