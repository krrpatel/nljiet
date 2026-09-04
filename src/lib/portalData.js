import { base44 } from "@/api/base44Client";

// Demo: the portal maps the logged-in user to a student by email, falling
// back to the first student record so the experience is always populated.
export async function getCurrentStudent() {
  let me = null;
  try {
    me = await base44.auth.me();
  } catch {
    me = null;
  }
  const all = await base44.entities.Students.list();
  if (me?.email) {
    const match = all.find((s) => s.email?.toLowerCase() === me.email.toLowerCase());
    if (match) return match;
  }
  return all[0] || null;
}

export async function loadPortalData() {
  const [subjects, years, attSettings, adminSettings, students] = await Promise.all([
    base44.entities.Subjects.list(),
    base44.entities.AcademicYears.list(),
    base44.entities.AttendanceSettings.list(),
    base44.entities.AdminSettings.list(),
    base44.entities.Students.list(),
  ]);
  return { subjects, years, attSettings, adminSettings, students };
}

export async function loadStudentAcademicData(studentId, enrollmentNumber) {
  const [attendance, results, assignments, studentAssignments, feeStatus, feeReceipts] = await Promise.all([
    base44.entities.Attendance.filter({ student_id: studentId }),
    base44.entities.Results.filter({ enrollment_number: enrollmentNumber }),
    base44.entities.Assignments.list(),
    base44.entities.StudentAssignments.filter({ student_id: studentId }),
    base44.entities.FeeStatus.filter({ student_id: studentId }),
    base44.entities.FeeReceipts.filter({ student_id: studentId }),
  ]);
  return { attendance, results, assignments, studentAssignments, feeStatus: feeStatus[0], feeReceipts };
}

export function subjectById(subjects, id) {
  return subjects.find((s) => s.id === id);
}

// Aggregate weekly attendance into per-subject totals
export function aggregateAttendanceBySubject(attendanceRecords) {
  const map = {};
  for (const r of attendanceRecords) {
    if (!map[r.subject_id]) map[r.subject_id] = { conducted: 0, attended: 0, weeks: [] };
    map[r.subject_id].conducted += r.conducted_lectures || 0;
    map[r.subject_id].attended += r.attended_lectures || 0;
    map[r.subject_id].weeks.push(r);
  }
  return map;
}

export function overallAttendance(agg) {
  let conducted = 0;
  let attended = 0;
  for (const k of Object.keys(agg)) {
    conducted += agg[k].conducted;
    attended += agg[k].attended;
  }
  return { conducted, attended, percentage: conducted > 0 ? Math.round((attended / conducted) * 10000) / 100 : null };
}