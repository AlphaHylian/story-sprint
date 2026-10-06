import { createEditor, type Editor } from "../editor";
import { SECTIONS, SECTION_KEYS, STORY_BAND, checkpointsFor, type Checkpoint, type SectionKey } from "../framework";
import { countWords, gradeFullStory, score } from "../grader";
import { aiPanel, checklist, scoreBadge } from "../results";
import { SCENES } from "../scenes";
import {
  addAttempt,
  clearFullDraft,
  loadFullDraft,
  loadSettings,
  saveFullDraft,
  updateAttempt,
  type FullDraft,
  type FullPhase,
} from "../storage";
import { Clock, countdownDisplay } from "../timer";
import { EMPTY_PLAN, type Attempt, type ImageSource, type Plan } from "../types";
import { clear, formatClock, formatDuration, h, pick, prose, toast, uid } from "../ui";

const randomSeed = () => Math.random().toString(36).slice(2, 10);

export function picsumUrl(seed: string, w = 960, hgt = 640): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${hgt}`;
}

function describeImage(img: ImageSource, plan: Plan): string {
  const motif = plan.motif.trim() ? ` The student chose this motif from it: ${plan.motif.trim()}.` : "";
  if (img.kind === "scene") return img.text;
  if (img.kind === "upload") return `A photograph the student uploaded (not shown to you).${motif}`;
  return `A random photograph (not shown to you).${motif}`;
}

/** The picture prompt, or a written scene if the image fails to load. */
function imageView(img: ImageSource, onFallback?: (scene: string) => void, small = false): HTMLElement {
  if (img.kind === "scene" || (img.kind === "upload" && !img.dataUrl)) {
    const text = img.kind === "scene" ? img.text : "(Uploaded image was too large to keep.)";
    return h("figure", { class: `prompt scene${small ? " small" : ""}` }, h("blockquote", null, text), h("figcaption", null, "Written scene"));
  }
  const src = img.kind === "upload" ? img.dataUrl! : picsumUrl(img.seed);
  const el = h("img", { src, alt: "Picture prompt", class: "prompt-img", loading: "eager" });
  const fig = h("figure", { class: `prompt${small ? " small" : ""}` }, el);
  el.addEventListener("error", () => {
    if (!onFallback) return;
    const scene = pick(SCENES);
    fig.replaceWith(imageView({ kind: "scene", text: scene }, undefined, small));
    onFallback(scene);
  });
  return fig;
}

async function downscale(file: File, max = 800): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- plan form ----------

type PlanField = keyof Plan;
interface PlanRow {
  title: string;
  hint: string;
  fields: { key: PlanField; label: string; placeholder: string }[];
}

/** Planning order: motif and character, then backwards from the climax. */
const PLAN_ROWS: PlanRow[] = [
  { title: "Motif", hint: "One object from the picture.", fields: [{ key: "motif", label: "Motif", placeholder: "e.g. brass key" }] },
  {
    title: "Character",
    hint: "Name / what they want / what they hide.",
    fields: [
      { key: "name", label: "Name", placeholder: "name" },
      { key: "want", label: "Wants", placeholder: "wants…" },
      { key: "hide", label: "Hides", placeholder: "hides…" },
    ],
  },
  { title: "Climax", hint: "Plan this first: the choice they make.", fields: [{ key: "climax", label: "Climax", placeholder: "chooses to…" }] },
  { title: "Resolution", hint: "The motif returns and means something new.", fields: [{ key: "resolution", label: "Resolution", placeholder: "motif + final image" }] },
  { title: "Falling action", hint: "Immediate consequence, calmer.", fields: [{ key: "falling", label: "Falling action", placeholder: "consequence" }] },
  {
    title: "Beat 3",
    hint: "event > react. No decision: it closes the last easy exit.",
    fields: [
      { key: "b3_event", label: "B3 event", placeholder: "event" },
      { key: "b3_react", label: "B3 react", placeholder: "react" },
    ],
  },
  {
    title: "Beat 2",
    hint: "event > react > decide (the decision causes beat 3).",
    fields: [
      { key: "b2_event", label: "B2 event", placeholder: "event" },
      { key: "b2_react", label: "B2 react", placeholder: "react" },
      { key: "b2_decide", label: "B2 decide", placeholder: "decide" },
    ],
  },
  {
    title: "Beat 1",
    hint: "event > react > decide (the decision causes beat 2).",
    fields: [
      { key: "b1_event", label: "B1 event", placeholder: "event" },
      { key: "b1_react", label: "B1 react", placeholder: "react" },
      { key: "b1_decide", label: "B1 decide", placeholder: "decide" },
    ],
  },
  { title: "Inciting incident", hint: "One event that breaks the routine.", fields: [{ key: "inciting", label: "Inciting incident", placeholder: "the event" }] },
  { title: "Exposition", hint: "Opening action or line, a sensory detail, plant the motif.", fields: [{ key: "exposition", label: "Exposition", placeholder: "opening moment" }] },
];

function planForm(plan: Plan, onChange: () => void): HTMLElement {
  return h(
    "ol",
    { class: "plan-form" },
    PLAN_ROWS.map((row) =>
      h(
        "li",
        { class: "plan-row" },
        h("div", { class: "plan-title" }, h("strong", null, row.title), h("span", { class: "muted small" }, row.hint)),
        h(
          "div",
          { class: `plan-fields n${row.fields.length}` },
          row.fields.map((f) => {
            const input = h("input", { type: "text", placeholder: f.placeholder, "aria-label": f.label, autocomplete: "off" });
            input.value = plan[f.key];
            input.addEventListener("input", () => {
              plan[f.key] = input.value;
              onChange();
            });
            return input;
          }),
        ),
      ),
    ),
  );
}

/** Read-only plan in story order. */
function planSummary(plan: Plan): HTMLElement {
  const v = (s: string) => s.trim() || "—";
  const rows: [string, string][] = [
    ["Motif", v(plan.motif)],
    ["Character", `${v(plan.name)} / wants ${v(plan.want)} / hides ${v(plan.hide)}`],
    ["Exposition", v(plan.exposition)],
    ["Inciting", v(plan.inciting)],
    ["B1", `${v(plan.b1_event)} > ${v(plan.b1_react)} > ${v(plan.b1_decide)}`],
    ["B2", `${v(plan.b2_event)} > ${v(plan.b2_react)} > ${v(plan.b2_decide)}`],
    ["B3", `${v(plan.b3_event)} > ${v(plan.b3_react)}`],
    ["Climax", v(plan.climax)],
    ["Falling", v(plan.falling)],
    ["Resolution", v(plan.resolution)],
  ];
  return h("dl", { class: "plan-summary" }, rows.flatMap(([k, val]) => [h("dt", null, k), h("dd", null, val)]));
}

// ---------- timeline ----------

function timeline(totalMin: number, planningMin: number, revisionMin: number, cps: Checkpoint[]) {
  const pct = (min: number) => `${Math.min(100, (min / totalMin) * 100)}%`;
  const now = h("div", { class: "tl-now" });
  const fill = h("div", { class: "tl-fill" });
  const marks = cps.map((c) => {
    const status = h("span", { class: "tl-status" }, "·");
    const el = h(
      "div",
      { class: "tl-mark", style: `left:${pct(c.atMin)}` },
      h("div", { class: "tl-tick" }),
      h("div", { class: "tl-text" }, h("strong", null, formatClock(c.atMin * 60_000)), h("span", null, `${c.words}w`), status),
    );
    return { el, status, cp: c };
  });
  const el = h(
    "div",
    { class: "timeline", "aria-label": "Writing timeline" },
    h(
      "div",
      { class: "tl-track" },
      h("div", { class: "tl-zone plan", style: `width:${pct(planningMin)}` }),
      h("div", { class: "tl-zone rev", style: `left:${pct(totalMin - revisionMin)};width:${pct(revisionMin)}` }),
      fill,
      now,
    ),
    h("div", { class: "tl-marks" }, marks.map((m) => m.el)),
    h(
      "ul",
      { class: "tl-legend muted small" },
      cps.map((c) => h("li", null, `${formatClock(c.atMin * 60_000)} ${c.label} (~${c.words} words)`)),
    ),
  );
  return {
    el,
    update(elapsedMs: number, words: number, recorded: (number | null)[]) {
      const min = elapsedMs / 60_000;
      now.style.left = pct(min);
      fill.style.width = pct(min);
      marks.forEach((m, i) => {
        const at = recorded[i];
        const due = at === null || at === undefined;
        const n = due ? words : at;
        const ok = n >= m.cp.words;
        m.el.classList.toggle("met", ok);
        m.el.classList.toggle("missed", !due && !ok);
        m.status.textContent = due ? (ok ? "✓" : "·") : ok ? "✓" : `✗ ${at}`;
      });
    },
  };
}

const REVISION_TIPS = [
  "First sentence: mid-action or dialogue, no waking up or weather?",
  "Motif named in the first paragraph and back, changed, in the last?",
  'Three rising beats, each its own paragraph; beats 1 and 2 end in a decision; no "and then"?',
  "Climax is a choice, in short sentences with one physical detail?",
  "Last line ends on an image or action, with no lesson explained?",
  "Swap any pounding heart or dropping stomach for something the character does.",
];

// ---------- view ----------

export function fullView(root: HTMLElement): () => void {
  let clock: Clock | null = null;
  const cleanup = () => clock?.stop();

  function setup(): void {
    cleanup();
    clear(root);
    const settings = loadSettings();
    let image: ImageSource = { kind: "picsum", seed: randomSeed() };
    const frame = h("div", { class: "prompt-frame" });
    const showImage = () => {
      frame.replaceChildren(
        imageView(image, (scene) => {
          image = { kind: "scene", text: scene };
          toast("The picture couldn't load, so here is a written scene instead.");
        }),
      );
    };
    showImage();

    const fileInput = h("input", { type: "file", accept: "image/*", class: "visually-hidden", id: "upload" });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        image = { kind: "upload", dataUrl: await downscale(file), name: file.name };
        showImage();
      } catch {
        toast("That file couldn't be read as an image.");
      }
    });

    const draft = loadFullDraft();
    const resume = draft
      ? h(
          "div",
          { class: "card notice" },
          h("p", null, `Unfinished story from ${new Date(draft.savedAt).toLocaleString()}: ${draft.phase}, ${formatClock(draft.elapsedMs)} elapsed, ${countWords(draft.text)} words.`),
          h(
            "div",
            { class: "row" },
            h("button", { class: "btn", onclick: () => run(draft) }, "Resume"),
            h("button", { class: "btn ghost", onclick: () => { clearFullDraft(); setup(); } }, "Discard"),
          ),
        )
      : null;

    const writing = settings.fullTotal - settings.fullPlanning - settings.fullRevision;
    root.append(
      h("h2", null, "Full story"),
      h(
        "p",
        { class: "lede" },
        `${settings.fullTotal} minutes: plan for ${settings.fullPlanning}, write for ${writing}, revise for ${settings.fullRevision}. Aim for 400-500 words.`,
      ),
      resume ?? "",
      h(
        "div",
        { class: "card" },
        frame,
        h(
          "div",
          { class: "row" },
          h("button", { class: "btn", onclick: () => { image = { kind: "picsum", seed: randomSeed() }; showImage(); } }, "New image"),
          h("label", { class: "btn", for: "upload" }, "Upload my own"),
          fileInput,
          h("button", { class: "btn ghost", onclick: () => { image = { kind: "scene", text: pick(SCENES) }; showImage(); } }, "Use a written scene"),
        ),
        h(
          "div",
          { class: "row" },
          h(
            "button",
            {
              class: "btn primary",
              onclick: () => {
                clearFullDraft();
                run({
                  image,
                  plan: { ...EMPTY_PLAN },
                  text: "",
                  phase: "planning",
                  elapsedMs: 0,
                  overtime: false,
                  checkpointWords: [],
                  savedAt: new Date().toISOString(),
                });
              },
            },
            `Start planning (${settings.fullPlanning} min)`,
          ),
        ),
      ),
    );
  }

  function run(state: FullDraft): void {
    cleanup();
    clear(root);
    window.scrollTo(0, 0);
    const settings = loadSettings();
    const T = settings.fullTotal;
    const P = Math.min(settings.fullPlanning, T);
    const R = Math.min(settings.fullRevision, T - P);
    const totalMs = T * 60_000;
    const planEndMs = P * 60_000;
    const writeEndMs = (T - R) * 60_000;
    const cps = checkpointsFor(P, T, R);
    const plan = state.plan;
    let phase: FullPhase = state.phase;
    let overtime = state.overtime;
    let finished = false;
    const recorded = cps.map((_, i) => state.checkpointWords[i] ?? null);
    let image = state.image;

    const save = () =>
      saveFullDraft({
        image,
        plan,
        text: editor?.value() ?? state.text,
        phase,
        elapsedMs: clock?.elapsed() ?? state.elapsedMs,
        overtime,
        checkpointWords: recorded,
        savedAt: new Date().toISOString(),
      });

    const countdown = countdownDisplay("");
    const phaseBtn = h("button", { class: "btn" });
    const submitBtn = h("button", { class: "btn primary", onclick: () => submit() }, "Submit");
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
            editor?.setLocked(false);
            editor?.focus();
            save();
          },
        },
        "Keep writing (overtime)",
      ),
    );
    const bar = h("div", { class: "timerbar" }, countdown.el, h("div", { class: "timerbar-actions" }, timeUp, phaseBtn, submitBtn));
    const body = h("div");
    root.append(bar, body);

    let editor: Editor | null = null;
    let tl: ReturnType<typeof timeline> | null = null;

    const fallback = (scene: string) => {
      image = { kind: "scene", text: scene };
      save();
    };

    function renderPlanning(): void {
      editor = null;
      tl = null;
      countdown.setLabel("Planning");
      countdown.reset();
      phaseBtn.textContent = "Start writing now";
      phaseBtn.onclick = () => enter("writing");
      submitBtn.hidden = true;
      body.replaceChildren(
        h(
          "div",
          { class: "split plan-layout" },
          h("aside", { class: "side" }, imageView(image, fallback)),
          h(
            "section",
            { class: "card" },
            h("h2", null, "Plan in shorthand"),
            h("p", { class: "muted" }, "Plan backwards: after the motif and character, fix the climax and resolution first, then beat 3, 2, 1. Notes only, not sentences."),
            planForm(plan, save),
          ),
        ),
      );
    }

    function renderWriting(): void {
      const revising = phase === "revision";
      countdown.setLabel(revising ? "Revision" : `Writing · revise from ${formatClock(writeEndMs)}`);
      countdown.reset();
      phaseBtn.textContent = "Start revision now";
      phaseBtn.hidden = revising;
      phaseBtn.onclick = () => enter("revision");
      submitBtn.hidden = false;
      const text = editor?.value() ?? state.text;
      editor = createEditor({
        value: text,
        band: STORY_BAND,
        label: "Your story",
        placeholder: "Start in the middle of a moment…",
        blockPaste: settings.blockPaste,
        rows: 22,
        showParagraphs: true,
        onInput: save,
      });
      tl = timeline(T, P, R, cps);
      body.replaceChildren(
        h(
          "div",
          { class: "split write-layout" },
          h("aside", { class: "side" }, imageView(image, fallback, true), h("div", { class: "card plan-card" }, h("h3", null, "Your plan"), planSummary(plan))),
          h(
            "section",
            null,
            revising
              ? h(
                  "div",
                  { class: "card notice" },
                  h("h3", null, "Revision"),
                  h("ul", { class: "tips" }, REVISION_TIPS.map((t) => h("li", null, t))),
                )
              : tl.el,
            editor.el,
          ),
        ),
      );
      editor.focus();
    }

    function enter(next: FullPhase): void {
      phase = next;
      if (next === "planning") renderPlanning();
      else renderWriting();
      save();
    }

    if (phase === "planning") renderPlanning();
    else renderWriting();

    let lastSave = 0;
    clock = new Clock((e) => {
      if (phase === "planning" && e >= planEndMs) {
        enter("writing");
        toast("Planning time is up. Start writing.");
      }
      if (phase === "writing" && e >= writeEndMs) {
        enter("revision");
        toast("Revision time: read it through and fix.");
      }
      if (phase !== "planning") {
        const words = editor?.words() ?? 0;
        cps.forEach((c, i) => {
          if (recorded[i] === null && e >= c.atMin * 60_000) {
            recorded[i] = words;
            toast(words >= c.words ? `Checkpoint: ${c.label}. On track.` : `Checkpoint: ${c.label}. You're behind (${words}/${c.words} words).`);
          }
        });
        tl?.update(e, words, recorded);
      }
      const phaseEnd = phase === "planning" ? planEndMs : phase === "writing" ? writeEndMs : totalMs;
      const warn = countdown.update(overtime ? e - totalMs : phaseEnd - e, overtime);
      if (warn) toast(phase === "revision" ? "One minute left." : `One minute left of ${phase}.`);
      if (phase === "revision" && !overtime && e >= totalMs && timeUp.hidden && !finished) {
        editor?.setLocked(true);
        timeUp.hidden = false;
        phaseBtn.hidden = true;
        save();
      }
      if (e - lastSave > 5000) {
        lastSave = e;
        save();
      }
    });
    clock.start(state.elapsedMs);

    function submit(): void {
      if (finished) return;
      finished = true;
      clock?.stop();
      const text = editor?.value() ?? state.text;
      const g = gradeFullStory(text, plan);
      const attempt: Attempt = {
        id: uid(),
        date: new Date().toISOString(),
        mode: "full",
        image: image,
        plan: { ...plan },
        text,
        mapping: g.mapping,
        timeLimitMs: totalMs,
        timeUsedMs: clock?.elapsed() ?? 0,
        overtime,
        wordCount: countWords(text),
        builtIn: score(g.checks),
        checks: g.checks,
      };
      if (!addAttempt(attempt)) toast("Could not save to history (storage full?).");
      clearFullDraft();
      results(attempt);
    }
  }

  function results(attempt: Attempt): void {
    cleanup();
    clear(root);
    window.scrollTo(0, 0);
    const plan = attempt.plan ?? { ...EMPTY_PLAN };
    const checksBox = h("div");
    const storyBox = h("div");
    const scoreBox = h("span");
    const mapBox = h("ol", { class: "map-list" });

    const regrade = (mapping?: SectionKey[]) => {
      const g = gradeFullStory(attempt.text, plan, mapping);
      attempt.mapping = g.mapping;
      attempt.checks = g.checks;
      attempt.builtIn = score(g.checks);
      checksBox.replaceChildren(checklist(g.checks, true));
      scoreBox.replaceChildren(scoreBadge(g.checks));
      storyBox.replaceChildren(
        h(
          "div",
          { class: "story-flow" },
          SECTION_KEYS.filter((k) => g.sections[k]).map((k) =>
            h("section", { class: "story-part" }, h("div", { class: "part-label" }, SECTIONS[k].label), prose(g.sections[k])),
          ),
        ),
      );
      mapBox.replaceChildren(
        ...g.paragraphs.map((p, i) => {
          const select = h(
            "select",
            { "aria-label": `Section for paragraph ${i + 1}` },
            SECTION_KEYS.map((k) => h("option", { value: k, selected: g.mapping[i] === k }, SECTIONS[k].label)),
          );
          select.addEventListener("change", () => {
            const m = [...g.mapping];
            m[i] = select.value as SectionKey;
            regrade(m);
            updateAttempt(attempt);
          });
          return h("li", null, select, h("span", { class: "map-text" }, p.length > 90 ? p.slice(0, 90) + "…" : p));
        }),
      );
      return g;
    };
    const g0 = regrade(attempt.mapping);

    root.append(
      h(
        "div",
        { class: "results-head" },
        h("h2", null, "Full story: results"),
        h(
          "p",
          { class: "muted" },
          `${attempt.wordCount} words · ${formatDuration(attempt.timeUsedMs)} of ${formatDuration(attempt.timeLimitMs)} `,
          attempt.overtime ? h("span", { class: "pill warn" }, "overtime") : null,
          " ",
          scoreBox,
        ),
      ),
      h(
        "div",
        { class: "split results-layout" },
        h("aside", { class: "side" }, attempt.image ? imageView(attempt.image, undefined, true) : null, h("div", { class: "card plan-card" }, h("h3", null, "Your plan"), planSummary(plan))),
        h(
          "div",
          null,
          h(
            "section",
            { class: "card" },
            h("h3", null, "Section map"),
            h("p", { class: "muted small" }, "Each paragraph was matched to a section automatically. If a guess is wrong, change it and the checks update."),
            mapBox,
          ),
          h("section", { class: "card" }, h("h3", null, "Built-in checks"), checksBox),
          aiPanel(attempt, () => ({
            mode: "full",
            picture: describeImage(attempt.image ?? { kind: "scene", text: "" }, plan),
            plan,
            story: attempt.text,
            mapping: (attempt.mapping ?? g0.mapping).map((s, i) => ({ section: s, text: g0.paragraphs[i] })),
          })),
          h("section", { class: "card" }, h("h3", null, "Your story by section"), storyBox),
          h("div", { class: "row" }, h("button", { class: "btn primary", onclick: () => setup() }, "New story")),
        ),
      ),
    );
  }

  setup();
  return cleanup;
}
