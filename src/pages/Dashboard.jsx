import React, { useMemo } from "react";
import { usePortal } from "@/lib/portalContext";
import { aggregateAttendanceBySubject, overallAttendance, subjectById } from "@/lib/portalData";
import { calculateAttendancePlan, DEFAULT_TOTAL_PLANNED, statusLabel } from "@/lib/attendance";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import AttendanceRing from "@/components/AttendanceRing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, GraduationCap, ClipboardList, Wallet, AlertTriangle, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export default function Dashboard() {
  const { student, portal, academic, loading } = usePortal();

  const data = useMemo(() => {
    if (!portal || !academic || !student) return null;
    const { subjects, attSettings } = portal;
    const targetPct = attSettings[0]?.minimum_percentage || 75;
    const agg = aggregateAttendanceBySubject(academic.attendance);
    const overall = overallAttendance(agg);
    const subjectPlans = Object.entries(agg).map(([sid, v]) => {
      const plan = calculateAttendancePlan({ attended: v.attended, conducted: v.conducted, totalPlanned: DEFAULT_TOTAL_PLANNED, targetPct });
      return { subject: subjectById(subjects, sid), plan, conducted: v.conducted, attended: v.attended };
    });
    const belowMin = subjectPlans.filter((p) => p.plan.status !== "safe").length;
    const publishedResults = academic.results.filter((r) => r.published);
    const latestAvg = publishedResults.length
      ? Math.round((publishedResults.reduce((s, r) => s + (r.marks / r.max_marks) * 100, 0) / publishedResults.length) * 10) / 10
      : null;
    const myAssignments = academic.studentAssignments;
    const pending = myAssignments.filter((a) => a.status === "pending" || a.status === "overdue").length;
    const completed = myAssignments.filter((a) => a.status === "completed").length;
    const fee = academic.feeStatus;
    return { targetPct, overall, subjectPlans, belowMin, latestAvg, pending, completed, fee, publishedResults };
  }, [portal, academic, student]);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <EmptyState />;

  const chartData = data.subjectPlans.map((p) => ({
    name: p.subject?.abbreviation || "?",
    attendance: p.plan.currentPct || 0,
    target: data.targetPct,
  }));
  const assignmentPie = [
    { name: "Completed", value: data.completed, color: "#10b981" },
    { name: "Pending", value: data.pending, color: "#f59e0b" },
  ];

  return (
    <div>
      <PageHeader title={`Welcome, ${student.first_name || student.full_name.split(" ")[0]}`} description={`Semester ${student.current_semester} • ${student.branch} • Division ${student.division}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Overall Attendance" value={data.overall.percentage == null ? "—" : `${data.overall.percentage}%`} sub={`${data.overall.attended}/${data.overall.conducted} lectures`} icon={CalendarCheck} accent="emerald" />
        <StatCard label="Below Minimum" value={data.belowMin} sub={`Target ${data.targetPct}%`} icon={AlertTriangle} accent={data.belowMin > 0 ? "rose" : "emerald"} />
        <StatCard label="Current Semester" value={student.current_semester} sub={student.branch} icon={GraduationCap} accent="blue" />
        <StatCard label="Latest Avg" value={data.latestAvg == null ? "—" : `${data.latestAvg}%`} sub={`${data.publishedResults.length} results`} icon={TrendingUp} accent="violet" />
        <StatCard label="Pending Assignments" value={data.pending} sub="to complete" icon={ClipboardList} accent="amber" />
        <StatCard label="Completed" value={data.completed} sub="assignments" icon={ClipboardList} accent="emerald" />
        <StatCard label="Fee Outstanding" value={data.fee ? `₹${data.fee.outstanding_amount.toLocaleString()}` : "—"} sub={data.fee?.emi_enabled ? "EMI enabled" : "—"} icon={Wallet} accent={data.fee?.outstanding_amount > 0 ? "rose" : "emerald"} />
        <StatCard label="Mentor" value={student.mentor || "—"} sub="academic guide" icon={GraduationCap} accent="primary" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Subject-wise Attendance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="text-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="attendance" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="target" fill="#e5e7eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Assignment Completion</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={assignmentPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                  {assignmentPie.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-64 rounded bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 rounded-lg bg-muted" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-lg bg-muted lg:col-span-2" />
        <div className="h-72 rounded-lg bg-muted" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-lg font-medium">No student data found</p>
      <p className="mt-1 text-sm text-muted-foreground">Your profile has not been linked yet. Please contact the admin.</p>
    </div>
  );
}