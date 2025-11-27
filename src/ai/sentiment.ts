import { supabase } from "@/integrations/supabase/client";
import type { SentimentAnalysisResult, FlagConfig } from "./types";

/**
 * Analyzes sentiment of text using AI
 */
export async function analyzeSentiment(
  responseId: string,
  responseText: string
): Promise<SentimentAnalysisResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-sentiment", {
      body: {
        responseId,
        responseText,
      },
    });

    if (error) {
      console.error("Error analyzing sentiment:", error);
      return null;
    }

    return (data as any)?.analysis || null;
  } catch (error) {
    console.error("Error invoking sentiment analysis:", error);
    return null;
  }
}

/**
 * Creates a response flag for negative sentiment
 */
export async function createNegativeSentimentFlag(
  analysis: SentimentAnalysisResult,
  responseValue: string,
  config: Omit<FlagConfig, "severity" | "issue_type" | "description" | "flagged_by" | "status">
): Promise<void> {
  let summary = responseValue;
  let keyTheme = "general feedback";

  try {
    if (analysis.ai_summary && typeof analysis.ai_summary === "string") {
      const jsonMatch = analysis.ai_summary.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        summary = parsed.summary || summary;
        if (parsed.key_themes && Array.isArray(parsed.key_themes) && parsed.key_themes.length > 0) {
          keyTheme = parsed.key_themes[0];
        }
      }
    }
  } catch (e) {
    console.log("Could not parse AI summary, using original text");
  }

  const formattedDescription = `Analysis detected an issue in ${keyTheme}: ${summary}`;

  await supabase.from("response_flags").insert({
    ...config,
    severity: analysis.confidence > 0.8 ? "critical" : "warning",
    issue_type: "negative_sentiment",
    description: formattedDescription.slice(0, 250),
    flagged_by: "system",
    status: "pending",
  });
}

/**
 * Creates a flag for low rating responses
 */
export async function createLowRatingFlag(
  score: number,
  config: Omit<FlagConfig, "severity" | "issue_type" | "description" | "flagged_by" | "status">
): Promise<void> {
  await supabase.from("response_flags").insert({
    ...config,
    severity: score === 1 ? "critical" : "warning",
    issue_type: "low_rating",
    description: `Low rating submitted: ${score}/5`,
    flagged_by: "system",
    status: "pending",
  });
}


