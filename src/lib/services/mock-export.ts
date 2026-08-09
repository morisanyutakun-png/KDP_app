import type { getMockExam } from "@/lib/data/authoring";

export type ExportMode = "questions" | "answers" | "combined";
type MockData = NonNullable<Awaited<ReturnType<typeof getMockExam>>>;

function imageMarkdown(url: string | null) {
  return url ? `\n\n![問題図](${url})` : "";
}

function questionMarkdown(data: MockData) {
  return data.items.map(({ item, problem }) => problem
    ? `## 第${item.position}問\n\n${problem.statement}${imageMarkdown(problem.imageUrl)}`
    : `## 第${item.position}問\n\n_問題未配置_`).join("\n\n---\n\n");
}

function answerMarkdown(data: MockData) {
  return data.items.map(({ item, problem }) => problem
    ? `## 第${item.position}問 解答・解説\n\n### 解答\n\n${problem.answer || "_未入力_"}\n\n### 解説\n\n${problem.explanation || "_未入力_"}`
    : `## 第${item.position}問 解答・解説\n\n_問題未配置_`).join("\n\n---\n\n");
}

export function renderMockMarkdown(data: MockData, mode: ExportMode) {
  const header = `# ${data.exam.title}\n\n- 試験時間：${data.exam.durationMinutes}分\n- 科目：${data.subjectName || "未設定"}${data.exam.targetUniversity ? `\n- 想定大学：${data.exam.targetUniversity}` : ""}`;
  if (mode === "questions") return `${header}\n\n${questionMarkdown(data)}\n`;
  if (mode === "answers") return `${header}\n\n# 解答・解説\n\n${answerMarkdown(data)}\n`;
  return `${header}\n\n${questionMarkdown(data)}\n\n\\newpage\n\n# 解答・解説\n\n${answerMarkdown(data)}\n`;
}

function latexPlainText(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[\\%&#_{}~^]/g, (character) => ({
      "\\": "\\textbackslash{}",
      "%": "\\%",
      "&": "\\&",
      "#": "\\#",
      "_": "\\_",
      "{": "\\{",
      "}": "\\}",
      "~": "\\textasciitilde{}",
      "^": "\\textasciicircum{}",
    })[character] || character)
    .replace(/\n{2,}/g, "\n\\par\n")
    .replace(/\n/g, "\\\\\n");
}

function markdownTexToLatex(value: string) {
  const tokens = value.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g);
  return tokens.map((token) => {
    if (token.startsWith("$$") && token.endsWith("$$")) return `\\[${token.slice(2, -2)}\\]`;
    if ((token.startsWith("\\[") && token.endsWith("\\]")) || (token.startsWith("\\(") && token.endsWith("\\)")) || (token.startsWith("$") && token.endsWith("$"))) return token;
    return latexPlainText(token);
  }).join("");
}

function imageLatex(url: string | null) {
  return url ? `\n\\begin{center}\\fbox{\\parbox{0.9\\linewidth}{問題図: \\url{${url}}}}\\end{center}\n` : "";
}

function questionLatex(data: MockData) {
  return data.items.map(({ item, problem }) => `\\section*{第${item.position}問}\n${problem ? `${markdownTexToLatex(problem.statement)}${imageLatex(problem.imageUrl)}` : "問題未配置"}`).join("\n\n");
}

function answerLatex(data: MockData) {
  return data.items.map(({ item, problem }) => `\\section*{第${item.position}問 解答・解説}\n\\subsection*{解答}\n${problem ? markdownTexToLatex(problem.answer || "未入力") : "問題未配置"}\n\\subsection*{解説}\n${problem ? markdownTexToLatex(problem.explanation || "未入力") : "問題未配置"}`).join("\n\n");
}

export function renderMockLatex(data: MockData, mode: ExportMode) {
  const geometry = `${data.exam.paperSettings.paperSize.toLowerCase()}paper,margin=${data.exam.paperSettings.marginMm}mm`;
  const body = mode === "questions" ? questionLatex(data) : mode === "answers" ? answerLatex(data) : `${questionLatex(data)}\n\\clearpage\n\\part*{解答・解説}\n${answerLatex(data)}`;
  return `\\documentclass[11pt]{jsarticle}
\\usepackage{amsmath,amssymb}
\\usepackage[${geometry}]{geometry}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{multicol}
\\hypersetup{colorlinks=true,urlcolor=blue}
\\AtBeginDocument{\\fontsize{${data.exam.paperSettings.fontSize}pt}{${Math.round(data.exam.paperSettings.fontSize * 1.6)}pt}\\selectfont}
\\title{${latexPlainText(data.exam.title)}}
\\date{}
\\begin{document}
\\maketitle
\\begin{center}試験時間：${data.exam.durationMinutes}分\\end{center}
${data.exam.paperSettings.columns === 2 ? "\\begin{multicols}{2}" : ""}
${body}
${data.exam.paperSettings.columns === 2 ? "\\end{multicols}" : ""}
\\end{document}
`;
}
