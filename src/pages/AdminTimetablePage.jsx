import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Download, Upload, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/PageHeader";

const BRANCHES = ["CSE", "AIML", "DS"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const emptyMidSem = { exam_number: 1, subject_id: "", branch: "CSE", semester: 5, academic_year_id: "", exam_date: "", start_time: "", end_time: "", venue: "", syllabus_pdf_url: "", published: true };
const emptyGTU = { subject_id: "", branch: "CSE", semester: 5, academic_year_id: "", exam_date: "", start_time: "", end_time: "", venue: "", published: true };
function isPastExam(dateString) {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = new Date(`${dateString}T00:00:00`);
  return !Number.isNaN(examDate.getTime()) && examDate < today;
}

export default function AdminTimetablePage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [midSemEntries, setMidSemEntries] = useState([]);
  const [gtuEntries, setGtuEntries] = useState([]);
  const [syllabi, setSyllabi] = useState([]);
  const [loading, setLoading] = useState(true);

  const [midSemForm, setMidSemForm] = useState(emptyMidSem);
  const [gtuForm, setGtuForm] = useState(emptyGTU);
  const [midSemDialog, setMidSemDialog] = useState(false);
  const [gtuDialog, setGtuDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syllabusExamNumber, setSyllabusExamNumber] = useState("1");
  const [syllabusUploading, setSyllabusUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [filterBranch, setFilterBranch] = useState("CSE");
  const [filterSem, setFilterSem] = useState("5");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const safe = request => request.catch(() => []);
    const [subs, years, mid, gtu, syllabusRows] = await Promise.all([
      safe(api.entities.Subjects.list()),
      safe(api.entities.AcademicYears.list()),
      safe(api.entities.MidSemTimetable.list("-exam_date")),
      safe(api.entities.GTUTimetable.list("-exam_date")),
      safe(api.entities.TimetableSyllabi.list("-created_at")),
    ]);
    setSubjects(subs);
    setAcademicYears(years);
    const markPast = async (entries, entity) => {
      const pastEntries = entries.filter(entry => isPastExam(entry.exam_date) && !entry.is_completed);
      await Promise.all(pastEntries.map(entry => entity.update(entry.id, { is_completed: true }).catch(() => {})));
      return entries.map(entry => isPastExam(entry.exam_date) ? { ...entry, is_completed: true } : entry);
    };
    const [completedMid, completedGtu] = await Promise.all([
      markPast(mid, api.entities.MidSemTimetable),
      markPast(gtu, api.entities.GTUTimetable),
    ]);
    setMidSemEntries(completedMid);
    setGtuEntries(completedGtu);
    setSyllabi(syllabusRows);
    const current = years.find(y => y.is_current);
    if (current) {
      setMidSemForm(f => ({ ...f, academic_year_id: current.id }));
      setGtuForm(f => ({ ...f, academic_year_id: current.id }));
    }
    setLoading(false);
  }

  function getSubjectName(id) {
    const s = subjects.find(s => s.id === id);
    return s ? `${s.code} – ${s.name}` : id;
  }

  async function saveMidSem(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!midSemForm.subject_id || !midSemForm.exam_date) throw new Error("Subject and exam date are required.");
      const subj = subjects.find(s => s.id === midSemForm.subject_id);
      const payload = { ...midSemForm, exam_number: parseInt(midSemForm.exam_number), semester: parseInt(midSemForm.semester), is_completed: isPastExam(midSemForm.exam_date) || Boolean(midSemForm.is_completed), subject_code: subj?.code || "", subject_name: subj?.name || "" };
      if (editingId) {
        await api.entities.MidSemTimetable.update(editingId, payload);
        toast({ title: "Timetable updated" });
      } else {
        await api.entities.MidSemTimetable.create(payload);
        toast({ title: "Timetable entry added" });
      }
      setMidSemForm({ ...emptyMidSem, academic_year_id: midSemForm.academic_year_id });
      setEditingId(null);
      setMidSemDialog(false);
      await loadData();
    } catch (error) {
      toast({ title: "Could not save timetable", description: error.message.includes("mid_sem_timetable") ? "Run the timetable Supabase migration first." : error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function saveGTU(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!gtuForm.subject_id || !gtuForm.exam_date) throw new Error("Subject and exam date are required.");
      const subj = subjects.find(s => s.id === gtuForm.subject_id);
      const payload = { ...gtuForm, semester: parseInt(gtuForm.semester), is_completed: isPastExam(gtuForm.exam_date) || Boolean(gtuForm.is_completed), subject_code: subj?.code || "", subject_name: subj?.name || "" };
      if (editingId) {
        await api.entities.GTUTimetable.update(editingId, payload);
        toast({ title: "Timetable updated" });
      } else {
        await api.entities.GTUTimetable.create(payload);
        toast({ title: "GTU timetable entry added" });
      }
      setGtuForm({ ...emptyGTU, academic_year_id: gtuForm.academic_year_id });
      setEditingId(null);
      setGtuDialog(false);
      await loadData();
    } catch (error) {
      toast({ title: "Could not save timetable", description: error.message.includes("gtu_timetable") ? "Run the timetable Supabase migration first." : error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleMidSemComplete(entry) {
    if (isPastExam(entry.exam_date)) return;
    try {
      await api.entities.MidSemTimetable.update(entry.id, { is_completed: !entry.is_completed });
      await loadData();
    } catch (error) {
      toast({ title: "Could not update timetable", description: error.message, variant: "destructive" });
    }
  }

  async function deleteMidSem(id) {
    if (!window.confirm("Delete this timetable entry?")) return;
    try {
      await api.entities.MidSemTimetable.delete(id);
      await loadData();
    } catch (error) {
      toast({ title: "Could not delete timetable entry", description: error.message, variant: "destructive" });
    }
  }

  async function deleteGTU(id) {
    if (!window.confirm("Delete this timetable entry?")) return;
    try {
      await api.entities.GTUTimetable.delete(id);
      await loadData();
    } catch (error) {
      toast({ title: "Could not delete timetable entry", description: error.message, variant: "destructive" });
    }
  }

  async function handleSyllabusUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "PDF required", description: "Upload the common syllabus as a PDF file.", variant: "destructive" });
      return;
    }
    setSyllabusUploading(true);
    let uploadedUrl = null;
    try {
      const academicYearId = academicYears.find(year => year.is_current)?.id || null;
      const existing = syllabi.find(row => row.branch === filterBranch && Number(row.semester) === Number(filterSem) && Number(row.exam_number) === Number(syllabusExamNumber) && String(row.academic_year_id || "") === String(academicYearId || ""));
      uploadedUrl = (await api.integrations.Core.UploadFile({ file, folder: "timetable-syllabi" })).file_url;
      const payload = { branch: filterBranch, semester: Number(filterSem), exam_number: Number(syllabusExamNumber), academic_year_id: academicYearId, pdf_url: uploadedUrl, updated_at: new Date().toISOString() };
      if (existing?.id) await api.entities.TimetableSyllabi.update(existing.id, payload);
      else await api.entities.TimetableSyllabi.create(payload);
      if (existing?.pdf_url && existing.pdf_url !== uploadedUrl && (existing.pdf_url.includes("/storage/v1/object/public/portal-files/") || existing.pdf_url.startsWith("/uploads/"))) await api.integrations.Core.DeleteFile(existing.pdf_url).catch(() => {});
      uploadedUrl = null;
      toast({ title: "Common syllabus uploaded" });
      await loadData();
    } catch (error) {
      if (uploadedUrl) await api.integrations.Core.DeleteFile(uploadedUrl).catch(() => {});
      toast({ title: "Could not upload syllabus", description: error.message, variant: "destructive" });
    } finally {
      setSyllabusUploading(false);
      e.target.value = "";
    }
  }

  const filteredMid = midSemEntries.filter(e => e.branch === filterBranch && String(e.semester) === filterSem);
  const filteredGTU = gtuEntries.filter(e => e.branch === filterBranch && String(e.semester) === filterSem);
  const filteredSubjects = subjects.filter(s => s.branch === filterBranch && String(s.semester) === filterSem);
  const currentAcademicYearId = academicYears.find(year => year.is_current)?.id || null;
  const commonSyllabus = syllabi.find(row => row.branch === filterBranch && Number(row.semester) === Number(filterSem) && Number(row.exam_number) === Number(syllabusExamNumber) && String(row.academic_year_id || "") === String(currentAcademicYearId || ""))
    || filteredMid.find(entry => Number(entry.exam_number) === Number(syllabusExamNumber) && entry.syllabus_pdf_url);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Timetable Management" description="Manage Mid Sem and GTU exam timetables" />

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterSem} onValueChange={setFilterSem}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{SEMESTERS.map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="midsem">
        <TabsList>
          <TabsTrigger value="midsem">Mid Sem Exams</TabsTrigger>
          <TabsTrigger value="gtu">GTU Exams</TabsTrigger>
        </TabsList>

        <TabsContent value="midsem" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">Common syllabus</p>
                <p className="text-sm text-muted-foreground">One syllabus PDF shared by every subject in this branch and semester.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={syllabusExamNumber} onValueChange={setSyllabusExamNumber}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">Mid Sem 1</SelectItem><SelectItem value="2">Mid Sem 2</SelectItem></SelectContent>
                </Select>
                {commonSyllabus?.pdf_url && <a href={commonSyllabus.pdf_url} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Download syllabus</Button></a>}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={syllabusUploading}><span>{syllabusUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}{syllabusUploading ? "Uploading…" : commonSyllabus?.pdf_url ? "Replace syllabus" : "Upload syllabus"}</span></Button>
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleSyllabusUpload} />
                </label>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Dialog open={midSemDialog} onOpenChange={v => { setMidSemDialog(v); if (!v) { setEditingId(null); setMidSemForm({ ...emptyMidSem, branch: filterBranch, semester: parseInt(filterSem), academic_year_id: academicYears.find(y => y.is_current)?.id || "" }); }}}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Entry</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingId ? "Edit" : "Add"} Mid Sem Timetable</DialogTitle></DialogHeader>
                <form onSubmit={saveMidSem} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Exam Number</Label>
                      <Select value={String(midSemForm.exam_number)} onValueChange={v => setMidSemForm(f => ({ ...f, exam_number: parseInt(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="1">Mid Sem 1</SelectItem><SelectItem value="2">Mid Sem 2</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Branch</Label>
                      <Select value={midSemForm.branch} onValueChange={v => setMidSemForm(f => ({ ...f, branch: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Semester</Label>
                      <Select value={String(midSemForm.semester)} onValueChange={v => setMidSemForm(f => ({ ...f, semester: parseInt(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SEMESTERS.map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Academic Year</Label>
                      <Select value={midSemForm.academic_year_id} onValueChange={v => setMidSemForm(f => ({ ...f, academic_year_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.title}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Select value={midSemForm.subject_id} onValueChange={v => setMidSemForm(f => ({ ...f, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>{subjects.filter(s => s.branch === midSemForm.branch && s.semester === midSemForm.semester).map(s => <SelectItem key={s.id} value={s.id}>{s.code} – {s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Exam Date</Label><Input type="date" value={midSemForm.exam_date} onChange={e => setMidSemForm(f => ({ ...f, exam_date: e.target.value }))} required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Start Time</Label><Input type="time" value={midSemForm.start_time} onChange={e => setMidSemForm(f => ({ ...f, start_time: e.target.value }))} /></div>
                    <div><Label>End Time</Label><Input type="time" value={midSemForm.end_time} onChange={e => setMidSemForm(f => ({ ...f, end_time: e.target.value }))} /></div>
                  </div>
                  <div><Label>Venue</Label><Input value={midSemForm.venue} onChange={e => setMidSemForm(f => ({ ...f, venue: e.target.value }))} placeholder="e.g. Lab 101" /></div>
                  <Button type="submit" disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2">
            {filteredMid.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No mid sem timetable entries for {filterBranch} Sem {filterSem}.</p>}
            {filteredMid.map(entry => (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={entry.exam_number === 1 ? "default" : "secondary"}>Mid Sem {entry.exam_number}</Badge>
                        {entry.is_completed && <Badge variant="outline" className="text-green-600 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>}
                        {!entry.published && <Badge variant="outline" className="text-orange-500 border-orange-300">Draft</Badge>}
                      </div>
                      <p className="font-semibold">{getSubjectName(entry.subject_id)}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.exam_date} {entry.start_time && `• ${entry.start_time}–${entry.end_time}`} {entry.venue && `• ${entry.venue}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {!isPastExam(entry.exam_date) && <Button variant="ghost" size="sm" onClick={() => toggleMidSemComplete(entry)}>
                        {entry.is_completed ? "Mark Pending" : "Mark Done"}
                      </Button>}
                      <Button variant="ghost" size="icon" onClick={() => { setEditingId(entry.id); setMidSemForm({ ...entry }); setMidSemDialog(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMidSem(entry.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="gtu" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={gtuDialog} onOpenChange={v => { setGtuDialog(v); if (!v) { setEditingId(null); setGtuForm({ ...emptyGTU, branch: filterBranch, semester: parseInt(filterSem), academic_year_id: academicYears.find(y => y.is_current)?.id || "" }); }}}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Entry</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingId ? "Edit" : "Add"} GTU Timetable</DialogTitle></DialogHeader>
                <form onSubmit={saveGTU} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Branch</Label>
                      <Select value={gtuForm.branch} onValueChange={v => setGtuForm(f => ({ ...f, branch: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Semester</Label>
                      <Select value={String(gtuForm.semester)} onValueChange={v => setGtuForm(f => ({ ...f, semester: parseInt(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SEMESTERS.map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Select value={gtuForm.subject_id} onValueChange={v => setGtuForm(f => ({ ...f, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>{subjects.filter(s => s.branch === gtuForm.branch && s.semester === gtuForm.semester).map(s => <SelectItem key={s.id} value={s.id}>{s.code} – {s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Exam Date</Label><Input type="date" value={gtuForm.exam_date} onChange={e => setGtuForm(f => ({ ...f, exam_date: e.target.value }))} required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Start Time</Label><Input type="time" value={gtuForm.start_time} onChange={e => setGtuForm(f => ({ ...f, start_time: e.target.value }))} /></div>
                    <div><Label>End Time</Label><Input type="time" value={gtuForm.end_time} onChange={e => setGtuForm(f => ({ ...f, end_time: e.target.value }))} /></div>
                  </div>
                  <div><Label>Venue</Label><Input value={gtuForm.venue} onChange={e => setGtuForm(f => ({ ...f, venue: e.target.value }))} /></div>
                  <Button type="submit" disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-2">
            {filteredGTU.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No GTU timetable entries for {filterBranch} Sem {filterSem}.</p>}
            {filteredGTU.map(entry => (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        {isPastExam(entry.exam_date) || entry.is_completed ? <Badge variant="outline" className="text-green-600 border-green-300 gap-1"><CheckCircle className="h-3 w-3" />Completed</Badge> : <Badge variant="outline" className="text-blue-600 border-blue-300">Upcoming</Badge>}
                      </div>
                      <p className="font-semibold">{getSubjectName(entry.subject_id)}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.exam_date} {entry.start_time && `• ${entry.start_time}–${entry.end_time}`} {entry.venue && `• ${entry.venue}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingId(entry.id); setGtuForm({ ...entry }); setGtuDialog(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteGTU(entry.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
