import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";

export default function OtpStep({
  email,
  maskedEmail,
  otpCode,
  setOtpCode,
  onVerify,
  onResend,
  loading,
  error,
  finalizeError,
  onRetryFinalize,
}) {
  const handleResend = async () => {
    try {
      await onResend();
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch {
      /* onResend surfaces its own error */
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Verify your email"
      subtitle={`Verification code sent to ${maskedEmail || email}`}
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}
      {finalizeError && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          Your email is verified, but we couldn't finalize your registration.
          <Button variant="outline" className="mt-2 w-full" onClick={onRetryFinalize}>
            Retry
          </Button>
        </div>
      )}
      <div className="flex justify-center mb-6">
        <InputOTP
          maxLength={6}
          value={otpCode}
          onChange={setOtpCode}
          autoFocus
          autoComplete="one-time-code"
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button
        className="w-full h-12 font-medium"
        onClick={onVerify}
        disabled={loading || otpCode.length < 6 || finalizeError}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verifying...
          </>
        ) : (
          "Verify"
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground mt-4">
        Didn't receive the code?{" "}
        <button onClick={handleResend} className="text-primary font-medium hover:underline">
          Resend
        </button>
      </p>
    </AuthLayout>
  );
}