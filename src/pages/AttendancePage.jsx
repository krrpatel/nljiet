import React, { useMemo } from "react";
import { usePortal } from "@/lib/portalContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import AttendanceRing from "@/components/AttendanceRing";
import ComingSoonDept from "@/components/ComingSoonDept";
import { calculateAttendancePlan } from "@/lib/attendance";

function getStatusColor(status) {
  const map = { safe: "text-green-600", warning: "text-amber-600", critical: "text-red-600" };
  return map[status] || "text-muted-foreground";
}

function StatusBadge({ status }) {
  const map = { safe: "bg-green-100 text-green-800 border-green-200", warning: "bg-amber-100 text-amber-800 border-amber-200", critical: "bg-red-100 text-red-800 border-red-200" };
  const labels = { safe: "Safe", warning: "Warning", critical: "Critical" };
  return <Badge className={map[status] || ""}>{labels[status] || status}</Badge>;
}

export default function AttendancePage() {
  const { student, subjects, attendanceAgg, overallAtt, loading, isDeptLive } = usePortal();

  const minPct = 75;

  const subjectStats = useMemo(() => {
    return subjects.map(subj => {
      const agg = attendanceAgg[subj.id];
      if (!agg) return { subj, conducted: 0, attended: 0, percentage: null, status: null };
      const calc = calculateAttendancePlan({ attended: agg.attended, conducted: agg.conducted, totalPlanned: agg.conducted, targetPct: minPct });
      return { subj, conducted: agg.conducted, attended: agg.attended, percentage: calc.currentPct, status: calc.status, calc };
    }).filter(s => s.conducted > 0);
  }, [subjects, attendanceAgg]);

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded animate-pulse" />)}</div>
    </div>
  );

  if (!isDeptLive && student) return <ComingSoonDept branch={student.branch} feature="Attendance tracking" />;

  if (!student) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
      <h2 className="text-xl font-semibold mb-2">Student record not found</h2>
      <p className="text-muted-foreground max-w-sm">Your account is not yet linked to a student record. Contact your department admin.</p>
    </div>
  );

  const overallCalc = overallAtt.conducted > 0
    ? calculateAttendancePlan({ attended: overallAtt.attended, conducted: overallAtt.conducted, totalPlanned: overallAtt.conducted, targetPct: minPct })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description={`${student.branch} • Semester ${student.semester}`} />

      {/* Overall summary */}
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        {overallCalc && (
          <div className="flex-shrink-0">
            <AttendanceRing
              percentage={overallCalc.currentPct}
              status={overallCalc.status}
              size={140}
              strokeWidth={12}
            />
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1 w-full">
          <StatCard label="Overall %" value={overallAtt.conducted > 0 ? `${((overallAtt.attended / overallAtt.conducted) * 100).toFixed(1)}%` : "–"} accent={overallCalc?.status === "safe" ? "emerald" : overallCalc?.status === "warning" ? "amber" : "rose"} />
          <StatCard label="Conducted" value={overallAtt.conducted} sub="total lectures" />
          <StatCard label="Attended" value={overallAtt.attended} sub="lectures" />
          {overallCalc && overallCalc.status !== "safe" && (
            <div className="col-span-2 sm:col-span-3">
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 text-sm text-amber-800">
                  {overallCalc.canBunk > 0
                    ? `You can bunk ${overallCalc.canBunk} more lectures overall and still stay at ${minPct}%.`
                    : `You need to attend ${overallCalc.mustAttend} more lectures to reach ${minPct}%.`}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Subject-wise cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Subject-wise Attendance</h2>
        {subjectStats.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No attendance data available yet. Admin will upload the weekly PDF.</CardContent></Card>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjectStats.map(({ subj, conducted, attended, percentage, status, calc }) => (
            <Card key={subj.id} className={status === "critical" ? "border-red-200" : status === "warning" ? "border-amber-200" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">{subj.name}</p>
                    <p className="text-xs text-muted-foreground">{subj.code}</p>
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <AttendanceRing percentage={percentage} status={status} size={72} strokeWidth={7} />
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Conducted:</span> <strong>{conducted}</strong></p>
                    <p><span className="text-muted-foreground">Attended:</span> <strong>{attended}</strong></p>
                    <p><span className="text-muted-foreground">Required:</span> <strong>{minPct}%</strong></p>
                  </div>
                </div>
                {calc && (
                  <div className={`text-xs p-2 rounded-md ${status === "safe" ? "bg-green-50 text-green-700" : status === "warning" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                    {status === "safe"
                      ? calc.canBunk > 0 ? `Can miss ${calc.canBunk} more lectures safely.` : "At minimum threshold."
                      : `Need to attend ${calc.mustAttend} more lectures to reach ${minPct}%.`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}