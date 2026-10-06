import { describe, expect, it } from "vitest";
import {
  andThenCount,
  autoMap,
  avgSentenceLength,
  bodyCliches,
  checkSection,
  clicheOpenings,
  countWords,
  gradeDrill,
  gradeFullStory,
  hasDecision,
  motifHits,
  motifKeywords,
  paragraphs,
  score,
  sentences,
  statedMorals,
} from "../src/grader";
import { EMPTY_PLAN, type Check, type Plan } from "../src/types";
import stories from "../src/data/stories.json";

const byId = (checks: Check[], id: string) => {
  const c = checks.find((x) => x.id === id);
  if (!c) throw new Error(`no check ${id}: ${checks.map((x) => x.id).join(", ")}`);
  return c;
};

// ---------- sample passages ----------

const GOOD_EXPO =
  "Priya dropped the last box of hymn books onto the trolley and wiped the dust from her palms onto her jeans. The church hall smelled of floor polish and old radiators, and the strip lights hummed above the stacked chairs. On the piano lid sat her grandmother's brass metronome, its little weight still clipped near the top. She had promised the vicar the hall would be empty by six.";

const BAD_EXPO =
  "I woke up when my alarm clock went off at seven. It was a cold and rainy morning. I got dressed and went downstairs for breakfast with my mum, who was making toast in the kitchen as usual before school and work.";

const GOOD_RISING = [
  "She lifted the metronome to put it in her bag, but the vicar came in and asked for it. It belonged to the church, he said, and it would go to the auction with the piano. Priya held on to it a moment too long. She decided to ask her mother to phone him instead.",
  "But her mother did not pick up, and the auction van was already reversing into the car park. The vicar was checking his list. So Priya hid the metronome inside the piano stool, under the music, and told herself she would come back for it on Saturday.",
  "The removal men lifted the piano stool first. They carried it out to the van, stool and music and metronome together, and slammed the doors. The vicar locked the hall behind them. Priya stood on the steps with the keys in her hand and nothing left inside.",
].join("\n\n");

const BAD_RISING =
  "She went to the shop and then she bought some milk. And then she walked home and then she saw her friend, and they talked for a while about school and the weekend and their teachers and what they had watched on television the night before, which was a film about space.";

const GOOD_CLIMAX =
  "Priya ran down the steps. The van's engine was running. She knocked on the driver's window. He wound it down. She held out the hall keys. Then she pointed at the stool. He looked at her for a long moment. Gravel crunched under the tyres. He opened the back doors. She climbed in among the chairs. The metronome was still under the music. Its brass was cold. She lifted it out with both hands.";

const SLOW_CLIMAX =
  "Priya ran down the steps towards the van, which was still running in the car park with its back doors closed and the driver looking at his phone while he waited for the vicar to sign the last of the paperwork, and she knocked on the window and asked him whether she could please look inside the piano stool before he drove all the way to the auction house in town.";

const GOOD_RESOLUTION =
  "That evening she set the metronome on her own windowsill. She slid the weight down to the bottom, where it ticked slowest, and set it going. The street lamps came on outside. She sat on the bed and listened to it until it ran down and stopped.";

const MORAL_RESOLUTION =
  "That evening she set the metronome on her windowsill. She realised that some things are worth fighting for, and from that day on she never let anyone take what mattered to her. It was a lesson she would never forget.";

const BODY_CLICHE_TEXT =
  "Her heart was pounding as she opened the door. Her stomach dropped when she saw the empty room, and a shiver ran down her spine. She held her breath.";

// ---------- utilities ----------

describe("text utilities", () => {
  it("counts words, ignoring stray punctuation", () => {
    expect(countWords("Hello, world — it's me.")).toBe(4);
    expect(countWords("   ")).toBe(0);
  });

  it("splits paragraphs on line breaks", () => {
    expect(paragraphs("one\n\ntwo\nthree\n\n\n")).toEqual(["one", "two", "three"]);
  });

  it("keeps dialogue tags inside the sentence", () => {
    expect(sentences('"Stop!" he said. She stopped.')).toEqual(['"Stop!" he said.', "She stopped."]);
    expect(sentences("Mr. Hale waited. Then he left.")).toHaveLength(2);
  });

  it("averages sentence length", () => {
    expect(avgSentenceLength("One two three. Four five six.")).toBe(3);
    expect(avgSentenceLength(GOOD_CLIMAX)).toBeLessThan(avgSentenceLength(GOOD_EXPO));
  });

  it("extracts motif keywords and matches plurals and possessives", () => {
    expect(motifKeywords("her grandmother's brass metronome")).toEqual(["grandmother", "brass", "metronome"]);
    expect(motifHits("Two metronomes ticked.", ["metronome"])).toEqual(["metronome"]);
    expect(motifHits("The watch's strap", ["watches"])).toEqual(["watches"]);
    expect(motifHits("nothing here", ["metronome"])).toEqual([]);
  });
});

// ---------- detectors ----------

describe("detectors", () => {
  it("flags cliché openings only near the start", () => {
    expect(clicheOpenings(GOOD_EXPO)).toEqual([]);
    expect(clicheOpenings(BAD_EXPO).map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(["woke up", "alarm clock"]),
    );
    expect(clicheOpenings("It was a dark and stormy night.")).not.toEqual([]);
    const late = "Sam kicked the door shut. The kitchen smelled of toast. Later that week he would remember the alarm.";
    expect(clicheOpenings(late)).toEqual([]);
  });

  it("detects stated morals", () => {
    expect(statedMorals(GOOD_RESOLUTION)).toEqual([]);
    const found = statedMorals(MORAL_RESOLUTION).map((s) => s.toLowerCase());
    expect(found).toEqual(expect.arrayContaining(["realised that", "lesson", "would never forget"]));
    expect(found.some((s) => s.startsWith("from that day"))).toBe(true);
    expect(statedMorals("She learned that home was people.")).not.toEqual([]);
    expect(statedMorals("Now he understood that it was over.")).not.toEqual([]);
  });

  it("counts bodily-sensation clichés", () => {
    expect(bodyCliches(BODY_CLICHE_TEXT)).toHaveLength(4);
    expect(bodyCliches(GOOD_CLIMAX)).toEqual([]);
    expect(bodyCliches("She was breathing hard after the sprint.")).toEqual([]);
  });

  it("finds 'and then' and decisions", () => {
    expect(andThenCount(BAD_RISING)).toBe(3);
    expect(andThenCount(GOOD_RISING)).toBe(0);
    expect(hasDecision("She decided to wait.")).toBe(true);
    expect(hasDecision("So he rang the number.")).toBe(true);
    expect(hasDecision("The bus was late. Rain hit the glass.")).toBe(false);
  });
});

// ---------- section checks ----------

describe("section checks", () => {
  const motifCtx = { mode: "full" as const, motifKeywords: ["metronome"], motifLabel: "metronome" };

  it("passes a good exposition", () => {
    const checks = checkSection("exposition", GOOD_EXPO, motifCtx);
    expect(checks.every((c) => c.pass)).toBe(true);
  });

  it("fails a clichéd exposition with no motif", () => {
    const checks = checkSection("exposition", BAD_EXPO, motifCtx);
    expect(byId(checks, "exposition-opening").pass).toBe(false);
    expect(byId(checks, "exposition-motif").pass).toBe(false);
    expect(byId(checks, "exposition-words").pass).toBe(false);
  });

  it("passes good rising action", () => {
    const checks = checkSection("rising_action", GOOD_RISING, { mode: "full" });
    for (const c of checks) expect(c.pass, `${c.id}: ${c.detail}`).toBe(true);
  });

  it("fails rising action that is one 'and then' paragraph", () => {
    const checks = checkSection("rising_action", BAD_RISING, { mode: "full" });
    expect(byId(checks, "rising-three").pass).toBe(false);
    expect(byId(checks, "rising-and-then").pass).toBe(false);
    expect(byId(checks, "rising-decisions").pass).toBe(false);
  });

  it("flags a beat with no decision and a beat 3 that decides", () => {
    const beats = [
      "The phone rang in the empty office, and the caretaker let it ring for a while. It stopped. Rain hit the window. The kettle clicked off, and the corridor lights flickered once before settling into their usual buzz.",
      "But the phone rang again almost at once. He picked it up, and it was his daughter, asking for money. He decided to say no and put the phone down before she could start crying at him.",
      "Therefore she came to the school in person, and stood at the gate in the rain. He decided to let her in and talk to her properly in the office, where it was warm.",
    ].join("\n");
    const checks = checkSection("rising_action", beats, { mode: "full" });
    expect(byId(checks, "rising-three").pass).toBe(true);
    expect(byId(checks, "rising-decisions").pass).toBe(false);
    expect(byId(checks, "rising-decisions").detail).toContain("beat 1");
    expect(byId(checks, "rising-beat3").pass).toBe(false);
  });

  it("compares climax pace against the exposition", () => {
    const good = checkSection("climax", GOOD_CLIMAX, { mode: "full", referenceExposition: GOOD_EXPO });
    expect(byId(good, "climax-pace").pass).toBe(true);
    const slow = checkSection("climax", SLOW_CLIMAX, { mode: "full", referenceExposition: GOOD_EXPO });
    expect(byId(slow, "climax-pace").pass).toBe(false);
  });

  it("checks the resolution for motif and moral", () => {
    const good = checkSection("resolution", GOOD_RESOLUTION, motifCtx);
    expect(byId(good, "resolution-motif").pass).toBe(true);
    expect(byId(good, "resolution-moral").pass).toBe(true);
    const bad = checkSection("resolution", MORAL_RESOLUTION, { ...motifCtx, motifKeywords: ["locket"] });
    expect(byId(bad, "resolution-motif").pass).toBe(false);
    expect(byId(bad, "resolution-moral").pass).toBe(false);
  });

  it("flags bodily clichés in any section", () => {
    const checks = checkSection("inciting_incident", BODY_CLICHE_TEXT, { mode: "full" });
    expect(byId(checks, "inciting_incident-body").pass).toBe(false);
    expect(byId(checks, "inciting_incident-body").detail).toContain("4 found");
  });

  it("returns only a failed word count for an empty section", () => {
    const checks = checkSection("climax", "  ", { mode: "full", referenceExposition: GOOD_EXPO });
    expect(checks).toHaveLength(1);
    expect(checks[0].pass).toBe(false);
  });
});

// ---------- drill and full story ----------

describe("drill grading", () => {
  const story = stories[0];

  it("uses the bank exposition for climax pace", () => {
    const checks = gradeDrill("climax", SLOW_CLIMAX, story);
    expect(byId(checks, "climax-pace").pass).toBe(false);
    expect(byId(checks, "climax-pace").detail).toContain("this story's exposition");
  });

  it("uses the bank motif for the resolution", () => {
    const checks = gradeDrill("resolution", GOOD_RESOLUTION, story);
    expect(byId(checks, "resolution-motif").pass).toBe(false);
  });
});

describe("full story grading", () => {
  const plan: Plan = {
    ...EMPTY_PLAN,
    motif: "brass metronome",
    name: "Priya",
    want: "empty the hall by six",
    hide: "afraid of forgetting gran",
    exposition: "clearing hall, metronome on piano",
    inciting: "vicar claims metronome",
    b1_event: "vicar asks for it",
    b1_react: "holds on",
    b1_decide: "ask mum",
    b2_event: "mum no answer, van arrives",
    b2_react: "panic",
    b2_decide: "hide in stool",
    b3_event: "stool loaded, hall locked",
    b3_react: "empty hands",
    climax: "climbs into van",
    falling: "driver lets her",
    resolution: "metronome ticking at home",
  };
  const story = [
    GOOD_EXPO,
    "The vicar came in with a clipboard and a man from the auction house. He pointed at the piano, then at the metronome on its lid. Everything on the list had to go, he said, and the metronome was on the list. The man wrote a number on a sticker.",
    GOOD_RISING,
    GOOD_CLIMAX,
    "The driver said nothing. He held the door while she climbed down, then crossed the metronome off his sheet with a short line. The engine idled. The vicar, on the steps, pretended to look at his phone.",
    GOOD_RESOLUTION,
  ].join("\n\n");

  it("maps eight paragraphs to the standard sections", () => {
    const g = gradeFullStory(story, plan);
    expect(g.paragraphs).toHaveLength(8);
    expect(g.mapping).toEqual([
      "exposition",
      "inciting_incident",
      "rising_action",
      "rising_action",
      "rising_action",
      "climax",
      "falling_action",
      "resolution",
    ]);
  });

  it("passes a well-built story", () => {
    const g = gradeFullStory(story, plan);
    for (const c of g.checks) expect(c.pass, `${c.id}: ${c.detail}`).toBe(true);
    expect(score(g.checks).passed).toBe(g.checks.length);
  });

  it("fails the plan checks when the inner problem is missing", () => {
    const g = gradeFullStory(story, { ...plan, hide: "" });
    expect(byId(g.checks, "plan-inner").pass).toBe(false);
    expect(byId(g.checks, "plan-complete").pass).toBe(false);
  });

  it("accepts a manual mapping", () => {
    const paras = paragraphs(story);
    const mapping = autoMap(paras);
    mapping[4] = "climax";
    const g = gradeFullStory(story, plan, mapping);
    expect(byId(g.checks, "rising-three").pass).toBe(false);
  });

  it("guesses a sensible mapping for an unusual paragraph count", () => {
    const paras = paragraphs(story);
    const merged = [paras[0] + " " + paras[1], ...paras.slice(2)];
    const map = autoMap(merged);
    expect(map[0]).toBe("exposition");
    expect(map.at(-1)).toBe("resolution");
    expect(map).toContain("climax");
  });
});
