import React from "react";
import { Clock, GraduationCap } from "lucide-react";

export default function ComingSoonDept({ branch, feature = "This feature" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Clock className="h-8 w-8 text-amber-600" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Coming Soon for {branch}</h2>
      <p className="text-muted-foreground max-w-sm">
        {feature} is not yet available for the <strong>{branch}</strong> department. Our team is working on it — check back soon!
      </p>
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <GraduationCap className="h-4 w-4" />
        <span>Currently live: CSE</span>
      </div>
    </div>
  );
}