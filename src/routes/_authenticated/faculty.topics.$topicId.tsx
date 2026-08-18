import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Check, Download, FileDown, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { LectureView, PptView } from "@/components/LectureView";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { generateLectureContent, generatePptContent } from "@/lib/teachgen.functions";
import { downloadPptx } from "@/lib/ppt";
import type { ContentStatus, LectureContent, PptContent } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/faculty/topics/$topicId")({
  head: () => ({
    meta: [
      { title: "Topic Editor — TeachGen AI" },
      { name: "description", content: "Generate, review and publish lecture content and slide outlines." },
      { property: "og:title", content: "Topic Editor — TeachGen AI" },
      { property: "og:description", content: "Faculty review and approval workflow for generated e-content." },
    ],
  }),
  component: TopicEditor,
});

function TopicEditor() {
  const { topicId } = Route.useParams();
  const qc = useQueryClient();
  const genLecture = useServerFn(generateLectureContent);
  const genPpt = useServerFn(generatePptContent);

  const topic = useQuery({
    queryKey: ["topic", topicId],
    queryFn: async () => {
      const { data, error } = await supabase.from("topics").select("*, unit:unit_id(subject_id, unit_number, title, subjects(name, code))").eq("id", topicId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const content = useQuery({
    queryKey: ["content", topicId],
    queryFn: async () => {
      const { data, error } = await supabase.from("content").select("*").eq("topic_id", topicId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [draft, setDraft] = useState<Partial<LectureContent>>({});
  const [activeTab, setActiveTab] = useState("lecture");

  const status = (topic.data?.status as ContentStatus) ?? "NOT_GENERATED";
  const lecture = draft.title ? (draft as LectureContent) : (content.data?.lecture_content as LectureContent | undefined);
  const ppt = content.data?.ppt_content as PptContent | undefined;

  const save = useMutation({
    mutationFn: async (nextStatus: ContentStatus = "DRAFT") => {
      if (!lecture) throw new Error("Nothing to save.");
      const payload = { topic_id: topicId, lecture_content: lecture, status: nextStatus };
      const { error } = content.data?.id
        ? await supabase.from("content").update(payload).eq("id", content.data.id)
        : await supabase.from("content").insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user!.id });
      if (error) throw error;
      await supabase.from("topics").update({ status: nextStatus }).eq("id", topicId);
      return nextStatus;
    },
    onSuccess: (s) => {
      toast.success(`Saved as ${s}.`);
      void qc.invalidateQueries({ queryKey: ["content", topicId] });
      void qc.invalidateQueries({ queryKey: ["topic", topicId] });
      void qc.invalidateQueries({ queryKey: ["structure"] });
      void qc.invalidateQueries({ queryKey: ["faculty-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateLecture = useMutation({
    mutationFn: () => genLecture({ data: { topicId } }),
    onSuccess: (data) => {
      setDraft(data.lecture_content as LectureContent);
      setActiveTab("lecture");
      toast.success("Lecture content generated.");
      void qc.invalidateQueries({ queryKey: ["content", topicId] });
      void qc.invalidateQueries({ queryKey: ["topic", topicId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generatePpt = useMutation({
    mutationFn: () => genPpt({ data: { topicId } }),
    onSuccess: () => {
      toast.success("Slide outline generated.");
      void qc.invalidateQueries({ queryKey: ["content", topicId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subjectId = topic.data?.unit?.subject_id;

  return (
    <>
      <Link
        to="/faculty/subjects/$subjectId"
        params={{ subjectId }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to subject
      </Link>

      <PageHeader
        title={topic.data?.title ?? "Topic"}
        description={
          topic.data?.unit
            ? `${topic.data.unit.subjects?.code ?? ""} · Unit ${topic.data.unit.unit_number}: ${topic.data.unit.title}`
            : ""
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {lecture && (
              <>
                <Button variant="outline" size="sm" onClick={() => save.mutate("DRAFT")} disabled={save.isPending}>
                  <Save className="size-4" /> Save draft
                </Button>
                <Button variant="outline" size="sm" onClick={() => save.mutate("APPROVED")} disabled={save.isPending}>
                  <Check className="size-4" /> Approve
                </Button>
                <Button size="sm" onClick={() => save.mutate("PUBLISHED")} disabled={save.isPending}>
                  <FileDown className="size-4" /> Publish
                </Button>
              </>
            )}
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="lecture">Lecture content</TabsTrigger>
          <TabsTrigger value="slides">Slide outline</TabsTrigger>
        </TabsList>

        <TabsContent value="lecture" className="space-y-4">
          {!lecture ? (
            <div className="panel p-8 text-center">
              <p className="font-medium">No lecture content yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate structured lecture notes grounded in the syllabus.
              </p>
              <Button className="mt-5" onClick={() => generateLecture.mutate()} disabled={generateLecture.isPending}>
                {generateLecture.isPending && <Loader2 className="size-4 animate-spin" />}
                <Sparkles className="size-4" /> Generate lecture
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="panel p-6">
                <LabelRow label="Title" value={lecture.title} onChange={(v) => setDraft({ ...lecture, title: v })} />
                <TextList label="Learning objectives" items={lecture.learningObjectives} onChange={(v) => setDraft({ ...lecture, learningObjectives: v })} />
                <TextAreaRow label="Introduction" value={lecture.introduction} onChange={(v) => setDraft({ ...lecture, introduction: v })} />
                <TextAreaRow label="Concept explanation" value={lecture.conceptExplanation} onChange={(v) => setDraft({ ...lecture, conceptExplanation: v })} />
                <TextList label="Important points" items={lecture.importantPoints} onChange={(v) => setDraft({ ...lecture, importantPoints: v })} />
                <TextList label="Examples" items={lecture.examples} onChange={(v) => setDraft({ ...lecture, examples: v })} />
                <TextList label="Applications" items={lecture.applications} onChange={(v) => setDraft({ ...lecture, applications: v })} />
                <TextAreaRow label="Summary" value={lecture.summary} onChange={(v) => setDraft({ ...lecture, summary: v })} />
                <TextList label="Important questions" items={lecture.importantQuestions} onChange={(v) => setDraft({ ...lecture, importantQuestions: v })} />
                <TextAreaRow label="Syllabus gaps note" value={lecture.syllabusGaps} onChange={(v) => setDraft({ ...lecture, syllabusGaps: v })} />
              </div>
              <LectureView lecture={lecture} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="slides" className="space-y-4">
          {!ppt ? (
            <div className="panel p-8 text-center">
              <p className="font-medium">No slide outline yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate an 8-slide deck outline from the lecture content or syllabus.
              </p>
              <Button className="mt-5" onClick={() => generatePpt.mutate()} disabled={generatePpt.isPending || !lecture}>
                {generatePpt.isPending && <Loader2 className="size-4 animate-spin" />}
                <Sparkles className="size-4" /> Generate slides
              </Button>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadPptx(
                      `${topic.data?.title ?? "slides"}`,
                      `${topic.data?.unit?.subjects?.code ?? ""} · Unit ${topic.data?.unit?.unit_number ?? ""}`,
                      ppt,
                    )
                  }
                >
                  <Download className="size-4" /> Download .pptx
                </Button>
              </div>
              <PptView ppt={ppt} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function LabelRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold tracking-widest text-primary uppercase">{label}</label>
      <input
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TextAreaRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold tracking-widest text-primary uppercase">{label}</label>
      <Textarea className="min-h-[120px] text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextList({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const text = items.join("\n");
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold tracking-widest text-primary uppercase">{label}</label>
      <Textarea
        className="min-h-[100px] text-sm"
        value={text}
        onChange={(e) => onChange(e.target.value.split("\n").filter(Boolean))}
        placeholder="One item per line"
      />
    </div>
  );
}
