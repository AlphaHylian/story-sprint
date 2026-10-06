# Story Sprint

A timed practice tool for the IB English creative writing assessment: a 400-500 word story from a picture prompt in about 38 minutes, with an exposition, inciting incident, rising action, climax, falling action and resolution.

Live site: https://alphahylian.github.io/story-sprint/

It is a static site (Vite + TypeScript, no backend). Everything you write stays in your browser's localStorage.

## The two modes

### Section drill

1. Pick a section (exposition, inciting incident, rising action, climax, falling action, resolution) or **Random**, and a story or **Random story**.
2. The story is shown with that section removed. The sections before and after are read-only, so what you write has to fit between them.
3. A brief says what the missing section must do in this story, with its word target and time limit (defaults: exposition 4 min, inciting 2, rising 10, climax 6, falling 2, resolution 3; editable in Settings).
4. On **Submit**, or when time runs out, you get the built-in checklist, your section next to the original, and the full story with your section in place so you can read it through.

### Full story

1. Get a random picture from picsum.photos (**New image** for another), upload your own, or use a written scene. If the picture can't load, a written scene is used instead.
2. **Planning (6 min):** a shorthand plan in planning order: motif, character (name / wants / hides), then backwards: climax, resolution, falling action, beat 3, 2, 1, inciting incident, exposition. Beats 1 and 2 have event > react > decide; beat 3 has no decision.
3. **Writing:** the plan stays beside the editor. A timeline shows the checkpoints (expo + inciting by 12:00, rising by 22:00, climax by 28:00, ending by 33:00) and the word count expected at each.
4. **Revision (5 min):** a short revision checklist replaces the timeline.
5. Results grade the whole story section by section. Paragraphs are matched to sections automatically (eight paragraphs map one-to-one); if a guess is wrong, change it in the **Section map** and the checks update.

The total (38 min), planning and revision times are editable. Checkpoints scale to fit the writing time.

### Both modes

- Big countdown with a warning in the last minute. When time is up the editor locks; **Keep writing (overtime)** unlocks it and marks the attempt as overtime.
- Live word count, coloured by the target band.
- Paste blocking (on by default; Settings).
- Drafts autosave, so a closed tab can be resumed.
- **History** lists every attempt (date, mode, section, time used, words, scores) with export to JSON or plain text.
- Light and dark mode.

## Grading

**Built-in checks** run offline with no API key: word count against each band; three rising-action paragraphs of about 50 words; no "and then"; a visible decision in beats 1 and 2 and none in beat 3; climax sentences shorter on average than the exposition's; motif in both exposition and resolution; cliché openings; a stated moral in the final paragraph; bodily-sensation clichés; and, in full-story mode, whether the plan is complete and names a hidden feeling. The checks are deliberately simple pattern matches, so treat them as prompts to look again rather than a mark.

**AI feedback (optional):** paste an Anthropic API key in **Settings**. It is stored only in localStorage and sent only to `api.anthropic.com`, straight from the browser. The model (default `claude-opus-5-5`, editable) scores structure, rising action chain, climax as a choice, language, ending and, in drills, fit with the surrounding sections, each out of 5, with evidence quoted from your writing and two or three fixes. It is instructed never to rewrite your story. Requests are billed to your Anthropic account.

## The story bank

`src/data/stories.json` holds 12 original model stories (461-490 words) in five shapes: return, discovery, last time, wait and split loyalty. Each has a picture description, motif, the character's want and hidden feeling, the six sections, the three labelled rising beats and a one-line brief per section. A test checks that every story is in range and passes every built-in check.

## Development

```sh
npm install
npm run dev      # local server
npm test         # grader and story bank tests
npm run build    # typecheck + production build into dist/
```

## Deployment

`.github/workflows/deploy.yml` tests, builds and deploys to GitHub Pages on every push to `main`. In the repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions** once.

The Vite base path is `/story-sprint/` for the project Pages site. The workflow sets it from the repository name; for a custom domain, build with `BASE_PATH=/`.
