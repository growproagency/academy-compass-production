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
    return old.map((item) => (Number(item.id) === id ? { ...item, ...fields } : item));
  });
}

// Remove an item from a cached list
function removeFromCache(qc: QC, queryKey: readonly unknown[], id: number) {
  qc.setQueriesData<any[]>({ queryKey }, (old) => {
    if (!old || !Array.isArray(old)) return old;
    return old.filter((item) => Number(item.id) !== id);
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
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === "INSERT" && newRow) {
            // Add to projects list
            qc.setQueryData(QK.projects, (old: any) => {
              if (!Array.isArray(old)) return old;
              if (old.some((p: any) => Number(p.id) === Number(newRow.id))) return old;
              return [newRow, ...old];
            });
            // Add to projectsWithStats with empty stats
            qc.setQueryData(QK.projectsWithStats, (old: any) => {
              if (!Array.isArray(old)) return old;
              if (old.some((p: any) => Number(p.id) === Number(newRow.id))) return old;
              return [{ ...newRow, taskTotal: 0, taskDone: 0, milestoneTotal: 0, milestoneDone: 0, milestonePreview: [] }, ...old];
            });
          } else if (eventType === "UPDATE" && newRow) {
            const id = Number(newRow.id);
            patchItemInCache(qc, QK.projects, id, newRow);
            patchItemInCache(qc, QK.projectsWithStats, id, newRow);
          } else if (eventType === "DELETE" && oldRow) {
            const deleteId = Number((oldRow as Row).id);
            removeFromCache(qc, QK.projects, deleteId);
            removeFromCache(qc, QK.projectsWithStats, deleteId);
          }

          // Background refetch for enriched data (owner names, stats)
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
          const { eventType, new: newRow, old: oldRow } = payload;
          const row = getRow(payload);
          const projectId = row?.projectId ? Number(row.projectId) : null;

          if (projectId && eventType === "INSERT" && newRow) {
            qc.setQueryData(QK.milestones(projectId), (old: any) => {
              if (!Array.isArray(old)) return old;
              // Skip if already in cache (real or optimistic with negative ID)
              if (old.some((m: any) => Number(m.id) === Number(newRow.id))) return old;
              // If there's a pending optimistic item (negative ID), don't add — let the API response handle it
              if (old.some((m: any) => m.id < 0)) return old;
              return [...old, newRow];
            });
          } else if (projectId && eventType === "UPDATE" && newRow) {
            patchItemInCache(qc, QK.milestones(projectId), newRow.id, newRow);
          } else if (eventType === "DELETE" && oldRow) {
            const deleteId = Number((oldRow as Row).id);
            if (projectId) {
              removeFromCache(qc, QK.milestones(projectId), deleteId);
            } else {
              // DELETE payload only has id — remove from all milestone caches
              qc.setQueriesData<any[]>({ queryKey: ["milestones"] }, (old) => {
                if (!old || !Array.isArray(old)) return old;
                return old.filter((m) => m.id !== deleteId);
              });
            }
          }

          // Instant: patch milestone previews + counts on project cards
          if (projectId) {
            qc.setQueryData(QK.projectsWithStats, (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.map((p: any) => {
                if (p.id !== projectId) return p;
                const preview = Array.isArray(p.milestonePreview) ? [...p.milestonePreview] : [];

                if (eventType === "INSERT" && newRow) {
                  if (!preview.some((m: any) => Number(m.id) === Number(newRow.id)) && !preview.some((m: any) => m.id < 0)) {
                    preview.push(newRow);
                  }
                  return { ...p, milestonePreview: preview, milestoneTotal: (p.milestoneTotal ?? 0) + 1 };
                } else if (eventType === "UPDATE" && newRow) {
                  const updated = preview.map((m: any) => Number(m.id) === Number(newRow.id) ? { ...m, ...newRow } : m);
                  const prevDone = preview.filter((m: any) => m.completedAt).length;
                  const newDone = updated.filter((m: any) => m.completedAt).length;
                  return { ...p, milestonePreview: updated, milestoneDone: (p.milestoneDone ?? 0) + (newDone - prevDone) };
                } else if (eventType === "DELETE") {
                  const deleteId = oldRow ? Number((oldRow as Row).id) : null;
                  if (deleteId) {
                    const removed = preview.find((m: any) => Number(m.id) === deleteId);
                    const filtered = preview.filter((m: any) => Number(m.id) !== deleteId);
                    return {
                      ...p,
                      milestonePreview: filtered,
                      milestoneTotal: Math.max(0, (p.milestoneTotal ?? 0) - 1),
                      milestoneDone: removed?.completedAt ? Math.max(0, (p.milestoneDone ?? 0) - 1) : p.milestoneDone,
                    };
                  }
                }
                return p;
              });
            });
          }

          // Background refetch for full data
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
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === "INSERT" && newRow) {
            qc.setQueryData(QK.announcements, (old: any) => {
              if (!Array.isArray(old)) return old;
              if (old.some((a: any) => Number(a.id) === Number(newRow.id))) return old;
              if (old.some((a: any) => a.id < 0)) return old;
              return [newRow, ...old];
            });
          } else if (eventType === "UPDATE" && newRow) {
            qc.setQueryData(QK.announcements, (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.map((a: any) => Number(a.id) === Number(newRow.id) ? { ...a, ...newRow } : a);
            });
          } else if (eventType === "DELETE" && oldRow) {
            const deleteId = Number((oldRow as Row).id);
            qc.setQueryData(QK.announcements, (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.filter((a: any) => Number(a.id) !== deleteId);
            });
          }

          // Background refetch for consistency
          debouncedInvalidate(QK.announcements);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_subtasks" },
        (payload) => {
          log("task_subtasks", payload);
          const { eventType, new: newRow, old: oldRow } = payload;
          const row = getRow(payload);
          const taskId = row?.taskId ? Number(row.taskId) : null;

          if (taskId && eventType === "INSERT" && newRow) {
            qc.setQueryData(QK.subtasks(taskId), (old: any) => {
              if (!Array.isArray(old)) return old;
              if (old.some((s: any) => Number(s.id) === Number(newRow.id))) return old;
              if (old.some((s: any) => s.id < 0)) return old;
              return [...old, newRow];
            });
          } else if (taskId && eventType === "UPDATE" && newRow) {
            patchItemInCache(qc, QK.subtasks(taskId), Number(newRow.id), newRow);
          } else if (eventType === "DELETE" && oldRow) {
            const deleteId = Number((oldRow as Row).id);
            // Find the taskId from cache if not in payload
            let resolvedTaskId = taskId;
            if (!resolvedTaskId) {
              // Search all subtask caches to find which task this subtask belonged to
              const allQueries = qc.getQueriesData<any[]>({ queryKey: ["subtasks"] });
              for (const [key, data] of allQueries) {
                if (Array.isArray(data) && data.some((s: any) => Number(s.id) === deleteId)) {
                  // Query key is ["subtasks", taskId]
                  resolvedTaskId = Number((key as any[])[1]);
                  break;
                }
              }
            }
            if (resolvedTaskId) {
              removeFromCache(qc, QK.subtasks(resolvedTaskId), deleteId);
            } else {
              qc.setQueriesData<any[]>({ queryKey: ["subtasks"] }, (old) => {
                if (!old || !Array.isArray(old)) return old;
                return old.filter((s) => Number(s.id) !== deleteId);
              });
            }
            // Use resolvedTaskId for count patch below
            if (!taskId && resolvedTaskId) {
              qc.setQueriesData<any[]>({ queryKey: QK.tasks }, (old) => {
                if (!old || !Array.isArray(old)) return old;
                return old.map((t: any) => {
                  if (Number(t.id) !== resolvedTaskId) return t;
                  return { ...t, subtaskTotal: Math.max(0, (t.subtaskTotal ?? 0) - 1) };
                });
              });
            }
          }

          // Instant: patch subtask counts on task cards
          if (taskId) {
            qc.setQueriesData<any[]>({ queryKey: QK.tasks }, (old) => {
              if (!old || !Array.isArray(old)) return old;
              return old.map((t: any) => {
                if (Number(t.id) !== taskId) return t;
                if (eventType === "INSERT") {
                  return { ...t, subtaskTotal: (t.subtaskTotal ?? 0) + 1 };
                } else if (eventType === "DELETE") {
                  return { ...t, subtaskTotal: Math.max(0, (t.subtaskTotal ?? 0) - 1) };
                } else if (eventType === "UPDATE" && newRow && oldRow) {
                  const wasDone = (oldRow as Row).completed;
                  const isDone = newRow.completed;
                  if (!wasDone && isDone) return { ...t, subtaskDone: (t.subtaskDone ?? 0) + 1 };
                  if (wasDone && !isDone) return { ...t, subtaskDone: Math.max(0, (t.subtaskDone ?? 0) - 1) };
                }
                return t;
              });
            });
          }

          // Background refetch for consistency
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
          const { eventType, old: oldRow } = payload;
          const row = getRow(payload);
          const projectId = row?.projectId ? Number(row.projectId) : null;

          if (eventType === "DELETE" && oldRow) {
            const deleteId = Number((oldRow as Row).id);
            // Remove from all project member caches by member record id
            qc.setQueriesData<any[]>({ queryKey: ["projects"] }, (old) => {
              if (!old || !Array.isArray(old)) return old;
              const filtered = old.filter((m: any) => Number(m.id) !== deleteId);
              return filtered.length !== old.length ? filtered : old;
            });
          }

          // Immediate invalidate — always refetch to get enriched user data
          if (projectId) {
            qc.invalidateQueries({ queryKey: QK.projectMembers(projectId) });
          } else {
            // Don't know which project — invalidate all project member queries
            qc.invalidateQueries({ predicate: (query) => {
              const key = query.queryKey as any[];
              return key[0] === "projects" && key[2] === "members";
            }});
          }
          debouncedInvalidate(QK.projectsWithStats);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_comments" },
        (payload) => {
          log("project_comments", payload);
          const { eventType, old: oldRow } = payload;
          const row = getRow(payload);
          const projectId = row?.projectId ? Number(row.projectId) : null;

          if (eventType === "DELETE" && oldRow) {
            const deleteId = Number((oldRow as Row).id);
            if (projectId) {
              removeFromCache(qc, QK.projectComments(projectId), deleteId);
            } else {
              qc.setQueriesData<any[]>({ queryKey: ["projectComments"] }, (old) => {
                if (!old || !Array.isArray(old)) return old;
                return old.filter((c) => Number(c.id) !== deleteId);
              });
            }
          }

          // Background refetch for full data (author names, etc.)
          if (projectId) debouncedInvalidate(QK.projectComments(projectId));
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
