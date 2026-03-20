// REST API client — replaces tRPC
import { supabase } from "./supabaseClient";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

/**
 * Detect the org slug from the current URL.
 * - Production: extract subdomain from hostname (e.g. "school" from "school.app.com")
 * - Local dev: fall back to VITE_ORG_SLUG env var
 */
function getOrgSlug(): string {
  const hostname = window.location.hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    const parts = hostname.split(".");
    if (parts.length >= 3) return parts[0];
  }
  return import.meta.env.VITE_ORG_SLUG || "";
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const orgSlug = getOrgSlug();

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(orgSlug ? { "X-Org-Slug": orgSlug } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (res.status === 401) {
    throw new ApiError("Unauthorized", 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(body.message || res.statusText, res.status);
  }

  return res.json();
}

function get<T>(path: string) {
  return request<T>(path);
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function patch<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function del<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "DELETE",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const api = {
  // ── Orgs ──────────────────────────────────────────────────────────────────
  orgs: {
    current: () => get("/orgs/current"),
    list: () => get("/orgs"),
    create: (data: { name: string; slug: string; brandPrimaryColor?: string; brandAccentColor?: string; logoUrl?: string }) =>
      post("/orgs", data),
    update: (id: number, data: { name?: string; slug?: string; brandPrimaryColor?: string; brandAccentColor?: string; logoUrl?: string }) =>
      patch(`/orgs/${id}`, data),
    delete: (id: number) => del(`/orgs/${id}`),
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    me: () => get("/auth/me"),
    logout: () => post("/auth/logout"),
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  users: {
    list: () => get("/users"),
    getById: (id: number) => get(`/users/${id}`),
    updateRole: (id: number, role: "user" | "admin") =>
      patch(`/users/${id}/role`, { role }),
    updateMe: (name: string) => patch("/users/me", { name }),
    myTasks: () => get("/users/me/tasks"),
    scorecard: (userId: number) => get(`/users/${userId}/scorecard`),
  },

  // ── Projects ──────────────────────────────────────────────────────────────
  projects: {
    list: () => get("/projects"),
    listWithStats: () => get("/projects?stats=true"),
    healthTrend: () => get("/projects/health-trend"),
    getById: (id: number) => get(`/projects/${id}`),
    create: (data: Record<string, unknown>) => post("/projects", data),
    update: (id: number, data: Record<string, unknown>) =>
      patch(`/projects/${id}`, data),
    delete: (id: number) => del(`/projects/${id}`),
    members: {
      list: (projectId: number) => get(`/projects/${projectId}/members`),
      add: (projectId: number, userId: number) =>
        post(`/projects/${projectId}/members`, { userId }),
      remove: (projectId: number, userId: number) =>
        del(`/projects/${projectId}/members/${userId}`),
    },
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────
  tasks: {
    listByProject: (projectId: number) =>
      get(`/tasks?projectId=${projectId}`),
    listAll: () => get("/tasks"),
    listForCalendar: () => get("/tasks?calendar=true"),
    listArchived: () => get("/tasks?archived=true"),
    search: (query: string) => get(`/tasks/search?q=${encodeURIComponent(query)}`),
    getById: (id: number) => get(`/tasks/${id}`),
    create: (data: Record<string, unknown>) => post("/tasks", data),
    update: (id: number, data: Record<string, unknown>) =>
      patch(`/tasks/${id}`, data),
    delete: (id: number) => del(`/tasks/${id}`),
    reorder: (id: number, sortOrder: number) =>
      patch(`/tasks/${id}/reorder`, { sortOrder }),
    archive: (id: number) => post(`/tasks/${id}/archive`),
    restore: (id: number) => post(`/tasks/${id}/restore`),
    permanentDelete: (id: number) => del(`/tasks/${id}/permanent`),
    bulkDelete: (ids: number[]) => post("/tasks/bulk-delete", { ids }),
  },

  // ── Subtasks ──────────────────────────────────────────────────────────────
  subtasks: {
    listByTask: (taskId: number) => get(`/tasks/${taskId}/subtasks`),
    create: (taskId: number, title: string) =>
      post(`/tasks/${taskId}/subtasks`, { title }),
    toggle: (id: number, completed: boolean) =>
      patch(`/subtasks/${id}`, { completed }),
    delete: (id: number) => del(`/subtasks/${id}`),
  },

  // ── Comments ──────────────────────────────────────────────────────────────
  comments: {
    list: (taskId: number) => get(`/tasks/${taskId}/comments`),
    create: (taskId: number, content: string) =>
      post(`/tasks/${taskId}/comments`, { content }),
    delete: (id: number) => del(`/comments/${id}`),
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: {
    stats: () => get("/dashboard/stats"),
  },

  // ── Milestones ────────────────────────────────────────────────────────────
  milestones: {
    listForCalendar: () => get("/milestones?calendar=true"),
    list: (projectId: number) => get(`/projects/${projectId}/milestones`),
    create: (projectId: number, data: Record<string, unknown>) =>
      post(`/projects/${projectId}/milestones`, data),
    update: (id: number, data: Record<string, unknown>) =>
      patch(`/milestones/${id}`, data),
    toggle: (id: number, completed: boolean) =>
      patch(`/milestones/${id}/toggle`, { completed }),
    delete: (id: number) => del(`/milestones/${id}`),
  },

  // ── Strategic Organizer ───────────────────────────────────────────────────
  strategicOrganizer: {
    get: () => get("/strategic-organizer"),
    upsert: (data: Record<string, unknown>) =>
      post("/strategic-organizer", data),
    listVersions: () => get("/strategic-organizer/versions"),
    restoreVersion: (id: number) =>
      post(`/strategic-organizer/versions/${id}/restore`),
    deleteVersion: (id: number) =>
      del(`/strategic-organizer/versions/${id}`),
  },

  // ── Announcements ─────────────────────────────────────────────────────────
  announcements: {
    list: () => get("/announcements"),
    create: (data: Record<string, unknown>) => post("/announcements", data),
    update: (id: number, data: Record<string, unknown>) =>
      patch(`/announcements/${id}`, data),
    delete: (id: number) => del(`/announcements/${id}`),
    togglePin: (id: number, isPinned: boolean) =>
      patch(`/announcements/${id}/pin`, { isPinned }),
  },

  // ── Rock Comments ─────────────────────────────────────────────────────────
  rockComments: {
    list: (projectId: number) => get(`/projects/${projectId}/rock-comments`),
    create: (projectId: number, content: string) =>
      post(`/projects/${projectId}/rock-comments`, { content }),
    delete: (id: number) => del(`/rock-comments/${id}`),
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: {
    overdueCount: () => get("/notifications/overdue-count"),
    getSchedule: () => get("/notifications/schedule"),
    setSchedule: (hour: number, minute: number) =>
      post("/notifications/schedule", { hour, minute }),
    previewDigest: () => get("/notifications/preview-digest"),
    sendDailyDigest: () => post("/notifications/send-digest"),
    getReminderWindow: () => get("/notifications/reminder-window"),
    setReminderWindow: (hours: number) =>
      post("/notifications/reminder-window", { hours }),
    dueSoonCount: () => get("/notifications/due-soon-count"),
    sendDueRemindersNow: () => post("/notifications/send-reminders"),
    getWeeklyReportSchedule: () => get("/notifications/weekly-report-schedule"),
    setWeeklyReportSchedule: (hour: number, minute: number) =>
      post("/notifications/weekly-report-schedule", { hour, minute }),
    sendWeeklyReportNow: () => post("/notifications/send-weekly-report"),
  },
};

export { ApiError };
