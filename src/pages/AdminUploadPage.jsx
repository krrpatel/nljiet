import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/PageHeader";

const BRANCHES = ["CSE", "AIML", "DS"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const EXAM_TYPES = ["midsem1", "midsem2", "gtu"];

export default function AdminUploadPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [attendanceUploads, setAttendanceUploads] = useState([]);
  const [resultUploads, setResultUploads] = useState([]);
  const [loading, setLoading] = useState(true);

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
    const [subs, years, attUps, resUps] = await Promise.all([
      base44.entities.Subjects.list(),
      base44.entities.AcademicYears.list(),
      base44.entities.AttendanceUploads.list("-created_date", 50),
      base44.entities.ResultUploads.list("-created_date", 50),
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

  async function handleAttendanceUpload(e) {
    e.preventDefault();
    if (!attForm.file) { toast({ title: "Please select a PDF file", variant: "destructive" }); return; }
    setAttUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: attForm.file });
    // Parse attendance data from PDF using LLM
    const parsePrompt = `Parse this attendance PDF and extract student attendance data. The PDF contains columns: Roll No, Enrollment No, Branch, Division, Student Name, then for each subject (CN, SS, MI, PDS, WAD, OSM): Conducted Lectures, Attended Lectures, Percentage. Also extract Overall: Conducted, Attended, Percentage. And Mentor Name.

Return a JSON array of objects with fields:
enrollment_number, branch, division, student_name, mentor_name,
cn_conducted, cn_attended, cn_percentage,
ss_conducted, ss_attended, ss_percentage,
mi_conducted, mi_attended, mi_percentage,
pds_conducted, pds_attended, pds_percentage,
wad_conducted, wad_attended, wad_percentage,
osm_conducted, osm_attended, osm_percentage,
overall_conducted, overall_attended, overall_percentage

The file is at: ${file_url}`;

    const parsed = await base44.integrations.Core.InvokeLLM({
      prompt: parsePrompt,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          students: {
            type: "array",
            items: {
              type: "object",
              properties: {
                enrollment_number: { type: "string" },
                branch: { type: "string" },
                division: { type: "string" },
                student_name: { type: "string" },
                mentor_name: { type: "string" },
                cn_conducted: { type: "number" }, cn_attended: { type: "number" },
                ss_conducted: { type: "number" }, ss_attended: { type: "number" },
                mi_conducted: { type: "number" }, mi_attended: { type: "number" },
                pds_conducted: { type: "number" }, pds_attended: { type: "number" },
                wad_conducted: { type: "number" }, wad_attended: { type: "number" },
                osm_conducted: { type: "number" }, osm_attended: { type: "number" },
                overall_conducted: { type: "number" }, overall_attended: { type: "number" }
              }
            }
          }
        }
      },
      model: "gemini_3_flash"
    });

    // Map subject codes to subject IDs
    const subjectMap = {};
    const branchSubjects = subjects.filter(s => s.branch === attForm.branch && s.semester === parseInt(attForm.semester));
    for (const s of branchSubjects) {
      subjectMap[s.abbreviation?.toUpperCase()] = s.id;
      subjectMap[s.code?.toUpperCase()] = s.id;
    }

    const subjectKeys = [
      { key: "cn", abbr: "CN" },
      { key: "ss", abbr: "SS" },
      { key: "mi", abbr: "MI" },
      { key: "pds", abbr: "PDS" },
      { key: "wad", abbr: "WAD" },
      { key: "osm", abbr: "OSM" },
    ];

    const records = [];
    for (const student of (parsed.students || [])) {
      for (const { key, abbr } of subjectKeys) {
        const subjId = subjectMap[abbr];
        if (!subjId) continue;
        const conducted = student[`${key}_conducted`] || 0;
        const attended = student[`${key}_attended`] || 0;
        if (conducted === 0) continue;
        records.push({
          enrollment_number: student.enrollment_number,
          subject_id: subjId,
          branch: attForm.branch,
          semester: parseInt(attForm.semester),
          academic_year_id: attForm.academic_year_id,
          week_start: attForm.week_start || null,
          week_end: attForm.week_end || null,
          conducted_lectures: conducted,
          attended_lectures: attended,
        });
      }
    }

    // Delete existing records for this week/branch/semester then bulk create
    if (attForm.week_start) {
      await base44.entities.Attendance.deleteMany({
        branch: attForm.branch,
        semester: parseInt(attForm.semester),
        week_start: attForm.week_start
      });
    }

    let imported = 0;
    const BATCH = 50;
    for (let i = 0; i < records.length; i += BATCH) {
      await base44.entities.Attendance.bulkCreate(records.slice(i, i + BATCH));
      imported += Math.min(BATCH, records.length - i);
    }

    await base44.entities.AttendanceUploads.create({
      branch: attForm.branch,
      semester: parseInt(attForm.semester),
      academic_year_id: attForm.academic_year_id,
      week_label: attForm.week_label,
      week_start: attForm.week_start || null,
      week_end: attForm.week_end || null,
      pdf_url: file_url,
      status: "done",
      records_imported: imported,
      processed_at: new Date().toISOString()
    });

    toast({ title: `Attendance imported: ${imported} records` });
    setAttForm(f => ({ ...f, file: null, week_label: "", week_start: "", week_end: "" }));
    setAttUploading(false);
    loadData();
  }

  async function handleResultUpload(e) {
    e.preventDefault();
    if (!resForm.file) { toast({ title: "Please select a PDF file", variant: "destructive" }); return; }
    if (!resForm.subject_id) { toast({ title: "Please select a subject", variant: "destructive" }); return; }
    setResUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: resForm.file });

    const subject = subjects.find(s => s.id === resForm.subject_id);
    const parsePrompt = `Parse this result PDF for subject ${subject?.name || ''}. Extract student marks data with fields: enrollment_number, name, branch, division, mentor, section_a_marks (number or null if AB), section_b_marks (number or null if AB), total_marks (number or null if AB/absent). Return JSON.`;

    const parsed = await base44.integrations.Core.InvokeLLM({
      prompt: parsePrompt,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          students: {
            type: "array",
            items: {
              type: "object",
              properties: {
                enrollment_number: { type: "string" },
                name: { type: "string" },
                branch: { type: "string" },
                division: { type: "string" },
                mentor: { type: "string" },
                section_a_marks: { type: "number" },
                section_b_marks: { type: "number" },
                total_marks: { type: "number" }
              }
            }
          }
        }
      },
      model: "gemini_3_flash"
    });

    const examLabel = `${resForm.exam_type}${resForm.exam_number ? `_${resForm.exam_number}` : ""}`;

    // Remove old results for this subject/exam_type
    await base44.entities.Results.deleteMany({
      subject_id: resForm.subject_id,
      exam_type: examLabel,
      semester: parseInt(resForm.semester),
      academic_year_id: resForm.academic_year_id || undefined
    });

    const records = (parsed.students || []).map(s => ({
      enrollment_number: s.enrollment_number,
      subject_id: resForm.subject_id,
      academic_year_id: resForm.academic_year_id,
      semester: parseInt(resForm.semester),
      exam_type: examLabel,
      section_a_marks: s.section_a_marks ?? null,
      section_b_marks: s.section_b_marks ?? null,
      marks: s.total_marks ?? null,
      max_marks: 60,
      grade: s.total_marks == null ? "AB" : s.total_marks >= 24 ? "PASS" : "FAIL",
      status: s.total_marks == null ? "absent" : s.total_marks >= 24 ? "pass" : "fail",
      published: true
    }));

    const BATCH = 50;
    let imported = 0;
    for (let i = 0; i < records.length; i += BATCH) {
      await base44.entities.Results.bulkCreate(records.slice(i, i + BATCH));
      imported += Math.min(BATCH, records.length - i);
    }

    await base44.entities.ResultUploads.create({
      branch: resForm.branch,
      semester: parseInt(resForm.semester),
      academic_year_id: resForm.academic_year_id,
      subject_id: resForm.subject_id,
      subject_code: subject?.code,
      exam_type: examLabel,
      pdf_url: file_url,
      status: "done",
      records_imported: imported,
      processed_at: new Date().toISOString()
    });

    toast({ title: `Results imported: ${imported} records` });
    setResForm(f => ({ ...f, file: null }));
    setResUploading(false);
    loadData();
  }

  const statusBadge = (status) => {
    const map = { done: "default", error: "destructive", processing: "secondary", pending: "outline" };
    const icons = { done: CheckCircle, error: AlertCircle, processing: Loader2, pending: Clock };
    const Icon = icons[status] || Clock;
    return <Badge variant={map[status] || "outline"} className="gap-1"><Icon className="h-3 w-3" />{status}</Badge>;
  };

  const filteredSubjects = subjects.filter(s => s.branch === resForm.branch && s.semester === parseInt(resForm.semester));

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
                  <Label>Academic Year</Label>
                  <Select value={attForm.academic_year_id} onValueChange={v => setAttForm(f => ({ ...f, academic_year_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                    <SelectContent>{academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Week Label (e.g. "Week 07 – Aug 24–29")</Label>
                  <Input value={attForm.week_label} onChange={e => setAttForm(f => ({ ...f, week_label: e.target.value }))} placeholder="Week 07 – Aug 24–29, 2026" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Week Start</Label><Input type="date" value={attForm.week_start} onChange={e => setAttForm(f => ({ ...f, week_start: e.target.value }))} /></div>
                  <div><Label>Week End</Label><Input type="date" value={attForm.week_end} onChange={e => setAttForm(f => ({ ...f, week_end: e.target.value }))} /></div>
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
            <CardHeader><CardTitle>Upload History</CardTitle></CardHeader>
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
                        <SelectItem value="gtu">GTU Exam</SelectItem>
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
                </div>
                <Button type="submit" disabled={resUploading}>
                  {resUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing PDF…</> : <><Upload className="h-4 w-4 mr-2" />Upload & Import</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Upload History</CardTitle></CardHeader>
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