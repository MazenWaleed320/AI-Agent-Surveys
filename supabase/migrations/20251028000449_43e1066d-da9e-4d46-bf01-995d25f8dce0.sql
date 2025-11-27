-- Create employees/profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  manager_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create surveys table
CREATE TABLE public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  survey_type TEXT NOT NULL DEFAULT 'quarterly', -- quarterly, pulse, custom
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, closed
  created_by UUID REFERENCES auth.users(id),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create survey questions table
CREATE TABLE public.survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'rating', -- rating, text, multiple_choice
  required BOOLEAN DEFAULT true,
  order_index INTEGER NOT NULL,
  options JSONB, -- for multiple choice questions
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create survey responses table
CREATE TABLE public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  response_value TEXT NOT NULL,
  response_score INTEGER, -- 1-5 for rating questions
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create sentiment analysis table
CREATE TABLE public.sentiment_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  sentiment TEXT NOT NULL, -- positive, negative, neutral
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  key_themes TEXT[],
  ai_summary TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT now()
);

-- Create flags table for HR attention
CREATE TABLE public.response_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE,
  severity TEXT NOT NULL, -- critical, warning, info
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, reviewed, resolved
  flagged_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for surveys (HR can manage, all can view active)
CREATE POLICY "Anyone can view active surveys" ON public.surveys FOR SELECT USING (status = 'active' OR auth.uid() = created_by);
CREATE POLICY "Authenticated users can create surveys" ON public.surveys FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Survey creators can update" ON public.surveys FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for survey questions
CREATE POLICY "Anyone can view questions for active surveys" ON public.survey_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.surveys WHERE id = survey_id AND (status = 'active' OR created_by = auth.uid()))
);
CREATE POLICY "Authenticated users can create questions" ON public.survey_questions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.surveys WHERE id = survey_id AND created_by = auth.uid())
);

-- RLS Policies for survey responses
CREATE POLICY "Users can view own responses" ON public.survey_responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = employee_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own responses" ON public.survey_responses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = employee_id AND user_id = auth.uid())
);

-- RLS Policies for sentiment analysis (read-only for users)
CREATE POLICY "Users can view sentiment analysis" ON public.sentiment_analysis FOR SELECT USING (true);

-- RLS Policies for flags (HR/admin access)
CREATE POLICY "Authenticated users can view flags" ON public.response_flags FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create flags" ON public.response_flags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update flags" ON public.response_flags FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_department ON public.profiles(department);
CREATE INDEX idx_surveys_status ON public.surveys(status);
CREATE INDEX idx_survey_questions_survey_id ON public.survey_questions(survey_id);
CREATE INDEX idx_survey_responses_survey_id ON public.survey_responses(survey_id);
CREATE INDEX idx_survey_responses_employee_id ON public.survey_responses(employee_id);
CREATE INDEX idx_sentiment_analysis_response_id ON public.sentiment_analysis(response_id);
CREATE INDEX idx_response_flags_employee_id ON public.response_flags(employee_id);
CREATE INDEX idx_response_flags_status ON public.response_flags(status);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_surveys_updated_at
BEFORE UPDATE ON public.surveys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();