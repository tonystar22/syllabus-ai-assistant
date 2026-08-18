CREATE OR REPLACE FUNCTION public.published_subjects()
RETURNS TABLE (
  id uuid,
  name text,
  code text,
  department text,
  semester text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT s.id, s.name, s.code, s.department, s.semester
  FROM public.subjects s
  JOIN public.units u ON u.subject_id = s.id
  JOIN public.topics t ON t.unit_id = u.id
  WHERE t.status = 'PUBLISHED'::public.content_status;
$$;

GRANT EXECUTE ON FUNCTION public.published_subjects() TO authenticated;
GRANT EXECUTE ON FUNCTION public.published_subjects() TO anon;
