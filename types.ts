
export enum NYSCScenario {
  CAMP_ADDRESS = 'Address to Corps Members (Camp)',
  MANAGEMENT_MEETING = 'Management/Stakeholder Meeting',
  FIELD_OFFICE_BRIEF = 'Field Office Briefing',
  POP_CEREMONY = 'Passing Out Parade (POP) Speech',
  SAED_KEYNOTE = 'SAED Keynote Address',
  CRISIS_COMM = 'Crisis Communication/Press Briefing',
  GOVERNMENT_LIAISON = 'Liaison with State Government'
}

export enum LeadershipStyle {
  COMMANDING = 'Commanding & Authoritative',
  MOTIVATIONAL = 'Motivational & Inspiring',
  CONSULTATIVE = 'Consultative & Diplomatic',
  INSTRUCTIVE = 'Instructive & Policy-Driven'
}

export interface SpeechOutline {
  title: string;
  hook: string;
  keyPillars: {
    title: string;
    talkingPoints: string[];
  }[];
  callToAction: string;
  closingStatement: string;
}

export interface SuggestedPoint {
  text: string;
  isCovered: boolean;
}

export interface CoachingAlert {
  id: string;
  type: 'pacing' | 'clarity' | 'phrasing' | 'filler' | 'leadership';
  message: string;
  timestamp: number;
}

export interface FeedbackMetric {
  label: string;
  score: number; // 0-100
  feedback: string;
}

export interface SpeechAnalysis {
  transcript: string;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  suggestedPoints: string[];
  metrics: FeedbackMetric[];
  toneAnalysis: string;
  leadershipAlignment: number; // 0-100
}

export interface SessionRecord {
  id: string;
  date: string;
  scenario: NYSCScenario;
  leadershipStyle?: LeadershipStyle;
  analysis: SpeechAnalysis;
}

export interface GlossaryTerm {
  term: string;
  category: 'Operational' | 'Statutory' | 'Leadership';
  definition: string;
  usage: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
