// React Query hooks that replace tRPC hooks
// Usage: import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi"
// then call the pre-built hooks like useTasks(), useCreateTask(), etc.

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { api } from "@/lib/api";

// Re-export for convenience
export { useQueryClient };

// ── Query keys ──────────────────────────────────────────────────────────────
export const QK = {
  me: ["auth", "me"] as const,
  users: ["users"] as const,
  user: (id: number) => ["users", id] as const,
  userScorecard: (id: number) => ["users", id, "scorecard"] as const,
  projects: ["projects"] as const,
  projectsWithStats: ["projects", "stats"] as const,
  healthTrend: ["projects", "healthTrend"] as const,
  project: (id: number) => ["projects", id] as const,
  projectMembers: (id: number) => ["projects", id, "members"] as const,
  tasks: ["tasks"] as const,
  task: (id: number) => ["tasks", id] as const,
  tasksByProject: (pid: number) => ["tasks", "project", pid] as const,
  calendarTasks: ["tasks", "calendar"] as const,
  archivedTasks: ["tasks", "archived"] as const,
  subtasks: (taskId: number) => ["subtasks", taskId] as const,
  comments: (taskId: number) => ["comments", taskId] as const,
  dashboardStats: ["dashboard", "stats"] as const,
  milestones: (pid: number) => ["milestones", pid] as const,
  calendarMilestones: ["milestones", "calendar"] as const,
  strategicOrganizer: ["strategicOrganizer"] as const,
  strategicOrganizerVersions: ["strategicOrganizer", "versions"] as const,
  announcements: ["announcements"] as const,
  projectComments: (pid: number) => ["projectComments", pid] as const,
  overdueCount: ["notifications", "overdueCount"] as const,
  schedule: ["notifications", "schedule"] as const,
  weeklySchedule: ["notifications", "weeklySchedule"] as const,
  reminderWindow: ["notifications", "reminderWindow"] as const,
  dueSoonCount: ["notifications", "dueSoonCount"] as const,
  previewDigest: ["notifications", "previewDigest"] as const,
  myTasks: ["users", "me", "tasks"] as const,
  invites: ["invites"] as const,
  inviteLinks: ["invites", "links"] as const,
};

// ── Auth ──────────────────────────────────────────────────────────────────────
export function useMe(options?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: QK.me,
    queryFn: () => api.auth.me(),
    retry: false,
    ...options,
  } as UseQueryOptions);
}

// ── Users ─────────────────────────────────────────────────────────────────────
export function useUsers() {
  return useQuery({ queryKey: QK.users, queryFn: () => api.users.list() });
}

export function useUser(id: number) {
  return useQuery({ queryKey: QK.user(id), queryFn: () => api.users.getById(id), enabled: !!id });
}

export function useUserScorecard(userId: number) {
  return useQuery({ queryKey: QK.userScorecard(userId), queryFn: () => api.users.scorecard(userId), enabled: !!userId });
}

export function useMyTasks() {
  return useQuery({ queryKey: QK.myTasks, queryFn: () => api.users.myTasks() });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.users.updateMe(name),
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: QK.me });
      const previous = qc.getQueryData(QK.me);
      qc.setQueryData(QK.me, (old: any) => old ? { ...old, name } : old);
      return { previous };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.me, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QK.me });
      qc.invalidateQueries({ queryKey: QK.users });
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: "user" | "admin" }) =>
      api.users.updateRole(id, role),
    onMutate: async ({ id, role }) => {
      await qc.cancelQueries({ queryKey: QK.users });
      const previous = qc.getQueryData(QK.users);
      qc.setQueryData(QK.users, (old: any[]) =>
        (old ?? []).map((u) => u.id === id ? { ...u, role } : u)
      );
      return { previous };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.users, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QK.users }),
  });
}

// ── Projects ──────────────────────────────────────────────────────────────────
export function useProjects() {
  return useQuery({ queryKey: QK.projects, queryFn: () => api.projects.list() });
}

export function useProjectsWithStats() {
  return useQuery({ queryKey: QK.projectsWithStats, queryFn: () => api.projects.listWithStats() });
}

export function useHealthTrend() {
  return useQuery({ queryKey: QK.healthTrend, queryFn: () => api.projects.healthTrend() });
}

export function useProject(id: number) {
  return useQuery({ queryKey: QK.project(id), queryFn: () => api.projects.getById(id), enabled: !!id });
}

export function useProjectMembers(projectId: number) {
  return useQuery({ queryKey: QK.projectMembers(projectId), queryFn: () => api.projects.members.list(projectId), enabled: !!projectId });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.projects.create(data),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (newProject: any) => {
      // Immediately add the new project to both caches so the UI updates without waiting for a refetch
      qc.setQueryData(QK.projects, (old: unknown) =>
        Array.isArray(old) ? [...old, newProject] : old
      );
      qc.setQueryData(QK.projectsWithStats, (old: unknown) =>
        Array.isArray(old)
          ? [...old, { ...newProject, taskTotal: 0, taskDone: 0, milestoneTotal: 0, milestoneDone: 0, milestonePreview: [] }]
          : old
      );
      // Background refetch for eventual consistency
      qc.invalidateQueries({ queryKey: QK.projects });
      qc.invalidateQueries({ queryKey: QK.projectsWithStats });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; [k: string]: unknown }) => api.projects.update(id, data),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: QK.projects });
      await qc.cancelQueries({ queryKey: QK.projectsWithStats });
      await qc.cancelQueries({ queryKey: QK.project(v.id) });
      const prevProjects = qc.getQueryData(QK.projects);
      const prevStats = qc.getQueryData(QK.projectsWithStats);
      const prevProject = qc.getQueryData(QK.project(v.id));
      const patch = (old: unknown) =>
        Array.isArray(old)
          ? old.map((p: Record<string, unknown>) => (p.id === v.id ? { ...p, ...v } : p))
          : old;
      qc.setQueryData(QK.projects, patch);
      qc.setQueryData(QK.projectsWithStats, patch);
      qc.setQueryData(QK.project(v.id), (old: unknown) =>
        old && typeof old === "object" ? { ...(old as object), ...v } : old
      );
      return { prevProjects, prevStats, prevProject };
    },
    onError: (_e, v, ctx: any) => {
      if (ctx?.prevProjects) qc.setQueryData(QK.projects, ctx.prevProjects);
      if (ctx?.prevStats) qc.setQueryData(QK.projectsWithStats, ctx.prevStats);
      if (ctx?.prevProject) qc.setQueryData(QK.project(v.id), ctx.prevProject);
    },
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: QK.project(v.id) });
      qc.invalidateQueries({ queryKey: QK.projects });
      qc.invalidateQueries({ queryKey: QK.projectsWithStats });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.projects.delete(id),
    onSuccess: (_d, id) => {
      // Immediately remove the deleted project from both caches
      const filter = (old: unknown) =>
        Array.isArray(old) ? old.filter((p: Record<string, unknown>) => p.id !== id) : old;
      qc.setQueryData(QK.projects, filter);
      qc.setQueryData(QK.projectsWithStats, filter);
      // Background refetch for eventual consistency
      qc.invalidateQueries({ queryKey: QK.projects });
      qc.invalidateQueries({ queryKey: QK.projectsWithStats });
    },
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: number; userId: number }) =>
      api.projects.members.add(projectId, userId),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: QK.projectMembers(v.projectId) }),
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: number; userId: number }) =>
      api.projects.members.remove(projectId, userId),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: QK.projectMembers(v.projectId) }),
  });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export function useTasks() {
  return useQuery({ queryKey: QK.tasks, queryFn: () => api.tasks.listAll() });
}

export function useTasksByProject(projectId: number) {
  return useQuery({ queryKey: QK.tasksByProject(projectId), queryFn: () => api.tasks.listByProject(projectId), enabled: !!projectId });
}

export function useCalendarTasks() {
  return useQuery({ queryKey: QK.calendarTasks, queryFn: () => api.tasks.listForCalendar() });
}

export function useArchivedTasks() {
  return useQuery({ queryKey: QK.archivedTasks, queryFn: () => api.tasks.listArchived() });
}

export function useTask(id: number) {
  return useQuery({ queryKey: QK.task(id), queryFn: () => api.tasks.getById(id), enabled: !!id });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.tasks.create(data),
    onSuccess: (newTask: any) => {
      // Immediately insert the new task into the cache so the UI updates without a refetch
      qc.setQueryData(QK.tasks, (old: any) =>
        Array.isArray(old)
          ? [...old, { ...newTask, subtaskTotal: 0, subtaskDone: 0 }]
          : old
      );
      if (newTask?.projectId) {
        qc.setQueryData(QK.tasksByProject(newTask.projectId), (old: any) =>
          Array.isArray(old) ? [...old, newTask] : old
        );
      }
      // Background refetch for eventual consistency
      qc.invalidateQueries({ queryKey: QK.tasks });
      qc.invalidateQueries({ queryKey: QK.dashboardStats });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; [k: string]: unknown }) => api.tasks.update(id, data),
    onMutate: async ({ id, ...updates }) => {
      await qc.cancelQueries({ queryKey: QK.tasks });
      await qc.cancelQueries({ queryKey: QK.myTasks });
      const prev = qc.getQueryData(QK.tasks);
      const prevMy = qc.getQueryData(QK.myTasks);
      const patch = (old: any) =>
        Array.isArray(old) ? old.map((t) => (t.id === id ? { ...t, ...updates } : t)) : old;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      qc.setQueryData(QK.tasks, patch as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      qc.setQueryData(QK.myTasks, patch as any);
      return { prev, prevMy };
    },
    onError: (_e, _v, ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (ctx?.prev) qc.setQueryData(QK.tasks, ctx.prev as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (ctx?.prevMy) qc.setQueryData(QK.myTasks, ctx.prevMy as any);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: QK.tasks });
      qc.invalidateQueries({ queryKey: QK.myTasks });
      qc.invalidateQueries({ queryKey: QK.task(v.id) });
      qc.invalidateQueries({ queryKey: QK.dashboardStats });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.tasks.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.tasks });
      qc.invalidateQueries({ queryKey: QK.dashboardStats });
    },
  });
}

export function useReorderTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sortOrder }: { id: number; sortOrder: number }) => api.tasks.reorder(id, sortOrder),
    onMutate: async ({ id, sortOrder }) => {
      await qc.cancelQueries({ queryKey: QK.tasks });
      const previous = qc.getQueryData(QK.tasks);
      qc.setQueryData(QK.tasks, (old: any[]) =>
        (old ?? []).map((t) => t.id === id ? { ...t, sortOrder } : t)
      );
      return { previous };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.tasks, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QK.tasks }),
  });
}

export function useArchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.tasks.archive(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK.tasks });
      const previous = qc.getQueryData(QK.tasks);
      qc.setQueryData(QK.tasks, (old: any[]) =>
        (old ?? []).filter((t) => t.id !== id)
      );
      return { previous };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.tasks, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QK.tasks });
      qc.invalidateQueries({ queryKey: QK.archivedTasks });
      qc.invalidateQueries({ queryKey: QK.dashboardStats });
    },
  });
}

export function useRestoreTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.tasks.restore(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK.archivedTasks });
      const previous = qc.getQueryData(QK.archivedTasks);
      qc.setQueryData(QK.archivedTasks, (old: any[]) =>
        (old ?? []).filter((t) => t.id !== id)
      );
      return { previous };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.archivedTasks, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QK.tasks });
      qc.invalidateQueries({ queryKey: QK.archivedTasks });
    },
  });
}

export function usePermanentDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.tasks.permanentDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.archivedTasks }),
  });
}

export function useBulkDeleteTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => api.tasks.bulkDelete(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.tasks });
      qc.invalidateQueries({ queryKey: QK.dashboardStats });
    },
  });
}

// ── Subtasks ──────────────────────────────────────────────────────────────────
export function useSubtasks(taskId: number) {
  return useQuery({ queryKey: QK.subtasks(taskId), queryFn: () => api.subtasks.listByTask(taskId), enabled: !!taskId });
}

export function useCreateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, title }: { taskId: number; title: string }) => api.subtasks.create(taskId, title),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: QK.subtasks(v.taskId) }),
  });
}

export function useToggleSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, completed, taskId }: { id: number; completed: boolean; taskId: number }) =>
      api.subtasks.toggle(id, completed),
    onMutate: async ({ id, completed, taskId }) => {
      await qc.cancelQueries({ queryKey: QK.subtasks(taskId) });
      const previous = qc.getQueryData(QK.subtasks(taskId));
      qc.setQueryData(QK.subtasks(taskId), (old: any[]) =>
        (old ?? []).map((s) => s.id === id ? { ...s, completed } : s)
      );
      return { previous };
    },
    onError: (_e, v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.subtasks(v.taskId), ctx.previous);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: QK.subtasks(v.taskId) }),
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskId }: { id: number; taskId: number }) => api.subtasks.delete(id),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: QK.subtasks(v.taskId) }),
  });
}

// ── Comments ──────────────────────────────────────────────────────────────────
export function useComments(taskId: number) {
  return useQuery({ queryKey: QK.comments(taskId), queryFn: () => api.comments.list(taskId), enabled: !!taskId });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: number; content: string }) => api.comments.create(taskId, content),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: QK.comments(v.taskId) }),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskId }: { id: number; taskId: number }) => api.comments.delete(id),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: QK.comments(v.taskId) }),
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery({ queryKey: QK.dashboardStats, queryFn: () => api.dashboard.stats() });
}

// ── Milestones ────────────────────────────────────────────────────────────────
export function useMilestones(projectId: number) {
  return useQuery({ queryKey: QK.milestones(projectId), queryFn: () => api.milestones.list(projectId), enabled: !!projectId });
}

export function useCalendarMilestones() {
  return useQuery({ queryKey: QK.calendarMilestones, queryFn: () => api.milestones.listForCalendar() });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: number; [k: string]: unknown }) =>
      api.milestones.create(projectId, data),
    onMutate: async ({ projectId, ...data }) => {
      await qc.cancelQueries({ queryKey: QK.milestones(projectId) });
      await qc.cancelQueries({ queryKey: QK.projectsWithStats });
      const previous = qc.getQueryData(QK.milestones(projectId));
      const prevStats = qc.getQueryData(QK.projectsWithStats);
      const tempId = -Date.now();
      const optimistic = { id: tempId, projectId, completedAt: null, createdAt: new Date().toISOString(), ...data };
      const sortByDate = (a: any, b: any) => {
        if (a.dueDate == null && b.dueDate == null) return 0;
        if (a.dueDate == null) return 1;
        if (b.dueDate == null) return -1;
        return a.dueDate - b.dueDate;
      };
      qc.setQueryData(QK.milestones(projectId), (old: any) =>
        Array.isArray(old) ? [...old, optimistic].sort(sortByDate) : [optimistic]
      );
      qc.setQueryData(QK.projectsWithStats, (old: any) =>
        Array.isArray(old) ? old.map((p: any) =>
          p.id !== projectId ? p : {
            ...p,
            milestoneTotal: (p.milestoneTotal ?? 0) + 1,
            milestonePreview: [...(p.milestonePreview ?? []), { id: tempId, title: data.title, completedAt: null, dueDate: (data.dueDate as number) ?? null }].sort(sortByDate),
          }
        ) : old
      );
      return { previous, prevStats };
    },
    onError: (_e, v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.milestones(v.projectId), ctx.previous);
      if (ctx?.prevStats) qc.setQueryData(QK.projectsWithStats, ctx.prevStats);
    },
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: QK.milestones(v.projectId) });
      qc.invalidateQueries({ queryKey: QK.projectsWithStats });
    },
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, ...data }: { id: number; projectId: number; [k: string]: unknown }) =>
      api.milestones.update(id, data),
    onMutate: async ({ id, projectId, ...data }) => {
      await qc.cancelQueries({ queryKey: QK.milestones(projectId) });
      await qc.cancelQueries({ queryKey: QK.projectsWithStats });
      const previous = qc.getQueryData(QK.milestones(projectId));
      const prevStats = qc.getQueryData(QK.projectsWithStats);
      qc.setQueryData(QK.milestones(projectId), (old: any[]) =>
        (old ?? []).map((m) => m.id === id ? { ...m, ...data } : m)
      );
      qc.setQueryData(QK.projectsWithStats, (old: any[]) =>
        (old ?? []).map((p: any) => p.id === projectId ? {
          ...p,
          milestonePreview: (p.milestonePreview ?? []).map((m: any) =>
            m.id === id ? { ...m, ...data } : m
          ),
        } : p)
      );
      return { previous, prevStats };
    },
    onError: (_e, v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.milestones(v.projectId), ctx.previous);
      if (ctx?.prevStats) qc.setQueryData(QK.projectsWithStats, ctx.prevStats);
    },
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: QK.milestones(v.projectId) });
      qc.invalidateQueries({ queryKey: QK.projectsWithStats });
    },
  });
}

export function useToggleMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean; projectId: number }) =>
      api.milestones.toggle(id, completed),
    onMutate: async ({ id, completed, projectId }) => {
      await qc.cancelQueries({ queryKey: QK.milestones(projectId) });
      await qc.cancelQueries({ queryKey: QK.projectsWithStats });
      const prevMilestones = qc.getQueryData(QK.milestones(projectId));
      const prevStats = qc.getQueryData(QK.projectsWithStats);
      const now = completed ? Date.now() : null;
      // Patch milestones list
      qc.setQueryData(QK.milestones(projectId), (old: any) =>
        Array.isArray(old)
          ? old.map((m: any) => m.id === id ? { ...m, completedAt: now } : m)
          : old
      );
      // Patch projectsWithStats milestonePreview + milestoneDone count
      qc.setQueryData(QK.projectsWithStats, (old: any) =>
        Array.isArray(old)
          ? old.map((p: any) => {
              if (p.id !== projectId) return p;
              const preview = Array.isArray(p.milestonePreview)
                ? p.milestonePreview.map((m: any) =>
                    m.id === id ? { ...m, completedAt: now } : m
                  )
                : p.milestonePreview;
              const delta = completed ? 1 : -1;
              return { ...p, milestonePreview: preview, milestoneDone: Math.max(0, (p.milestoneDone ?? 0) + delta) };
            })
          : old
      );
      return { prevMilestones, prevStats };
    },
    onError: (_e, v, ctx: any) => {
      if (ctx?.prevMilestones) qc.setQueryData(QK.milestones(v.projectId), ctx.prevMilestones);
      if (ctx?.prevStats) qc.setQueryData(QK.projectsWithStats, ctx.prevStats);
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: QK.milestones(v.projectId) }),
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; projectId: number }) => api.milestones.delete(id),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: QK.milestones(v.projectId) }),
  });
}

// ── Strategic Organizer ───────────────────────────────────────────────────────
export function useStrategicOrganizer() {
  return useQuery({ queryKey: QK.strategicOrganizer, queryFn: () => api.strategicOrganizer.get() });
}

export function useUpsertStrategicOrganizer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.strategicOrganizer.upsert(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.strategicOrganizer });
      qc.invalidateQueries({ queryKey: QK.strategicOrganizerVersions });
    },
  });
}

export function useStrategicOrganizerVersions() {
  return useQuery({ queryKey: QK.strategicOrganizerVersions, queryFn: () => api.strategicOrganizer.listVersions() });
}

export function useRestoreStrategicOrganizerVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.strategicOrganizer.restoreVersion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.strategicOrganizer }),
  });
}

export function useDeleteStrategicOrganizerVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.strategicOrganizer.deleteVersion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.strategicOrganizerVersions }),
  });
}

// ── Announcements ─────────────────────────────────────────────────────────────
export function useAnnouncements() {
  return useQuery({ queryKey: QK.announcements, queryFn: () => api.announcements.list() });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.announcements.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.announcements }),
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; [k: string]: unknown }) => api.announcements.update(id, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: QK.announcements });
      const previous = qc.getQueryData(QK.announcements);
      qc.setQueryData(QK.announcements, (old: any[]) =>
        (old ?? []).map((a) => a.id === id ? { ...a, ...data } : a)
      );
      return { previous };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.announcements, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QK.announcements }),
  });
}

export function useTogglePinAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPinned }: { id: number; isPinned: boolean }) =>
      api.announcements.update(id, { isPinned }),
    onMutate: async ({ id, isPinned }) => {
      await qc.cancelQueries({ queryKey: QK.announcements });
      const previous = qc.getQueryData(QK.announcements);
      qc.setQueryData(QK.announcements, (old: any[]) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, isPinned } : a))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(QK.announcements, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QK.announcements }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.announcements.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.announcements }),
  });
}

// ── Project Comments ──────────────────────────────────────────────────────────
export function useProjectComments(projectId: number) {
  return useQuery({ queryKey: QK.projectComments(projectId), queryFn: () => api.projectComments.list(projectId), enabled: !!projectId });
}

export function useCreateProjectComment(currentUser?: { id: number; name?: string | null }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, content }: { projectId: number; content: string }) =>
      api.projectComments.create(projectId, content),
    onMutate: async ({ projectId, content }) => {
      await qc.cancelQueries({ queryKey: QK.projectComments(projectId) });
      const previous = qc.getQueryData(QK.projectComments(projectId));
      if (currentUser) {
        qc.setQueryData(QK.projectComments(projectId), (old: any[] = []) => [
          ...old,
          { id: -Date.now(), projectId, authorId: currentUser.id, author: { name: currentUser.name ?? "You" }, content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ]);
      }
      return { previous };
    },
    onError: (_e, v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.projectComments(v.projectId), ctx.previous);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: QK.projectComments(v.projectId) }),
  });
}

export function useDeleteProjectComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId }: { id: number; projectId: number }) => api.projectComments.delete(id),
    onMutate: async ({ id, projectId }) => {
      await qc.cancelQueries({ queryKey: QK.projectComments(projectId) });
      const previous = qc.getQueryData(QK.projectComments(projectId));
      qc.setQueryData(QK.projectComments(projectId), (old: any[] = []) => old.filter((c) => c.id !== id));
      return { previous };
    },
    onError: (_e, v, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(QK.projectComments(v.projectId), ctx.previous);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: QK.projectComments(v.projectId) }),
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function useOverdueCount() {
  return useQuery({ queryKey: QK.overdueCount, queryFn: () => api.notifications.overdueCount() });
}

export function useNotificationSchedule() {
  return useQuery({ queryKey: QK.schedule, queryFn: () => api.notifications.getSchedule() });
}

export function useReminderWindow() {
  return useQuery({ queryKey: QK.reminderWindow, queryFn: () => api.notifications.getReminderWindow() });
}

export function useDueSoonCount() {
  return useQuery({ queryKey: QK.dueSoonCount, queryFn: () => api.notifications.dueSoonCount() });
}

export function usePreviewDigest() {
  return useQuery({ queryKey: QK.previewDigest, queryFn: () => api.notifications.previewDigest() });
}

export function useWeeklyReportSchedule() {
  return useQuery({ queryKey: QK.weeklySchedule, queryFn: () => api.notifications.getWeeklyReportSchedule() });
}

// ── Invites ───────────────────────────────────────────────────────────────────
export function useInvites() {
  return useQuery({ queryKey: QK.invites, queryFn: () => api.invites.list() });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: "user" | "admin" }) =>
      api.invites.create(email, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.invites }),
  });
}

export function useDeleteInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.invites.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.invites }),
  });
}

export function useInviteLinks() {
  return useQuery({ queryKey: QK.inviteLinks, queryFn: () => api.invites.links.list() });
}

export function useCreateInviteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ role, expiresInDays }: { role: "user" | "admin"; expiresInDays?: number }) =>
      api.invites.links.create(role, expiresInDays),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.inviteLinks }),
  });
}

export function useDeleteInviteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.invites.links.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.inviteLinks }),
  });
}
