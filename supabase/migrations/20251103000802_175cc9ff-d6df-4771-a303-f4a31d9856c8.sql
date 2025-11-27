-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  related_id uuid,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- HR managers can view their notifications
CREATE POLICY "HR managers can view their notifications"
ON public.notifications
FOR SELECT
USING (
  has_role(auth.uid(), 'hr_manager'::app_role) AND 
  recipient_id = auth.uid()
);

-- HR managers can update their notifications (mark as read)
CREATE POLICY "HR managers can update their notifications"
ON public.notifications
FOR UPDATE
USING (
  has_role(auth.uid(), 'hr_manager'::app_role) AND 
  recipient_id = auth.uid()
);

-- Authenticated users can create notifications
CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for better performance
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications(recipient_id, read);