// Pure attendance calculation engine — UI-free, reusable.
// Implements the exact mathematical model from the spec.

export const DEFAULT_TOTAL_PLANNED = 40; // per-subject semester lecture estimate (configurable)

function normInt(n) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * calculateAttendancePlan
 * @param {number} attended
 * @param {number} conducted
 * @param {number} totalPlanned
 * @param {number} targetPct  (50-100)
 * @returns {object}
 */
export function calculateAttendancePlan({ attended, conducted, totalPlanned, targetPct }) {
  const a = normInt(attended);
  const c = normInt(conducted);
  let total = normInt(totalPlanned);
  if (total < c) total = c;
  let target = Number(targetPct);
  if (!Number.isFinite(target) || target < 0) target = 0;
  if (target > 100) target = 100;

  const remaining = Math.max(0, total - c);
  const currentPct = c > 0 ? round2((a / c) * 100) : null;
  const maxPossiblePct = total > 0 ? round2(((a + remaining) / total) * 100) : null;

  const mustAttend = Math.max(0, Math.ceil((target / 100) * total) - a);
  const achievable = mustAttend <= remaining;
  const canBunk = achievable ? Math.max(0, remaining - mustAttend) : 0;

  const canBunkIfSemesterEndedToday =
    target > 0 ? Math.max(0, Math.floor((100 * a) / target) - c) : 0;

  let status;
  if (currentPct === null || currentPct >= target) status = "safe";
  else if (achievable) status = "warning";
  else status = "critical";

  return {
    attended: a,
    conducted: c,
    remaining,
    total,
    targetPct: target,
    currentPct,
    maxPossiblePct,
    mustAttend,
    canBunk,
    achievable,
    canBunkIfSemesterEndedToday,
    status,
  };
}

/**
 * Calibrate total against actual timetable delivery.
 */
export function calibrateTotal({ plannedInWindow, actualInWindow, conducted, plannedRemaining }) {
  const pw = normInt(plannedInWindow);
  const aw = normInt(actualInWindow);
  const cond = normInt(conducted);
  const pr = normInt(plannedRemaining);
  const delta = aw - pw;
  const factor = pw > 0 ? aw / pw : 1;
  const calibratedTotal = cond + Math.round(pr * factor);
  const significantlyDifferent = Math.abs(delta) > 2;
  return { delta, factor, calibratedTotal, significantlyDifferent };
}

/**
 * Plan time off over a date range — counts only scheduled teaching lectures.
 * @param {Array<{date:string,planned_lectures:number,teaching_day:boolean,holiday:boolean}>} days
 * @param {string} fromDate  (YYYY-MM-DD)
 * @param {string} toDate
 */
export function planTimeOff(days, fromDate, toDate, { attended, conducted, totalPlanned, targetPct }) {
  const inRange = (days || []).filter((d) => {
    return d.date >= fromDate && d.date <= toDate && d.teaching_day && !d.holiday && (d.planned_lectures || 0) > 0;
  });
  const plannedMissedLectures = inRange.reduce((sum, d) => sum + normInt(d.planned_lectures), 0);
  const plan = calculateAttendancePlan({ attended, conducted, totalPlanned, targetPct });
  const affordable = plannedMissedLectures <= plan.canBunk;
  const bestCasePct =
    totalPlanned > 0
      ? round2(((plan.attended + plan.remaining - plannedMissedLectures) / plan.total) * 100)
      : null;
  return {
    plannedMissedLectures,
    affordable,
    spareAfter: Math.max(0, plan.canBunk - plannedMissedLectures),
    exceedsBy: affordable ? 0 : plannedMissedLectures - plan.canBunk,
    bestCasePct,
  };
}

export function statusLabel(status) {
  if (status === "safe") return "On track";
  if (status === "warning") return "Below target";
  return "Out of reach";
}

export function statusColor(status) {
  if (status === "safe") return "emerald";
  if (status === "warning") return "amber";
  return "rose";
}

function round2(n) {
  return Math.round(n * 100) / 100;
}