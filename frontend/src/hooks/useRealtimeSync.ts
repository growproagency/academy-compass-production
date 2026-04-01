import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { QK } from "./useApi";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Row = Record<string, any>;

function updateListCache(
  qc: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  payload: RealtimePostgresChangesPayload<Row>,
) {
  const { eventType, new: newRow, old: oldRow } = payload;

  qc.setQueriesData<any[]>({ queryKey }, (old) => {
    if (!old || !Array.isArray(old)) return old;

    if (eventType === "INSERT") {
      // Avoid duplicates (optimistic update may have already added it)
      if (old.some((item) => item.id === newRow.id)) return old;
      return [newRow, ...old];
    }

    if (eventType === "UPDATE") {
      return old.map((item) => (item.id === newRow.id ? { ...item, ...newRow } : item));
    }

    if (eventType === "DELETE") {
      return old.filter((item) => item.id !== oldRow.id);
    }

    return old;
  });
}

export function useRealtimeSync(orgId: number) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`org-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `organizationId=eq.${orgId}` },
        (payload) => {
          // Direct cache update for the task list
          updateListCache(qc, QK.tasks, payload);

          // These need refetch since they're computed/enriched server-side
          qc.invalidateQueries({ queryKey: QK.dashboardStats });
          qc.invalidateQueries({ queryKey: QK.calendarTasks });
          qc.invalidateQueries({ queryKey: QK.myTasks });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: `organizationId=eq.${orgId}` },
        () => {
          // Projects are heavily enriched (owner, task counts, milestones) — invalidate
          qc.invalidateQueries({ queryKey: QK.projects });
          qc.invalidateQueries({ queryKey: QK.projectsWithStats });
          qc.invalidateQueries({ queryKey: QK.healthTrend });
          qc.invalidateQueries({ queryKey: QK.dashboardStats });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "milestones" },
        () => {
          qc.invalidateQueries({ queryKey: ["milestones"] });
          qc.invalidateQueries({ queryKey: QK.calendarMilestones });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements", filter: `organizationId=eq.${orgId}` },
        (payload) => {
          // Direct cache update — announcements are simple, no enrichment
          updateListCache(qc, QK.announcements, payload);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);
}
