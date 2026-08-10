import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

type Project = {
  code: string;
  directory: string;
  targetUniversity: string;
  subjectName?: string;
  subjectSlug?: string;
  durationMinutes?: number;
  volumeLabel?: string;
};

type SourceBlock = {
  label: string;
  raw: string;
  start: number;
};

type SolutionBlock = {
  heading: string;
  raw: string;
};

type ImportProblem = {
  code: string;
  title: string;
  field: string;
  subfield: string | null;
  difficulty: number;
  targetUniversity: string;
  estimatedMinutes: number;
  statement: string;
  answer: string;
  explanation: string;
  verificationStatus: "DRAFT";
  notes: string;
};

type ImportPayload = {
  subjectName: string;
  subjectSlug: string;
  mock: {
    title: string;
    targetUniversity: string;
    durationMinutes: number;
    questionCount: number;
  };
  problems: ImportProblem[];
};

type CommandMatch = {
  args: string[];
  start: number;
  end: number;
};

type StandaloneProject = {
  code: string;
  file: string;
  targetUniversity: string;
  subjectName: string;
  subjectSlug: string;
  durationMinutes: number;
  volumeLabel?: string;
  questionCommand: string;
  questionArgumentCount: number;
  solutionCommand: string;
  solutionArgumentCount: number;
  field?: string;
  mockCommand?: string;
  mockArgumentCount?: number;
};

const projects: Project[] = [
  { code: "HIT-R", directory: "一橋数学/一橋数学vol1", targetUniversity: "一橋大学" },
  { code: "MIE", directory: "三重大全学数学/三重大数学", targetUniversity: "三重大学" },
  { code: "KYU-R", directory: "九州大理系数学/九大数学vol1", targetUniversity: "九州大学（理系）" },
  { code: "KYO-B", directory: "京大文系数学/京大文系数学vol1", targetUniversity: "京都大学（文系）" },
  { code: "KYO-R", directory: "京大理系数学/京大数学vol1", targetUniversity: "京都大学（理系）" },
  { code: "KIT", directory: "京都工芸繊維大数学/京工繊数学vol1", targetUniversity: "京都工芸繊維大学" },
  { code: "AIZU", directory: "会津大学数学/会津大数学vol1", targetUniversity: "会津大学" },
  { code: "HOK-R", directory: "北大理系数学/北大数学vol1", targetUniversity: "北海道大学（理系）" },
  { code: "CHIBA", directory: "千葉大数学/千葉大数学vol1", targetUniversity: "千葉大学" },
  { code: "CIT", directory: "千葉工大ASA数学/千葉工大SA・A日程数学", targetUniversity: "千葉工業大学" },
  { code: "NAGOYA-R1", directory: "名大数学/数学", targetUniversity: "名古屋大学（理系）", volumeLabel: "Vol.1" },
  { code: "NAGOYA-R2", directory: "名大数学/数学ver2", targetUniversity: "名古屋大学（理系）", volumeLabel: "Vol.2" },
  { code: "NAGOYA-B", directory: "名大文系数学/名大文系数学vol1", targetUniversity: "名古屋大学（文系）" },
  { code: "NITECH", directory: "名工大数学/合格答案をつくる名工大数学", targetUniversity: "名古屋工業大学" },
  { code: "NCU-P", directory: "名市大中期数学/合格答案をつくる名市大薬学部中期数学2027", targetUniversity: "名古屋市立大学 薬学部（中期）" },
  { code: "SAITAMA", directory: "埼玉大数学/埼玉大数学vol1", targetUniversity: "埼玉大学" },
  { code: "OSAKA-R", directory: "大阪大学数学/阪大数学vol1", targetUniversity: "大阪大学（理系）" },
  { code: "OSAKA-B", directory: "大阪大文系数学/阪大文系数学vol1", targetUniversity: "大阪大学（文系）" },
  { code: "OIT", directory: "大阪工業A数学/大阪工業大学A日程数学2027", targetUniversity: "大阪工業大学 A日程" },
  { code: "GIFU-P", directory: "岐阜薬科大学/岐阜薬科大数学", targetUniversity: "岐阜薬科大学" },
  { code: "OKAYAMA-R", directory: "岡山大理系数学/岡山大数学vol1", targetUniversity: "岡山大学（理系）" },
  { code: "HIROSHIMA-R", directory: "広島大理系数学/広島大数学vol1", targetUniversity: "広島大学（理系）" },
  { code: "KEIO-ST", directory: "慶應理工数学/慶應理工数学vol1", targetUniversity: "慶應義塾大学 理工学部" },
  { code: "WASEDA-HS", directory: "早稲田数学選抜/早稲田人科数学vol1", targetUniversity: "早稲田大学 人間科学部" },
  { code: "WASEDA-ST", directory: "早稲田理工数学/早稲田理工数学vol1", targetUniversity: "早稲田大学 理工系" },
  { code: "ASAHIKAWA-M", directory: "旭川医科大学数学/旭川医大数学vol1", targetUniversity: "旭川医科大学" },
  { code: "TUS-S1", directory: "東京理科大理学第一数学/理科大理一数学vol1", targetUniversity: "東京理科大学 理学部第一部", durationMinutes: 180 },
  { code: "TMU-M", directory: "東京都立大学数理数学/都立大数理数学vol1", targetUniversity: "東京都立大学 数理科学科" },
  { code: "TMU-R", directory: "東京都立大理系数学/都立大数学vol1", targetUniversity: "東京都立大学（理系）" },
  { code: "TOHOKU-R", directory: "東北大学理系数学/東北大数学", targetUniversity: "東北大学（理系）" },
  { code: "TOKYO-B", directory: "東大文系数学/東大文系数学vol1", targetUniversity: "東京大学（文系）" },
  { code: "TOKYO-R", directory: "東大理系数学/東大数学vol1", targetUniversity: "東京大学（理系）" },
  { code: "TUAT", directory: "東京農工大/農工大数学vol1", targetUniversity: "東京農工大学" },
  { code: "SCIENCE-TOKYO", directory: "東工大数学/科学大数学", targetUniversity: "東京科学大学" },
  { code: "YNU-R", directory: "横国理系数学/横国数学vol1", targetUniversity: "横浜国立大学（理系）" },
  { code: "YCU-M", directory: "横浜市立医学数学/横市医数学vol1", targetUniversity: "横浜市立大学 医学部" },
  { code: "KUMAMOTO-M", directory: "熊本大医学数学/熊本大医学数学vol1", targetUniversity: "熊本大学 医学部" },
  { code: "KUMAMOTO-R", directory: "熊本大理系数学/熊大数学vol1", targetUniversity: "熊本大学（理系）" },
  { code: "KOBE-R", directory: "神戸大学数学/神戸大数学vol1", targetUniversity: "神戸大学（理系）" },
  { code: "KOBE-B", directory: "神戸大文系数学/合格答案をつくる神戸大文系数学", targetUniversity: "神戸大学（文系）" },
  { code: "FUKUSHIMA-M", directory: "福島県立医科大/福島県立医大数学vol1", targetUniversity: "福島県立医科大学" },
  { code: "TSUKUBA", directory: "筑波大数学/筑波大数学vol1", targetUniversity: "筑波大学" },
  { code: "UEC", directory: "電通大数学/電通大数学vol1", targetUniversity: "電気通信大学" },
  { code: "SHIZUOKA-R", directory: "静大理系数学前期/静大数学vol1", targetUniversity: "静岡大学（理系・前期）" },
];

const standaloneProjects: StandaloneProject[] = [
  {
    code: "NAGOYA-E1",
    file: "慶應法学部英語/名大英語/nagoya_english_mock_sets.tex",
    targetUniversity: "名古屋大学",
    subjectName: "英語",
    subjectSlug: "english",
    durationMinutes: 105,
    volumeLabel: "Vol.1",
    questionCommand: "prob",
    questionArgumentCount: 2,
    solutionCommand: "hdA",
    solutionArgumentCount: 1,
    field: "大学入試英語",
  },
  {
    code: "NAGOYA-E2",
    file: "慶應法学部英語/名大英語/nagoya_english_mock_sets_vol2.tex",
    targetUniversity: "名古屋大学",
    subjectName: "英語",
    subjectSlug: "english",
    durationMinutes: 105,
    volumeLabel: "Vol.2",
    questionCommand: "prob",
    questionArgumentCount: 2,
    solutionCommand: "hdA",
    solutionArgumentCount: 1,
    field: "大学入試英語",
  },
  {
    code: "NAGOYA-P",
    file: "名大過去問/nagoya_physics_mock_sets.tex",
    targetUniversity: "名古屋大学",
    subjectName: "物理",
    subjectSlug: "physics",
    durationMinutes: 75,
    questionCommand: "prob",
    questionArgumentCount: 2,
    solutionCommand: "sol",
    solutionArgumentCount: 2,
  },
  {
    code: "NITECH-P",
    file: "名工大物理/nitech_physics_mock_sets.tex",
    targetUniversity: "名古屋工業大学",
    subjectName: "物理",
    subjectSlug: "physics",
    durationMinutes: 100,
    questionCommand: "prob",
    questionArgumentCount: 2,
    solutionCommand: "sol",
    solutionArgumentCount: 2,
  },
  {
    code: "TUS-P",
    file: "東京理科大物理/rikadai_physics_mock_sets_B5KDP.tex",
    targetUniversity: "東京理科大学",
    subjectName: "物理",
    subjectSlug: "physics",
    durationMinutes: 80,
    questionCommand: "daimon",
    questionArgumentCount: 1,
    solutionCommand: "sol",
    solutionArgumentCount: 2,
  },
  {
    code: "SCIENCE-TOKYO-P",
    file: "東京理科大物理/kagaku_physics_mock_sets.tex",
    targetUniversity: "東京科学大学",
    subjectName: "物理",
    subjectSlug: "physics",
    durationMinutes: 120,
    questionCommand: "daimonT",
    questionArgumentCount: 1,
    solutionCommand: "solT",
    solutionArgumentCount: 3,
  },
  {
    code: "KOBE-P",
    file: "東京理科大物理/kobe_physics_mock_sets.tex",
    targetUniversity: "神戸大学",
    subjectName: "物理",
    subjectSlug: "physics",
    durationMinutes: 60,
    questionCommand: "daimonK",
    questionArgumentCount: 1,
    solutionCommand: "solK",
    solutionArgumentCount: 3,
  },
  {
    code: "DOSHISHA-P",
    file: "東京理科大物理/doshisha_physics_mock_sets_B5KDP.tex",
    targetUniversity: "同志社大学",
    subjectName: "物理",
    subjectSlug: "physics",
    durationMinutes: 75,
    questionCommand: "daimonR",
    questionArgumentCount: 1,
    solutionCommand: "sol",
    solutionArgumentCount: 2,
  },
  {
    code: "COMMON-P",
    file: "共通テスト過去問/kyotsu_butsuri_mock.tex",
    targetUniversity: "大学入学共通テスト",
    subjectName: "物理",
    subjectSlug: "physics",
    durationMinutes: 60,
    questionCommand: "daimon",
    questionArgumentCount: 2,
    solutionCommand: "soldai",
    solutionArgumentCount: 2,
    mockCommand: "settitle",
    mockArgumentCount: 2,
  },
];

const informationTitles = [
  ["小問集合（4領域横断）", "情報の符号化とデータ表現", "あみだくじのシミュレーション", "文化祭模擬店のデータ分析"],
  ["小問集合（4領域横断）", "二次元コードとデータ表現", "しりとりのシミュレーション", "学校図書館のデータ分析"],
  ["小問集合（4領域横断）", "画像表現と在庫データ", "エレベーターのシミュレーション", "生活習慣と小テストのデータ分析"],
  ["小問集合（4領域横断）", "IoTセンサーと座席予約データ", "自動販売機のつり銭計算", "通学・睡眠・歩数のデータ分析"],
  ["小問集合（4領域横断）", "動画配信とアンケートデータ", "グリッド上のロボット", "文化祭模擬店のデータ分析"],
];

const civicsTitles = [
  ["主権者になるということ", "食と農をめぐる選択", "選挙と代表", "財政と金融", "人口減少社会と暮らし", "開かれた国際秩序と地球環境"],
  ["幸福・正義・公正", "情報社会に生きる", "憲法と人権保障", "市場のはたらきと限界", "働くことと生活", "平和と安全保障"],
  ["青年期と職業", "多文化共生と外国人材", "内閣・行政と官僚制", "景気変動と経済成長", "社会保障と子育て", "国際経済と日本"],
  ["環境と世代間の倫理", "地域社会と防災", "司法制度と刑事手続", "企業と金融資本市場", "資源とエネルギー", "国連と国際法の実効性"],
  ["ケアと共生", "消費者と契約", "平和主義と統治機構", "租税と財政の持続可能性", "都市・国土・人口移動", "グローバル化と日本の対外経済関係"],
];

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function naturalFileSort(a: string, b: string) {
  return a.localeCompare(b, "ja", { numeric: true });
}

function balancedArgument(source: string, openBrace: number) {
  if (source[openBrace] !== "{") return null;
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return { value: source.slice(openBrace + 1, index), end: index + 1 };
      }
    }
  }
  return null;
}

function commandArguments(source: string, command: string) {
  const output: Array<{ value: string; start: number; end: number }> = [];
  let cursor = 0;
  const needle = `\\${command}`;
  while (cursor < source.length) {
    const start = source.indexOf(needle, cursor);
    if (start < 0) break;
    let brace = start + needle.length;
    while (/\s/.test(source[brace] || "")) brace += 1;
    const argument = balancedArgument(source, brace);
    if (argument) output.push({ value: argument.value, start, end: argument.end });
    cursor = argument?.end || start + needle.length;
  }
  return output;
}

function commandMatches(source: string, command: string, argumentCount: number): CommandMatch[] {
  const output: CommandMatch[] = [];
  const needle = `\\${command}`;
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(needle, cursor);
    if (start < 0) break;
    const following = source[start + needle.length] || "";
    if (/[A-Za-z]/.test(following)) {
      cursor = start + needle.length;
      continue;
    }
    let argumentStart = start + needle.length;
    const args: string[] = [];
    let end = argumentStart;
    for (let index = 0; index < argumentCount; index += 1) {
      while (/\s/.test(source[argumentStart] || "")) argumentStart += 1;
      const argument = balancedArgument(source, argumentStart);
      if (!argument) break;
      args.push(argument.value);
      end = argument.end;
      argumentStart = argument.end;
    }
    if (args.length === argumentCount) output.push({ args, start, end });
    cursor = end > start ? end : start + needle.length;
  }
  return output;
}

function splitAtCommand(source: string, command: string, argumentCount: number) {
  const matches = commandMatches(source, command, argumentCount);
  return matches.map((match, index) => ({
    args: match.args,
    raw: source.slice(match.end, matches[index + 1]?.start || source.length),
    start: match.start,
  }));
}

function replaceBalancedCommand(source: string, command: string, replacement: (value: string) => string) {
  const matches = commandArguments(source, command).reverse();
  let output = source;
  for (const match of matches) {
    output = `${output.slice(0, match.start)}${replacement(match.value)}${output.slice(match.end)}`;
  }
  return output;
}

function replaceTwoArgumentCommand(source: string, command: string, replacement: (first: string, second: string) => string) {
  const needle = `\\${command}`;
  let cursor = 0;
  let output = "";
  while (cursor < source.length) {
    const start = source.indexOf(needle, cursor);
    if (start < 0) return output + source.slice(cursor);
    let firstBrace = start + needle.length;
    while (/\s/.test(source[firstBrace] || "")) firstBrace += 1;
    const first = balancedArgument(source, firstBrace);
    if (!first) {
      output += source.slice(cursor, start + needle.length);
      cursor = start + needle.length;
      continue;
    }
    let secondBrace = first.end;
    while (/\s/.test(source[secondBrace] || "")) secondBrace += 1;
    const second = balancedArgument(source, secondBrace);
    if (!second) {
      output += source.slice(cursor, first.end);
      cursor = first.end;
      continue;
    }
    output += source.slice(cursor, start) + replacement(first.value, second.value);
    cursor = second.end;
  }
  return output;
}

function stripComments(source: string) {
  return source.split("\n").map((line) => {
    let slashCount = 0;
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] !== "%") continue;
      slashCount = 0;
      for (let back = index - 1; back >= 0 && line[back] === "\\"; back -= 1) slashCount += 1;
      if (slashCount % 2 === 0) return line.slice(0, index);
    }
    return line;
  }).join("\n");
}

function removeEnvironment(source: string, name: string, replacement = "") {
  const pattern = new RegExp(`\\\\begin\\{${name}\\}[\\s\\S]*?\\\\end\\{${name}\\}`, "g");
  return source.replace(pattern, replacement);
}

function texToMarkdown(input: string) {
  let source = stripComments(input);
  const hasFigure = /\\(?:begin\{(?:tikzpicture|axis|circuitikz|pgfpicture|tabularx?|longtable|Zu|Shiryo)|includegraphics\b|TikZ|zu\b|img\b)/i.test(source);
  source = removeEnvironment(source, "tikzpicture", "\n\n> 図は元原稿を参照してください。\n\n");
  source = removeEnvironment(source, "axis", "\n\n> 図は元原稿を参照してください。\n\n");
  source = removeEnvironment(source, "circuitikz", "\n\n> 回路図は元原稿を参照してください。\n\n");
  source = removeEnvironment(source, "pgfpicture", "\n\n> 図は元原稿を参照してください。\n\n");
  source = removeEnvironment(source, "tabular", "\n\n> 表は元原稿を参照してください。\n\n");
  source = removeEnvironment(source, "tabularx", "\n\n> 表は元原稿を参照してください。\n\n");
  source = removeEnvironment(source, "longtable", "\n\n> 表は元原稿を参照してください。\n\n");
  source = removeEnvironment(source, "array", "\n\n> 数式表は元原稿を参照してください。\n\n");
  source = replaceTwoArgumentCommand(source, "cond", (label, value) => `\n\n**${label}**\n\n${value}\n\n`);
  source = replaceTwoArgumentCommand(source, "spk", (speaker, words) => `\n\n**${speaker}：** ${words}\n\n`);
  source = replaceTwoArgumentCommand(source, "hanasu", (speaker, words) => `\n\n**${speaker}：** ${words}\n\n`);
  source = replaceTwoArgumentCommand(source, "toi", (number, value) => `\n\n**問${number}** ${value}\n\n`);
  source = replaceTwoArgumentCommand(source, "mondai", (number, value) => `\n\n**問${number}** ${value}\n\n`);
  source = replaceTwoArgumentCommand(source, "Chumon", (label, value) => `\n\n**${label}** ${value}\n\n`);
  source = replaceTwoArgumentCommand(source, "Part", (label, value) => `\n\n**${label}** ${value}\n\n`);
  source = source.replace(/\\blank\[[^\]]*\]\{/g, "\\blank{");

  for (const command of ["textbf", "underLine", "proclaim", "gothicfont"]) {
    source = replaceBalancedCommand(source, command, (value) => `**${value}**`);
  }
  source = replaceBalancedCommand(source, "emph", (value) => `*${value}*`);
  source = replaceBalancedCommand(source, "hs", (value) => `\n\n**${value}** `);
  source = replaceBalancedCommand(source, "hsn", (value) => `\n\n**${value}** `);
  source = replaceBalancedCommand(source, "figcap", (value) => `\n\n_${value}_\n\n`);
  source = replaceBalancedCommand(source, "mkframe", (value) => `【${value}】`);
  source = replaceBalancedCommand(source, "mkcell", (value) => value || "□");
  source = replaceBalancedCommand(source, "Ans", (value) => `\n\n**答：** $${value}$$\n\n`);
  source = replaceBalancedCommand(source, "ans", (value) => `\n\n**答：** $${value}$$\n\n`);
  source = replaceBalancedCommand(source, "stage", (value) => `\n\n${value}\n\n`);
  source = replaceBalancedCommand(source, "shiji", (value) => `（配点 ${value}）`);
  source = replaceBalancedCommand(source, "hako", (value) => `【${value || "　"}】`);
  source = replaceBalancedCommand(source, "mr", (value) => `〔${value}〕`);
  source = replaceBalancedCommand(source, "chu", (value) => `（注：${value}）`);
  source = replaceBalancedCommand(source, "Chu", (value) => `（注：${value}）`);
  source = replaceBalancedCommand(source, "Hyodai", (value) => `\n\n**${value}**\n\n`);
  source = replaceBalancedCommand(source, "Q", (value) => `\n\n**問${value}** `);
  source = replaceBalancedCommand(source, "toi", (value) => `\n\n**問${value}** `);
  source = replaceBalancedCommand(source, "bun", (value) => `\n\n**${value}** `);
  source = replaceBalancedCommand(source, "ansT", (value) => value);
  source = replaceBalancedCommand(source, "spk", (value) => `\n\n**${value}：** `);

  source = source
    .replace(/\\begin\{(?:shomonL?|examq|itemize|enumerate|passage|Kaiwa|Shiryo|Zu|Handan|choices|multicols)\}(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, "\n")
    .replace(/\\end\{(?:shomonL?|examq|itemize|enumerate|passage|Kaiwa|Shiryo|Zu|Handan|choices|multicols)\}/g, "\n")
    .replace(/\\item(?:\[[^\]]*\])?/g, "\n\n1. ")
    .replace(/\\subq\{([^{}]+)\}/g, "\n\n**($1)** ")
    .replace(/\\Q\{([^{}]+)\}\{[^{}]*\}/g, "\n\n**($1)** ")
    .replace(/\\begin\{betsu\}(?:\[[^\]]*\])?/g, "\n\n**別解**\n\n")
    .replace(/\\end\{betsu\}/g, "\n")
    .replace(/\\begin\{(?:center|minipage|hdfig)\}(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, "\n")
    .replace(/\\end\{(?:center|minipage|hdfig)\}/g, "\n")
    .replace(/\\(?:noindent|smallskip|medskip|bigskip|par|hfill|centering|clearpage|newpage|small|normalsize|footnotesize|large|Large|bfseries|itshape|gothicfont|setsumon|Kangae|Gokai|Chakugan)\b(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, "")
    .replace(/\\(?:vspace|vspace\*|hspace|hspace\*)\{[^{}]*\}/g, "")
    .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^{}]*\}/g, "\n\n> 画像は元原稿を参照してください。\n\n")
    .replace(/\\mke\b/g, "解答欄")
    .replace(/\\mkrule\b/g, "｜")
    .replace(/\\(?:haiten|hdTag|markinst|kijuinst|keisanran|marknote|kubunhyo)\b(?:\{[^{}]*\})*/g, "")
    .replace(/\\(?:blacksquare|square|qed)\b/g, "")
    .replace(/\\\\(?:\[[^\]]*\])?/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { markdown: source, hasFigure };
}

function plainText(input: string) {
  let source = input;
  source = replaceTwoArgumentCommand(source, "dfrac", (first, second) => `${first}/${second}`);
  source = replaceTwoArgumentCommand(source, "frac", (first, second) => `${first}/${second}`);
  for (const command of ["textbf", "underLine", "mathrm", "textrm", "text", "probref"]) {
    source = replaceBalancedCommand(source, command, (value) => value);
  }
  return source
    .replace(/\$+/g, "")
    .replace(/\\(?:quad|qquad|hspace|hspace\*)\{?[^}\s]*\}?/g, " ")
    .replace(/\\[A-Za-z]+/g, "")
    .replace(/\^\{([^{}]+)\}/g, "^$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHeading(heading: string, fallback: string) {
  const clean = plainText(heading)
    .replace(/^解説\s*[IVXⅠⅡⅢⅣⅤⅥ0-9]+\s*(?:─+|—+|・|:|：)?\s*/i, "")
    .replace(/^(?:大問|第|問|〔)\s*[0-9IVXivx０-９-]+\s*(?:問|〕)?\s*[（(][^）)]*[）)]\s*(?:─+|—+|・|:|：)?\s*/, "")
    .replace(/^(?:大問|第|問|〔)\s*[0-9IVXivx０-９-]+\s*(?:問|〕)?\s*(?:─+|—+|・|:|：)?\s*/, "")
    .replace(/^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\s*/, "")
    .trim();
  return clean || fallback;
}

function classifyPhysicsField(title: string, statement: string) {
  if (/小問集合/.test(title) || /(?:^|\s)[AＡ].*[／/].*[BＢ]/.test(title)) return "物理総合";
  const rules: Array<[RegExp, string]> = [
    [/原子|量子|光電効果|物質波|X線|放射|半減期/, "原子"],
    [/電場|磁場|電流|電圧|回路|コンデンサー|コイル|電磁|誘導|導体|荷電|クーロン|ホール効果/, "電磁気"],
    [/熱|気体|ピストン|圧力|温度|断熱|熱力学|サイクル/, "熱力学"],
    [/波|音|光|干渉|回折|屈折|反射|ドップラー|共鳴|うなり|スリット|プリズム/, "波動"],
    [/運動|力学|ばね|衝突|摩擦|円運動|重力|振動|レール|投射|モーメント/, "力学"],
  ];
  return rules.find(([pattern]) => pattern.test(title))?.[1]
    || rules.find(([pattern]) => pattern.test(statement))?.[1]
    || "物理総合";
}

function classifyField(title: string, statement: string) {
  const rules: Array<[RegExp, string]> = [
    [/小問集合|空所補充|独立小問/, "小問集合"],
    [/確率|期待値|さいころ|カード|ランダム|組合せ|場合の数|トーナメント/, "確率・場合の数"],
    [/複素数|ド・モアブル|虚数|極形式/, "複素数平面"],
    [/数列|漸化式|級数|帰納法|群数列/, "数列"],
    [/整数|素数|約数|倍数|合同|割り切|不定方程式|階乗/, "整数"],
    [/ベクトル|\\Vec|空間図形|空間内|四面体|平面への/, "ベクトル・空間図形"],
    [/微分|積分|極値|増減|面積|体積|接線|曲線|回転体/, "微分積分"],
    [/三角関数|sin|cos|tan|正弦|余弦/, "三角関数"],
    [/指数|対数|log/, "指数・対数"],
    [/図形|三角形|円|楕円|放物線|軌跡|幾何/, "図形と方程式"],
    [/統計|標準偏差|平均値|データ/, "統計"],
  ];
  return rules.find(([pattern]) => pattern.test(title))?.[1]
    || rules.find(([pattern]) => pattern.test(statement))?.[1]
    || "未分類";
}

function extractQuestionBlocks(source: string) {
  const blocks: SourceBlock[] = [];
  const environmentPattern = /\\begin\{(daimon\*?|daimonL|kdaimon|gifuquestion|kobeproblem)\}(?:\[[^\]]*\])?/g;
  for (const match of source.matchAll(environmentPattern)) {
    const start = match.index || 0;
    const environment = match[1];
    let cursor = start + match[0].length;
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    const first = balancedArgument(source, cursor);
    if (!first) continue;
    cursor = first.end;
    if (environment === "kdaimon") {
      while (/\s/.test(source[cursor] || "")) cursor += 1;
      const second = balancedArgument(source, cursor);
      if (second) cursor = second.end;
    }
    const endMarker = `\\end{${environment}}`;
    const end = source.indexOf(endMarker, cursor);
    if (end < 0) continue;
    blocks.push({ label: plainText(first.value), raw: source.slice(cursor, end), start });
  }

  const examStart = source.indexOf("\\begin{examquestions}");
  const examEnd = source.indexOf("\\end{examquestions}", examStart + 1);
  if (examStart >= 0 && examEnd > examStart) {
    const body = source.slice(examStart, examEnd);
    const markers = commandArguments(body, "examproblem");
    for (let index = 0; index < markers.length; index += 1) {
      const marker = markers[index];
      const next = markers[index + 1];
      blocks.push({
        label: plainText(marker.value),
        raw: body.slice(marker.end, next?.start || body.length),
        start: examStart + marker.start,
      });
    }
  }

  const pagePattern = /\\begin\{(firstqpage|qpage)\}/g;
  for (const match of source.matchAll(pagePattern)) {
    const start = match.index || 0;
    let cursor = start + match[0].length;
    const args: string[] = [];
    while (args.length < (match[1] === "firstqpage" ? 4 : 4)) {
      while (/\s/.test(source[cursor] || "")) cursor += 1;
      const argument = balancedArgument(source, cursor);
      if (!argument) break;
      args.push(argument.value);
      cursor = argument.end;
    }
    const endMarker = `\\end{${match[1]}}`;
    const end = source.indexOf(endMarker, cursor);
    if (end < 0) continue;
    const label = match[1] === "firstqpage" ? args[1] || args[0] : args[0];
    blocks.push({ label: plainText(label), raw: source.slice(cursor, end), start });
  }

  return blocks.sort((a, b) => a.start - b.start);
}

function solutionHeadings(source: string) {
  const headings = [
    ...commandArguments(source, "hdA").map((value) => ({ ...value, heading: value.value })),
  ];
  const hdfigNeedle = "\\begin{hdfig}";
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(hdfigNeedle, cursor);
    if (start < 0) break;
    const brace = source.indexOf("{", start + hdfigNeedle.length);
    const argument = balancedArgument(source, brace);
    if (argument) headings.push({ ...argument, start, heading: argument.value });
    cursor = argument?.end || start + hdfigNeedle.length;
  }
  return headings.sort((a, b) => a.start - b.start);
}

function extractSolutionBlocks(source: string): SolutionBlock[] {
  const headings = solutionHeadings(source);
  return headings.map((heading, index) => ({
    heading: heading.heading,
    raw: source.slice(heading.end, headings[index + 1]?.start || source.length),
  }));
}

function answerSummary(raw: string) {
  const answers = [...commandArguments(raw, "Ans"), ...commandArguments(raw, "ans")]
    .sort((a, b) => a.start - b.start)
    .map(({ value }) => `$${value}$`);
  return answers.join("\n\n");
}

function extractDuration(...sources: string[]) {
  for (const source of sources) {
    const match = source.match(/試験時間(?:は|：|:)?[^0-9]{0,15}([0-9]{2,3})\s*分/);
    if (match) return Number(match[1]);
  }
  return null;
}

function mockRound(_source: string, fallback: number) {
  // setN_q.tex の N が原稿上の回番号。タイトル中には「令和9年度」など別の数字もあるため、
  // 表示文字列から推測せずファイル名を正とする。
  return fallback;
}

function mockTitle(project: Project, round: number) {
  const volume = project.volumeLabel ? ` ${project.volumeLabel}` : "";
  return `${project.targetUniversity} 数学予想模試${volume} 第${round}回`;
}

async function projectPayloads(sourceRoot: string, project: Project): Promise<ImportPayload[]> {
  const directory = path.join(sourceRoot, project.directory);
  await access(directory, constants.R_OK);
  const filenames = (await readdir(directory)).sort(naturalFileSort);
  const questionFiles = filenames.filter((name) => /^set\d+_q\.tex$/.test(name));
  const front = await readFile(path.join(directory, "front.tex"), "utf8").catch(() => "");
  const main = await readFile(path.join(directory, "main.tex"), "utf8").catch(() => "");
  const extractedDuration = extractDuration(front, main);
  const durationMinutes = project.durationMinutes || extractedDuration || 120;
  const payloads: ImportPayload[] = [];

  for (let fileIndex = 0; fileIndex < questionFiles.length; fileIndex += 1) {
    const questionFilename = questionFiles[fileIndex];
    const questionSource = await readFile(path.join(directory, questionFilename), "utf8");
    const setNumber = Number(questionFilename.match(/^set(\d+)_q\.tex$/)?.[1] || fileIndex + 1);
    const round = mockRound(questionSource, setNumber);
    const questionBlocks = extractQuestionBlocks(questionSource);
    if (!questionBlocks.length && /準備中/.test(questionSource)) {
      console.log(`${project.code.padEnd(15)} 第${setNumber}回は準備中のためスキップ`);
      continue;
    }
    const answerFiles = filenames.filter((name) => new RegExp(`^set${setNumber}_a[^.]*\\.tex$`).test(name));
    const answerSource = (await Promise.all(answerFiles.map((name) => readFile(path.join(directory, name), "utf8")))).join("\n\n");
    const solutionBlocks = extractSolutionBlocks(answerSource);
    const solutionsArePending = solutionBlocks.length === 0 && /準備中/.test(answerSource);
    if (!questionBlocks.length) {
      throw new Error(`${project.code} set${setNumber}: 問題ブロックを認識できません。`);
    }
    if (solutionBlocks.length !== questionBlocks.length && !solutionsArePending) {
      throw new Error(`${project.code} set${setNumber}: 問題${questionBlocks.length}件に対して解答見出し${solutionBlocks.length}件です。`);
    }

    const estimatedMinutes = Math.max(5, Math.round(durationMinutes / questionBlocks.length));
    const problems: ImportProblem[] = questionBlocks.map((question, problemIndex) => {
      const solution = solutionBlocks[problemIndex];
      const fallbackTitle = `第${question.label || problemIndex + 1}問`;
      const title = solution ? titleFromHeading(solution.heading, fallbackTitle) : fallbackTitle;
      const statement = texToMarkdown(question.raw);
      const explanation = solution ? texToMarkdown(solution.raw) : { markdown: "", hasFigure: false };
      const sourceHash = sha256(`${question.raw}\n---SOLUTION---\n${solution?.raw || "PENDING"}`);
      const sourceLabel = `${project.targetUniversity}${project.volumeLabel ? ` ${project.volumeLabel}` : ""} / 第${round}回 / ${fallbackTitle}`;
      const figureNote = statement.hasFigure || explanation.hasFigure ? "\n図表を含むため、元原稿との照合が必要です。" : "";
      const pendingNote = solution ? "" : "\n解答原稿は準備中のため、問題本文のみDRAFT登録しています。";
      return {
        code: `IMP-${project.code}-S${String(setNumber).padStart(2, "0")}-Q${String(problemIndex + 1).padStart(2, "0")}`,
        title,
        field: classifyField(title, question.raw),
        subfield: title,
        difficulty: 3,
        targetUniversity: project.targetUniversity,
        estimatedMinutes,
        statement: statement.markdown,
        answer: solution ? answerSummary(solution.raw) : "",
        explanation: explanation.markdown,
        verificationStatus: "DRAFT",
        notes: `原稿から読み取り登録。出典: ${sourceLabel}\n原稿照合用ハッシュ: ${sourceHash}\n難易度3・想定時間${estimatedMinutes}分は仮設定です。${figureNote}${pendingNote}`,
      };
    });

    payloads.push({
      subjectName: project.subjectName || "数学",
      subjectSlug: project.subjectSlug || "mathematics",
      mock: {
        title: mockTitle(project, round),
        targetUniversity: project.targetUniversity,
        durationMinutes,
        questionCount: problems.length,
      },
      problems,
    });
  }
  return payloads;
}

function commentHeadingBlocks(source: string, count: number): SolutionBlock[] {
  const markers = [...source.matchAll(/^%[^\n]*第([1-9])問の解説[^\n]*$/gm)]
    .filter((match) => Number(match[1]) <= count)
    .sort((a, b) => (a.index || 0) - (b.index || 0));
  return markers.map((marker, index) => ({
    heading: `第${marker[1]}問`,
    raw: source.slice((marker.index || 0) + marker[0].length, markers[index + 1]?.index || source.length),
  }));
}

function commonTestSolutionBlocks(source: string, count: number) {
  const commandBlocks = splitAtCommand(source, "KDaimon", 2)
    .filter((block) => Number(plainText(block.args[0])) >= 1 && Number(plainText(block.args[0])) <= count)
    .map((block) => ({ heading: block.args[1], raw: block.raw }));
  return commandBlocks.length === count ? commandBlocks : commentHeadingBlocks(source, count);
}

function commonTestField(subjectSlug: string, index: number) {
  if (subjectSlug === "information-i") {
    return ["情報社会・情報デザイン", "情報のデジタル化", "プログラミング", "データの活用"][index] || "情報I";
  }
  return index < 2 ? "公共" : index < 5 ? "政治・経済" : "国際政治・経済";
}

async function commonTestPayloads(sourceRoot: string, kind: "information" | "civics"): Promise<ImportPayload[]> {
  const information = kind === "information";
  const baseDirectory = information ? "情報I共通テスト/book" : "政経共通テスト模試/book";
  const code = information ? "INFO-I" : "CIVICS";
  const subjectName = information ? "情報I" : "公共・政治経済";
  const subjectSlug = information ? "information-i" : "public-politics-economics";
  const questionCount = information ? 4 : 6;
  const titles = information ? informationTitles : civicsTitles;
  const payloads: ImportPayload[] = [];

  for (let round = 1; round <= 5; round += 1) {
    const directoryName = information && round === 1 ? "yosou" : `yosou${round}`;
    const directory = path.join(sourceRoot, baseDirectory, directoryName);
    await access(directory, constants.R_OK);
    const questionSources = await Promise.all(Array.from({ length: questionCount }, async (_, index) => {
      const filename = `dai${index + 1}.tex`;
      return { filename, raw: await readFile(path.join(directory, filename), "utf8") };
    }));
    const solutionSource = await readFile(path.join(directory, "kaisetsu.tex"), "utf8");
    const solutionBlocks = commonTestSolutionBlocks(solutionSource, questionCount);
    if (solutionBlocks.length !== questionCount) {
      throw new Error(`${code} 第${round}回: 問題${questionCount}件に対して解答区分${solutionBlocks.length}件です。`);
    }
    const estimatedMinutes = Math.round(60 / questionCount);
    const problems = questionSources.map((question, index) => {
      const daimons = commandMatches(question.raw, "Daimon", 3);
      if (daimons.length !== 1) throw new Error(`${code} 第${round}回 第${index + 1}問: Daimonを一つに特定できません。`);
      const statementRaw = question.raw.slice(daimons[0].end);
      const statement = texToMarkdown(`${daimons[0].args[1]}\n\n${statementRaw}`);
      const solution = solutionBlocks[index];
      const explanation = texToMarkdown(solution.raw);
      const title = titles[round - 1][index];
      const sourceHash = sha256(`${question.raw}\n---SOLUTION---\n${solution.raw}`);
      const figureNote = statement.hasFigure || explanation.hasFigure ? "\n図表を含むため、元原稿との照合が必要です。" : "";
      return {
        code: `IMP-${code}-S${String(round).padStart(2, "0")}-Q${String(index + 1).padStart(2, "0")}`,
        title,
        field: commonTestField(subjectSlug, index),
        subfield: title,
        difficulty: 3,
        targetUniversity: "大学入学共通テスト",
        estimatedMinutes,
        statement: statement.markdown,
        answer: answerSummary(solution.raw),
        explanation: explanation.markdown,
        verificationStatus: "DRAFT" as const,
        notes: `原稿から読み取り登録。出典: ${subjectName}予想模試 / 第${round}回 / 第${index + 1}問\n原稿照合用ハッシュ: ${sourceHash}\n難易度3・想定時間${estimatedMinutes}分は仮設定です。${figureNote}`,
      };
    });
    payloads.push({
      subjectName,
      subjectSlug,
      mock: {
        title: `大学入学共通テスト ${subjectName}予想模試 第${round}回`,
        targetUniversity: "大学入学共通テスト",
        durationMinutes: 60,
        questionCount,
      },
      problems,
    });
  }
  return payloads;
}

async function geographyHistoryCivicsPayloads(sourceRoot: string): Promise<ImportPayload[]> {
  const baseDirectory = path.join(sourceRoot, "政経共通テスト模試/地理総合・歴史総合・公共/book");
  const fileGroups = [
    ...Array.from({ length: 4 }, (_, index) => `chiri${index + 1}.tex`),
    ...Array.from({ length: 2 }, (_, index) => `reki${index + 1}.tex`),
    ...Array.from({ length: 4 }, (_, index) => `kyo${index + 1}.tex`),
  ];
  const subjectName = "地理総合・歴史総合・公共";
  const subjectSlug = "geography-history-civics";
  const payloads: ImportPayload[] = [];

  for (let round = 1; round <= 5; round += 1) {
    const directory = path.join(baseDirectory, `kai${round}`);
    await access(directory, constants.R_OK);
    const questionSources = await Promise.all(fileGroups.map(async (filename) => ({
      filename,
      raw: await readFile(path.join(directory, filename), "utf8"),
    })));
    const solutionSource = await readFile(path.join(directory, "kaisetsu.tex"), "utf8");
    const solutionBlocks = splitAtCommand(solutionSource, "KDaimon", 2);
    if (solutionBlocks.length !== questionSources.length) {
      throw new Error(`GHC 第${round}回: 問題${questionSources.length}件に対して解答${solutionBlocks.length}件です。`);
    }
    const problems = questionSources.map((question, index) => {
      const daimons = commandMatches(question.raw, "Daimon", 3);
      if (daimons.length !== 1) throw new Error(`GHC 第${round}回 ${question.filename}: Daimonを一つに特定できません。`);
      const statementRaw = question.raw.slice(daimons[0].end);
      const solution = solutionBlocks[index];
      const statement = texToMarkdown(`${daimons[0].args[1]}\n\n${statementRaw}`);
      const explanation = texToMarkdown(solution.raw);
      const field = index < 4 ? "地理総合" : index < 6 ? "歴史総合" : "公共";
      const subjectQuestion = index < 4 ? index + 1 : index < 6 ? index - 3 : index - 5;
      const title = titleFromHeading(solution.args[1], `${field} 第${subjectQuestion}問`);
      const sourceHash = sha256(`${question.raw}\n---SOLUTION---\n${solution.raw}`);
      const figureNote = statement.hasFigure || explanation.hasFigure ? "\n図表を含むため、元原稿との照合が必要です。" : "";
      return {
        code: `IMP-GHC-S${String(round).padStart(2, "0")}-Q${String(index + 1).padStart(2, "0")}`,
        title,
        field,
        subfield: title,
        difficulty: 3,
        targetUniversity: "大学入学共通テスト",
        estimatedMinutes: 6,
        statement: statement.markdown,
        answer: answerSummary(solution.raw),
        explanation: explanation.markdown,
        verificationStatus: "DRAFT" as const,
        notes: `原稿から読み取り登録。出典: ${subjectName}予想模試 / 第${round}回 / ${field}第${subjectQuestion}問\n原稿照合用ハッシュ: ${sourceHash}\n難易度3・想定時間6分は仮設定です。${figureNote}`,
      };
    });
    payloads.push({
      subjectName,
      subjectSlug,
      mock: {
        title: `大学入学共通テスト ${subjectName}予想模試 第${round}回`,
        targetUniversity: "大学入学共通テスト",
        durationMinutes: 60,
        questionCount: problems.length,
      },
      problems,
    });
  }
  return payloads;
}

function standaloneMockTitle(project: StandaloneProject, round: number) {
  const volume = project.volumeLabel ? ` ${project.volumeLabel}` : "";
  return `${project.targetUniversity} ${project.subjectName}予想模試${volume} 第${round}回`;
}

async function standalonePayloads(sourceRoot: string, project: StandaloneProject): Promise<ImportPayload[]> {
  const filePath = path.join(sourceRoot, project.file);
  await access(filePath, constants.R_OK);
  const source = await readFile(filePath, "utf8");
  const mockCommand = project.mockCommand || "mocktitle";
  const mockArgumentCount = project.mockArgumentCount || 1;
  const mockSegments = splitAtCommand(source, mockCommand, mockArgumentCount);
  if (mockSegments.length !== 5) throw new Error(`${project.code}: 模試区分は5件ではなく${mockSegments.length}件です。`);

  return mockSegments.map((segment, mockIndex) => {
    const roundText = plainText(segment.args[0]);
    const round = Number(roundText.match(/第\s*([0-9]+)\s*回/)?.[1] || roundText.match(/[0-9]+/)?.[0] || mockIndex + 1);
    const solutionMarkers = commandMatches(segment.raw, project.solutionCommand, project.solutionArgumentCount)
      .filter((marker) => project.solutionCommand !== "hdA" || /^解説\s*[IVXⅠⅡⅢⅣ]/i.test(plainText(marker.args[0])));
    const solutionStart = solutionMarkers[0]?.start;
    if (solutionStart === undefined) throw new Error(`${project.code} 第${round}回: 解答区分がありません。`);
    const questionPart = segment.raw.slice(0, solutionStart);
    const questionMarkers = commandMatches(questionPart, project.questionCommand, project.questionArgumentCount);
    if (!questionMarkers.length || questionMarkers.length !== solutionMarkers.length) {
      throw new Error(`${project.code} 第${round}回: 問題${questionMarkers.length}件に対して解答${solutionMarkers.length}件です。`);
    }
    const estimatedMinutes = Math.max(5, Math.round(project.durationMinutes / questionMarkers.length));
    const problems = questionMarkers.map((question, index) => {
      const nextQuestion = questionMarkers[index + 1];
      const statementRaw = questionPart.slice(question.end, nextQuestion?.start || questionPart.length);
      const solution = solutionMarkers[index];
      const nextSolution = solutionMarkers[index + 1];
      const explanationRaw = segment.raw.slice(solution.end, nextSolution?.start || segment.raw.length);
      const statement = texToMarkdown(statementRaw);
      const explanation = texToMarkdown(explanationRaw);
      const solutionTitle = solution.args[solution.args.length - 1];
      const questionTitle = question.args[question.args.length - 1];
      const title = titleFromHeading(solutionTitle, titleFromHeading(questionTitle, `第${index + 1}問`));
      const sourceHash = sha256(`${statementRaw}\n---SOLUTION---\n${explanationRaw}`);
      const figureNote = statement.hasFigure || explanation.hasFigure ? "\n図表を含むため、元原稿との照合が必要です。" : "";
      const field = project.field
        || (solution.args.length === 3 ? plainText(solution.args[1]) : classifyPhysicsField(title, statementRaw));
      return {
        code: `IMP-${project.code}-S${String(round).padStart(2, "0")}-Q${String(index + 1).padStart(2, "0")}`,
        title,
        field: field || project.subjectName,
        subfield: title,
        difficulty: 3,
        targetUniversity: project.targetUniversity,
        estimatedMinutes,
        statement: statement.markdown,
        answer: answerSummary(explanationRaw),
        explanation: explanation.markdown,
        verificationStatus: "DRAFT" as const,
        notes: `原稿から読み取り登録。出典: ${project.targetUniversity} ${project.subjectName}${project.volumeLabel ? ` ${project.volumeLabel}` : ""} / 第${round}回 / 第${index + 1}問\n原稿照合用ハッシュ: ${sourceHash}\n難易度3・想定時間${estimatedMinutes}分は仮設定です。${figureNote}`,
      };
    });
    return {
      subjectName: project.subjectName,
      subjectSlug: project.subjectSlug,
      mock: {
        title: standaloneMockTitle(project, round),
        targetUniversity: project.targetUniversity,
        durationMinutes: project.durationMinutes,
        questionCount: problems.length,
      },
      problems,
    };
  });
}

function optionValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function postPayload(endpoint: string, token: string, payload: ImportPayload) {
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/maintenance/manuscript-import`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-manuscript-import-token": token,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.text();
  if (!response.ok) throw new Error(`${payload.mock.title}: HTTP ${response.status} ${result}`);
  return result;
}

async function main() {
  const sourceRoot = optionValue("--source-root") || process.env.MANUSCRIPT_SOURCE_ROOT || homedir();
  const onlyProject = optionValue("--project");
  const mathOnly = process.argv.includes("--math-only");
  const apply = process.argv.includes("--apply");
  const preview = process.argv.includes("--preview");
  const endpoint = optionValue("--endpoint") || process.env.NEXT_PUBLIC_SITE_URL || "https://kdp-app-khaki.vercel.app";
  const token = process.env.MANUSCRIPT_IMPORT_TOKEN;
  const selected = onlyProject ? projects.filter((project) => project.code === onlyProject) : projects;
  const selectedStandalone = mathOnly ? [] : onlyProject ? standaloneProjects.filter((project) => project.code === onlyProject) : standaloneProjects;
  const includeInformation = !mathOnly && (!onlyProject || onlyProject === "INFO-I");
  const includeCivics = !mathOnly && (!onlyProject || onlyProject === "CIVICS");
  const includeGhc = !mathOnly && (!onlyProject || onlyProject === "GHC");
  if (!selected.length && !selectedStandalone.length && !includeInformation && !includeCivics && !includeGhc) {
    throw new Error(`対象プロジェクトがありません: ${onlyProject}`);
  }
  if (apply && !token) throw new Error("--apply には MANUSCRIPT_IMPORT_TOKEN が必要です。");

  let mockCount = 0;
  let problemCount = 0;
  const processPayloads = async (code: string, label: string, payloads: ImportPayload[]) => {
    const projectProblems = payloads.reduce((total, payload) => total + payload.problems.length, 0);
    console.log(`${code.padEnd(15)} ${String(payloads.length).padStart(2)}模試 ${String(projectProblems).padStart(3)}問  ${label}`);
    if (preview) {
      for (const payload of payloads) {
        console.log(`  ${payload.mock.title}`);
        for (const problem of payload.problems) {
          const snippet = problem.statement.replace(/\s+/g, " ").slice(0, 90);
          console.log(`    ${problem.code} [${problem.field}] ${problem.title} / 本文${problem.statement.length}字・解説${problem.explanation.length}字 / ${snippet}`);
        }
      }
    }
    mockCount += payloads.length;
    problemCount += projectProblems;
    if (apply) {
      for (const payload of payloads) {
        await postPayload(endpoint, token!, payload);
        console.log(`  登録: ${payload.mock.title}（${payload.problems.length}問）`);
      }
    }
  };

  for (const project of selected) {
    await processPayloads(project.code, project.targetUniversity, await projectPayloads(sourceRoot, project));
  }
  if (includeInformation) {
    await processPayloads("INFO-I", "大学入学共通テスト 情報I", await commonTestPayloads(sourceRoot, "information"));
  }
  if (includeCivics) {
    await processPayloads("CIVICS", "大学入学共通テスト 公共・政治経済", await commonTestPayloads(sourceRoot, "civics"));
  }
  if (includeGhc) {
    await processPayloads("GHC", "大学入学共通テスト 地理総合・歴史総合・公共", await geographyHistoryCivicsPayloads(sourceRoot));
  }
  for (const project of selectedStandalone) {
    await processPayloads(project.code, `${project.targetUniversity} ${project.subjectName}`, await standalonePayloads(sourceRoot, project));
  }
  console.log(`合計: ${mockCount}模試 / ${problemCount}問${apply ? "を登録しました" : "（ドライラン）"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
