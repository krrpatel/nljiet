import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

const clean = value => String(value || "").replace(/\s+/g, " ").trim();
export async function extractPdfRows(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  const rows = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const pageRows = [];
    for (const item of content.items.filter(item => clean(item.str))) {
      const y = Math.round(item.transform[5]);
      let row = pageRows.find(candidate => Math.abs(candidate.y - y) <= 2);
      if (!row) { row = { y, items: [] }; pageRows.push(row); }
      row.items.push({ x: item.transform[4], text: clean(item.str) });
    }
    pageRows.sort((a, b) => b.y - a.y).forEach(row => {
      row.items.sort((a, b) => a.x - b.x);
      rows.push({ page: pageNo, y: row.y, cells: row.items.map(item => item.text), text: clean(row.items.map(item => item.text).join(" ")) });
    });
  }
  return rows;
}

const enrollment = value => String(value || "").match(/\b\d{10,14}\b/)?.[0] || null;
const isDataRow = row => Boolean(enrollment(row.text));
const keyName = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
const headerKey = value => String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

export function parseAttendanceRows(rows, subjects = []) {
  const firstDataIndex = rows.findIndex(isDataRow);
  const configured = subjects.map(subject => ({
    outputKey: keyName(subject.abbreviation || subject.code || subject.name),
    aliases: [subject.abbreviation, subject.code, subject.name].filter(Boolean).map(headerKey)
  }));
  const subjectHeader = rows.slice(0, firstDataIndex < 0 ? rows.length : firstDataIndex).find(row => row.cells.some(cell => headerKey(cell) === "overallattendance"));
  const overallHeaderIndex = subjectHeader?.cells.findIndex(cell => headerKey(cell) === "overallattendance") ?? -1;
  const reportHeaders = overallHeaderIndex >= 0 ? subjectHeader.cells.slice(0, overallHeaderIndex) : [];
  const matchedColumns = [];
  const usedConfigured = new Set();
  reportHeaders.forEach((header, reportIndex) => {
    const match = configured.find(subject => subject.aliases.includes(headerKey(header)) && !usedConfigured.has(subject.outputKey));
    if (match) {
      usedConfigured.add(match.outputKey);
      matchedColumns.push({ keyName: match.outputKey, reportIndex });
    }
  });
  const subjectKeys = matchedColumns.length
    ? matchedColumns
    : configured.length
      ? configured.map((subject, reportIndex) => ({ keyName: subject.outputKey, reportIndex }))
      : reportHeaders.map((header, reportIndex) => ({ keyName: keyName(header), reportIndex }));
  const reportSubjectCount = reportHeaders.length || subjectKeys.length;
  const records = [];
  for (const row of rows.filter(isDataRow)) {
    const enrollment_number = enrollment(row.text);
    const cells = row.cells;
    const index = cells.findIndex(cell => cell.includes(enrollment_number));
    const tail = cells.slice(index + 1);
    // The report places branch, division, and name before the metric columns.
    // A division such as D1 must not be interpreted as the first lecture count.
    const metricStart = tail.findIndex(cell => /^\d+(?:\.\d+)?$/.test(cell));
    if (metricStart < 0) continue;
    const metricCells = tail.slice(metricStart);
    const numericTokens = metricCells.flatMap(cell => (cell.match(/\d+(?:\.\d+)?/g) || []).map(raw => ({ raw, value: Number(raw) })));
    const nums = numericTokens.map(token => token.value);
    if (nums.length < 6) continue;
    // Lecture counts are integers; decimal values in the attendance row are
    // percentages. Remove those before pairing conducted/attended counts so
    // a value such as 85.71 can never be written to an integer DB column.
    const hasFormattedPercentage = numericTokens.some(token => token.raw.includes(".") && token.value >= 0 && token.value <= 100);
    const lectureNums = hasFormattedPercentage
      ? numericTokens.filter(token => !token.raw.includes(".") || token.value > 100).map(token => token.value)
      : nums;
    const student_name = tail.slice(0, metricStart).filter(cell => !/^(CSE|AIML|DS|[A-Z]-?\d+)$/i.test(cell)).at(-1) || "";
    const values = {};
    const subjectStride = 2;
    subjectKeys.forEach(({ keyName: subjectKey, reportIndex }) => {
      const offset = reportIndex * subjectStride;
      if (lectureNums[offset] != null && lectureNums[offset + 1] != null) { values[`${subjectKey}_conducted`] = lectureNums[offset]; values[`${subjectKey}_attended`] = lectureNums[offset + 1]; }
    });
    const overallOffset = reportSubjectCount * subjectStride;
    values.overall_conducted = lectureNums[overallOffset] ?? lectureNums[lectureNums.length - 2] ?? null;
    values.overall_attended = lectureNums[overallOffset + 1] ?? lectureNums[lectureNums.length - 1] ?? null;
    records.push({ enrollment_number, student_name, branch: "", division: "", mentor_name: "", ...values });
  }
  return records;
}

export function parseResultRows(rows, subject = null) {
  return rows.filter(isDataRow).map(row => {
    const enrollment_number = enrollment(row.text);
    const cells = row.cells; const idx = cells.findIndex(cell => cell.includes(enrollment_number));
    // Ignore branch/division/name cells (for example D1) and only treat
    // standalone score cells as marks. This also keeps an em dash/AB row as
    // a valid absent result with a null total.
    const scoreCells = cells.slice(idx + 1).filter(cell => /^(?:\d+(?:\.\d+)?|AB|ABSENT|[-–—])$/i.test(cell));
    const nums = scoreCells.flatMap(cell => (cell.match(/\d+(?:\.\d+)?/g) || []).map(Number));
    const defaultMax = Number(subject?.max_marks || subject?.maxMarks || 60) || 60;
    const hasMaxColumn = nums.length >= 3 && [60, 100].includes(nums[nums.length - 1]) && nums[nums.length - 2] <= nums[nums.length - 1];
    const scoreNums = hasMaxColumn ? nums.slice(0, -1) : nums;
    const marks = scoreNums.length ? scoreNums[scoreNums.length - 1] : null;
    const sectionNums = scoreNums.slice(0, -1);
    const sectionA = sectionNums[0] ?? null;
    const sectionB = sectionNums[1] ?? (marks != null && sectionA != null && marks >= sectionA ? marks - sectionA : null);
    return { enrollment_number, name: cells[idx + 1] || "", branch: "", division: "", mentor: "", section_a_marks: sectionA, section_b_marks: sectionB, total_marks: marks, max_marks: hasMaxColumn ? nums[nums.length - 1] : defaultMax };
  }).filter(row => row.total_marks == null || row.total_marks <= 100);
}

export async function parseAttendancePdf(file, subjects = []) { return parseAttendanceRows(await extractPdfRows(file), subjects); }
export async function parseResultPdf(file, subject = null) { return parseResultRows(await extractPdfRows(file), subject); }
