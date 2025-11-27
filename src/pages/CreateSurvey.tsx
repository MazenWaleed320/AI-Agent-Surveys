import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { z } from "zod";

const questionSchema = z.object({
  question_text: z.string().trim().min(1, "Question text is required").max(500, "Question too long"),
  question_type: z.enum(["rating", "text"]),
  required: z.boolean(),
});

const surveySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().trim().max(1000, "Description too long").optional(),
});

type Question = {
  id: string;
  question_text: string;
  question_type: "rating" | "text";
  required: boolean;
};

const CreateSurvey = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([
    { id: crypto.randomUUID(), question_text: "", question_type: "rating", required: true }
  ]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: crypto.randomUUID(), question_text: "", question_type: "rating", required: true }
    ]);
  };

  const removeQuestion = (id: string) => {
    if (questions.length === 1) {
      toast({ title: "Error", description: "Survey must have at least one question", variant: "destructive" });
      return;
    }
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      // Validate survey
      const surveyValidation = surveySchema.safeParse({ title, description });
      if (!surveyValidation.success) {
        toast({ 
          title: "Validation Error", 
          description: surveyValidation.error.errors[0].message, 
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      // Validate questions
      for (let i = 0; i < questions.length; i++) {
        const questionValidation = questionSchema.safeParse(questions[i]);
        if (!questionValidation.success) {
          toast({ 
            title: `Question ${i + 1} Error`, 
            description: questionValidation.error.errors[0].message, 
            variant: "destructive" 
          });
          setLoading(false);
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create survey
      const { data: survey, error: surveyError } = await supabase
        .from("surveys")
        .insert({
          title,
          description,
          status: "active",
          created_by: user.id,
        })
        .select()
        .single();

      if (surveyError) throw surveyError;

      // Create questions
      const questionsData = questions.map((q, index) => ({
        survey_id: survey.id,
        question_text: q.question_text,
        question_type: q.question_type,
        required: q.required,
        order_index: index,
      }));

      const { error: questionsError } = await supabase
        .from("survey_questions")
        .insert(questionsData);

      if (questionsError) throw questionsError;

      toast({ title: "Success!", description: "Survey published successfully" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <div className="container py-8">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Create New Survey</CardTitle>
            <CardDescription>Design your employee feedback survey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Survey Details */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Survey Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Q1 Employee Engagement Survey"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the survey purpose..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Questions</h3>
                <Button onClick={addQuestion} size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </div>

              {questions.map((question, index) => (
                <Card key={question.id}>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                          <Label>Question {index + 1} *</Label>
                          <Textarea
                            placeholder="Enter your question..."
                            value={question.question_text}
                            onChange={(e) => updateQuestion(question.id, "question_text", e.target.value)}
                            rows={2}
                            maxLength={500}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Question Type</Label>
                            <Select
                              value={question.question_type}
                              onValueChange={(value) => updateQuestion(question.id, "question_type", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rating">Rating (1-5)</SelectItem>
                                <SelectItem value="text">Text Response</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Required</Label>
                            <Select
                              value={question.required.toString()}
                              onValueChange={(value) => updateQuestion(question.id, "required", value === "true")}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">Yes</SelectItem>
                                <SelectItem value="false">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeQuestion(question.id)}
                        disabled={questions.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handlePublish} disabled={loading} className="flex-1">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Publish Survey
              </Button>
              <Button variant="outline" onClick={() => navigate("/")} disabled={loading}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateSurvey;
