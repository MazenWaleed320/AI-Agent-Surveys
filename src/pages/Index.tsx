import { useState, useEffect, useMemo } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import MetricCard from "@/components/MetricCard";
import NegativeFeedbackByDepartment from "@/components/NegativeFeedbackByDepartment";
import FlaggedResponses from "@/components/FlaggedResponses";
import { Users, TrendingUp, MessageSquare, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Survey = {
  id: string;
  title: string;
  created_at: string;
};

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState<string>("");

  useEffect(() => {
    fetchSurveys();
  }, []);

  useEffect(() => {
    if (selectedSurveyId) {
      fetchSurveyData(selectedSurveyId);
    }
  }, [selectedSurveyId]);

  const fetchSurveys = async () => {
    try {
      const { data, error } = await supabase
        .from("surveys")
        .select("id, title, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSurveys(data || []);
      if (data && data.length > 0) {
        setSelectedSurveyId(data[0].id);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSurveyData = async (surveyId: string) => {
    setLoading(true);
    try {
      // Fetch responses
      const { data: responsesData, error: responsesError } = await supabase
        .from("survey_responses")
        .select(`
          id,
          response_score,
          employee_id,
          created_at,
          sentiment_analysis (sentiment, confidence)
        `)
        .eq("survey_id", surveyId);

      if (responsesError) throw responsesError;
      setResponses(responsesData || []);

      // Fetch flags
      const { data: flagsData, error: flagsError } = await supabase
        .from("response_flags")
        .select("*")
        .eq("survey_id", surveyId)
        .eq("status", "pending");

      if (flagsError) throw flagsError;
      setFlags(flagsData || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSurvey = async () => {
    try {
      const { error } = await supabase
        .from("surveys")
        .delete()
        .eq("id", surveyToDelete);

      if (error) throw error;

      toast({ title: "Success", description: "Survey deleted successfully" });
      
      // Refresh surveys list
      const updatedSurveys = surveys.filter(s => s.id !== surveyToDelete);
      setSurveys(updatedSurveys);
      
      // Reset selected survey if it was deleted
      if (selectedSurveyId === surveyToDelete) {
        setSelectedSurveyId(updatedSurveys.length > 0 ? updatedSurveys[0].id : "");
      }
      
      setDeleteDialogOpen(false);
      setSurveyToDelete("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openDeleteDialog = (surveyId: string) => {
    setSurveyToDelete(surveyId);
    setDeleteDialogOpen(true);
  };

  const metrics = useMemo(() => {
    if (!responses.length) return { totalResponses: 0, avgSentiment: 0, sentimentType: 'neutral' as const, responseRate: 0, flaggedCount: 0 };

    const uniqueEmployees = new Set(responses.map(r => r.employee_id)).size;
    
    // Calculate sentiment from sentiment_analysis (excluding neutral)
    const sentiments = responses
      .filter(r => r.sentiment_analysis && r.sentiment_analysis.length > 0)
      .map(r => r.sentiment_analysis[0]?.sentiment)
      .filter(s => s === 'positive' || s === 'negative'); // Exclude neutral
    
    const positiveSentiments = sentiments.filter(s => s === 'positive').length;
    const negativeSentiments = sentiments.filter(s => s === 'negative').length;
    const totalSentiments = sentiments.length;
    const avgSentiment = totalSentiments > 0 ? Math.round((positiveSentiments / totalSentiments) * 100) : 0;
    const sentimentType = avgSentiment >= 60 ? 'positive' as const : avgSentiment >= 40 ? 'neutral' as const : 'negative' as const;

    return {
      totalResponses: uniqueEmployees,
      avgSentiment,
      sentimentType,
      responseRate: 0,
      flaggedCount: flags.length
    };
  }, [responses, flags]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-glow py-16">
        <div className="container relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-primary-foreground mb-4">
              Employee Engagement Dashboard
            </h1>
            <p className="text-lg text-primary-foreground/90 mb-6">
              Monitor, analyze, and improve employee satisfaction with AI-powered insights and automated feedback collection.
            </p>
            <div className="flex gap-3">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90" onClick={() => navigate("/create-survey")}>
                Send New Survey
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate("/analytics")}>
                View Analytics
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
      </section>

      {/* Main Dashboard */}
      <div className="container py-8">
        {/* Survey Selection */}
        {surveys.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Select Survey</CardTitle>
              <CardDescription>Choose a survey to view its dashboard metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a survey" />
                  </SelectTrigger>
                  <SelectContent>
                    {surveys.map((survey) => (
                      <SelectItem key={survey.id} value={survey.id}>
                        {survey.title} - {new Date(survey.created_at).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSurveyId && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => openDeleteDialog(selectedSurveyId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Take surveys or view detailed analytics</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={() => navigate("/surveys")}>
              Take Survey
            </Button>
            <Button variant="outline" onClick={() => navigate("/create-survey")}>
              Create Survey
            </Button>
            <Button variant="outline" onClick={() => navigate("/analytics")}>
              View Analytics
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : selectedSurveyId ? (
          <>
            {/* Metrics Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              <MetricCard
                title="Total Responses"
                value={metrics.totalResponses.toString()}
                change="Unique respondents"
                changeType="neutral"
                icon={Users}
              />
              <MetricCard
                title="Total Feedback"
                value={responses.length.toString()}
                change="All responses"
                changeType="neutral"
                icon={MessageSquare}
              />
              <MetricCard
                title="Flagged Items"
                value={metrics.flaggedCount.toString()}
                change={metrics.flaggedCount > 0 ? "Requires attention" : "All clear"}
                changeType={metrics.flaggedCount > 0 ? "negative" : "positive"}
                icon={AlertTriangle}
              />
            </div>

            {/* Negative Feedback Analysis */}
            <div className="mb-8">
              <NegativeFeedbackByDepartment surveyId={selectedSurveyId} />
            </div>

            {/* Flagged Responses */}
            <FlaggedResponses surveyId={selectedSurveyId} />
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No surveys available yet.</p>
              <Button onClick={() => navigate("/create-survey")}>
                Create Your First Survey
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Survey</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this survey? This action cannot be undone and will permanently delete all responses and data associated with this survey.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSurvey} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
