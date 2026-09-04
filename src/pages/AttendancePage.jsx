import React, { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/lib/portalContext";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
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
  const { student, portal, subjects, attendanceAgg, overallAtt, loading, isDeptLive } = usePortal();

  const configuredMinimum = Number(portal?.adminSettings?.[0]?.minimum_attendance_percentage);
  const configuredMaximum = Number(portal?.adminSettings?.[0]?.maximum_lectures);
  const minPct = Number.isFinite(configuredMinimum) ? Math.min(100, Math.max(50, configuredMinimum)) : 75;
  const maximumLectures = Number.isFinite(configuredMaximum) ? Math.min(250, Math.max(1, configuredMaximum)) : 250;
  const [targetPct, setTargetPct] = useState(minPct);

  useEffect(() => { setTargetPct(minPct); }, [minPct]);

  const subjectStats = useMemo(() => {
    return subjects.map(subj => {
      const agg = attendanceAgg[subj.id];
      if (!agg) return { subj, conducted: 0, attended: 0, percentage: null, status: null };
      const calc = calculateAttendancePlan({ attended: agg.attended, conducted: agg.conducted, totalPlanned: agg.conducted, targetPct: minPct });
      // Percentages always come from the imported lecture counts. The PDF's
      // displayed percentage and any admin-entered subject percentage are not
      // used. Below the required threshold is always shown in red.
      const status = calc.currentPct != null && calc.currentPct < minPct ? "critical" : "safe";
      return { subj, conducted: agg.conducted, attended: agg.attended, percentage: calc.currentPct, status, calc };
    }).filter(s => s.conducted > 0);
  }, [subjects, attendanceAgg, minPct]);

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
    ? calculateAttendancePlan({ attended: overallAtt.attended, conducted: overallAtt.conducted, totalPlanned: Math.max(overallAtt.conducted, maximumLectures), targetPct })
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
                    ? `You can bunk ${overallCalc.canBunk} more lectures overall and still stay at ${targetPct}%.`
                    : `You need to attend ${overallCalc.mustAttend} more lectures to reach ${targetPct}%.`}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {overallCalc && (
        <Card>
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Attendance planner</h2>
                <p className="text-sm text-muted-foreground">Choose the attendance percentage you want to keep.</p>
              </div>
              <Badge variant="outline" className="text-base">Target {targetPct}%</Badge>
            </div>
            <div className="space-y-2">
              <input aria-label="Target attendance percentage" className="w-full accent-primary" type="range" min="50" max="100" step="1" value={targetPct} onChange={event => setTargetPct(Number(event.target.value))} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>50%</span><span>100%</span></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>Current attendance</span><strong>{overallCalc.currentPct}%</strong></div>
              <Progress value={Math.min(100, overallCalc.currentPct || 0)} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>{overallAtt.attended} attended of {overallAtt.conducted} conducted</span><span>{overallCalc.total} total planned</span></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Can miss" value={overallCalc.canBunk} sub={`of ${overallCalc.remaining} remaining`} accent="emerald" />
              <StatCard label="Must attend" value={overallCalc.mustAttend} sub={`to finish at ${targetPct}%`} accent="blue" />
              <StatCard label="Planned total" value={overallCalc.total} sub={`admin maximum ${maximumLectures}`} accent="violet" />
            </div>
            <p className="text-xs text-muted-foreground">
              {overallCalc.achievable
                ? `You can miss ${overallCalc.canBunk} of the ${overallCalc.remaining} lectures still available and finish at or above ${targetPct}%.`
                : `The ${targetPct}% target is not reachable with the current ${overallCalc.total}-lecture limit; attend every remaining lecture.`}
            </p>
          </CardContent>
        </Card>
      )}

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
