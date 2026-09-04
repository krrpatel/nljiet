import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentStudent, loadPortalData, loadStudentAcademicData, aggregateAttendanceBySubject, overallAttendance } from "@/lib/portalData";

const PortalContext = createContext(null);

// Departments that have live data
const LIVE_DEPARTMENTS = ["CSE"];

export function PortalProvider({ children }) {
  const [student, setStudent] = useState(null);
  const [portal, setPortal] = useState(null);
  const [academic, setAcademic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [isDeptAdmin, setIsDeptAdmin] = useState(false);
  const [deptAdminBranch, setDeptAdminBranch] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      setCurrentUser(me);

      const isAdmin = me?.role === "admin";
      setIsMainAdmin(isAdmin);

      const s = await getCurrentStudent(me);
      setStudent(s);
      const p = await loadPortalData();
      setPortal(p);

      // Check dept admin
      if (!isAdmin && me) {
        const depts = await base44.entities.Departments.list();
        const deptAdmin = depts.find(d => (d.admin_user_ids || []).includes(me.id));
        if (deptAdmin) {
          setIsDeptAdmin(true);
          setDeptAdminBranch(deptAdmin.code);
        }
      }

      if (s) {
        const a = await loadStudentAcademicData(s.id, s.enrollment_number, s.branch, s.semester);
        setAcademic(a);
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => { await load(); }, [load]);

  // Compute convenience fields
  const subjects = portal?.subjects || [];
  const results = academic?.results || [];
  const attendance = academic?.attendance || [];
  const assignments = academic?.assignments || [];
  const studentAssignments = academic?.studentAssignments || [];
  const feeStatus = academic?.feeStatus || null;
  const feeReceipts = academic?.feeReceipts || [];
  const attendanceAgg = aggregateAttendanceBySubject(attendance);
  const overallAtt = overallAttendance(attendanceAgg);
  const studentBranch = student?.branch || "";
  const isDeptLive = !studentBranch || LIVE_DEPARTMENTS.includes(studentBranch);

  return (
    <PortalContext.Provider value={{
      student, portal, academic, loading, error, refresh,
      currentUser, isMainAdmin, isDeptAdmin, deptAdminBranch,
      subjects, results, attendance, assignments, studentAssignments,
      feeStatus, feeReceipts, attendanceAgg, overallAtt,
      isDeptLive, LIVE_DEPARTMENTS,
    }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalProvider");
  return ctx;
}