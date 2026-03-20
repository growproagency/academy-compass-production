-- Create enums
CREATE TYPE "role" AS ENUM ('user', 'admin', 'superadmin');
CREATE TYPE "rockStatus" AS ENUM ('on_track', 'off_track', 'assist', 'complete');
CREATE TYPE "status" AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE "priority" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "recurrenceType" AS ENUM ('none', 'daily', 'biweekly', 'weekly', 'monthly');

-- ─── Organizations ─────────────────────────────────────────────────────────────
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(63) NOT NULL UNIQUE,
	"brandPrimaryColor" varchar(32),
	"brandAccentColor" varchar(32),
	"logoUrl" text,
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- ─── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL UNIQUE,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" NOT NULL DEFAULT 'user',
	"organizationId" integer REFERENCES "organizations"("id") ON DELETE SET NULL,
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now(),
	"lastSignedIn" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- ─── Projects ──────────────────────────────────────────────────────────────────
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"ownerId" integer NOT NULL,
	"organizationId" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"dueDate" bigint,
	"rockStatus" "rockStatus" NOT NULL DEFAULT 'on_track',
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");
CREATE INDEX "projects_organizationId_idx" ON "projects"("organizationId");

-- ─── Project Members ───────────────────────────────────────────────────────────
CREATE TABLE "project_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"userId" integer NOT NULL,
	"joinedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "project_members_projectId_idx" ON "project_members"("projectId");
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- ─── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"notes" text,
	"projectId" integer,
	"assigneeId" integer,
	"creatorId" integer NOT NULL,
	"organizationId" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"status" "status" NOT NULL DEFAULT 'todo',
	"priority" "priority" NOT NULL DEFAULT 'medium',
	"dueDate" bigint,
	"archivedAt" bigint,
	"sortOrder" integer NOT NULL DEFAULT 0,
	"recurrenceType" "recurrenceType" NOT NULL DEFAULT 'none',
	"recurrenceInterval" integer NOT NULL DEFAULT 1,
	"recurrenceEndsAt" bigint,
	"recurrenceParentId" integer,
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");
CREATE INDEX "tasks_creatorId_idx" ON "tasks"("creatorId");
CREATE INDEX "tasks_assigneeId_idx" ON "tasks"("assigneeId");
CREATE INDEX "tasks_organizationId_idx" ON "tasks"("organizationId");

-- ─── Task Subtasks ─────────────────────────────────────────────────────────────
CREATE TABLE "task_subtasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"taskId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"completed" boolean NOT NULL DEFAULT false,
	"position" integer NOT NULL DEFAULT 0,
	"createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "task_subtasks_taskId_idx" ON "task_subtasks"("taskId");

-- ─── Task Comments ─────────────────────────────────────────────────────────────
CREATE TABLE "task_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"taskId" integer NOT NULL,
	"authorId" integer NOT NULL,
	"content" text NOT NULL,
	"isActivity" boolean NOT NULL DEFAULT false,
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "task_comments_taskId_idx" ON "task_comments"("taskId");
CREATE INDEX "task_comments_authorId_idx" ON "task_comments"("authorId");

-- ─── System Settings ───────────────────────────────────────────────────────────
-- Now composite PK: (organizationId, key)
CREATE TABLE "system_settings" (
	"organizationId" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"key" varchar(128) NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp NOT NULL DEFAULT now(),
	PRIMARY KEY ("organizationId", "key")
);

-- ─── Milestones ────────────────────────────────────────────────────────────────
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"dueDate" bigint,
	"completedAt" bigint,
	"sortOrder" integer NOT NULL DEFAULT 0,
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "milestones_projectId_idx" ON "milestones"("projectId");

-- ─── Strategic Organizer ───────────────────────────────────────────────────────
-- One per organization (organizationId UNIQUE)
-- ownerId tracks the last admin who saved it
CREATE TABLE "strategic_organizer" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
	"ownerId" integer NOT NULL,
	"schoolName" varchar(255),
	"mission" text,
	"values" text,
	"idealCustomerProfile" text,
	"bhag" text,
	"threeYearVisual" text,
	"oneYearGoal" text,
	"ninetyDayProject" text,
	"parkingLot" text,
	"focusOfTheYear" text,
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "strategic_organizer_organizationId_idx" ON "strategic_organizer"("organizationId");

-- ─── Strategic Organizer Versions ─────────────────────────────────────────────
CREATE TABLE "strategic_organizer_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"ownerId" integer NOT NULL,
	"label" varchar(255),
	"snapshotJson" text NOT NULL,
	"createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "strategic_organizer_versions_organizationId_idx" ON "strategic_organizer_versions"("organizationId");

-- ─── Rock Health Snapshots ─────────────────────────────────────────────────────
CREATE TABLE "rock_health_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"snapshotDate" bigint NOT NULL,
	"onTrack" integer NOT NULL DEFAULT 0,
	"offTrack" integer NOT NULL DEFAULT 0,
	"assist" integer NOT NULL DEFAULT 0,
	"complete" integer NOT NULL DEFAULT 0,
	"totalMilestones" integer NOT NULL DEFAULT 0,
	"doneMilestones" integer NOT NULL DEFAULT 0,
	"createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "rock_health_snapshots_organizationId_idx" ON "rock_health_snapshots"("organizationId");

-- ─── Announcements ─────────────────────────────────────────────────────────────
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"isPinned" boolean NOT NULL DEFAULT false,
	"authorId" integer NOT NULL,
	"expiresAt" bigint,
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "announcements_organizationId_idx" ON "announcements"("organizationId");

-- ─── Rock Comments ─────────────────────────────────────────────────────────────
CREATE TABLE "rock_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"authorId" integer NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "rock_comments_projectId_idx" ON "rock_comments"("projectId");
CREATE INDEX "rock_comments_authorId_idx" ON "rock_comments"("authorId");
