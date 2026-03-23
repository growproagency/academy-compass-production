// Shared database types — replaces drizzle/schema inferred types

export type UserRole = "user" | "admin" | "superadmin";
export type ProjectStatus = "on_track" | "off_track" | "assist" | "complete";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type RecurrenceType = "none" | "daily" | "biweekly" | "weekly" | "monthly";

export interface Organization {
  id: number;
  name: string;
  slug: string;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertOrganization = Omit<Organization, "id" | "createdAt" | "updatedAt">;

export interface User {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: UserRole;
  organizationId: number | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

export type InsertUser = Partial<User> & { openId: string };

export interface Project {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  organizationId: number;
  dueDate: number | null;
  projectStatus: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertProject = Omit<Project, "id" | "createdAt" | "updatedAt">;

export interface ProjectMember {
  id: number;
  projectId: number;
  userId: number;
  joinedAt: Date;
}

export type InsertProjectMember = Omit<ProjectMember, "id" | "joinedAt">;

export interface Task {
  id: number;
  title: string;
  description: string | null;
  notes: string | null;
  projectId: number | null;
  assigneeId: number | null;
  creatorId: number;
  organizationId: number;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: number | null;
  archivedAt: number | null;
  sortOrder: number;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceEndsAt: number | null;
  recurrenceParentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertTask = Omit<Task, "id" | "createdAt" | "updatedAt" | "sortOrder" | "archivedAt" | "recurrenceParentId"> & { sortOrder?: number; archivedAt?: number | null; recurrenceParentId?: number | null };

export interface TaskSubtask {
  id: number;
  taskId: number;
  title: string;
  completed: boolean;
  position: number;
  createdAt: Date;
}

export type InsertTaskSubtask = Omit<TaskSubtask, "id" | "createdAt">;

export interface TaskComment {
  id: number;
  taskId: number;
  authorId: number;
  content: string;
  isActivity: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertTaskComment = Omit<TaskComment, "id" | "createdAt" | "updatedAt" | "isActivity"> & { isActivity?: boolean };

export interface SystemSetting {
  organizationId: number;
  key: string;
  value: string;
  updatedAt: Date;
}

export interface Milestone {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  dueDate: number | null;
  completedAt: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertMilestone = Omit<Milestone, "id" | "createdAt" | "updatedAt" | "sortOrder" | "completedAt"> & { sortOrder?: number; completedAt?: number | null };

export interface StrategicOrganizer {
  id: number;
  organizationId: number;
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
  createdAt: Date;
  updatedAt: Date;
}

export type InsertStrategicOrganizer = Omit<StrategicOrganizer, "id" | "createdAt" | "updatedAt">;

export interface StrategicOrganizerVersion {
  id: number;
  organizationId: number;
  ownerId: number;
  label: string | null;
  snapshotJson: string;
  createdAt: Date;
}

export type InsertStrategicOrganizerVersion = Omit<StrategicOrganizerVersion, "id" | "createdAt">;

export interface ProjectHealthSnapshot {
  id: number;
  organizationId: number;
  snapshotDate: number;
  onTrack: number;
  offTrack: number;
  assist: number;
  complete: number;
  totalMilestones: number;
  doneMilestones: number;
  createdAt: Date;
}

export type InsertProjectHealthSnapshot = Omit<ProjectHealthSnapshot, "id" | "createdAt">;

export interface Announcement {
  id: number;
  organizationId: number;
  title: string;
  body: string;
  isPinned: boolean;
  authorId: number;
  expiresAt: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertAnnouncement = Omit<Announcement, "id" | "createdAt" | "updatedAt">;

export interface ProjectComment {
  id: number;
  projectId: number;
  authorId: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertProjectComment = Omit<ProjectComment, "id" | "createdAt" | "updatedAt">;

export interface Invite {
  id: number;
  organizationId: number;
  email: string;
  role: UserRole;
  invitedBy: number;
  acceptedAt: Date | null;
  createdAt: Date;
}

export type InsertInvite = Omit<Invite, "id" | "acceptedAt" | "createdAt">;
