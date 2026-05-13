// Bundled training cases for examiner calibration. Authored to be representative
// of Cambridge-style oral exams. Not official Cambridge materials.

export interface CalibrationCriterion {
  name:
    | "Grammar and Vocabulary"
    | "Discourse Management"
    | "Pronunciation"
    | "Interactive Communication"
    | "Global Achievement";
  goldScore: number; // 0-5 in 0.5 increments
  rationale: string;
}

export interface CalibrationCase {
  id: string;
  level: "A2" | "B1" | "B2" | "C1" | "C2";
  title: string;
  description: string;
  transcript: string;
  criteria: CalibrationCriterion[];
}

export const CALIBRATION_CASES: CalibrationCase[] = [
  {
    id: "a2-shopping",
    level: "A2",
    title: "A2 — Talking about a recent shopping trip",
    description:
      "KET-style Part 2 dialogue. Two candidates discuss a recent shopping trip. Look for sufficient control of simple grammatical forms and basic everyday vocabulary.",
    transcript:
      "Examiner: So, tell me about your last shopping trip. Where did you go?\nCandidate A: I go… er… I went to the centre last Saturday with my sister.\nCandidate B: Oh nice. What did you buy?\nCandidate A: I buy a new shoes, and a t-shirt. Black colour.\nCandidate B: Was it expensive?\nCandidate A: Yes, a little. But I have… a discount, so it's okay.\nExaminer: Do you prefer shopping online or in shops?\nCandidate A: In shop. I like to see the clothes and try them.\nCandidate B: I prefer online because it's more easy and cheap.",
    criteria: [
      { name: "Grammar and Vocabulary", goldScore: 3, rationale: "Sufficient control of simple forms with some past-tense slips ('I buy a new shoes'). Vocabulary appropriate for everyday topics." },
      { name: "Discourse Management", goldScore: 3, rationale: "Short phrases with some hesitation, mostly relevant. Limited use of cohesive devices." },
      { name: "Pronunciation", goldScore: 3.5, rationale: "Mostly intelligible with some control of phonological features; occasional unclear vowels." },
      { name: "Interactive Communication", goldScore: 3.5, rationale: "Maintains simple exchanges, asks back questions naturally with little prompting." },
      { name: "Global Achievement", goldScore: 3, rationale: "Handles a basic everyday-topic exchange despite hesitation; meaning consistently conveyed." },
    ],
  },
  {
    id: "b1-holidays",
    level: "B1",
    title: "B1 — Comparing holidays at home and abroad",
    description:
      "PET-style Part 3 collaborative task. Candidates compare two holiday photos and decide which they prefer.",
    transcript:
      "Examiner: Look at the two photos. Which holiday do you prefer and why?\nCandidate A: For me, the beach holiday is better because you can relax and swim. When I was a child, I went to Valencia every summer with my family.\nCandidate B: Yes, but the city holiday is more interesting. You can visit museums and try new food. What do you think?\nCandidate A: That's true, but in cities it's very tiring. After one day I'm exhausted.\nCandidate B: I understand, but a beach is boring after three days. Maybe a mix is the best option.\nCandidate A: Good idea. One week in a city, then one week at the beach. Perfect.\nExaminer: And do you prefer travelling with family or with friends?\nCandidate B: With friends, definitely. With family there are too many rules.",
    criteria: [
      { name: "Grammar and Vocabulary", goldScore: 4, rationale: "Good control of simple forms; attempts complex structures (past-time reference, comparatives) accurately." },
      { name: "Discourse Management", goldScore: 4, rationale: "Extended responses with clear organisation and basic discourse markers ('but', 'maybe', 'after')." },
      { name: "Pronunciation", goldScore: 4, rationale: "Intelligible with generally appropriate intonation and stress." },
      { name: "Interactive Communication", goldScore: 4.5, rationale: "Initiates, responds, links contributions and negotiates an outcome with minimal support." },
      { name: "Global Achievement", goldScore: 4, rationale: "Handles a familiar topic comfortably with little hesitation; coherent extended discourse." },
    ],
  },
  {
    id: "b2-technology",
    level: "B2",
    title: "B2 — Discussing the impact of technology on education",
    description:
      "FCE-style Part 4 discussion. Candidates discuss whether technology has improved education.",
    transcript:
      "Examiner: Do you think technology has improved education?\nCandidate A: I'd say it's been a mixed blessing. On one hand, students now have access to enormous amounts of information online, which would have been unthinkable twenty years ago.\nCandidate B: I agree, but I think we're losing something important — the ability to focus. My younger brother can't read a book for more than ten minutes without checking his phone.\nCandidate A: That's a fair point, but you can't blame technology itself. It's how we use it.\nCandidate B: True. Schools should teach digital literacy more seriously, not just how to use apps but how to manage attention.\nCandidate A: Exactly. And honestly, online lessons during the pandemic showed both sides — flexibility but also a lot of isolation.\nCandidate B: Yes, I missed the social side of school. Learning isn't only about content.",
    criteria: [
      { name: "Grammar and Vocabulary", goldScore: 4.5, rationale: "Good control of simple and complex forms; range of appropriate vocabulary including some idiomatic items ('mixed blessing')." },
      { name: "Discourse Management", goldScore: 4.5, rationale: "Extended, coherent stretches with varied cohesive devices ('on one hand', 'that's a fair point', 'exactly')." },
      { name: "Pronunciation", goldScore: 4, rationale: "Intelligible throughout; intonation and stress generally appropriate." },
      { name: "Interactive Communication", goldScore: 4.5, rationale: "Links contributions, develops the discussion, negotiates ideas naturally." },
      { name: "Global Achievement", goldScore: 4.5, rationale: "Handles an unfamiliar topic confidently with minimal hesitation; easy-to-follow discourse." },
    ],
  },
  {
    id: "c1-environment",
    level: "C1",
    title: "C1 — Climate policy and individual responsibility",
    description:
      "CAE-style Part 4 extended discussion on the balance between government action and individual choices.",
    transcript:
      "Examiner: To what extent are individuals responsible for tackling climate change?\nCandidate A: I'd argue that placing the burden on individuals is largely a deflection by industries and governments. Yes, we should recycle and cut our emissions where possible, but the real leverage lies in regulation and infrastructure.\nCandidate B: I take your point, although I'd push back slightly. If consumer demand doesn't shift, companies have no incentive to change either. So individual choices do feed into systemic change, even if slowly.\nCandidate A: Granted, but we need to be realistic about the pace. Voluntary change has had decades to work and emissions are still rising. Carbon pricing, for instance, would shift behaviour overnight.\nCandidate B: Possibly, though carbon taxes tend to be regressive unless they're carefully designed. The poorest end up paying proportionally more.\nCandidate A: Which is exactly why dividends back to households matter — Canada's model is interesting in that respect.\nCandidate B: Agreed. So perhaps the real question isn't individual versus collective, but how we design policy that aligns the two.",
    criteria: [
      { name: "Grammar and Vocabulary", goldScore: 5, rationale: "Wide range of forms used flexibly and precisely; advanced lexis ('deflection', 'regressive', 'leverage')." },
      { name: "Discourse Management", goldScore: 4.5, rationale: "Extended, varied, well-organised contributions; full use of cohesive devices and discourse markers." },
      { name: "Pronunciation", goldScore: 4.5, rationale: "Intelligible with appropriate intonation and stress; sounds clearly articulated." },
      { name: "Interactive Communication", goldScore: 5, rationale: "Skilfully interweaves contributions, widens scope, develops the argument towards a negotiated outcome." },
      { name: "Global Achievement", goldScore: 4.5, rationale: "Handles an abstract, unfamiliar topic with very little hesitation; coherent and detailed throughout." },
    ],
  },
  {
    id: "c2-art",
    level: "C2",
    title: "C2 — The role of art in society",
    description:
      "CPE-style Part 3 discussion on whether art still matters in a digital, utilitarian age.",
    transcript:
      "Examiner: Has art become marginalised in a society obsessed with productivity?\nCandidate A: I'd resist the premise, actually. Art hasn't been marginalised so much as redistributed — TikTok, fan fiction, generative tools. The forms have multiplied; what's contracted is the cultural authority of so-called 'high art'.\nCandidate B: That's a compelling reframing, though I'd add that the economic model underpinning serious artistic practice has eroded. When everything is content, the painter or the novelist competes with the algorithm for attention.\nCandidate A: Quite. And that scarcity of attention reshapes what gets made. Works that demand sustained engagement are squeezed out, even when they're vital.\nCandidate B: Which raises the question of public investment. Without it, certain art forms — opera, experimental theatre — simply can't survive market forces.\nCandidate A: Agreed, although public funding always carries the risk of institutional capture. The most interesting work tends to emerge at the margins, not in subsidised institutions.\nCandidate B: A fair caveat. Perhaps the answer lies in a plurality of funding models rather than any single orthodoxy.",
    criteria: [
      { name: "Grammar and Vocabulary", goldScore: 5, rationale: "Full flexibility and precision; advanced and idiomatic lexis used effortlessly ('institutional capture', 'redistributed')." },
      { name: "Discourse Management", goldScore: 5, rationale: "Fully extended, coherent, varied and detailed; flexible use of a wide range of cohesive devices." },
      { name: "Pronunciation", goldScore: 5, rationale: "Readily intelligible; intonation effective for meaning; effortless throughout." },
      { name: "Interactive Communication", goldScore: 5, rationale: "Interweaves contributions skilfully; develops fully and effectively towards a negotiated outcome." },
      { name: "Global Achievement", goldScore: 5, rationale: "Handles an abstract topic with no hesitation; coherent, fully extended, easy to follow." },
    ],
  },
];
