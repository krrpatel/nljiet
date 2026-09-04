import React from "react";
import { usePortal } from "@/lib/portalContext";
import { overallAttendance, aggregateAttendanceBySubject } from "@/lib/portalData";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage() {
  const { student, portal, academic, loading } = usePortal();

  if (loading || !student) return <div className="animate-pulse h-72 rounded-lg bg-muted" />;

  const agg = aggregateAttendanceBySubject(academic?.attendance || []);
  const overall = overallAttendance(agg);
  const ay = portal?.years.find((y) => y.id === student.academic_year_id);

  const fields = [
    { label: "Full Name", value: student.full_name },
    { label: "Enrollment Number", value: student.enrollment_number },
    { label: "Student ID", value: student.student_id },
    { label: "Branch", value: student.branch },
    { label: "Division", value: student.division },
    { label: "Semester", value: student.current_semester },
    { label: "Medium", value: student.medium },
    { label: "Mentor", value: student.mentor },
    { label: "Father's Name", value: student.father_name },
    { label: "Email", value: student.email },
    { label: "Phone", value: student.phone },
    { label: "Academic Year", value: ay?.title || "—" },
    { label: "UID Number", value: mask(student.uid_number) },
    { label: "GR Number", value: mask(student.gr_number) },
  ];

  return (
    <div>
      <PageHeader title="Profile" description="Your academic information imported from Octopod" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Personal & Academic Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.label} className="border-b pb-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="mt-1 text-sm font-medium">{f.value || "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Quick Stats</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Overall Attendance" value={overall.percentage == null ? "—" : `${overall.percentage}%`} />
              <Row label="Lectures Attended" value={`${overall.attended}/${overall.conducted}`} />
              <Row label="Results Published" value={`${(academic?.results || []).filter(r => r.published).length}`} />
              <Row label="Data Source" value={student.source || "octopod"} />
              <Row label="Status" value={student.status || "active"} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function mask(v) {
  if (!v) return "—";
  const s = String(v);
  if (s.length <= 4) return s;
  return `${s.slice(0, 2)}••••${s.slice(-2)}`;
}