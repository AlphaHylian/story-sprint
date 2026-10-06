import "./style.css";
import { applyTheme, loadSettings, saveSettings } from "./storage";
import { h } from "./ui";
import { drillView } from "./views/drill";
import { fullView } from "./views/full";
import { historyView } from "./views/history";
import { homeView } from "./views/home";
import { settingsView } from "./views/settings";

type View = (root: HTMLElement) => () => void;
const ROUTES: Record<string, { view: View; title: string }> = {
  "": { view: homeView, title: "Story Sprint" },
  drill: { view: drillView, title: "Section drill" },
  full: { view: fullView, title: "Full story" },
  history: { view: historyView, title: "History" },
  settings: { view: settingsView, title: "Settings" },
};

const app = document.getElementById("app")!;
const main = h("main", { id: "main", class: "container" });

const nav = h(
  "nav",
  { "aria-label": "Main" },
  [
    ["drill", "Drill"],
    ["full", "Full story"],
    ["history", "History"],
    ["settings", "Settings"],
  ].map(([route, label]) => h("a", { href: `#/${route}`, "data-route": route }, label)),
);

const themeBtn = h("button", { class: "icon-btn", "aria-label": "Toggle light or dark mode", title: "Toggle light/dark" });
themeBtn.innerHTML =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/></svg>';
themeBtn.addEventListener("click", () => {
  const s = loadSettings();
  const dark =
    s.theme === "dark" || (s.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  s.theme = dark ? "light" : "dark";
  saveSettings(s);
  applyTheme(s.theme);
});

app.append(
  h("header", { class: "site-header" }, h("div", { class: "container header-inner" }, h("a", { href: "#/", class: "brand" }, "Story Sprint"), nav, themeBtn)),
  main,
);

let cleanup: () => void = () => {};
function route(): void {
  cleanup();
  const key = location.hash.replace(/^#\/?/, "").split("/")[0];
  const r = ROUTES[key] ?? ROUTES[""];
  document.title = r === ROUTES[""] ? "Story Sprint" : `${r.title} · Story Sprint`;
  nav.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.route === key));
  main.replaceChildren();
  cleanup = r.view(main);
}

applyTheme(loadSettings().theme);
window.addEventListener("hashchange", route);
route();
