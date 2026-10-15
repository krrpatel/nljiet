import roster from "../roster.json" with { type: "json" };

const RATE_LIMIT_WINDOW_MS = Number(process.env.RANK_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RANK_RATE_LIMIT_MAX || 30);
const rateBuckets = new Map();

const json = (res, status, value) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
};

function clientAddress(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown").trim();
}

function allowRequest(req, res) {
  const now = Date.now();
  const address = clientAddress(req);
  const existing = rateBuckets.get(address);
  const bucket = existing && now - existing.startedAt < RATE_LIMIT_WINDOW_MS
    ? existing
    : { startedAt: now, count: 0 };
  bucket.count += 1;
  rateBuckets.set(address, bucket);

  // Keep the in-memory limiter bounded on long-lived local/server instances.
  if (rateBuckets.size > 10_000) {
    for (const [key, value] of rateBuckets) {
      if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key);
    }
  }

  const remaining = Math.max(0, RATE_LIMIT_MAX - bucket.count);
  const retryAfter = Math.max(1, Math.ceil((bucket.startedAt + RATE_LIMIT_WINDOW_MS - now) / 1000));
  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil((bucket.startedAt + RATE_LIMIT_WINDOW_MS) / 1000)));
  if (bucket.count > RATE_LIMIT_MAX) {
    res.setHeader("Retry-After", String(retryAfter));
    json(res, 429, { error: `Too many rank requests. Please retry in ${retryAfter} seconds.` });
    return false;
  }
  return true;
}

const first = (value, keys) => keys.map(key => value?.[key]).find(item => item !== undefined && item !== null && item !== "");
const numberOrNull = value => value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const normalizeExam = value => {
  const type = String(value || "").toLowerCase().replace(/[ _-]/g, "");
  if (type.includes("midsem1") || type.includes("mse1")) return "midsem1";
  if (type.includes("midsem2") || type.includes("mse2")) return "midsem2";
  return null;
};

async function supabaseRows(table, params = "") {
  const base = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error("Supabase is not configured on the server");
  const rows = [];
  for (let start = 0; start < 10000; start += 1000) {
    const response = await fetch(`${base}/rest/v1/${table}?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${start}-${start + 999}`, Prefer: "count=exact" }
    });
    const data = await response.json().catch(() => []);
    if (!response.ok) throw new Error(data.message || data.error || `Could not read ${table}`);
    if (!Array.isArray(data)) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function profileName(profile) {
  const student = profile?.data || profile || {};
  return first(student, ["StudentFullName", "fullName", "name"]) || [student.FirstName, student.MiddleName, student.LastName].filter(Boolean).join(" ").trim();
}

async function octopodName(enrollmentNumber) {
  const base = process.env.OCTOPOD_BASE_URL || "https://octopod.co.in";
  const academyId = process.env.OCTOPOD_ACADEMY_ID || 1627;
  const headers = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0",
    Referer: "https://octopod.co.in/student/admission/0a8283bbbe6a76110b1f44e9db656812"
  };
  const get = async (endpoint, params) => {
    const url = new URL(endpoint, base);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(Number(process.env.OCTOPOD_TIMEOUT_MS || 15000)) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Octopod request failed (${response.status})`);
    return data;
  };
  const years = await get("/ajax/student/academic/years", { AcademyID: academyId, applicationId: enrollmentNumber, isApplicationId: 1 });
  const academicYears = Array.isArray(years)
    ? years
    : Array.isArray(years?.data)
      ? years.data
      : Array.isArray(years?.academicYears)
        ? years.academicYears
        : Object.values(years || {}).filter(value => value && typeof value === "object");
  const year = academicYears[0]?.AYID || academicYears[0]?.ayid || "";
  const profile = await get("/ajax/validate/application", { AcademyID: academyId, applicationId: enrollmentNumber, IsOTPRequired: 0, otp: "", Year: year, paymentCategory: "AcademicFees" });
  return profileName(profile);
}

function identityFor(row, subjectMap, studentMap) {
  const enrollment = String(row.enrollment_number || "").trim();
  const student = studentMap.get(enrollment) || {};
  const fallback = roster[enrollment] || {};
  const subject = subjectMap.get(String(row.subject_id || "")) || {};
  return {
    enrollment_number: enrollment,
    roll_number: numberOrNull(first(row, ["roll_number", "current_roll_number"]) ?? student.roll_number ?? fallback.roll_number),
    branch: String(row.branch || student.branch || fallback.branch || subject.branch || "").toUpperCase(),
    division: row.division || student.division || fallback.division || null,
    full_name: row.full_name || student.full_name || fallback.full_name || "",
  };
}

function allocateDivisions(students, capacity) {
  let division = 1;
  let count = 0;
  let previousScore = null;
  const divisionRolls = new Map();
  return students.map(student => {
    if (count >= capacity && student.ranking_score !== previousScore) {
      division += 1;
      count = 0;
    }
    count += 1;
    previousScore = student.ranking_score;
    const calculatedDivision = `D${division}`;
    const newRollNumber = (divisionRolls.get(calculatedDivision) || 0) + 1;
    divisionRolls.set(calculatedDivision, newRollNumber);
    return {
      ...student,
      calculated_division: calculatedDivision,
      division_rank: newRollNumber,
      new_roll_number: newRollNumber,
    };
  });
}

function aggregate(rows, subjects, students, options) {
  const subjectMap = new Map(subjects.map(subject => [String(subject.id), subject]));
  const studentMap = new Map(students.map(student => [String(student.enrollment_number), student]));
  const groups = new Map();
  for (const row of rows) {
    const exam = normalizeExam(row.exam_type);
    if (!exam || !row.enrollment_number) continue;
    const identity = identityFor(row, subjectMap, studentMap);
    if (options.branch && identity.branch && identity.branch !== options.branch) continue;
    if (options.academicYearId && row.academic_year_id && String(row.academic_year_id) !== options.academicYearId) continue;
    if (!groups.has(identity.enrollment_number)) groups.set(identity.enrollment_number, { ...identity, exams: {} });
    const group = groups.get(identity.enrollment_number);
    group.full_name ||= identity.full_name;
    group.roll_number ??= identity.roll_number;
    group.division ||= identity.division;
    group.branch ||= identity.branch;
    group.exams[exam] ||= {};
    const subjectId = String(row.subject_id || "unknown");
    const marks = numberOrNull(row.marks);
    const existing = group.exams[exam][subjectId];
    if (!existing || String(row.created_at || "") >= String(existing.created_at || "")) {
      group.exams[exam][subjectId] = { marks, created_at: row.created_at || "", subject: subjectMap.get(subjectId) || { id: subjectId, code: subjectId, name: subjectId } };
    }
  }
  const branchSubjects = subjects.filter(subject => subject.active !== false && Number(subject.semester) === options.semester && String(subject.branch || "").toUpperCase() === options.branch);
  const subjectIds = branchSubjects.length ? branchSubjects.map(subject => String(subject.id)) : [...new Set(rows.map(row => String(row.subject_id || "")).filter(Boolean))];
  const maxTotal = subjectIds.length >= 6 ? 720 : subjectIds.length * 2 * 60;
  const calculated = [...groups.values()].map(group => {
    const midsem1 = subjectIds.reduce((sum, id) => sum + (group.exams.midsem1?.[id]?.marks ?? 0), 0);
    const midsem2 = subjectIds.reduce((sum, id) => sum + (group.exams.midsem2?.[id]?.marks ?? 0), 0);
    const totalMarks = midsem1 + midsem2;
    return {
      enrollment_number: group.enrollment_number,
      roll_number: group.roll_number,
      full_name: group.full_name,
      source_division: group.division,
      branch: group.branch || options.branch,
      midsem1_total: midsem1,
      midsem2_total: midsem2,
      total_marks: totalMarks,
      max_marks: maxTotal,
      ranking_score: Math.ceil(totalMarks / 4),
      completed_entries: subjectIds.reduce((count, id) => count + Number(group.exams.midsem1?.[id]?.marks != null) + Number(group.exams.midsem2?.[id]?.marks != null), 0),
      subject_scores: subjectIds.map(id => ({
        subject_id: id,
        code: subjectMap.get(id)?.code || id,
        name: subjectMap.get(id)?.name || id,
        midsem1: group.exams.midsem1?.[id]?.marks ?? null,
        midsem2: group.exams.midsem2?.[id]?.marks ?? null,
      }))
    };
  }).sort((a, b) => b.ranking_score - a.ranking_score || b.total_marks - a.total_marks || String(a.enrollment_number).localeCompare(String(b.enrollment_number)));
  return { students: allocateDivisions(calculated, options.capacity), subjectIds, maxTotal };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  if (!allowRequest(req, res)) return;
  try {
    const url = new URL(req.url, "http://localhost");
    const lookup = String(url.searchParams.get("lookup") || "").trim();
    const lookupType = url.searchParams.get("lookupType") || "auto";
    const branch = String(url.searchParams.get("branch") || process.env.OCTOPOD_DEFAULT_BRANCH || "CSE").trim().toUpperCase();
    const semester = Number(url.searchParams.get("semester") || process.env.OCTOPOD_DEFAULT_SEMESTER || 5);
    const capacity = Math.min(40, Math.max(30, Number(url.searchParams.get("capacity") || 40)));
    const academicYearId = String(url.searchParams.get("academicYearId") || "").trim();
    if (!lookup) return json(res, 400, { error: "Enter an enrollment number or current roll number." });
    const [rows, subjects, students] = await Promise.all([
      supabaseRows("results", `semester=eq.${encodeURIComponent(semester)}&order=created_at.asc`),
      supabaseRows("subjects", `semester=eq.${encodeURIComponent(semester)}&active=eq.true`),
      supabaseRows("students", "select=*")
    ]);
    const subjectMap = new Map(subjects.map(subject => [String(subject.id), subject]));
    const studentMap = new Map(students.map(student => [String(student.enrollment_number), student]));
    const candidates = rows.map(row => identityFor(row, subjectMap, studentMap)).filter(item => item.branch === branch || !item.branch);
    const byEnrollment = lookupType === "roll" || (lookupType === "auto" && !/^\d{10,14}$/.test(lookup))
      ? candidates.find(item => String(item.roll_number) === lookup)
      : candidates.find(item => item.enrollment_number === lookup);
    if (!byEnrollment) return json(res, 404, { error: "No result record matched that enrollment number or current roll number." });
    const result = aggregate(rows, subjects, students, { branch, semester, academicYearId, capacity });
    const target = result.students.find(student => student.enrollment_number === byEnrollment.enrollment_number);
    if (!target) return json(res, 404, { error: "The student was found, but no rankable MSE records exist for this cohort." });
    try { target.full_name = await octopodName(target.enrollment_number) || target.full_name; } catch { /* Stored result name remains a safe fallback. */ }
    const divisionStudents = result.students.filter(student => student.calculated_division === target.calculated_division);
    const divisions = [...new Set(result.students.map(student => student.calculated_division))].map(name => {
      const members = result.students.filter(student => student.calculated_division === name);
      return { name, count: members.length, capacity, percent: Math.min(100, Math.round((members.length / capacity) * 100)) };
    });
    return json(res, 200, {
      target,
      students: divisionStudents,
      divisions,
      settings: { branch, semester, capacity, maxDivisions: 6, maxMarks: result.maxTotal, normalizedRule: "ceil(total marks / 4)" },
      availableExams: [...new Set(rows.map(row => normalizeExam(row.exam_type)).filter(Boolean))].sort()
    });
  } catch (error) {
    console.error("Rank checker failed:", error.message);
    return json(res, 500, { error: "Rank checker could not load results. Confirm the Supabase migration and environment variables are configured." });
  }
}
