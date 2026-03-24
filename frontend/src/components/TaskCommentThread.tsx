import { useAuth } from "@/hooks/useAuth";
import { useComments, useCreateComment, useDeleteComment, QK } from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Send,
  Trash2,
  Loader2,
  AlertCircle,
  Activity,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Comment = {
  id: number;
  taskId: number;
  authorId: number;
  content: string;
  isActivity: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: { id: number; name: string | null; email: string | null } | null;
};

interface TaskCommentThreadProps {
  taskId: number;
  taskTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getUserInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

/**
 * Render activity content that may contain **bold** markdown.
 * Keeps the component dependency-free (no markdown library needed for this simple case).
 */
function ActivityContent({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function TaskCommentThread({ taskId, taskTitle, open, onOpenChange }: TaskCommentThreadProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const qc = useQueryClient();

  const { data: rawComments = [], isLoading, error } = useComments(taskId);

  // Cast to our extended Comment type that includes isActivity
  const comments = rawComments as unknown as Comment[];

  // Count only real user comments for the badge
  const userCommentCount = (comments as Comment[]).filter((c) => !c.isActivity).length;

  const createMutation = useCreateComment();
  const deleteMutation = useDeleteComment();

  // Auto-scroll to bottom when comments load
  useEffect(() => {
    if (comments.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    createMutation.mutate(
      { taskId, content: trimmed },
      {
        onSuccess: (newComment) => {
          qc.setQueryData(QK.comments(taskId), (old: any) => {
            const c = newComment as unknown as Comment;
            const updated = old ? [...old, c] : [c];
            return updated;
          });
          setContent("");
          setSubmitting(false);
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }, 50);
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to post comment");
          setSubmitting(false);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const canDelete = (comment: Comment) =>
    !comment.isActivity && (user?.id === comment.authorId || user?.role === "admin");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 bg-card border-l border-border/60"
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-sm font-semibold text-foreground leading-tight truncate">
                {taskTitle}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Comments & Activity</span>
                {!isLoading && userCommentCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20"
                  >
                    {userCommentCount}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Comment + activity list */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive/60" />
              <p className="text-sm text-muted-foreground">Failed to load comments</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No comments yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Be the first to leave a note or feedback on this task.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div ref={scrollRef} className="px-4 py-4 space-y-3">
                {comments.map((comment, idx) => {
                  // ── Activity entry (system-generated) ──────────────────────
                  if (comment.isActivity) {
                    const actorName = comment.author?.name || comment.author?.email || "Someone";
                    return (
                      <div
                        key={comment.id}
                        className="flex items-center gap-2 py-1"
                      >
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Activity className="h-2.5 w-2.5 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground flex-1 min-w-0">
                          <span className="font-medium text-foreground">{actorName}</span>{" "}
                          <ActivityContent text={comment.content} />
                        </p>
                        <span className="text-[10px] text-muted-foreground/50 shrink-0">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    );
                  }

                  // ── Regular user comment ───────────────────────────────────
                  const isOwn = user?.id === comment.authorId;
                  const showAvatar =
                    idx === 0 ||
                    comments[idx - 1].authorId !== comment.authorId ||
                    comments[idx - 1].isActivity;
                  const authorName = comment.author?.name || comment.author?.email || "Unknown";
                  const initials = getUserInitials(comment.author?.name, comment.author?.email);

                  return (
                    <div key={comment.id} className={`flex gap-3 group ${isOwn ? "flex-row-reverse" : ""}`}>
                      {/* Avatar */}
                      <div className="shrink-0 w-8">
                        {showAvatar ? (
                          <Avatar className="h-8 w-8 border border-border">
                            <AvatarFallback
                              className={`text-xs font-semibold ${
                                isOwn
                                  ? "bg-primary/15 text-primary"
                                  : "bg-secondary text-secondary-foreground"
                              }`}
                            >
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-8" />
                        )}
                      </div>

                      {/* Bubble */}
                      <div className={`flex-1 min-w-0 ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
                        {showAvatar && (
                          <div className={`flex items-center gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
                            <span className="text-xs font-medium text-foreground">
                              {isOwn ? "You" : authorName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                        <div className={`relative max-w-[85%] ${isOwn ? "ml-auto" : ""}`}>
                          <div
                            className={`comment-bubble px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                              isOwn ? "own" : ""
                            }`}
                          >
                            {comment.content}
                          </div>
                          {/* Delete button */}
                          {canDelete(comment) && (
                            <button
                              onClick={async () => {
                                await qc.cancelQueries({ queryKey: QK.comments(taskId) });
                                const prev = qc.getQueryData(QK.comments(taskId));
                                qc.setQueryData(QK.comments(taskId), (old: any) =>
                                  old ? old.filter((c: any) => c.id !== comment.id) : []
                                );
                                deleteMutation.mutate(
                                  { id: comment.id, taskId },
                                  {
                                    onError: () => {
                                      if (prev) qc.setQueryData(QK.comments(taskId), prev);
                                      toast.error("Failed to delete comment");
                                    },
                                    onSettled: () => qc.invalidateQueries({ queryKey: QK.comments(taskId) }),
                                  }
                                );
                              }}
                              disabled={deleteMutation.isPending}
                              className={`absolute -top-2 ${
                                isOwn ? "-left-2" : "-right-2"
                              } w-5 h-5 rounded-full bg-destructive/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive`}
                              title="Delete comment"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                        {!showAvatar && (
                          <span className={`text-[10px] text-muted-foreground/60 ${isOwn ? "text-right" : ""}`}>
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-border/40 bg-background/50 backdrop-blur px-4 py-3">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment… (⌘ + Enter to send)"
              className="min-h-[72px] max-h-[180px] resize-none bg-input/60 border-border/50 text-sm focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/50"
              disabled={submitting}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/50">
                {content.length > 0 ? `${content.length} / 2000` : "Plain text"}
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!content.trim() || submitting || content.length > 2000}
                className="gap-1.5 h-8 px-3 text-xs"
              >
                {submitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Post
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Compact comment count badge button for use on task cards */
export function CommentCountBadge({
  count,
  onClick,
}: {
  count: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors group"
      title="View comments"
    >
      <MessageSquare className="h-3 w-3 group-hover:text-primary transition-colors" />
      <span>{count}</span>
    </button>
  );
}
