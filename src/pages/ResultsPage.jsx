import React, { useMemo } from "react";
import { usePortal } from "@/lib/portalContext";
import ComingSoonDept from "@/components/ComingSoonDept";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Award, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";

const PASSING_MARKS = 24; // out of 60 for midsem

function getGradeBadge(marks, maxMarks) {
  if (marks == null) return <Badge variant="outline" className="text-gray-400">Absent</Badge>;
  const pct = (marks / maxMarks) * 100;
  if (pct >= 75) return <Badge className="bg-green-100 text-green-800 border-green-200">A</Badge>;
  if (pct >= 60) return <Badge className="bg-blue-100 text-blue-800 border-blue-200">B</Badge>;
  if (pct >= 40) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">C</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200">F</Badge>;
}

function PassFailBadge({ marks, passing }) {
  if (marks == null) return <Badge variant="outline" className="text-gray-400">Absent</Badge>;
  if (marks >= passing) return <Badge className="bg-green-100 text-green-800 border-green-200 gap-1"><CheckCircle className="h-3 w-3" />Pass</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200 gap-1"><XCircle className="h-3 w-3" />Fail</Badge>;
}

export default function ResultsPage() {
  const { student, results, subjects, loading, isDeptLive } = usePortal();

  const subjectMap = useMemo(() => {
    const map = {};
    for (const s of subjects) map[s.id] = s;
    return map;
  }, [subjects]);

  // Keep the student view focused on the two MSEs. GTU rows are not shown;
  // re-exam rows remain available when they are uploaded separately.
  const grouped = useMemo(() => {
    const g = {};
    for (const r of results) {
      const type = String(r.exam_type || "").toLowerCase();
      if (type.includes("gtu")) continue;
      const key = /midsem1|mse[_ -]?1/.test(type) ? "midsem1" : /midsem2|mse[_ -]?2/.test(type) ? "midsem2" : type.includes("remse") ? "remse" : type;
      if (!key) continue;
      if (!g[key]) g[key] = [];
      g[key].push(r);
    }
    return g;
  }, [results]);

  const examTypes = Object.keys(grouped).sort((a, b) => {
    const order = { midsem1: 1, midsem2: 2, remse: 3 };
    return (order[a] || 9) - (order[b] || 9);
  });
  const visibleResults = examTypes.flatMap(type => grouped[type]);

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded animate-pulse" />)}</div>
    </div>
  );

  if (!isDeptLive && student) return <ComingSoonDept branch={student.branch} feature="Results" />;

  if (!student) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
      <h2 className="text-xl font-semibold mb-2">Student data not found</h2>
      <p className="text-muted-foreground max-w-sm">Your enrollment number wasn't matched. Contact your department admin.</p>
    </div>
  );

  if (visibleResults.length === 0) return (
    <div className="space-y-6">
      <PageHeader title="Results" description="Your academic results" />
      <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-muted/30">
        <Award className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No results published yet</h2>
        <p className="text-muted-foreground">Results will appear here once uploaded by your admin.</p>
      </div>
    </div>
  );

  const renderResultTable = (resultList, examLabel) => {
    if (resultList.length === 0) return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No results published for {examLabel} yet.</p>
      </div>
    );

    const isMidSem = /mse|mid|remse/i.test(examLabel);
    const passingMarks = isMidSem ? PASSING_MARKS : null;
    return (
      <div className="space-y-4">
        {isMidSem && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatCard label="Subjects" value={resultList.length} icon={Award} />
            <StatCard label="Total Marks" value={`${resultList.reduce((sum, result) => sum + (Number(result.marks) || 0), 0)}/${60 * resultList.length}`} sub={`60 × ${resultList.length} subjects`} icon={TrendingUp} accent="blue" />
            <StatCard label="Passed" value={`${resultList.filter(result => result.marks != null && result.marks >= PASSING_MARKS).length}/${resultList.length}`} icon={CheckCircle} accent="emerald" />
            <StatCard label="Average" value={resultList.filter(result => result.marks != null).length ? (resultList.filter(result => result.marks != null).reduce((sum, result) => sum + Number(result.marks), 0) / resultList.filter(result => result.marks != null).length).toFixed(1) : "–"} sub="out of 60" icon={TrendingUp} accent="blue" />
            <StatCard label="Highest" value={resultList.some(result => result.marks != null) ? Math.max(...resultList.filter(result => result.marks != null).map(result => Number(result.marks))) : "–"} sub="out of 60" icon={Award} accent="violet" />
          </div>
        )}

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Subject</th>
                {isMidSem && <th className="text-center px-3 py-3 font-medium">Sec A</th>}
                {isMidSem && <th className="text-center px-3 py-3 font-medium">Sec B</th>}
                <th className="text-center px-3 py-3 font-medium">Total</th>
                <th className="text-center px-3 py-3 font-medium">Max</th>
                <th className="text-center px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {resultList.map((r, i) => {
                const subj = subjectMap[r.subject_id];
                const failed = r.marks != null && passingMarks != null && r.marks < passingMarks;
                return (
                  <tr key={r.id || i} className={failed ? "bg-red-50" : ""}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{subj?.name || subj?.code || r.subject_id}</p>
                      <p className="text-xs text-muted-foreground">{subj?.code}</p>
                    </td>
                    {isMidSem && <td className="text-center px-3 py-3">{r.section_a_marks ?? "–"}</td>}
                    {isMidSem && <td className="text-center px-3 py-3">{r.section_b_marks ?? "–"}</td>}
                    <td className="text-center px-3 py-3 font-semibold">{r.marks ?? "AB"}</td>
                    <td className="text-center px-3 py-3 text-muted-foreground">{r.max_marks ?? 60}</td>
                    <td className="text-center px-3 py-3">
                      {passingMarks != null
                        ? <PassFailBadge marks={r.marks} passing={passingMarks} />
                        : getGradeBadge(r.marks, r.max_marks || 100)
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isMidSem && <p className="text-xs text-muted-foreground text-center">Passing marks: {PASSING_MARKS}/60 (each section: no separate cutoff; total ≥{PASSING_MARKS})</p>}
      </div>
    );
  };

  const tabLabels = {
    midsem1: "MSE 1",
    midsem2: "MSE 2",
    remse: "Re-exam / Remedial"
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Results" description={`${student.branch} • Sem ${student.semester}`} />

      {examTypes.length === 1 ? (
        renderResultTable(grouped[examTypes[0]], tabLabels[examTypes[0]] || examTypes[0])
      ) : (
        <Tabs defaultValue={examTypes[0]}>
          <TabsList>
            {examTypes.map(t => <TabsTrigger key={t} value={t}>{tabLabels[t] || t}</TabsTrigger>)}
          </TabsList>
          {examTypes.map(t => (
            <TabsContent key={t} value={t}>
              {renderResultTable(grouped[t], tabLabels[t] || t)}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
