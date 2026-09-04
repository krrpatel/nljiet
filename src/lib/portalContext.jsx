import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/api/client";
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
      try { me = await api.auth.me(); } catch {}
      setCurrentUser(me);

      const configuredAdmins = String(import.meta.env.VITE_ADMIN_EMAILS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
      const isAdmin = me?.role === "admin" || me?.user_metadata?.role === "admin" || me?.app_metadata?.role === "admin" || configuredAdmins.includes(String(me?.email || "").toLowerCase());
      setIsMainAdmin(isAdmin);

      const s = await getCurrentStudent(me);
      setStudent(s);
      const p = await loadPortalData();
      setPortal(p);

      // Check dept admin
      if (!isAdmin && me) {
        const depts = await api.entities.Departments.list();
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
