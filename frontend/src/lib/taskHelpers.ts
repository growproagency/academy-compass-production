export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

export const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  todo: "badge-todo",
  in_progress: "badge-in-progress",
  done: "badge-done",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PRIORITY_BADGE_CLASS: Record<TaskPriority, string> = {
  low: "badge-low",
  medium: "badge-medium",
  high: "badge-high",
};

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function isOverdue(dueDate: number | null | undefined): boolean {
  if (!dueDate) return false;
  return dueDate < Date.now();
}

export function formatDueDate(dueDate: number | null | undefined): string {
  if (!dueDate) return "";
  return new Date(dueDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getUserInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
