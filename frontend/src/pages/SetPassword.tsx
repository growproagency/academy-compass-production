import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export default function SetPassword() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      navigate("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Set your password</h1>
          <p className="text-sm text-muted-foreground">
            You've been invited. Choose a password to activate your account.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <input
            className="border rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="New password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
          />
          <input
            className="border rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="Confirm password"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button onClick={handle} disabled={loading || !password || !confirm} size="lg" className="w-full">
            {loading ? "Setting password…" : "Set password & sign in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
