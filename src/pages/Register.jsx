import React, { useState } from "react";
import { api } from "@/api/client";
import EnrollmentStep from "@/components/register/EnrollmentStep";
import EmailPreviewStep from "@/components/register/EmailPreviewStep";
import ConfirmEmailStep from "@/components/register/ConfirmEmailStep";
import { safeReturnTo } from "@/lib/authReturnTo";

// Registration flow: enrollment number -> Octopod validation (server-side) ->
// masked verified-email preview -> student re-enters the same email -> email
// and password -> direct Supabase account creation -> verified mapping stored -> dashboard.
export default function Register() {
  const [step, setStep] = useState("enrollment");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validatedProfile, setValidatedProfile] = useState(null);
  const [registrationDetails, setRegistrationDetails] = useState({ branch: "CSE", division: "D1" });

  const handleValidateEnrollment = async (enrollment, details) => {
    setError("");
    setLoading(true);
    try {
      const res = await api.functions.invoke("octopodValidate", { enrollmentNumber: enrollment });
      setEnrollmentNumber(enrollment);
      window.localStorage.setItem("portal_enrollment_number", enrollment);
      setValidatedProfile(res.data);
      setRegistrationDetails(details || { branch: "CSE", division: "D1" });
      setMaskedEmail(res.data.maskedEmail);
      setFullName(res.data.fullName);
      setStep("preview");
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === "already_registered") {
        setError("This enrollment number is already registered. Please log in instead.");
      } else if (code === "invalid_enrollment") {
        setError("Enrollment number could not be verified.");
      } else if (code === "octopod_unavailable") {
        setError("Octopod is temporarily unavailable. Please try again in a moment.");
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
      const res = await api.functions.invoke("octopodConfirmEmail", {
        enrollmentNumber,
        enteredEmail,
      });
      const confirmedEmail = res.data.email;
      const registration = await api.auth.register({ email: confirmedEmail, password, enrollmentNumber });
      if (!registration?.session) {
        throw new Error("Direct registration is not enabled. Turn off Supabase Auth → Email → Confirm email, then try again.");
      }
      await api.functions.invoke("octopodCompleteRegistration", { enrollmentNumber, email: confirmedEmail, profile: { ...validatedProfile, ...registrationDetails } });
      window.location.href = safeReturnTo();
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === "email_mismatch") {
        setError("The email does not match the email registered with Octopod.");
      } else if (code === "already_registered") {
        setError("This enrollment number is already registered. Please log in instead.");
      } else if (code === "invalid_enrollment") {
        setError("Enrollment number could not be verified. Please start again.");
      } else if (code === "octopod_unavailable") {
        setError("Octopod is temporarily unavailable. Please try again in a moment.");
      } else {
        setError(err?.message || "Could not continue. Please try again.");
      }
    } finally {
      setLoading(false);
    }
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
  return null;
}
