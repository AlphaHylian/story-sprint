// localStorage persistence: settings, the API key, drafts and attempt history.
// Every access is wrapped: storage can be full, disabled or cleared.

import { FULL_DEFAULTS, SECTIONS, SECTION_KEYS, type SectionKey } from "./framework";
import type { Attempt, ImageSource, Plan } from "./types";

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface Settings {
  drillMinutes: Record<SectionKey, number>;
  fullTotal: number;
  fullPlanning: number;
  fullRevision: number;
  blockPaste: boolean;
  theme: "system" | "light" | "dark";
  model: string;
}

const KEYS = {
  settings: "storysprint.settings.v1",
  apiKey: "storysprint.apiKey",
  history: "storysprint.history.v1",
  drillDraft: "storysprint.draft.drill.v1",
  fullDraft: "storysprint.draft.full.v1",
};

export function defaultSettings(): Settings {
  return {
    drillMinutes: Object.fromEntries(SECTION_KEYS.map((k) => [k, SECTIONS[k].drillMinutes])) as Record<SectionKey, number>,
    fullTotal: FULL_DEFAULTS.total,
    fullPlanning: FULL_DEFAULTS.planning,
    fullRevision: FULL_DEFAULTS.revision,
    blockPaste: true,
    theme: "system",
    model: DEFAULT_MODEL,
  };
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadSettings(): Settings {
  const d = defaultSettings();
  const s = read<Partial<Settings>>(KEYS.settings) ?? {};
  return { ...d, ...s, drillMinutes: { ...d.drillMinutes, ...(s.drillMinutes ?? {}) } };
}

export function saveSettings(s: Settings): void {
  write(KEYS.settings, s);
}

// The key is kept apart from settings so it never ends up in an export.
export function loadApiKey(): string {
  try {
    return localStorage.getItem(KEYS.apiKey) ?? "";
  } catch {
    return "";
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEYS.apiKey, key);
    else localStorage.removeItem(KEYS.apiKey);
  } catch {
    /* ignore */
  }
}

// ---------- drafts ----------

export interface DrillDraft {
  storyId: string;
  section: SectionKey;
  text: string;
  elapsedMs: number;
  overtime: boolean;
  savedAt: string;
}

export type FullPhase = "planning" | "writing" | "revision";

export interface FullDraft {
  image: ImageSource;
  plan: Plan;
  text: string;
  phase: FullPhase;
  elapsedMs: number;
  overtime: boolean;
  /** Word count recorded as each checkpoint passed. */
  checkpointWords: (number | null)[];
  savedAt: string;
}

export const loadDrillDraft = () => read<DrillDraft>(KEYS.drillDraft);
export const saveDrillDraft = (d: DrillDraft) => write(KEYS.drillDraft, d);
export const clearDrillDraft = () => remove(KEYS.drillDraft);

export const loadFullDraft = () => read<FullDraft>(KEYS.fullDraft);
export function saveFullDraft(d: FullDraft): void {
  if (!write(KEYS.fullDraft, d) && d.image.kind === "upload") {
    write(KEYS.fullDraft, { ...d, image: { ...d.image, dataUrl: null } });
  }
}
export const clearFullDraft = () => remove(KEYS.fullDraft);

// ---------- history ----------

export function loadHistory(): Attempt[] {
  return read<Attempt[]>(KEYS.history) ?? [];
}

function saveHistory(list: Attempt[]): boolean {
  if (write(KEYS.history, list)) return true;
  // Out of space: drop uploaded images, oldest first, and retry.
  const slim = list.map((a) => (a.image?.kind === "upload" ? { ...a, image: { ...a.image, dataUrl: null } } : a));
  return write(KEYS.history, slim);
}

export function addAttempt(a: Attempt): boolean {
  return saveHistory([a, ...loadHistory()]);
}

export function updateAttempt(a: Attempt): void {
  saveHistory(loadHistory().map((x) => (x.id === a.id ? a : x)));
}

export function deleteAttempt(id: string): void {
  saveHistory(loadHistory().filter((x) => x.id !== id));
}

export function clearHistory(): void {
  remove(KEYS.history);
}

export function applyTheme(theme: Settings["theme"]): void {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}
