// The story framework the tool teaches and grades against.

export const SECTION_KEYS = [
  "exposition",
  "inciting_incident",
  "rising_action",
  "climax",
  "falling_action",
  "resolution",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export interface Band {
  target: number;
  min: number;
  max: number;
}

export interface SectionInfo {
  key: SectionKey;
  label: string;
  short: string;
  band: Band;
  /** Default drill time limit in minutes. */
  drillMinutes: number;
  /** What this section must do, in one line. */
  job: string;
}

export const SECTIONS: Record<SectionKey, SectionInfo> = {
  exposition: {
    key: "exposition",
    label: "Exposition",
    short: "Expo",
    band: { target: 75, min: 60, max: 95 },
    drillMinutes: 4,
    job: "Open mid-moment with action or dialogue, include one concrete sensory detail, and plant the motif.",
  },
  inciting_incident: {
    key: "inciting_incident",
    label: "Inciting incident",
    short: "Inciting",
    band: { target: 50, min: 35, max: 65 },
    drillMinutes: 2,
    job: "One event that breaks the routine.",
  },
  rising_action: {
    key: "rising_action",
    label: "Rising action",
    short: "Rising",
    band: { target: 150, min: 125, max: 180 },
    drillMinutes: 10,
    job: "Exactly three beats, one paragraph each (~50 words). Each is event > reaction > decision, and the decision causes the next beat. Link with 'but' or 'therefore', never 'and then'. Beat 3 closes the last easy exit and has no decision.",
  },
  climax: {
    key: "climax",
    label: "Climax",
    short: "Climax",
    band: { target: 90, min: 70, max: 110 },
    drillMinutes: 6,
    job: "The character makes a choice. Slower pace, shorter sentences, specific physical detail.",
  },
  falling_action: {
    key: "falling_action",
    label: "Falling action",
    short: "Falling",
    band: { target: 50, min: 35, max: 65 },
    drillMinutes: 2,
    job: "The immediate consequence of the choice, calmer.",
  },
  resolution: {
    key: "resolution",
    label: "Resolution",
    short: "Resolution",
    band: { target: 60, min: 45, max: 80 },
    drillMinutes: 3,
    job: "The motif returns and means something different. End on an image or small action. Never state the moral.",
  },
};

export const BEAT_BAND: Band = { target: 50, min: 35, max: 70 };
export const STORY_BAND: Band = { target: 475, min: 400, max: 500 };

/** Default full-story timings in minutes. Writing time is total - planning - revision. */
export const FULL_DEFAULTS = { total: 38, planning: 6, revision: 5 };

/**
 * Writing checkpoints, as minutes elapsed in the default 38-minute attempt.
 * They are rescaled onto the writing phase when timings are edited.
 */
export const CHECKPOINTS = [
  { at: 12, label: "Expo + inciting done", sections: ["exposition", "inciting_incident"] as SectionKey[] },
  { at: 22, label: "Rising action done", sections: ["rising_action"] as SectionKey[] },
  { at: 28, label: "Climax done", sections: ["climax"] as SectionKey[] },
  { at: 33, label: "Ending done", sections: ["falling_action", "resolution"] as SectionKey[] },
];

export interface Checkpoint {
  label: string;
  /** Minutes elapsed since the start of the attempt. */
  atMin: number;
  /** Cumulative words expected by then. */
  words: number;
}

/** Checkpoints for the given timings, spread proportionally across the writing phase. */
export function checkpointsFor(planning: number, total: number, revision: number): Checkpoint[] {
  const defWriteStart = FULL_DEFAULTS.planning;
  const defWriteLen = FULL_DEFAULTS.total - FULL_DEFAULTS.planning - FULL_DEFAULTS.revision;
  const writeLen = Math.max(1, total - planning - revision);
  let cumulative = 0;
  return CHECKPOINTS.map((c) => {
    cumulative += c.sections.reduce((n, k) => n + SECTIONS[k].band.target, 0);
    const frac = (c.at - defWriteStart) / defWriteLen;
    return { label: c.label, atMin: planning + frac * writeLen, words: cumulative };
  });
}

export type BandStatus = "low" | "near-low" | "ok" | "near-high" | "high";

/** Where a word count sits relative to a band. "near" means within 15% outside it. */
export function bandStatus(words: number, band: Band): BandStatus {
  if (words >= band.min && words <= band.max) return "ok";
  if (words < band.min) return words >= band.min * 0.85 ? "near-low" : "low";
  return words <= band.max * 1.15 ? "near-high" : "high";
}

export const STORY_SHAPES = ["return", "discovery", "last time", "wait", "split loyalty"] as const;
