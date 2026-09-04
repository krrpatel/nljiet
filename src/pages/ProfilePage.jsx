import React from "react";
import { usePortal } from "@/lib/portalContext";
import { overallAttendance, aggregateAttendanceBySubject } from "@/lib/portalData";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage() {
  const { student, portal, academic, loading, currentUser, feeStatus, feeReceipts } = usePortal();

  if (loading) return <div className="animate-pulse h-72 rounded-lg bg-muted" />;
  const profile = student || { email: currentUser?.email, full_name: currentUser?.user_metadata?.full_name, enrollment_number: currentUser?.user_metadata?.enrollment_number };
  const octo = academic?.octopodProfile || {};
  const value = (localValue, ...remoteKeys) => localValue || remoteKeys.map(key => octo[key]).find(Boolean);
  const semester = value(profile.current_semester || profile.semester, "semester", "CurrentSemester") || "—";
  const octopodBirthDate = octo.BirthDate || octo.birthDate;
  const octopodAge = Number(octo.Age);
  const calculatedAge = octopodAge > 0 ? octopodAge : calculateAge(octopodBirthDate);
  const academicYearId = profile.academic_year_id || octo.AcademicYearID || octo.currentYear;

  const agg = aggregateAttendanceBySubject(academic?.attendance || []);
  const overall = overallAttendance(agg);
  const ay = portal?.years.find((y) => y.id === academicYearId || String(y.ayid) === String(academicYearId));

  const fields = [
    { label: "Full Name", value: value(profile.full_name, "StudentFullName", "fullName") }, { label: "Enrollment Number", value: profile.enrollment_number || currentUser?.user_metadata?.enrollment_number }, { label: "Student ID", value: value(profile.student_id, "StudentID") }, { label: "Branch", value: value(profile.branch, "Branch", "BranchName", "Department") }, { label: "Division", value: value(profile.division, "Division", "DivisionName", "DivisionID") }, { label: "Semester", value: semester }, { label: "Medium", value: value(profile.medium, "Medium", "MediumName", "MediumID") }, { label: "Mentor", value: value(profile.mentor, "Mentor", "MentorName") }, { label: "Father's Name", value: value(profile.father_name, "fatherName", "FatherName") }, { label: "Email", value: profile.email || currentUser?.email }, { label: "Phone", value: value(profile.phone, "ContactNo") },
    { label: "Academic Year", value: ay?.title || octo.AcademicYearTitle || academicYearId || "—" },
    { label: "UID Number", value: mask(value(profile.uid_number, "UIDNumber")) }, { label: "GR Number", value: mask(value(profile.gr_number, "GRNumber")) },
  ];
  const additionalOctopodFields = [
    ["SMID", octo.SMID], ["First Name", octo.FirstName], ["Middle Name", octo.MiddleName], ["Last Name", octo.LastName],
    ["Gender", octo.Gender], ["Birth Date", octo.BirthDate], ["Age", calculatedAge], ["Admission Date", octo.AdmissionDate],
    ["Address Line1", octo.AddressLine1], ["Address Line2", octo.AddressLine2], ["City", octo.City], ["State", octo.State],
    ["Country", octo.Country], ["Zip Code", octo.ZipCode], ["Email Address", octo.EmailAddress], ["Image", octo.Image],
    ["Academy ID", octo.AcademyID], ["Type", octo.Type], ["Adhar Number", octo.AdharNumber], ["Is Single Girl Child", octo.IsSingleGirlChild],
    ["Blood Group", octo.BloodGroup], ["Last School", octo.LastSchool], ["Last School Details", octo.LastSchoolDetails],
    ["Last Board", octo.LastBoard], ["Last Medium", octo.LastMedium], ["Last School Percent", octo.LastSchoolPercent],
    ["Category", octo.Category], ["Annual Income", octo.AnnualIncome], ["Is NRI", isTrue(octo.IsNRI)], ["Semester", semester]
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
              <Row label="Data Source" value={profile.source || "octopod"} />
              <Row label="Status" value={profile.status || "active"} />
              <Row label="Payable Fees" value={feeStatus?.payable_amount != null ? `${feeStatus.currency || "₹"} ${feeStatus.payable_amount}` : "—"} />
              <Row label="Outstanding Fees" value={feeStatus?.outstanding_amount != null ? `${feeStatus.currency || "₹"} ${feeStatus.outstanding_amount}` : "—"} />
              <Row label="Fee Receipts" value={feeReceipts.length} />
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Fee Receipts</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{feeReceipts.length ? feeReceipts.map((r, index) => <div key={r.id || r.voucher_number || index} className="flex justify-between border-b pb-2"><span>{r.fee_type || r.voucher_number || "Receipt"}</span><span>₹ {Number(r.amount) || "—"}</span></div>) : <p className="text-muted-foreground">No fee receipts available.</p>}</CardContent></Card>
        </div>
        {additionalOctopodFields.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader><CardTitle>Additional Octopod information</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {additionalOctopodFields.map(([key, fieldValue]) => <div key={key} className="border-b pb-3"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{key}</dt><dd className="mt-1 break-words text-sm font-medium">{fieldValue === undefined || fieldValue === null || fieldValue === "" ? "—" : String(fieldValue)}</dd></div>)}
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function calculateAge(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/) || text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return "—";
  const [, firstPart, secondPart, thirdPart] = match;
  const iso = firstPart.length === 4;
  const day = Number(iso ? thirdPart : firstPart);
  const month = Number(secondPart);
  const year = Number(iso ? firstPart : thirdPart);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return "—";
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age -= 1;
  return Math.max(0, age);
}

function isTrue(value) {
  return value === true || value === 1 || String(value).trim() === "1" ? "True" : "False";
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
