import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/types";

type AuthState = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  name: string;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string | undefined) => {
    if (!userId) {
      setRole(null);
      setName("");
      return;
    }
    const [{ data: roleRow }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
    ]);
    setRole((roleRow?.role as AppRole | undefined) ?? null);
    setName(profile?.name ?? "");
  };

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === "SIGNED_OUT") {
        setRole(null);
        setName("");
        return;
      }
      if (nextSession?.user) {
        setTimeout(() => void loadProfile(nextSession.user.id), 0);
      }
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    role,
    name,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      await loadProfile(data.session?.user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
