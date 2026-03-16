/**
 * CommandPalette — global ⌘K / Ctrl+K search + quick-add popover.
 * Also opens on pressing "N" when no input is focused (quick-add mode).
 */
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/taskHelpers";
import {
  Archive,
  Calendar,
  CheckCircle2,
  Circle,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Search,
  Timer,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import TaskDialog from "./TaskDialog";

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  todo: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  in_progress: <Timer className="h-3.5 w-3.5 text-blue-400" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
};

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { label: "Rocks", path: "/projects", icon: <FolderKanban className="h-3.5 w-3.5" /> },
  { label: "Archive", path: "/archive", icon: <Archive className="h-3.5 w-3.5" /> },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "create">("search");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [, navigate] = useLocation();
  const { data: projects } = trpc.projects.list.useQuery();
  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.name])), [projects]);

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const { data: results, isLoading: searching } = trpc.tasks.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.trim().length >= 2 }
  );

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable;

      // ⌘K / Ctrl+K → open search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setMode("search");
        setOpen(true);
        return;
      }

      // N → open quick-add (only when no input is focused)
      if (e.key === "n" && !isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setMode("create");
        setOpen(true);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }, []);

  const handleSelect = useCallback((path: string) => {
    navigate(path);
    handleClose();
  }, [navigate, handleClose]);

  const handleQuickAdd = useCallback(() => {
    handleClose();
    setCreateOpen(true);
  }, [handleClose]);

  const showResults = debouncedQuery.trim().length >= 2;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent className="p-0 gap-0 w-[calc(100vw-2rem)] max-w-lg overflow-hidden" aria-describedby={undefined}>
          <Command shouldFilter={false} className="rounded-xl border-0">
            <div className="flex items-center border-b border-border px-3">
              <Search className="h-4 w-4 text-muted-foreground shrink-0 mr-2" />
              <CommandInput
                placeholder={mode === "create" ? "Quick-add To-Do title…" : "Search To-Dos, navigate…"}
                value={query}
                onValueChange={setQuery}
                className="border-0 focus:ring-0 h-12 text-sm"
              />
            </div>
            <CommandList className="max-h-80 overflow-y-auto">
              {/* Quick-add shortcut */}
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={handleQuickAdd}
                  className="cursor-pointer gap-2"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {query.trim() ? (
                      <>Create To-Do: <strong>"{query.trim()}"</strong></>
                    ) : (
                      "Create new To-Do…"
                    )}
                  </span>
                </CommandItem>
              </CommandGroup>

              {/* Navigation */}
              {!showResults && (
                <CommandGroup heading="Navigate">
                  {NAV_ITEMS.map((item) => (
                    <CommandItem
                      key={item.path}
                      onSelect={() => handleSelect(item.path)}
                      className="cursor-pointer gap-2"
                    >
                      {item.icon}
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Search results */}
              {showResults && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={searching ? "Searching…" : `Results (${results?.length ?? 0})`}>
                    {!searching && (!results || results.length === 0) && (
                      <CommandEmpty>No To-Dos found for "{debouncedQuery}"</CommandEmpty>
                    )}
                    {results?.map((task) => (
                      <CommandItem
                        key={task.id}
                        onSelect={() => handleSelect(`/projects/${task.projectId}`)}
                        className="cursor-pointer gap-2 flex items-center"
                      >
                        {STATUS_ICON[task.status as TaskStatus]}
                        <span className="flex-1 truncate">{task.title}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_BADGE_CLASS[task.priority as TaskPriority]}`}>
                          {PRIORITY_LABELS[task.priority as TaskPriority]}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 max-w-[80px] truncate">
                          {task.projectId ? (projectMap.get(task.projectId) ?? "Unknown") : ""}
                        </span>
                        {task.dueDate && (
                          <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(Number(task.dueDate)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>

            {/* Footer hint */}
            <div className="border-t border-border px-3 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span><kbd className="px-1 py-0.5 rounded bg-secondary">↑↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 rounded bg-secondary">↵</kbd> select</span>
              <span><kbd className="px-1 py-0.5 rounded bg-secondary">Esc</kbd> close</span>
              <span className="ml-auto"><kbd className="px-1 py-0.5 rounded bg-secondary">⌘K</kbd> search · <kbd className="px-1 py-0.5 rounded bg-secondary">N</kbd> new To-Do</span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Quick-add To-Do dialog */}
      {createOpen && projects && projects.length > 0 && (
        <TaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projects[0].id}
          onSuccess={() => setCreateOpen(false)}
        />
      )}
    </>
  );
}
