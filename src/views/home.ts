import { SECTIONS, SECTION_KEYS } from "../framework";
import { loadSettings } from "../storage";
import { STORIES } from "../stories";
import { clear, h } from "../ui";

export function homeView(root: HTMLElement): () => void {
  clear(root);
  const s = loadSettings();
  root.append(
    h(
      "section",
      { class: "hero" },
      h("h1", null, "Story Sprint"),
      h("p", { class: "lede" }, "Timed practice for the IB English creative writing task: a 400-500 word story from a picture, in about 38 minutes."),
    ),
    h(
      "div",
      { class: "modes" },
      h(
        "a",
        { class: "card mode", href: "#/drill" },
        h("h2", null, "Section drill"),
        h("p", null, `Rewrite one missing section of a model story so it fits what comes before and after. ${STORIES.length} stories, 2-10 minutes each.`),
        h("span", { class: "btn primary" }, "Start a drill"),
      ),
      h(
        "a",
        { class: "card mode", href: "#/full" },
        h("h2", null, "Full story"),
        h("p", null, `A random picture, ${s.fullPlanning} minutes to plan, then write and revise, with checkpoints. ${s.fullTotal} minutes in all.`),
        h("span", { class: "btn primary" }, "Start a story"),
      ),
    ),
    h(
      "details",
      { class: "card framework" },
      h("summary", null, h("strong", null, "The framework")),
      h(
        "ul",
        null,
        h("li", null, "One or two characters, one location, a short time span."),
        h("li", null, "Plan in shorthand: motif (an object from the picture), character (name / wants / hides), then plan backwards: climax and resolution first, then beat 3, 2, 1."),
      ),
      h(
        "table",
        { class: "targets" },
        h("thead", null, h("tr", null, h("th", null, "Section"), h("th", null, "Words"), h("th", null, "What it does"))),
        h(
          "tbody",
          null,
          SECTION_KEYS.map((k) => h("tr", null, h("td", null, SECTIONS[k].label), h("td", null, `~${SECTIONS[k].band.target}`), h("td", null, SECTIONS[k].job))),
        ),
      ),
      h(
        "p",
        { class: "muted small" },
        "Flagged: a narrator who states the lesson, emotion shown only through bodily clichés (heart pounding, breath catching, stomach dropping), clichéd openings, and a single-track plot with no inner problem.",
      ),
    ),
  );
  return () => {};
}
