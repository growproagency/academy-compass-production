import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, QK } from "@/hooks/useApi";
import type { User } from "@/lib/types";

export function useAuth() {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const meQuery = useMe({ enabled: !!supabaseUser });

  const logout = useCallback(async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || "/api"}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    await supabase.auth.signOut();
    qc.setQueryData(QK.me, null);
    await qc.invalidateQueries({ queryKey: QK.me });
  }, [qc]);

  return useMemo(() => ({
    user: (meQuery.data as User) ?? null,
    loading: authLoading || meQuery.isLoading,
    isAuthenticated: Boolean(meQuery.data),
    logout,
    refresh: () => meQuery.refetch(),
  }), [meQuery.data, meQuery.isLoading, authLoading, logout, meQuery]);
}
