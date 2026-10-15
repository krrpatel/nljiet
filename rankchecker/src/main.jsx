import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";

const initialForm = { lookup: "", lookupType: "enrollment", branch: "CSE", semester: "5", capacity: "40" };

const subjectAbbreviations = {
  "COMPUTER NETWORKS": "CN",
  "SYSTEM SOFTWARE": "SS",
  "MICROPROCESSOR AND INTERFACING": "MI",
  "PYTHON FOR DATA SCIENCE": "PDS",
  "WEB APPLICATION AND DEVELOPMENT": "WAD",
  "OCCUPATIONAL HEALTH AND SAFETY MANAGEMENT": "OSM",
};

function abbreviatedSubject(subject) {
  const code = String(subject?.code || "").replace(/^BE\d+/, "").trim();
  const name = String(subject?.name || "").trim().toUpperCase();
  if (subjectAbbreviations[name]) return subjectAbbreviations[name];
  if (code && code.length <= 8 && !/^\d+$/.test(code)) return code.toUpperCase();
  const initials = name.split(/[^A-Z0-9]+/).filter(Boolean).filter(word => word.length > 1).map(word => word[0]).join("");
  return initials.slice(0, 6) || "Subject";
}

function formatName(value) {
  return String(value || "Student").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

function rankApiPath() {
  const mounted = window.location.pathname === "/rankchecker" || window.location.pathname.startsWith("/rankchecker/");
  return mounted ? "/rankchecker/api/rank-checker" : "/api/rank-checker";
}

function App() {
  const [form, setForm] = useState(initialForm);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const chartData = useMemo(() => (data?.target?.subject_scores || []).map(subject => ({
    subject: abbreviatedSubject(subject),
    fullSubject: subject.name || subject.code,
    "MSE 1": subject.midsem1,
    "MSE 2": subject.midsem2,
  })), [data]);

  const missingEntries = useMemo(() => (data?.target?.subject_scores || []).flatMap(subject => {
    const label = abbreviatedSubject(subject);
    return [subject.midsem1 == null ? `${label} MSE 1 entry is missing` : null, subject.midsem2 == null ? `${label} MSE 2 entry is missing` : null].filter(Boolean);
  }), [data]);

  const examTotals = useMemo(() => data ? [
    { exam: "MSE 1", marks: data.target.midsem1_total },
    { exam: "MSE 2", marks: data.target.midsem2_total },
  ] : [], [data]);

  async function submit(event) {
    event.preventDefault();
    if (loading || Date.now() < cooldownUntil) {
      setError("Please wait a moment before checking again.");
      return;
    }
    setError("");
    setData(null);
    setLoading(true);
    setCooldownUntil(Date.now() + 2000);
    try {
      const params = new URLSearchParams(form);
      const response = await fetch(`${rankApiPath()}?${params.toString()}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load the rank.");
      setData(body);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><span>R</span><div><strong>Rank Checker</strong><small>Student Portal intelligence</small></div></div>
        <div className="topbar-note"><span className="status-dot" /> Live result lookup</div>
      </header>

      <main className="page-wrap">
        <section className="hero">
          <div className="eyebrow">CSE · Mid Semester analytics</div>
          <h1>Know exactly where you stand.</h1>
          <p>Enter one number to see your new roll number, marks, charts, and calculated division.</p>
          <form className="search-panel" onSubmit={submit}>
            <label className="search-field"><span>Enter number</span><input value={form.lookup} onChange={event => update("lookup", event.target.value)} inputMode="numeric" placeholder="Enrollment or current roll number" required /></label>
            <label className="search-field"><span>Number type</span><select value={form.lookupType} onChange={event => update("lookupType", event.target.value)}><option value="enrollment">Enrollment number</option><option value="roll">Current roll number</option></select></label>
            <label className="search-field"><span>Students per division</span><select value={form.capacity} onChange={event => update("capacity", event.target.value)}>{Array.from({ length: 11 }, (_, index) => index + 30).map(value => <option key={value} value={value}>{value} students</option>)}</select></label>
            <button className="search-button" type="submit" disabled={loading}>{loading ? "Checking..." : "Check result"}<span>↗</span></button>
          </form>
          <div className="hero-footnote"><span>↗</span> Select whether you are entering an enrollment number or current roll number. <span>·</span> Ties remain together when a division reaches its capacity.</div>
        </section>

        {error && <div className="error-banner">{error}</div>}

        {data && (
          <div className="results-space">
            <section className="identity-grid">
              <div className="identity-card">
                <div className="identity-kicker">Result found</div>
                <h2>{formatName(data.target.full_name)}</h2>
                <div className="identity-meta"><span>{data.target.enrollment_number}</span><span>Old roll no. {data.target.roll_number ?? "-"}</span><span>Old division {data.target.source_division || "-"}</span><span>{data.settings.branch} · Sem {data.settings.semester}</span></div>
                <div className="identity-divider" />
                <div className="mini-pairs"><div><small>New division</small><strong>{data.target.calculated_division}</strong></div><div><small>New roll no.</small><strong>{data.target.new_roll_number}</strong></div><div><small>Data coverage</small><strong>{data.target.completed_entries}/12 entries</strong></div></div>
              </div>
              <div className="rank-card"><div className="rank-label">New roll number</div><div className="rank-number">{data.target.new_roll_number}</div><div className="rank-caption">within {data.target.calculated_division}</div></div>
              <div className="score-card"><div className="score-label">Normalized score</div><div className="score-number">{data.target.ranking_score}<small>/180</small></div><div className="score-caption">ceil(total marks ÷ 4)</div><div className="score-raw">Raw total {data.target.total_marks}/{data.target.max_marks}</div></div>
            </section>

            <div className="coverage-banner"><span className="status-dot" /> Available exam data: <strong>{data.availableExams.length ? data.availableExams.map(exam => exam.toUpperCase().replace("MIDSEM", "MSE ")).join(" + ") : "none"}</strong><span className="coverage-muted">{missingEntries.length ? "See missing subject entries below." : "Complete subject coverage."}</span></div>

            {missingEntries.length > 0 && <div className="missing-entries" role="status"><strong>Missing entries:</strong> {missingEntries.join(" · ")}</div>}

            <section className="chart-grid">
              <div className="panel chart-panel"><div className="panel-heading"><div><div className="panel-kicker">Subject performance</div><h3>Marks by subject</h3></div><span className="chart-legend-dot">●</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6eaf0" /><XAxis dataKey="subject" tick={{ fill: "#718096", fontSize: 11 }} /><YAxis domain={[0, 60]} tick={{ fill: "#718096", fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="MSE 1" fill="#12b8a6" radius={[5,5,0,0]} /><Bar dataKey="MSE 2" fill="#4057d6" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></div>
              <div className="panel chart-panel"><div className="panel-heading"><div><div className="panel-kicker">Exam trend</div><h3>Midsem totals</h3></div><span className="trend-pill">/ 360 each</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={examTotals} margin={{ top: 8, right: 12, left: -20, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6eaf0" /><XAxis dataKey="exam" tick={{ fill: "#718096", fontSize: 11 }} /><YAxis domain={[0, 360]} tick={{ fill: "#718096", fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="marks" stroke="#f2695b" strokeWidth={3} dot={{ r: 5, fill: "#f2695b" }} connectNulls /></LineChart></ResponsiveContainer></div></div>
            </section>

            <section className="panel division-panel"><div className="panel-heading"><div><div className="panel-kicker">Capacity planner</div><h3>Calculated division progress</h3></div><span className="trend-pill">6 divisions max · {data.settings.capacity} seats</span></div><div className="division-grid">{Array.from({ length: 6 }, (_, index) => { const division = `D${index + 1}`; const item = data.divisions.find(entry => entry.name === division); const count = item?.count || 0; const percent = Math.min(100, Math.round((count / data.settings.capacity) * 100)); return <div className={`division-item ${data.target.calculated_division === division ? "selected" : ""}`} key={division}><div className="division-line"><strong>{division}</strong><span>{count} / {data.settings.capacity}</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div><small>{data.target.calculated_division === division ? "Your calculated class" : count ? `${percent}% filled` : "Awaiting results"}</small></div>; })}</div><p className="tie-note">Tie-aware allocation: students with the same normalized score are kept in the same division, even if that division goes above its nominal limit.</p></section>

            <section className="panel roster-panel"><div className="panel-heading"><div><div className="panel-kicker">Your calculated division</div><h3>Students in {data.target.calculated_division}</h3></div><span className="trend-pill">{data.students.length} students</span></div><div className="table-scroll"><table><thead><tr><th>New roll no.</th><th>Student</th><th>Enrollment</th><th>Current roll</th><th>Score</th><th>Division</th></tr></thead><tbody>{data.students.map(student => <tr className={student.enrollment_number === data.target.enrollment_number ? "highlight-row" : ""} key={student.enrollment_number}><td><strong>{student.new_roll_number}</strong></td><td>{student.enrollment_number === data.target.enrollment_number ? formatName(data.target.full_name) : formatName(student.full_name || "Student")}</td><td className="mono">{student.enrollment_number}</td><td>{student.roll_number ?? "-"}</td><td><strong>{student.ranking_score}</strong><span className="muted-cell"> ({student.total_marks}/{student.max_marks})</span></td><td><span className="division-badge">{student.calculated_division}</span></td></tr>)}</tbody></table></div></section>
          </div>
        )}

        {!data && !error && <section className="empty-state"><div className="empty-icon">R</div><h2>Your result story starts here.</h2><p>Enter your number, choose its type, and see only the students in your calculated division.</p></section>}
      </main>
      <footer className="footer">Student Portal · Rank Checker <span>•</span> Marks are read from the official marks sheet.</footer>
      <div className="watermark">Made by Benzene aka Krrish Patel · Instagram: <a href="https://instagram.com/yourbenzene" target="_blank" rel="noreferrer">@yourbenzene</a></div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
