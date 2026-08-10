import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export function MathMarkdown({ source, className = "" }: { source: string; className?: string }) {
  const normalizedSource = source
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expression: string) => `$$${expression}$$`)
    .replace(/\\\(([^\n]*?)\\\)/g, (_, expression: string) => `$${expression}$`);
  return (
    <div className={`math-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, {
          strict: false,
          macros: {
            "\\Pt": "\\mathrm{#1}",
            "\\Vec": "\\overrightarrow{\\mathrm{#1}}",
            "\\dsp": "\\displaystyle",
            "\\Cb": "\\binom{#1}{#2}",
            "\\Hb": "\\binom{#1+#2-1}{#2}",
            "\\bxn": "\\boxed{#1}",
            "\\slot": "\\boxed{\\mathrm{#1}}",
            "\\blank": "\\boxed{\\phantom{000}}",
            "\\mk": "\\boxed{\\mathrm{#1}}",
            "\\mkg": "\\boxed{\\mathrm{#1}}",
            "\\mkb": "\\boxed{\\mathrm{#1#2}}",
            "\\mkc": "\\boxed{\\mathrm{#1#2#3}}",
            "\\mke": "\\boxed{\\phantom{0}}",
            "\\mkrule": "\\mid",
            "\\gcdd": "\\operatorname{gcd}",
            "\\pl": "+",
            "\\leqq": "\\leqslant",
            "\\geqq": "\\geqslant",
            "\\fallingdotseq": "\\approx",
          },
        }]]}
        skipHtml
      >
        {normalizedSource}
      </ReactMarkdown>
    </div>
  );
}
