import { SECTIONS, SECTION_KEYS } from "../framework";
import { DEFAULT_MODEL, applyTheme, defaultSettings, loadApiKey, loadSettings, saveApiKey, saveSettings, type Settings } from "../storage";
import { clear, h, toast } from "../ui";

function numberField(label: string, value: number, min: number, max: number, onChange: (n: number) => void): HTMLElement {
  const input = h("input", { type: "number", min, max, step: 1, value: String(value), inputmode: "numeric" });
  input.addEventListener("change", () => {
    const n = Math.round(Number(input.value));
    if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
    else input.value = String(value);
  });
  return h("label", { class: "field" }, h("span", null, label), input);
}

export function settingsView(root: HTMLElement): () => void {
  const render = () => {
    clear(root);
    const s = loadSettings();
    const commit = (patch: Partial<Settings>) => {
      Object.assign(s, patch);
      saveSettings(s);
      toast("Saved.");
    };

    const full = h("div", { class: "fields" });
    const writingNote = h("p", { class: "muted small" });
    const updateNote = () => {
      const w = s.fullTotal - s.fullPlanning - s.fullRevision;
      writingNote.textContent = w > 0 ? `Writing time: ${w} min. Checkpoints scale to fit it.` : "Planning + revision must leave some writing time.";
    };
    full.append(
      numberField("Total (min)", s.fullTotal, 10, 120, (n) => { commit({ fullTotal: n }); updateNote(); }),
      numberField("Planning (min)", s.fullPlanning, 1, 30, (n) => { commit({ fullPlanning: n }); updateNote(); }),
      numberField("Revision (min)", s.fullRevision, 0, 30, (n) => { commit({ fullRevision: n }); updateNote(); }),
    );
    updateNote();

    const keyInput = h("input", { type: "password", autocomplete: "off", spellcheck: "false", placeholder: "sk-ant-…", "aria-label": "Anthropic API key" });
    keyInput.value = loadApiKey();
    const modelInput = h("input", { type: "text", spellcheck: "false", value: s.model, "aria-label": "Model" });

    const theme = h(
      "select",
      { "aria-label": "Theme" },
      (["system", "light", "dark"] as const).map((t) => h("option", { value: t, selected: s.theme === t }, t[0].toUpperCase() + t.slice(1))),
    );
    theme.addEventListener("change", () => {
      commit({ theme: theme.value as Settings["theme"] });
      applyTheme(s.theme);
    });

    const paste = h("input", { type: "checkbox", checked: s.blockPaste });
    paste.addEventListener("change", () => commit({ blockPaste: paste.checked }));

    root.append(
      h("h2", null, "Settings"),
      h(
        "section",
        { class: "card" },
        h("h3", null, "Drill time limits (minutes)"),
        h("div", { class: "fields" }, SECTION_KEYS.map((k) => numberField(SECTIONS[k].label, s.drillMinutes[k], 1, 60, (n) => commit({ drillMinutes: { ...s.drillMinutes, [k]: n } })))),
      ),
      h("section", { class: "card" }, h("h3", null, "Full story timing"), full, writingNote),
      h(
        "section",
        { class: "card" },
        h("h3", null, "Writing"),
        h("label", { class: "toggle" }, paste, h("span", null, "Block pasting into the editor")),
        h("label", { class: "field" }, h("span", null, "Theme"), theme),
      ),
      h(
        "section",
        { class: "card" },
        h("h3", null, "AI feedback (optional)"),
        h(
          "p",
          { class: "muted small" },
          "Your key is stored only in this browser's localStorage and sent only to api.anthropic.com when you ask for feedback. Each request is billed to your Anthropic account. Anyone with access to this browser profile can read the key, so don't use a shared computer.",
        ),
        h("label", { class: "field wide" }, h("span", null, "Anthropic API key"), keyInput),
        h("label", { class: "field wide" }, h("span", null, "Model"), modelInput),
        h(
          "div",
          { class: "row" },
          h(
            "button",
            {
              class: "btn primary",
              onclick: () => {
                saveApiKey(keyInput.value.trim());
                commit({ model: modelInput.value.trim() || DEFAULT_MODEL });
                modelInput.value = s.model;
              },
            },
            "Save key and model",
          ),
          h(
            "button",
            {
              class: "btn ghost",
              onclick: () => {
                saveApiKey("");
                keyInput.value = "";
                toast("Key removed.");
              },
            },
            "Remove key",
          ),
        ),
      ),
      h(
        "div",
        { class: "row" },
        h(
          "button",
          {
            class: "btn ghost",
            onclick: () => {
              if (confirm("Reset timings, theme, paste blocking and model to defaults? Your key and history are kept.")) {
                saveSettings(defaultSettings());
                applyTheme("system");
                render();
              }
            },
          },
          "Reset to defaults",
        ),
      ),
    );
  };
  render();
  return () => {};
}
