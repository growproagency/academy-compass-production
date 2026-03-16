import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDueDate, PRIORITY_BADGE_CLASS, PRIORITY_LABELS, type TaskPriority } from "@/lib/taskHelpers";
import { trpc } from "@/lib/trpc";
import { Archive, Calendar, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ArchivePage() {
  const utils = trpc.useUtils();
  const { data: archived, isLoading } = trpc.tasks.listArchived.useQuery();

  const restore = trpc.tasks.restore.useMutation({
    onSuccess: () => {
      toast.success("To-Do restored to Kanban board");
      utils.tasks.listArchived.invalidate();
      utils.tasks.listAll.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const permanentDelete = trpc.tasks.permanentDelete.useMutation({
    onSuccess: () => {
      toast.success("To-Do permanently deleted");
      utils.tasks.listArchived.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted shrink-0">
          <Archive className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">To-Do Archive</h1>
          <p className="text-sm text-muted-foreground">
            Archived To-Dos are hidden from the Kanban board but can be restored at any time.
          </p>
        </div>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!archived || archived.length === 0) && (
        <Card className="p-12 text-center">
          <Archive className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No archived To-Dos</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            To-Dos you archive from the Kanban board will appear here.
          </p>
        </Card>
      )}

      {/* Archived list */}
      {!isLoading && archived && archived.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {archived.length} archived To-Do{archived.length !== 1 ? "s" : ""}
          </p>
          {archived.map((task) => (
            <Card
              key={task.id}
              className="p-4 hover:shadow-sm transition-shadow"
            >
              {/* Two-row layout: info on top, actions on bottom (mobile) */}
              {/* Single-row on sm+: info left, actions right */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm line-clamp-2">{task.title}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        PRIORITY_BADGE_CLASS[task.priority as TaskPriority]
                      }`}
                    >
                      {PRIORITY_LABELS[task.priority as TaskPriority]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {formatDueDate(task.dueDate)}
                      </span>
                    )}
                    {task.archivedAt && (
                      <span className="flex items-center gap-1">
                        <Archive className="h-3 w-3 shrink-0" />
                        Archived {new Date(Number(task.archivedAt)).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons — full width on mobile, auto on sm+ */}
                <div className="flex items-center gap-2 sm:shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restore.mutate(task.id)}
                    disabled={restore.isPending}
                    className="gap-1.5 text-xs flex-1 sm:flex-none"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 flex-1 sm:flex-none"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Permanently delete To-Do?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <strong>"{task.title}"</strong> and all
                          its comments and subtasks. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => permanentDelete.mutate(task.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete permanently
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
