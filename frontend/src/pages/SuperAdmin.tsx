import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";

interface Org {
  id: number;
  name: string;
  slug: string;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  logoUrl: string | null;
}

interface OrgFormState {
  name: string;
  slug: string;
  brandPrimaryColor: string;
  brandAccentColor: string;
  logoUrl: string;
}

const emptyForm: OrgFormState = {
  name: "",
  slug: "",
  brandPrimaryColor: "",
  brandAccentColor: "",
  logoUrl: "",
};

export default function SuperAdmin() {
  const { refresh: refreshCurrentOrg } = useOrg();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Org | null>(null);
  const [form, setForm] = useState<OrgFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Org | null>(null);

  async function loadOrgs() {
    try {
      const data = await api.orgs.list() as Org[];
      setOrgs(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("Superadmin access required");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrgs(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(org: Org) {
    setEditing(org);
    setForm({
      name: org.name,
      slug: org.slug,
      brandPrimaryColor: org.brandPrimaryColor ?? "",
      brandAccentColor: org.brandAccentColor ?? "",
      logoUrl: org.logoUrl ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        brandPrimaryColor: form.brandPrimaryColor.trim() || null,
        brandAccentColor: form.brandAccentColor.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
      };
      if (editing) {
        await api.orgs.update(editing.id, payload as any);
        toast.success("Organization updated");
      } else {
        await api.orgs.create(payload as any);
        toast.success("Organization created");
      }
      setDialogOpen(false);
      await loadOrgs();
      await refreshCurrentOrg();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.orgs.delete(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      await loadOrgs();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  }

  function slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage organizations and their branding</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          New Organization
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No organizations yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <div key={org.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Brand color preview */}
                <div
                  className="w-8 h-8 rounded-full border flex-shrink-0"
                  style={{ background: org.brandPrimaryColor ?? "var(--primary)" }}
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground">{org.slug}.yourapp.com</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {org.brandPrimaryColor && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-full border" style={{ background: org.brandPrimaryColor }} />
                    {org.brandPrimaryColor}
                  </div>
                )}
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(org)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(org)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Organization" : "New Organization"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
                    name,
                    // Auto-fill slug from name when creating
                    slug: editing ? f.slug : slugify(name),
                  }));
                }}
                placeholder="Sunridge Academy"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug <span className="text-muted-foreground font-normal">(subdomain)</span></Label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  placeholder="sunridge"
                  className="font-mono"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">.yourapp.com</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.brandPrimaryColor || "#6366f1"}
                    onChange={(e) => setForm((f) => ({ ...f, brandPrimaryColor: e.target.value }))}
                    className="w-9 h-9 rounded border cursor-pointer p-0.5 bg-transparent"
                  />
                  <Input
                    value={form.brandPrimaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, brandPrimaryColor: e.target.value }))}
                    placeholder="#6366f1"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.brandAccentColor || "#10b981"}
                    onChange={(e) => setForm((f) => ({ ...f, brandAccentColor: e.target.value }))}
                    className="w-9 h-9 rounded border cursor-pointer p-0.5 bg-transparent"
                  />
                  <Input
                    value={form.brandAccentColor}
                    onChange={(e) => setForm((f) => ({ ...f, brandAccentColor: e.target.value }))}
                    placeholder="#10b981"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Logo URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={form.logoUrl}
                onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            {/* Live preview */}
            {(form.brandPrimaryColor || form.brandAccentColor) && (
              <div className="rounded-lg border p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">Preview</p>
                <div className="flex items-center gap-2">
                  {form.brandPrimaryColor && (
                    <div
                      className="px-3 py-1 rounded text-xs font-medium text-white"
                      style={{ background: form.brandPrimaryColor }}
                    >
                      Primary
                    </div>
                  )}
                  {form.brandAccentColor && (
                    <div
                      className="px-3 py-1 rounded text-xs font-medium text-white"
                      style={{ background: form.brandAccentColor }}
                    >
                      Accent
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will permanently delete all users, projects, tasks, and data associated with this organization.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
