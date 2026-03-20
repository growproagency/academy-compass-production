export type UserRole = "user" | "admin";
export type UserStatus = "pending" | "active" | "suspended";
export type RockStatus = "on_track" | "off_track" | "assist" | "complete";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type RecurrenceType = "none" | "daily" | "biweekly" | "weekly" | "monthly";

export interface User {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: UserRole;
  status: UserStatus;
  approved_at: string | null;
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  dueDate: number | null;
  rockStatus: RockStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: number;
  projectId: number;
  userId: number;
  joinedAt: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  notes: string | null;
  projectId: number | null;
  assigneeId: number | null;
  creatorId: number;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: number | null;
  archivedAt: number | null;
  sortOrder: number;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceEndsAt: number | null;
  recurrenceParentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskSubtask {
  id: number;
  taskId: number;
  title: string;
  completed: boolean;
  position: number;
  createdAt: string;
}

export interface TaskComment {
  id: number;
  taskId: number;
  authorId: number;
  content: string;
  isActivity: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  dueDate: number | null;
  completedAt: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StrategicOrganizer {
  id: number;
  ownerId: number;
  schoolName?: string | null;
  mission?: string | null;
  values?: string | null;
  idealCustomerProfile?: string | null;
  bhag?: string | null;
  threeYearVisual?: string | null;
  oneYearGoal?: string | null;
  ninetyDayProject?: string | null;
  parkingLot?: string | null;
  focusOfTheYear?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StrategicOrganizerVersion {
  id: number;
  ownerId: number;
  label: string | null;
  snapshotJson: string;
  createdAt: string;
}

export interface RockHealthSnapshot {
  id: number;
  snapshotDate: number;
  onTrack: number;
  offTrack: number;
  assist: number;
  complete: number;
  totalMilestones: number;
  doneMilestones: number;
  createdAt: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  isPinned: boolean;
  authorId: number;
  expiresAt: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RockComment {
  id: number;
  projectId: number;
  authorId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}