import { bandStatus, type Band } from "./framework";
import { countWords, paragraphs } from "./grader";
import { h, toast } from "./ui";

export interface EditorOptions {
  value: string;
  band: Band;
  label: string;
  placeholder?: string;
  blockPaste: boolean;
  rows?: number;
  showParagraphs?: boolean;
  onInput?: (text: string) => void;
}

export interface Editor {
  el: HTMLElement;
  textarea: HTMLTextAreaElement;
  value(): string;
  words(): number;
  setLocked(locked: boolean): void;
  setBand(band: Band, label?: string): void;
  focus(): void;
}

/** A plain textarea with a live, band-coloured word count and optional paste blocking. */
export function createEditor(opts: EditorOptions): Editor {
  let band = opts.band;
  const textarea = h("textarea", {
    class: "editor",
    rows: opts.rows ?? 14,
    placeholder: opts.placeholder ?? "",
    spellcheck: "true",
    "aria-label": opts.label,
  });
  textarea.value = opts.value;

  const count = h("span", { class: "wordcount" });
  const paraCount = h("span", { class: "muted small" });
  const bandText = h("span", { class: "muted small" });
  const bar = h("div", { class: "editor-bar" }, count, bandText, opts.showParagraphs ? paraCount : null);

  const refresh = () => {
    const n = countWords(textarea.value);
    count.textContent = `${n} word${n === 1 ? "" : "s"}`;
    count.dataset.status = bandStatus(n, band);
    bandText.textContent = `target ${band.target} (${band.min}-${band.max})`;
    const p = paragraphs(textarea.value).length;
    paraCount.textContent = `${p} paragraph${p === 1 ? "" : "s"}`;
  };

  textarea.addEventListener("input", () => {
    refresh();
    opts.onInput?.(textarea.value);
  });

  if (opts.blockPaste) {
    const block = (e: Event) => {
      e.preventDefault();
      toast("Pasting is off for practice. You can turn it on in Settings.");
    };
    textarea.addEventListener("paste", block);
    textarea.addEventListener("drop", block);
  }

  refresh();
  const el = h("div", { class: "editor-wrap" }, textarea, bar);

  return {
    el,
    textarea,
    value: () => textarea.value,
    words: () => countWords(textarea.value),
    setLocked(locked) {
      textarea.readOnly = locked;
      el.classList.toggle("locked", locked);
    },
    setBand(b) {
      band = b;
      refresh();
    },
    focus: () => textarea.focus(),
  };
}
