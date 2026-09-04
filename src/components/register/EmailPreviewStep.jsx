import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BadgeCheck, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

// Shows the Octopod-verified email as a NON-EDITABLE, masked preview.
export default function EmailPreviewStep({ enrollmentNumber, maskedEmail, fullName, onUseEmail }) {
  return (
    <AuthLayout
      icon={BadgeCheck}
      title="Enrollment verified"
      subtitle="This is the email registered with your academic records"
      footer={
        <button onClick={() => window.history.back()} className="inline-flex items-center text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 mr-1" />Back
        </button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Enrollment Number</Label>
          <div className="h-12 flex items-center px-3 rounded-lg border bg-muted/40 font-medium">
            {enrollmentNumber}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Verified Email</Label>
          <div className="h-12 flex items-center px-3 rounded-lg border bg-muted/40 font-medium">
            {maskedEmail}
          </div>
          <p className="text-xs text-muted-foreground">
            This email comes from your institute's records and cannot be changed.
          </p>
        </div>
        <Button className="w-full h-12 font-medium" onClick={onUseEmail}>
          Use this email
        </Button>
      </div>
    </AuthLayout>
  );
}