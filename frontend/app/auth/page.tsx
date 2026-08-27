"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setStatus("");

    try {
      const result = mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth` },
          });

      if (result.error) {
        setStatus(
          result.error.message.toLowerCase().includes("confirmation email")
            ? "Supabase could not send the confirmation email. Check your Resend SMTP settings and verified sender domain."
            : result.error.message,
        );
        return;
      }

      if (mode === "sign-up" && !result.data.session) {
        setStatus("Check your email to confirm your account, then sign in.");
        return;
      }
      router.replace("/");
    } catch {
      setStatus("Authentication service unavailable. Check the Supabase project and SMTP configuration.");
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <main style={styles.shell}>
        <section style={styles.panel}>
          <div style={styles.mark}>D</div>
          <p style={styles.eyebrow}>DITrix personal AI</p>
          <h1 style={styles.heading}>Accounts are not configured</h1>
          <p style={styles.copy}>
            Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
            the frontend environment before enabling hosted authentication.
          </p>
          <button type="button" onClick={() => router.replace("/")} style={styles.secondaryButton}>
            Continue locally
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.shell}>
      <section style={styles.panel}>
        <div style={styles.mark}>D</div>
        <p style={styles.eyebrow}>DITrix personal AI</p>
        <h1 style={styles.heading}>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
        <p style={styles.copy}>
          {mode === "sign-in" ? "Sign in to continue to your private workspace." : "Create an account for your private DITroy workspace."}
        </p>
        <form onSubmit={submit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={styles.input} />
          </label>
          <label style={styles.label}>
            Password
            <input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={styles.input} />
          </label>
          {status && <p style={styles.status}>{status}</p>}
          <button disabled={busy} type="submit" style={styles.primaryButton}>
            {busy ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setStatus(""); }} style={styles.linkButton}>
          {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

const styles = {
  shell: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    boxSizing: "border-box" as const,
    background: "radial-gradient(circle at top, rgba(148,163,184,0.24), transparent 33%), linear-gradient(135deg, #0b1020 0%, #111827 45%, #0f172a 100%)",
    color: "#e5eefb",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  panel: {
    width: "min(100%, 420px)",
    padding: 36,
    border: "1px solid rgba(148,163,184,.18)",
    borderRadius: 20,
    background: "rgba(15,23,42,.88)",
    boxShadow: "0 24px 70px rgba(15,23,42,.48)",
    boxSizing: "border-box" as const,
  },
  mark: { width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 14, background: "linear-gradient(135deg,#8b5cf6,#22c55e)", color: "white", fontWeight: 800, fontSize: 20 },
  eyebrow: { margin: "20px 0 8px", color: "#94a3b8", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" as const },
  heading: { margin: 0, fontSize: 30, lineHeight: 1.15 },
  copy: { color: "#94a3b8", lineHeight: 1.55, margin: "12px 0 26px" },
  form: { display: "grid", gap: 18 },
  label: { display: "grid", gap: 8, color: "#cbd5e1", fontSize: 13 },
  input: { width: "100%", boxSizing: "border-box" as const, padding: "13px 14px", border: "1px solid rgba(148,163,184,.22)", borderRadius: 10, background: "rgba(2,6,23,.55)", color: "#f8fafc", fontSize: 15, outline: "none" },
  primaryButton: { border: 0, borderRadius: 10, padding: "13px 16px", background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  secondaryButton: { border: "1px solid rgba(148,163,184,.22)", borderRadius: 10, padding: "13px 16px", background: "rgba(148,163,184,.06)", color: "#e2e8f0", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  linkButton: { marginTop: 22, border: 0, background: "transparent", color: "#a78bfa", cursor: "pointer", padding: 0, fontSize: 13 },
  status: { margin: 0, color: "#fbbf24", fontSize: 13, lineHeight: 1.45 },
};