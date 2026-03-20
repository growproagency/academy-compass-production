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

function applyBrandColors(org: Org) {
  const root = document.documentElement;
  if (org.brandPrimaryColor) {
    root.style.setProperty("--primary", org.brandPrimaryColor);
    // Keep foreground white for contrast
    root.style.setProperty("--primary-foreground", "oklch(0.99 0.002 240)");
    // Apply to sidebar primary too
    root.style.setProperty("--sidebar-primary", org.brandPrimaryColor);
    root.style.setProperty("--sidebar-primary-foreground", "oklch(0.99 0.002 240)");
    root.style.setProperty("--ring", org.brandPrimaryColor);
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--sidebar-primary-foreground");
    root.style.removeProperty("--ring");
  }
  if (org.brandAccentColor) {
    root.style.setProperty("--accent", org.brandAccentColor);
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

  return (
    <OrgContext.Provider value={{ org, loading, refresh: fetchOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
