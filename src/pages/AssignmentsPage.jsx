import React, { useMemo, useState } from "react";
import { usePortal } from "@/lib/portalContext";
import { subjectById } from "@/lib/portalData";
import { api } from "@/api/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, Clock, Download, ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SOLUTION_SIZE = 10 * 1024 * 1024;

export default function AssignmentsPage() {
  const { student, portal, academic, refresh } = usePortal();
  const { toast } = useToast();
  const [notes, setNotes] = useState({});
  const [uploadingId, setUploadingId] = useState(null);

  const assignments = useMemo(() => {
    if (!portal || !academic) return [];
    return portal.subjects
      .filter((s) => s.semester === Number(student?.current_semester ?? student?.semester) && (!student?.branch || String(s.branch || "").toUpperCase() === String(student.branch).toUpperCase()))
      .flatMap((s) => academic.assignments.filter((a) => a.subject_id === s.id && a.published));
  }, [portal, academic, student]);

  const approvedSolutions = useMemo(
    () => (academic?.approvedSolutions || []).filter((solution) => solution.solution_pdf_url && solution.solution_status === "approved"),
    [academic]
  );

  const statusFor = (aid) => academic?.studentAssignments.find((sa) => sa.assignment_id === aid);

  const setStatus = async (assignment, status) => {
    const existing = statusFor(assignment.id);
    if (!existing && !UUID.test(String(student?.id || ""))) {
      toast({ title: "Student profile is not linked", description: "Please complete registration again so your Supabase student record can be linked.", variant: "destructive" });
      return;
    }
    try {
      if (existing) {
        await api.entities.StudentAssignments.update(existing.id, { status, completed_at: status === "completed" ? new Date().toISOString() : null });
      } else {
        await api.entities.StudentAssignments.create({ assignment_id: assignment.id, student_id: student.id, status, completed_at: status === "completed" ? new Date().toISOString() : null, solution_status: "none" });
      }
      toast({ title: status === "completed" ? "Marked as done" : "Marked as not done" });
      refresh();
    } catch (e) {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    }
  };

  const saveNotes = async (assignment) => {
    const existing = statusFor(assignment.id);
    if (!existing) return;
    try {
      await api.entities.StudentAssignments.update(existing.id, { notes: notes[assignment.id] ?? existing.notes });
      toast({ title: "Notes saved" });
      refresh();
    } catch (e) {
      toast({ title: "Could not save notes", description: e.message, variant: "destructive" });
    }
  };

  const uploadSolution = async (assignment, file) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "PDF required", description: "Upload the solution as a PDF file.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SOLUTION_SIZE) {
      toast({ title: "File is too large", description: "Solution PDFs must be 10 MB or smaller.", variant: "destructive" });
      return;
    }
    if (!UUID.test(String(student?.id || ""))) {
      toast({ title: "Student profile is not linked", description: "Please complete registration again before uploading a solution.", variant: "destructive" });
      return;
    }

    setUploadingId(assignment.id);
    let uploadedUrl = null;
    try {
      const existing = statusFor(assignment.id);
      uploadedUrl = (await api.integrations.Core.UploadFile({ file })).file_url;
      const payload = {
        assignment_id: assignment.id,
        student_id: student.id,
        status: existing?.status || "pending",
        completed_at: existing?.completed_at || null,
        solution_pdf_url: uploadedUrl,
        solution_file_name: file.name,
        solution_status: "pending",
        solution_submitted_at: new Date().toISOString(),
        solution_reviewed_at: null,
        solution_review_note: null,
      };
      if (existing) await api.entities.StudentAssignments.update(existing.id, payload);
      else await api.entities.StudentAssignments.create(payload);
      if (existing?.solution_pdf_url && existing.solution_pdf_url !== uploadedUrl) await api.integrations.Core.DeleteFile(existing.solution_pdf_url).catch(() => {});
      uploadedUrl = null;
      toast({ title: "Solution submitted", description: "Your PDF is waiting for admin approval." });
      await refresh();
    } catch (e) {
      if (uploadedUrl) await api.integrations.Core.DeleteFile(uploadedUrl).catch(() => {});
      toast({ title: "Could not upload solution", description: e.message, variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  const renderApprovedSolutions = (assignment) => {
    const solutions = approvedSolutions.filter((solution) => solution.assignment_id === assignment.id);
    if (!solutions.length) return null;
    return (
      <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
        <p className="mb-2 flex items-center gap-1 font-medium"><CheckCircle2 className="h-4 w-4" />Approved solutions</p>
        <div className="space-y-1">
          {solutions.map((solution) => {
            const owner = portal.students.find((s) => s.id === solution.student_id || s.enrollment_number === solution.enrollment_number);
            return <a key={solution.id} className="flex items-center gap-2 underline" href={solution.solution_pdf_url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" />{owner?.full_name || solution.solution_file_name || "Download approved solution"}</a>;
          })}
        </div>
      </div>
    );
  };

  const renderCard = (assignment) => {
    const subj = subjectById(portal.subjects, assignment.subject_id);
    const submission = statusFor(assignment.id);
    const status = submission?.status || "pending";
    const deadline = assignment.deadline ? new Date(assignment.deadline) : null;
    const overdue = status !== "completed" && deadline && deadline < new Date();
    const solutionLink = assignment.solution_link || assignment.solution_url;
    const solutionStatus = submission?.solution_status || "none";
    return (
      <Card key={assignment.id}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div><CardTitle className="text-base">{assignment.title}</CardTitle><p className="mt-0.5 text-xs text-muted-foreground">{subj?.name} • Assignment #{assignment.assignment_number}</p></div>
            <StatusBadge status={status} overdue={overdue} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {assignment.description && <p className="text-sm text-muted-foreground">{assignment.description}</p>}
          {deadline && <p className="text-xs text-muted-foreground">Due: {deadline.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>}
          <Textarea placeholder="Add a note..." value={notes[assignment.id] ?? submission?.notes ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [assignment.id]: e.target.value }))} onBlur={() => saveNotes(assignment)} className="min-h-[60px]" />
          {solutionLink ? (
            <a className="inline-flex items-center gap-1.5 text-sm text-primary underline" href={solutionLink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />View solution</a>
          ) : (
            <>
              {solutionStatus === "pending" && <Badge variant="outline" className="border-amber-300 text-amber-700">Solution awaiting admin approval</Badge>}
              {solutionStatus === "rejected" && <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700"><p className="font-medium">Solution rejected — upload a corrected PDF.</p>{submission.solution_review_note && <p>{submission.solution_review_note}</p>}</div>}
              {solutionStatus === "approved" && submission.solution_pdf_url && <a className="flex items-center gap-1 text-sm text-emerald-700 underline" href={submission.solution_pdf_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" />Your approved solution</a>}
              {renderApprovedSolutions(assignment)}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={status === "completed" ? "default" : "outline"} onClick={() => setStatus(assignment, "completed")}><CheckCircle2 className="mr-1.5 h-4 w-4" />Mark Done</Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(assignment, "pending")}><Clock className="mr-1.5 h-4 w-4" />Not Done</Button>
            {!solutionLink && <label className="cursor-pointer"><Button size="sm" variant="outline" asChild disabled={uploadingId === assignment.id}><span>{uploadingId === assignment.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}{uploadingId === assignment.id ? "Uploading…" : "Upload Solution"}</span></Button><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; uploadSolution(assignment, file); }} /></label>}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!portal) return <div className="animate-pulse h-72 rounded-lg bg-muted" />;

  const pending = assignments.filter((a) => (statusFor(a.id)?.status || "pending") !== "completed" && (!a.deadline || new Date(a.deadline) >= new Date()));
  const completed = assignments.filter((a) => statusFor(a.id)?.status === "completed");
  const overdue = assignments.filter((a) => (statusFor(a.id)?.status || "pending") !== "completed" && a.deadline && new Date(a.deadline) < new Date());

  return (
    <div>
      <PageHeader title="Assignments" description={`Semester ${student?.current_semester ?? student?.semester} • ${assignments.length} total`} />
      <Tabs defaultValue="pending">
        <TabsList><TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger><TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger><TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger></TabsList>
        <TabsContent value="pending" className="mt-4 grid gap-4 md:grid-cols-2">{pending.map(renderCard)}</TabsContent>
        <TabsContent value="completed" className="mt-4 grid gap-4 md:grid-cols-2">{completed.map(renderCard)}</TabsContent>
        <TabsContent value="overdue" className="mt-4 grid gap-4 md:grid-cols-2">{overdue.map(renderCard)}</TabsContent>
      </Tabs>
      {assignments.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No assignments for your semester yet.</p>}
    </div>
  );
}

function StatusBadge({ status, overdue }) {
  if (status === "completed") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>;
  if (overdue) return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Overdue</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}
