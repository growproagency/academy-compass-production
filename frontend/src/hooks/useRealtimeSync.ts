import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { QK } from "./useApi";

type Row = Record<string, any>;

export function useRealtimeSync(orgId: number) {
  const qc = useQueryClient();

  useEffect(() => {
    const getRow = (payload: any): Row =>
      payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old;

    const isMyOrg = (payload: any) => {
      const row = getRow(payload);
      // If org can't be determined (e.g. DELETE with missing fields), allow it through
      if (!row || row.organizationId == null) return true;
      return Number(row.organizationId) === orgId;
    };

    const channel = supabase
      .channel(`org-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          console.log("[realtime] tasks event:", payload.eventType, payload);
          if (!isMyOrg(payload)) { console.log("[realtime] tasks: org mismatch, skipping"); return; }
          qc.invalidateQueries({ queryKey: QK.tasks });
          qc.invalidateQueries({ queryKey: QK.dashboardStats });
          qc.invalidateQueries({ queryKey: QK.calendarTasks });
          qc.invalidateQueries({ queryKey: QK.myTasks });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload) => {
          console.log("[realtime] projects event:", payload.eventType, payload);
          if (!isMyOrg(payload)) { console.log("[realtime] projects: org mismatch, skipping"); return; }
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
          // Milestones have no organizationId — just invalidate (safe, low volume)
          qc.invalidateQueries({ queryKey: ["milestones"] });
          qc.invalidateQueries({ queryKey: QK.calendarMilestones });
          // Projects page shows milestone previews inside project cards
          qc.invalidateQueries({ queryKey: QK.projectsWithStats });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        (payload) => {
          console.log("[realtime] announcements event:", payload.eventType, payload);
          if (!isMyOrg(payload)) { console.log("[realtime] announcements: org mismatch, skipping"); return; }
          qc.invalidateQueries({ queryKey: QK.announcements });
        },
      )
      .subscribe((status) => {
        console.log("[realtime] channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);
}
