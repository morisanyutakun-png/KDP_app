"use client";

import { useRef, useState } from "react";
import { MathMarkdown } from "@/components/math-markdown";

const snippets = [
  { label: "インライン数式", prefix: "$", suffix: "$", placeholder: "x" },
  { label: "別行数式", prefix: "\\[\n", suffix: "\n\\]", placeholder: "f(x)=x^2" },
  { label: "分数", prefix: "\\frac{", suffix: "}{b}", placeholder: "a" },
  { label: "平方根", prefix: "\\sqrt{", suffix: "}", placeholder: "x" },
  { label: "小問", prefix: "(1) ", suffix: "", placeholder: "" },
  { label: "場合分け", prefix: "\\begin{cases}\n", suffix: "\n\\end{cases}", placeholder: "x & (x \\ge 0)" },
] as const;

export function TexEditorField({
  name,
  label,
  description,
  defaultValue = "",
  placeholder,
  required = false,
  rows = 12,
}: {
  name: string;
  label: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertSnippet(snippet: (typeof snippets)[number]) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const center = selected || snippet.placeholder;
    const insertion = `${snippet.prefix}${center}${snippet.suffix}`;
    const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    setValue(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + snippet.prefix.length;
      textarea.setSelectionRange(selectionStart, selectionStart + center.length);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><label className="label" htmlFor={`editor-${name}`}>{label}{required && <span aria-hidden="true"> *</span>}</label>{description && <p className="text-xs leading-5 text-muted">{description}</p>}</div>
        <span className="text-xs tabular-nums text-muted">{value.length.toLocaleString("ja-JP")}文字</span>
      </div>
      <div className="mt-3 overflow-hidden rounded-md border border-line bg-white">
        <div className="flex flex-wrap gap-1 border-b border-line bg-surface px-2 py-2" aria-label={`${label}の入力補助`}>
          {snippets.map((snippet) => <button key={snippet.label} type="button" className="rounded-sm border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:border-slate-400" onClick={() => insertSnippet(snippet)}>{snippet.label}</button>)}
        </div>
        <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-line">
          <div className="min-w-0">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold text-muted lg:hidden">入力</div>
            <textarea
              ref={textareaRef}
              id={`editor-${name}`}
              name={name}
              required={required}
              rows={rows}
              value={value}
              spellCheck={false}
              placeholder={placeholder}
              onChange={(event) => setValue(event.target.value)}
              className="block w-full resize-y border-0 bg-white px-4 py-3 font-mono text-[14px] leading-7 text-ink outline-none focus:bg-slate-50/40"
            />
          </div>
          <div className="min-w-0 border-t border-line bg-white lg:border-t-0">
            <div className="border-b border-line bg-surface px-3 py-2 text-xs font-semibold text-muted">プレビュー</div>
            <div className="max-h-[560px] min-h-48 overflow-auto px-4 py-3">
              {value.trim() ? <MathMarkdown source={value} /> : <p className="text-sm text-muted">入力すると、ここに数式を含む紙面イメージが表示されます。</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
