import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ShieldAlert } from "lucide-react";

type TokenInfo = {
  role: "user" | "admin";
  orgName: string;
  orgSlug: string;
};

export default function InviteSignup() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.invites.validateToken(token)
      .then((data: any) => setTokenInfo(data))
      .catch((e: any) => setTokenError(e.message ?? "Invalid or expired invite link"))
      .finally(() => setTokenLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      await api.invites.signup(token!, { name, email, password });

      // Sign in immediately — no email needed
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      setDone(true);
      setTimeout(() => navigate("/"), 1500);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <div className="text-center space-y-3 max-w-sm">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Invite link invalid</h1>
          <p className="text-sm text-muted-foreground">{tokenError}</p>
          <p className="text-xs text-muted-foreground">Contact your admin for a new invite link.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <div className="text-center space-y-3 max-w-sm">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold">Account created!</h1>
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">You've been invited</h1>
          <p className="text-sm text-muted-foreground">
            Join <span className="font-semibold text-foreground">{tokenInfo?.orgName}</span> as{" "}
            <span className="font-semibold text-foreground">
              {tokenInfo?.role === "admin" ? "an Admin" : "a Member"}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="border rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="Full name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoFocus
          />
          <input
            className="border rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="Email address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            className="border rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="Password (min 8 characters)"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <input
            className="border rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="Confirm password"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading || !name || !email || !password || !confirm}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? "Creating account…" : "Create account & sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
