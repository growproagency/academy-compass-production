import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export interface Org {
  id: number;
  name: string;
  slug: string;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  logoUrl: string | null;
}

interface OrgContextValue {
  org: Org | null;
  loading: boolean;
  /** Call this after updating brand colors to re-apply them */
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue>({
  org: null,
  loading: true,
  refresh: async () => {},
});

/** Lighten an oklch color for dark mode readability */
function lightenForDark(color: string): string {
  // Match oklch(L C H) or oklch(L C H / A)
  const m = color.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!m) return color;
  const l = parseFloat(m[1]);
  const c = m[2], h = m[3];
  // Bump lightness to at least 0.65 for dark backgrounds
  const newL = Math.max(l, 0.65);
  return `oklch(${newL} ${c} ${h})`;
}

function applyBrandColors(org: Org) {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  if (org.brandPrimaryColor) {
    const primary = isDark ? lightenForDark(org.brandPrimaryColor) : org.brandPrimaryColor;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-foreground", "oklch(0.99 0.002 240)");
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-primary-foreground", "oklch(0.99 0.002 240)");
    root.style.setProperty("--ring", primary);
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--sidebar-primary-foreground");
    root.style.removeProperty("--ring");
  }
  if (org.brandAccentColor) {
    const accent = isDark ? lightenForDark(org.brandAccentColor) : org.brandAccentColor;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-foreground", "oklch(0.99 0.002 160)");
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-foreground");
  }
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchOrg() {
    try {
      const data = await api.orgs.current() as Org;
      setOrg(data);
      applyBrandColors(data);
    } catch {
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrg();
  }, []);

  // Re-apply brand colors when dark/light mode changes
  useEffect(() => {
    if (!org) return;
    const observer = new MutationObserver(() => applyBrandColors(org));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [org]);

  return (
    <OrgContext.Provider value={{ org, loading, refresh: fetchOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
