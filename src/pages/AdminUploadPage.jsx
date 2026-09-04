import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, CheckCircle, AlertCircle, Clock, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/PageHeader";
import { parseAttendancePdf, parseResultPdf } from "@/lib/pdfPipeline";

const BRANCHES = ["CSE", "AIML", "DS"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

async function upsertResultRows(records, { subjectId, semester, academicYearId, examLabel, isRemse }) {
  const existing = await api.entities.Results.filter({ subject_id: subjectId, semester });
  const scoped = existing.filter(row => !academicYearId || String(row.academic_year_id || "") === String(academicYearId));
  const exactByEnrollment = new Map(scoped.filter(row => row.exam_type === examLabel).map(row => [row.enrollment_number, row]));
  const absentRows = scoped.filter(row => row.marks == null || row.status === "absent" || row.grade === "AB");
  let imported = 0;

  for (let i = 0; i < records.length; i += 20) {
    const batch = records.slice(i, i + 20);
    await Promise.all(batch.map(async record => {
      const exact = exactByEnrollment.get(record.enrollment_number);
      const absent = isRemse && !exact
        ? absentRows.find(row => row.enrollment_number === record.enrollment_number)
        : null;
      const target = exact || absent;
      if (target) {
        // A re-exam corrects an existing AB row in-place when one exists. If
        // there is no AB row, it is stored as a separate re-exam result.
        const payload = absent && !exact ? { ...record, exam_type: target.exam_type } : record;
        await api.entities.Results.update(target.id, payload);
      } else {
        const created = await api.entities.Results.create(record);
        exactByEnrollment.set(record.enrollment_number, created);
      }
      imported += 1;
    }));
  }
  return imported;
}

export default function AdminUploadPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [attendanceUploads, setAttendanceUploads] = useState([]);
  const [resultUploads, setResultUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingFiles, setDeletingFiles] = useState(null);

  // Attendance upload form
  const [attForm, setAttForm] = useState({ branch: "CSE", semester: "5", week_label: "", week_start: "", week_end: "", academic_year_id: "", file: null });
  const [attUploading, setAttUploading] = useState(false);

  // Result upload form
  const [resForm, setResForm] = useState({ branch: "CSE", semester: "5", subject_id: "", exam_type: "midsem1", exam_number: "1", academic_year_id: "", file: null });
  const [resUploading, setResUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const safe = request => request.catch(() => []);
    const [subs, years, attUps, resUps] = await Promise.all([
      safe(api.entities.Subjects.list()),
      safe(api.entities.AcademicYears.list()),
      safe(api.entities.AttendanceUploads.list("-created_date", 50)),
      safe(api.entities.ResultUploads.list("-created_date", 50)),
    ]);
    setSubjects(subs);
    setAcademicYears(years);
    setAttendanceUploads(attUps);
    setResultUploads(resUps);
    const current = years.find(y => y.is_current);
    if (current) {
      setAttForm(f => ({ ...f, academic_year_id: current.id }));
      setResForm(f => ({ ...f, academic_year_id: current.id }));
    }
    setLoading(false);
  }

  async function deleteSourceFiles(kind) {
    const isAttendance = kind === "attendance";
    const uploads = isAttendance ? attendanceUploads : resultUploads;
    const urls = [...new Set(uploads.map(upload => upload.pdf_url).filter(Boolean))];
    const label = isAttendance ? "attendance" : "result";
    const folder = isAttendance ? "attendance-sources" : "result-sources";
    if (!window.confirm(`Delete all stored ${label} source PDFs? Parsed records and upload history will remain. Assignment solution files will not be touched.`)) return;

    setDeletingFiles(kind);
    try {
      const folderCleanup = await api.integrations.Core.DeleteFilesByFolder({ folder });
      const outcomes = await Promise.all(urls.map(async url => {
        try {
          await api.integrations.Core.DeleteFile(url);
          return { url, ok: true };
        } catch (error) {
          return { url, ok: false, error };
        }
      }));
      const deletedUrls = new Set(outcomes.filter(outcome => outcome.ok).map(outcome => outcome.url));
      const rows = uploads.filter(upload => deletedUrls.has(upload.pdf_url));
      const entity = isAttendance ? api.entities.AttendanceUploads : api.entities.ResultUploads;
      const metadataUpdates = await Promise.all(rows.map(upload => entity.update(upload.id, { pdf_url: null }).then(() => true).catch(() => false)));
      const removed = Number(folderCleanup.removed || 0) + outcomes.filter(outcome => outcome.ok).length;
      const failed = Number(folderCleanup.failed || 0) + outcomes.filter(outcome => !outcome.ok).length + metadataUpdates.filter(updated => !updated).length;
      if (removed === 0 && failed === 0) {
        toast({ title: `No stored ${label} PDFs found`, description: "Parsed records and upload history were unchanged." });
        return;
      }
      toast({
        title: failed ? `${label[0].toUpperCase() + label.slice(1)} PDF cleanup partially completed` : `${label[0].toUpperCase() + label.slice(1)} PDFs deleted`,
        description: `${removed} file${removed === 1 ? "" : "s"} removed. Parsed records and history were kept.`,
        variant: failed ? "destructive" : undefined,
      });
      await loadData();
    } finally {
      setDeletingFiles(null);
    }
  }

  async function handleAttendanceUpload(e) {
    e.preventDefault();
    if (!attForm.file) { toast({ title: "Please select a PDF file", variant: "destructive" }); return; }
    setAttUploading(true);
    let uploadedFileUrl = null;
    try {
    const semester = parseInt(attForm.semester, 10);
    const branchSubjects = subjects.filter(s => s.branch === attForm.branch && s.semester === semester && s.active !== false);
    if (!branchSubjects.length) throw new Error(`No active subjects are configured for ${attForm.branch}, semester ${semester}. Add them in Admin → Subjects & Years first.`);
    const parsed = { students: await parseAttendancePdf(attForm.file, branchSubjects) };
    const importedStudents = (parsed.students || []).filter(student => student.enrollment_number);
    if (!importedStudents.length) throw new Error("No attendance rows were found in this PDF. Check the department/semester and choose the original text-based PDF.");
    const enrollments = [...new Set(importedStudents.map(student => student.enrollment_number))];
    const oldUploads = await api.entities.AttendanceUploads.filter({ branch: attForm.branch, semester }).catch(() => []);

    // Map subject codes to subject IDs
    const subjectMap = {};
    for (const s of branchSubjects) {
      subjectMap[s.abbreviation?.toUpperCase()] = s.id;
      subjectMap[s.code?.toUpperCase()] = s.id;
    }

    const subjectKeys = branchSubjects.map(s => ({ key: (s.abbreviation || s.code || s.name).toLowerCase().replace(/[^a-z0-9]/g, "_"), abbr: (s.abbreviation || s.code || s.name).toUpperCase() }));

    const records = [];
    for (const student of importedStudents) {
      for (const { key, abbr } of subjectKeys) {
        const subjId = subjectMap[abbr];
        if (!subjId) continue;
        const conducted = student[`${key}_conducted`] || 0;
        const attended = student[`${key}_attended`] || 0;
        if (!Number.isInteger(conducted) || !Number.isInteger(attended) || conducted <= 0 || attended < 0 || attended > conducted) continue;
        records.push({
          enrollment_number: student.enrollment_number,
          subject_id: subjId,
          semester,
          academic_year_id: attForm.academic_year_id || null,
          week_start: null,
          week_end: null,
          conducted_lectures: conducted,
          attended_lectures: attended,
        });
      }
    }
    if (!records.length) throw new Error("No valid conducted/attended lecture counts were found in this PDF. Percentage columns are ignored; check the department, semester, and PDF format.");
    uploadedFileUrl = (await api.integrations.Core.UploadFile({ file: attForm.file, folder: "attendance-sources" })).file_url;

    // The live attendance table has no branch column. Resolve all registered
    // enrollments for this department first, then replace only this branch's
    // rows for the selected semester (plus any enrollment newly found in PDF).
    const departmentStudents = await api.entities.Students.filter({ branch: attForm.branch }).catch(() => []);
    const attendanceEnrollments = [...new Set([
      ...enrollments,
      ...departmentStudents.map(student => student.enrollment_number).filter(Boolean)
    ])];
    for (let i = 0; i < attendanceEnrollments.length; i += 20) {
      await Promise.all(attendanceEnrollments.slice(i, i + 20).map(enrollment => api.entities.Attendance.deleteMany({ enrollment_number: enrollment, semester })));
    }
    let imported = 0;
    const BATCH = 50;
    for (let i = 0; i < records.length; i += BATCH) {
      await api.entities.Attendance.bulkCreate(records.slice(i, i + BATCH));
      imported += Math.min(BATCH, records.length - i);
    }

    await api.entities.AttendanceUploads.create({
      branch: attForm.branch,
      semester,
      academic_year_id: attForm.academic_year_id || null,
      week_label: `Import ${new Date().toLocaleDateString()}`,
      week_start: null,
      week_end: null,
      pdf_url: null,
      status: "done",
      records_imported: imported,
      processed_at: new Date().toISOString()
    });

    // PDFs are processing inputs, not permanent student documents. Keep only
    // import metadata after the rows are safely stored in Supabase.
    await api.integrations.Core.DeleteFile(uploadedFileUrl);
    uploadedFileUrl = null;
    await Promise.all(oldUploads.filter(upload => upload.pdf_url).map(upload => api.integrations.Core.DeleteFile(upload.pdf_url).catch(() => {})));

    toast({ title: `Attendance imported: ${imported} records` });
    setAttForm(f => ({ ...f, file: null, week_label: "", week_start: "", week_end: "" }));
    await loadData();
    } catch (err) {
      if (uploadedFileUrl) await api.integrations.Core.DeleteFile(uploadedFileUrl).catch(() => {});
      toast({ title: "Attendance upload failed", description: err.message, variant: "destructive" });
    }
    finally { setAttUploading(false); }
  }

  async function handleResultUpload(e) {
    e.preventDefault();
    if (!resForm.file) { toast({ title: "Please select a PDF file", variant: "destructive" }); return; }
    if (!resForm.subject_id) { toast({ title: "Please select a subject", variant: "destructive" }); return; }
    setResUploading(true);
    let uploadedFileUrl = null;
    try {
      const subject = subjects.find(s => s.id === resForm.subject_id);
      if (!subject) throw new Error("The selected subject is no longer available. Refresh subjects in the admin panel and try again.");
      const semester = parseInt(resForm.semester, 10);
      const isRemse = resForm.exam_type === "remse";
      const examLabel = isRemse ? "remse" : `${resForm.exam_type}${resForm.exam_number ? `_${resForm.exam_number}` : ""}`;
      const parsed = { students: await parseResultPdf(resForm.file, subject) };
      const students = (parsed.students || []).filter(student => student.enrollment_number);
      if (!students.length) throw new Error("No result rows were found in this PDF. Check the subject and choose the original text-based PDF.");

      const oldUploads = await api.entities.ResultUploads.filter({ branch: resForm.branch, semester, subject_id: resForm.subject_id, exam_type: examLabel }).catch(() => []);
      uploadedFileUrl = (await api.integrations.Core.UploadFile({ file: resForm.file, folder: "result-sources" })).file_url;
      const records = students.map(s => ({
        enrollment_number: s.enrollment_number,
        subject_id: resForm.subject_id,
        academic_year_id: resForm.academic_year_id || null,
        semester,
        exam_type: examLabel,
        section_a_marks: s.section_a_marks ?? null,
        section_b_marks: s.section_b_marks ?? null,
        marks: s.total_marks ?? null,
        max_marks: s.max_marks ?? 60,
        grade: s.total_marks == null ? "AB" : s.total_marks >= 24 ? "PASS" : "FAIL",
        status: s.total_marks == null ? "absent" : s.total_marks >= 24 ? "pass" : "fail",
        published: true
      }));

      // Upsert only the students present in this PDF. This preserves every
      // other subject/student and lets a partial re-exam PDF correct AB rows.
      const imported = await upsertResultRows(records, {
        subjectId: resForm.subject_id,
        semester,
        academicYearId: resForm.academic_year_id,
        examLabel,
        isRemse
      });

      await api.entities.ResultUploads.create({
        branch: resForm.branch,
        semester,
        academic_year_id: resForm.academic_year_id || null,
        subject_id: resForm.subject_id,
        subject_code: subject.code,
        exam_type: examLabel,
        pdf_url: null,
        status: "done",
        records_imported: imported,
        processed_at: new Date().toISOString()
      });

      // Keep only metadata; the source PDF is deleted after all rows are saved.
      await api.integrations.Core.DeleteFile(uploadedFileUrl);
      uploadedFileUrl = null;
      await Promise.all(oldUploads.filter(upload => upload.pdf_url).map(upload => api.integrations.Core.DeleteFile(upload.pdf_url).catch(() => {})));

      toast({ title: `${isRemse ? "Re-exam" : "Results"} imported: ${imported} records` });
      setResForm(f => ({ ...f, file: null }));
      await loadData();
    } catch (err) {
      if (uploadedFileUrl) await api.integrations.Core.DeleteFile(uploadedFileUrl).catch(() => {});
      toast({ title: "Result upload failed", description: err.message, variant: "destructive" });
    }
    finally { setResUploading(false); }
  }

  const statusBadge = (status) => {
    const map = { done: "default", error: "destructive", processing: "secondary", pending: "outline" };
    const icons = { done: CheckCircle, error: AlertCircle, processing: Loader2, pending: Clock };
    const Icon = icons[status] || Clock;
    return <Badge variant={map[status] || "outline"} className="gap-1"><Icon className="h-3 w-3" />{status}</Badge>;
  };

  const filteredSubjects = subjects.filter(s => s.branch === resForm.branch && s.semester === parseInt(resForm.semester) && s.active !== false);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Data Upload" description="Upload attendance PDFs and result PDFs for processing" />
      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance PDF</TabsTrigger>
          <TabsTrigger value="results">Results PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Upload Attendance PDF</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleAttendanceUpload} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Branch</Label>
                    <Select value={attForm.branch} onValueChange={v => setAttForm(f => ({ ...f, branch: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Semester</Label>
                    <Select value={attForm.semester} onValueChange={v => setAttForm(f => ({ ...f, semester: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SEMESTERS.map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>PDF File</Label>
                  <Input type="file" accept=".pdf" onChange={e => setAttForm(f => ({ ...f, file: e.target.files[0] }))} required />
                </div>
                <Button type="submit" disabled={attUploading}>
                  {attUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing PDF…</> : <><Upload className="h-4 w-4 mr-2" />Upload & Import</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0"><CardTitle>Upload History</CardTitle><Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => deleteSourceFiles("attendance")} disabled={deletingFiles === "attendance"}><Trash2 className="mr-1.5 h-4 w-4" />{deletingFiles === "attendance" ? "Deleting…" : "Delete all PDFs"}</Button></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {attendanceUploads.length === 0 && <p className="text-sm text-muted-foreground">No uploads yet.</p>}
                {attendanceUploads.map(u => (
                  <div key={u.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm">{u.branch} Sem {u.semester} – {u.week_label}</p>
                      <p className="text-xs text-muted-foreground">{u.records_imported} records • {u.processed_at ? new Date(u.processed_at).toLocaleDateString() : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(u.status)}
                      {u.pdf_url && <a href={u.pdf_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4 text-muted-foreground hover:text-foreground" /></a>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Upload Result PDF</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleResultUpload} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Branch</Label>
                    <Select value={resForm.branch} onValueChange={v => setResForm(f => ({ ...f, branch: v, subject_id: "" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Semester</Label>
                    <Select value={resForm.semester} onValueChange={v => setResForm(f => ({ ...f, semester: v, subject_id: "" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SEMESTERS.map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Academic Year</Label>
                  <Select value={resForm.academic_year_id} onValueChange={v => setResForm(f => ({ ...f, academic_year_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                    <SelectContent>{academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Select value={resForm.subject_id} onValueChange={v => setResForm(f => ({ ...f, subject_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>{filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.code} – {s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Exam Type</Label>
                    <Select value={resForm.exam_type} onValueChange={v => setResForm(f => ({ ...f, exam_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="midsem1">Mid Sem 1</SelectItem>
                        <SelectItem value="midsem2">Mid Sem 2</SelectItem>
                        <SelectItem value="remse">Re-exam / Remedial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(resForm.exam_type === "midsem1" || resForm.exam_type === "midsem2") && (
                    <div>
                      <Label>Exam Number</Label>
                      <Select value={resForm.exam_number} onValueChange={v => setResForm(f => ({ ...f, exam_number: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div>
                  <Label>PDF File</Label>
                  <Input type="file" accept=".pdf" onChange={e => setResForm(f => ({ ...f, file: e.target.files[0] }))} required />
                  <p className="mt-1 text-xs text-muted-foreground">Partial PDFs are supported. Only the students in this PDF are added or updated; other result rows remain unchanged.</p>
                </div>
                <Button type="submit" disabled={resUploading}>
                  {resUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing PDF…</> : <><Upload className="h-4 w-4 mr-2" />Upload & Import</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0"><CardTitle>Upload History</CardTitle><Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => deleteSourceFiles("results")} disabled={deletingFiles === "results"}><Trash2 className="mr-1.5 h-4 w-4" />{deletingFiles === "results" ? "Deleting…" : "Delete all PDFs"}</Button></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {resultUploads.length === 0 && <p className="text-sm text-muted-foreground">No uploads yet.</p>}
                {resultUploads.map(u => (
                  <div key={u.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm">{u.branch} Sem {u.semester} – {u.subject_code} – {u.exam_type}</p>
                      <p className="text-xs text-muted-foreground">{u.records_imported} records • {u.processed_at ? new Date(u.processed_at).toLocaleDateString() : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(u.status)}
                      {u.pdf_url && <a href={u.pdf_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4 text-muted-foreground hover:text-foreground" /></a>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
