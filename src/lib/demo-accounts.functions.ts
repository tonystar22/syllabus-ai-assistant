import { createServerFn } from "@tanstack/react-start";

export const seedDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const accounts = [
    { email: "faculty@teachgen.demo", password: "faculty123", name: "Demo Faculty", role: "faculty" },
    { email: "student@teachgen.demo", password: "student123", name: "Demo Student", role: "student" },
  ] as const;

  for (const acc of accounts) {
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      email: acc.email,
    });
    if (existing?.users?.length) continue;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { name: acc.name, role: acc.role },
    });
    if (error) throw error;
  }

  return { ok: true };
});
