import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import {
  Calendar,
  Clock,
  DollarSign,
  Download,
  Eye,
  GripVertical,
  History,
  Lightbulb,
  Loader2,
  Mountain,
  ParkingCircle,
  Plus,
  Rocket,
  RotateCcw,
  Save,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type GoalCard = {
  dueDate: string;
  revenueTarget: string;
  studentTarget: string;
  profitTarget: string;
  bullets: string[];
};

type BulletList = string[];

const emptyGoalCard = (): GoalCard => ({
  dueDate: "",
  revenueTarget: "",
  studentTarget: "",
  profitTarget: "",
  bullets: [""],
});

const emptyBulletList = (): BulletList => [""];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseGoalCard(raw: string | null | undefined): GoalCard {
  if (!raw) return emptyGoalCard();
  try {
    const p = JSON.parse(raw);
    return {
      dueDate: p.dueDate ?? "",
      revenueTarget: p.revenueTarget ?? "",
      studentTarget: p.studentTarget ?? "",
      profitTarget: p.profitTarget ?? "",
      bullets: Array.isArray(p.bullets) && p.bullets.length > 0 ? p.bullets : [""],
    };
  } catch {
    return emptyGoalCard();
  }
}

function parseBulletList(raw: string | null | undefined): BulletList {
  if (!raw) return emptyBulletList();
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) && p.length > 0 ? p : emptyBulletList();
  } catch {
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : emptyBulletList();
  }
}

// ── BulletListEditor ──────────────────────────────────────────────────────────

function BulletListEditor({
  bullets,
  onChange,
  placeholder = "Add a point…",
}: {
  bullets: string[];
  onChange: (b: string[]) => void;
  placeholder?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (idx: number, val: string) => {
    const next = [...bullets];
    next[idx] = val;
    onChange(next);
  };

  const addAfter = (idx: number) => {
    const next = [...bullets];
    next.splice(idx + 1, 0, "");
    onChange(next);
    setTimeout(() => refs.current[idx + 1]?.focus(), 30);
  };

  const remove = (idx: number) => {
    if (bullets.length === 1) { onChange([""]); return; }
    const next = bullets.filter((_, i) => i !== idx);
    onChange(next);
    setTimeout(() => refs.current[Math.max(0, idx - 1)]?.focus(), 30);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Enter") { e.preventDefault(); addAfter(idx); }
    else if (e.key === "Backspace" && bullets[idx] === "" && bullets.length > 1) {
      e.preventDefault(); remove(idx);
    }
  };

  return (
    <div className="space-y-1.5">
      {bullets.map((bullet, idx) => (
        <div key={idx} className="flex items-center gap-2 group">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
          <Input
            ref={(el) => { refs.current[idx] = el; }}
            value={bullet}
            onChange={(e) => update(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            placeholder={placeholder}
            className="bg-input border-border/60 h-8 text-sm flex-1"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addAfter(bullets.length - 1)}
        className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors mt-1 ml-5"
      >
        <Plus className="h-3 w-3" />
        Add bullet
      </button>
    </div>
  );
}

// ── GoalCardEditor ────────────────────────────────────────────────────────────

function GoalCardEditor({
  icon,
  title,
  accentColor,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  accentColor: string;
  value: GoalCard;
  onChange: (v: GoalCard) => void;
}) {
  const set = <K extends keyof GoalCard>(key: K, val: GoalCard[K]) =>
    onChange({ ...value, [key]: val });

  return (
    <Card className="bg-card border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-base ${accentColor}`}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" /> Target Date
            </Label>
            <Input
              type="date"
              value={value.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
              className="bg-input border-border/60 h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1 text-muted-foreground">
              <DollarSign className="h-3 w-3" /> Revenue Target
            </Label>
            <Input
              placeholder="e.g. $500,000"
              value={value.revenueTarget}
              onChange={(e) => set("revenueTarget", e.target.value)}
              className="bg-input border-border/60 h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3" /> Student Target
            </Label>
            <Input
              placeholder="e.g. 250 students"
              value={value.studentTarget}
              onChange={(e) => set("studentTarget", e.target.value)}
              className="bg-input border-border/60 h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Net Profit Target
            </Label>
            <Input
              placeholder="e.g. $120,000"
              value={value.profitTarget}
              onChange={(e) => set("profitTarget", e.target.value)}
              className="bg-input border-border/60 h-8 text-sm"
            />
          </div>
        </div>

        <div className="border-t border-border/40" />

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">
            Goals
          </Label>
          <BulletListEditor
            bullets={value.bullets}
            onChange={(b) => set("bullets", b)}
            placeholder="What does success look like?"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── SimpleTextCard ────────────────────────────────────────────────────────────

function SimpleTextCard({
  icon,
  title,
  accentColor,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  icon: React.ReactNode;
  title: string;
  accentColor: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Card className="bg-card border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-base ${accentColor}`}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="bg-input border-border/60 resize-none text-sm"
        />
      </CardContent>
    </Card>
  );
}

// ── BulletCard ────────────────────────────────────────────────────────────────

function BulletCard({
  icon,
  title,
  accentColor,
  bullets,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  title: string;
  accentColor: string;
  bullets: string[];
  onChange: (b: string[]) => void;
  placeholder?: string;
}) {
  return (
    <Card className="bg-card border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-base ${accentColor}`}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <BulletListEditor bullets={bullets} onChange={onChange} placeholder={placeholder} />
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StrategicOrganizer() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.strategicOrganizer.get.useQuery();
  const { data: versions } = trpc.strategicOrganizer.listVersions.useQuery();

  // Simple text fields
  const [schoolName, setSchoolName] = useState("");
  const [mission, setMission] = useState("");
  const [idealCustomerProfile, setIdealCustomerProfile] = useState("");
  const [bhag, setBhag] = useState("");
  const [focusOfTheYear, setFocusOfTheYear] = useState("");

  // Bullet list fields
  const [values, setValues] = useState<BulletList>(emptyBulletList());
  const [parkingLot, setParkingLot] = useState<BulletList>(emptyBulletList());

  // Structured goal cards
  const [threeYearVisual, setThreeYearVisual] = useState<GoalCard>(emptyGoalCard());
  const [oneYearGoal, setOneYearGoal] = useState<GoalCard>(emptyGoalCard());
  const [ninetyDayProject, setNinetyDayProject] = useState<GoalCard>(emptyGoalCard());

  const [dirty, setDirty] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);

  // Populate from server data
  useEffect(() => {
    if (!data) return;
    setSchoolName(data.schoolName ?? "");
    setMission(data.mission ?? "");
    setIdealCustomerProfile(data.idealCustomerProfile ?? "");
    setBhag(data.bhag ?? "");
    setFocusOfTheYear(data.focusOfTheYear ?? "");
    setValues(parseBulletList(data.values));
    setParkingLot(parseBulletList(data.parkingLot));
    setThreeYearVisual(parseGoalCard(data.threeYearVisual));
    setOneYearGoal(parseGoalCard(data.oneYearGoal));
    setNinetyDayProject(parseGoalCard(data.ninetyDayProject));
    setDirty(false);
  }, [data]);

  const upsert = trpc.strategicOrganizer.upsert.useMutation({
    onSuccess: () => {
      toast.success("Strategic Organizer saved");
      utils.strategicOrganizer.get.invalidate();
      utils.strategicOrganizer.listVersions.invalidate();
      setDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const restoreVersion = trpc.strategicOrganizer.restoreVersion.useMutation({
    onSuccess: () => {
      utils.strategicOrganizer.get.invalidate();
      utils.strategicOrganizer.listVersions.invalidate();
      setHistoryOpen(false);
      toast.success("Version restored — your organizer has been updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteVersion = trpc.strategicOrganizer.deleteVersion.useMutation({
    onSuccess: () => utils.strategicOrganizer.listVersions.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const buildPayload = () => ({
    schoolName,
    mission,
    idealCustomerProfile,
    bhag,
    focusOfTheYear,
    values: JSON.stringify(values.filter((b) => b.trim())),
    parkingLot: JSON.stringify(parkingLot.filter((b) => b.trim())),
    threeYearVisual: JSON.stringify({
      ...threeYearVisual,
      bullets: threeYearVisual.bullets.filter((b) => b.trim()),
    }),
    oneYearGoal: JSON.stringify({
      ...oneYearGoal,
      bullets: oneYearGoal.bullets.filter((b) => b.trim()),
    }),
    ninetyDayProject: JSON.stringify({
      ...ninetyDayProject,
      bullets: ninetyDayProject.bullets.filter((b) => b.trim()),
    }),
    saveVersion: true,
  });

  const handleSave = () => upsert.mutate(buildPayload());

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

      const bulletHtml = (list: string[]) =>
        list.filter((b) => b.trim())
          .map((b) => `<li><span class="bullet-dot"></span><span>${esc(b)}</span></li>`)
          .join("") || "";

      const goalCardHtml = (card: GoalCard, title: string, accent: string, icon: string) => {
        const hasMetrics = card.revenueTarget || card.studentTarget || card.profitTarget;
        const hasBullets = card.bullets.some((b) => b.trim());
        return `
        <div class="card" style="--accent:${accent};">
          <div class="card-header">
            <span class="card-icon">${icon}</span>
            <div>
              <div class="card-title">${esc(title)}</div>
              ${card.dueDate ? `<div class="card-due">Due: ${esc(card.dueDate)}</div>` : ""}
            </div>
          </div>
          ${hasMetrics ? `
          <div class="metrics">
            ${card.revenueTarget ? `<div class="metric"><div class="metric-label">Revenue Target</div><div class="metric-value">${esc(card.revenueTarget)}</div></div>` : ""}
            ${card.studentTarget ? `<div class="metric"><div class="metric-label">Student Target</div><div class="metric-value">${esc(card.studentTarget)}</div></div>` : ""}
            ${card.profitTarget ? `<div class="metric"><div class="metric-label">Net Profit</div><div class="metric-value">${esc(card.profitTarget)}</div></div>` : ""}
          </div>` : ""}
          ${hasBullets ? `
          <div class="bullet-section">
            <div class="bullet-label">Key Milestones</div>
            <ul class="bullet-list">${bulletHtml(card.bullets)}</ul>
          </div>` : ""}
        </div>`;
      };

      const simpleSectionHtml = (title: string, content: string, icon: string, accent: string) => `
        <div class="card" style="--accent:${accent};">
          <div class="card-header">
            <span class="card-icon">${icon}</span>
            <div class="card-title">${esc(title)}</div>
          </div>
          <p class="card-body">${esc(content)}</p>
        </div>`;

      const bulletSectionHtml = (title: string, list: string[], icon: string, accent: string) => {
        if (!list.some((b) => b.trim())) return "";
        return `
        <div class="card" style="--accent:${accent};">
          <div class="card-header">
            <span class="card-icon">${icon}</span>
            <div class="card-title">${esc(title)}</div>
          </div>
          <ul class="bullet-list">${bulletHtml(list)}</ul>
        </div>`;
      };

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(schoolName || "Strategic Organizer")}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #f8f7f4;
      color: #1c1c1e;
      min-height: 100vh;
      padding: 48px 40px;
    }
    /* ── Header ── */
    .header {
      margin-bottom: 40px;
      padding-bottom: 28px;
      border-bottom: 2px solid #e5e2db;
    }
    .header-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .org-name {
      font-size: 30px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #1c1c1e;
      line-height: 1.2;
    }
    .doc-badge {
      background: #1c1c1e;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 5px 12px;
      border-radius: 20px;
      white-space: nowrap;
      margin-top: 4px;
    }
    .header-meta {
      font-size: 12px;
      color: #888;
      margin-top: 6px;
    }
    /* ── Grid layout ── */
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .full { grid-column: 1 / -1; }
    /* ── Card ── */
    .card {
      background: #fff;
      border-radius: 14px;
      padding: 22px 24px;
      border: 1.5px solid #e8e5de;
      border-top: 4px solid var(--accent, #6c63ff);
      page-break-inside: avoid;
    }
    .card-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 14px;
    }
    .card-icon {
      font-size: 20px;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .card-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #444;
    }
    .card-due {
      font-size: 11px;
      color: #888;
      margin-top: 2px;
    }
    .card-body {
      font-size: 13.5px;
      color: #333;
      line-height: 1.7;
    }
    /* ── Metrics ── */
    .metrics {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .metric {
      flex: 1;
      min-width: 100px;
      background: #f8f7f4;
      border: 1px solid #e8e5de;
      border-radius: 10px;
      padding: 10px 14px;
    }
    .metric-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #999;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 16px;
      font-weight: 700;
      color: var(--accent, #1c1c1e);
    }
    /* ── Bullets ── */
    .bullet-section { margin-top: 4px; }
    .bullet-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #aaa;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .bullet-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .bullet-list li {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: 13px;
      color: #333;
      line-height: 1.55;
    }
    .bullet-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent, #6c63ff);
      flex-shrink: 0;
      margin-top: 5px;
    }
    /* ── Print ── */
    @media print {
      body { background: #fff; padding: 24px; }
      .card { border: 1px solid #ddd; border-top: 3px solid var(--accent, #6c63ff); }
      .grid { gap: 14px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        <div class="org-name">${esc(schoolName || "Strategic Organizer")}</div>
        <div class="header-meta">Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
      </div>
      <div class="doc-badge">Strategic Organizer</div>
    </div>
  </div>

  <div class="grid">
    ${mission ? simpleSectionHtml("Mission", mission, "🎯", "#3b82f6") : ""}
    ${bhag ? simpleSectionHtml("BHAG", bhag, "🚀", "#8b5cf6") : ""}
    ${idealCustomerProfile ? `<div class="full">${simpleSectionHtml("Ideal Customer Profile", idealCustomerProfile, "👤", "#f59e0b")}</div>` : ""}
    ${focusOfTheYear ? simpleSectionHtml("Focus of the Year", focusOfTheYear, "⭐", "#ec4899") : ""}
    ${bulletSectionHtml("Core Values", values, "💎", "#10b981")}
    <div class="full">${goalCardHtml(threeYearVisual, "3-Year Vision", "#6366f1", "🏔️")}</div>
    ${goalCardHtml(oneYearGoal, "1-Year Goal", "#0ea5e9", "📅")}
    ${goalCardHtml(ninetyDayProject, "90-Day Project", "#f97316", "⚡")}
    ${bulletSectionHtml("Parking Lot", parkingLot, "🅿️", "#94a3b8")}
  </div>
</body>
</html>`;

      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      // Render inside an isolated iframe so the page's Tailwind CSS (which uses
      // oklch colors unsupported by html2canvas) doesn't bleed into the capture.
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:900px;height:10px;border:none;visibility:hidden;";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument!;
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Size the iframe to the full content height so nothing is clipped
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        // If already loaded (same-origin blob), resolve immediately
        if (iframeDoc.readyState === "complete") resolve();
      });
      await iframeDoc.fonts.ready;
      const contentHeight = iframeDoc.body.scrollHeight;
      iframe.style.height = `${contentHeight}px`;

      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f8f7f4",
        width: 900,
        windowWidth: 900,
        scrollY: 0,
      });

      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * pageW) / canvas.width;

      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -y, imgW, imgH);
        y += pageH;
      }

      const filename = `${schoolName.trim().replace(/\s+/g, "-").toLowerCase() || "strategic-organizer"}.pdf`;
      pdf.save(filename);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Strategic Organizer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define your school's vision, goals, and 90-day priorities.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
          {dirty && (
            <span className="text-xs text-amber-500 font-medium animate-pulse">
              Unsaved changes
            </span>
          )}

          {/* Version History */}
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <History className="h-4 w-4" />
                History
                {versions && versions.length > 0 && (
                  <span className="bg-primary/20 text-primary text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {versions.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[400px] overflow-y-auto">
              <SheetHeader className="pb-4 border-b border-border/60">
                <SheetTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Version History
                </SheetTitle>
                <p className="text-xs text-muted-foreground">
                  A snapshot is saved each time you click Save Changes.
                </p>
              </SheetHeader>

              {!versions || versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Clock className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No saved versions yet.</p>
                  <p className="text-xs text-muted-foreground/70">
                    Save your organizer to create the first snapshot.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pt-4">
                  {versions.map((v, idx) => {
                    const date = new Date(v.createdAt);
                    const label = idx === 0 ? "Latest" : null;
                    return (
                      <div
                        key={v.id}
                        className="group flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card hover:border-primary/30 transition-colors"
                      >
                        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {v.label || "Snapshot"}
                            </span>
                            {label && (
                              <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                                {label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {date.toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            at{" "}
                            {date.toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 gap-1 text-xs"
                            disabled={restoreVersion.isPending}
                            onClick={() => restoreVersion.mutate(v.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </Button>
                          <button
                            onClick={() => deleteVersion.mutate(v.id)}
                            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SheetContent>
          </Sheet>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/strategic-organizer/preview", "_blank")}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="gap-2"
          >
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={upsert.isPending || !dirty}
            className="gap-2"
          >
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {dirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      {/* School Name */}
      <Card className="bg-card border-border/60">
        <CardContent className="pt-5">
          <div className="space-y-1.5">
            <Label htmlFor="school-name" className="text-sm font-semibold">
              School Name
            </Label>
            <Input
              id="school-name"
              placeholder="e.g. Dragon's Den Martial Arts"
              value={schoolName}
              onChange={(e) => { setSchoolName(e.target.value); markDirty(); }}
              className="bg-input border-border/60 text-base font-medium max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Appears as the header on your exported PDF.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Foundation ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Foundation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SimpleTextCard
            icon={<Target className="h-4 w-4" />}
            title="Mission"
            accentColor="text-primary"
            value={mission}
            onChange={(v) => { setMission(v); markDirty(); }}
            placeholder="Why does your school exist? What do you do and for whom?"
          />
          <SimpleTextCard
            icon={<Star className="h-4 w-4" />}
            title="BHAG"
            accentColor="text-amber-500"
            value={bhag}
            onChange={(v) => { setBhag(v); markDirty(); }}
            placeholder="Your Big Hairy Audacious Goal — the 10–25 year moonshot."
          />
          <BulletCard
            icon={<Target className="h-4 w-4" />}
            title="Values"
            accentColor="text-violet-500"
            bullets={values}
            onChange={(b) => { setValues(b); markDirty(); }}
            placeholder="e.g. Discipline, Respect, Excellence…"
          />
          <SimpleTextCard
            icon={<Users className="h-4 w-4" />}
            title="Ideal Customer Profile"
            accentColor="text-cyan-500"
            value={idealCustomerProfile}
            onChange={(v) => { setIdealCustomerProfile(v); markDirty(); }}
            placeholder="Who is your ideal student / family? Age, goals, location, mindset…"
          />
        </div>
      </section>

      {/* ── Vision & Goals ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Vision &amp; Goals
        </h2>
        <div className="space-y-4">
          <GoalCardEditor
            icon={<Mountain className="h-4 w-4" />}
            title="3 Year Vision"
            accentColor="text-indigo-500"
            value={threeYearVisual}
            onChange={(v) => { setThreeYearVisual(v); markDirty(); }}
          />
          <GoalCardEditor
            icon={<TrendingUp className="h-4 w-4" />}
            title="1 Year Goal"
            accentColor="text-emerald-500"
            value={oneYearGoal}
            onChange={(v) => { setOneYearGoal(v); markDirty(); }}
          />
          <GoalCardEditor
            icon={<Rocket className="h-4 w-4" />}
            title="90 Day Projects"
            accentColor="text-orange-500"
            value={ninetyDayProject}
            onChange={(v) => { setNinetyDayProject(v); markDirty(); }}
          />
        </div>
      </section>

      {/* ── Capture ─────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Capture
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BulletCard
            icon={<ParkingCircle className="h-4 w-4" />}
            title="The Parking Lot"
            accentColor="text-muted-foreground"
            bullets={parkingLot}
            onChange={(b) => { setParkingLot(b); markDirty(); }}
            placeholder="Ideas, initiatives, or projects to revisit later…"
          />
          <SimpleTextCard
            icon={<Star className="h-4 w-4" />}
            title="Focus of the Year"
            accentColor="text-rose-500"
            value={focusOfTheYear}
            onChange={(v) => { setFocusOfTheYear(v); markDirty(); }}
            placeholder="The single most important theme or initiative for this year."
            rows={6}
          />
        </div>
      </section>
    </div>
  );
}
