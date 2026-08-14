import type { SupabaseClient } from "@supabase/supabase-js";
import type { LectureContent, PptContent } from "@/lib/types";

type AnyClient = SupabaseClient<any, any, any>;

export async function loadTopicContext(supabase: AnyClient, topicId: string, userId: string) {
  const { data: topic, error } = await supabase
    .from("topics")
    .select("id, title, subtopics, unit_id")
    .eq("id", topicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!topic) throw new Error("Topic not found.");

  const { data: unit } = await supabase
    .from("units")
    .select("id, title, unit_number, subject_id")
    .eq("id", topic.unit_id)
    .maybeSingle();
  if (!unit) throw new Error("Unit not found.");

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, code, faculty_id")
    .eq("id", unit.subject_id)
    .maybeSingle();
  if (!subject || subject.faculty_id !== userId) {
    throw new Error("You do not have access to this topic.");
  }

  const { data: syllabus } = await supabase
    .from("syllabi")
    .select("extracted_text")
    .eq("subject_id", subject.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: existing } = await supabase
    .from("content")
    .select("lecture_content")
    .eq("topic_id", topicId)
    .maybeSingle();

  return {
    topic: topic as { id: string; title: string; subtopics: string[]; unit_id: string },
    unit: unit as { id: string; title: string; unit_number: number; subject_id: string },
    subject: subject as { id: string; name: string; code: string; faculty_id: string },
    syllabusText: (syllabus?.extracted_text as string | undefined) ?? "",
    lecture: (existing?.lecture_content as LectureContent | null) ?? null,
  };
}

export async function saveGenerated(
  supabase: AnyClient,
  topicId: string,
  userId: string,
  patch: { lecture_content?: LectureContent; ppt_content?: PptContent },
) {
  const { data: existing } = await supabase
    .from("content")
    .select("id, status")
    .eq("topic_id", topicId)
    .maybeSingle();

  if (existing) {
    const nextStatus = existing.status === "PUBLISHED" || existing.status === "APPROVED" ? "DRAFT" : existing.status;
    const { error } = await supabase
      .from("content")
      .update({ ...patch, status: nextStatus })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("content")
      .insert({ topic_id: topicId, created_by: userId, status: "DRAFT", ...patch });
    if (error) throw new Error(error.message);
  }

  await supabase.from("topics").update({ status: "DRAFT" }).eq("id", topicId);

  const { data: row } = await supabase.from("content").select("*").eq("topic_id", topicId).maybeSingle();
  return row;
}
