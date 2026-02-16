// ── Practice Links Database ──
// Maps CEFR levels + skill areas to curated external resources.

export interface PracticeLink {
  title: string;
  url: string;
  source: "British Council" | "BBC Learning English" | "Cambridge";
  skill: string;
  level: string;
}

export const PRACTICE_LINKS: PracticeLink[] = [
  // A1
  { level: "A1", skill: "Vocabulary Range", title: "Beginner Vocabulary", url: "https://learnenglish.britishcouncil.org/vocabulary/a1-a2-vocabulary", source: "British Council" },
  { level: "A1", skill: "Fluency", title: "Easy Conversations", url: "https://www.bbc.co.uk/learningenglish/english/course/lower-intermediate", source: "BBC Learning English" },
  { level: "A1", skill: "Pronunciation", title: "Sounds of English", url: "https://www.bbc.co.uk/learningenglish/english/features/pronunciation", source: "BBC Learning English" },
  { level: "A1", skill: "Grammar Accuracy", title: "A1 Grammar Practice", url: "https://learnenglish.britishcouncil.org/grammar/a1-a2-grammar", source: "British Council" },
  { level: "A1", skill: "Interaction", title: "Basic Speaking Skills", url: "https://learnenglish.britishcouncil.org/skills/speaking/a1-speaking", source: "British Council" },

  // A2
  { level: "A2", skill: "Vocabulary Range", title: "Elementary Vocabulary", url: "https://learnenglish.britishcouncil.org/vocabulary/a1-a2-vocabulary", source: "British Council" },
  { level: "A2", skill: "Fluency", title: "Speaking Practice A2", url: "https://learnenglish.britishcouncil.org/skills/speaking/a2-speaking", source: "British Council" },
  { level: "A2", skill: "Pronunciation", title: "Pronunciation Tips", url: "https://www.bbc.co.uk/learningenglish/english/features/pronunciation", source: "BBC Learning English" },
  { level: "A2", skill: "Grammar Accuracy", title: "Elementary Grammar", url: "https://learnenglish.britishcouncil.org/grammar/a1-a2-grammar", source: "British Council" },
  { level: "A2", skill: "Interaction", title: "Everyday Conversations", url: "https://www.bbc.co.uk/learningenglish/english/course/lower-intermediate/unit-1", source: "BBC Learning English" },

  // B1
  { level: "B1", skill: "Vocabulary Range", title: "Intermediate Vocabulary", url: "https://learnenglish.britishcouncil.org/vocabulary/b1-b2-vocabulary", source: "British Council" },
  { level: "B1", skill: "Fluency", title: "Intermediate Speaking", url: "https://learnenglish.britishcouncil.org/skills/speaking/b1-speaking", source: "British Council" },
  { level: "B1", skill: "Pronunciation", title: "Tim's Pronunciation Workshop", url: "https://www.bbc.co.uk/learningenglish/english/features/pronunciation/tims-pronunciation-workshop-ep1", source: "BBC Learning English" },
  { level: "B1", skill: "Grammar Accuracy", title: "B1 Grammar", url: "https://learnenglish.britishcouncil.org/grammar/b1-b2-grammar", source: "British Council" },
  { level: "B1", skill: "Interaction", title: "6 Minute English", url: "https://www.bbc.co.uk/learningenglish/english/features/6-minute-english", source: "BBC Learning English" },

  // B2
  { level: "B2", skill: "Vocabulary Range", title: "Upper-Intermediate Vocabulary", url: "https://learnenglish.britishcouncil.org/vocabulary/b1-b2-vocabulary", source: "British Council" },
  { level: "B2", skill: "Fluency", title: "B2 Speaking Tasks", url: "https://learnenglish.britishcouncil.org/skills/speaking/b2-speaking", source: "British Council" },
  { level: "B2", skill: "Pronunciation", title: "Connected Speech", url: "https://www.bbc.co.uk/learningenglish/english/features/pronunciation", source: "BBC Learning English" },
  { level: "B2", skill: "Grammar Accuracy", title: "Advanced Grammar", url: "https://learnenglish.britishcouncil.org/grammar/b1-b2-grammar", source: "British Council" },
  { level: "B2", skill: "Interaction", title: "English at Work", url: "https://www.bbc.co.uk/learningenglish/english/features/english-at-work", source: "BBC Learning English" },

  // C1
  { level: "C1", skill: "Vocabulary Range", title: "Advanced Vocabulary", url: "https://learnenglish.britishcouncil.org/vocabulary/c1-vocabulary", source: "British Council" },
  { level: "C1", skill: "Fluency", title: "C1 Speaking Practice", url: "https://learnenglish.britishcouncil.org/skills/speaking/c1-speaking", source: "British Council" },
  { level: "C1", skill: "Pronunciation", title: "Accent Reduction", url: "https://www.bbc.co.uk/learningenglish/english/features/pronunciation", source: "BBC Learning English" },
  { level: "C1", skill: "Grammar Accuracy", title: "C1 Grammar", url: "https://learnenglish.britishcouncil.org/grammar/c1-grammar", source: "British Council" },
  { level: "C1", skill: "Interaction", title: "Academic Discussion Skills", url: "https://www.bbc.co.uk/learningenglish/english/features/6-minute-english", source: "BBC Learning English" },

  // C2
  { level: "C2", skill: "Vocabulary Range", title: "Proficiency Vocabulary", url: "https://learnenglish.britishcouncil.org/vocabulary/c1-vocabulary", source: "British Council" },
  { level: "C2", skill: "Fluency", title: "Mastery Speaking", url: "https://learnenglish.britishcouncil.org/skills/speaking/c1-speaking", source: "British Council" },
  { level: "C2", skill: "Pronunciation", title: "Native-Like Pronunciation", url: "https://www.bbc.co.uk/learningenglish/english/features/pronunciation", source: "BBC Learning English" },
  { level: "C2", skill: "Grammar Accuracy", title: "Expert Grammar", url: "https://learnenglish.britishcouncil.org/grammar/c1-grammar", source: "British Council" },
  { level: "C2", skill: "Interaction", title: "Debate & Persuasion", url: "https://www.bbc.co.uk/learningenglish/english/features/english-at-work", source: "BBC Learning English" },
];

/** Given criteria scores and a CEFR level, return the top N recommended links for the weakest skills. */
export function getRecommendations(
  criteria: { name: string; score: number; maxScore: number }[],
  level: string,
  count = 2
): PracticeLink[] {
  // Sort criteria by percentage (lowest first)
  const sorted = [...criteria].sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore));
  const weakest = sorted.slice(0, count);

  // Normalize level (strip "diagnostic" → default to B1)
  const normalizedLevel = ["A1", "A2", "B1", "B2", "C1", "C2"].includes(level) ? level : "B1";

  const results: PracticeLink[] = [];
  for (const w of weakest) {
    // Find a matching link by skill name substring
    const match = PRACTICE_LINKS.find(
      (l) => l.level === normalizedLevel && w.name.toLowerCase().includes(l.skill.toLowerCase().split(" ")[0].toLowerCase())
    );
    if (match && !results.find((r) => r.url === match.url)) {
      results.push(match);
    }
  }

  // If we didn't find enough, pad with generic links for the level
  if (results.length < count) {
    for (const link of PRACTICE_LINKS.filter((l) => l.level === normalizedLevel)) {
      if (!results.find((r) => r.url === link.url)) {
        results.push(link);
        if (results.length >= count) break;
      }
    }
  }

  return results.slice(0, count);
}

// ── Question Bank Data ──
export interface OralQuestion {
  id: string;
  question: string;
  topic: string;
  level: string;
}

export const ORAL_QUESTIONS: OralQuestion[] = [
  // A1
  { id: "a1-1", level: "A1", topic: "Personal Info", question: "What is your name?" },
  { id: "a1-2", level: "A1", topic: "Personal Info", question: "Where are you from?" },
  { id: "a1-3", level: "A1", topic: "Daily Life", question: "What do you do every day?" },
  { id: "a1-4", level: "A1", topic: "Family", question: "How many people are in your family?" },
  { id: "a1-5", level: "A1", topic: "Likes", question: "What is your favorite food?" },
  { id: "a1-6", level: "A1", topic: "School", question: "Do you like school? Why?" },

  // A2
  { id: "a2-1", level: "A2", topic: "Hobbies", question: "What do you like to do in your free time?" },
  { id: "a2-2", level: "A2", topic: "Travel", question: "Have you ever visited another city? Tell me about it." },
  { id: "a2-3", level: "A2", topic: "Daily Routine", question: "Describe your typical morning." },
  { id: "a2-4", level: "A2", topic: "Food", question: "What did you eat for breakfast today?" },
  { id: "a2-5", level: "A2", topic: "Weather", question: "What is the weather like today?" },
  { id: "a2-6", level: "A2", topic: "Friends", question: "Tell me about your best friend." },

  // B1
  { id: "b1-1", level: "B1", topic: "Experiences", question: "Describe a memorable holiday you have had." },
  { id: "b1-2", level: "B1", topic: "Opinion", question: "Do you think technology is changing education? How?" },
  { id: "b1-3", level: "B1", topic: "Plans", question: "What are your plans for the next year?" },
  { id: "b1-4", level: "B1", topic: "Comparison", question: "Compare living in a city with living in the countryside." },
  { id: "b1-5", level: "B1", topic: "Problem Solving", question: "What would you do if you lost your phone?" },
  { id: "b1-6", level: "B1", topic: "Culture", question: "What is a tradition in your country that you enjoy?" },

  // B2
  { id: "b2-1", level: "B2", topic: "Society", question: "What are the advantages and disadvantages of social media?" },
  { id: "b2-2", level: "B2", topic: "Environment", question: "How can individuals help reduce climate change?" },
  { id: "b2-3", level: "B2", topic: "Work", question: "Describe your ideal job and explain why." },
  { id: "b2-4", level: "B2", topic: "Education", question: "Should university education be free? Give reasons." },
  { id: "b2-5", level: "B2", topic: "Health", question: "How important is mental health awareness in schools?" },
  { id: "b2-6", level: "B2", topic: "Media", question: "How has streaming changed the way we consume entertainment?" },

  // C1
  { id: "c1-1", level: "C1", topic: "Ethics", question: "To what extent should governments regulate artificial intelligence?" },
  { id: "c1-2", level: "C1", topic: "Globalisation", question: "Discuss the impact of globalisation on local cultures." },
  { id: "c1-3", level: "C1", topic: "Science", question: "How should society balance scientific progress with ethical concerns?" },
  { id: "c1-4", level: "C1", topic: "Leadership", question: "What qualities make an effective leader in the modern world?" },
  { id: "c1-5", level: "C1", topic: "Philosophy", question: "Is it possible to be truly objective? Discuss." },
  { id: "c1-6", level: "C1", topic: "Innovation", question: "How will automation reshape the job market over the next decade?" },

  // C2
  { id: "c2-1", level: "C2", topic: "Abstract", question: "To what extent is language a reflection of thought or a constraint upon it?" },
  { id: "c2-2", level: "C2", topic: "Policy", question: "Critically evaluate the argument that economic growth is incompatible with sustainability." },
  { id: "c2-3", level: "C2", topic: "Culture", question: "How do power dynamics in language influence international diplomacy?" },
  { id: "c2-4", level: "C2", topic: "Philosophy", question: "Discuss the concept of justice in a multicultural society." },
  { id: "c2-5", level: "C2", topic: "Research", question: "How should academic institutions adapt to the rise of open-access knowledge?" },
  { id: "c2-6", level: "C2", topic: "Debate", question: "Present and defend an argument for or against universal basic income." },
];
