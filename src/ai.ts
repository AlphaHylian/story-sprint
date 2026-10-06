// Optional AI feedback: calls the Anthropic Messages API straight from the browser
// with the student's own key. The key is read from localStorage, passed to the SDK
// client and sent only to api.anthropic.com. It is never logged or stored elsewhere.

import { SECTIONS, type SectionKey } from "./framework";
import type { AiCriterion, AiFeedback, Plan } from "./types";

export const CRITERIA = [
  {
    id: "structure",
    name: "Structure",
    full: "All six sections in order (exposition, inciting incident, rising action, climax, falling action, resolution); one or two characters, one location, a short time span. The exposition opens mid-moment with action or dialogue, has one concrete sensory detail and plants the motif. The inciting incident is one event that breaks the routine.",
  },
  {
    id: "rising_chain",
    name: "Rising action chain",
    full: "Exactly three beats, one paragraph each (~50 words). Each beat is event > reaction > decision, and each decision causes the next beat. Beats are linked by 'but' or 'therefore' logic, never 'and then'. Pressure on the character's hidden feeling increases each beat. Beat 3 closes the last easy exit and has no decision.",
  },
  {
    id: "climax_choice",
    name: "Climax as a choice",
    full: "The climax is a choice the character makes, not something that happens to them. Slower pace, shorter sentences, specific physical detail.",
  },
  {
    id: "language",
    name: "Language",
    full: "Specific, concrete detail and deliberate sentence variety. No clichéd opening (waking up, alarm clocks, weather reports). Emotion is shown through action and detail, not bodily-sensation clichés (heart pounding, breath catching, stomach dropping).",
  },
  {
    id: "ending",
    name: "Ending",
    full: "The falling action is the immediate, calmer consequence of the choice. The resolution brings the motif back so it means something different, and ends on an image or small action. The narrator never states the moral or explains the story; ambiguity is fine.",
  },
  {
    id: "fit",
    name: "Fit with surrounding sections",
    full: "Drill mode only. The student's section fits what comes before and after it: names, facts, objects, point of view, tense and voice are consistent; it picks up from the previous section and sets up the next one.",
  },
] as const;

export type CriterionId = (typeof CRITERIA)[number]["id"];

/** Models that accept server-side refusal fallbacks and an explicit effort setting. */
function isCurrentGen(model: string): boolean {
  return /^claude-(opus-5|fable-5|sonnet-5-5|mythos-5)/.test(model);
}

const SYSTEM_PROMPT = `You are an experienced IB English teacher giving feedback on a timed creative-writing practice piece. Students write a 400-500 word story from a picture prompt in about 38 minutes. You grade strictly against the framework below, and your feedback is read by the student straight after writing.

THE FRAMEWORK
- One or two characters, one location, a short time span.
- Word targets: exposition ~75, inciting incident ~50, rising action ~150, climax ~90, falling action ~50, resolution ~60.
- Exposition: opens mid-moment with action or dialogue (no waking up, no alarm clocks, no weather-report openings), includes one concrete sensory detail, plants the motif (an object from the picture).
- Inciting incident: one event that breaks the routine.
- Rising action: exactly three beats, one paragraph each, ~50 words each. Each beat is event > reaction > decision, and the decision causes the next beat. Beats are linked by "but" or "therefore", never "and then". Each beat puts more pressure on the character's hidden feeling. Beat 3 closes off the last easy exit and has no decision, because the decision is the climax.
- Climax: the character makes a choice. Slower pace, shorter sentences, specific physical detail.
- Falling action: the immediate consequence of the choice, calmer.
- Resolution: the motif returns and means something different. Ends on an image or small action. The narrator never states the moral or explains what the story meant. Ambiguity is fine.
- Flag: narrator stating the lesson; emotion shown only through bodily-sensation clichés (heart pounding, breath catching, stomach dropping); clichéd openings; a single-track plot with no inner problem.

CRITERIA (each scored as a whole number from 0 to 5, where 5 means it fully meets the framework)
${CRITERIA.map((c) => `- ${c.id} (${c.name}): ${c.full}`).join("\n")}

RULES
- Return exactly one entry per criterion id listed in the request, in that order.
- "present" and "missing" list the framework elements for that criterion, in a few words each.
- "evidence" points to the student's own sentences: each quote must be copied exactly from the student's writing and be short (under 20 words). Never quote the teacher-written context sections. Give 1-3 evidence items when the criterion applies.
- "fixes" gives two or three specific, actionable instructions the student can carry out themselves, e.g. "Cut the final sentence that explains what she learned and end on the action before it." Never write replacement sentences, never rewrite, continue or improve the story for them, and never supply example prose of more than three words.
- In drill mode the student wrote only one section. Judge each criterion on what the student's section contributes. If a criterion cannot be judged from their section at all, set "applies" to false, "score" to 0 and leave the lists empty. "fit" always applies in drill mode.
- In full-story mode "fit" does not apply: set "applies" to false.
- Be honest and specific. Reward what works; do not inflate scores.
- "overall" is two or three sentences: the single most important thing to work on next, addressed to the student as "you".`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["criteria", "overall"],
  properties: {
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "applies", "score", "present", "missing", "evidence", "fixes"],
        properties: {
          id: { type: "string", enum: CRITERIA.map((c) => c.id) },
          applies: { type: "boolean" },
          score: { type: "integer", description: "0 to 5" },
          present: { type: "array", items: { type: "string" } },
          missing: { type: "array", items: { type: "string" } },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["quote", "comment"],
              properties: { quote: { type: "string" }, comment: { type: "string" } },
            },
          },
          fixes: { type: "array", items: { type: "string" } },
        },
      },
    },
    overall: { type: "string" },
  },
} as const;

export interface DrillRequest {
  mode: "drill";
  section: SectionKey;
  brief: string;
  storyTitle: string;
  picture: string;
  motif: string;
  /** The bank story's sections, with the student's section in place. */
  sections: Record<SectionKey, string>;
  studentText: string;
}

export interface FullRequest {
  mode: "full";
  picture: string;
  plan: Plan;
  story: string;
  /** Section guessed for each paragraph, to help the model navigate. */
  mapping: { section: SectionKey; text: string }[];
}

function buildUserMessage(req: DrillRequest | FullRequest): string {
  if (req.mode === "drill") {
    const info = SECTIONS[req.section];
    const order = Object.keys(req.sections) as SectionKey[];
    const parts = order.map((k) =>
      k === req.section
        ? `<student_section name="${SECTIONS[k].label}">\n${req.studentText.trim()}\n</student_section>`
        : `<context_section name="${SECTIONS[k].label}" author="teacher">\n${req.sections[k]}\n</context_section>`,
    );
    return [
      `MODE: drill. The student wrote only the ${info.label.toLowerCase()} (target ~${info.band.target} words) to fit into a teacher-written story.`,
      `Criteria to return, in order: ${CRITERIA.map((c) => c.id).join(", ")}.`,
      `Story: "${req.storyTitle}". Picture: ${req.picture} Motif: ${req.motif}.`,
      `Brief for the student's section: ${req.brief}`,
      `What this section must do: ${info.job}`,
      "",
      parts.join("\n\n"),
    ].join("\n");
  }
  const p = req.plan;
  const plan = [
    `motif: ${p.motif}`,
    `character: ${p.name} / wants: ${p.want} / hides: ${p.hide}`,
    `exposition: ${p.exposition}`,
    `inciting: ${p.inciting}`,
    `B1: ${p.b1_event} > ${p.b1_react} > ${p.b1_decide}`,
    `B2: ${p.b2_event} > ${p.b2_react} > ${p.b2_decide}`,
    `B3: ${p.b3_event} > ${p.b3_react}`,
    `climax: ${p.climax}`,
    `falling: ${p.falling}`,
    `resolution: ${p.resolution}`,
  ].join("\n");
  const paras = req.mapping.map((m, i) => `[${i + 1} | ${SECTIONS[m.section].label}] ${m.text}`).join("\n\n");
  return [
    "MODE: full story.",
    `Criteria to return, in order: ${CRITERIA.map((c) => c.id).join(", ")}.`,
    `Picture prompt: ${req.picture}`,
    "",
    `<student_plan>\n${plan}\n</student_plan>`,
    "",
    "The paragraph labels are an automatic guess at which section each paragraph is; judge the writing itself.",
    `<student_story>\n${paras}\n</student_story>`,
  ].join("\n");
}

export class AiError extends Error {}

export async function getAiFeedback(apiKey: string, model: string, req: DrillRequest | FullRequest): Promise<AiFeedback> {
  if (!apiKey) throw new AiError("Add your Anthropic API key in Settings to get AI feedback.");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  // dangerouslyAllowBrowser sends the anthropic-dangerous-direct-browser-access header,
  // which the API requires for CORS requests made directly from a web page.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  const current = isCurrentGen(model);

  let response;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(req) }],
      output_config: { format: { type: "json_schema", schema: SCHEMA }, ...(current ? { effort: "medium" as const } : {}) },
      ...(current ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AiError("The API key was rejected. Check it in Settings.");
    if (err instanceof Anthropic.PermissionDeniedError) throw new AiError("This API key is not allowed to use that model.");
    if (err instanceof Anthropic.NotFoundError) throw new AiError(`Model "${model}" was not found. Check the model name in Settings.`);
    if (err instanceof Anthropic.RateLimitError) throw new AiError("Rate limited by the API. Wait a minute and try again.");
    if (err instanceof Anthropic.BadRequestError) throw new AiError(`The API rejected the request: ${err.message}`);
    if (err instanceof Anthropic.APIConnectionError) throw new AiError("Could not reach the Anthropic API. Check your connection.");
    if (err instanceof Anthropic.APIError) throw new AiError(`API error ${err.status ?? ""}: ${err.message}`);
    throw err;
  }

  if (response.stop_reason === "refusal") throw new AiError("The model declined to grade this piece. Try again or edit the text.");
  if (response.stop_reason === "max_tokens") throw new AiError("The feedback was cut off. Try again.");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let parsed: { criteria: Omit<AiCriterion, "name">[]; overall: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError("The model's answer was not valid JSON. Try again.");
  }
  const criteria: AiCriterion[] = CRITERIA.filter((c) => req.mode === "drill" || c.id !== "fit").map((c) => {
    const got = parsed.criteria.find((x) => x.id === c.id);
    return {
      id: c.id,
      name: c.name,
      applies: got?.applies ?? false,
      score: Math.max(0, Math.min(5, Math.round(got?.score ?? 0))),
      present: got?.present ?? [],
      missing: got?.missing ?? [],
      evidence: got?.evidence ?? [],
      fixes: got?.fixes ?? [],
    };
  });
  return { model: response.model, criteria, overall: parsed.overall ?? "", at: new Date().toISOString() };
}
