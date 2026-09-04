import React, { useMemo, useState } from "react";
import { usePortal } from "@/lib/portalContext";
import { subjectById } from "@/lib/portalData";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, CheckCircle2, Clock, AlertCircle, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AssignmentsPage() {
  const { student, portal, academic, refresh } = usePortal();
  const { toast } = useToast();
  const [notes, setNotes] = useState({});

  const assignments = useMemo(() => {
    if (!portal || !academic) return [];
    return portal.subjects
      .filter((s) => s.semester === student?.current_semester)
      .flatMap((s) => academic.assignments.filter((a) => a.subject_id === s.id && a.published));
  }, [portal, academic, student]);

  const statusFor = (aid) => academic?.studentAssignments.find((sa) => sa.assignment_id === aid);

  const setStatus = async (assignment, status) => {
    const existing = statusFor(assignment.id);
    try {
      if (existing) {
        await base44.entities.StudentAssignments.update(existing.id, {
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        });
      } else {
        await base44.entities.StudentAssignments.create({
          assignment_id: assignment.id,
          student_id: student.id,
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        });
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
    await base44.entities.StudentAssignments.update(existing.id, { notes: notes[assignment.id] ?? existing.notes });
    toast({ title: "Notes saved" });
    refresh();
  };

  const renderCard = (a) => {
    const subj = subjectById(portal.subjects, a.subject_id);
    const sa = statusFor(a.id);
    const st = sa?.status || "pending";
    const overdue = st === "overdue" || (st !== "completed" && new Date(a.deadline) < new Date());
    return (
      <Card key={a.id}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{a.title}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{subj?.name} • Assignment #{a.assignment_number}</p>
            </div>
            <StatusBadge status={st} overdue={overdue} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{a.description}</p>
          <p className="text-xs text-muted-foreground">Due: {new Date(a.deadline).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
          <Textarea
            placeholder="Add a note..."
            value={notes[a.id] ?? sa?.notes ?? ""}
            onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
            onBlur={() => saveNotes(a)}
            className="min-h-[60px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={st === "completed" ? "default" : "outline"} onClick={() => setStatus(a, "completed")}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark Done
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(a, "pending")}>
              <Clock className="mr-1.5 h-4 w-4" /> Not Done
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast({ title: "Upload coming soon", description: "PDF submission approval flow is being reviewed." })}>
              <Upload className="mr-1.5 h-4 w-4" /> Upload Solution
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!portal) return <div className="animate-pulse h-72 rounded-lg bg-muted" />;

  const pending = assignments.filter((a) => (statusFor(a.id)?.status || "pending") !== "completed" && new Date(a.deadline) >= new Date());
  const completed = assignments.filter((a) => statusFor(a.id)?.status === "completed");
  const overdue = assignments.filter((a) => (statusFor(a.id)?.status || "pending") !== "completed" && new Date(a.deadline) < new Date());

  return (
    <div>
      <PageHeader title="Assignments" description={`Semester ${student?.current_semester} • ${assignments.length} total`} />
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
        </TabsList>
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