import { getTimeBandRange } from "@/lib/authoring-labels";
import type { ProblemSearch, UniversityDifficultyProfile } from "@/lib/data/authoring";

/** URLクエリ1件を読む関数。ページの searchParams と FormData 由来の両方で使う。 */
export type QueryReader = (key: string) => string;

export function readerFromSearch(raw: string): QueryReader {
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  return (key) => params.get(key) || "";
}

export function candidateDifficultyMode(read: QueryReader) {
  const requested = read("candidateDifficultyMode");
  if (["all", "university-easier", "university-standard", "university-harder"].includes(requested)) return requested;
  if (/^exact-[1-5]$/.test(requested)) return requested;
  const legacy = Number(read("candidateDifficulty"));
  return legacy >= 1 && legacy <= 5 ? `exact-${legacy}` : "all";
}

export function parseCandidateFilters(read: QueryReader, universityProfiles: UniversityDifficultyProfile[]): ProblemSearch {
  const usage = read("candidateUsage");
  const verification = read("candidateVerification");
  const sort = read("candidateSort");
  const university = read("candidateUniversity") || undefined;
  const difficultyMode = candidateDifficultyMode(read);
  const profile = universityProfiles.find((item) => item.university === university);
  const exact = difficultyMode.startsWith("exact-") ? Number(difficultyMode.slice(6)) : undefined;
  let difficultyMin = exact;
  let difficultyMax = exact;
  if (profile && difficultyMode === "university-standard") {
    difficultyMin = profile.baselineDifficulty;
    difficultyMax = profile.baselineDifficulty;
  } else if (profile && difficultyMode === "university-easier") {
    difficultyMax = profile.baselineDifficulty - 1;
  } else if (profile && difficultyMode === "university-harder") {
    difficultyMin = profile.baselineDifficulty + 1;
  }
  const timeBand = getTimeBandRange(read("candidateTimeBand"));
  return {
    q: read("candidateQ") || undefined,
    field: read("candidateField") || undefined,
    subfield: read("candidateSubfield") || undefined,
    targetUniversity: university,
    difficultyMin,
    difficultyMax,
    timeMin: timeBand?.min,
    timeMax: timeBand?.max,
    usage: usage === "used" || usage === "unused" ? usage : undefined,
    verification: ["DRAFT", "REVIEWING", "VERIFIED", "NEEDS_REVISION"].includes(verification)
      ? verification as ProblemSearch["verification"]
      : undefined,
    sort: ["recent", "difficulty-asc", "difficulty-desc", "time-asc", "least-used"].includes(sort)
      ? sort as ProblemSearch["sort"]
      : "least-used",
    ignoreExamTarget: !university,
    page: Number(read("candidatePage")) || 1,
    limit: 20,
  };
}
