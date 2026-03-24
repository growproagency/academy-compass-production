import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Parse the URL hash — Supabase puts access_token and type here for invite links
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const type = params.get("type");

    supabase.auth.getSession().then(() => {
      // Invited users need to set a password before entering the app
      if (type === "invite") {
        navigate("/set-password");
      } else {
        navigate("/");
      }
    });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
