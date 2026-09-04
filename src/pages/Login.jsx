import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Lock, Loader2, User } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import WhatsAppHelp from "@/components/WhatsAppHelp";
import { safeReturnTo } from "@/lib/authReturnTo";

// Login with either the verified email or the enrollment number. The
// enrollment number is only an identifier lookup — authentication is always
// email + password via the platform auth backend.
export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = safeReturnTo();

  const resolveEmail = async (value) => {
    const trimmed = value.trim();
    if (trimmed.includes("@")) return trimmed;
    // Enrollment number: resolve the verified account email server-side;
    // fall back to the student records when the backend layer is unavailable.
    try {
      const res = await api.functions.invoke("resolveLoginEmail", { enrollmentNumber: trimmed });
      return res.data.email;
    } catch {
      const students = await api.entities.Students.list();
      const match = students.find((s) => s.enrollment_number === trimmed);
      if (!match?.email) throw new Error("not_found");
      return match.email;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const email = await resolveEmail(identifier);
      await api.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      const message = String(err?.message || "");
      if (/not configured/i.test(message)) setError(message);
      else if (/not confirmed|confirm your email/i.test(message)) setError("Please verify your email using the link we sent. Check your spam or junk folder.");
      else if (/invalid login credentials/i.test(message)) setError("Invalid email or password. If you recently registered, verify your email first.");
      else setError(message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in with your email or enrollment number"
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="text-primary font-medium hover:underline"
          >
            Register
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Email or Enrollment Number</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="identifier"
              type="text"
              autoFocus
              placeholder="you@example.com or 241430131122"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <WhatsAppHelp />
      </div>
    </AuthLayout>
  );
}
