import { createServerFn } from "@tanstack/react-start";

export const seedDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const accounts = [
    { email: "faculty@teachgen.demo", password: "faculty123", name: "Demo Faculty", role: "faculty" },
    { email: "student@teachgen.demo", password: "student123", name: "Demo Student", role: "student" },
  ] as const;

  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(`listUsers failed: ${listError.message}`);
  const existingEmails = new Set((list?.users ?? []).map((u) => u.email));

  for (const acc of accounts) {
    if (existingEmails.has(acc.email)) continue;
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { name: acc.name, role: acc.role },
    });
    if (error) throw new Error(`createUser failed for ${acc.email}: ${error.message}`);
  }

  return { ok: true, created: accounts.filter((a) => !existingEmails.has(a.email)).map((a) => a.email) };
});
