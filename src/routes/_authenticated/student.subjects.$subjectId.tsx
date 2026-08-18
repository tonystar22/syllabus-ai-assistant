import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { LectureView, PptView } from "@/components/LectureView";
import { supabase } from "@/integrations/supabase/client";
import type { ContentRow } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/student/subjects/$subjectId")({
  head: () => ({
    meta: [
      { title: "Course Content — TeachGen AI" },
      { name: "description", content: "View published lecture notes and slide outlines for this subject." },
      { property: "og:title", content: "Course Content — TeachGen AI" },
      { property: "og:description", content: "Published student material." },
    ],
  }),
  component: StudentSubject,
});

function StudentSubject() {
  const { subjectId } = Route.useParams();

  const subject = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").eq("id", subjectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const published = useQuery({
    queryKey: ["student-content", subjectId],
    queryFn: async () => {
      const { data: units, error } = await supabase.from("units").select("id, unit_number, title").eq("subject_id", subjectId).order("unit_number");
      if (error) throw error;
      const unitIds = (units ?? []).map((u) => u.id);
      const topics = unitIds.length
        ? (
            await supabase
              .from("topics")
              .select("id, unit_id, title, position, status")
              .in("unit_id", unitIds)
              .eq("status", "PUBLISHED")
              .order("position")
          ).data ?? []
        : [];
      const topicIds = topics.map((t) => t.id);
      const content = topicIds.length
        ? (await supabase.from("content").select("*").in("topic_id", topicIds).eq("status", "PUBLISHED")).data ?? []
        : [];
      return (units ?? []).map((u) => ({
        ...u,
        topics: topics
          .filter((t) => t.unit_id === u.id)
          .map((t) => ({ ...t, content: content.find((c) => c.topic_id === t.id) as ContentRow | undefined })),
      }));
    },
  });

  return (
    <>
      <Link
        to="/student"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to portal
      </Link>

      <PageHeader
        title={subject.data?.name ?? "Subject"}
        description={subject.data ? `${subject.data.code}${subject.data.semester ? ` · ${subject.data.semester}` : ""}` : ""}
      />

      {published.isLoading ? (
        <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading content…
        </div>
      ) : (
        <div className="space-y-8">
          {published.data?.map((unit) => (
            <div key={unit.id} className="panel overflow-hidden">
              <div className="border-b border-border bg-surface px-5 py-3">
                <p className="text-xs font-semibold tracking-widest text-primary uppercase">Unit {unit.unit_number}</p>
                <p className="font-semibold">{unit.title}</p>
              </div>
              <div className="divide-y divide-border">
                {unit.topics.length === 0 && (
                  <p className="px-5 py-4 text-sm text-muted-foreground">No published topics in this unit.</p>
                )}
                {unit.topics.map((topic) => (
                  <div key={topic.id} className="px-5 py-6">
                    <h3 className="text-lg font-semibold">{topic.title}</h3>
                    {topic.content?.lecture_content && (
                      <div className="mt-4">
                        <LectureView lecture={topic.content.lecture_content as never} />
                      </div>
                    )}
                    {topic.content?.ppt_content && (
                      <div className="mt-6">
                        <p className="mb-3 text-sm font-semibold tracking-widest text-primary uppercase">
                          Slide outline
                        </p>
                        <PptView ppt={topic.content.ppt_content as never} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
