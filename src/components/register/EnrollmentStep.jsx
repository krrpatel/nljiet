import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Hash } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Link } from "react-router-dom";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function EnrollmentStep({ onValidated, loading, error }) {
  const [enrollmentNumber, setEnrollmentNumber] = useState("");

  const submit = (e) => {
    e.preventDefault();
    onValidated(enrollmentNumber.trim());
  };

  return (
    <AuthLayout
      icon={Hash}
      title="Student registration"
      subtitle="Enter your enrollment number to begin"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-primary font-medium hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="enrollment">Enrollment Number</Label>
          <Input
            id="enrollment"
            type="text"
            inputMode="numeric"
            autoFocus
            placeholder="e.g. 241430131122"
            value={enrollmentNumber}
            onChange={(e) => setEnrollmentNumber(e.target.value)}
            className="h-12"
            required
          />
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading || !enrollmentNumber.trim()}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </form>
      <div className="mt-6 flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">
          Your enrollment number and email are verified against your academic institution's records.
          You cannot register with an arbitrary enrollment number or email.
        </p>
      </div>
    </AuthLayout>
  );
}