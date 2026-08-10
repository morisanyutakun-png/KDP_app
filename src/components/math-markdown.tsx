import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

const strayDisplayMarker = "\u0000STRAY_DISPLAY_MATH\u0000";
const mathTailCharacter = /[A-Za-z0-9\\{}\[\]^_=+\-*/().,:<>|\s]/;
const answerMarkerPrefix = "MKR_PREVIEW:";
const katexErrorColor = "#ff00fe";

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function nodeContainsKatexError(node: HastNode): boolean {
  if (node.properties && Object.values(node.properties).some((value) => String(value).toLowerCase().includes(katexErrorColor))) return true;
  return node.children?.some(nodeContainsKatexError) || false;
}

function rehypeSafeKatexErrors() {
  return (tree: HastNode) => {
    function replaceErrors(node: HastNode) {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        const classes = child.properties?.className;
        const classNames = Array.isArray(classes) ? classes.map(String) : typeof classes === "string" ? classes.split(/\s+/) : [];
        if (child.tagName === "span" && classNames.includes("katex") && nodeContainsKatexError(child)) {
          return {
            type: "element",
            tagName: "span",
            properties: { className: ["math-render-fallback"], role: "note", ariaLabel: "未対応の数式" },
            children: [{ type: "text", value: "数式を確認" }],
          };
        }
        replaceErrors(child);
        return child;
      });
    }
    replaceErrors(tree);
  };
}

function answerMarker(label: string) {
  const safeLabel = label.replace(/[`\\]/g, "").trim() || "　";
  return `\`${answerMarkerPrefix}${safeLabel}\``;
}

function looksLikeDisplayMath(value: string) {
  const expression = value.trim();
  if (!expression || expression.includes("$")) return false;
  const japaneseCharacters = expression.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length || 0;
  const hasMathSignal = /\\[A-Za-z]+|[=<>^_]|\d\s*[+\-*/]/.test(expression);
  return hasMathSignal && japaneseCharacters <= Math.max(6, Math.floor(expression.length * 0.3));
}

function repairStrayDisplayMarkers(value: string) {
  let source = value;
  let markerIndex = source.indexOf(strayDisplayMarker);

  while (markerIndex >= 0) {
    const before = source.slice(0, markerIndex);
    const after = source.slice(markerIndex + strayDisplayMarker.length);
    let expressionStart = before.length;
    while (expressionStart > 0 && before[expressionStart - 1] !== "\n" && mathTailCharacter.test(before[expressionStart - 1])) expressionStart -= 1;
    const precedingExpression = before.slice(expressionStart).trim();

    if (looksLikeDisplayMath(precedingExpression)) {
      source = `${before.slice(0, expressionStart).trimEnd()}\n\n$$\n${precedingExpression}\n$$\n\n${after.trimStart()}`;
    } else {
      let expressionEnd = 0;
      while (expressionEnd < after.length && after[expressionEnd] !== "\n" && mathTailCharacter.test(after[expressionEnd])) expressionEnd += 1;
      const followingExpression = after.slice(0, expressionEnd).trim();
      source = looksLikeDisplayMath(followingExpression)
        ? `${before.trimEnd()}\n\n$$\n${followingExpression}\n$$\n\n${after.slice(expressionEnd).trimStart()}`
        : `${before}${after}`;
    }
    markerIndex = source.indexOf(strayDisplayMarker);
  }
  return source;
}

function normalizeDisplayMath(value: string) {
  const markerPositions = [...value.matchAll(/\$\$/g)].map((match) => match.index);
  if (!markerPositions.length) return value;

  let normalized = "";
  let cursor = 0;
  let marker = 0;
  while (marker < markerPositions.length) {
    const opening = markerPositions[marker];
    const closing = markerPositions[marker + 1];
    const expression = closing === undefined ? "" : value.slice(opening + 2, closing);
    if (closing !== undefined && looksLikeDisplayMath(expression)) {
      normalized += `${value.slice(cursor, opening).trimEnd()}\n\n$$\n${expression.trim()}\n$$\n\n`;
      cursor = closing + 2;
      marker += 2;
    } else {
      normalized += `${value.slice(cursor, opening)}${strayDisplayMarker}`;
      cursor = opening + 2;
      marker += 1;
    }
  }
  normalized += value.slice(cursor);
  return repairStrayDisplayMarkers(normalized);
}

function normalizeLegacyCommands(value: string) {
  const chunks = value.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  return chunks.map((chunk, index) => {
    if (index % 2 === 1) return chunk;
    return chunk
      .replace(/\\setcounter\s*\{enumi\}\s*\{(\d+)\}\s*(?:1\.[ \t]*)?/g, (_, value: string) => `\n\n${Number(value) + 1}. `)
      .replace(/\\probpar\b/g, "\n\n")
      .replace(/\\mkc\s*\{([^{}\n]*)\}\s*\{([^{}\n]*)\}\s*\{([^{}\n]*)\}/g, (_, first: string, second: string, third: string) => answerMarker(`${first}${second}${third}`))
      .replace(/\\mkb\s*\{([^{}\n]*)\}\s*\{([^{}\n]*)\}/g, (_, first: string, second: string) => answerMarker(`${first}${second}`))
      .replace(/\\(?:mkr|mk|mkg|slot|blank|mke)\s*(?:\[[^\]\n]*\])?\s*\{([^{}\n]*)\}/g, (_, label: string) => answerMarker(label))
      .replace(/\\(?:mke|blank)\b/g, () => answerMarker(""))
      .replace(/\\keisan(?:\{[^{}]*\})?/g, "\n\n$\\keisan$\n\n")
      .replace(/\\(Pt|Vec)\s*\{([^{}\n]+)\}/g, (_, command: string, argument: string) => `$\\${command}{${argument}}$`)
      .replace(/\\vec\s+(?:\{[^{}\n]+\}|[A-Za-z])/g, (expression) => `$${expression}$`)
      .replace(/\\frac\s*\{([^{}\n]+)\}\s*\{([^{}\n]+)\}/g, (_, numerator: string, denominator: string) => `$\\frac{${numerator}}{${denominator}}$`)
      .replace(/\\sqrt\s*(\[[^\]\n]+\])?\s*\{([^{}\n]+)\}/g, (_, root: string | undefined, expression: string) => `$\\sqrt${root || ""}{${expression}}$`)
      .replace(/\\href\s*\{[^{}\n]*\}\s*\{([^{}\n]*)\}/g, "$1")
      .replace(/\\url\s*\{[^{}\n]*\}/g, "")
      .replace(/\\includegraphics(?:\[[^\]\n]*\])?\s*\{[^{}\n]*\}/g, "\n\n> 図版は元原稿を参照してください。\n\n")
      .replace(/\\(?:begin|end)\s*\{[^{}\n]*\}(?:\s*\[[^\]\n]*\])?/g, "\n")
      .replace(/\\item(?:\s*\[[^\]\n]*\])?/g, "\n\n1. ")
      .replace(/\\(?:textbf|textit|emph|underline|underLine|mathrm|textrm|text)\s*\{([^{}\n]*)\}/g, "$1")
      .replace(/\\(?:hspace|vspace)\*?(?:\s*\[[^\]\n]*\])?\s*\{[^{}\n]*\}/g, " ")
      .replace(/\\(?:noindent|par)\b/g, "\n\n")
      .replace(/\\(?:smallskip|medskip|bigskip|hfill|centering|raggedright|raggedleft|small|normalsize|large|Large|footnotesize)\b/g, " ")
      .replace(/\\(?:input|include|usepackage|documentclass|newcommand|renewcommand|providecommand|def|gdef|edef|xdef|write|write18|openout|read|catcode|csname)\b(?:\s*\[[^\]\n]*\])?(?:\s*\{[^{}\n]*\})*/g, "")
      .replace(/\\[A-Za-z@]+\*?(?:\s*\[[^\]\n]*\])?\s*\{([^{}\n]*)\}\s*\{([^{}\n]*)\}\s*\{([^{}\n]*)\}/g, "$1 $2 $3")
      .replace(/\\[A-Za-z@]+\*?(?:\s*\[[^\]\n]*\])?\s*\{([^{}\n]*)\}\s*\{([^{}\n]*)\}/g, "$1 $2")
      .replace(/\\[A-Za-z@]+\*?(?:\s*\[[^\]\n]*\])?\s*\{([^{}\n]*)\}/g, "$1")
      .replace(/\\[A-Za-z@]+\*?(?:\s*\[[^\]\n]*\])?/g, "")
      .replace(/\\\\(?:\[[^\]\n]*\])?/g, "\n")
      .replace(/\*{3,}(?=\s*[→←↔])/g, "");
  }).join("");
}

function normalizeImportedLists(value: string) {
  return value.split("\n").map((line) => {
    const markers = line.match(/(?:^|[ \t])1\.[ \t]+(?=\S)/g)?.length || 0;
    if (markers < 2) return line;
    return line.replace(/(?:^|[ \t]+)1\.[ \t]+(?=\S)/g, "\n\n1. ");
  }).join("\n");
}

export function normalizeMathMarkdownSource(value: string) {
  const normalizedDelimiters = value
    .replace(/\r\n?/g, "\n")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expression: string) => `\n\n$$\n${expression.trim()}\n$$\n\n`)
    .replace(/\\\(([^\n]*?)\\\)/g, (_, expression: string) => `$${expression}$`);
  return normalizeImportedLists(normalizeLegacyCommands(normalizeDisplayMath(normalizedDelimiters)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function MathMarkdown({ source, className = "" }: { source: string; className?: string }) {
  const normalizedSource = normalizeMathMarkdownSource(source);
  return (
    <div className={`math-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, {
          strict: false,
          errorColor: katexErrorColor,
          trust: false,
          maxExpand: 200,
          maxSize: 20,
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
            "\\mkr": "\\boxed{\\vphantom{\\Large A}\\kern0.35em\\text{#1}\\kern0.35em}",
            "\\mkrule": "\\mid",
            "\\keisan": "\\underbrace{\\hspace{8em}}_{\\text{計算欄}}",
            "\\gcdd": "\\operatorname{gcd}",
            "\\pl": "+",
            "\\leqq": "\\leqslant",
            "\\geqq": "\\geqslant",
            "\\fallingdotseq": "\\approx",
          },
        }], rehypeSafeKatexErrors]}
        components={{
          code({ className: codeClassName, children }) {
            const value = String(children).replace(/\n$/, "");
            const marker = !codeClassName ? value.match(new RegExp(`^${answerMarkerPrefix}([\\s\\S]*)$`)) : null;
            if (marker) return <span aria-label={`解答欄 ${marker[1]}`} className="math-answer-marker">{marker[1]}</span>;
            return <code className={codeClassName}>{children}</code>;
          },
          span({ className: spanClassName, children, node, ...props }) {
            if (spanClassName?.split(/\s+/).includes("katex-error")) {
              return <span aria-label="未対応の数式" className="math-render-fallback">数式を確認</span>;
            }
            void node;
            return <span className={spanClassName} {...props}>{children}</span>;
          },
        }}
        skipHtml
      >
        {normalizedSource}
      </ReactMarkdown>
    </div>
  );
}
