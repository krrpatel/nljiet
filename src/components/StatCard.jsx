import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export default function StatCard({ label, value, sub, icon: Icon, accent = "primary" }) {
  const accents = {
    primary: "text-primary",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    blue: "text-blue-600",
    violet: "text-violet-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn("rounded-lg bg-muted p-2.5", accents[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}