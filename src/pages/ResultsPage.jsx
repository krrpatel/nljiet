import React, { useMemo, useState } from "react";
import { usePortal } from "@/lib/portalContext";
import { subjectById } from "@/lib/portalData";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function ResultsPage() {
  const { student, portal, academic, loading } = usePortal();
  const [semFilter, setSemFilter] = useState("all");
  const [subjFilter, setSubjFilter] = useState("all");

  const results = useMemo(() => {
    if (!portal || !academic) return [];
    return academic.results
      .filter((r) => r.published)
      .filter((r) => semFilter === "all" || String(r.semester) === semFilter)
      .filter((r) => subjFilter === "all" || r.subject_id === subjFilter);
  }, [portal, academic, semFilter, subjFilter]);

  const chartData = useMemo(() => {
    return results.map((r) => {
      const subj = subjectById(portal.subjects, r.subject_id);
      return { name: subj?.abbreviation || "?", pct: Math.round((r.marks / r.max_marks) * 1000) / 10 };
    });
  }, [results, portal]);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 rounded bg-muted" /><div className="h-72 rounded-lg bg-muted" /></div>;

  const semesters = [...new Set((academic?.results || []).map((r) => r.semester))];

  return (
    <div>
      <PageHeader title="Results" description={`${student?.full_name} • ${student?.enrollment_number}`} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={semFilter} onValueChange={setSemFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Semester" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Semesters</SelectItem>
            {semesters.map((s) => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={subjFilter} onValueChange={setSubjFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {portal.subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {chartData.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Marks Comparison</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.pct >= 75 ? "#10b981" : d.pct >= 40 ? "#f59e0b" : "#f43f5e"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead><TableHead>Exam</TableHead><TableHead>Sem</TableHead>
                <TableHead>Sec A</TableHead><TableHead>Sec B</TableHead><TableHead>Marks</TableHead>
                <TableHead>Max</TableHead><TableHead>%</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => {
                const subj = subjectById(portal.subjects, r.subject_id);
                const pct = Math.round((r.marks / r.max_marks) * 1000) / 10;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{subj?.name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.exam_type}</TableCell>
                    <TableCell>{r.semester}</TableCell>
                    <TableCell>{r.section_a_marks ?? "—"}</TableCell>
                    <TableCell>{r.section_b_marks ?? "—"}</TableCell>
                    <TableCell className="font-semibold">{r.status === "absent" ? "AB" : r.marks}</TableCell>
                    <TableCell>{r.max_marks}</TableCell>
                    <TableCell>{r.status === "absent" ? "—" : `${pct}%`}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{r.status}</TableCell>
                  </TableRow>
                );
              })}
              {results.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No results published yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}