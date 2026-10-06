import type { SectionKey } from "./framework";

export interface Story {
  id: string;
  title: string;
  shape: string;
  picture: string;
  motif: string;
  motif_keywords: string[];
  character_name: string;
  character_want: string;
  character_hidden_feeling: string;
  sections: Record<SectionKey, string>;
  rising_beats: { beat_1: string; beat_2: string; beat_3: string };
  briefs: Record<SectionKey, string>;
}

/** The shorthand plan written in the 6-minute planning phase. */
export interface Plan {
  motif: string;
  name: string;
  want: string;
  hide: string;
  exposition: string;
  inciting: string;
  b1_event: string;
  b1_react: string;
  b1_decide: string;
  b2_event: string;
  b2_react: string;
  b2_decide: string;
  b3_event: string;
  b3_react: string;
  climax: string;
  falling: string;
  resolution: string;
}

export const EMPTY_PLAN: Plan = {
  motif: "",
  name: "",
  want: "",
  hide: "",
  exposition: "",
  inciting: "",
  b1_event: "",
  b1_react: "",
  b1_decide: "",
  b2_event: "",
  b2_react: "",
  b2_decide: "",
  b3_event: "",
  b3_react: "",
  climax: "",
  falling: "",
  resolution: "",
};

export type CheckGroup = SectionKey | "story" | "plan";

export interface Check {
  id: string;
  group: CheckGroup;
  label: string;
  pass: boolean;
  /** One line explaining the result. */
  detail: string;
}

export interface Score {
  passed: number;
  total: number;
}

export interface AiCriterion {
  id: string;
  name: string;
  applies: boolean;
  score: number;
  present: string[];
  missing: string[];
  evidence: { quote: string; comment: string }[];
  fixes: string[];
}

export interface AiFeedback {
  model: string;
  criteria: AiCriterion[];
  overall: string;
  at: string;
}

export type ImageSource =
  | { kind: "picsum"; seed: string }
  | { kind: "upload"; dataUrl: string | null; name: string }
  | { kind: "scene"; text: string };

export interface Attempt {
  id: string;
  date: string;
  mode: "drill" | "full";
  section?: SectionKey;
  storyId?: string;
  storyTitle?: string;
  image?: ImageSource;
  plan?: Plan;
  text: string;
  /** Full-story mode: which section each paragraph was graded as. */
  mapping?: SectionKey[];
  timeLimitMs: number;
  timeUsedMs: number;
  overtime: boolean;
  wordCount: number;
  builtIn: Score;
  checks: Check[];
  ai?: AiFeedback;
}
