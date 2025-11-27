import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, TrendingUp, Users, MessageSquare, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type Survey = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type QuestionAnalysis = {
  question_id: string;
  question_text: string;
  question_type: string;
  avg_score: number | null;
  response_count: number;
  responses: Array<{ 
    response_value: string; 
    sentiment?: string;
    employee_name?: string;
    department?: string;
  }>;
};

type DepartmentStats = {
  department: string;
  response_count: number;
  avg_score: number;
};

const Analytics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [questionAnalysis, setQuestionAnalysis] = useState<QuestionAnalysis[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [sentimentCounts, setSentimentCounts] = useState({ positive: 0, neutral: 0, negative: 0 });
  const [totalResponses, setTotalResponses] = useState(0);
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) => {
    setExpandedResponses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchSurveys();
  }, []);

  useEffect(() => {
    if (selectedSurveyId) {
      fetchAnalytics(selectedSurveyId);
    }
  }, [selectedSurveyId]);

  const fetchSurveys = async () => {
    try {
      const { data, error } = await supabase
        .from("surveys")
        .select("id, title, status, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSurveys(data || []);
      if (data && data.length > 0) {
        setSelectedSurveyId(data[0].id);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const fetchAnalytics = async (surveyId: string) => {
    setLoading(true);
    try {
      // Fetch questions with responses
      const { data: questions, error: questionsError } = await supabase
        .from("survey_questions")
        .select("id, question_text, question_type")
        .eq("survey_id", surveyId)
        .order("order_index");

      if (questionsError) throw questionsError;

      // Fetch all responses for this survey
      const { data: responses, error: responsesError } = await supabase
        .from("survey_responses")
        .select(`
          id,
          question_id,
          response_value,
          response_score,
          employee_id,
          sentiment_analysis (sentiment),
          profiles!inner (full_name, department)
        `)
        .eq("survey_id", surveyId);

      if (responsesError) throw responsesError;

      // Calculate question-level analytics
      const analysis = questions?.map((q) => {
        const questionResponses = responses?.filter((r) => r.question_id === q.id) || [];
        const scores = questionResponses
          .map((r) => r.response_score)
          .filter((s): s is number => s !== null);
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

        return {
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          avg_score: avgScore,
          response_count: questionResponses.length,
          responses: questionResponses.map((r) => {
            const sentimentData = (r.sentiment_analysis as any)?.[0]?.sentiment;
            const profileData = (r as any).profiles;
            
            // Infer sentiment from text if no sentiment analysis
            let sentiment = sentimentData;
            if (!sentiment && r.response_value) {
              const lowerText = r.response_value.toLowerCase();
              if (lowerText.includes('good') || lowerText.includes('great') || lowerText.includes('excellent') || 
                  lowerText.includes('love') || lowerText.includes('amazing') || lowerText.includes('positive')) {
                sentiment = 'positive';
              } else if (lowerText.includes('bad') || lowerText.includes('terrible') || lowerText.includes('poor') || 
                         lowerText.includes('hate') || lowerText.includes('negative')) {
                sentiment = 'negative';
              } else {
                sentiment = 'neutral';
              }
            }
            
            return {
              response_value: r.response_value,
              sentiment,
              employee_name: profileData?.full_name,
              department: profileData?.department,
            };
          }),
        };
      }) || [];

      setQuestionAnalysis(analysis);
      setTotalResponses(new Set(responses?.map((r) => r.employee_id)).size);

      // Calculate sentiment distribution
      let positive = 0, neutral = 0, negative = 0;
      
      responses?.forEach((r) => {
        // Check if there's sentiment analysis from text responses
        const sentimentData = (r.sentiment_analysis as any)?.[0];
        if (sentimentData) {
          if (sentimentData.sentiment === "positive") positive++;
          else if (sentimentData.sentiment === "negative") negative++;
          else neutral++;
        }
        // For rating responses without sentiment, infer from score
        else if (r.response_score !== null && r.response_score !== undefined) {
          if (r.response_score >= 4) positive++;
          else if (r.response_score <= 2) negative++;
          else neutral++;
        }
      });
      
      setSentimentCounts({ positive, neutral, negative });

      // Fetch department statistics
      const { data: deptData, error: deptError } = await supabase
        .from("survey_responses")
        .select(`
          response_score,
          employee_id,
          profiles!inner (department)
        `)
        .eq("survey_id", surveyId)
        .not("response_score", "is", null);

      if (deptError) throw deptError;

      // Group by department
      const deptMap = new Map<string, { scores: number[]; count: number }>();
      deptData?.forEach((row: any) => {
        const dept = row.profiles?.department || "Unknown";
        if (!deptMap.has(dept)) {
          deptMap.set(dept, { scores: [], count: 0 });
        }
        const entry = deptMap.get(dept)!;
        entry.scores.push(row.response_score);
        entry.count++;
      });

      const deptStats = Array.from(deptMap.entries()).map(([department, data]) => ({
        department,
        response_count: data.count,
        avg_score: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
      }));

      setDepartmentStats(deptStats);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-success";
      case "negative":
        return "bg-destructive";
      default:
        return "bg-muted";
    }
  };

  const totalSentiments = sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <div className="container py-8">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Survey Analytics</h1>
          <p className="text-muted-foreground">Detailed insights from employee feedback</p>
        </div>

        {/* Survey Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Survey</CardTitle>
            <CardDescription>Choose a survey to view detailed analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
              <SelectTrigger className="w-full">
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
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : selectedSurveyId ? (
          <>
            {/* Key Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalResponses}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Positive Sentiment</CardTitle>
                  <TrendingUp className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sentimentCounts.positive}</div>
                  {totalSentiments > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Math.round((sentimentCounts.positive / totalSentiments) * 100)}%
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Neutral Sentiment</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sentimentCounts.neutral}</div>
                  {totalSentiments > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Math.round((sentimentCounts.neutral / totalSentiments) * 100)}%
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Negative Sentiment</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sentimentCounts.negative}</div>
                  {totalSentiments > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Math.round((sentimentCounts.negative / totalSentiments) * 100)}%
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Question Analysis */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Question-by-Question Analysis</CardTitle>
                <CardDescription>Detailed breakdown of responses for each question</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {questionAnalysis.map((qa) => (
                  <div key={qa.question_id} className="space-y-3 pb-6 border-b last:border-b-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium">{qa.question_text}</h4>
                        <p className="text-sm text-muted-foreground">
                          {qa.response_count} responses
                        </p>
                      </div>
                      {qa.avg_score !== null && (
                        <Badge variant="secondary" className="text-lg">
                          {qa.avg_score.toFixed(1)}/5
                        </Badge>
                      )}
                    </div>

                    {qa.question_type === "rating" && qa.avg_score !== null && (
                      <Progress value={(qa.avg_score / 5) * 100} className="h-2" />
                    )}

                    {qa.question_type === "text" && qa.responses.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">All Responses:</p>
                        <div className="space-y-3">
                          {qa.responses.map((resp, idx) => {
                            const responseKey = `${qa.question_id}-${idx}`;
                            const isExpanded = expandedResponses.has(responseKey);
                            const shouldTruncate = resp.response_value.length > 150;
                            const displayText = shouldTruncate && !isExpanded 
                              ? resp.response_value.slice(0, 150) + "..."
                              : resp.response_value;
                            
                            return (
                              <div key={idx} className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-2">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{resp.employee_name || "Anonymous"}</p>
                                    <p className="text-xs text-muted-foreground">{resp.department || "Unknown Department"}</p>
                                  </div>
                                  {resp.sentiment && (
                                    <Badge className={getSentimentColor(resp.sentiment)}>
                                      {resp.sentiment}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm leading-relaxed">{displayText}</p>
                                {shouldTruncate && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpanded(responseKey)}
                                    className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="h-3 w-3 mr-1" />
                                        Show less
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-3 w-3 mr-1" />
                                        Read more
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Department Breakdown */}
            {departmentStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Department Breakdown</CardTitle>
                  <CardDescription>Average scores by department</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {departmentStats.map((dept) => (
                    <div key={dept.department} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{dept.department}</span>
                        <span className="text-sm text-muted-foreground">
                          {dept.avg_score.toFixed(1)}/5 ({dept.response_count} responses)
                        </span>
                      </div>
                      <Progress value={(dept.avg_score / 5) * 100} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No surveys available. Create a survey to see analytics.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Analytics;
