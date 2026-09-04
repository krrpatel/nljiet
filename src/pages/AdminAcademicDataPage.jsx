import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CalendarRange, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const DEFAULT_BRANCHES = ["CSE", "AIML", "DS"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const emptySubject = { branch: "CSE", semester: "5", code: "", abbreviation: "", name: "", active: true };
const emptyYear = { ayid: "", title: "", is_current: false };

export default function AdminAcademicDataPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [years, setYears] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjectForm, setSubjectForm] = useState(emptySubject);
  const [yearForm, setYearForm] = useState(emptyYear);
  const [editingSubject, setEditingSubject] = useState(null);
  const [editingYear, setEditingYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingSubject, setSavingSubject] = useState(false);
  const [savingYear, setSavingYear] = useState(false);

  const branches = useMemo(() => [...new Set([...DEFAULT_BRANCHES, ...departments.map(d => d.code).filter(Boolean)])], [departments]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const safe = request => request.catch(() => []);
    const [subjectRows, yearRows, departmentRows] = await Promise.all([
      safe(api.entities.Subjects.list()),
      safe(api.entities.AcademicYears.list()),
      safe(api.entities.Departments.list()),
    ]);
    setSubjects(subjectRows);
    setYears(yearRows);
    setDepartments(departmentRows);
    setLoading(false);
  }

  function resetSubject() {
    setEditingSubject(null);
    setSubjectForm({ ...emptySubject, branch: branches[0] || "CSE" });
  }

  function editSubject(subject) {
    setEditingSubject(subject);
    setSubjectForm({
      branch: subject.branch || "CSE",
      semester: String(subject.semester || 1),
      code: subject.code || "",
      abbreviation: subject.abbreviation || "",
      name: subject.name || "",
      active: subject.active !== false,
    });
  }

  async function saveSubject(event) {
    event.preventDefault();
    setSavingSubject(true);
    try {
      const payload = {
        branch: subjectForm.branch,
        semester: Number(subjectForm.semester),
        code: subjectForm.code.trim() || null,
        abbreviation: subjectForm.abbreviation.trim() || null,
        name: subjectForm.name.trim(),
        active: subjectForm.active,
      };
      if (!payload.name || !payload.branch || !payload.semester) throw new Error("Department, semester, and subject name are required.");
      if (editingSubject) await api.entities.Subjects.update(editingSubject.id, payload);
      else await api.entities.Subjects.create(payload);
      toast({ title: editingSubject ? "Subject updated" : "Subject added" });
      resetSubject();
      await loadData();
    } catch (error) {
      toast({ title: "Could not save subject", description: error.message, variant: "destructive" });
    } finally {
      setSavingSubject(false);
    }
  }

  async function deleteSubject(subject) {
    if (!window.confirm(`Delete ${subject.code || subject.name}? Existing result/attendance rows may reference it.`)) return;
    try {
      await api.entities.Subjects.delete(subject.id);
      toast({ title: "Subject deleted" });
      await loadData();
    } catch (error) {
      toast({ title: "Could not delete subject", description: error.message, variant: "destructive" });
    }
  }

  function editYear(year) {
    setEditingYear(year);
    setYearForm({ ayid: String(year.ayid ?? ""), title: year.title || "", is_current: year.is_current === true });
  }

  function resetYear() {
    setEditingYear(null);
    setYearForm(emptyYear);
  }

  async function saveYear(event) {
    event.preventDefault();
    setSavingYear(true);
    try {
      const payload = { ayid: Number(yearForm.ayid), title: yearForm.title.trim(), is_current: Boolean(yearForm.is_current) };
      if (!payload.ayid || !payload.title) throw new Error("AYID and academic year title are required.");
      if (payload.is_current) {
        await Promise.all(years.filter(year => year.id !== editingYear?.id && year.is_current).map(year => api.entities.AcademicYears.update(year.id, { is_current: false })));
      }
      if (editingYear) await api.entities.AcademicYears.update(editingYear.id, payload);
      else await api.entities.AcademicYears.create(payload);
      toast({ title: editingYear ? "Academic year updated" : "Academic year added" });
      resetYear();
      await loadData();
    } catch (error) {
      toast({ title: "Could not save academic year", description: error.message, variant: "destructive" });
    } finally {
      setSavingYear(false);
    }
  }

  async function deleteYear(year) {
    if (!window.confirm(`Delete academic year ${year.title}?`)) return;
    try {
      await api.entities.AcademicYears.delete(year.id);
      toast({ title: "Academic year deleted" });
      await loadData();
    } catch (error) {
      toast({ title: "Could not delete academic year", description: error.message, variant: "destructive" });
    }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Subjects & Academic Years" description="Maintain the reference data used by attendance, results, assignments, and fees." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle><BookOpen className="mr-2 inline h-5 w-5" />Subjects by department</CardTitle>
            {editingSubject && <Button size="sm" variant="ghost" onClick={resetSubject}>Cancel edit</Button>}
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={saveSubject} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
              <div><Label>Department</Label><Select value={subjectForm.branch} onValueChange={value => setSubjectForm(form => ({ ...form, branch: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{branches.map(branch => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Semester</Label><Select value={String(subjectForm.semester)} onValueChange={value => setSubjectForm(form => ({ ...form, semester: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SEMESTERS.map(semester => <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Subject name</Label><Input value={subjectForm.name} onChange={event => setSubjectForm(form => ({ ...form, name: event.target.value }))} placeholder="Data Structures" required /></div>
              <div><Label>Code</Label><Input value={subjectForm.code} onChange={event => setSubjectForm(form => ({ ...form, code: event.target.value.toUpperCase() }))} placeholder="3160703" /></div>
              <div><Label>Abbreviation</Label><Input value={subjectForm.abbreviation} onChange={event => setSubjectForm(form => ({ ...form, abbreviation: event.target.value.toUpperCase() }))} placeholder="DS" /></div>
              <div className="flex items-center gap-3 pt-6"><Switch checked={subjectForm.active} onCheckedChange={value => setSubjectForm(form => ({ ...form, active: value }))} /><Label>Active</Label></div>
              <Button type="submit" className="sm:col-span-2" disabled={savingSubject}>{savingSubject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{editingSubject ? "Update subject" : "Add subject"}</Button>
            </form>
            <div className="space-y-2">
              {subjects.length === 0 && <p className="text-sm text-muted-foreground">No subjects yet. Add each subject for its department and semester.</p>}
              {subjects.map(subject => <div key={subject.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{subject.code ? `${subject.code} - ` : ""}{subject.name}</p><p className="text-xs text-muted-foreground">{subject.branch} • Semester {subject.semester} {subject.abbreviation ? `• ${subject.abbreviation}` : ""}</p></div><div className="flex items-center gap-1"><Badge variant={subject.active === false ? "outline" : "secondary"}>{subject.active === false ? "Inactive" : "Active"}</Badge><Button variant="ghost" size="icon" onClick={() => editSubject(subject)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteSubject(subject)}><Trash2 className="h-4 w-4" /></Button></div></div>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle><CalendarRange className="mr-2 inline h-5 w-5" />Academic years</CardTitle>
            {editingYear && <Button size="sm" variant="ghost" onClick={resetYear}>Cancel edit</Button>}
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={saveYear} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
              <div><Label>Octopod AYID</Label><Input type="number" value={yearForm.ayid} onChange={event => setYearForm(form => ({ ...form, ayid: event.target.value }))} placeholder="9205" required /></div>
              <div><Label>Title</Label><Input value={yearForm.title} onChange={event => setYearForm(form => ({ ...form, title: event.target.value }))} placeholder="(Odd Semester) 2026 - 2027" required /></div>
              <div className="flex items-center gap-3 pt-2 sm:col-span-2"><Switch checked={yearForm.is_current} onCheckedChange={value => setYearForm(form => ({ ...form, is_current: value }))} /><Label>Make this the current academic year</Label></div>
              <Button type="submit" className="sm:col-span-2" disabled={savingYear}>{savingYear ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{editingYear ? "Update academic year" : "Add academic year"}</Button>
            </form>
            <div className="space-y-2">
              {years.length === 0 && <p className="text-sm text-muted-foreground">No academic years yet. Add the AYID and title returned by Octopod.</p>}
              {years.map(year => <div key={year.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{year.title}</p><p className="text-xs text-muted-foreground">Octopod AYID: {year.ayid}</p></div><div className="flex items-center gap-1">{year.is_current && <Badge>Current</Badge>}<Button variant="ghost" size="icon" onClick={() => editYear(year)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteYear(year)}><Trash2 className="h-4 w-4" /></Button></div></div>)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
