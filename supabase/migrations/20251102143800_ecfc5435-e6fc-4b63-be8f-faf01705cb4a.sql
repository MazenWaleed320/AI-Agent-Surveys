-- Allow employees to view their own flagged responses
create policy "Users can view own flags"
on public.response_flags
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = response_flags.employee_id
      and p.user_id = auth.uid()
  )
);