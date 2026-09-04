import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Mail } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import WhatsAppHelp from "@/components/WhatsAppHelp";

export default function EmailVerificationNotice({ email, onContinue, loading, error }) {
  return <AuthLayout icon={CheckCircle} title="Check your email" subtitle="We've sent you a verification link">
    <div className="space-y-4 text-center">
      <Mail className="mx-auto h-10 w-10 text-primary" />
      <p className="text-sm">Open the link sent to <strong>{email}</strong> to verify your account.</p>
      <p className="text-sm text-muted-foreground">If you don’t see it, check your <strong>spam or junk folder</strong>.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" onClick={onContinue} disabled={loading}>{loading ? "Checking..." : "I verified my email"}</Button>
      <WhatsAppHelp />
      <p className="text-xs text-muted-foreground"><Link className="underline" to="/login">Return to login</Link></p>
    </div>
  </AuthLayout>;
}
