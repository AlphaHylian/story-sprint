import { SECTIONS } from "../framework";
import { checklist, renderAi } from "../results";
import { clearHistory, deleteAttempt, loadHistory } from "../storage";
import type { Attempt } from "../types";
import { clear, download, formatDuration, h, prose } from "../ui";

function aiTotal(a: Attempt): string {
  if (!a.ai) return "—";
  const applicable = a.ai.criteria.filter((c) => c.applies);
  return `${applicable.reduce((n, c) => n + c.score, 0)}/${applicable.length * 5}`;
}

function what(a: Attempt): string {
  if (a.mode === "drill") return `${a.section ? SECTIONS[a.section].label : "Drill"} · ${a.storyTitle ?? ""}`;
  return a.plan?.motif ? `Full story · motif: ${a.plan.motif}` : "Full story";
}

function imageLabel(a: Attempt): string {
  if (!a.image) return "";
  if (a.image.kind === "picsum") return `picsum seed ${a.image.seed} (https://picsum.photos/seed/${a.image.seed}/960/640)`;
  if (a.image.kind === "upload") return `uploaded image ${a.image.name}`;
  return `written scene: ${a.image.text}`;
}

export function attemptsToText(list: Attempt[]): string {
  return list
    .map((a) => {
      const lines = [
        `=== ${new Date(a.date).toLocaleString()} · ${what(a)}`,
        `Mode: ${a.mode}${a.overtime ? " (overtime)" : ""}`,
        `Time used: ${formatDuration(a.timeUsedMs)} of ${formatDuration(a.timeLimitMs)}`,
        `Words: ${a.wordCount}`,
        `Built-in checks: ${a.builtIn.passed}/${a.builtIn.total}`,
        a.ai ? `AI score: ${aiTotal(a)} (${a.ai.model})` : "",
        a.image ? `Prompt: ${imageLabel(a)}` : "",
      ].filter(Boolean);
      if (a.plan) {
        const p = a.plan;
        lines.push(
          "",
          "PLAN",
          `Motif: ${p.motif}`,
          `Character: ${p.name} / wants ${p.want} / hides ${p.hide}`,
          `Exposition: ${p.exposition}`,
          `Inciting: ${p.inciting}`,
          `B1: ${p.b1_event} > ${p.b1_react} > ${p.b1_decide}`,
          `B2: ${p.b2_event} > ${p.b2_react} > ${p.b2_decide}`,
          `B3: ${p.b3_event} > ${p.b3_react}`,
          `Climax: ${p.climax}`,
          `Falling: ${p.falling}`,
          `Resolution: ${p.resolution}`,
        );
      }
      lines.push("", "TEXT", a.text.trim() || "(empty)", "", "CHECKS");
      for (const c of a.checks) lines.push(`[${c.pass ? "x" : " "}] ${c.label}: ${c.detail}`);
      if (a.ai) {
        lines.push("", "AI FEEDBACK", a.ai.overall);
        for (const c of a.ai.criteria) {
          lines.push(`- ${c.name}: ${c.applies ? `${c.score}/5` : "n/a"}`);
          for (const f of c.fixes) lines.push(`    fix: ${f}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n\n");
}

export function historyView(root: HTMLElement): () => void {
  const render = () => {
    clear(root);
    const list = loadHistory();
    const stamp = new Date().toISOString().slice(0, 10);
    root.append(
      h("h2", null, "History"),
      h(
        "div",
        { class: "row" },
        h("button", { class: "btn", disabled: !list.length, onclick: () => download(`story-sprint-${stamp}.json`, JSON.stringify(list, null, 2), "application/json") }, "Export JSON"),
        h("button", { class: "btn", disabled: !list.length, onclick: () => download(`story-sprint-${stamp}.txt`, attemptsToText(list), "text/plain") }, "Export text"),
        h(
          "button",
          {
            class: "btn ghost danger",
            disabled: !list.length,
            onclick: () => {
              if (confirm("Delete all attempts from this browser? Export first if you want to keep them.")) {
                clearHistory();
                render();
              }
            },
          },
          "Clear history",
        ),
      ),
      list.length
        ? h(
            "div",
            { class: "history" },
            list.map((a) =>
              h(
                "details",
                { class: "attempt card" },
                h(
                  "summary",
                  null,
                  h("span", { class: "a-date" }, new Date(a.date).toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })),
                  h("span", { class: "a-what" }, what(a)),
                  h("span", { class: "a-num" }, `${formatDuration(a.timeUsedMs)}${a.overtime ? " +OT" : ""}`),
                  h("span", { class: "a-num" }, `${a.wordCount}w`),
                  h("span", { class: "a-num", title: "Built-in checks passed" }, `✓ ${a.builtIn.passed}/${a.builtIn.total}`),
                  h("span", { class: "a-num", title: "AI score" }, `AI ${aiTotal(a)}`),
                ),
                h(
                  "div",
                  { class: "attempt-body" },
                  a.image ? h("p", { class: "muted small" }, imageLabel(a)) : null,
                  h("h4", null, "Text"),
                  prose(a.text || "(empty)"),
                  h("h4", null, "Checks"),
                  checklist(a.checks, a.mode === "full"),
                  a.ai ? [h("h4", null, "AI feedback"), renderAi(a.ai)] : null,
                  h(
                    "button",
                    {
                      class: "btn ghost danger",
                      onclick: () => {
                        if (confirm("Delete this attempt?")) {
                          deleteAttempt(a.id);
                          render();
                        }
                      },
                    },
                    "Delete",
                  ),
                ),
              ),
            ),
          )
        : h("p", { class: "muted" }, "No attempts yet. Finished drills and stories are saved here, in this browser only."),
    );
  };
  render();
  return () => {};
}
