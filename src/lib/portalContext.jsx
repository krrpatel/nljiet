import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentStudent, loadPortalData, loadStudentAcademicData } from "@/lib/portalData";

const PortalContext = createContext(null);

export function PortalProvider({ children }) {
  const [student, setStudent] = useState(null);
  const [portal, setPortal] = useState(null);
  const [academic, setAcademic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getCurrentStudent();
      setStudent(s);
      const p = await loadPortalData();
      setPortal(p);
      if (s) {
        const a = await loadStudentAcademicData(s.id, s.enrollment_number);
        setAcademic(a);
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return (
    <PortalContext.Provider value={{ student, portal, academic, loading, error, refresh }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalProvider");
  return ctx;
}