import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export function MathMarkdown({ source, className = "" }: { source: string; className?: string }) {
  const normalizedSource = source
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expression: string) => `$$${expression}$$`)
    .replace(/\\\(([^\n]*?)\\\)/g, (_, expression: string) => `$${expression}$`);
  return (
    <div className={`math-content ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]} skipHtml>
        {normalizedSource}
      </ReactMarkdown>
    </div>
  );
}
