import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import EnrollmentStep from "@/components/register/EnrollmentStep";
import EmailPreviewStep from "@/components/register/EmailPreviewStep";
import ConfirmEmailStep from "@/components/register/ConfirmEmailStep";
import OtpStep from "@/components/register/OtpStep";
import { safeReturnTo } from "@/lib/authReturnTo";

// Registration flow: enrollment number -> Octopod validation (server-side) ->
// masked verified-email preview -> student re-enters the same email -> email
// OTP verification -> account created -> verified mapping stored -> dashboard.
export default function Register() {
  const [step, setStep] = useState("enrollment");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [finalizeError, setFinalizeError] = useState(false);

  const handleValidateEnrollment = async (enrollment) => {
    setError("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("octopodValidate", { enrollmentNumber: enrollment });
      setEnrollmentNumber(enrollment);
      setMaskedEmail(res.data.maskedEmail);
      setFullName(res.data.fullName);
      setStep("preview");
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === "already_registered") {
        setError("This enrollment number is already registered. Please log in instead.");
      } else if (code === "invalid_enrollment") {
        setError("Enrollment number could not be verified.");
      } else {
        setError("Enrollment verification is unavailable right now. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (enteredEmail, password, validationError) => {
    setError("");
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("octopodConfirmEmail", {
        enrollmentNumber,
        enteredEmail,
      });
      const confirmedEmail = res.data.email;
      setEmail(confirmedEmail);
      await base44.auth.register({ email: confirmedEmail, password });
      setStep("otp");
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === "email_mismatch") {
        setError("The email does not match the email registered with Octopod.");
      } else if (code === "already_registered") {
        setError("This enrollment number is already registered. Please log in instead.");
      } else if (code === "invalid_enrollment") {
        setError("Enrollment number could not be verified. Please start again.");
      } else {
        setError(err?.message || "Could not continue. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const finalize = async () => {
    try {
      await base44.functions.invoke("octopodCompleteRegistration", { enrollmentNumber });
      window.location.href = safeReturnTo();
    } catch {
      setFinalizeError(true);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setFinalizeError(false);
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      await finalize();
    } catch (err) {
      setError(err?.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    await base44.auth.resendOtp(email);
  };

  if (step === "enrollment") {
    return <EnrollmentStep onValidated={handleValidateEnrollment} loading={loading} error={error} />;
  }
  if (step === "preview") {
    return (
      <EmailPreviewStep
        enrollmentNumber={enrollmentNumber}
        maskedEmail={maskedEmail}
        fullName={fullName}
        onUseEmail={() => setStep("confirm")}
      />
    );
  }
  if (step === "confirm") {
    return <ConfirmEmailStep maskedEmail={maskedEmail} onSubmit={handleConfirm} loading={loading} error={error} />;
  }
  return (
    <OtpStep
      email={email}
      maskedEmail={maskedEmail}
      otpCode={otpCode}
      setOtpCode={setOtpCode}
      onVerify={handleVerifyOtp}
      onResend={handleResend}
      loading={loading}
      error={error}
      finalizeError={finalizeError}
      onRetryFinalize={finalize}
    />
  );
}