// AI Service Types

export interface SentimentAnalysisResult {
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  key_themes: string[];
  ai_summary: string;
}

export interface AnalyzeSentimentResponse {
  success: boolean;
  analysis: SentimentAnalysisResult;
}

export interface FlagConfig {
  employee_id: string;
  survey_id: string;
  severity: "critical" | "warning";
  issue_type: string;
  description: string;
  flagged_by: string;
  status: string;
}


