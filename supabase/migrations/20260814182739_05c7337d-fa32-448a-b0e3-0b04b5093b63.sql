CREATE TYPE public.app_role AS ENUM ('faculty','student');
CREATE TYPE public.content_status AS ENUM ('NOT_GENERATED','DRAFT','UNDER_REVIEW','APPROVED','PUBLISHED');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name',''), COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'))
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  department text NOT NULL DEFAULT '',
  semester text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects_select_all_auth" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "subjects_insert_own_faculty" ON public.subjects FOR INSERT TO authenticated WITH CHECK (auth.uid() = faculty_id AND public.has_role(auth.uid(),'faculty'));
CREATE POLICY "subjects_update_own_faculty" ON public.subjects FOR UPDATE TO authenticated USING (auth.uid() = faculty_id) WITH CHECK (auth.uid() = faculty_id);
CREATE POLICY "subjects_delete_own_faculty" ON public.subjects FOR DELETE TO authenticated USING (auth.uid() = faculty_id);

CREATE OR REPLACE FUNCTION public.owns_subject(_subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = _subject_id AND s.faculty_id = auth.uid())
$$;

CREATE TABLE public.syllabi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  file_url text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  extracted_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabi TO authenticated;
GRANT ALL ON public.syllabi TO service_role;
ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "syllabi_faculty_all" ON public.syllabi FOR ALL TO authenticated USING (public.owns_subject(subject_id)) WITH CHECK (public.owns_subject(subject_id));

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  unit_number int NOT NULL DEFAULT 1,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units_select_all_auth" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "units_faculty_write" ON public.units FOR ALL TO authenticated USING (public.owns_subject(subject_id)) WITH CHECK (public.owns_subject(subject_id));

CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  title text NOT NULL,
  subtopics text[] NOT NULL DEFAULT '{}',
  position int NOT NULL DEFAULT 0,
  status public.content_status NOT NULL DEFAULT 'NOT_GENERATED',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_topic(_topic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.topics t
    JOIN public.units u ON u.id = t.unit_id
    JOIN public.subjects s ON s.id = u.subject_id
    WHERE t.id = _topic_id AND s.faculty_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.owns_unit(_unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.units u JOIN public.subjects s ON s.id = u.subject_id
    WHERE u.id = _unit_id AND s.faculty_id = auth.uid()
  )
$$;

CREATE POLICY "topics_select_all_auth" ON public.topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "topics_faculty_write" ON public.topics FOR ALL TO authenticated USING (public.owns_unit(unit_id)) WITH CHECK (public.owns_unit(unit_id));

CREATE TABLE public.content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL UNIQUE REFERENCES public.topics(id) ON DELETE CASCADE,
  lecture_content jsonb,
  ppt_content jsonb,
  status public.content_status NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content TO authenticated;
GRANT ALL ON public.content TO service_role;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_faculty_all" ON public.content FOR ALL TO authenticated USING (public.owns_topic(topic_id)) WITH CHECK (public.owns_topic(topic_id) AND created_by = auth.uid());
CREATE POLICY "content_published_read" ON public.content FOR SELECT TO authenticated USING (status = 'PUBLISHED');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER content_updated_at BEFORE UPDATE ON public.content
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();