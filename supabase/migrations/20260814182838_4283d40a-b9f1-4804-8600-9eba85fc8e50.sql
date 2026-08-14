CREATE POLICY "syllabi_read_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'syllabi' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "syllabi_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'syllabi' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "syllabi_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'syllabi' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "syllabi_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'syllabi' AND auth.uid()::text = (storage.foldername(name))[1]);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_subject(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_unit(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_topic(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;