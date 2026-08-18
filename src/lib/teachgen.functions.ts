import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LectureContent, PptContent } from "@/lib/types";

export const processSyllabus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { subjectId: string; fileName: string; filePath: string; fileBase64: string }) => d)
  .handler(async ({ data, context }) => {
    const { extractPdfText } = await import("@/lib/syllabus.server");
    const { callStructuredAI, syllabusSchema } = await import("@/lib/ai.server");
    const supabase = context.supabase;

    const { data: subject, error: subjErr } = await supabase
      .from("subjects")
      .select("*")
      .eq("id", data.subjectId)
      .maybeSingle();
    if (subjErr) throw new Error(subjErr.message);
    if (!subject || subject.faculty_id !== context.userId) throw new Error("Subject not found.");

    const text = await extractPdfText(data.fileBase64);
    if (text.length < 40) {
      throw new Error(
        "No readable text was found in this PDF. It may be a scanned image; please upload a text-based syllabus PDF.",
      );
    }

    const structure = await callStructuredAI<{
      subject: string;
      code: string;
      units: { unitNumber: number; title: string; topics: { title: string; subtopics: string[] }[] }[];
    }>(
      [
        {
          role: "system",
          content:
            "You extract the unit and topic structure from an official university syllabus. Only return units and topics that literally appear in the document. Never invent units or topics. If the document has no explicit units, group topics into a single Unit 1 using the document's own wording.",
        },
        {
          role: "user",
          content: `Subject on record: ${subject.name} (${subject.code}).\n\nOFFICIAL SYLLABUS TEXT:\n"""\n${text.slice(0, 40000)}\n"""`,
        },
      ],
      "extract_syllabus_structure",
      syllabusSchema as unknown as Record<string, unknown>,
    );

    await supabase.from("units").delete().eq("subject_id", data.subjectId);
    await supabase.from("syllabi").delete().eq("subject_id", data.subjectId);

    const { error: sylErr } = await supabase.from("syllabi").insert({
      subject_id: data.subjectId,
      file_url: data.filePath,
      file_name: data.fileName,
      extracted_text: text.slice(0, 200000),
    });
    if (sylErr) throw new Error(sylErr.message);

    for (const unit of structure.units) {
      const { data: unitRow, error: unitErr } = await supabase
        .from("units")
        .insert({
          subject_id: data.subjectId,
          unit_number: unit.unitNumber || 1,
          title: unit.title,
        })
        .select("id")
        .single();
      if (unitErr) throw new Error(unitErr.message);
      const topics = unit.topics.map((t, i) => ({
        unit_id: unitRow.id,
        title: t.title,
        subtopics: t.subtopics ?? [],
        position: i,
      }));
      if (topics.length) {
        const { error: topErr } = await supabase.from("topics").insert(topics);
        if (topErr) throw new Error(topErr.message);
      }
    }

    return { unitCount: structure.units.length, textPreview: text.slice(0, 6000) };
  });

export const generateLectureContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { topicId: string }) => d)
  .handler(async ({ data, context }) => {
    const { callStructuredAI, lectureSchema, GROUNDING_RULES } = await import("@/lib/ai.server");
    const { loadTopicContext, saveGenerated } = await import("@/lib/generation.server");
    const ctx = await loadTopicContext(context.supabase, data.topicId, context.userId);

    const lecture = await callStructuredAI<LectureContent>(
      [
        { role: "system", content: GROUNDING_RULES },
        {
          role: "user",
          content: `Subject: ${ctx.subject.name} (${ctx.subject.code})
Unit ${ctx.unit.unit_number}: ${ctx.unit.title}
Topic: ${ctx.topic.title}
Subtopics from syllabus: ${ctx.topic.subtopics.join(", ") || "none listed"}

OFFICIAL SYLLABUS CONTEXT:
"""
${ctx.syllabusText.slice(0, 20000) || "No syllabus text was extracted for this subject."}
"""

Write structured lecture content for this topic only.`,
        },
      ],
      "lecture_content",
      lectureSchema as unknown as Record<string, unknown>,
    );

    return saveGenerated(context.supabase, data.topicId, context.userId, { lecture_content: lecture });
  });

export const generatePptContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { topicId: string }) => d)
  .handler(async ({ data, context }) => {
    const { callStructuredAI, pptSchema, GROUNDING_RULES } = await import("@/lib/ai.server");
    const { loadTopicContext, saveGenerated } = await import("@/lib/generation.server");
    const ctx = await loadTopicContext(context.supabase, data.topicId, context.userId);

    const ppt = await callStructuredAI<PptContent>(
      [
        { role: "system", content: GROUNDING_RULES },
        {
          role: "user",
          content: `Subject: ${ctx.subject.name}
Unit ${ctx.unit.unit_number}: ${ctx.unit.title}
Topic: ${ctx.topic.title}

${
  ctx.lecture
    ? `APPROVED LECTURE DRAFT TO CONVERT INTO SLIDES:\n"""\n${JSON.stringify(ctx.lecture).slice(0, 16000)}\n"""`
    : `OFFICIAL SYLLABUS CONTEXT:\n"""\n${ctx.syllabusText.slice(0, 12000)}\n"""`
}

Produce an 8-slide teaching deck outline: Topic Title, Learning Objectives, Introduction, Core Concept, Example, Applications, Summary, Important Questions. Each slide needs a title, 3-6 concise bullet points, and speaker notes.`,
        },
      ],
      "ppt_outline",
      pptSchema as unknown as Record<string, unknown>,
    );

    return saveGenerated(context.supabase, data.topicId, context.userId, { ppt_content: ppt });
  });

export const seedDemoSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createDemoSubject } = await import("@/lib/demo.server");
    return createDemoSubject(context.supabase, context.userId);
  });
