import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Flag,
  RefreshCw,
  User,
} from "lucide-react";
import { useMemo, useState } from "react";

// --- Types -------------------------------------------------------------------
type CalTask = {
  id: number;
  title: string;
  status: string;
  priority: string | null;
  dueDate: number | null;
  projectId: number | null;
  projectName: string;
  assigneeId: number | null;
  assigneeName: string | null;
  recurrenceType: string | null;
  kind: "todo";
};

type CalMilestone = {
  id: number;
  title: string;
  dueDate: number | null;
  completedAt: number | null;
  projectId: number | null;
  projectName: string;
  kind: "milestone";
};

type CalEvent = CalTask | CalMilestone;

type CalendarView = "weekly" | "monthly";

// --- Constants ---------------------------------------------------------------
const STATUS_ICON: Record<string, React.ReactNode> = {
  todo: <Circle className="h-3 w-3 text-muted-foreground shrink-0" />,
  in_progress: <Clock className="h-3 w-3 text-blue-500 shrink-0" />,
  done: <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />,
};

const PRIORITY_CHIP: Record<string, string> = {
  high: "bg-red-50 border-red-200 text-red-800",
  medium: "bg-amber-50 border-amber-200 text-amber-800",
  low: "bg-green-50 border-green-200 text-green-800",
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-green-500",
};

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_MONTH = 3;

// --- Event chip helpers -------------------------------------------------------
function isMilestoneCompleted(m: CalMilestone) {
  return m.completedAt !== null;
}

function isTaskOverdue(t: CalTask) {
  return t.dueDate !== null && t.dueDate < Date.now() && t.status !== "done";
}

function isMilestoneOverdue(m: CalMilestone) {
  return m.dueDate !== null && m.dueDate < Date.now() && m.completedAt === null;
}

// Chip for a single event in the calendar cell
function EventChip({
  event,
  onClick,
  compact = false,
}: {
  event: CalEvent;
  onClick: () => void;
  compact?: boolean;
}) {
  if (event.kind === "milestone") {
    const completed = isMilestoneCompleted(event);
    const overdue = isMilestoneOverdue(event);
    return (
      <button
        onClick={onClick}
        className={`w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition-all hover:opacity-80 cursor-pointer ${
          completed
            ? "bg-violet-100 text-violet-700"
            : overdue
            ? "bg-red-100 text-red-700"
            : "bg-indigo-100 text-indigo-700"
        }`}
      >
        <Flag className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{event.title}</span>
      </button>
    );
  }

  // To-Do chip
  const overdue = isTaskOverdue(event);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition-all hover:opacity-80 cursor-pointer ${
        event.status === "done"
          ? "bg-emerald-100 text-emerald-700"
          : overdue
          ? "bg-red-100 text-red-700"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      {event.priority && !compact && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            PRIORITY_DOT[event.priority] ?? "bg-slate-400"
          }`}
        />
      )}
      <span className="truncate">{event.title}</span>
    </button>
  );
}

// --- Event Detail Sheet -------------------------------------------------------
function EventDetailSheet({
  event,
  onClose,
}: {
  event: CalEvent | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!event} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:w-96">
        {event && event.kind === "todo" && (
          <>
            <SheetHeader className="mb-5">
              <SheetTitle className="text-base leading-snug pr-6">{event.title}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                {STATUS_ICON[event.status] ?? STATUS_ICON.todo}
                <span className="capitalize text-muted-foreground">
                  {event.status.replace("_", " ")}
                </span>
              </div>
              {event.priority && (
                <Badge
                  variant="outline"
                  className={`capitalize text-xs ${PRIORITY_CHIP[event.priority] ?? ""}`}
                >
                  {event.priority} priority
                </Badge>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>
                  {event.dueDate
                    ? format(new Date(event.dueDate), "EEEE, MMMM d, yyyy")
                    : "No due date"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 shrink-0" />
                <span>{event.assigneeName ?? "Unassigned"}</span>
              </div>
              {event.recurrenceType && event.recurrenceType !== "none" && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  <span className="capitalize">{event.recurrenceType} recurring</span>
                </div>
              )}
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Rock</p>
                <p className="font-medium text-foreground">{event.projectName}</p>
              </div>
            </div>
          </>
        )}
        {event && event.kind === "milestone" && (
          <>
            <SheetHeader className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <Flag className="h-4 w-4 text-indigo-500 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                  Milestone
                </span>
              </div>
              <SheetTitle className="text-base leading-snug pr-6">{event.title}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                {event.completedAt ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : isMilestoneOverdue(event) ? (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="capitalize text-muted-foreground">
                  {event.completedAt
                    ? "Completed"
                    : isMilestoneOverdue(event)
                    ? "Overdue"
                    : "Pending"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>{event.dueDate ? format(new Date(event.dueDate), "EEEE, MMMM d, yyyy") : "No due date"}</span>
              </div>
              {event.completedAt && (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Completed {format(new Date(event.completedAt), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Rock</p>
                <p className="font-medium text-foreground">{event.projectName}</p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// --- Weekly View -------------------------------------------------------------
function WeeklyView({
  events,
  onSelectEvent,
}: {
  events: CalEvent[];
  onSelectEvent: (e: CalEvent) => void;
}) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    weekDays.forEach((d) => map.set(format(d, "yyyy-MM-dd"), []));
    events.forEach((ev) => {
      if (!ev.dueDate) return;
      const key = format(new Date(ev.dueDate), "yyyy-MM-dd");
      if (map.has(key)) map.get(key)!.push(ev);
    });
    return map;
  }, [events, weekDays]);

  const noDueDateTasks = useMemo(
    () =>
      events.filter(
        (e) => e.kind === "todo" && !e.dueDate && (e as CalTask).status !== "done"
      ) as CalTask[],
    [events]
  );

  const weekEvents = useMemo(() => {
    const all: CalEvent[] = [];
    eventsByDay.forEach((es) => all.push(...es));
    return all;
  }, [eventsByDay]);

  const todosDone = weekEvents.filter(
    (e) => e.kind === "todo" && (e as CalTask).status === "done"
  ).length;
  const milestonesCompleted = weekEvents.filter(
    (e) => e.kind === "milestone" && (e as CalMilestone).completedAt !== null
  ).length;
  const overdueCount = weekEvents.filter((e) => {
    if (e.kind === "todo") return isTaskOverdue(e as CalTask);
    return isMilestoneOverdue(e as CalMilestone);
  }).length;

  return (
    <div className="space-y-4">
      {/* Week nav */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground font-medium">
          {format(weekStart, "MMM d")} &ndash; {format(weekEnd, "MMM d, yyyy")}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setWeekStart((w) => subWeeks(w, 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card text-sm flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span className="font-medium text-foreground">{weekEvents.length}</span>
          <span className="hidden sm:inline">events this week</span>
          <span className="sm:hidden">this week</span>
        </div>
        <div className="h-4 w-px bg-border hidden sm:block" />
        <div className="flex items-center gap-1.5 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">{todosDone}</span>
          <span className="hidden sm:inline">To-Dos done</span>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-600">
          <Flag className="h-4 w-4" />
          <span className="font-medium">{milestonesCompleted}</span>
          <span className="hidden sm:inline">milestones done</span>
        </div>
        {overdueCount > 0 && (
          <>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{overdueCount}</span> overdue
            </div>
          </>
        )}
      </div>

      {/* 7-day grid */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="grid grid-cols-7 gap-2 min-w-[560px] sm:min-w-0">
          {weekDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(key) ?? [];
            const isCurrentDay = isToday(day);
            const isPast = day < new Date() && !isCurrentDay;

            return (
              <div
                key={key}
                className={`rounded-xl border p-2.5 min-h-[160px] flex flex-col gap-2 transition-colors ${
                  isCurrentDay
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-border bg-card"
                }`}
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isCurrentDay ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "EEE")}
                    </p>
                    <p
                      className={`text-base font-bold leading-none mt-0.5 ${
                        isCurrentDay
                          ? "text-primary"
                          : isPast
                          ? "text-muted-foreground/60"
                          : "text-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </p>
                  </div>
                  {dayEvents.length > 0 && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        isCurrentDay
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Event chips */}
                <div className="flex flex-col gap-1.5 flex-1">
                  {dayEvents.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/40 text-center mt-4">
                      Nothing due
                    </p>
                  ) : (
                    dayEvents.map((ev) => (
                      <EventChip
                        key={`${ev.kind}-${ev.id}`}
                        event={ev}
                        onClick={() => onSelectEvent(ev)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* No due date section */}
      {noDueDateTasks.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            No Due Date ({noDueDateTasks.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {noDueDateTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onSelectEvent(task)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background text-xs hover:bg-muted/50 transition-colors cursor-pointer"
              >
                {STATUS_ICON[task.status] ?? STATUS_ICON.todo}
                <span className="font-medium text-foreground">{task.title}</span>
                {task.priority && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                      PRIORITY_CHIP[task.priority] ?? ""
                    }`}
                  >
                    {task.priority}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">{task.projectName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Monthly View ------------------------------------------------------------
function MonthlyView({
  events,
  onSelectEvent,
}: {
  events: CalEvent[];
  onSelectEvent: (e: CalEvent) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [overflowDay, setOverflowDay] = useState<Date | null>(null);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      if (!ev.dueDate) continue;
      const key = format(new Date(ev.dueDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthEvents = events.filter(
    (e) => e.dueDate && e.dueDate >= monthStart.getTime() && e.dueDate <= monthEnd.getTime()
  );
  const todosDone = monthEvents.filter(
    (e) => e.kind === "todo" && (e as CalTask).status === "done"
  ).length;
  const milestonesCompleted = monthEvents.filter(
    (e) => e.kind === "milestone" && (e as CalMilestone).completedAt !== null
  ).length;
  const overdueCount = monthEvents.filter((e) => {
    if (e.kind === "todo") return isTaskOverdue(e as CalTask);
    return isMilestoneOverdue(e as CalMilestone);
  }).length;

  const overflowEvents = useMemo(() => {
    if (!overflowDay) return [];
    return eventsByDay.get(format(overflowDay, "yyyy-MM-dd")) ?? [];
  }, [overflowDay, eventsByDay]);

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground font-medium">
          {format(currentMonth, "MMMM yyyy")}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCurrentMonth(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card text-sm flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span className="font-medium text-foreground">{monthEvents.length}</span>
          <span className="hidden sm:inline">events this month</span>
          <span className="sm:hidden">this month</span>
        </div>
        <div className="h-4 w-px bg-border hidden sm:block" />
        <div className="flex items-center gap-1.5 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">{todosDone}</span>
          <span className="hidden sm:inline">To-Dos done</span>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-600">
          <Flag className="h-4 w-4" />
          <span className="font-medium">{milestonesCompleted}</span>
          <span className="hidden sm:inline">milestones done</span>
        </div>
        {overdueCount > 0 && (
          <>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{overdueCount}</span> overdue
            </div>
          </>
        )}
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(key) ?? [];
            const isCurrentDay = isToday(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isLastInRow = (idx + 1) % 7 === 0;
            const isLastRow = idx >= calendarDays.length - 7;
            const visible = dayEvents.slice(0, MAX_VISIBLE_MONTH);
            const overflow = dayEvents.length - MAX_VISIBLE_MONTH;

            return (
              <div
                key={key}
                className={`min-h-[60px] sm:min-h-[90px] p-1 sm:p-1.5 flex flex-col gap-0.5 sm:gap-1 ${
                  !isLastInRow ? "border-r border-border" : ""
                } ${!isLastRow ? "border-b border-border" : ""} ${
                  isCurrentDay
                    ? "bg-primary/5"
                    : !isCurrentMonth
                    ? "bg-muted/20"
                    : "bg-background"
                }`}
              >
                {/* Date number */}
                <div className="flex justify-end">
                  <span
                    className={`text-[10px] sm:text-[11px] font-semibold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full ${
                      isCurrentDay
                        ? "bg-primary text-primary-foreground"
                        : !isCurrentMonth
                        ? "text-muted-foreground/40"
                        : "text-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                {/* Event chips */}
                <div className="flex flex-col gap-0.5 flex-1">
                  {/* Mobile: dot count badge */}
                  {dayEvents.length > 0 && (
                    <button
                      onClick={() => setOverflowDay(day)}
                      className="sm:hidden w-full text-left"
                    >
                      <span
                        className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded ${
                          dayEvents.some((e) =>
                            e.kind === "todo"
                              ? isTaskOverdue(e as CalTask)
                              : isMilestoneOverdue(e as CalMilestone)
                          )
                            ? "bg-red-100 text-red-700"
                            : dayEvents.every((e) =>
                                e.kind === "todo"
                                  ? (e as CalTask).status === "done"
                                  : (e as CalMilestone).completedAt !== null
                              )
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {dayEvents.length}
                      </span>
                    </button>
                  )}

                  {/* Desktop: event chips */}
                  <div className="hidden sm:flex flex-col gap-0.5 flex-1">
                    {visible.map((ev) => (
                      <EventChip
                        key={`${ev.kind}-${ev.id}`}
                        event={ev}
                        onClick={() => onSelectEvent(ev)}
                        compact
                      />
                    ))}
                    {overflow > 0 && (
                      <button
                        onClick={() => setOverflowDay(day)}
                        className="text-[10px] text-primary font-semibold px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors text-left cursor-pointer"
                      >
                        +{overflow} more
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overflow sheet */}
      <Sheet open={!!overflowDay} onOpenChange={(v) => !v && setOverflowDay(null)}>
        <SheetContent className="w-full sm:w-96">
          {overflowDay && (
            <>
              <SheetHeader className="mb-5">
                <SheetTitle className="text-base">
                  {format(overflowDay, "EEEE, MMMM d")}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-2">
                {overflowEvents.map((ev) => {
                  if (ev.kind === "milestone") {
                    const completed = isMilestoneCompleted(ev);
                    const overdue = isMilestoneOverdue(ev);
                    return (
                      <button
                        key={`milestone-${ev.id}`}
                        onClick={() => {
                          setOverflowDay(null);
                          onSelectEvent(ev);
                        }}
                        className={`w-full text-left rounded-lg px-3 py-2.5 border text-sm transition-all hover:shadow-sm cursor-pointer ${
                          completed
                            ? "bg-violet-50 border-violet-100 text-violet-700"
                            : overdue
                            ? "bg-red-50 border-red-100 text-red-700"
                            : "bg-indigo-50 border-indigo-100 text-indigo-700"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Flag className="h-4 w-4 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium leading-snug ${completed ? "line-through opacity-70" : ""}`}>
                              {ev.title}
                            </p>
                            <p className="text-[10px] mt-1 opacity-70">{ev.projectName}</p>
                          </div>
                        </div>
                      </button>
                    );
                  }

                  const task = ev as CalTask;
                  const overdue = isTaskOverdue(task);
                  return (
                    <button
                      key={`todo-${task.id}`}
                      onClick={() => {
                        setOverflowDay(null);
                        onSelectEvent(task);
                      }}
                      className={`w-full text-left rounded-lg px-3 py-2.5 border text-sm transition-all hover:shadow-sm cursor-pointer ${
                        task.status === "done"
                          ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                          : overdue
                          ? "bg-red-50 border-red-100 text-red-700"
                          : "bg-background border-border text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {STATUS_ICON[task.status] ?? STATUS_ICON.todo}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-medium leading-snug ${
                              task.status === "done" ? "line-through opacity-70" : ""
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {task.priority && (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                  PRIORITY_CHIP[task.priority] ?? ""
                                }`}
                              >
                                {task.priority}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {task.projectName}
                            </span>
                            {task.assigneeName && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <User className="h-2.5 w-2.5" />
                                {task.assigneeName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// --- Main Calendar Page ------------------------------------------------------
export default function Calendar() {
  const [view, setView] = useState<CalendarView>("weekly");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  const { data: rawTasks = [], isLoading: tasksLoading } = trpc.tasks.listForCalendar.useQuery();
  const { data: rawMilestones = [], isLoading: milestonesLoading } =
    trpc.milestones.listForCalendar.useQuery();
  // Use the already-prefetched listWithStats data for the Rock filter dropdown
  const { data: projects = [] } = trpc.projects.listWithStats.useQuery();

  const isLoading = tasksLoading || milestonesLoading;

  // Merge tasks and milestones into a unified event list.
  // projectName and assigneeName are now returned inline by the backend.
  const allEvents = useMemo<CalEvent[]>(() => {
    const todoEvents: CalTask[] = (rawTasks as any[]).map((t) => ({
      ...t,
      kind: "todo" as const,
    }));
    const milestoneEvents: CalMilestone[] = (rawMilestones as any[]).map((m) => ({
      ...m,
      kind: "milestone" as const,
    }));
    return [...todoEvents, ...milestoneEvents];
  }, [rawTasks, rawMilestones]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(
      (e) => filterProject === "all" || String(e.projectId) === filterProject
    );
  }, [allEvents, filterProject]);

  return (
    <>
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              View To-Dos and Milestones by due date
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Legend */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-secondary inline-block" />
                To-Do
              </span>
              <span className="flex items-center gap-1">
                <Flag className="h-3 w-3 text-indigo-500" />
                Milestone
              </span>
            </div>

            {/* Rock filter */}
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="h-8 text-xs w-36 bg-background">
                <SelectValue placeholder="All Rocks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rocks</SelectItem>
                {(projects as { id: number; name: string }[]).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Weekly / Monthly toggle */}
            <div className="flex items-center rounded-lg border border-border bg-muted p-0.5 gap-0.5">
              <button
                onClick={() => setView("weekly")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  view === "weekly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setView("monthly")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  view === "monthly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-2 min-w-[560px] sm:min-w-0">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-3 min-h-[160px] animate-pulse"
              />
            ))}
          </div>
        ) : view === "weekly" ? (
          <WeeklyView events={filteredEvents} onSelectEvent={setSelectedEvent} />
        ) : (
          <MonthlyView events={filteredEvents} onSelectEvent={setSelectedEvent} />
        )}
      </div>

      <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </>
  );
}
