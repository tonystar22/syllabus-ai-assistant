import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, FileText, Loader2, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { seedDemoSubject } from "@/lib/teachgen.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/faculty/")({
  head: () => ({
    meta: [
      { title: "Faculty Dashboard — TeachGen AI" },
      { name: "description", content: "Track subjects, generated e-content and published material." },
      { property: "og:title", content: "Faculty Dashboard — TeachGen AI" },
      { property: "og:description", content: "Your syllabus-to-content workspace overview." },
    ],
  }),
  component: FacultyDashboard,
});

function FacultyDashboard() {
  const { user, name } = useAuth();
  const qc = useQueryClient();
  const seed = useServerFn(seedDemoSubject);

  const stats = useQuery({
    queryKey: ["faculty-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: subjects, error } = await supabase
        .from("subjects")
        .select("id, name, code, department, semester, created_at")
        .eq("faculty_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const subjectIds = (subjects ?? []).map((s) => s.id);
      let topicCount = 0;
      let published = 0;
      let drafts = 0;
      if (subjectIds.length) {
        const { data: units } = await supabase.from("units").select("id").in("subject_id", subjectIds);
        const unitIds = (units ?? []).map((u) => u.id);
        if (unitIds.length) {
          const { data: topics } = await supabase.from("topics").select("id, status").in("unit_id", unitIds);
          topicCount = topics?.length ?? 0;
          published = topics?.filter((t) => t.status === "PUBLISHED").length ?? 0;
          drafts = topics?.filter((t) => t.status === "DRAFT" || t.status === "APPROVED").length ?? 0;
        }
      }
      return { subjects: subjects ?? [], topicCount, published, drafts };
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => seed(),
    onSuccess: () => {
      toast.success("Demo subject added.");
      void qc.invalidateQueries({ queryKey: ["faculty-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = [
    { label: "Subjects", value: stats.data?.subjects.length ?? 0, icon: BookOpen },
    { label: "Topics", value: stats.data?.topicCount ?? 0, icon: FileText },
    { label: "In Progress", value: stats.data?.drafts ?? 0, icon: Sparkles },
    { label: "Published", value: stats.data?.published ?? 0, icon: Send },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome${name ? `, ${name.split(" ")[0]}` : ""}`}
        description="Upload a syllabus, generate e-content and publish approved material to students."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Add demo subject
            </Button>
            <Button asChild>
              <Link to="/faculty/subjects">Manage subjects</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="panel p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className="size-4 text-primary" />
            </div>
            <p className="mt-3 text-3xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold">Recent subjects</h2>
      {stats.isLoading ? (
        <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your workspace…
        </div>
      ) : stats.data?.subjects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.data.subjects.slice(0, 6).map((s) => (
            <Link
              key={s.id}
              to="/faculty/subjects/$subjectId"
              params={{ subjectId: s.id }}
              className="panel block p-5 transition-shadow hover:shadow-md"
            >
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">{s.code}</p>
              <p className="mt-2 text-lg font-semibold">{s.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {[s.department, s.semester].filter(Boolean).join(" · ") || "No department set"}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel p-8 text-center">
          <p className="font-medium">No subjects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first subject or load the demo course to explore the workflow.
          </p>
          <Button asChild className="mt-5">
            <Link to="/faculty/subjects">Create a subject</Link>
          </Button>
        </div>
      )}
    </>
  );
}
