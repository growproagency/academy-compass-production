import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Megaphone,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  MoreVertical,
  Plus,
  Loader2,
  CalendarClock,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Announcement = {
  id: number;
  title: string;
  body: string;
  isPinned: boolean;
  authorId: number;
  expiresAt: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function AnnouncementForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: Partial<Announcement>;
  onSave: (data: { title: string; body: string; isPinned: boolean; expiresAt: number | null }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [isPinned, setIsPinned] = useState(initial?.isPinned ?? false);
  const [expiresStr, setExpiresStr] = useState(
    initial?.expiresAt ? new Date(initial.expiresAt).toISOString().slice(0, 10) : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    const expiresAt = expiresStr ? new Date(expiresStr).getTime() : null;
    onSave({ title: title.trim(), body: body.trim(), isPinned, expiresAt });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Belt Test — March 15th"
          maxLength={255}
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Message</label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write the announcement details here…"
          rows={5}
          required
        />
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="rounded"
          />
          Pin to top
        </label>
        <div className="flex items-center gap-2 text-sm">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <label className="text-muted-foreground">Expires on (optional):</label>
          <Input
            type="date"
            value={expiresStr}
            onChange={(e) => setExpiresStr(e.target.value)}
            className="w-36 h-8 text-xs"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || !title.trim() || !body.trim()}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {initial?.id ? "Save Changes" : "Post Announcement"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Announcements() {
  const utils = trpc.useUtils();

  const { data: announcementsRaw, isLoading } = trpc.announcements.list.useQuery();
  const announcements = announcementsRaw as Announcement[] | undefined;

  const createMutation = trpc.announcements.create.useMutation({
    onSuccess: () => { utils.announcements.list.invalidate(); setCreateOpen(false); toast.success("Announcement posted."); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.announcements.update.useMutation({
    onSuccess: () => { utils.announcements.list.invalidate(); setEditTarget(null); toast.success("Announcement updated."); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.announcements.delete.useMutation({
    onSuccess: () => { utils.announcements.list.invalidate(); setDeleteTarget(null); toast.success("Announcement deleted."); },
    onError: (err) => toast.error(err.message),
  });

  const togglePinMutation = trpc.announcements.togglePin.useMutation({
    onSuccess: () => utils.announcements.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const pinned = (announcements ?? []).filter((a) => a.isPinned);
  const unpinned = (announcements ?? []).filter((a) => !a.isPinned);

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Announcements
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            School-wide news, schedule changes, and upcoming events
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Post
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && announcements?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No announcements yet.</p>
            <Button size="sm" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Post the first announcement
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pinned section */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Pin className="h-3 w-3" /> Pinned
          </p>
          {pinned.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              onEdit={() => setEditTarget(a)}
              onDelete={() => setDeleteTarget(a)}
              onTogglePin={() => togglePinMutation.mutate({ id: a.id, isPinned: !a.isPinned })}
            />
          ))}
        </div>
      )}

      {/* All other announcements */}
      {unpinned.length > 0 && (
        <div className="space-y-3">
          {pinned.length > 0 && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent</p>
          )}
          {unpinned.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              onEdit={() => setEditTarget(a)}
              onDelete={() => setDeleteTarget(a)}
              onTogglePin={() => togglePinMutation.mutate({ id: a.id, isPinned: !a.isPinned })}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Post Announcement</DialogTitle>
          </DialogHeader>
          <AnnouncementForm
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setCreateOpen(false)}
            isSaving={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <AnnouncementForm
              initial={editTarget}
              onSave={(data) => updateMutation.mutate({ id: editTarget.id, ...data })}
              onCancel={() => setEditTarget(null)}
              isSaving={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AnnouncementCard({
  announcement: a,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  announcement: Announcement;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const isExpiringSoon = a.expiresAt && a.expiresAt - Date.now() < 3 * 24 * 60 * 60 * 1000;

  return (
    <Card className={`border-border/60 ${a.isPinned ? "border-l-[3px] border-l-primary" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {a.isPinned && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 h-4">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </Badge>
              )}
              {isExpiringSoon && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 h-4 text-amber-600 border-amber-300">
                  <CalendarClock className="h-2.5 w-2.5" /> Expires soon
                </Badge>
              )}
              <h3 className="font-semibold text-sm">{a.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{a.body}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] text-muted-foreground">
                {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
              {a.expiresAt && (
                <span className="text-[10px] text-muted-foreground">
                  Expires {new Date(a.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onTogglePin} className="gap-2">
                  {a.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {a.isPinned ? "Unpin" : "Pin to top"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit} className="gap-2">
                  <Pencil className="h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
