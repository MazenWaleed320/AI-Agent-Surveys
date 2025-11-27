import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle } from "lucide-react";
import EmployeeHeader from "@/components/EmployeeHeader";
import SurveyForm from "@/components/SurveyForm";
import { useUserRole } from "@/hooks/useUserRole";

type Survey = {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
};

const TakeSurvey = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isHRManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    fetchActiveSurveys();
  }, []);

  const fetchActiveSurveys = async () => {
    try {
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSurveys(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const selectSurvey = async (survey: Survey) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", survey.id)
        .order("order_index");

      if (error) throw error;
      setQuestions(data || []);
      setSelectedSurvey(survey);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setCompleted(true);
    setSelectedSurvey(null);
    setQuestions([]);
    fetchActiveSurveys();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <EmployeeHeader />
        <div className="flex justify-center items-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-background">
        <EmployeeHeader />
        <div className="container py-8">
          <Card className="max-w-2xl mx-auto text-center">
            <CardContent className="pt-12 pb-12">
              <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
              <p className="text-muted-foreground mb-6">
                Your feedback has been submitted successfully.
              </p>
              <Button onClick={() => setCompleted(false)}>
                Take Another Survey
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (selectedSurvey && questions.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <EmployeeHeader />
        <div className="container py-8">
          <Button variant="ghost" onClick={() => setSelectedSurvey(null)} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Surveys
          </Button>
          <SurveyForm
            surveyId={selectedSurvey.id}
            questions={questions}
            onComplete={handleComplete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <EmployeeHeader />
      
      <div className="container py-8">
        {isHRManager && (
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Available Surveys</h1>
          <p className="text-muted-foreground">Select a survey to provide your feedback</p>
        </div>

        {surveys.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No active surveys available at the moment.</p>
              {isHRManager && (
                <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
                  Back to Dashboard
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {surveys.map((survey) => (
              <Card key={survey.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => selectSurvey(survey)}>
                <CardHeader>
                  <CardTitle>{survey.title}</CardTitle>
                  <CardDescription>
                    {survey.description || "Click to start this survey"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-4">
                    Created: {new Date(survey.created_at).toLocaleDateString()}
                  </p>
                  <Button className="w-full" onClick={(e) => {
                    e.stopPropagation();
                    selectSurvey(survey);
                  }}>
                    Start Survey
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TakeSurvey;
