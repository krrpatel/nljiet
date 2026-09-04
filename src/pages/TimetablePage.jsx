import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { usePortal } from "@/lib/portalContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Calendar, CheckCircle, Clock, Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ComingSoonDept from "@/components/ComingSoonDept";

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hr12 = hour % 12 || 12;
  return `${hr12}:${m} ${ampm}`;
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", weekday: "short" });
}

function isPast(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function TimetablePage() {
  const { student, subjects, loading: portalLoading, isDeptLive } = usePortal();
  const [midSem, setMidSem] = useState([]);
  const [gtu, setGtu] = useState([]);
  const [loading, setLoading] = useState(true);

  const subjectMap = {};
  for (const s of subjects) subjectMap[s.id] = s;

  useEffect(() => {
    if (!student) { setLoading(false); return; }
    loadTimetables();
  }, [student]);

  async function loadTimetables() {
    setLoading(true);
    const safe = request => request.catch(() => []);
    const [mid, gtuData] = await Promise.all([
      safe(api.entities.MidSemTimetable.filter({ branch: student.branch, semester: Number(student.semester), published: true }, "exam_date")),
      safe(api.entities.GTUTimetable.filter({ branch: student.branch, semester: Number(student.semester), published: true }, "exam_date")),
    ]);
    setMidSem(mid);
    setGtu(gtuData);
    setLoading(false);
  }

  if (portalLoading || loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isDeptLive && student) return <ComingSoonDept branch={student.branch} feature="Timetable" />;

  const renderExamCard = (entry) => {
    const subj = subjectMap[entry.subject_id];
    const past = isPast(entry.exam_date);
    return (
      <Card key={entry.id} className={`${past || entry.is_completed ? "opacity-75" : ""} ${!past && !entry.is_completed ? "border-primary/30" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {entry.exam_number && <Badge variant={entry.exam_number === 1 ? "default" : "secondary"}>Mid Sem {entry.exam_number}</Badge>}
                {entry.is_completed && <Badge variant="outline" className="text-green-600 border-green-300 gap-1"><CheckCircle className="h-3 w-3" />Done</Badge>}
                {!past && !entry.is_completed && <Badge variant="outline" className="text-blue-600 border-blue-300 gap-1"><Clock className="h-3 w-3" />Upcoming</Badge>}
              </div>
              <p className="font-semibold">{subj?.name || entry.subject_name}</p>
              <p className="text-xs text-muted-foreground font-mono">{subj?.code || entry.subject_code}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(entry.exam_date)}</span>
                {entry.start_time && <span>{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</span>}
                {entry.venue && <span>📍 {entry.venue}</span>}
              </div>
            </div>
            {entry.syllabus_pdf_url && (
              <a href={entry.syllabus_pdf_url} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="shrink-0">
                  <Download className="h-4 w-4 mr-1" />Syllabus
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const midSem1 = midSem.filter(e => e.exam_number === 1);
  const midSem2 = midSem.filter(e => e.exam_number === 2);

  return (
    <div className="space-y-6">
      <PageHeader title="Exam Timetable" description={`${student?.branch} • Semester ${student?.semester}`} />

      <Tabs defaultValue="midsem1">
        <TabsList className="flex-wrap">
          <TabsTrigger value="midsem1">Mid Sem 1{midSem1.length > 0 && ` (${midSem1.length})`}</TabsTrigger>
          <TabsTrigger value="midsem2">Mid Sem 2{midSem2.length > 0 && ` (${midSem2.length})`}</TabsTrigger>
          <TabsTrigger value="gtu">GTU Exam{gtu.length > 0 && ` (${gtu.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="midsem1" className="space-y-3 mt-4">
          {midSem1.length === 0
            ? <div className="text-center py-16 text-muted-foreground border rounded-xl bg-muted/20"><Clock className="h-8 w-8 mx-auto mb-3 opacity-40" /><p>Mid Sem 1 timetable not yet declared.</p></div>
            : midSem1.map(renderExamCard)
          }
        </TabsContent>

        <TabsContent value="midsem2" className="space-y-3 mt-4">
          {midSem2.length === 0
            ? <div className="text-center py-16 text-muted-foreground border rounded-xl bg-muted/20"><Clock className="h-8 w-8 mx-auto mb-3 opacity-40" /><p>Mid Sem 2 timetable not yet declared.</p></div>
            : midSem2.map(renderExamCard)
          }
        </TabsContent>

        <TabsContent value="gtu" className="space-y-3 mt-4">
          {gtu.length === 0
            ? <div className="text-center py-16 text-muted-foreground border rounded-xl bg-muted/20"><Clock className="h-8 w-8 mx-auto mb-3 opacity-40" /><p>GTU timetable not yet declared.</p></div>
            : gtu.map(renderExamCard)
          }
        </TabsContent>
      </Tabs>
    </div>
  );
}
