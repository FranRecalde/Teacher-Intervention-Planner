import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  SkillName,
  SKILL_NAMES,
  SendArea,
  Pupil,
  PupilAnalysis,
  WholeClassPriority,
  InterventionGroup,
  ThresholdSettings,
  SkillStrategy,
} from './types';

// ==========================================
// 1. RULES ENGINE THRESHOLDS (EDITABLE OBJECT)
// ==========================================
export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  belowExpectationGap: 1, // Current grade is 1 or more below target
  weakSkillMaxScore: 50, // Score under 50%
  weakSkillUnderClassAvg: 10, // At least 10 points under class average
  flagPupilWeakSkillsCount: 3, // Flag if below expectation AND 3 or more weak skills
  flagPupilGradeDrop: 1, // Also flag if grade dropped 1 or more since previous assessment
  wholeClassPriorityWeakPct: 40, // Skill where 40% or more pupils are weak
  groupInterventionMinPupils: 3, // 3 or more pupils share the same weak skill
};

// ==========================================
// 2. STRATEGY LIBRARY
// ==========================================
export const STRATEGY_LIBRARY: Record<SkillName, SkillStrategy> = {
  'Present tense verbs': {
    classroomStrategies: [
      'Choral conjugation drills with pronoun mini-whiteboard quickfire responses',
      'High-frequency radical irregulars matrix (tener, ser, estar, ir) displayed and referenced',
    ],
    intervention: 'Targeted regular vs irregular endings reinforcement clinic',
  },
  'Past tense (preterite)': {
    classroomStrategies: [
      'Daily 5 minute verb retrieval quiz focusing on regular -ar and -er/-ir endings',
      'Sentence builder with timeframe prompts (ayer, el año pasado, el fin de semana)',
    ],
    intervention: 'Small group preterite endings clinic with paired paradigm checking',
  },
  'Future tense': {
    classroomStrategies: [
      'Contrast matrix between immediate future (voy a + inf) and simple future endings',
      'Color-coded timeline cue cards (mañana, en el futuro, cuando termine los exámenes)',
    ],
    intervention: 'Future tense formation workshop: stem preservation and accent markers',
  },
  'Opinions and justifications': {
    classroomStrategies: [
      'Tiered opinion phrases ladder moving beyond "me gusta" to nuanced evaluations',
      'Dice roll connective challenges linking opinions to "ya que", "dado que", and "puesto que"',
    ],
    intervention: 'Structured opinion + justification scaffold clinic with model paragraphs',
  },
  'Vocabulary: school and jobs': {
    classroomStrategies: [
      'Dual-coding icon flashcards linking school subjects, facilities, and professions',
      'Look-cover-write-check routine tackling tricky Spanish cognates and false friends',
    ],
    intervention: 'Vocab memory consolidation: semantic field clusters and Leitner drills',
  },
  'Vocabulary: free time and holidays': {
    classroomStrategies: [
      'Transport and weather integration sentence builders for holiday narrations',
      'Retrieval racing sheets classifying leisure activities, frequencies, and past reviews',
    ],
    intervention: 'Leisure vocabulary fast-track retrieval and audio-prompted recall session',
  },
  'Reading comprehension': {
    classroomStrategies: [
      'Distractor elimination protocol: identify negative particles (no, jamás, ni)',
      '3-step question breakdown: circle question interrogative, identify tense, highlight keywords',
    ],
    intervention: 'Guided GCSE reading masterclass: dissecting complex multi-tense extracts',
  },
  'Translation into Spanish': {
    classroomStrategies: [
      'Chunking method: divide English sentence into 3 grammatical chunks before writing',
      'Agreements audit routine: systematically checking gender, number, and verb agreement',
    ],
    intervention: 'Translation clinic focusing on syntax traps, word order, and idiom pitfalls',
  },
};

export const SEND_STRATEGIES: Record<SendArea, [string, string]> = {
  SLCN: [
    'Pre-teach key Spanish phoneme-grapheme correspondences with visual pronunciation cues.',
    'Provide chunked bilingual sentence frames and reduce verbal cognitive load during oral drills.',
  ],
  ASD: [
    'Provide clear visual lesson structure on the board and maintain predictable routines.',
    'Use explicit, unambiguous task instructions with clear end-state success criteria.',
  ],
  Dyslexia: [
    'Print handouts on pale buff/cream background with sans-serif font and color-coded verb endings.',
    'Permit digital spelling aids or personalized mini-glossaries during independent writing.',
  ],
  SEMH: [
    'Provide low-stakes retrieval opportunities and discreet non-verbal confidence check-ins.',
    'Break extended writing into bite-sized micro-goals with immediate positive reinforcement.',
  ],
  ADHD: [
    'Incorporate kinesthetic learning tasks (verb-snap cards, standing whiteboards) with timed sprints.',
    'Seat away from high-traffic distractions; provide step-by-step physical checklists.',
  ],
  'Hearing impairment': [
    'Ensure direct line of sight for lip-reading; repeat peer contributions clearly before continuing.',
    'Provide advance copies of Spanish listening transcripts and written instructions for all tasks.',
  ],
};

export const GENERAL_STRATEGIES = {
  belowTargetOverall: [
    'Weekly 1-to-1 grade tracking target setting with targeted GCSE Foundation/Higher tier homework clinic.',
    'Provide personal GCSE grade boundary exemplar packs with model grade 6+ answers and commentary.',
  ],
  examTechnique: [
    'Timed section practice with immediate peer assessment against authentic GCSE mark schemes.',
    'Command word decoding drills: identifying what "discutir", "justificar", and "comparar" require.',
  ],
};

// ==========================================
// 3. SAMPLE DATA (28 PUPILS, YEAR 11 SPANISH)
// Realistic patterns:
// - ~45% (13 pupils) weak on Preterite
// - 6 pupils sharing Vocabulary: school and jobs gap
// - 5 pupils sharing Reading comprehension gap
// - 4 pupils well below target (>= 2 grades below)
// - 6 SEND pupils with areas of need
// ==========================================
export const SAMPLE_PUPILS: Pupil[] = [
  // 1. Callum Taylor - SEND Dyslexia, Preterite weak, Vocab weak, Translation weak (Flagged: 3 weak skills & below target)
  {
    id: 'p-01',
    name: 'Callum Taylor',
    currentGrade: 4,
    targetGrade: 6,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 58,
      'Past tense (preterite)': 34,
      'Future tense': 55,
      'Opinions and justifications': 62,
      'Vocabulary: school and jobs': 38,
      'Vocabulary: free time and holidays': 60,
      'Reading comprehension': 52,
      'Translation into Spanish': 36,
    },
    sendArea: 'Dyslexia',
    sendStrategy: 'Print handouts on pale buff paper; provide color-coded verb ending cards.',
    teacherNotes: 'Struggles with regular -ar vs -er endings under time pressure.',
  },
  // 2. Sofia Rodriguez - High achiever, on track
  {
    id: 'p-02',
    name: 'Sofia Rodriguez',
    currentGrade: 8,
    targetGrade: 8,
    previousGrade: 8,
    scores: {
      'Present tense verbs': 92,
      'Past tense (preterite)': 78,
      'Future tense': 88,
      'Opinions and justifications': 90,
      'Vocabulary: school and jobs': 85,
      'Vocabulary: free time and holidays': 89,
      'Reading comprehension': 84,
      'Translation into Spanish': 82,
    },
    teacherNotes: 'Consistent high performer; stretching to grade 9 with subjunctive phrases.',
  },
  // 3. Joshua Evans - SEND ADHD, Dropped grade (5->4), Preterite weak, Reading weak, Translation weak
  {
    id: 'p-03',
    name: 'Joshua Evans',
    currentGrade: 4,
    targetGrade: 5,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 52,
      'Past tense (preterite)': 32,
      'Future tense': 58,
      'Opinions and justifications': 55,
      'Vocabulary: school and jobs': 50,
      'Vocabulary: free time and holidays': 64,
      'Reading comprehension': 38,
      'Translation into Spanish': 35,
    },
    sendArea: 'ADHD',
    sendStrategy: 'Seat near front; use 10-minute micro-tasks and tactile verb wheels.',
    teacherNotes: 'Grade dropped this term; loses focus during extended reading texts.',
  },
  // 4. Aisha Khan - Solid pupil, Preterite weak
  {
    id: 'p-04',
    name: 'Aisha Khan',
    currentGrade: 6,
    targetGrade: 7,
    previousGrade: 6,
    scores: {
      'Present tense verbs': 74,
      'Past tense (preterite)': 42,
      'Future tense': 76,
      'Opinions and justifications': 78,
      'Vocabulary: school and jobs': 68,
      'Vocabulary: free time and holidays': 72,
      'Reading comprehension': 65,
      'Translation into Spanish': 60,
    },
    teacherNotes: 'Good vocabulary recall, but mixes up preterite with imperfect.',
  },
  // 5. Oliver Wright - Well below target (3 vs 5), Dropped grade (4->3), Preterite weak, Vocab weak, Reading weak
  {
    id: 'p-05',
    name: 'Oliver Wright',
    currentGrade: 3,
    targetGrade: 5,
    previousGrade: 4,
    scores: {
      'Present tense verbs': 48,
      'Past tense (preterite)': 28,
      'Future tense': 45,
      'Opinions and justifications': 50,
      'Vocabulary: school and jobs': 32,
      'Vocabulary: free time and holidays': 42,
      'Reading comprehension': 34,
      'Translation into Spanish': 30,
    },
    teacherNotes: 'Urgent intervention needed; low confidence in mock assessment.',
  },
  // 6. Freya Davies - SEND SLCN, Preterite weak, Vocab school weak
  {
    id: 'p-06',
    name: 'Freya Davies',
    currentGrade: 4,
    targetGrade: 5,
    previousGrade: 4,
    scores: {
      'Present tense verbs': 56,
      'Past tense (preterite)': 36,
      'Future tense': 60,
      'Opinions and justifications': 58,
      'Vocabulary: school and jobs': 35,
      'Vocabulary: free time and holidays': 55,
      'Reading comprehension': 54,
      'Translation into Spanish': 42,
    },
    sendArea: 'SLCN',
    sendStrategy: 'Pre-teach vocabulary with visuals; provide bilingual speaking frames.',
    teacherNotes: 'Benefits from chunked sentence builders in written work.',
  },
  // 7. Marcus Johnson - Preterite weak, Reading weak
  {
    id: 'p-07',
    name: 'Marcus Johnson',
    currentGrade: 5,
    targetGrade: 6,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 65,
      'Past tense (preterite)': 38,
      'Future tense': 62,
      'Opinions and justifications': 68,
      'Vocabulary: school and jobs': 60,
      'Vocabulary: free time and holidays': 66,
      'Reading comprehension': 42,
      'Translation into Spanish': 50,
    },
    teacherNotes: 'Keen in oral practice; written accuracy needs consolidation.',
  },
  // 8. Chloe Smith - On track
  {
    id: 'p-08',
    name: 'Chloe Smith',
    currentGrade: 7,
    targetGrade: 7,
    previousGrade: 7,
    scores: {
      'Present tense verbs': 82,
      'Past tense (preterite)': 68,
      'Future tense': 84,
      'Opinions and justifications': 85,
      'Vocabulary: school and jobs': 76,
      'Vocabulary: free time and holidays': 80,
      'Reading comprehension': 78,
      'Translation into Spanish': 75,
    },
    teacherNotes: 'Consistently strong; pushing for Grade 8 target.',
  },
  // 9. Ethan Brown - SEND ASD, Preterite weak, Translation weak
  {
    id: 'p-09',
    name: 'Ethan Brown',
    currentGrade: 5,
    targetGrade: 6,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 70,
      'Past tense (preterite)': 35,
      'Future tense': 72,
      'Opinions and justifications': 64,
      'Vocabulary: school and jobs': 66,
      'Vocabulary: free time and holidays': 68,
      'Reading comprehension': 62,
      'Translation into Spanish': 40,
    },
    sendArea: 'ASD',
    sendStrategy: 'Clear task checklist on desk; give advance notice of group tasks.',
    teacherNotes: 'Prefers quiet independent writing; preterite irregulars cause stress.',
  },
  // 10. Amara Okafor - High achiever
  {
    id: 'p-10',
    name: 'Amara Okafor',
    currentGrade: 8,
    targetGrade: 9,
    previousGrade: 8,
    scores: {
      'Present tense verbs': 90,
      'Past tense (preterite)': 80,
      'Future tense': 92,
      'Opinions and justifications': 94,
      'Vocabulary: school and jobs': 88,
      'Vocabulary: free time and holidays': 92,
      'Reading comprehension': 88,
      'Translation into Spanish': 85,
    },
    teacherNotes: 'Exceptional work ethic; model student in the class.',
  },
  // 11. Jack Wilson - Well below target (3 vs 6), Dropped grade (4->3), 4 weak skills
  {
    id: 'p-11',
    name: 'Jack Wilson',
    currentGrade: 3,
    targetGrade: 6,
    previousGrade: 4,
    scores: {
      'Present tense verbs': 42,
      'Past tense (preterite)': 25,
      'Future tense': 40,
      'Opinions and justifications': 48,
      'Vocabulary: school and jobs': 30,
      'Vocabulary: free time and holidays': 45,
      'Reading comprehension': 36,
      'Translation into Spanish': 28,
    },
    teacherNotes: 'Severe drop; missed two weeks in November. Needs targeted re-teaching.',
  },
  // 12. Ruby Clarke - Preterite weak, Vocab school weak
  {
    id: 'p-12',
    name: 'Ruby Clarke',
    currentGrade: 5,
    targetGrade: 6,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 64,
      'Past tense (preterite)': 40,
      'Future tense': 66,
      'Opinions and justifications': 70,
      'Vocabulary: school and jobs': 36,
      'Vocabulary: free time and holidays': 62,
      'Reading comprehension': 58,
      'Translation into Spanish': 54,
    },
    teacherNotes: 'Good oral responses; forgets vocabulary for workplace topics.',
  },
  // 13. Harrison Green - SEND SEMH, Dropped grade (5->4), Preterite weak, Reading weak, Translation weak
  {
    id: 'p-13',
    name: 'Harrison Green',
    currentGrade: 4,
    targetGrade: 5,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 54,
      'Past tense (preterite)': 30,
      'Future tense': 55,
      'Opinions and justifications': 58,
      'Vocabulary: school and jobs': 52,
      'Vocabulary: free time and holidays': 58,
      'Reading comprehension': 39,
      'Translation into Spanish': 34,
    },
    sendArea: 'SEMH',
    sendStrategy: 'Discreet praise; private non-verbal check-in if anxious in timed tasks.',
    teacherNotes: 'Suffers test anxiety; timed conditions negatively impact performance.',
  },
  // 14. Jessica Hall - On track
  {
    id: 'p-14',
    name: 'Jessica Hall',
    currentGrade: 7,
    targetGrade: 7,
    previousGrade: 6,
    scores: {
      'Present tense verbs': 80,
      'Past tense (preterite)': 72,
      'Future tense': 82,
      'Opinions and justifications': 80,
      'Vocabulary: school and jobs': 74,
      'Vocabulary: free time and holidays': 84,
      'Reading comprehension': 76,
      'Translation into Spanish': 78,
    },
    teacherNotes: 'Made steady progress from mock 1; confident in all 3 tenses.',
  },
  // 15. Noah Davies - Preterite weak, Vocab school weak
  {
    id: 'p-15',
    name: 'Noah Davies',
    currentGrade: 5,
    targetGrade: 6,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 68,
      'Past tense (preterite)': 38,
      'Future tense': 64,
      'Opinions and justifications': 65,
      'Vocabulary: school and jobs': 38,
      'Vocabulary: free time and holidays': 60,
      'Reading comprehension': 56,
      'Translation into Spanish': 52,
    },
    teacherNotes: 'Participates well; requires consolidation of school subject vocab.',
  },
  // 16. Grace Edwards - SEND Hearing impairment, Reading weak, Translation weak, Preterite weak
  {
    id: 'p-16',
    name: 'Grace Edwards',
    currentGrade: 4,
    targetGrade: 5,
    previousGrade: 4,
    scores: {
      'Present tense verbs': 55,
      'Past tense (preterite)': 35,
      'Future tense': 58,
      'Opinions and justifications': 60,
      'Vocabulary: school and jobs': 54,
      'Vocabulary: free time and holidays': 58,
      'Reading comprehension': 40,
      'Translation into Spanish': 38,
    },
    sendArea: 'Hearing impairment',
    sendStrategy: 'Ensure direct line of sight; seat row 1 center; provide written copies of cues.',
    teacherNotes: 'Excellent effort; relies heavily on visual aids and written transcripts.',
  },
  // 17. Lucas Thomas - Well below target (4 vs 6), Preterite weak, Vocab school weak, Translation weak
  {
    id: 'p-17',
    name: 'Lucas Thomas',
    currentGrade: 4,
    targetGrade: 6,
    previousGrade: 4,
    scores: {
      'Present tense verbs': 56,
      'Past tense (preterite)': 32,
      'Future tense': 54,
      'Opinions and justifications': 58,
      'Vocabulary: school and jobs': 34,
      'Vocabulary: free time and holidays': 56,
      'Reading comprehension': 50,
      'Translation into Spanish': 36,
    },
    teacherNotes: '2 grades below target; targets set high based on KS3 data.',
  },
  // 18. Ella Martin - High achiever
  {
    id: 'p-18',
    name: 'Ella Martin',
    currentGrade: 7,
    targetGrade: 7,
    previousGrade: 7,
    scores: {
      'Present tense verbs': 84,
      'Past tense (preterite)': 75,
      'Future tense': 82,
      'Opinions and justifications': 88,
      'Vocabulary: school and jobs': 80,
      'Vocabulary: free time and holidays': 86,
      'Reading comprehension': 82,
      'Translation into Spanish': 79,
    },
    teacherNotes: 'Reliable, attentive, and consistently hitting grade 7.',
  },
  // 19. Daniel White - Preterite weak, Vocab school weak
  {
    id: 'p-19',
    name: 'Daniel White',
    currentGrade: 5,
    targetGrade: 6,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 66,
      'Past tense (preterite)': 41,
      'Future tense': 68,
      'Opinions and justifications': 70,
      'Vocabulary: school and jobs': 37,
      'Vocabulary: free time and holidays': 64,
      'Reading comprehension': 58,
      'Translation into Spanish': 55,
    },
    teacherNotes: 'Active contributor; revision of topic 1 vocabulary recommended.',
  },
  // 20. Mia Hughes - Above target
  {
    id: 'p-20',
    name: 'Mia Hughes',
    currentGrade: 6,
    targetGrade: 6,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 75,
      'Past tense (preterite)': 65,
      'Future tense': 74,
      'Opinions and justifications': 76,
      'Vocabulary: school and jobs': 70,
      'Vocabulary: free time and holidays': 78,
      'Reading comprehension': 72,
      'Translation into Spanish': 68,
    },
    teacherNotes: 'Up one grade since baseline; thriving with retrieval quizzes.',
  },
  // 21. Leo Jackson - Well below target (3 vs 5), Dropped grade (4->3), Preterite weak, Reading weak, Translation weak
  {
    id: 'p-21',
    name: 'Leo Jackson',
    currentGrade: 3,
    targetGrade: 5,
    previousGrade: 4,
    scores: {
      'Present tense verbs': 46,
      'Past tense (preterite)': 28,
      'Future tense': 48,
      'Opinions and justifications': 52,
      'Vocabulary: school and jobs': 44,
      'Vocabulary: free time and holidays': 50,
      'Reading comprehension': 35,
      'Translation into Spanish': 32,
    },
    teacherNotes: 'Struggling with homework completion; needs intervention contract.',
  },
  // 22. Olivia Robinson - High achiever
  {
    id: 'p-22',
    name: 'Olivia Robinson',
    currentGrade: 8,
    targetGrade: 8,
    previousGrade: 7,
    scores: {
      'Present tense verbs': 88,
      'Past tense (preterite)': 82,
      'Future tense': 90,
      'Opinions and justifications': 92,
      'Vocabulary: school and jobs': 86,
      'Vocabulary: free time and holidays': 90,
      'Reading comprehension': 86,
      'Translation into Spanish': 84,
    },
    teacherNotes: 'Outstanding performance across all skills.',
  },
  // 23. Adam Lewis - Preterite weak
  {
    id: 'p-23',
    name: 'Adam Lewis',
    currentGrade: 5,
    targetGrade: 6,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 68,
      'Past tense (preterite)': 42,
      'Future tense': 65,
      'Opinions and justifications': 68,
      'Vocabulary: school and jobs': 62,
      'Vocabulary: free time and holidays': 66,
      'Reading comprehension': 60,
      'Translation into Spanish': 54,
    },
    teacherNotes: 'Good grammatical understanding; needs consolidation on irregular preterite stems.',
  },
  // 24. Holly Walker - On target
  {
    id: 'p-24',
    name: 'Holly Walker',
    currentGrade: 6,
    targetGrade: 6,
    previousGrade: 6,
    scores: {
      'Present tense verbs': 72,
      'Past tense (preterite)': 64,
      'Future tense': 75,
      'Opinions and justifications': 78,
      'Vocabulary: school and jobs': 70,
      'Vocabulary: free time and holidays': 74,
      'Reading comprehension': 70,
      'Translation into Spanish': 66,
    },
    teacherNotes: 'Steady worker; targets are achievable with current trajectory.',
  },
  // 25. Tyler Wood - Preterite weak
  {
    id: 'p-25',
    name: 'Tyler Wood',
    currentGrade: 5,
    targetGrade: 6,
    previousGrade: 5,
    scores: {
      'Present tense verbs': 65,
      'Past tense (preterite)': 43,
      'Future tense': 68,
      'Opinions and justifications': 67,
      'Vocabulary: school and jobs': 58,
      'Vocabulary: free time and holidays': 65,
      'Reading comprehension': 62,
      'Translation into Spanish': 58,
    },
    teacherNotes: 'Preterite endings are confused with present tense -ar endings.',
  },
  // 26. Scarlett Bennett - On track
  {
    id: 'p-26',
    name: 'Scarlett Bennett',
    currentGrade: 7,
    targetGrade: 7,
    previousGrade: 6,
    scores: {
      'Present tense verbs': 82,
      'Past tense (preterite)': 70,
      'Future tense': 80,
      'Opinions and justifications': 85,
      'Vocabulary: school and jobs': 78,
      'Vocabulary: free time and holidays': 82,
      'Reading comprehension': 80,
      'Translation into Spanish': 76,
    },
    teacherNotes: 'Shows great flair in complex structures and connectives.',
  },
  // 27. Liam Campbell - On track
  {
    id: 'p-27',
    name: 'Liam Campbell',
    currentGrade: 6,
    targetGrade: 6,
    previousGrade: 6,
    scores: {
      'Present tense verbs': 70,
      'Past tense (preterite)': 62,
      'Future tense': 72,
      'Opinions and justifications': 75,
      'Vocabulary: school and jobs': 68,
      'Vocabulary: free time and holidays': 74,
      'Reading comprehension': 68,
      'Translation into Spanish': 64,
    },
    teacherNotes: 'Good revision discipline; on track for targeted grade 6.',
  },
  // 28. Maya Patel - On track
  {
    id: 'p-28',
    name: 'Maya Patel',
    currentGrade: 7,
    targetGrade: 7,
    previousGrade: 7,
    scores: {
      'Present tense verbs': 84,
      'Past tense (preterite)': 74,
      'Future tense': 85,
      'Opinions and justifications': 86,
      'Vocabulary: school and jobs': 80,
      'Vocabulary: free time and holidays': 84,
      'Reading comprehension': 80,
      'Translation into Spanish': 78,
    },
    teacherNotes: 'Consistent high performer; confident speaker and translator.',
  },
];

// ==========================================
// 4. RULES ENGINE (DETERMINISTIC FUNCTIONS)
// ==========================================

/**
 * Normalise a name for fuzzy matching across files
 * Ignores case, accents/diacritics, and handles "Last, First" order
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  // 1. Remove accents / diacritics
  let str = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 2. Handle "Last, First" format (e.g. "Smith, John" -> "John Smith")
  if (str.includes(',')) {
    const parts = str.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      str = `${parts[1]} ${parts[0]}`;
    }
  }

  // 3. Lowercase, strip non-alphanumeric, collapse whitespace
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two pupil names match, ignoring case, accents, and name token order
 */
export function namesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  const t1 = n1.split(' ').filter(Boolean).sort().join(' ');
  const t2 = n2.split(' ').filter(Boolean).sort().join(' ');
  return t1 === t2;
}

/**
 * Compute average class scores across all pupils
 */
export function computeClassAverages(
  pupils: Pupil[]
): Record<SkillName, number> {
  const avgs: Record<SkillName, number> = {} as Record<SkillName, number>;
  if (pupils.length === 0) {
    SKILL_NAMES.forEach((skill) => (avgs[skill] = 0));
    return avgs;
  }

  SKILL_NAMES.forEach((skill) => {
    const total = pupils.reduce((sum, p) => sum + (p.scores[skill] || 0), 0);
    avgs[skill] = Math.round(total / pupils.length);
  });

  return avgs;
}

/**
 * Evaluates whether a skill is considered weak for a pupil:
 * Rule: score under weakSkillMaxScore (50%) AND at least weakSkillUnderClassAvg (10 pts) under class avg.
 */
export function isSkillWeakForPupil(
  score: number,
  classAvg: number,
  thresholds: ThresholdSettings
): boolean {
  return (
    score < thresholds.weakSkillMaxScore &&
    classAvg - score >= thresholds.weakSkillUnderClassAvg
  );
}

/**
 * Analyse an individual pupil against deterministic rules
 */
export function analyzePupil(
  pupil: Pupil,
  classAvgs: Record<SkillName, number>,
  thresholds: ThresholdSettings
): PupilAnalysis {
  const gradeGap = pupil.targetGrade - pupil.currentGrade;
  const isBelowTarget = gradeGap >= thresholds.belowExpectationGap;
  const gradeDrop = pupil.previousGrade - pupil.currentGrade;

  // Identify weak skills
  const weakSkills: SkillName[] = [];
  SKILL_NAMES.forEach((skill) => {
    const score = pupil.scores[skill] ?? 0;
    const avg = classAvgs[skill] ?? 50;
    if (isSkillWeakForPupil(score, avg, thresholds)) {
      weakSkills.push(skill);
    }
  });

  // Flag rules:
  // 1. Below expectation AND 3 or more weak skills
  // 2. Grade dropped 1 or more since previous assessment
  const flagReasons: string[] = [];

  if (isBelowTarget && weakSkills.length >= thresholds.flagPupilWeakSkillsCount) {
    flagReasons.push(
      `Working ${gradeGap} grade${gradeGap > 1 ? 's' : ''} below target (Current ${pupil.currentGrade} vs Target ${pupil.targetGrade}) with ${weakSkills.length} identified weak skills.`
    );
  }

  if (gradeDrop >= thresholds.flagPupilGradeDrop) {
    flagReasons.push(
      `Grade dropped by ${gradeDrop} since previous assessment (from Grade ${pupil.previousGrade} down to ${pupil.currentGrade}).`
    );
  }

  const isFlagged = flagReasons.length > 0;

  // Suggested interventions
  const suggestedInterventions: string[] = [];
  weakSkills.forEach((skill) => {
    const strat = STRATEGY_LIBRARY[skill];
    if (strat) {
      suggestedInterventions.push(`${skill}: ${strat.intervention}`);
    }
  });

  if (isBelowTarget && suggestedInterventions.length === 0) {
    suggestedInterventions.push(
      `Target Recovery: ${GENERAL_STRATEGIES.belowTargetOverall[0]}`
    );
  }

  return {
    pupilId: pupil.id,
    isBelowTarget,
    gradeGap,
    gradeDrop,
    weakSkills,
    isFlagged,
    flagReasons,
    suggestedInterventions,
  };
}

/**
 * Identify whole class priorities:
 * Rule: skill where 40% or more of pupils are weak.
 */
export function identifyWholeClassPriorities(
  pupils: Pupil[],
  analyses: PupilAnalysis[],
  classAvgs: Record<SkillName, number>,
  thresholds: ThresholdSettings
): WholeClassPriority[] {
  if (pupils.length === 0) return [];

  const priorities: WholeClassPriority[] = [];

  SKILL_NAMES.forEach((skill) => {
    const weakCount = analyses.filter((a) => a.weakSkills.includes(skill)).length;
    const weakPct = Math.round((weakCount / pupils.length) * 100);
    const avg = classAvgs[skill] || 0;

    if (weakPct >= thresholds.wholeClassPriorityWeakPct) {
      priorities.push({
        id: `wcp-${skill.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        topic: skill,
        weakCount,
        weakPct,
        classAvg: avg,
        suggestedStrategy:
          STRATEGY_LIBRARY[skill]?.classroomStrategies[0] ||
          'Implement whole-class targeted retrieval drills.',
        accepted: true,
      });
    }
  });

  // Sort by weak percentage descending
  return priorities.sort((a, b) => b.weakPct - a.weakPct);
}

/**
 * Build intervention groups:
 * Rule: 3 or more pupils share the same weak skill.
 */
export function buildInterventionGroups(
  pupils: Pupil[],
  analyses: PupilAnalysis[],
  thresholds: ThresholdSettings
): InterventionGroup[] {
  const groups: InterventionGroup[] = [];

  SKILL_NAMES.forEach((skill) => {
    const pupilIdsWithSkillGap = analyses
      .filter((a) => a.weakSkills.includes(skill))
      .map((a) => a.pupilId);

    if (pupilIdsWithSkillGap.length >= thresholds.groupInterventionMinPupils) {
      groups.push({
        id: `group-${skill.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: `${skill} Clinic`,
        skillOrFocus: skill,
        strategy:
          STRATEGY_LIBRARY[skill]?.intervention ||
          'Small group targeted practice.',
        pupilIds: pupilIdsWithSkillGap,
      });
    }
  });

  // Also if there are pupils below target without a specific group, add a Target Recovery cohort
  const belowTargetUnassigned = analyses
    .filter((a) => a.isBelowTarget && a.weakSkills.length === 0)
    .map((a) => a.pupilId);

  if (belowTargetUnassigned.length >= 2) {
    groups.push({
      id: 'group-target-recovery',
      name: 'GCSE Target Recovery & Exam Strategy',
      skillOrFocus: 'Exam Technique',
      strategy: GENERAL_STRATEGIES.examTechnique[0],
      pupilIds: belowTargetUnassigned,
    });
  }

  return groups;
}

// ==========================================
// 5. FUZZY HEADER MATCHING & SPREADSHEET PARSER
// ==========================================

export interface ParsedUploadData {
  classList?: Array<{
    name: string;
    targetGrade?: number;
    currentGrade?: number;
    yearGroup?: number;
    sendArea?: string;
  }>;
  sendInfo?: Array<{ name: string; sendArea: string; sendStrategy?: string }>;
  assessmentSnapshot?: Array<{
    name: string;
    currentGrade?: number;
    previousGrade?: number;
    targetGrade?: number;
  }>;
  qla?: Array<{ name: string; scores: Partial<Record<SkillName, number>> }>;
}

export function cleanHeaderString(header: string): string {
  if (!header) return '';
  return header
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts and cleans pupil name from a raw cell value.
 * If the cell contains several lines or extra text, uses only the first line.
 */
export function cleanCellName(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  // If cell contains <br>, replace with newline so first line is cleanly separated
  str = str.replace(/<br\s*\/?>/gi, '\n');
  const firstLine = str.split(/[\r\n]+/)[0] || '';
  return firstLine
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Blocklist for the pupil name field. These headers must never map to pupil name.
 * Pupil Premium is a funding flag, not a name.
 */
export const PUPIL_NAME_BLOCKLIST: readonly string[] = [
  'premium',
  'pp',
  'fsm',
  'eal',
  'send',
  'sen',
  'dob',
  'birth',
  'gender',
  'ethnicity',
  'upn',
  'uci',
  'address',
  'email',
  'phone',
  'house',
  'tutor',
  'form',
];

export function isBlockedForPupilName(clean: string): boolean {
  if (!clean) return true;
  const words = clean.split(/\s+/).filter(Boolean);
  return PUPIL_NAME_BLOCKLIST.some((blocked) => words.includes(blocked));
}

export interface FieldMatchingRule {
  fieldKey: string;
  fieldLabel: string;
  exact: string[];
  startsWith: string[];
  contains: string[];
  isBlocked?: (cleanHeader: string) => boolean;
}

export const FIELD_RULES: Record<string, FieldMatchingRule> = {
  firstName: {
    fieldKey: 'firstName',
    fieldLabel: 'first name',
    exact: ['first name', 'forename', 'preferred first name', 'preferred first', 'firstname', 'given name'],
    startsWith: ['first name', 'forename', 'preferred first', 'firstname', 'given name'],
    contains: ['first name', 'forename', 'preferred first', 'firstname', 'given name'],
    isBlocked: isBlockedForPupilName,
  },
  lastName: {
    fieldKey: 'lastName',
    fieldLabel: 'surname',
    exact: ['last name', 'surname', 'family name', 'preferred surname', 'preferred last name', 'lastname'],
    startsWith: ['last name', 'surname', 'family name', 'lastname'],
    contains: ['last name', 'surname', 'family name', 'lastname'],
    isBlocked: isBlockedForPupilName,
  },
  singleName: {
    fieldKey: 'singleName',
    fieldLabel: 'pupil name',
    exact: ['name', 'pupil name', 'pupil', 'student', 'student details', 'student name', 'full name', 'learner name', 'candidate name'],
    startsWith: ['pupil name', 'student details', 'student name', 'full name', 'candidate name', 'learner name', 'name', 'pupil', 'student', 'learner'],
    contains: ['student details', 'pupil name', 'student name', 'full name', 'candidate name', 'name', 'pupil', 'student', 'learner'],
    isBlocked: isBlockedForPupilName,
  },
  yearGroup: {
    fieldKey: 'yearGroup',
    fieldLabel: 'year group',
    exact: ['year group', 'year', 'yr', 'yeargroup', 'cohort year', 'cohort'],
    startsWith: ['year group', 'yeargroup', 'year', 'yr', 'cohort'],
    contains: ['year group', 'yeargroup', 'year', 'cohort'],
  },
  targetGrade: {
    fieldKey: 'targetGrade',
    fieldLabel: 'target grade',
    exact: ['target grade', 'target', 'expected grade', 'expected', 'fft', 'fft20', 'predicted grade', 'predicted', 'tgt', 'exp grade'],
    startsWith: ['target grade', 'target', 'expected grade', 'expected', 'predicted grade', 'predicted', 'fft', 'tgt'],
    contains: ['target', 'expected', 'predicted', 'fft', 'tgt'],
  },
  currentGrade: {
    fieldKey: 'currentGrade',
    fieldLabel: 'current grade',
    exact: ['current grade', 'current', 'working at grade', 'working at', 'wta', 'cag', 'mock grade', 'grade', 'curr'],
    startsWith: ['current grade', 'current', 'working at grade', 'working at', 'mock grade', 'wta', 'cag'],
    contains: ['current', 'working at', 'wta', 'cag', 'mock grade'],
  },
  previousGrade: {
    fieldKey: 'previousGrade',
    fieldLabel: 'previous grade',
    exact: ['previous grade', 'previous', 'prior grade', 'prior', 'baseline grade', 'baseline', 'mock 1', 'prev grade', 'prev', 'last grade'],
    startsWith: ['previous grade', 'previous', 'prior grade', 'prior', 'baseline', 'mock 1', 'prev'],
    contains: ['previous', 'prior', 'baseline', 'mock 1', 'prev'],
  },
  sendArea: {
    fieldKey: 'sendArea',
    fieldLabel: 'area of need',
    exact: ['sen', 'send', 'area of need', 'sen status', 'send area', 'need', 'primary need', 'send need', 'sen code', 'category of need'],
    startsWith: ['sen status', 'send area', 'area of need', 'primary need', 'sen code', 'sen', 'send', 'need'],
    contains: ['sen status', 'send area', 'area of need', 'primary need', 'sen code', 'send', 'sen', 'need'],
  },
  sendStrategy: {
    fieldKey: 'sendStrategy',
    fieldLabel: 'strategy text',
    exact: ['strategy', 'send note', 'send strategy', 'strategy text', 'strategy note', 'provision', 'adjustment', 'adjustments', 'accommodations', 'accommodation', 'notes', 'note'],
    startsWith: ['send strategy', 'strategy text', 'strategy note', 'send note', 'strategy', 'provision', 'adjustment', 'accommodation'],
    contains: ['send strategy', 'strategy text', 'strategy note', 'send note', 'strategy', 'provision', 'adjustment', 'accommodation'],
  },
  'Present tense verbs': {
    fieldKey: 'Present tense verbs',
    fieldLabel: 'Present tense verbs',
    exact: ['present tense verbs', 'present tense', 'present verbs', 'present', 'presente'],
    startsWith: ['present tense', 'present verbs', 'present', 'presente'],
    contains: ['present', 'presente'],
  },
  'Past tense (preterite)': {
    fieldKey: 'Past tense (preterite)',
    fieldLabel: 'Past tense (preterite)',
    exact: ['past tense preterite', 'past tense', 'preterite', 'pret', 'past', 'pasado'],
    startsWith: ['past tense', 'preterite', 'pret', 'pasado'],
    contains: ['preterite', 'pret', 'pasado', 'past'],
  },
  'Future tense': {
    fieldKey: 'Future tense',
    fieldLabel: 'Future tense',
    exact: ['future tense', 'future', 'futuro'],
    startsWith: ['future tense', 'future', 'futuro'],
    contains: ['future', 'futuro'],
  },
  'Opinions and justifications': {
    fieldKey: 'Opinions and justifications',
    fieldLabel: 'Opinions and justifications',
    exact: ['opinions and justifications', 'opinions and justification', 'opinions', 'justifications', 'opinion', 'justif'],
    startsWith: ['opinions and justifications', 'opinions', 'opinion', 'justif'],
    contains: ['opinion', 'justif'],
  },
  'Vocabulary: school and jobs': {
    fieldKey: 'Vocabulary: school and jobs',
    fieldLabel: 'Vocabulary: school and jobs',
    exact: ['vocabulary school and jobs', 'school and jobs', 'school', 'jobs', 'instituto', 'trabajo'],
    startsWith: ['vocabulary school', 'school and jobs', 'school', 'jobs', 'instituto'],
    contains: ['school', 'job', 'instituto', 'trabajo', 'colegio'],
  },
  'Vocabulary: free time and holidays': {
    fieldKey: 'Vocabulary: free time and holidays',
    fieldLabel: 'Vocabulary: free time and holidays',
    exact: ['vocabulary free time and holidays', 'free time and holidays', 'free time', 'holidays', 'tiempo libre', 'vacaciones', 'leisure', 'hobby'],
    startsWith: ['vocabulary free time', 'free time and holidays', 'free time', 'holidays', 'tiempo libre'],
    contains: ['free time', 'holiday', 'tiempo libre', 'vacaciones', 'leisure', 'hobby'],
  },
  'Reading comprehension': {
    fieldKey: 'Reading comprehension',
    fieldLabel: 'Reading comprehension',
    exact: ['reading comprehension', 'reading', 'lectura', 'comprension', 'comprension lectora'],
    startsWith: ['reading comprehension', 'reading', 'lectura', 'comprension'],
    contains: ['reading', 'lectura', 'comprehension', 'comprens'],
  },
  'Translation into Spanish': {
    fieldKey: 'Translation into Spanish',
    fieldLabel: 'Translation into Spanish',
    exact: ['translation into spanish', 'translation', 'traduccion', 'translate'],
    startsWith: ['translation into spanish', 'translation', 'traduccion', 'translate'],
    contains: ['translat', 'traducc'],
  },
};

/**
 * Score a column header against a field rule.
 * Exact match: 100
 * Starts with: 50
 * Contains: 20
 * Blocklisted or no match: 0
 */
export function scoreHeaderForRule(cleanHeader: string, rule: FieldMatchingRule): number {
  if (!cleanHeader) return 0;
  if (rule.isBlocked && rule.isBlocked(cleanHeader)) return 0;

  if (rule.exact.includes(cleanHeader)) return 100;
  if (rule.startsWith.some((p) => cleanHeader.startsWith(p))) return 50;
  if (rule.contains.some((p) => cleanHeader.includes(p))) return 20;

  return 0;
}

export interface DetectedFieldMapping {
  fieldKey: string;
  fieldLabel: string;
  columnDisplay: string;
  currentCol: string;
}

export interface BoxColumnDetectionResult {
  firstNameCol?: string;
  lastNameCol?: string;
  nameCol?: string;
  targetGradeCol?: string;
  currentGradeCol?: string;
  previousGradeCol?: string;
  yearGroupCol?: string;
  sendAreaCol?: string;
  sendStrategyCol?: string;
  skillCols: Partial<Record<SkillName, string>>;
  detectedFieldLines: DetectedFieldMapping[];
}

/**
 * Score all available headers and map each field to exactly ONE highest-scoring column.
 * Handles pupil name priority (First Name + Last Name vs single name).
 */
export function detectBestColumnsForBox(
  boxType: 'classList' | 'sendInfo' | 'assessmentSnapshot' | 'qla',
  rawHeaders: string[],
  overrides: Record<string, string> = {}
): BoxColumnDetectionResult {
  const findBestCol = (fieldKey: string): string | undefined => {
    if (overrides[fieldKey] && rawHeaders.includes(overrides[fieldKey])) {
      return overrides[fieldKey];
    }
    const rule = FIELD_RULES[fieldKey];
    if (!rule) return undefined;

    let highestScore = 0;
    let chosen: string | undefined;

    rawHeaders.forEach((h) => {
      const clean = cleanHeaderString(h);
      const score = scoreHeaderForRule(clean, rule);
      if (score > highestScore) {
        highestScore = score;
        chosen = h;
      }
    });

    return highestScore > 0 ? chosen : undefined;
  };

  const detectedFieldLines: DetectedFieldMapping[] = [];

  // 1. Pupil name detection & priority
  let firstNameCol: string | undefined;
  let lastNameCol: string | undefined;
  let nameCol: string | undefined;

  if (overrides['name'] && rawHeaders.includes(overrides['name'])) {
    // Explicit user override for pupil name
    nameCol = overrides['name'];
    detectedFieldLines.push({
      fieldKey: 'name',
      fieldLabel: 'Pupil name',
      columnDisplay: nameCol,
      currentCol: nameCol,
    });
  } else {
    const bestFirst = findBestCol('firstName');
    const bestLast = findBestCol('lastName');
    const bestSingle = findBestCol('singleName');

    if (bestFirst && bestLast && bestFirst !== bestLast) {
      // (a) Both First Name and Surname columns exist -> combine as "First Last"
      firstNameCol = bestFirst;
      lastNameCol = bestLast;
      detectedFieldLines.push({
        fieldKey: 'name',
        fieldLabel: 'Pupil name',
        columnDisplay: `${bestFirst} + ${bestLast}`,
        currentCol: bestFirst,
      });
    } else if (bestSingle) {
      // (b) Single name column
      nameCol = bestSingle;
      detectedFieldLines.push({
        fieldKey: 'name',
        fieldLabel: 'Pupil name',
        columnDisplay: bestSingle,
        currentCol: bestSingle,
      });
    } else {
      detectedFieldLines.push({
        fieldKey: 'name',
        fieldLabel: 'Pupil name',
        columnDisplay: '(Not detected)',
        currentCol: '',
      });
    }
  }

  // 2. Target grade
  let targetGradeCol: string | undefined;
  if (['classList', 'assessmentSnapshot'].includes(boxType)) {
    targetGradeCol = findBestCol('targetGrade');
    if (targetGradeCol) {
      detectedFieldLines.push({
        fieldKey: 'targetGrade',
        fieldLabel: 'Target grade',
        columnDisplay: targetGradeCol,
        currentCol: targetGradeCol,
      });
    }
  }

  // 3. Current grade
  let currentGradeCol: string | undefined;
  if (['classList', 'assessmentSnapshot'].includes(boxType)) {
    currentGradeCol = findBestCol('currentGrade');
    if (currentGradeCol) {
      detectedFieldLines.push({
        fieldKey: 'currentGrade',
        fieldLabel: 'Current grade',
        columnDisplay: currentGradeCol,
        currentCol: currentGradeCol,
      });
    }
  }

  // 4. Previous grade
  let previousGradeCol: string | undefined;
  if (boxType === 'assessmentSnapshot') {
    previousGradeCol = findBestCol('previousGrade');
    if (previousGradeCol) {
      detectedFieldLines.push({
        fieldKey: 'previousGrade',
        fieldLabel: 'Previous grade',
        columnDisplay: previousGradeCol,
        currentCol: previousGradeCol,
      });
    }
  }

  // 5. Year group
  let yearGroupCol: string | undefined;
  if (boxType === 'classList') {
    yearGroupCol = findBestCol('yearGroup');
    if (yearGroupCol) {
      detectedFieldLines.push({
        fieldKey: 'yearGroup',
        fieldLabel: 'Year group',
        columnDisplay: yearGroupCol,
        currentCol: yearGroupCol,
      });
    }
  }

  // 6. SEND Area (Requirement 5: "SEN" on the class list maps to area of need only)
  let sendAreaCol: string | undefined;
  if (['classList', 'sendInfo'].includes(boxType)) {
    sendAreaCol = findBestCol('sendArea');
    if (sendAreaCol) {
      detectedFieldLines.push({
        fieldKey: 'sendArea',
        fieldLabel: 'Area of need',
        columnDisplay: sendAreaCol,
        currentCol: sendAreaCol,
      });
    }
  }

  // 7. SEND Strategy
  let sendStrategyCol: string | undefined;
  if (boxType === 'sendInfo') {
    sendStrategyCol = findBestCol('sendStrategy');
    if (sendStrategyCol) {
      detectedFieldLines.push({
        fieldKey: 'sendStrategy',
        fieldLabel: 'Strategy text',
        columnDisplay: sendStrategyCol,
        currentCol: sendStrategyCol,
      });
    }
  }

  // 8. QLA Skills
  const skillCols: Partial<Record<SkillName, string>> = {};
  if (boxType === 'qla') {
    SKILL_NAMES.forEach((skill) => {
      const col = findBestCol(skill);
      if (col) {
        skillCols[skill] = col;
        detectedFieldLines.push({
          fieldKey: skill,
          fieldLabel: skill,
          columnDisplay: col,
          currentCol: col,
        });
      }
    });
  }

  return {
    firstNameCol,
    lastNameCol,
    nameCol,
    targetGradeCol,
    currentGradeCol,
    previousGradeCol,
    yearGroupCol,
    sendAreaCol,
    sendStrategyCol,
    skillCols,
    detectedFieldLines,
  };
}

export const FIELD_DISPLAY_NAMES: Record<string, string> = {
  name: 'pupil name',
  firstName: 'first name',
  lastName: 'surname',
  targetGrade: 'target grade',
  currentGrade: 'current grade',
  previousGrade: 'previous grade',
  yearGroup: 'year group',
  sendArea: 'area of need',
  sendStrategy: 'strategy text',
  'Present tense verbs': 'Present tense verbs',
  'Past tense (preterite)': 'Past tense (preterite)',
  'Future tense': 'Future tense',
  'Opinions and justifications': 'Opinions and justifications',
  'Vocabulary: school and jobs': 'Vocabulary: school and jobs',
  'Vocabulary: free time and holidays': 'Vocabulary: free time and holidays',
  'Reading comprehension': 'Reading comprehension',
  'Translation into Spanish': 'Translation into Spanish',
};

export function matchHeaderToField(header: string): string | null {
  const clean = cleanHeaderString(header);
  if (!clean) return null;

  let bestField: string | null = null;
  let bestScore = 0;

  Object.entries(FIELD_RULES).forEach(([fieldKey, rule]) => {
    const score = scoreHeaderForRule(clean, rule);
    if (score > bestScore) {
      bestScore = score;
      bestField = fieldKey;
    }
  });

  return bestScore > 0 ? bestField : null;
}

/**
 * Read spreadsheet rows from File using SheetJS for .xlsx/.xls and PapaParse for .csv
 */
export async function readSpreadsheetFile(
  file: File
): Promise<Array<Record<string, unknown>>> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  if (ext === 'csv') {
    const text = await file.text();
    const cleanText = text.replace(/^\uFEFF/, ''); // strip BOM
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(cleanText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().replace(/^\uFEFF/, ''),
        complete: (results) => {
          if (results.errors && results.errors.length > 0 && results.data.length === 0) {
            reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          } else {
            resolve(results.data);
          }
        },
        error: (err: Error) => reject(new Error(`Failed to parse CSV: ${err.message}`)),
      });
    });
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('No worksheets found in Excel file.');
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      raw: false,
    });
    return rows;
  }

  throw new Error('Unsupported spreadsheet format. Please upload .xlsx, .xls or .csv.');
}

/**
 * Parse an uploaded file buffer (CSV or XLSX) into raw rows of objects
 */
export function parseSpreadsheetFile(
  data: ArrayBuffer | string
): Array<Record<string, unknown>> {
  const workbook =
    typeof data === 'string'
      ? XLSX.read(data, { type: 'string' })
      : XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  });
}

/**
 * 6 invented pupils for testing upload flows without real student data
 */
export const SAMPLE_TEST_PUPILS = [
  {
    name: 'Sofia Rodriguez',
    currentGrade: 5,
    targetGrade: 7,
    previousGrade: 5,
    yearGroup: 11,
    sendArea: 'Dyslexia',
    sendStrategy: 'Visual vocabulary flashcards and extra reading time.',
    scores: {
      'Present tense verbs': 62,
      'Past tense (preterite)': 45,
      'Future tense': 70,
      'Opinions and justifications': 68,
      'Vocabulary: school and jobs': 50,
      'Vocabulary: free time and holidays': 55,
      'Reading comprehension': 42,
      'Translation into Spanish': 48,
    } as Record<SkillName, number>,
  },
  {
    name: 'Liam Smith',
    currentGrade: 4,
    targetGrade: 6,
    previousGrade: 5,
    yearGroup: 11,
    sendArea: 'ADHD',
    sendStrategy: 'Chunked 10-minute micro-tasks and tactile verb wheels.',
    scores: {
      'Present tense verbs': 48,
      'Past tense (preterite)': 35,
      'Future tense': 52,
      'Opinions and justifications': 55,
      'Vocabulary: school and jobs': 40,
      'Vocabulary: free time and holidays': 46,
      'Reading comprehension': 38,
      'Translation into Spanish': 36,
    } as Record<SkillName, number>,
  },
  {
    name: 'Amara Patel',
    currentGrade: 7,
    targetGrade: 8,
    previousGrade: 7,
    yearGroup: 11,
    sendArea: '',
    sendStrategy: '',
    scores: {
      'Present tense verbs': 82,
      'Past tense (preterite)': 75,
      'Future tense': 88,
      'Opinions and justifications': 85,
      'Vocabulary: school and jobs': 80,
      'Vocabulary: free time and holidays': 78,
      'Reading comprehension': 76,
      'Translation into Spanish': 72,
    } as Record<SkillName, number>,
  },
  {
    name: 'Lucas Brown',
    currentGrade: 3,
    targetGrade: 5,
    previousGrade: 4,
    yearGroup: 11,
    sendArea: 'SLCN',
    sendStrategy: 'Sentence stems and vocabulary mats before speaking.',
    scores: {
      'Present tense verbs': 38,
      'Past tense (preterite)': 25,
      'Future tense': 40,
      'Opinions and justifications': 45,
      'Vocabulary: school and jobs': 32,
      'Vocabulary: free time and holidays': 38,
      'Reading comprehension': 30,
      'Translation into Spanish': 28,
    } as Record<SkillName, number>,
  },
  {
    name: 'Elena Garcia',
    currentGrade: 6,
    targetGrade: 6,
    previousGrade: 6,
    yearGroup: 11,
    sendArea: '',
    sendStrategy: '',
    scores: {
      'Present tense verbs': 72,
      'Past tense (preterite)': 64,
      'Future tense': 70,
      'Opinions and justifications': 75,
      'Vocabulary: school and jobs': 68,
      'Vocabulary: free time and holidays': 65,
      'Reading comprehension': 62,
      'Translation into Spanish': 60,
    } as Record<SkillName, number>,
  },
  {
    name: 'Noah Wilson',
    currentGrade: 5,
    targetGrade: 7,
    previousGrade: 6,
    yearGroup: 11,
    sendArea: 'SEMH',
    sendStrategy: 'Low-stakes questioning and positive reinforcement.',
    scores: {
      'Present tense verbs': 58,
      'Past tense (preterite)': 44,
      'Future tense': 62,
      'Opinions and justifications': 60,
      'Vocabulary: school and jobs': 48,
      'Vocabulary: free time and holidays': 52,
      'Reading comprehension': 45,
      'Translation into Spanish': 46,
    } as Record<SkillName, number>,
  },
];

/**
 * Generate sample CSV text for any of the 4 file types with 6 invented pupils
 */
export function generateSampleCsv(
  type: 'classList' | 'sendInfo' | 'assessmentSnapshot' | 'qla'
): string {
  if (type === 'classList') {
    const headers = ['Pupil Name', 'Year Group', 'Target Grade', 'Current Grade', 'SEN', 'Pupil Premium'];
    const rows = SAMPLE_TEST_PUPILS.map(
      (p, idx) =>
        `"${p.name}",${p.yearGroup},${p.targetGrade},${p.currentGrade},"${p.sendArea || ''}","${idx % 2 === 0 ? 'Yes' : 'No'}"`
    );
    return [headers.join(','), ...rows].join('\n');
  }

  if (type === 'sendInfo') {
    const headers = ['Pupil Name', 'Area of Need', 'Strategy Note'];
    const rows = SAMPLE_TEST_PUPILS.filter((p) => p.sendArea).map(
      (p) => `"${p.name}","${p.sendArea}","${p.sendStrategy || ''}"`
    );
    return [headers.join(','), ...rows].join('\n');
  }

  if (type === 'assessmentSnapshot') {
    const headers = ['Learner', 'Working At Grade', 'Target Grade', 'Previous Grade'];
    const rows = SAMPLE_TEST_PUPILS.map(
      (p) => `"${p.name}",${p.currentGrade},${p.targetGrade},${p.previousGrade}`
    );
    return [headers.join(','), ...rows].join('\n');
  }

  // QLA
  const headers = [
    'Pupil',
    'Present tense verbs',
    'Past tense (preterite)',
    'Future tense',
    'Opinions and justifications',
    'Vocabulary: school and jobs',
    'Vocabulary: free time and holidays',
    'Reading comprehension',
    'Translation into Spanish',
  ];
  const rows = SAMPLE_TEST_PUPILS.map((p) => {
    const scores = SKILL_NAMES.map((s) => p.scores[s] ?? 50);
    return `"${p.name}",${scores.join(',')}`;
  });
  return [headers.join(','), ...rows].join('\n');
}
