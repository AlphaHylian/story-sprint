// The story bank doubles as model answers, so every story must pass the framework.
import { describe, expect, it } from "vitest";
import stories from "../src/data/stories.json";
import { SECTION_KEYS, SECTIONS, STORY_SHAPES } from "../src/framework";
import { countWords, gradeDrill, gradeFullStory } from "../src/grader";
import { EMPTY_PLAN } from "../src/types";

describe("story bank", () => {
  it("has at least 12 stories covering every shape", () => {
    expect(stories.length).toBeGreaterThanOrEqual(12);
    for (const shape of STORY_SHAPES) expect(stories.some((s) => s.shape === shape)).toBe(true);
    expect(new Set(stories.map((s) => s.id)).size).toBe(stories.length);
  });

  for (const story of stories) {
    describe(story.title, () => {
      it("is 450-500 words with every section in its band", () => {
        const total = SECTION_KEYS.reduce((n, k) => n + countWords(story.sections[k]), 0);
        expect(total).toBeGreaterThanOrEqual(450);
        expect(total).toBeLessThanOrEqual(500);
        for (const k of SECTION_KEYS) {
          const n = countWords(story.sections[k]);
          expect(n, k).toBeGreaterThanOrEqual(SECTIONS[k].band.min);
          expect(n, k).toBeLessThanOrEqual(SECTIONS[k].band.max);
        }
      });

      it("has three labelled beats matching the rising action", () => {
        const beats = [story.rising_beats.beat_1, story.rising_beats.beat_2, story.rising_beats.beat_3];
        expect(beats.join("\n\n")).toBe(story.sections.rising_action);
      });

      it("has every field filled in", () => {
        for (const k of SECTION_KEYS) expect(story.briefs[k].length).toBeGreaterThan(20);
        expect(story.motif_keywords.length).toBeGreaterThan(0);
        expect(story.picture && story.character_want && story.character_hidden_feeling).toBeTruthy();
      });

      it("passes every built-in check as a full story", () => {
        const text = SECTION_KEYS.map((k) => story.sections[k]).join("\n\n");
        const plan = { ...EMPTY_PLAN, motif: story.motif_keywords.join(" "), hide: story.character_hidden_feeling };
        const g = gradeFullStory(text, plan);
        for (const c of g.checks.filter((c) => c.group !== "plan")) expect(c.pass, `${c.id}: ${c.detail}`).toBe(true);
      });

      it("passes every built-in check section by section in drill mode", () => {
        for (const k of SECTION_KEYS) {
          for (const c of gradeDrill(k, story.sections[k], story)) expect(c.pass, `${k} ${c.id}: ${c.detail}`).toBe(true);
        }
      });
    });
  }
});
