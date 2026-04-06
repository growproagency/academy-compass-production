import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { QK } from "./useApi";

type Row = Record<string, any>;
type QC = ReturnType<typeof useQueryClient>;

// Patch a single item in a cached list by merging changed fields
function patchItemInCache(qc: QC, queryKey: readonly unknown[], id: number, fields: Row) {
  qc.setQueriesData<any[]>({ queryKey }, (old) => {
    if (!old || !Array.isArray(old)) return old;
    return old.map((item) => (item.id === id ? { ...item, ...fields } : item));
  });
}

// Remove an item from a cached list
function removeFromCache(qc: QC, queryKey: readonly unknown[], id: number) {
  qc.setQueriesData<any[]>({ queryKey }, (old) => {
    if (!old || !Array.isArray(old)) return old;
    return old.filter((item) => item.id !== id);
  });
}

// Debounced invalidation — batches rapid events into a single refetch
function createDebouncedInvalidator(qc: QC, delay = 150) {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  return (queryKey: readonly unknown[]) => {
    const key = JSON.stringify(queryKey);
    const existing = pending.get(key);
    if (existing) clearTimeout(existing);
    pending.set(key, setTimeout(() => {
      pending.delete(key);
      qc.invalidateQueries({ queryKey });
    }, delay));
  };
}

export function useRealtimeSync(orgId: number) {
  const qc = useQueryClient();
  const invalidateRef = useRef<ReturnType<typeof createDebouncedInvalidator>>(null);
  if (!invalidateRef.current) invalidateRef.current = createDebouncedInvalidator(qc);
  const debouncedInvalidate = invalidateRef.current;

  useEffect(() => {
    const getRow = (payload: any): Row =>
      payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old;

    const isMyOrg = (payload: any) => {
      const row = getRow(payload);
      if (!row || row.organizationId == null) return true;
      return Number(row.organizationId) === orgId;
    };

    const log = (table: string, payload: any) =>
      console.log(`[realtime] ${table}:${payload.eventType}`, payload);

    const channel = supabase
      .channel(`org-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          log("tasks", payload);
          if (!isMyOrg(payload)) return;
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === "UPDATE" && newRow) {
            // Instant: patch changed fields directly in the cache
            patchItemInCache(qc, QK.tasks, newRow.id, newRow);
          } else if (eventType === "DELETE" && oldRow) {
            // Instant: remove from cache
            removeFromCache(qc, QK.tasks, (oldRow as Row).id);
          }

          // Background refetch for enriched data (subtask counts, etc.)
          debouncedInvalidate(QK.tasks);
          debouncedInvalidate(QK.dashboardStats);
          debouncedInvalidate(QK.calendarTasks);
          debouncedInvalidate(QK.myTasks);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload) => {
          log("projects", payload);
          if (!isMyOrg(payload)) return;

          debouncedInvalidate(QK.projects);
          debouncedInvalidate(QK.projectsWithStats);
          debouncedInvalidate(QK.healthTrend);
          debouncedInvalidate(QK.dashboardStats);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "milestones" },
        (payload) => {
          log("milestones", payload);
          debouncedInvalidate(["milestones"]);
          debouncedInvalidate(QK.calendarMilestones);
          debouncedInvalidate(QK.projectsWithStats);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        (payload) => {
          log("announcements", payload);
          if (!isMyOrg(payload)) return;

          debouncedInvalidate(QK.announcements);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_subtasks" },
        (payload) => {
          log("task_subtasks", payload);
          // Subtasks belong to a task — invalidate that task's subtasks and the task list (subtask counts)
          const row = getRow(payload);
          if (row?.taskId) debouncedInvalidate(QK.subtasks(row.taskId));
          debouncedInvalidate(QK.tasks);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments" },
        (payload) => {
          log("task_comments", payload);
          // Comments belong to a task — invalidate that task's comments
          const row = getRow(payload);
          if (row?.taskId) debouncedInvalidate(QK.comments(row.taskId));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_members" },
        (payload) => {
          log("project_members", payload);
          // Members belong to a project — invalidate that project's members and project lists
          const row = getRow(payload);
          if (row?.projectId) debouncedInvalidate(QK.projectMembers(row.projectId));
          debouncedInvalidate(QK.projectsWithStats);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_comments" },
        (payload) => {
          log("project_comments", payload);
          // Project comments belong to a project — invalidate that project's comments
          const row = getRow(payload);
          if (row?.projectId) debouncedInvalidate(QK.projectComments(row.projectId));
        },
      )
      .subscribe((status) => {
        console.log("[realtime] channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc, debouncedInvalidate]);
}
