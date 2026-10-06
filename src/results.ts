import { AiError, getAiFeedback, type DrillRequest, type FullRequest } from "./ai";
import { SECTIONS, SECTION_KEYS } from "./framework";
import { score } from "./grader";
import { loadApiKey, loadSettings, updateAttempt } from "./storage";
import type { AiFeedback, Attempt, Check, CheckGroup } from "./types";
import { h } from "./ui";

const GROUP_LABELS: Record<CheckGroup, string> = {
  story: "Whole story",
  plan: "Plan",
  ...(Object.fromEntries(SECTION_KEYS.map((k) => [k, SECTIONS[k].label])) as Record<string, string>),
} as Record<CheckGroup, string>;

function checkItem(c: Check): HTMLElement {
  return h(
    "li",
    { class: `check ${c.pass ? "pass" : "fail"}` },
    h("span", { class: "mark", "aria-label": c.pass ? "pass" : "fail" }, c.pass ? "✓" : "✗"),
    h("div", null, h("div", { class: "check-label" }, c.label), h("div", { class: "check-detail" }, c.detail)),
  );
}

export function scoreBadge(checks: Check[]): HTMLElement {
  const s = score(checks);
  const pct = s.total ? s.passed / s.total : 0;
  return h("span", { class: `score ${pct >= 0.85 ? "good" : pct >= 0.6 ? "mid" : "low"}` }, `${s.passed}/${s.total}`);
}

/** Checklist, optionally grouped by section with a per-group score. */
export function checklist(checks: Check[], grouped: boolean): HTMLElement {
  if (!grouped) return h("ul", { class: "checklist" }, checks.map(checkItem));
  const order: CheckGroup[] = ["story", ...SECTION_KEYS, "plan"];
  return h(
    "div",
    { class: "check-groups" },
    order
      .map((g) => ({ g, items: checks.filter((c) => c.group === g) }))
      .filter(({ items }) => items.length)
      .map(({ g, items }) =>
        h(
          "section",
          { class: "check-group" },
          h("h4", null, GROUP_LABELS[g], " ", scoreBadge(items)),
          h("ul", { class: "checklist" }, items.map(checkItem)),
        ),
      ),
  );
}

export function renderAi(fb: AiFeedback): HTMLElement {
  const applicable = fb.criteria.filter((c) => c.applies);
  const total = applicable.reduce((n, c) => n + c.score, 0);
  return h(
    "div",
    { class: "ai-feedback" },
    h(
      "p",
      { class: "ai-total" },
      h("strong", null, `AI score: ${total}/${applicable.length * 5}`),
      h("span", { class: "muted small" }, ` · ${fb.model}`),
    ),
    fb.overall ? h("p", { class: "ai-overall" }, fb.overall) : null,
    fb.criteria.map((c) =>
      h(
        "details",
        { class: "ai-criterion", open: c.applies && c.score < 4 },
        h(
          "summary",
          null,
          h("span", { class: "ai-name" }, c.name),
          c.applies
            ? h("span", { class: `ai-score s${c.score}` }, `${c.score}/5`)
            : h("span", { class: "ai-score na" }, "n/a"),
        ),
        c.applies
          ? h(
              "div",
              { class: "ai-body" },
              c.present.length ? h("p", null, h("strong", null, "Present: "), c.present.join("; ")) : null,
              c.missing.length ? h("p", null, h("strong", null, "Missing: "), c.missing.join("; ")) : null,
              c.evidence.length
                ? h(
                    "ul",
                    { class: "ai-evidence" },
                    c.evidence.map((e) => h("li", null, h("q", null, e.quote), " ", h("span", null, e.comment))),
                  )
                : null,
              c.fixes.length
                ? h("div", null, h("strong", null, "Fixes:"), h("ol", { class: "ai-fixes" }, c.fixes.map((f) => h("li", null, f))))
                : null,
            )
          : h("p", { class: "muted small ai-body" }, "Not judged for this piece."),
      ),
    ),
  );
}

/** "Get AI feedback" panel. Saves the result onto the attempt in history. */
export function aiPanel(attempt: Attempt, buildRequest: () => DrillRequest | FullRequest): HTMLElement {
  const body = h("div");
  const status = h("p", { class: "muted small", role: "status" });
  const button = h("button", { class: "btn" }, attempt.ai ? "Ask again" : "Get AI feedback");
  const panel = h("section", { class: "card" }, h("h3", null, "AI feedback"), status, button, body);

  if (attempt.ai) body.appendChild(renderAi(attempt.ai));
  if (!loadApiKey()) {
    status.append("Optional. Add an Anthropic API key in ", h("a", { href: "#/settings" }, "Settings"), " to get criterion scores and specific fixes.");
    button.disabled = true;
  } else {
    status.textContent = "Scores structure, rising chain, climax, language and ending out of 5, quoting your sentences. It will not rewrite your story.";
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "Asking the model… this can take up to a minute.";
    try {
      const fb = await getAiFeedback(loadApiKey(), loadSettings().model, buildRequest());
      attempt.ai = fb;
      updateAttempt(attempt);
      body.replaceChildren(renderAi(fb));
      status.textContent = "Saved to your history.";
      button.textContent = "Ask again";
    } catch (e) {
      status.textContent = e instanceof AiError ? e.message : "Something went wrong getting feedback. Try again.";
    } finally {
      button.disabled = false;
    }
  });
  return panel;
}
