import { createEditor } from "../editor";
import { SECTIONS, SECTION_KEYS, type SectionKey } from "../framework";
import { countWords, gradeDrill, score } from "../grader";
import { aiPanel, checklist, scoreBadge } from "../results";
import {
  addAttempt,
  clearDrillDraft,
  loadDrillDraft,
  loadSettings,
  saveDrillDraft,
  type DrillDraft,
} from "../storage";
import { STORIES, storyById } from "../stories";
import { Clock, countdownDisplay } from "../timer";
import type { Attempt, Story } from "../types";
import { clear, formatDuration, h, pick, prose, toast, uid } from "../ui";

export function drillView(root: HTMLElement): () => void {
  let clock: Clock | null = null;
  const cleanup = () => clock?.stop();

  function setup(): void {
    cleanup();
    clear(root);
    const settings = loadSettings();
    let section: SectionKey | "random" = "random";
    let storyId = "random";

    const draft = loadDrillDraft();
    const draftStory = draft ? storyById(draft.storyId) : undefined;
    const resume =
      draft && draftStory
        ? h(
            "div",
            { class: "card notice" },
            h("p", null, "Unfinished drill: ", h("strong", null, SECTIONS[draft.section].label), ` in "${draftStory.title}" (${countWords(draft.text)} words).`),
            h(
              "div",
              { class: "row" },
              h("button", { class: "btn", onclick: () => run(draftStory, draft.section, draft) }, "Resume"),
              h("button", { class: "btn ghost", onclick: () => { clearDrillDraft(); setup(); } }, "Discard"),
            ),
          )
        : null;

    const limit = h("p", { class: "muted" });
    const updateLimit = () => {
      limit.textContent =
        section === "random"
          ? "A random section. Time limits are set in Settings."
          : `${SECTIONS[section].label}: ~${SECTIONS[section].band.target} words in ${settings.drillMinutes[section]} min.`;
    };

    const chips = h(
      "div",
      { class: "chips", role: "radiogroup", "aria-label": "Section" },
      [...SECTION_KEYS, "random" as const].map((k) => {
        const id = `sec-${k}`;
        return h(
          "label",
          { class: "chip", for: id },
          h("input", {
            type: "radio",
            name: "section",
            id,
            value: k,
            checked: k === section,
            onchange: () => {
              section = k;
              updateLimit();
            },
          }),
          h("span", null, k === "random" ? "Random" : SECTIONS[k].label),
        );
      }),
    );

    const storySelect = h(
      "select",
      { onchange: (e: Event) => (storyId = (e.target as HTMLSelectElement).value), "aria-label": "Story" },
      h("option", { value: "random" }, "Random story"),
      STORIES.map((s) => h("option", { value: s.id }, `${s.title} (${s.shape})`)),
    );

    updateLimit();
    root.append(
      h("h2", null, "Section drill"),
      h(
        "p",
        { class: "lede" },
        "One section is removed from a model story. Write a replacement that fits what comes before and after it, against the clock.",
      ),
      resume ?? "",
      h(
        "div",
        { class: "card" },
        h("h3", null, "Section"),
        chips,
        limit,
        h("h3", null, "Story"),
        storySelect,
        h(
          "div",
          { class: "row" },
          h(
            "button",
            {
              class: "btn primary",
              onclick: () => {
                const s = storyId === "random" ? pick(STORIES) : storyById(storyId)!;
                const k = section === "random" ? pick(SECTION_KEYS) : section;
                clearDrillDraft();
                run(s, k);
              },
            },
            "Start drill",
          ),
        ),
      ),
    );
  }

  function run(story: Story, key: SectionKey, draft?: DrillDraft): void {
    cleanup();
    clear(root);
    window.scrollTo(0, 0);
    const page = h("div", { class: "narrow" });
    root.append(page);
    const settings = loadSettings();
    const info = SECTIONS[key];
    const limitMs = settings.drillMinutes[key] * 60_000;
    let overtime = draft?.overtime ?? false;
    let finished = false;

    const save = () =>
      saveDrillDraft({
        storyId: story.id,
        section: key,
        text: editor.value(),
        elapsedMs: clock?.elapsed() ?? 0,
        overtime,
        savedAt: new Date().toISOString(),
      });

    const editor = createEditor({
      value: draft?.text ?? "",
      band: info.band,
      label: `Your ${info.label.toLowerCase()}`,
      placeholder: `Write the ${info.label.toLowerCase()} here…`,
      blockPaste: settings.blockPaste,
      rows: key === "rising_action" ? 16 : 9,
      showParagraphs: key === "rising_action",
      onInput: save,
    });

    const countdown = countdownDisplay(`${info.label} · ${settings.drillMinutes[key]} min`);
    const timeUp = h(
      "div",
      { class: "timeup", hidden: true },
      h("strong", null, "Time's up."),
      h("button", { class: "btn primary", onclick: () => submit() }, "Submit"),
      h(
        "button",
        {
          class: "btn ghost",
          onclick: () => {
            overtime = true;
            timeUp.hidden = true;
            editor.setLocked(false);
            editor.focus();
            save();
          },
        },
        "Keep writing (overtime)",
      ),
    );
    const submitBtn = h("button", { class: "btn primary", onclick: () => submit() }, "Submit");

    const idx = SECTION_KEYS.indexOf(key);
    const readOnly = (k: SectionKey) =>
      h("section", { class: "story-part" }, h("div", { class: "part-label" }, SECTIONS[k].label), prose(story.sections[k]));

    page.append(
      h("div", { class: "timerbar" }, countdown.el, h("div", { class: "timerbar-actions" }, timeUp, submitBtn)),
      h(
        "div",
        { class: "card brief" },
        h("div", { class: "brief-head" }, h("h2", null, info.label), h("span", { class: "pill" }, `~${info.band.target} words`), h("span", { class: "pill" }, `${settings.drillMinutes[key]} min`)),
        h("p", null, story.briefs[key]),
        h("p", { class: "muted small" }, info.job),
      ),
      h(
        "div",
        { class: "story-meta" },
        h("h3", null, story.title),
        h("p", { class: "muted small" }, h("strong", null, "Picture: "), story.picture),
        h("p", { class: "muted small" }, h("strong", null, "Motif: "), story.motif, " · ", h("strong", null, "Want: "), story.character_want),
      ),
      h(
        "div",
        { class: "story-flow" },
        SECTION_KEYS.slice(0, idx).map(readOnly),
        h("section", { class: "story-part mine" }, h("div", { class: "part-label" }, `Your ${info.label.toLowerCase()}`), editor.el),
        SECTION_KEYS.slice(idx + 1).map(readOnly),
      ),
    );

    let lastSave = 0;
    clock = new Clock((elapsed) => {
      const remaining = limitMs - elapsed;
      if (countdown.update(overtime ? elapsed - limitMs : remaining, overtime)) toast("One minute left.");
      if (!overtime && remaining <= 0 && !finished && timeUp.hidden) {
        editor.setLocked(true);
        timeUp.hidden = false;
        save();
      }
      if (elapsed - lastSave > 5000) {
        lastSave = elapsed;
        save();
      }
    });
    clock.start(draft?.elapsedMs ?? 0);
    if (!overtime && (draft?.elapsedMs ?? 0) >= limitMs) {
      editor.setLocked(true);
      timeUp.hidden = false;
    }
    editor.focus();

    function submit(): void {
      if (finished) return;
      finished = true;
      clock?.stop();
      const used = clock?.elapsed() ?? 0;
      const text = editor.value();
      const checks = gradeDrill(key, text, story);
      const attempt: Attempt = {
        id: uid(),
        date: new Date().toISOString(),
        mode: "drill",
        section: key,
        storyId: story.id,
        storyTitle: story.title,
        text,
        timeLimitMs: limitMs,
        timeUsedMs: used,
        overtime,
        wordCount: countWords(text),
        builtIn: score(checks),
        checks,
      };
      if (!addAttempt(attempt)) toast("Could not save to history (storage full?).");
      clearDrillDraft();
      results(story, key, attempt);
    }
  }

  function results(story: Story, key: SectionKey, attempt: Attempt): void {
    cleanup();
    clear(root);
    window.scrollTo(0, 0);
    const info = SECTIONS[key];
    const merged = { ...story.sections, [key]: attempt.text };

    root.append(
      h(
        "div",
        { class: "results-head" },
        h("h2", null, `${info.label} drill: results`),
        h(
          "p",
          { class: "muted" },
          `"${story.title}" · ${attempt.wordCount} words · ${formatDuration(attempt.timeUsedMs)} of ${formatDuration(attempt.timeLimitMs)}`,
          attempt.overtime ? h("span", { class: "pill warn" }, "overtime") : null,
          " ",
          scoreBadge(attempt.checks),
        ),
      ),
      h("section", { class: "card" }, h("h3", null, "Built-in checks"), checklist(attempt.checks, false)),
      h(
        "section",
        { class: "compare" },
        h("div", { class: "card" }, h("h3", null, "Yours"), prose(attempt.text || "(nothing written)")),
        h("div", { class: "card" }, h("h3", null, "Original"), prose(story.sections[key])),
      ),
      h(
        "section",
        { class: "card" },
        h("h3", null, "Read it through"),
        h(
          "div",
          { class: "story-flow" },
          SECTION_KEYS.map((k) =>
            h("section", { class: `story-part${k === key ? " mine" : ""}` }, h("div", { class: "part-label" }, k === key ? `${SECTIONS[k].label} (yours)` : SECTIONS[k].label), prose(merged[k] || "(nothing written)")),
          ),
        ),
      ),
      aiPanel(attempt, () => ({
        mode: "drill",
        section: key,
        brief: story.briefs[key],
        storyTitle: story.title,
        picture: story.picture,
        motif: story.motif,
        sections: merged,
        studentText: attempt.text,
      })),
      h(
        "div",
        { class: "row" },
        h("button", { class: "btn primary", onclick: () => run(story, key) }, "Retry this section"),
        h("button", { class: "btn", onclick: () => setup() }, "New drill"),
      ),
    );
  }

  setup();
  return cleanup;
}
