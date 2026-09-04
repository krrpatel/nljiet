import React, { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/lib/portalContext";
import { api } from "@/api/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Download, Loader2, Pencil, Plus, Save, Trash2, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const BRANCHES = ["CSE", "AIML", "DS"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const emptyForm = { branch: "CSE", semester: "5", subject_id: "", academic_year_id: "", assignment_number: "1", title: "", description: "", deadline: "", published: true };

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AdminAssignmentsPage() {
  const { portal } = usePortal();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});

  const subjects = portal?.subjects || [];
  const academicYears = portal?.years || [];
  const students = portal?.students || [];
  const filteredSubjects = useMemo(() => subjects.filter(subject => subject.branch === form.branch && Number(subject.semester) === Number(form.semester) && subject.active !== false), [subjects, form.branch, form.semester]);
  const assignmentMap = useMemo(() => new Map(assignments.map(assignment => [assignment.id, assignment])), [assignments]);

  useEffect(() => { if (portal) loadData(); }, [portal]);

  async function loadData() {
    setLoading(true);
    const safe = request => request.catch(() => []);
    const [assignmentRows, submissionRows] = await Promise.all([
      safe(api.entities.Assignments.list("-created_at", 200)),
      safe(api.entities.StudentAssignments.list("-created_at", 500)),
    ]);
    setAssignments(assignmentRows);
    setSubmissions(submissionRows);
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, academic_year_id: academicYears.find(year => year.is_current)?.id || "" });
  }

  function editAssignment(assignment) {
    const subject = subjects.find(item => item.id === assignment.subject_id);
    setEditingId(assignment.id);
    setForm({
      branch: assignment.branch || subject?.branch || "CSE",
      semester: String(assignment.semester || subject?.semester || 5),
      subject_id: assignment.subject_id || "",
      academic_year_id: assignment.academic_year_id || "",
      assignment_number: String(assignment.assignment_number || 1),
      title: assignment.title || "",
      description: assignment.description || "",
      deadline: localDateTime(assignment.deadline),
      published: assignment.published !== false,
    });
  }

  async function saveAssignment(event) {
    event.preventDefault();
    if (!form.subject_id || !form.title.trim()) {
      toast({ title: "Subject and title are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        subject_id: form.subject_id,
        branch: form.branch,
        semester: Number(form.semester),
        academic_year_id: form.academic_year_id || null,
        assignment_number: Number(form.assignment_number) || 1,
        title: form.title.trim(),
        description: form.description.trim() || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        published: Boolean(form.published),
      };
      if (editingId) await api.entities.Assignments.update(editingId, payload);
      else await api.entities.Assignments.create(payload);
      toast({ title: editingId ? "Assignment updated" : "Assignment added" });
      resetForm();
      await loadData();
    } catch (error) {
      toast({ title: "Could not save assignment", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(assignment) {
    try {
      await api.entities.Assignments.update(assignment.id, { published: assignment.published === false });
      await loadData();
    } catch (error) {
      toast({ title: "Could not change publication status", description: error.message, variant: "destructive" });
    }
  }

  async function deleteAssignment(assignment) {
    if (!window.confirm(`Delete assignment “${assignment.title}”? Existing student submissions will remain.`)) return;
    try {
      await api.entities.Assignments.delete(assignment.id);
      toast({ title: "Assignment deleted" });
      await loadData();
    } catch (error) {
      toast({ title: "Could not delete assignment", description: error.message, variant: "destructive" });
    }
  }

  async function reviewSolution(submission, status) {
    setReviewingId(submission.id);
    try {
      await api.entities.StudentAssignments.update(submission.id, {
        solution_status: status,
        solution_reviewed_at: new Date().toISOString(),
        solution_review_note: reviewNotes[submission.id]?.trim() || null,
      });
      toast({ title: status === "approved" ? "Solution approved" : "Solution rejected" });
      await loadData();
    } catch (error) {
      toast({ title: "Could not review solution", description: error.message, variant: "destructive" });
    } finally {
      setReviewingId(null);
    }
  }

  if (!portal || loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const solutionSubmissions = submissions.filter(submission => submission.solution_pdf_url && submission.solution_status && submission.solution_status !== "none");
  const pendingSubmissions = solutionSubmissions.filter(submission => submission.solution_status === "pending");

  return (
    <div className="space-y-6">
      <PageHeader title="Assignments" description="Add assignments, publish them to students, and approve submitted solutions." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>{editingId ? "Edit assignment" : "Add assignment"}</CardTitle>{editingId && <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>}</CardHeader>
          <CardContent>
            <form onSubmit={saveAssignment} className="grid gap-3 sm:grid-cols-2">
              <div><Label>Branch</Label><Select value={form.branch} onValueChange={value => setForm(current => ({ ...current, branch: value, subject_id: "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BRANCHES.map(branch => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Semester</Label><Select value={String(form.semester)} onValueChange={value => setForm(current => ({ ...current, semester: value, subject_id: "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SEMESTERS.map(semester => <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>)}</SelectContent></Select></div>
              <div className="sm:col-span-2"><Label>Subject</Label><Select value={form.subject_id} onValueChange={value => setForm(current => ({ ...current, subject_id: value }))}><SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger><SelectContent>{filteredSubjects.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.code ? `${subject.code} – ` : ""}{subject.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Academic year</Label><Select value={form.academic_year_id} onValueChange={value => setForm(current => ({ ...current, academic_year_id: value }))}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{academicYears.map(year => <SelectItem key={year.id} value={year.id}>{year.title}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Assignment number</Label><Input type="number" min="1" value={form.assignment_number} onChange={event => setForm(current => ({ ...current, assignment_number: event.target.value }))} /></div>
              <div className="sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Solve the CN subnetting worksheet" required /></div>
              <div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Instructions for students" /></div>
              <div><Label>Deadline</Label><Input type="datetime-local" value={form.deadline} onChange={event => setForm(current => ({ ...current, deadline: event.target.value }))} /></div>
              <div className="flex items-center gap-3 pt-6"><Switch checked={form.published} onCheckedChange={value => setForm(current => ({ ...current, published: value }))} /><Label>Published to students</Label></div>
              <Button type="submit" className="sm:col-span-2" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{editingId ? "Update assignment" : "Add assignment"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>All assignments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {assignments.length === 0 && <p className="text-sm text-muted-foreground">No assignments added yet.</p>}
            {assignments.map(assignment => {
              const subject = subjects.find(item => item.id === assignment.subject_id);
              return <div key={assignment.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">#{assignment.assignment_number} {assignment.title}</p><p className="text-xs text-muted-foreground">{subject?.name || assignment.subject_id} • {assignment.branch || subject?.branch} • Sem {assignment.semester}</p>{assignment.deadline && <p className="text-xs text-muted-foreground">Due {new Date(assignment.deadline).toLocaleString()}</p>}</div><Badge variant={assignment.published === false ? "outline" : "secondary"}>{assignment.published === false ? "Draft" : "Published"}</Badge></div><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => togglePublished(assignment)}>{assignment.published === false ? "Publish" : "Unpublish"}</Button><Button size="icon" variant="ghost" onClick={() => editAssignment(assignment)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteAssignment(assignment)}><Trash2 className="h-4 w-4" /></Button></div></div>;
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Solution approval requests <Badge className="ml-2" variant={pendingSubmissions.length ? "default" : "secondary"}>{pendingSubmissions.length} pending</Badge></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {solutionSubmissions.length === 0 && <p className="text-sm text-muted-foreground">No student solution PDFs have been submitted.</p>}
          {solutionSubmissions.map(submission => {
            const assignment = assignmentMap.get(submission.assignment_id);
            const owner = students.find(student => student.id === submission.student_id || student.enrollment_number === submission.enrollment_number);
            const status = submission.solution_status;
            return <div key={submission.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{assignment?.title || "Assignment"}</p><p className="text-sm text-muted-foreground">{owner?.full_name || submission.enrollment_number || submission.student_id} • {submission.solution_file_name || "Solution PDF"}</p><p className="text-xs text-muted-foreground">Submitted {submission.solution_submitted_at ? new Date(submission.solution_submitted_at).toLocaleString() : "—"}</p></div><Badge variant={status === "approved" ? "secondary" : status === "rejected" ? "destructive" : "outline"}>{status}</Badge></div><div className="mt-3 flex flex-wrap items-center gap-2"><a href={submission.solution_pdf_url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Download className="mr-1.5 h-4 w-4" />Download solution</Button></a>{status === "pending" && <><Input className="max-w-sm" placeholder="Optional review note" value={reviewNotes[submission.id] || ""} onChange={event => setReviewNotes(current => ({ ...current, [submission.id]: event.target.value }))} /><Button size="sm" onClick={() => reviewSolution(submission, "approved")} disabled={reviewingId === submission.id}><CheckCircle2 className="mr-1.5 h-4 w-4" />Approve</Button><Button size="sm" variant="destructive" onClick={() => reviewSolution(submission, "rejected")} disabled={reviewingId === submission.id}><XCircle className="mr-1.5 h-4 w-4" />Reject</Button></>}</div>{submission.solution_review_note && <p className="mt-2 text-xs text-muted-foreground">Review note: {submission.solution_review_note}</p>}</div>;
          })}
        </CardContent>
      </Card>
    </div>
  );
}
