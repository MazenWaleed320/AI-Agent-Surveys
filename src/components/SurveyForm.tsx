import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { analyzeSentiment, createLowRatingFlag } from "@/ai/sentiment";

interface SurveyFormProps {
  surveyId: string;
  questions: Array<{
    id: string;
    question_text: string;
    question_type: string;
    required: boolean;
  }>;
  onComplete: () => void;
}

const SurveyForm = ({ surveyId, questions, onComplete }: SurveyFormProps) => {
  const [responses, setResponses] = useState<Record<string, { value: string; score?: number }>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Get current user's profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Ensure profile exists or create one for the current user
      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        const metadata = (user.user_metadata as any) || {};
        const fullName = (metadata.full_name as string) || (metadata.name as string) || (user.email?.split("@")[0] as string) || "User";
        const department = (metadata.department as string) || "General";
        const role = (metadata.role as string) || "employee";
        const email = user.email || "unknown@example.com";

        const { data: created, error: createError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            email,
            full_name: fullName,
            department,
            role,
          })
          .select("id")
          .single();

        if (createError) throw createError;
        profile = created;
      }

      // Submit all responses
      const responsePromises = Object.entries(responses).map(async ([questionId, response]) => {
        const { data: responseData, error } = await supabase
          .from("survey_responses")
          .insert({
            survey_id: surveyId,
            question_id: questionId,
            employee_id: profile.id,
            response_value: response.value,
            response_score: response.score,
          })
          .select()
          .single();

        if (error) throw error;

        const question = questions.find((q) => q.id === questionId);

        // Trigger sentiment analysis for ALL text responses
        if (question?.question_type === "text" && response.value && response.value.trim().length > 0) {
          const analysis = await analyzeSentiment(responseData.id, response.value);
          
          // Flag creation handled by backend; no client-side flag to avoid duplicates
        }

        // Flag low rating answers (1 or 2)
        if (question?.question_type === "rating" && typeof response.score === "number" && response.score <= 2) {
          await createLowRatingFlag(response.score, {
            employee_id: profile.id,
            survey_id: surveyId,
          });
        }

        return responseData;
      });

      await Promise.all(responsePromises);

      // Notify HR managers about survey submission
      const { data: hrManagers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "hr_manager");

      if (hrManagers && hrManagers.length > 0) {
        const notificationPromises = hrManagers.map((manager) =>
          supabase.from("notifications").insert({
            recipient_id: manager.user_id,
            title: "New Survey Submission",
            message: `An employee has completed a survey.`,
            type: "survey_submission",
          })
        );
        await Promise.all(notificationPromises);
      }

      toast({
        title: "Survey submitted!",
        description: "Thank you for your feedback.",
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (questionId: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: { value, score: parseInt(value) },
    }));
  };

  const handleTextChange = (questionId: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: { value },
    }));
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Employee Feedback Survey</CardTitle>
        <CardDescription>Please take a moment to share your thoughts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.map((question) => (
          <div key={question.id} className="space-y-3">
            <Label className="text-base">
              {question.question_text}
              {question.required && <span className="text-destructive">*</span>}
            </Label>

            {question.question_type === "rating" ? (
              <RadioGroup
                onValueChange={(value) => handleRatingChange(question.id, value)}
                value={responses[question.id]?.value}
              >
                <div className="flex gap-4">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <div key={rating} className="flex items-center space-x-2">
                      <RadioGroupItem value={rating.toString()} id={`${question.id}-${rating}`} />
                      <Label htmlFor={`${question.id}-${rating}`}>{rating}</Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">1 = Strongly Disagree, 5 = Strongly Agree</p>
              </RadioGroup>
            ) : (
              <Textarea
                placeholder="Share your thoughts..."
                value={responses[question.id]?.value || ""}
                onChange={(e) => handleTextChange(question.id, e.target.value)}
                rows={4}
              />
            )}
          </div>
        ))}

        <Button onClick={handleSubmit} className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Survey
        </Button>
      </CardContent>
    </Card>
  );
};

export default SurveyForm;
