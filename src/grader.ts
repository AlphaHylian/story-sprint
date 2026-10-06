// Built-in grader: deterministic, offline checks against the framework.
// Everything here is pure so it can be unit-tested without a DOM.

import { BEAT_BAND, SECTIONS, SECTION_KEYS, STORY_BAND, bandStatus, type Band, type SectionKey } from "./framework";
import type { Check, CheckGroup, Plan, Score } from "./types";

// ---------- text utilities ----------

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Paragraphs are separated by one or more line breaks (a textarea rarely gets blank lines). */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => countWords(p) > 0);
}

const ABBREVIATIONS = new Set(["mr.", "mrs.", "ms.", "dr.", "st.", "mt.", "e.g.", "i.e.", "etc.", "vs."]);
const CLOSERS = /["'”’)\]]+$/;
const OPENERS = /^["'“‘(\[]+/;

/**
 * Split into sentences. A sentence ends at . ! ? (or an ellipsis), optionally followed by
 * closing quotes, when the next word starts with a capital or digit. That keeps
 * `"Stop!" he said.` as one sentence. Line breaks always end a sentence.
 */
export function sentences(text: string): string[] {
  const out: string[] = [];
  for (const para of paragraphs(text)) {
    const tokens = para.split(/\s+/).filter(Boolean);
    let current: string[] = [];
    tokens.forEach((tok, i) => {
      current.push(tok);
      const bare = tok.replace(CLOSERS, "");
      const ends = /[.!?…]$/.test(bare) && !ABBREVIATIONS.has(bare.toLowerCase());
      const next = tokens[i + 1];
      const nextStarts = next === undefined || /^[\p{Lu}\p{N}]/u.test(next.replace(OPENERS, ""));
      if (ends && nextStarts) {
        out.push(current.join(" "));
        current = [];
      }
    });
    if (current.length) out.push(current.join(" "));
  }
  return out.filter((s) => countWords(s) > 0);
}

export function avgSentenceLength(text: string): number {
  const s = sentences(text);
  if (s.length === 0) return 0;
  return countWords(text) / s.length;
}

function stem(word: string): string {
  let w = word.toLowerCase().replace(/['’]s$/, "").replace(/[^\p{L}\p{N}]/gu, "");
  if (w.length > 4 && w.endsWith("es") && /(ch|sh|x|ss|z)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}

function stems(text: string): Set<string> {
  return new Set(text.split(/[\s\-–—/]+/).map(stem).filter(Boolean));
}

const MOTIF_STOPWORDS = new Set(
  "a an the of and or in on at to for with from by his her their my our your its this that these those old new little small big large some one two".split(" "),
);

/** Content words of a motif phrase, e.g. "her father's brass key" -> ["father", "brass", "key"]. */
export function motifKeywords(motif: string): string[] {
  return motif
    .split(/[\s,;/]+/)
    .map(stem)
    .filter((w) => w.length >= 3 && !MOTIF_STOPWORDS.has(w));
}

/** Which motif keywords appear in the text (matching plurals and possessives). */
export function motifHits(text: string, keywords: string[]): string[] {
  const have = stems(text);
  const multi = text.toLowerCase();
  return keywords.filter((k) => (k.includes(" ") ? multi.includes(k.toLowerCase()) : have.has(stem(k))));
}

function findAll(text: string, patterns: RegExp[]): string[] {
  const found: string[] = [];
  for (const p of patterns) {
    const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
    for (const m of text.matchAll(re)) found.push(m[0]);
  }
  return found;
}

// ---------- detectors ----------

export function andThenCount(text: string): number {
  return (text.match(/\band\s+then\b/gi) ?? []).length;
}

const DECISION_PATTERNS: RegExp[] = [
  /\b(decide[sd]?|deciding|decision)\b/i,
  /\b(chose|choose[sn]?|choosing|chosen)\b/i,
  /\bmade up (?:her|his|my|their|our|your) minds?\b/i,
  /\bresolved? to\b/i,
  /\b(?:I|he|she|they|we|you)(?: would| will|'d|’d|'ll|’ll)\b/i,
  /\b(?:going to|gonna)\b/i,
  /\b(?:planned|plans?|meant|intend(?:s|ed)?|promised|promises|refused|refuses|agreed|agrees|offered|offers) (?:to|herself|himself|myself|themselves)\b/i,
  /\binstead\b/i,
  /\b(?:so|therefore) (?:I|he|she|they|we)\b/i,
  /\bsuggest(?:s|ed)?\b/i,
  /\blet'?s\b/i,
];

/** Strong decision markers only, for checking that beat 3 leaves the choice to the climax. */
const STRONG_DECISION_PATTERNS: RegExp[] = [
  /\b(decide[sd]?|deciding|decision)\b/i,
  /\b(chose|choose[sn]?|choosing|chosen)\b/i,
  /\bmade up (?:her|his|my|their|our|your) minds?\b/i,
  /\bresolved to\b/i,
];

export function hasDecision(text: string): boolean {
  return DECISION_PATTERNS.some((p) => p.test(text));
}

export function hasStrongDecision(text: string): boolean {
  return STRONG_DECISION_PATTERNS.some((p) => p.test(text));
}

const CLICHE_OPENINGS: RegExp[] = [
  /\b(?:woke|wakes|waking|awoke|awoken|wake) up\b/i,
  /\b(?:woke|awoke)\b/i,
  /\balarm(?: clock)?s?\b/i,
  /\b(?:opened|opens|open) (?:my|his|her|their) eyes\b/i,
  /\byawn(?:ed|s|ing)?\b/i,
  /\bonce upon a time\b/i,
  /\bit was (?:a |an |just )?(?:another |normal |typical |ordinary |dark |cold |sunny |rainy |stormy |bright |beautiful |hot |warm |grey |gray |quiet |lovely |freezing )+(?:and \w+ )?(?:day|night|morning|evening|afternoon|winter|summer)\b/i,
  /\bit was (?:raining|snowing|pouring|drizzling)\b/i,
  /\bthe (?:sun|rain|wind|snow|storm) (?:was |were )?(?:shining|shone|rose|rising|fell|falling|poured|pouring|howled|howling|beat|beating|blew|blowing|pattered|pattering)\b/i,
  /\bthe weather\b/i,
  /\b(?:my|his|her) name (?:is|was)\b/i,
  /\blet me tell you\b/i,
  /\bbeep(?:ed|ing)?\b/i,
  /\bit all (?:started|began)\b/i,
  /\bdear diary\b/i,
];

/** The first two sentences of the opening, where clichés matter. */
export function openingOf(text: string): string {
  return sentences(text).slice(0, 2).join(" ");
}

export function clicheOpenings(text: string): string[] {
  return findAll(openingOf(text), CLICHE_OPENINGS);
}

const MORAL_PATTERNS: RegExp[] = [
  /\breali[sz](?:e|ed|es|ing)\b(?: that)?/i,
  /\b(?:learn(?:ed|t|s)?) (?:that|how|to|the|a|what)\b/i,
  /\bunderst(?:and|ood|ands) (?:that|now|what|why|how)\b/i,
  /\b(?:finally|now) underst(?:and|ood)\b/i,
  /\blessons?\b/i,
  /\bthe moral\b/i,
  /\bfrom (?:that|this) (?:day|moment|point|night|time)(?: on| onwards?| forward)?\b/i,
  /\b(?:taught|teaches|teach) (?:me|him|her|them|us) (?:that|to|how)\b/i,
  /\bnow (?:I|she|he|they|we) knew\b/i,
  /\b(?:I|she|he|they|we) (?:finally )?knew (?:that|now)\b/i,
  /\bnever again\b/i,
  /\bwhat (?:really |truly )?mattered(?: most)?\b/i,
  /\bthe (?:true|real) meaning\b/i,
  /\bthe most important thing\b/i,
  /\b(?:everything|it) (?:would|was going to|will) be (?:okay|ok|alright|all right|fine)\b/i,
  /\bwould never forget\b/i,
  /\bchanged (?:her|his|my|their) life\b/i,
  /\bin the end,? (?:you|we|people|it)\b/i,
  /\bsometimes,? (?:you|we|people) (?:have|need|must)\b/i,
];

export function statedMorals(text: string): string[] {
  return findAll(text, MORAL_PATTERNS);
}

const P = "(?:my|his|her|their|our|your)";
const BODY_CLICHES: RegExp[] = [
  new RegExp(`\\bhearts? (?:was |were |is |started |began )?(?:pounding|pounded|pounds|racing|raced|races|thumping|thumped|hammering|hammered|skipped|skipping|sank|sinking|leapt|leaped|fluttered|fluttering|beating (?:fast|faster|wildly|so fast)|beat (?:fast|faster|wildly)|in ${P} (?:throat|mouth))\\b`, "i"),
  /\bbreath (?:caught|catching|hitched|hitching)\b/i,
  new RegExp(`\\b(?:held|holding|caught|catching) ${P} breath\\b`, "i"),
  /\bcouldn'?t breathe\b/i,
  /\bstomachs? (?:dropped|drops|lurched|lurches|churned|churning|knotted|twisted|sank|turned|flipped|tightened|was in knots)\b/i,
  /\bbutterflies\b/i,
  new RegExp(`\\bpit of ${P} stomach\\b`, "i"),
  /\bblood (?:ran|run|runs|running|went) cold\b/i,
  /\bblood (?:froze|boiled|boiling)\b/i,
  new RegExp(`\\b(?:shivers?|chills?) (?:ran |went |running |shot |go )?(?:down|up) ${P} spine\\b`, "i"),
  /\bspine-?chilling\b/i,
  /\b(?:palms|hands) (?:were |was |went |grew )?(?:sweaty|sweating|clammy)\b/i,
  /\bsweaty palms\b/i,
  /\b(?:cold )?sweat (?:broke out|dripped|beaded|trickled|ran|poured)\b/i,
  /\bbeads of sweat\b/i,
  /\bknees (?:went weak|buckled|trembled|shook|turned to jelly|gave way)\b/i,
  /\blegs (?:turned to jelly|went weak|felt like jelly)\b/i,
  /\bweak at the knees\b/i,
  new RegExp(`\\blump in ${P} throat\\b`, "i"),
  new RegExp(`\\bhairs? on the back of ${P} neck\\b`, "i"),
  /\b(?:froze|frozen) (?:in|with) (?:fear|terror|shock)\b/i,
  /\btears (?:streamed|streaming|rolled|rolling|welled|welling) (?:up|down)?\b/i,
  /\bjaws? dropped\b/i,
  /\b(?:trembling|shaking|shook|trembled) (?:with|in) (?:fear|anger|rage|nerves|terror)\b/i,
];

export function bodyCliches(text: string): string[] {
  return findAll(text, BODY_CLICHES);
}

// ---------- checks ----------

function quoteList(items: string[]): string {
  return [...new Set(items.map((s) => s.toLowerCase()))].map((s) => `"${s}"`).join(", ");
}

function wordCountCheck(group: CheckGroup, label: string, text: string, band: Band): Check {
  const n = countWords(text);
  const status = bandStatus(n, band);
  const pass = status === "ok";
  const where = status === "ok" ? "inside" : status.endsWith("low") ? "under" : "over";
  return {
    id: `${group}-words`,
    group,
    label: `${label}: word count`,
    pass,
    detail: `${n} words, ${where} the ${band.min}-${band.max} band (target ~${band.target}).`,
  };
}

function bodyClicheCheck(group: CheckGroup, text: string): Check {
  const found = bodyCliches(text);
  return {
    id: `${group}-body`,
    group,
    label: "No bodily-sensation clichés",
    pass: found.length === 0,
    detail:
      found.length === 0
        ? "No pounding hearts or dropping stomachs: emotion has to come from action and detail."
        : `${found.length} found: ${quoteList(found)}. Show the feeling through what the character does or notices instead.`,
  };
}

export interface SectionContext {
  mode: "drill" | "full";
  /** Exposition to compare the climax's sentence length against. */
  referenceExposition?: string;
  /** Climax to compare the exposition's sentence length against (drill mode). */
  referenceClimax?: string;
  motifKeywords?: string[];
  /** Label for the motif in messages. */
  motifLabel?: string;
}

/** Checks for one section's text. */
export function checkSection(key: SectionKey, text: string, ctx: SectionContext): Check[] {
  const info = SECTIONS[key];
  const checks: Check[] = [wordCountCheck(key, info.label, text, info.band)];
  if (countWords(text) === 0) {
    checks[0].detail = "Nothing written for this section.";
    return checks;
  }
  const motifKw = ctx.motifKeywords ?? [];
  const motifName = ctx.motifLabel ? `"${ctx.motifLabel}"` : "the motif";

  if (key === "exposition") {
    const found = clicheOpenings(text);
    checks.push({
      id: "exposition-opening",
      group: key,
      label: "Opens mid-moment, not with a cliché",
      pass: found.length === 0,
      detail:
        found.length === 0
          ? "No waking up, alarm clock or weather-report opening found in the first two sentences."
          : `Cliché opening: ${quoteList(found)}. Start in the middle of an action or a line of dialogue.`,
    });
    if (motifKw.length) {
      const hits = motifHits(text, motifKw);
      checks.push({
        id: "exposition-motif",
        group: key,
        label: "Plants the motif",
        pass: hits.length > 0,
        detail: hits.length
          ? `The motif is planted (${quoteList(hits)}).`
          : `${motifName} does not appear. Name the object early so the ending can bring it back.`,
      });
    }
    if (ctx.mode === "drill" && ctx.referenceClimax) {
      const mine = avgSentenceLength(text);
      const theirs = avgSentenceLength(ctx.referenceClimax);
      checks.push({
        id: "exposition-pace",
        group: key,
        label: "Longer sentences than the climax",
        pass: mine > theirs,
        detail: `Your exposition averages ${mine.toFixed(1)} words per sentence; this story's climax averages ${theirs.toFixed(1)}. The opening can flow; the climax should feel tighter by contrast.`,
      });
    }
  }

  if (key === "rising_action") {
    const beats = paragraphs(text);
    checks.push({
      id: "rising-three",
      group: key,
      label: "Exactly three beats",
      pass: beats.length === 3,
      detail:
        beats.length === 3
          ? "Three paragraphs, one per beat."
          : `${beats.length} paragraph${beats.length === 1 ? "" : "s"} found. Write exactly three beats, one paragraph each.`,
    });
    if (beats.length === 3) {
      const lens = beats.map(countWords);
      const off = lens.map((n, i) => ({ n, i })).filter(({ n }) => bandStatus(n, BEAT_BAND) !== "ok");
      checks.push({
        id: "rising-beat-length",
        group: key,
        label: "Beats are about 50 words each",
        pass: off.length === 0,
        detail: `Beat lengths: ${lens.join(" / ")} words${off.length ? `. Aim for ${BEAT_BAND.min}-${BEAT_BAND.max} each.` : "."}`,
      });
    }
    const andThen = andThenCount(text);
    checks.push({
      id: "rising-and-then",
      group: key,
      label: 'No "and then"',
      pass: andThen === 0,
      detail:
        andThen === 0
          ? 'Beats are not chained with "and then".'
          : `"and then" appears ${andThen} time${andThen === 1 ? "" : "s"}. Link beats by cause: "but" or "therefore".`,
    });
    const decisionBeats = beats.slice(0, 2);
    const missing = decisionBeats.map((b, i) => (hasDecision(b) ? 0 : i + 1)).filter(Boolean);
    checks.push({
      id: "rising-decisions",
      group: key,
      label: "Beats 1 and 2 end in a visible decision",
      pass: decisionBeats.length === 2 && missing.length === 0,
      detail:
        decisionBeats.length < 2
          ? "Need at least two beats to check for decisions."
          : missing.length === 0
            ? "Each of the first two beats shows the character deciding something that drives the next beat."
            : `No visible decision in beat ${missing.join(" and ")} (looked for words like decided, chose, would, instead, so she...).`,
    });
    if (beats.length >= 3) {
      const b3 = beats[2];
      checks.push({
        id: "rising-beat3",
        group: key,
        label: "Beat 3 leaves the choice to the climax",
        pass: !hasStrongDecision(b3),
        detail: hasStrongDecision(b3)
          ? "Beat 3 already has the character deciding. Close the last easy exit instead, and save the choice for the climax."
          : "Beat 3 has no explicit decision, so the choice is saved for the climax.",
      });
    }
  }

  if (key === "climax" && ctx.referenceExposition) {
    const mine = avgSentenceLength(text);
    const expo = avgSentenceLength(ctx.referenceExposition);
    const whose = ctx.mode === "drill" ? "this story's exposition" : "your exposition";
    checks.push({
      id: "climax-pace",
      group: key,
      label: "Shorter sentences than the exposition",
      pass: expo > 0 && mine < expo,
      detail: `Climax averages ${mine.toFixed(1)} words per sentence; ${whose} averages ${expo.toFixed(1)}. Slow the moment with short sentences.`,
    });
  }

  if (key === "resolution") {
    if (motifKw.length) {
      const hits = motifHits(text, motifKw);
      checks.push({
        id: "resolution-motif",
        group: key,
        label: "The motif returns",
        pass: hits.length > 0,
        detail: hits.length
          ? `The motif comes back (${quoteList(hits)}). Make sure it now means something different.`
          : `${motifName} does not come back. Return the object from the opening so it can carry the change.`,
      });
    }
    const last = paragraphs(text).at(-1) ?? "";
    const morals = statedMorals(last);
    checks.push({
      id: "resolution-moral",
      group: key,
      label: "No stated moral",
      pass: morals.length === 0,
      detail:
        morals.length === 0
          ? "The final paragraph does not explain what the story meant."
          : `The final paragraph states a lesson: ${quoteList(morals)}. Cut it and end on an image or a small action.`,
    });
  }

  checks.push(bodyClicheCheck(key, text));
  return checks;
}

/** Grade a single drill section against a bank story. */
export function gradeDrill(
  key: SectionKey,
  text: string,
  story: { sections: Record<SectionKey, string>; motif: string; motif_keywords: string[] },
): Check[] {
  return checkSection(key, text, {
    mode: "drill",
    referenceExposition: story.sections.exposition,
    referenceClimax: story.sections.climax,
    motifKeywords: key === "exposition" || key === "resolution" ? story.motif_keywords : undefined,
    motifLabel: story.motif,
  });
}

// ---------- full story ----------

const STANDARD_EIGHT: SectionKey[] = [
  "exposition",
  "inciting_incident",
  "rising_action",
  "rising_action",
  "rising_action",
  "climax",
  "falling_action",
  "resolution",
];

/**
 * Guess which section each paragraph belongs to. Eight paragraphs map directly
 * (expo, inciting, three beats, climax, falling, resolution); otherwise each
 * paragraph goes to the section its word-count midpoint falls in.
 */
export function autoMap(paras: string[]): SectionKey[] {
  if (paras.length === 0) return [];
  if (paras.length === STANDARD_EIGHT.length) return [...STANDARD_EIGHT];
  const total = paras.reduce((n, p) => n + countWords(p), 0) || 1;
  const targetTotal = SECTION_KEYS.reduce((n, k) => n + SECTIONS[k].band.target, 0);
  const bounds: { key: SectionKey; end: number }[] = [];
  let acc = 0;
  for (const k of SECTION_KEYS) {
    acc += SECTIONS[k].band.target / targetTotal;
    bounds.push({ key: k, end: acc });
  }
  let seen = 0;
  const map = paras.map((p) => {
    const w = countWords(p);
    const mid = (seen + w / 2) / total;
    seen += w;
    return (bounds.find((b) => mid <= b.end) ?? bounds[bounds.length - 1]).key;
  });
  if (paras.length >= 2) {
    map[0] = "exposition";
    map[map.length - 1] = "resolution";
  }
  return map;
}

export function sectionsFromMapping(paras: string[], mapping: SectionKey[]): Record<SectionKey, string> {
  const out = Object.fromEntries(SECTION_KEYS.map((k) => [k, [] as string[]])) as Record<SectionKey, string[]>;
  paras.forEach((p, i) => out[mapping[i] ?? "resolution"].push(p));
  return Object.fromEntries(SECTION_KEYS.map((k) => [k, out[k].join("\n\n")])) as Record<SectionKey, string>;
}

export interface FullGrade {
  paragraphs: string[];
  mapping: SectionKey[];
  sections: Record<SectionKey, string>;
  checks: Check[];
}

const PLAN_LABELS: Record<keyof Plan, string> = {
  motif: "motif",
  name: "name",
  want: "want",
  hide: "hidden feeling",
  exposition: "exposition",
  inciting: "inciting incident",
  b1_event: "B1 event",
  b1_react: "B1 reaction",
  b1_decide: "B1 decision",
  b2_event: "B2 event",
  b2_react: "B2 reaction",
  b2_decide: "B2 decision",
  b3_event: "B3 event",
  b3_react: "B3 reaction",
  climax: "climax",
  falling: "falling action",
  resolution: "resolution",
};

function planChecks(plan: Plan): Check[] {
  const empty = (Object.keys(PLAN_LABELS) as (keyof Plan)[]).filter((k) => !plan[k].trim());
  return [
    {
      id: "plan-complete",
      group: "plan",
      label: "Plan complete",
      pass: empty.length === 0,
      detail:
        empty.length === 0
          ? "Every plan field has at least a shorthand note."
          : `Missing: ${empty.map((k) => PLAN_LABELS[k]).join(", ")}.`,
    },
    {
      id: "plan-inner",
      group: "plan",
      label: "Inner problem planned",
      pass: plan.hide.trim().length > 0,
      detail: plan.hide.trim()
        ? "The character hides something, so the plot has an inner track as well as events."
        : "No hidden feeling planned. Without one the plot is a single track of events with no inner problem.",
    },
  ];
}

/** Grade a whole story. Pass a mapping to override the automatic paragraph-to-section guess. */
export function gradeFullStory(text: string, plan: Plan, mapping?: SectionKey[]): FullGrade {
  const paras = paragraphs(text);
  const map = mapping && mapping.length === paras.length ? mapping : autoMap(paras);
  const sections = sectionsFromMapping(paras, map);
  const motifKw = motifKeywords(plan.motif);
  const checks: Check[] = [wordCountCheck("story", "Whole story", text, STORY_BAND)];

  for (const k of SECTION_KEYS) {
    checks.push(
      ...checkSection(k, sections[k], {
        mode: "full",
        referenceExposition: sections.exposition,
        motifKeywords: k === "exposition" || k === "resolution" ? motifKw : undefined,
        motifLabel: plan.motif.trim() || undefined,
      }),
    );
  }
  if (!motifKw.length) {
    checks.push({
      id: "story-motif",
      group: "story",
      label: "Motif appears in exposition and resolution",
      pass: false,
      detail: "No motif in the plan, so it cannot be tracked. Choose one object from the picture.",
    });
  }
  checks.push(...planChecks(plan));
  return { paragraphs: paras, mapping: map, sections, checks };
}

export function score(checks: Check[]): Score {
  return { passed: checks.filter((c) => c.pass).length, total: checks.length };
}
