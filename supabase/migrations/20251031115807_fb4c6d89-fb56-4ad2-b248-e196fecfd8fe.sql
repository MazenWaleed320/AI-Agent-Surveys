-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('hr_manager', 'employee');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Assign HR manager role to mazenwaleed@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'hr_manager'::app_role
FROM auth.users
WHERE email = 'mazenwaleed@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Update surveys RLS policies
DROP POLICY IF EXISTS "Anyone can view active surveys" ON public.surveys;
DROP POLICY IF EXISTS "Authenticated users can create surveys" ON public.surveys;
DROP POLICY IF EXISTS "Survey creators can update" ON public.surveys;

CREATE POLICY "Everyone can view active surveys"
ON public.surveys
FOR SELECT
USING (status = 'active'::text);

CREATE POLICY "HR managers can create surveys"
ON public.surveys
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'hr_manager'));

CREATE POLICY "HR managers can update surveys"
ON public.surveys
FOR UPDATE
USING (public.has_role(auth.uid(), 'hr_manager'));

CREATE POLICY "HR managers can view all surveys"
ON public.surveys
FOR SELECT
USING (public.has_role(auth.uid(), 'hr_manager'));

-- Update survey_responses RLS policies
DROP POLICY IF EXISTS "Users can view own responses" ON public.survey_responses;

CREATE POLICY "Users can view own responses"
ON public.survey_responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = survey_responses.employee_id
      AND profiles.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'hr_manager')
);

CREATE POLICY "HR managers can view all responses"
ON public.survey_responses
FOR SELECT
USING (public.has_role(auth.uid(), 'hr_manager'));

-- Update response_flags RLS policies
DROP POLICY IF EXISTS "Authenticated users can view flags" ON public.response_flags;
DROP POLICY IF EXISTS "Authenticated users can update flags" ON public.response_flags;

CREATE POLICY "HR managers can view flags"
ON public.response_flags
FOR SELECT
USING (public.has_role(auth.uid(), 'hr_manager'));

CREATE POLICY "HR managers can update flags"
ON public.response_flags
FOR UPDATE
USING (public.has_role(auth.uid(), 'hr_manager'));