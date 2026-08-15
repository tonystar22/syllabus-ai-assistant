import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { ArrowLeft, FileUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { processSyllabus } from "@/lib/teachgen.functions";
import type { ContentStatus } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/faculty/subjects/$subjectId")({
  head: () => ({
    meta: [
      { title: "Subject Workspace — TeachGen AI" },
      { name: "description", content: "Upload the syllabus PDF and work through extracted units and topics." },
      { property: "og:title", content: "Subject Workspace — TeachGen AI" },
      { property: "og:description", content: "Syllabus upload, unit extraction and topic generation." },
    ],
  }),
  component: SubjectDetail,
});

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function SubjectDetail() {
  const { subjectId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const process = useServerFn(processSyllabus);

  const subject = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").eq("id", subjectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const syllabus = useQuery({
    queryKey: ["syllabus", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("syllabi")
        .select("id, file_name, created_at")
        .eq("subject_id", subjectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const structure = useQuery({
    queryKey: ["structure", subjectId],
    queryFn: async () => {
      const { data: units, error } = await supabase
        .from("units")
        .select("id, unit_number, title")
        .eq("subject_id", subjectId)
        .order("unit_number");
      if (error) throw error;
      const unitIds = (units ?? []).map((u) => u.id);
      const topics = unitIds.length
        ? (
            await supabase
              .from("topics")
              .select("id, unit_id, title, subtopics, position, status")
              .in("unit_id", unitIds)
              .order("position")
          ).data ?? []
        : [];
      return (units ?? []).map((u) => ({ ...u, topics: topics.filter((t) => t.unit_id === u.id) }));
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = `${user!.id}/${subjectId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("syllabi").upload(path, file, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (upErr) throw upErr;
      const base64 = await fileToBase64(file);
      return process({ data: { subjectId, fileName: file.name, filePath: path, fileBase64: base64 } });
    },
    onSuccess: (res) => {
      toast.success(`Syllabus processed — ${res.unitCount} unit(s) extracted.`);
      void qc.invalidateQueries({ queryKey: ["structure", subjectId] });
      void qc.invalidateQueries({ queryKey: ["syllabus", subjectId] });
      void qc.invalidateQueries({ queryKey: ["faculty-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Link
        to="/faculty/subjects"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to subjects
      </Link>

      <PageHeader
        title={subject.data?.name ?? "Subject"}
        description={
          subject.data
            ? `${subject.data.code}${subject.data.department ? ` · ${subject.data.department}` : ""}${
                subject.data.semester ? ` · ${subject.data.semester}` : ""
              }`
            : undefined
        }
      />

      <div className="panel p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Syllabus</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {syllabus.data
                ? `Current file: ${syllabus.data.file_name}`
                : "Upload the official syllabus PDF to extract units and topics."}
            </p>
            {fileName && !upload.isPending && (
              <p className="mt-1 text-xs text-muted-foreground">Selected: {fileName}</p>
            )}
          </div>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                upload.mutate(file);
                e.target.value = "";
              }}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              {upload.isPending ? "Extracting…" : syllabus.data ? "Replace syllabus" : "Upload syllabus PDF"}
            </Button>
          </div>
        </div>
        {upload.isPending && (
          <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            Reading the PDF and identifying units and topics. This can take up to a minute.
          </p>
        )}
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold">Units &amp; Topics</h2>
      {structure.isLoading ? (
        <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading structure…
        </div>
      ) : structure.data?.length ? (
        <div className="space-y-5">
          {structure.data.map((unit) => (
            <div key={unit.id} className="panel overflow-hidden">
              <div className="border-b border-border bg-surface px-5 py-3">
                <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                  Unit {unit.unit_number}
                </p>
                <p className="font-semibold">{unit.title}</p>
              </div>
              <ul className="divide-y divide-border">
                {unit.topics.length === 0 && (
                  <li className="px-5 py-4 text-sm text-muted-foreground">No topics in this unit.</li>
                )}
                {unit.topics.map((topic) => (
                  <li key={topic.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{topic.title}</p>
                      {topic.subtopics?.length > 0 && (
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {topic.subtopics.join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={topic.status as ContentStatus} />
                      <Button asChild size="sm" variant="outline">
                        <Link to="/faculty/topics/$topicId" params={{ topicId: topic.id }}>
                          <Sparkles className="size-4" />
                          {topic.status === "NOT_GENERATED" ? "Generate" : "Open"}
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          No units yet. Upload a syllabus PDF to extract the structure.
        </div>
      )}
    </>
  );
}
