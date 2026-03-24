import { useStrategicOrganizer } from "@/hooks/useApi";
import { Loader2, Printer, X } from "lucide-react";
import { useLocation } from "wouter";

// ── Types (mirrors StrategicOrganizer.tsx) ────────────────────────────────────

type GoalCard = {
  dueDate: string;
  revenueTarget: string;
  studentTarget: string;
  profitTarget: string;
  bullets: string[];
};

type BulletList = string[];

function parseGoalCard(raw: string | null | undefined): GoalCard {
  if (!raw) return { dueDate: "", revenueTarget: "", studentTarget: "", profitTarget: "", bullets: [] };
  try {
    const p = JSON.parse(raw);
    return {
      dueDate: p.dueDate ?? "",
      revenueTarget: p.revenueTarget ?? "",
      studentTarget: p.studentTarget ?? "",
      profitTarget: p.profitTarget ?? "",
      bullets: Array.isArray(p.bullets) ? p.bullets.filter(Boolean) : [],
    };
  } catch {
    return { dueDate: "", revenueTarget: "", studentTarget: "", profitTarget: "", bullets: [] };
  }
}

function parseBulletList(raw: string | null | undefined): BulletList {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter(Boolean) : [];
  } catch {
    return raw.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, color = "bg-[#1a3a5c]" }: { title: string; color?: string }) {
  return (
    <div className={`${color} text-white text-center py-2 px-4 font-bold text-sm uppercase tracking-widest rounded-t-lg`}>
      {title}
    </div>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-slate-800 whitespace-pre-wrap min-h-[1.5rem]">{value || <span className="text-slate-300 italic">—</span>}</p>
    </div>
  );
}

function BulletBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-300 italic">—</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#1a3a5c] shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GoalCardBlock({ label, card }: { label: string; card: GoalCard }) {
  const hasTargets = card.revenueTarget || card.studentTarget || card.profitTarget;
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      {card.dueDate && (
        <p className="text-xs text-slate-500 mb-2">Due: <span className="font-medium text-slate-700">{card.dueDate}</span></p>
      )}
      {hasTargets && (
        <div className="grid grid-cols-3 gap-2 mb-3 bg-slate-50 rounded p-2 border border-slate-200">
          {card.revenueTarget && (
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider text-slate-400">Revenue</p>
              <p className="text-sm font-semibold text-slate-800">{card.revenueTarget}</p>
            </div>
          )}
          {card.studentTarget && (
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider text-slate-400">Students</p>
              <p className="text-sm font-semibold text-slate-800">{card.studentTarget}</p>
            </div>
          )}
          {card.profitTarget && (
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider text-slate-400">Net Profit</p>
              <p className="text-sm font-semibold text-slate-800">{card.profitTarget}</p>
            </div>
          )}
        </div>
      )}
      {card.bullets.length > 0 ? (
        <ul className="space-y-0.5">
          {card.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#1a3a5c] shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-300 italic">—</p>
      )}
    </div>
  );
}

// ── Main Preview Page ─────────────────────────────────────────────────────────

export default function StrategicOrganizerPreview() {
  const [, setLocation] = useLocation();
  const { data: _data, isLoading } = useStrategicOrganizer();
  const data = _data as any;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const schoolName = data?.schoolName ?? "";
  const mission = data?.mission ?? "";
  const idealCustomerProfile = data?.idealCustomerProfile ?? "";
  const bhag = data?.bhag ?? "";
  const focusOfTheYear = data?.focusOfTheYear ?? "";
  const values = parseBulletList(data?.values);
  const parkingLot = parseBulletList(data?.parkingLot);
  const threeYearVisual = parseGoalCard(data?.threeYearVisual);
  const oneYearGoal = parseGoalCard(data?.oneYearGoal);
  const ninetyDayProject = parseGoalCard(data?.ninetyDayProject);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/strategic-organizer")}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <X className="h-4 w-4" />
            Close Preview
          </button>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#1a3a5c] text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-[#0f2540] transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>

      {/* Document */}
      <div className="max-w-[900px] mx-auto my-6 print:my-0 bg-white shadow-lg print:shadow-none rounded-xl print:rounded-none overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a3a5c] px-8 py-6 flex items-center gap-5">
          <img
            src="https://cdn.manus.space/static/academy-compass-logo_1137a27d.jpg"
            alt="Academy Compass"
            className="h-14 w-14 rounded-lg object-contain bg-white p-1 shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div>
            {schoolName ? (
              <>
                <h1 className="text-2xl font-bold text-white leading-tight">{schoolName}</h1>
                <p className="text-sm text-blue-200 font-medium tracking-widest uppercase mt-0.5">Strategic Organizer</p>
              </>
            ) : (
              <h1 className="text-2xl font-bold text-white">Strategic Organizer</h1>
            )}
            <p className="text-xs text-blue-300 mt-1">Academy Compass — Always know where your business is headed.</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* ── Foundation ── */}
          <div>
            <SectionHeader title="Foundation" />
            <div className="border border-t-0 border-slate-200 rounded-b-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <FieldBlock label="Mission" value={mission} />
              <FieldBlock label="BHAG (Big Hairy Audacious Goal)" value={bhag} />
              <BulletBlock label="Core Values" items={values} />
              <FieldBlock label="Ideal Customer Profile" value={idealCustomerProfile} />
            </div>
          </div>

          {/* ── Vision & Goals ── */}
          <div>
            <SectionHeader title="Vision & Goals" color="bg-[#0f5e8a]" />
            <div className="border border-t-0 border-slate-200 rounded-b-lg p-5 grid grid-cols-1 md:grid-cols-3 gap-x-6">
              <GoalCardBlock label="3 Year Vision" card={threeYearVisual} />
              <GoalCardBlock label="1 Year Goal" card={oneYearGoal} />
              <GoalCardBlock label="90 Day Projects" card={ninetyDayProject} />
            </div>
          </div>

          {/* ── Capture ── */}
          <div>
            <SectionHeader title="Capture" color="bg-[#2a6049]" />
            <div className="border border-t-0 border-slate-200 rounded-b-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <BulletBlock label="The Parking Lot" items={parkingLot} />
              <FieldBlock label="Focus of the Year" value={focusOfTheYear} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
          <span>Academy Compass — Strategic Organizer</span>
          <span>Generated {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 0.5in; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
