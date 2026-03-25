import { supabase } from "./supabase";
import type {
  Organization,
  InsertOrganization,
  User,
  InsertUser,
  Project,
  InsertProject,
  ProjectMember,
  InsertProjectMember,
  Task,
  InsertTask,
  TaskSubtask,
  InsertTaskSubtask,
  TaskComment,
  InsertTaskComment,
  Milestone,
  InsertMilestone,
  StrategicOrganizer,
  InsertStrategicOrganizer,
  StrategicOrganizerVersion,
  ProjectHealthSnapshot,
  Announcement,
  ProjectComment,
  InsertProjectComment,
  Invite,
  InsertInvite,
  RecurrenceType,
} from "./types/dbTypes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(val: string | null | undefined): Date {
  return val ? new Date(val) : new Date();
}

function mapOrg(row: Record<string, unknown>): Organization {
  return {
    id: row.id as number,
    name: row.name as string,
    slug: row.slug as string,
    brandPrimaryColor: (row.brandPrimaryColor as string) ?? null,
    brandAccentColor: (row.brandAccentColor as string) ?? null,
    logoUrl: (row.logoUrl as string) ?? null,
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    openId: row.openId as string,
    name: (row.name as string) ?? null,
    email: (row.email as string) ?? null,
    loginMethod: (row.loginMethod as string) ?? null,
    role: (row.role as User["role"]) ?? "user",
    organizationId: (row.organizationId as number) ?? null,
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
    lastSignedIn: toDate(row.lastSignedIn as string),
  };
}

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as number,
    name: row.name as string,
    description: (row.description as string) ?? null,
    ownerId: row.ownerId as number,
    organizationId: row.organizationId as number,
    dueDate: (row.dueDate as number) ?? null,
    projectStatus: (row.projectStatus as Project["projectStatus"]) ?? "on_track",
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function mapTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as number,
    title: row.title as string,
    description: (row.description as string) ?? null,
    notes: (row.notes as string) ?? null,
    projectId: (row.projectId as number) ?? null,
    assigneeId: (row.assigneeId as number) ?? null,
    creatorId: row.creatorId as number,
    organizationId: row.organizationId as number,
    status: (row.status as Task["status"]) ?? "todo",
    priority: (row.priority as Task["priority"]) ?? "medium",
    dueDate: (row.dueDate as number) ?? null,
    archivedAt: (row.archivedAt as number) ?? null,
    sortOrder: (row.sortOrder as number) ?? 0,
    recurrenceType: (row.recurrenceType as RecurrenceType) ?? "none",
    recurrenceInterval: (row.recurrenceInterval as number) ?? 1,
    recurrenceEndsAt: (row.recurrenceEndsAt as number) ?? null,
    recurrenceParentId: (row.recurrenceParentId as number) ?? null,
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function mapSubtask(row: Record<string, unknown>): TaskSubtask {
  return {
    id: row.id as number,
    taskId: row.taskId as number,
    title: row.title as string,
    completed: Boolean(row.completed),
    position: (row.position as number) ?? 0,
    createdAt: toDate(row.createdAt as string),
  };
}

function mapComment(row: Record<string, unknown>): TaskComment {
  return {
    id: row.id as number,
    taskId: row.taskId as number,
    authorId: row.authorId as number,
    content: row.content as string,
    isActivity: Boolean(row.isActivity),
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function mapMilestone(row: Record<string, unknown>): Milestone {
  return {
    id: row.id as number,
    projectId: row.projectId as number,
    title: row.title as string,
    description: (row.description as string) ?? null,
    dueDate: (row.dueDate as number) ?? null,
    completedAt: (row.completedAt as number) ?? null,
    sortOrder: (row.sortOrder as number) ?? 0,
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function mapAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: row.id as number,
    organizationId: row.organizationId as number,
    title: row.title as string,
    body: row.body as string,
    isPinned: Boolean(row.isPinned),
    authorId: row.authorId as number,
    expiresAt: (row.expiresAt as number) ?? null,
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function mapProjectComment(row: Record<string, unknown>): ProjectComment {
  return {
    id: row.id as number,
    projectId: row.projectId as number,
    authorId: row.authorId as number,
    content: row.content as string,
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

// ─── Organizations ────────────────────────────────────────────────────────────

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  const { data } = await supabase.from("organizations").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;
  return mapOrg(data as Record<string, unknown>);
}

export async function getOrgById(id: number): Promise<Organization | null> {
  const { data } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return mapOrg(data as Record<string, unknown>);
}

export async function listOrgs(): Promise<Organization[]> {
  const { data } = await supabase.from("organizations").select("*").order("name", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => mapOrg(r));
}

export async function createOrg(data: InsertOrganization): Promise<Organization | null> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("organizations")
    .insert({ ...data, createdAt: now, updatedAt: now })
    .select()
    .single();
  if (error || !row) return null;
  return mapOrg(row as Record<string, unknown>);
}

export async function updateOrg(id: number, data: Partial<InsertOrganization>): Promise<Organization | null> {
  const { data: row } = await supabase
    .from("organizations")
    .update({ ...data, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (!row) return null;
  return mapOrg(row as Record<string, unknown>);
}

export async function deleteOrg(id: number): Promise<void> {
  await supabase.from("organizations").delete().eq("id", id);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserByOpenId(openId: string): Promise<User | null> {
  const { data } = await supabase.from("users").select("*").eq("openId", openId).maybeSingle();
  if (!data) return null;
  return mapUser(data as Record<string, unknown>);
}

export async function getUserById(id: number): Promise<User | null> {
  const { data } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return mapUser(data as Record<string, unknown>);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { openId: user.openId, updatedAt: now };
  if (user.name !== undefined) payload.name = user.name ?? null;
  if (user.email !== undefined) payload.email = user.email ?? null;
  if (user.loginMethod !== undefined) payload.loginMethod = user.loginMethod ?? null;
  if (user.role !== undefined) payload.role = user.role;
  if (user.organizationId !== undefined) payload.organizationId = user.organizationId ?? null;
  if (user.lastSignedIn !== undefined) {
    payload.lastSignedIn = user.lastSignedIn instanceof Date
      ? user.lastSignedIn.toISOString()
      : new Date().toISOString();
  }
  const { data: existing } = await supabase.from("users").select("id").eq("openId", user.openId).maybeSingle();
  if (existing) {
    await supabase.from("users").update(payload).eq("openId", user.openId);
  } else {
    payload.createdAt = now;
    payload.lastSignedIn = payload.lastSignedIn ?? now;
    await supabase.from("users").insert(payload);
  }
}

export async function getAllUsers(orgId: number): Promise<Pick<User, "id" | "name" | "email" | "role" | "openId" | "createdAt">[]> {
  const { data } = await supabase
    .from("users")
    .select("id, name, email, role, openId, createdAt")
    .eq("organizationId", orgId)
    .order("name", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    name: (r.name as string) ?? null,
    email: (r.email as string) ?? null,
    role: (r.role as User["role"]) ?? "user",
    openId: r.openId as string,
    createdAt: toDate(r.createdAt as string),
  }));
}

export async function listUsers(orgId: number): Promise<User[]> {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("organizationId", orgId)
    .order("createdAt", { ascending: false });
  return (data ?? []).map((r: Record<string, unknown>) => mapUser(r));
}

export async function updateUserRole(id: number, role: "user" | "admin"): Promise<void> {
  await supabase.from("users").update({ role, updatedAt: new Date().toISOString() }).eq("id", id);
}

export async function updateUserProfile(id: number, name: string): Promise<User | null> {
  const { data } = await supabase
    .from("users")
    .update({ name, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (!data) return null;
  return mapUser(data as Record<string, unknown>);
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjectById(id: number): Promise<Project | null> {
  const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return mapProject(data as Record<string, unknown>);
}

export async function createProject(data: InsertProject): Promise<Project | null> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("projects")
    .insert({ ...data, createdAt: now, updatedAt: now })
    .select()
    .single();
  if (error || !row) return null;
  const project = mapProject(row as Record<string, unknown>);
  // Auto-add owner as member
  await supabase.from("project_members").insert({ projectId: project.id, userId: data.ownerId, joinedAt: now });
  return project;
}

export async function updateProject(id: number, data: Partial<InsertProject>): Promise<void> {
  await supabase.from("projects").update({ ...data, updatedAt: new Date().toISOString() }).eq("id", id);
}

export async function deleteProject(id: number): Promise<void> {
  await supabase.from("tasks").delete().eq("projectId", id);
  await supabase.from("project_members").delete().eq("projectId", id);
  await supabase.from("milestones").delete().eq("projectId", id);
  await supabase.from("projects").delete().eq("id", id);
}

export async function listProjectsByOwner(ownerId: number, orgId: number): Promise<Project[]> {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("ownerId", ownerId)
    .eq("organizationId", orgId)
    .order("createdAt", { ascending: false });
  return (data ?? []).map((r: Record<string, unknown>) => mapProject(r));
}

export async function listProjectsForUser(userId: number, orgId: number): Promise<Project[]> {
  const { data: owned } = await supabase.from("projects").select("*").eq("ownerId", userId).eq("organizationId", orgId);
  const { data: memberRows } = await supabase.from("project_members").select("projectId").eq("userId", userId);
  const memberIds = (memberRows ?? []).map((r: Record<string, unknown>) => r.projectId as number);
  let memberProjects: Project[] = [];
  if (memberIds.length > 0) {
    const { data: mProjects } = await supabase.from("projects").select("*").in("id", memberIds).eq("organizationId", orgId);
    memberProjects = (mProjects ?? []).map((r: Record<string, unknown>) => mapProject(r));
  }
  const ownedProjects = (owned ?? []).map((r: Record<string, unknown>) => mapProject(r));
  const ownedIds = new Set(ownedProjects.map((p) => p.id));
  return [...ownedProjects, ...memberProjects.filter((p) => !ownedIds.has(p.id))];
}

export async function listAllProjects(orgId: number): Promise<Project[]> {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("organizationId", orgId)
    .order("createdAt", { ascending: false });
  return (data ?? []).map((r: Record<string, unknown>) => mapProject(r));
}

// Aliases used by some routers
export const getProjectsForUser = listProjectsForUser;
export const getAllProjects = listAllProjects;

// ─── Project Members ──────────────────────────────────────────────────────────

export async function getProjectMembers(projectId: number): Promise<(ProjectMember & { user: User | null })[]> {
  const { data: members } = await supabase.from("project_members").select("*").eq("projectId", projectId);
  if (!members || members.length === 0) return [];
  const userIds = (members as Array<Record<string, unknown>>).map((m) => m.userId as number);
  const { data: userRows } = await supabase.from("users").select("*").in("id", userIds);
  const userMap = new Map((userRows ?? []).map((u: Record<string, unknown>) => [u.id as number, mapUser(u)]));
  return (members as Array<Record<string, unknown>>).map((m) => ({
    id: m.id as number,
    projectId: m.projectId as number,
    userId: m.userId as number,
    joinedAt: toDate(m.joinedAt as string),
    user: userMap.get(m.userId as number) ?? null,
  }));
}

export async function addProjectMember(data: InsertProjectMember): Promise<void> {
  const { data: existing } = await supabase.from("project_members").select("id").eq("projectId", data.projectId).eq("userId", data.userId).maybeSingle();
  if (existing) return;
  await supabase.from("project_members").insert({ ...data, joinedAt: new Date().toISOString() });
}

export async function removeProjectMember(projectId: number, userId: number): Promise<void> {
  await supabase.from("project_members").delete().eq("projectId", projectId).eq("userId", userId);
}

export async function isProjectMember(projectId: number, userId: number): Promise<boolean> {
  const { data: project } = await supabase.from("projects").select("ownerId").eq("id", projectId).maybeSingle();
  if (project && (project as Record<string, unknown>).ownerId === userId) return true;
  const { data } = await supabase.from("project_members").select("id").eq("projectId", projectId).eq("userId", userId).maybeSingle();
  return !!data;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getTaskById(id: number): Promise<Task | null> {
  const { data } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return mapTask(data as Record<string, unknown>);
}

export async function createTask(data: InsertTask): Promise<Task | null> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("tasks")
    .insert({ ...data, createdAt: now, updatedAt: now })
    .select()
    .single();
  if (error || !row) return null;
  return mapTask(row as Record<string, unknown>);
}

export async function updateTask(id: number, data: Partial<InsertTask>): Promise<void> {
  await supabase.from("tasks").update({ ...data, updatedAt: new Date().toISOString() }).eq("id", id);
}

export async function deleteTask(id: number): Promise<void> {
  await supabase.from("task_subtasks").delete().eq("taskId", id);
  await supabase.from("task_comments").delete().eq("taskId", id);
  await supabase.from("tasks").delete().eq("id", id);
}

export async function archiveTask(id: number): Promise<void> {
  await supabase.from("tasks").update({ archivedAt: Date.now(), updatedAt: new Date().toISOString() }).eq("id", id);
}

export async function restoreTask(id: number): Promise<void> {
  await supabase.from("tasks").update({ archivedAt: null, updatedAt: new Date().toISOString() }).eq("id", id);
}

export async function reorderTask(id: number, sortOrder: number): Promise<void> {
  await supabase.from("tasks").update({ sortOrder, updatedAt: new Date().toISOString() }).eq("id", id);
}

export async function listAllTasks(userId: number, isAdmin: boolean, orgId: number): Promise<Task[]> {
  if (isAdmin) {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("organizationId", orgId)
      .is("archivedAt", null)
      .order("sortOrder", { ascending: true });
    return (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
  }
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("organizationId", orgId)
    .is("archivedAt", null)
    .or(`creatorId.eq.${userId},assigneeId.eq.${userId}`)
    .order("sortOrder", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
}

export async function listArchivedTasks(userId: number, isAdmin: boolean, orgId: number): Promise<Task[]> {
  if (isAdmin) {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("organizationId", orgId)
      .not("archivedAt", "is", null)
      .order("archivedAt", { ascending: false });
    return (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
  }
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("organizationId", orgId)
    .not("archivedAt", "is", null)
    .or(`creatorId.eq.${userId},assigneeId.eq.${userId}`)
    .order("archivedAt", { ascending: false });
  return (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
}

export async function listTasksByProject(projectId: number): Promise<Task[]> {
  const { data } = await supabase.from("tasks").select("*").eq("projectId", projectId).is("archivedAt", null).order("sortOrder", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
}

// Alias
export const getTasksByProject = listTasksByProject;

export async function searchTasks(query: string, userId: number, isAdmin: boolean, orgId: number): Promise<Task[]> {
  if (isAdmin) {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("organizationId", orgId)
      .is("archivedAt", null)
      .ilike("title", `%${query}%`)
      .order("createdAt", { ascending: false })
      .limit(50);
    return (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
  }
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("organizationId", orgId)
    .is("archivedAt", null)
    .ilike("title", `%${query}%`)
    .or(`creatorId.eq.${userId},assigneeId.eq.${userId}`)
    .order("createdAt", { ascending: false })
    .limit(50);
  return (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
}

export async function bulkDeleteTasks(ids: number[], userId: number, isAdmin: boolean, orgId: number): Promise<number> {
  if (ids.length === 0) return 0;
  let query = supabase.from("tasks").select("id").in("id", ids).eq("organizationId", orgId);
  if (!isAdmin) {
    query = (query as any).or(`creatorId.eq.${userId},assigneeId.eq.${userId}`);
  }
  const { data: allowed } = await query;
  const allowedIds = (allowed ?? []).map((r: Record<string, unknown>) => r.id as number);
  if (allowedIds.length === 0) return 0;
  await supabase.from("task_subtasks").delete().in("taskId", allowedIds);
  await supabase.from("task_comments").delete().in("taskId", allowedIds);
  await supabase.from("tasks").delete().in("id", allowedIds);
  return allowedIds.length;
}

export function computeNextDueDate(
  currentDueDate: number,
  recurrenceType: RecurrenceType,
  recurrenceInterval: number
): number {
  const d = new Date(currentDueDate);
  switch (recurrenceType) {
    case "daily": d.setDate(d.getDate() + recurrenceInterval); break;
    case "weekly": d.setDate(d.getDate() + 7 * recurrenceInterval); break;
    case "biweekly": d.setDate(d.getDate() + 14 * recurrenceInterval); break;
    case "monthly": d.setMonth(d.getMonth() + recurrenceInterval); break;
    default: break;
  }
  return d.getTime();
}

export async function spawnNextRecurrence(task: Task): Promise<void> {
  if (task.recurrenceType === "none" || !task.dueDate) return;
  const nextDue = computeNextDueDate(task.dueDate, task.recurrenceType, task.recurrenceInterval);
  if (task.recurrenceEndsAt && nextDue > task.recurrenceEndsAt) return;
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("recurrenceParentId", task.id)
    .eq("dueDate", nextDue)
    .maybeSingle();
  if (existing) return;
  await createTask({
    title: task.title,
    description: task.description,
    notes: null,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    creatorId: task.creatorId,
    organizationId: task.organizationId,
    status: "todo",
    priority: task.priority,
    dueDate: nextDue,
    archivedAt: null,
    sortOrder: task.sortOrder,
    recurrenceType: task.recurrenceType,
    recurrenceInterval: task.recurrenceInterval,
    recurrenceEndsAt: task.recurrenceEndsAt,
    recurrenceParentId: task.id,
  });
}

// ─── Subtasks ─────────────────────────────────────────────────────────────────

export async function getSubtasksByTask(taskId: number): Promise<TaskSubtask[]> {
  const { data } = await supabase.from("task_subtasks").select("*").eq("taskId", taskId).order("position", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => mapSubtask(r));
}

export async function createSubtask(data: InsertTaskSubtask): Promise<TaskSubtask | null> {
  const { data: row, error } = await supabase
    .from("task_subtasks")
    .insert({ ...data, createdAt: new Date().toISOString() })
    .select()
    .single();
  if (error || !row) return null;
  return mapSubtask(row as Record<string, unknown>);
}

export async function toggleSubtask(id: number, completed: boolean): Promise<void> {
  await supabase.from("task_subtasks").update({ completed }).eq("id", id);
}

export async function deleteSubtask(id: number): Promise<void> {
  await supabase.from("task_subtasks").delete().eq("id", id);
}

export async function getSubtaskById(id: number): Promise<TaskSubtask | null> {
  const { data } = await supabase.from("task_subtasks").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return mapSubtask(data as Record<string, unknown>);
}

export async function getSubtaskCountsByTasks(taskIds: number[]): Promise<Map<number, { total: number; done: number }>> {
  const result = new Map<number, { total: number; done: number }>();
  if (taskIds.length === 0) return result;
  const { data } = await supabase.from("task_subtasks").select("taskId, completed").in("taskId", taskIds);
  for (const row of (data ?? []) as Array<{ taskId: number; completed: boolean }>) {
    const entry = result.get(row.taskId) ?? { total: 0, done: 0 };
    entry.total++;
    if (row.completed) entry.done++;
    result.set(row.taskId, entry);
  }
  return result;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getCommentsByTask(taskId: number): Promise<(TaskComment & { author: User | null })[]> {
  const { data: comments } = await supabase.from("task_comments").select("*").eq("taskId", taskId).order("createdAt", { ascending: true });
  if (!comments || comments.length === 0) return [];
  const authorIds = Array.from(new Set((comments as Array<Record<string, unknown>>).map((c) => c.authorId as number)));
  const { data: userRows } = await supabase.from("users").select("*").in("id", authorIds);
  const userMap = new Map((userRows ?? []).map((u: Record<string, unknown>) => [u.id as number, mapUser(u)]));
  return (comments as Array<Record<string, unknown>>).map((c) => ({
    ...mapComment(c),
    author: userMap.get(c.authorId as number) ?? null,
  }));
}

export async function createComment(data: InsertTaskComment): Promise<TaskComment | null> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("task_comments")
    .insert({ ...data, createdAt: now, updatedAt: now })
    .select()
    .single();
  if (error || !row) return null;
  return mapComment(row as Record<string, unknown>);
}

export async function deleteComment(id: number): Promise<void> {
  await supabase.from("task_comments").delete().eq("id", id);
}

export async function getCommentById(id: number): Promise<TaskComment | null> {
  const { data } = await supabase.from("task_comments").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return mapComment(data as Record<string, unknown>);
}

export async function createActivityEntry(taskId: number, authorId: number, content: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("task_comments").insert({ taskId, authorId, content, isActivity: true, createdAt: now, updatedAt: now });
}

export async function getCommentCountsByTasks(taskIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (taskIds.length === 0) return result;
  const { data } = await supabase.from("task_comments").select("taskId").in("taskId", taskIds).eq("isActivity", false);
  for (const row of (data ?? []) as Array<{ taskId: number }>) {
    result.set(row.taskId, (result.get(row.taskId) ?? 0) + 1);
  }
  return result;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(userId: number, isAdmin: boolean, orgId: number): Promise<{
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  totalProjects: number;
}> {
  const allTasks = await listAllTasks(userId, isAdmin, orgId);
  const now = Date.now();
  return {
    totalTasks: allTasks.length,
    doneTasks: allTasks.filter((t) => t.status === "done").length,
    inProgressTasks: allTasks.filter((t) => t.status === "in_progress").length,
    overdueTasks: allTasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < now).length,
    totalProjects: isAdmin
      ? (await listAllProjects(orgId)).length
      : (await listProjectsForUser(userId, orgId)).length,
  };
}

export async function getProjectTaskCounts(projectIds: number[]): Promise<Record<number, { total: number; done: number }>> {
  const result: Record<number, { total: number; done: number }> = {};
  if (projectIds.length === 0) return result;
  const { data } = await supabase.from("tasks").select("projectId, status").in("projectId", projectIds).is("archivedAt", null);
  for (const row of (data ?? []) as Array<{ projectId: number; status: string }>) {
    if (!result[row.projectId]) result[row.projectId] = { total: 0, done: 0 };
    result[row.projectId].total++;
    if (row.status === "done") result[row.projectId].done++;
  }
  return result;
}

// ─── System Settings ──────────────────────────────────────────────────────────

export async function getSystemSetting(key: string, orgId: number): Promise<string | null> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("organizationId", orgId)
    .eq("key", key)
    .maybeSingle();
  return data ? (data as Record<string, unknown>).value as string : null;
}

export async function setSystemSetting(key: string, value: string, orgId: number): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("system_settings")
    .select("key")
    .eq("organizationId", orgId)
    .eq("key", key)
    .maybeSingle();
  if (existing) {
    await supabase.from("system_settings").update({ value, updatedAt: now }).eq("organizationId", orgId).eq("key", key);
  } else {
    await supabase.from("system_settings").insert({ organizationId: orgId, key, value, updatedAt: now });
  }
}

// ─── Overdue / Due-Soon Tasks ─────────────────────────────────────────────────

export async function getOverdueTasks(orgId: number): Promise<Array<{ task: Task; assignee: User | null; project: Project | null }>> {
  const now = Date.now();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("organizationId", orgId)
    .is("archivedAt", null)
    .neq("status", "done")
    .not("dueDate", "is", null)
    .lt("dueDate", now);
  const taskRows = (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
  return _enrichTasksWithAssigneeAndProject(taskRows);
}

export async function getTasksDueSoon(windowMs = 24 * 60 * 60 * 1000, orgId: number): Promise<Array<{ task: Task; assignee: User | null; project: Project | null }>> {
  const now = Date.now();
  const soon = now + windowMs;
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("organizationId", orgId)
    .is("archivedAt", null)
    .neq("status", "done")
    .gte("dueDate", now)
    .lte("dueDate", soon);
  const taskRows = (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
  return _enrichTasksWithAssigneeAndProject(taskRows);
}

async function _enrichTasksWithAssigneeAndProject(taskRows: Task[]) {
  const assigneeIds = Array.from(new Set(taskRows.filter((t) => t.assigneeId).map((t) => t.assigneeId as number)));
  const projectIds = Array.from(new Set(taskRows.filter((t) => t.projectId).map((t) => t.projectId as number)));
  const userMap = new Map<number, User>();
  if (assigneeIds.length > 0) {
    const { data: users } = await supabase.from("users").select("*").in("id", assigneeIds);
    (users ?? []).forEach((u: Record<string, unknown>) => userMap.set(u.id as number, mapUser(u)));
  }
  const projectMap = new Map<number, Project>();
  if (projectIds.length > 0) {
    const { data: projects } = await supabase.from("projects").select("*").in("id", projectIds);
    (projects ?? []).forEach((p: Record<string, unknown>) => projectMap.set(p.id as number, mapProject(p)));
  }
  return taskRows.map((task) => ({
    task,
    assignee: task.assigneeId ? (userMap.get(task.assigneeId) ?? null) : null,
    project: task.projectId ? (projectMap.get(task.projectId) ?? null) : null,
  }));
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export async function getTasksForCalendar(
  userId: number,
  isAdmin: boolean,
  orgId: number,
): Promise<Array<Task & { projectName: string; assigneeName: string | null }>> {
  let taskRows: Task[];
  if (isAdmin) {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("organizationId", orgId)
      .is("archivedAt", null)
      .not("dueDate", "is", null);
    taskRows = (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
  } else {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("organizationId", orgId)
      .is("archivedAt", null)
      .not("dueDate", "is", null)
      .or(`creatorId.eq.${userId},assigneeId.eq.${userId}`);
    taskRows = (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
  }
  if (taskRows.length === 0) return [];

  const projectIds = [...new Set(taskRows.filter((t) => t.projectId).map((t) => t.projectId as number))];
  const assigneeIds = [...new Set(taskRows.filter((t) => t.assigneeId).map((t) => t.assigneeId as number))];

  const [projectRes, userRes] = await Promise.all([
    projectIds.length ? supabase.from("projects").select("id, name").in("id", projectIds) : Promise.resolve({ data: [] }),
    assigneeIds.length ? supabase.from("users").select("id, name").in("id", assigneeIds) : Promise.resolve({ data: [] }),
  ]);

  const projectNameMap = new Map((projectRes.data ?? []).map((p: any) => [p.id as number, p.name as string]));
  const userNameMap = new Map((userRes.data ?? []).map((u: any) => [u.id as number, u.name as string | null]));

  return taskRows.map((t) => ({
    ...t,
    projectName: t.projectId ? (projectNameMap.get(t.projectId) ?? "Unknown Project") : "No Project",
    assigneeName: t.assigneeId ? (userNameMap.get(t.assigneeId) ?? null) : null,
  }));
}

export async function getMilestonesForCalendar(userId: number, isAdmin: boolean, orgId: number): Promise<Array<Milestone & { projectName: string }>> {
  let projectNameMap: Map<number, string>;
  let projectIds: number[];
  if (isAdmin) {
    const { data } = await supabase.from("projects").select("id, name").eq("organizationId", orgId);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    projectIds = rows.map((r) => r.id as number);
    projectNameMap = new Map(rows.map((r) => [r.id as number, r.name as string]));
  } else {
    const projects = await listProjectsForUser(userId, orgId);
    projectIds = projects.map((p) => p.id);
    projectNameMap = new Map(projects.map((p) => [p.id, p.name]));
  }
  if (projectIds.length === 0) return [];
  const { data: milestoneRows } = await supabase.from("milestones").select("*").in("projectId", projectIds).not("dueDate", "is", null);
  if (!milestoneRows || milestoneRows.length === 0) return [];
  return (milestoneRows as Array<Record<string, unknown>>).map((m) => ({
    ...mapMilestone(m),
    projectName: projectNameMap.get(m.projectId as number) ?? "Unknown Project",
  }));
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export async function getMilestonesByProject(projectId: number): Promise<Milestone[]> {
  const { data } = await supabase.from("milestones").select("*").eq("projectId", projectId).order("dueDate", { ascending: true, nullsFirst: false }).order("sortOrder", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => mapMilestone(r));
}

export async function createMilestone(data: InsertMilestone): Promise<Milestone | null> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("milestones")
    .insert({ ...data, createdAt: now, updatedAt: now })
    .select()
    .single();
  if (error || !row) return null;
  return mapMilestone(row as Record<string, unknown>);
}

export async function updateMilestone(id: number, data: Partial<InsertMilestone>): Promise<void> {
  await supabase.from("milestones").update({ ...data, updatedAt: new Date().toISOString() }).eq("id", id);
}

export async function toggleMilestone(id: number, completed: boolean): Promise<void> {
  await supabase.from("milestones").update({
    completedAt: completed ? Date.now() : null,
    updatedAt: new Date().toISOString(),
  }).eq("id", id);
}

export async function deleteMilestone(id: number): Promise<void> {
  await supabase.from("milestones").delete().eq("id", id);
}

export async function getMilestoneById(id: number): Promise<Milestone | null> {
  const { data } = await supabase.from("milestones").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return mapMilestone(data as Record<string, unknown>);
}

// ─── Projects with stats ──────────────────────────────────────────────────────

async function _enrichProjectsWithStats(projectList: Project[]) {
  if (projectList.length === 0) return [];
  const projectIds = projectList.map((p) => p.id);
  const ownerIds = Array.from(new Set(projectList.map((p) => p.ownerId)));
  const { data: ownerRows } = await supabase.from("users").select("*").in("id", ownerIds);
  const ownerMap = new Map((ownerRows ?? []).map((u: Record<string, unknown>) => [u.id as number, mapUser(u)]));
  const taskCounts = await getProjectTaskCounts(projectIds);
  const { data: milestoneRows } = await supabase.from("milestones").select("id, projectId, title, completedAt, dueDate").in("projectId", projectIds).order("dueDate", { ascending: true, nullsFirst: false }).order("sortOrder", { ascending: true });
  const now = Date.now();
  const milestoneMap = new Map<number, { total: number; done: number; overdue: number; preview: Array<{ id: number; title: string; completedAt: number | null; dueDate: number | null }> }>();
  for (const m of (milestoneRows ?? []) as Array<{ id: number; projectId: number; title: string; completedAt: number | null; dueDate: number | null }>) {
    if (!milestoneMap.has(m.projectId)) milestoneMap.set(m.projectId, { total: 0, done: 0, overdue: 0, preview: [] });
    const entry = milestoneMap.get(m.projectId)!;
    entry.total++;
    if (m.completedAt) entry.done++;
    if (!m.completedAt && m.dueDate && m.dueDate < now) entry.overdue++;
    entry.preview.push({ id: m.id, title: m.title, completedAt: m.completedAt, dueDate: m.dueDate });
  }
  return projectList.map((p) => {
    const tc = taskCounts[p.id] ?? { total: 0, done: 0 };
    const mc = milestoneMap.get(p.id) ?? { total: 0, done: 0, overdue: 0, preview: [] };
    return {
      ...p,
      owner: ownerMap.get(p.ownerId) ?? null,
      taskTotal: tc.total,
      taskDone: tc.done,
      milestoneTotal: mc.total,
      milestoneDone: mc.done,
      milestoneOverdue: mc.overdue,
      milestonePreview: mc.preview,
    };
  });
}

export async function getAllProjectsWithOwner(orgId: number) {
  const projects = await listAllProjects(orgId);
  return _enrichProjectsWithStats(projects);
}

export async function getProjectsForUserWithOwner(userId: number, orgId: number) {
  const userProjects = await listProjectsForUser(userId, orgId);
  return _enrichProjectsWithStats(userProjects);
}

// ─── Strategic Organizer ──────────────────────────────────────────────────────

export async function getStrategicOrganizer(orgId: number): Promise<StrategicOrganizer | null> {
  const { data } = await supabase.from("strategic_organizer").select("*").eq("organizationId", orgId).maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: r.id as number,
    organizationId: r.organizationId as number,
    ownerId: r.ownerId as number,
    schoolName: (r.schoolName as string) ?? null,
    mission: (r.mission as string) ?? null,
    values: (r.values as string) ?? null,
    idealCustomerProfile: (r.idealCustomerProfile as string) ?? null,
    bhag: (r.bhag as string) ?? null,
    threeYearVisual: (r.threeYearVisual as string) ?? null,
    oneYearGoal: (r.oneYearGoal as string) ?? null,
    ninetyDayProject: (r.ninetyDayProject as string) ?? null,
    parkingLot: (r.parkingLot as string) ?? null,
    focusOfTheYear: (r.focusOfTheYear as string) ?? null,
    createdAt: toDate(r.createdAt as string),
    updatedAt: toDate(r.updatedAt as string),
  };
}

export async function upsertStrategicOrganizer(data: InsertStrategicOrganizer): Promise<StrategicOrganizer | null> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase.from("strategic_organizer").select("id").eq("organizationId", data.organizationId).maybeSingle();
  if (existing) {
    await supabase.from("strategic_organizer").update({ ...data, updatedAt: now }).eq("organizationId", data.organizationId);
  } else {
    await supabase.from("strategic_organizer").insert({ ...data, createdAt: now, updatedAt: now });
  }
  return getStrategicOrganizer(data.organizationId);
}

export async function saveStrategicOrganizerVersion(data: { organizationId: number; ownerId: number; label?: string; snapshotJson: string }): Promise<StrategicOrganizerVersion | null> {
  const { data: row, error } = await supabase
    .from("strategic_organizer_versions")
    .insert({ ...data, createdAt: new Date().toISOString() })
    .select()
    .single();
  if (error || !row) return null;
  const r = row as Record<string, unknown>;
  return { id: r.id as number, organizationId: r.organizationId as number, ownerId: r.ownerId as number, label: (r.label as string) ?? null, snapshotJson: r.snapshotJson as string, createdAt: toDate(r.createdAt as string) };
}

export async function listStrategicOrganizerVersions(orgId: number): Promise<StrategicOrganizerVersion[]> {
  const { data } = await supabase
    .from("strategic_organizer_versions")
    .select("*")
    .eq("organizationId", orgId)
    .order("createdAt", { ascending: false });
  return (data ?? []).map((r: Record<string, unknown>) => ({ id: r.id as number, organizationId: r.organizationId as number, ownerId: r.ownerId as number, label: (r.label as string) ?? null, snapshotJson: r.snapshotJson as string, createdAt: toDate(r.createdAt as string) }));
}

export async function getStrategicOrganizerVersion(id: number): Promise<StrategicOrganizerVersion | null> {
  const { data } = await supabase.from("strategic_organizer_versions").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return { id: r.id as number, organizationId: r.organizationId as number, ownerId: r.ownerId as number, label: (r.label as string) ?? null, snapshotJson: r.snapshotJson as string, createdAt: toDate(r.createdAt as string) };
}

export async function deleteStrategicOrganizerVersion(id: number): Promise<void> {
  await supabase.from("strategic_organizer_versions").delete().eq("id", id);
}

// ─── Project Health Snapshots ─────────────────────────────────────────────────

export async function saveProjectHealthSnapshot(data: {
  organizationId: number;
  snapshotDate: number;
  onTrack: number;
  offTrack: number;
  assist: number;
  complete: number;
  totalMilestones: number;
  doneMilestones: number;
}): Promise<void> {
  await supabase.from("project_health_snapshots").insert({ ...data, createdAt: new Date().toISOString() });
}

export async function getProjectHealthTrend(limit = 8, orgId: number): Promise<ProjectHealthSnapshot[]> {
  const { data } = await supabase
    .from("project_health_snapshots")
    .select("*")
    .eq("organizationId", orgId)
    .order("snapshotDate", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    organizationId: r.organizationId as number,
    snapshotDate: r.snapshotDate as number,
    onTrack: r.onTrack as number,
    offTrack: r.offTrack as number,
    assist: r.assist as number,
    complete: r.complete as number,
    totalMilestones: r.totalMilestones as number,
    doneMilestones: r.doneMilestones as number,
    createdAt: toDate(r.createdAt as string),
  }));
}

// ─── Project Comments ─────────────────────────────────────────────────────────

export async function getProjectComments(projectId: number): Promise<Array<ProjectComment & { author: User | null }>> {
  const { data: comments } = await supabase.from("project_comments").select("*").eq("projectId", projectId).order("createdAt", { ascending: true });
  if (!comments || comments.length === 0) return [];
  const authorIds = Array.from(new Set((comments as Array<Record<string, unknown>>).map((c) => c.authorId as number)));
  const { data: userRows } = await supabase.from("users").select("*").in("id", authorIds);
  const userMap = new Map((userRows ?? []).map((u: Record<string, unknown>) => [u.id as number, mapUser(u)]));
  return (comments as Array<Record<string, unknown>>).map((c) => ({
    ...mapProjectComment(c),
    author: userMap.get(c.authorId as number) ?? null,
  }));
}

export async function createProjectComment(data: InsertProjectComment): Promise<ProjectComment | null> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase.from("project_comments").insert({ ...data, createdAt: now, updatedAt: now }).select().single();
  if (error || !row) return null;
  return mapProjectComment(row as Record<string, unknown>);
}

export async function deleteProjectComment(id: number): Promise<void> {
  await supabase.from("project_comments").delete().eq("id", id);
}

export async function getProjectCommentById(id: number): Promise<ProjectComment | null> {
  const { data } = await supabase.from("project_comments").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return mapProjectComment(data as Record<string, unknown>);
}

// ─── Announcements ────────────────────────────────────────────────────────────

export async function listAnnouncements(orgId: number): Promise<Announcement[]> {
  const now = Date.now();
  const { data } = await supabase
    .from("announcements")
    .select("*")
    .eq("organizationId", orgId)
    .order("isPinned", { ascending: false })
    .order("createdAt", { ascending: false });
  return (data ?? []).map((r: Record<string, unknown>) => mapAnnouncement(r)).filter((a) => !a.expiresAt || a.expiresAt > now);
}

export async function createAnnouncement(data: { organizationId: number; title: string; body: string; isPinned: boolean; authorId: number; expiresAt?: number | null }): Promise<Announcement | null> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase.from("announcements").insert({ ...data, createdAt: now, updatedAt: now }).select().single();
  if (error || !row) return null;
  return mapAnnouncement(row as Record<string, unknown>);
}

export async function updateAnnouncement(id: number, data: { title?: string; body?: string; isPinned?: boolean; expiresAt?: number | null }): Promise<void> {
  const { error } = await supabase.from("announcements").update({ ...data, updatedAt: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAnnouncement(id: number): Promise<void> {
  await supabase.from("announcements").delete().eq("id", id);
}

// ─── Member Scorecard ─────────────────────────────────────────────────────────

export async function getUserScorecard(targetUserId: number, orgId: number) {
  const targetUser = await getUserById(targetUserId);
  if (!targetUser) return null;
  const ownedProjects = await listProjectsByOwner(targetUserId, orgId);
  const { data: memberRows } = await supabase.from("project_members").select("projectId").eq("userId", targetUserId);
  const memberProjectIds = (memberRows ?? []).map((r: Record<string, unknown>) => r.projectId as number);
  let memberProjects: Project[] = [];
  if (memberProjectIds.length > 0) {
    const { data: mProjects } = await supabase.from("projects").select("*").in("id", memberProjectIds).eq("organizationId", orgId);
    memberProjects = (mProjects ?? []).map((r: Record<string, unknown>) => mapProject(r));
  }
  const ownedIds = new Set(ownedProjects.map((r) => r.id));
  const allProjects = [...ownedProjects, ...memberProjects.filter((r) => !ownedIds.has(r.id))];
  const userTasks = await listAllTasks(targetUserId, false, orgId);
  const now = Date.now();
  const totalTasks = userTasks.length;
  const doneTasks = userTasks.filter((t) => t.status === "done").length;
  const overdueTasks = userTasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < now).length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null;
  let milestoneOnTimeRate: number | null = null;
  if (ownedProjects.length > 0) {
    const { data: projectMilestones } = await supabase.from("milestones").select("*").in("projectId", ownedProjects.map((r) => r.id));
    const completedMilestones = (projectMilestones ?? []).filter((m: Record<string, unknown>) => m.completedAt != null);
    const onTime = completedMilestones.filter((m: Record<string, unknown>) => !m.dueDate || (m.completedAt != null && (m.completedAt as number) <= (m.dueDate as number))).length;
    if (completedMilestones.length > 0) {
      milestoneOnTimeRate = Math.round((onTime / completedMilestones.length) * 100);
    }
  }
  const { data: recentActivityRows } = await supabase.from("tasks").select("*").eq("assigneeId", targetUserId).eq("organizationId", orgId).order("updatedAt", { ascending: false }).limit(10);
  const recentActivity = (recentActivityRows ?? []).map((r: Record<string, unknown>) => mapTask(r));
  return {
    user: targetUser,
    projects: allProjects,
    stats: {
      totalTasks,
      doneTasks,
      overdueTasks,
      taskCompletionRate,
      milestoneOnTimeRate,
      totalProjects: allProjects.length,
      ownedProjects: ownedProjects.length,
      completeProjects: allProjects.filter((r) => r.projectStatus === "complete").length,
      onTrackProjects: allProjects.filter((r) => r.projectStatus === "on_track").length,
    },
    recentActivity,
  };
}

// ─── Invites ──────────────────────────────────────────────────────────────────

function mapInvite(row: Record<string, unknown>): Invite {
  return {
    id: row.id as number,
    organizationId: row.organizationId as number,
    email: row.email as string,
    role: (row.role as Invite["role"]) ?? "user",
    invitedBy: row.invitedBy as number,
    acceptedAt: row.acceptedAt ? new Date(row.acceptedAt as string) : null,
    createdAt: toDate(row.createdAt as string),
  };
}

export async function createInvite(data: InsertInvite): Promise<Invite | null> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("invites")
    .insert({ ...data, createdAt: now })
    .select()
    .single();
  if (error || !row) return null;
  return mapInvite(row as Record<string, unknown>);
}

export async function listInvites(orgId: number): Promise<Invite[]> {
  const { data } = await supabase
    .from("invites")
    .select("*")
    .eq("organizationId", orgId)
    .is("acceptedAt", null)
    .order("createdAt", { ascending: false });
  return (data ?? []).map((r: Record<string, unknown>) => mapInvite(r));
}

export async function markInviteAccepted(email: string, orgId: number): Promise<void> {
  await supabase
    .from("invites")
    .update({ acceptedAt: new Date().toISOString() })
    .eq("email", email)
    .eq("organizationId", orgId)
    .is("acceptedAt", null);
}

export async function deleteInvite(id: number): Promise<void> {
  await supabase.from("invites").delete().eq("id", id);
}

// ── Invite Links ──────────────────────────────────────────────────────────────
export async function createInviteLink(data: { organizationId: number; role: "user" | "admin"; invitedBy: number; expiresAt?: number | null }): Promise<any> {
  const { data: row, error } = await supabase
    .from("invite_links")
    .insert({ organizationId: data.organizationId, role: data.role, invitedBy: data.invitedBy, expiresAt: data.expiresAt ?? null, createdAt: Date.now() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function getInviteLink(token: string): Promise<any | null> {
  const { data } = await supabase
    .from("invite_links")
    .select("*, organizations(name, slug)")
    .eq("token", token)
    .single();
  return data ?? null;
}

export async function markInviteLinkUsed(token: string, email: string): Promise<void> {
  await supabase.from("invite_links").update({ usedAt: Date.now(), usedByEmail: email }).eq("token", token);
}

export async function listInviteLinks(orgId: number): Promise<any[]> {
  const { data } = await supabase
    .from("invite_links")
    .select("*")
    .eq("organizationId", orgId)
    .is("usedAt", null)
    .order("createdAt", { ascending: false });
  return data ?? [];
}

export async function deleteInviteLink(id: number): Promise<void> {
  await supabase.from("invite_links").delete().eq("id", id);
}
