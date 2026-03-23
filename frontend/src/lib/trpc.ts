/**
 * tRPC Compatibility Shim
 *
 * All the pages use `trpc.xxx.useQuery()` / `trpc.xxx.useMutation()` patterns.
 * Instead of rewriting every page, this file provides a `trpc` object that
 * mirrors the tRPC API surface but delegates to React Query + REST API calls.
 *
 * This lets us keep the frontend pages exactly as they were.
 */

import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  QK,
  useMe,
  useUsers,
  useUser,
  useUserScorecard,
  useMyTasks,
  useUpdateMe,
  useUpdateUserRole,
  useProjects,
  useProjectsWithStats,
  useHealthTrend,
  useProject,
  useProjectMembers,
  useCreateProject,
  useDeleteProject,
  useAddProjectMember,
  useRemoveProjectMember,
  useTasks,
  useTasksByProject,
  useCalendarTasks,
  useArchivedTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useReorderTask,
  useArchiveTask,
  useRestoreTask,
  usePermanentDeleteTask,
  useBulkDeleteTasks,
  useSubtasks,
  useCreateSubtask,
  useToggleSubtask,
  useDeleteSubtask,
  useComments,
  useCreateComment,
  useDeleteComment,
  useDashboardStats,
  useMilestones,
  useCalendarMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useToggleMilestone,
  useDeleteMilestone,
  useStrategicOrganizer,
  useUpsertStrategicOrganizer,
  useStrategicOrganizerVersions,
  useRestoreStrategicOrganizerVersion,
  useDeleteStrategicOrganizerVersion,
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  useProjectComments,
  useCreateProjectComment,
  useDeleteProjectComment,
  useOverdueCount,
  useNotificationSchedule,
  useReminderWindow,
  useDueSoonCount,
  usePreviewDigest,
  useWeeklyReportSchedule,
  useInvites,
  useCreateInvite,
  useDeleteInvite,
} from "@/hooks/useApi";

// Helper: returns a "useUtils" function that mimics trpc.useUtils()
function makeUtils(qc: ReturnType<typeof useQueryClient>) {
  return {
    tasks: {
      listAll: { invalidate: () => qc.invalidateQueries({ queryKey: QK.tasks }) },
      listForCalendar: { invalidate: () => qc.invalidateQueries({ queryKey: QK.calendarTasks }) },
      listArchived: { invalidate: () => qc.invalidateQueries({ queryKey: QK.archivedTasks }) },
      listByProject: {
        invalidate: (args?: { projectId: number }) =>
          args
            ? qc.invalidateQueries({ queryKey: QK.tasksByProject(args.projectId) })
            : qc.invalidateQueries({ queryKey: ["tasks", "project"] }),
      },
    },
    dashboard: {
      stats: { invalidate: () => qc.invalidateQueries({ queryKey: QK.dashboardStats }) },
    },
    projects: {
      list: { invalidate: () => qc.invalidateQueries({ queryKey: QK.projects }) },
      listWithStats: { invalidate: () => qc.invalidateQueries({ queryKey: QK.projectsWithStats }) },
      getById: {
        cancel: (args: { id: number }) => qc.cancelQueries({ queryKey: QK.project(args.id) }),
        getData: (args: { id: number }) => qc.getQueryData(QK.project(args.id)),
        setData: (args: { id: number }, data: unknown) => qc.setQueryData(QK.project(args.id), data),
        invalidate: (args?: { id: number }) =>
          args
            ? qc.invalidateQueries({ queryKey: QK.project(args.id) })
            : qc.invalidateQueries({ queryKey: QK.projects }),
      },
      members: {
        list: {
          invalidate: (args?: { projectId: number }) =>
            args
              ? qc.invalidateQueries({ queryKey: QK.projectMembers(args.projectId) })
              : qc.invalidateQueries({ queryKey: ["projects"] }),
        },
      },
    },
    auth: {
      me: {
        setData: (_: undefined, data: unknown) => qc.setQueryData(QK.me, data),
        invalidate: () => qc.invalidateQueries({ queryKey: QK.me }),
      },
    },
    milestones: {
      list: {
        invalidate: (args?: { projectId: number }) =>
          args
            ? qc.invalidateQueries({ queryKey: QK.milestones(args.projectId) })
            : qc.invalidateQueries({ queryKey: ["milestones"] }),
      },
    },
    subtasks: {
      listByTask: {
        invalidate: (args?: { taskId: number }) =>
          args
            ? qc.invalidateQueries({ queryKey: QK.subtasks(args.taskId) })
            : qc.invalidateQueries({ queryKey: ["subtasks"] }),
      },
    },
    projectComments: {
      list: {
        invalidate: (args?: { projectId: number }) =>
          args
            ? qc.invalidateQueries({ queryKey: QK.projectComments(args.projectId) })
            : qc.invalidateQueries({ queryKey: ["projectComments"] }),
      },
    },
    strategicOrganizer: {
      get: { invalidate: () => qc.invalidateQueries({ queryKey: QK.strategicOrganizer }) },
      listVersions: { invalidate: () => qc.invalidateQueries({ queryKey: QK.strategicOrganizerVersions }) },
    },
    users: {
      myTasks: { invalidate: () => qc.invalidateQueries({ queryKey: QK.myTasks }) },
    },
    announcements: {
      list: { invalidate: () => qc.invalidateQueries({ queryKey: QK.announcements }) },
    },
    comments: {
      list: {
        cancel: (args: { taskId: number }) => qc.cancelQueries({ queryKey: QK.comments(args.taskId) }),
        getData: (args: { taskId: number }) => qc.getQueryData(QK.comments(args.taskId)),
        setData: (args: { taskId: number }, updater: unknown) => qc.setQueryData(QK.comments(args.taskId), updater),
        invalidate: (args?: { taskId: number }) =>
          args
            ? qc.invalidateQueries({ queryKey: QK.comments(args.taskId) })
            : qc.invalidateQueries({ queryKey: ["comments"] }),
      },
    },
  };
}

// Helper: wraps a mutation result to call page-level opts callbacks (onSuccess/onError/onSettled)
// in addition to the hook's built-in callbacks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withOpts<T extends { mutate: (...args: any[]) => void }>(mutation: T, opts?: object): T {
  if (!opts) return mutation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { onSuccess, onError, onSettled } = opts as any;
  if (!onSuccess && !onError && !onSettled) return mutation;
  return {
    ...mutation,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutate: (vars: unknown, callOpts?: any) =>
      mutation.mutate(vars, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSuccess: (...args: any[]) => { onSuccess?.(...args); callOpts?.onSuccess?.(...args); },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (...args: any[]) => { onError?.(...args); callOpts?.onError?.(...args); },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSettled: (...args: any[]) => { onSettled?.(...args); callOpts?.onSettled?.(...args); },
      }),
  } as T;
}

// The trpc shim object
export const trpc = {
  useUtils: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const qc = useQueryClient();
    return makeUtils(qc);
  },

  auth: {
    me: { useQuery: (opts?: object) => useMe(opts) },
    logout: {
      useMutation: (opts?: { onSuccess?: () => void }) => ({
        mutateAsync: async () => {
          await api.auth.logout();
          opts?.onSuccess?.();
        },
        isPending: false,
        error: null,
      }),
    },
  },

  users: {
    list: { useQuery: () => useUsers() },
    getById: { useQuery: ({ id }: { id: number }) => useUser(id) },
    updateMe: { useMutation: (opts?: object) => withOpts(useUpdateMe(), opts) },
    updateRole: { useMutation: (opts?: object) => withOpts(useUpdateUserRole(), opts) },
    myTasks: { useQuery: () => useMyTasks() },
    scorecard: { useQuery: ({ userId }: { userId: number }) => useUserScorecard(userId) },
  },

  projects: {
    list: { useQuery: () => useProjects() },
    listWithStats: { useQuery: () => useProjectsWithStats() },
    healthTrend: { useQuery: () => useHealthTrend() },
    getById: { useQuery: ({ id }: { id: number }) => useProject(id) },
    create: { useMutation: (opts?: object) => withOpts(useCreateProject(), opts) },
    // projects.update uses a real useMutation so onMutate (optimistic updates) works
    update: {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useMutation: (opts?: object) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const qc = useQueryClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const o = opts as any;
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useMutation({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mutationFn: ({ id, ...data }: any) => api.projects.update(id, data),
          onMutate: o?.onMutate,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSuccess: (_d: unknown, v: any, ctx: unknown) => {
            qc.invalidateQueries({ queryKey: QK.project(v.id) });
            qc.invalidateQueries({ queryKey: QK.projects });
            qc.invalidateQueries({ queryKey: QK.projectsWithStats });
            o?.onSuccess?.(_d, v, ctx);
          },
          onError: (e: unknown, v: unknown, ctx: unknown) => { o?.onError?.(e, v, ctx); },
          onSettled: (d: unknown, e: unknown, v: unknown, ctx: unknown) => { o?.onSettled?.(d, e, v, ctx); },
        });
      },
    },
    delete: { useMutation: (opts?: object) => withOpts(useDeleteProject(), opts) },
    members: {
      list: { useQuery: ({ projectId }: { projectId: number }) => useProjectMembers(projectId) },
      add: { useMutation: (opts?: object) => withOpts(useAddProjectMember(), opts) },
      remove: { useMutation: (opts?: object) => withOpts(useRemoveProjectMember(), opts) },
    },
  },

  tasks: {
    listByProject: { useQuery: ({ projectId }: { projectId: number }) => useTasksByProject(projectId) },
    listAll: { useQuery: () => useTasks() },
    listForCalendar: { useQuery: () => useCalendarTasks() },
    listArchived: { useQuery: () => useArchivedTasks() },
    search: {
      useQuery: (_: { query: string }, _opts?: object) => ({
        data: undefined,
        isLoading: false,
      }),
    },
    getById: { useQuery: ({ id }: { id: number }) => useTask(id) },
    create: { useMutation: (opts?: object) => withOpts(useCreateTask(), opts) },
    update: { useMutation: (opts?: object) => withOpts(useUpdateTask(), opts) },
    delete: { useMutation: (opts?: object) => withOpts(useDeleteTask(), opts) },
    reorder: { useMutation: (opts?: object) => withOpts(useReorderTask(), opts) },
    archive: { useMutation: (opts?: object) => withOpts(useArchiveTask(), opts) },
    restore: { useMutation: (opts?: object) => withOpts(useRestoreTask(), opts) },
    permanentDelete: { useMutation: (opts?: object) => withOpts(usePermanentDeleteTask(), opts) },
    bulkDelete: { useMutation: (opts?: object) => withOpts(useBulkDeleteTasks(), opts) },
  },

  subtasks: {
    listByTask: { useQuery: ({ taskId }: { taskId: number }) => useSubtasks(taskId) },
    create: { useMutation: (opts?: object) => withOpts(useCreateSubtask(), opts) },
    toggle: { useMutation: (opts?: object) => withOpts(useToggleSubtask(), opts) },
    delete: { useMutation: (opts?: object) => withOpts(useDeleteSubtask(), opts) },
  },

  comments: {
    list: { useQuery: ({ taskId }: { taskId: number }) => useComments(taskId) },
    create: { useMutation: (opts?: object) => withOpts(useCreateComment(), opts) },
    delete: { useMutation: (opts?: object) => withOpts(useDeleteComment(), opts) },
  },

  dashboard: {
    stats: { useQuery: () => useDashboardStats() },
  },

  milestones: {
    listForCalendar: { useQuery: () => useCalendarMilestones() },
    list: { useQuery: ({ projectId }: { projectId: number }) => useMilestones(projectId) },
    create: { useMutation: (opts?: object) => withOpts(useCreateMilestone(), opts) },
    update: { useMutation: (opts?: object) => withOpts(useUpdateMilestone(), opts) },
    toggle: { useMutation: (opts?: object) => withOpts(useToggleMilestone(), opts) },
    delete: { useMutation: (opts?: object) => withOpts(useDeleteMilestone(), opts) },
  },

  strategicOrganizer: {
    get: { useQuery: () => useStrategicOrganizer() },
    upsert: { useMutation: (opts?: object) => withOpts(useUpsertStrategicOrganizer(), opts) },
    listVersions: { useQuery: () => useStrategicOrganizerVersions() },
    restoreVersion: { useMutation: (opts?: object) => withOpts(useRestoreStrategicOrganizerVersion(), opts) },
    deleteVersion: { useMutation: (opts?: object) => withOpts(useDeleteStrategicOrganizerVersion(), opts) },
  },

  announcements: {
    list: { useQuery: () => useAnnouncements() },
    create: { useMutation: (opts?: object) => withOpts(useCreateAnnouncement(), opts) },
    update: { useMutation: (opts?: object) => withOpts(useUpdateAnnouncement(), opts) },
    delete: { useMutation: (opts?: object) => withOpts(useDeleteAnnouncement(), opts) },
    togglePin: { useMutation: (opts?: object) => withOpts(useUpdateAnnouncement(), opts) },
  },

  projectComments: {
    list: { useQuery: ({ projectId }: { projectId: number }) => useProjectComments(projectId) },
    create: { useMutation: (opts?: object) => withOpts(useCreateProjectComment(), opts) },
    delete: { useMutation: (opts?: object) => withOpts(useDeleteProjectComment(), opts) },
  },

  notifications: {
    overdueCount: { useQuery: () => useOverdueCount() },
    getSchedule: { useQuery: () => useNotificationSchedule() },
    getReminderWindow: { useQuery: () => useReminderWindow() },
    dueSoonCount: { useQuery: () => useDueSoonCount() },
    previewDigest: { useQuery: () => usePreviewDigest() },
    getWeeklyReportSchedule: { useQuery: () => useWeeklyReportSchedule() },
    setSchedule: {
      useMutation: (opts?: object) => ({
        mutateAsync: (data: { hour: number; minute: number }) =>
          api.notifications.setSchedule(data.hour, data.minute),
        isPending: false,
        error: null,
      }),
    },
    setReminderWindow: {
      useMutation: (opts?: object) => ({
        mutateAsync: (data: { hours: number }) =>
          api.notifications.setReminderWindow(data.hours),
        isPending: false,
        error: null,
      }),
    },
    setWeeklyReportSchedule: {
      useMutation: (opts?: object) => ({
        mutateAsync: (data: { hour: number; minute: number }) =>
          api.notifications.setWeeklyReportSchedule(data.hour, data.minute),
        isPending: false,
        error: null,
      }),
    },
    sendDailyDigest: {
      useMutation: (opts?: object) => ({
        mutateAsync: () => api.notifications.sendDailyDigest(),
        isPending: false,
        error: null,
      }),
    },
    sendDueRemindersNow: {
      useMutation: (opts?: object) => ({
        mutateAsync: () => api.notifications.sendDueRemindersNow(),
        isPending: false,
        error: null,
      }),
    },
    sendWeeklyReportNow: {
      useMutation: (opts?: object) => ({
        mutateAsync: () => api.notifications.sendWeeklyReportNow(),
        isPending: false,
        error: null,
      }),
    },
  },

  invites: {
    list: { useQuery: () => useInvites() },
    create: { useMutation: (opts?: object) => withOpts(useCreateInvite(), opts) },
    delete: { useMutation: (opts?: object) => withOpts(useDeleteInvite(), opts) },
  },
};
