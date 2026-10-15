export type SkillName =
  | 'Present tense verbs'
  | 'Past tense (preterite)'
  | 'Future tense'
  | 'Opinions and justifications'
  | 'Vocabulary: school and jobs'
  | 'Vocabulary: free time and holidays'
  | 'Reading comprehension'
  | 'Translation into Spanish';

export const SKILL_NAMES: SkillName[] = [
  'Present tense verbs',
  'Past tense (preterite)',
  'Future tense',
  'Opinions and justifications',
  'Vocabulary: school and jobs',
  'Vocabulary: free time and holidays',
  'Reading comprehension',
  'Translation into Spanish',
];

export type SendArea =
  | 'SLCN'
  | 'ASD'
  | 'Dyslexia'
  | 'SEMH'
  | 'ADHD'
  | 'Hearing impairment';

export interface Pupil {
  id: string;
  name: string;
  currentGrade: number;
  targetGrade: number;
  previousGrade: number;
  scores: Record<SkillName, number>;
  sendArea?: SendArea | string;
  sendStrategy?: string;
  teacherNotes?: string;
  chosenStrategies?: string[];
  yearGroup?: number;
}

export interface PupilAnalysis {
  pupilId: string;
  isBelowTarget: boolean;
  gradeGap: number; // targetGrade - currentGrade
  gradeDrop: number; // previousGrade - currentGrade
  weakSkills: SkillName[];
  isFlagged: boolean;
  flagReasons: string[];
  suggestedInterventions: string[];
}

export interface WholeClassPriority {
  id: string;
  topic: SkillName | string;
  weakCount: number;
  weakPct: number;
  classAvg: number;
  suggestedStrategy: string;
  accepted: boolean;
  isCustom?: boolean;
}

export interface InterventionGroup {
  id: string;
  name: string;
  skillOrFocus: string;
  strategy: string;
  pupilIds: string[];
}

export interface ThresholdSettings {
  belowExpectationGap: number;
  weakSkillMaxScore: number;
  weakSkillUnderClassAvg: number;
  flagPupilWeakSkillsCount: number;
  flagPupilGradeDrop: number;
  wholeClassPriorityWeakPct: number;
  groupInterventionMinPupils: number;
}

export interface SkillStrategy {
  classroomStrategies: [string, string];
  intervention: string;
}
