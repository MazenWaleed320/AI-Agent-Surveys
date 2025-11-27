-- Add RLS policy to allow HR managers to delete surveys
CREATE POLICY "HR managers can delete surveys" 
ON public.surveys 
FOR DELETE 
USING (has_role(auth.uid(), 'hr_manager'::app_role));