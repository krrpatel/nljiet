import { api } from "@/api/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = value => UUID.test(String(value || ""));

// Demo: the portal maps the logged-in user to a student by email, falling
// back to the first student record so the experience is always populated.
export async function getCurrentStudent(me) {
  if (!me) {
    try { me = await api.auth.me(); } catch { return null; }
  }
  const all = await api.entities.Students.list();
  if (me?.email) {
    const match = all.find((s) => s.email?.toLowerCase() === me.email.toLowerCase()) || all.find((s) => s.enrollment_number === me.user_metadata?.enrollment_number);
    if (match) return match;
    const enrollment = me.user_metadata?.enrollment_number || (typeof window !== "undefined" ? window.localStorage.getItem("portal_enrollment_number") : null);
    if (enrollment) {
      try {
        const remote = await api.functions.invoke("octopodFees", { enrollmentNumber: enrollment });
        const p = remote.data?.profile || {};
        return { enrollment_number: enrollment, email: me.email, full_name: p.fullName || p.StudentFullName || "", student_id: String(p.StudentID || ""), uid_number: String(p.UIDNumber || ""), branch: p.branch || p.Branch || p.Department || "CSE", semester: Number(p.semester || p.currentSemester || p.academicYears?.length || 1), academic_year_id: String(p.AcademicYearID || "") };
      } catch { return null; }
    }
    return null;
  }
  return null;
}

export async function loadPortalData() {
  const [subjects, years, attSettings, adminSettings, students] = await Promise.all([
    api.entities.Subjects.list(),
    api.entities.AcademicYears.list(),
    api.entities.AttendanceSettings.list(),
    api.entities.AdminSettings.list(),
    api.entities.Students.list(),
  ]);
  return { subjects, years, attSettings, adminSettings, students };
}

export async function loadStudentAcademicData(studentId, enrollmentNumber, branch, semester) {
  const safe = promise => promise.catch(() => []);
  const localStudentId = isUuid(studentId) ? studentId : null;
  const [attendance, results, assignments, studentAssignments, feeStatus, feeReceipts, octopodFees, resultRank] = await Promise.all([
    safe(api.entities.Attendance.filter({ enrollment_number: enrollmentNumber })),
    safe(api.entities.Results.filter({ enrollment_number: enrollmentNumber })),
    safe(api.entities.Assignments.list()),
    localStudentId ? safe(api.entities.StudentAssignments.filter({ student_id: localStudentId })) : Promise.resolve([]),
    localStudentId ? safe(api.entities.FeeStatus.filter({ student_id: localStudentId })) : Promise.resolve([]),
    localStudentId ? safe(api.entities.FeeReceipts.filter({ student_id: localStudentId })) : Promise.resolve([]),
    api.functions.invoke("octopodFees", { enrollmentNumber }).catch(() => ({ data: null })),
    api.functions.invoke("resultRank", { enrollmentNumber, branch, semester }).catch(() => ({ data: null })),
  ]);
  return { attendance, results, assignments, studentAssignments, resultRank: resultRank.data || null, feeStatus: feeStatus[0] || octopodFees.data?.feeStatus, feeReceipts: feeReceipts.length ? feeReceipts : (octopodFees.data?.feeReceipts || []), octopodProfile: octopodFees.data?.profile || null };
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
