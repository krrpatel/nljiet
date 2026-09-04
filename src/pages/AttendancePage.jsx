import React, { useMemo } from "react";
import { usePortal } from "@/lib/portalContext";
import { aggregateAttendanceBySubject, overallAttendance, subjectById } from "@/lib/portalData";
import { calculateAttendancePlan, DEFAULT_TOTAL_PLANNED, statusLabel, statusColor } from "@/lib/attendance";
import PageHeader from "@/components/PageHeader";
import AttendanceRing from "@/components/AttendanceRing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function AttendancePage() {
  const { student, portal, academic, loading } = usePortal();

  const { overall, subjectPlans, targetPct } = useMemo(() => {
    if (!portal || !academic) return { overall: { percentage: null, attended: 0, conducted: 0 }, subjectPlans: [], targetPct: 75 };
    const targetPct = portal.attSettings[0]?.minimum_percentage || 75;
    const agg = aggregateAttendanceBySubject(academic.attendance);
    const overall = overallAttendance(agg);
    const subjectPlans = Object.entries(agg).map(([sid, v]) => {
      const plan = calculateAttendancePlan({ attended: v.attended, conducted: v.conducted, totalPlanned: DEFAULT_TOTAL_PLANNED, targetPct });
      return { subject: subjectById(portal.subjects, sid), plan, conducted: v.conducted, attended: v.attended, weeks: v.weeks };
    });
    return { overall, subjectPlans, targetPct };
  }, [portal, academic]);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 rounded bg-muted" /><div className="h-64 rounded-lg bg-muted" /></div>;

  const overallPlan = calculateAttendancePlan({ attended: overall.attended, conducted: overall.conducted, totalPlanned: DEFAULT_TOTAL_PLANNED * (subjectPlans.length || 1), targetPct });

  return (
    <div>
      <PageHeader title="Attendance" description={`Minimum required: ${targetPct}% • Semester ${student?.current_semester}`} />
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-6 py-8 sm:flex-row sm:justify-around">
          <div className="flex flex-col items-center">
            <AttendanceRing percentage={overall.percentage} status={overallPlan.status} size={160} />
            <p className="mt-3 text-sm font-medium">Overall Attendance</p>
            <p className="text-xs text-muted-foreground">{overall.attended} / {overall.conducted} lectures attended</p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Metric label="Target" value={`${targetPct}%`} />
            <Metric label="Status" value={statusLabel(overallPlan.status)} color={statusColor(overallPlan.status)} />
            <Metric label="Can still miss" value={`${overallPlan.canBunk} lectures`} />
            <Metric label="Must attend" value={`${overallPlan.mustAttend} of ${overallPlan.remaining}`} />
            <Metric label="Max possible" value={overallPlan.maxPossiblePct == null ? "—" : `${overallPlan.maxPossiblePct}%`} />
            <Metric label="If semester ended" value={`${overallPlan.canBunkIfSemesterEndedToday} spare`} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {subjectPlans.map(({ subject, plan, conducted, attended }) => (
          <Card key={subject?.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{subject?.name}</CardTitle>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", toneBadge(plan.status))}>
                  {statusLabel(plan.status)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{subject?.abbreviation} • {subject?.branch}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <AttendanceRing percentage={plan.currentPct} status={plan.status} size={90} stroke={9} />
                <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-xs pl-4">
                  <Metric label="Current" value={plan.currentPct == null ? "—" : `${plan.currentPct}%`} />
                  <Metric label="Attended" value={`${attended}/${conducted}`} />
                  <Metric label="Can miss" value={`${plan.canBunk}`} />
                  <Metric label="Must attend" value={`${plan.mustAttend}/${plan.remaining}`} />
                  <Metric label="Projected" value={plan.maxPossiblePct == null ? "—" : `${plan.maxPossiblePct}%`} />
                  <Metric label="Spare if ended" value={`${plan.canBunkIfSemesterEndedToday}`} />
                </div>
              </div>
              {!plan.achievable && (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {targetPct}% is no longer reachable. Best possible: {plan.maxPossiblePct}%
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {subjectPlans.length === 0 && (
          <Card className="md:col-span-2"><CardContent className="py-12 text-center text-sm text-muted-foreground">No attendance records yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, color }) {
  const colors = { emerald: "text-emerald-600", amber: "text-amber-600", rose: "text-rose-600" };
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={cn("font-semibold", color && colors[color])}>{value}</p>
    </div>
  );
}

function toneBadge(status) {
  if (status === "safe") return "bg-emerald-100 text-emerald-700";
  if (status === "warning") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}