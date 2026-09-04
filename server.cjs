require("dotenv").config();
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = __dirname, runtimeDir = process.env.VERCEL ? path.join("/tmp", "student-portal") : root, dataDir = path.join(runtimeDir, "data"), uploadDir = path.join(runtimeDir, "uploads");
fs.mkdirSync(dataDir, { recursive: true }); fs.mkdirSync(uploadDir, { recursive: true });
const read = n => { const f = path.join(dataDir, `${n}.json`); try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return []; } };
const write = (n, v) => fs.writeFileSync(path.join(dataDir, `${n}.json`), JSON.stringify(v, null, 2));
const json = (res, code, value) => { res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*", "Access-Control-Allow-Headers": "Content-Type, Authorization" }); res.end(JSON.stringify(value)); };
const body = req => {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise(resolve => { let b=""; req.on("data", x => b += x); req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } }); });
};
const id = () => crypto.randomUUID();
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const allowedTables = new Set(["students","subjects","academic_years","attendance","results","assignments","student_assignments","departments","admin_settings","attendance_settings","fee_status","fee_receipts","attendance_uploads","result_uploads","mid_sem_timetable","gtu_timetable","timetable_syllabi"]);
const uuidFields = new Set(["id", "student_id", "subject_id", "academic_year_id", "assignment_id", "updated_by", "uploaded_by"]);
const normalizeDbPayload = (table, payload) => {
  if (Array.isArray(payload)) return payload.map(row => normalizeDbPayload(table, row));
  if (!payload || typeof payload !== "object") return payload;
  const normalized = { ...payload };
  for (const field of uuidFields) if (field in normalized && (normalized[field] === "" || normalized[field] === undefined)) normalized[field] = null;
  // PostgreSQL `time` columns reject an empty string. Optional timetable fields
  // are represented as NULL when the admin leaves them blank.
  for (const field of ["start_time", "end_time"]) if (field in normalized && (normalized[field] === "" || normalized[field] === undefined)) normalized[field] = null;
  return normalized;
};
const legacyTimetableTables = new Set(["mid_sem_timetable", "gtu_timetable"]);
const localEntityRows = (items, filters, sort, limit) => {
  let rows = items.filter(item => Object.entries(filters).every(([key, value]) => String(item[key] ?? "") === String(value ?? "")));
  if (sort) {
    const key = sort.replace(/^-/, "").replace("created_at", "created_date");
    rows.sort((a, b) => String(a[key] || "").localeCompare(String(b[key] || "")) * (sort.startsWith("-") ? -1 : 1));
  }
  return limit ? rows.slice(0, Number(limit)) : rows;
};
async function supabaseRequest(table, method, token, pathSuffix = "", payload) {
  if (!supabaseUrl || !supabaseKey || !allowedTables.has(table)) throw new Error("Database is not configured");
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: method === "DELETE" ? "return=minimal" : "return=representation" };
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${pathSuffix}`, { method, headers, body: payload === undefined ? undefined : JSON.stringify(normalizeDbPayload(table, payload)) });
  const data = await response.json().catch(() => ({})); if (!response.ok) { const e = new Error(data.message || data.error || "Database request failed"); e.status = response.status; throw e; } return data;
}
async function supabaseAuthAdmin(pathSuffix = "") {
  if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users${pathSuffix}`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.msg || data.message || "Supabase Auth admin request failed"); error.status = response.status; throw error; }
  return data;
}
async function listSupabaseAuthUsers() {
  const users = [];
  for (let page = 1; page <= 10; page += 1) {
    const result = await supabaseAuthAdmin(`?page=${page}&per_page=1000`);
    const pageUsers = Array.isArray(result) ? result : result.users || [];
    users.push(...pageUsers);
    if (pageUsers.length < 1000) break;
  }
  return users;
}
const OCTOPOD_BASE = process.env.OCTOPOD_BASE_URL || "https://octopod.co.in";
const octopodHeaders = { Accept:"application/json, text/javascript, */*; q=0.01", "Accept-Language":"en,fr;q=0.9,gu;q=0.8,hi;q=0.7", "X-Requested-With":"XMLHttpRequest", "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36", Referer:"https://octopod.co.in/student/admission/0a8283bbbe6a76110b1f44e9db656812" };
async function octopodGet(endpoint, params = {}) {
  const url = new URL(endpoint, OCTOPOD_BASE); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null) url.searchParams.set(key, String(value)); });
  const response = await fetch(url, { headers: octopodHeaders, signal: AbortSignal.timeout(Number(process.env.OCTOPOD_TIMEOUT_MS || 15000)) });
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { body: text }; }
  if (!response.ok) { const error = new Error(`Octopod request failed (${response.status})`); error.status = response.status; throw error; }
  return data;
}
const first = (obj, keys) => keys.map(k => obj?.[k]).find(v => v !== undefined && v !== null && v !== "");
const decodeHtml = value => String(value || "").replace(/&#8377;|&#x20b9;/gi, "₹").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
function parsePayment(payment) {
  const html = payment?.body || "", receipts = [];
  for (const row of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => decodeHtml(m[1]));
    const href = row[0].match(/href=["']([^"']*receipt[^"']*)["']/i)?.[1];
    if (cells.length >= 6 && /\d/.test(cells[cells.length - 1])) receipts.push({ voucher_number: cells[1], receipt_date: cells[2], fee_type: cells[3], transaction_number: cells[4], transaction_date: cells[5], amount: Number((cells[6] || cells[cells.length - 1]).replace(/[^0-9.]/g, "")) || 0, external_receipt_url: href ? new URL(href, OCTOPOD_BASE).toString() : null });
  }
  const amount = Number(String(payment?.amount ?? payment?.outstandingAmount ?? "0").replace(/[^0-9.]/g, "")) || 0;
  const payable = Number((html.match(/(?:finalDue|dueAmount|Total Payable)[\s\S]{0,300}?([0-9][0-9,]*\.?[0-9]*)/i)?.[1] || amount).replace(/,/g, "")) || amount;
  return { feeStatus: { outstanding_amount: Number(String(payment?.outstandingAmount ?? amount).replace(/[^0-9.]/g, "")) || amount, payable_amount: payable, emi_enabled: Boolean(payment?.isEMIEnable), emi_amount: Number(String(payment?.planEmiAmount || "0").replace(/[^0-9.]/g, "")) || 0, currency: payment?.currencyCode || "INR", due_date: html.match(/due-date[^>]*value=["']([^"']+)/i)?.[1] || null }, feeReceipts: receipts };
}
function matchesMaskedEmail(value, masked) {
  const email=String(value||"").trim().toLowerCase(), pattern=String(masked||"").trim().toLowerCase();
  if (!email || !pattern || !email.includes("@")) return false;
  if (!pattern.includes("*")) return email === pattern;
  const [prefix,suffix] = pattern.split("*");
  return email.startsWith(prefix) && email.endsWith(suffix) && email.length > prefix.length + suffix.length;
}
async function octopodValidate(enrollmentNumber) {
  const applicationId = process.env.OCTOPOD_APPLICATION_ID || enrollmentNumber;
  const years = await octopodGet("/ajax/student/academic/years", { AcademyID: process.env.OCTOPOD_ACADEMY_ID || 1627, applicationId, isApplicationId: 1 });
  const academicYears = (Array.isArray(years) ? years : years?.academicYears || []).map(y => ({ AYID: first(y,["AYID","ayid"]), AcademicTitle: first(y,["AcademicTitle","academicTitle","title"]) }));
  const studentAcademicYear = first(years?.data || years, ["AcademicYearID", "academicYearId", "currentYear"]);
  const year = academicYears.find(y => String(y.AYID) === String(studentAcademicYear)) || academicYears.find(y => y.AYID) || {};
  const profile = await octopodGet("/ajax/validate/application", { AcademyID: process.env.OCTOPOD_ACADEMY_ID || 1627, applicationId, IsOTPRequired: 0, otp: "", Year: year.AYID || "", paymentCategory: "AcademicFees" });
  const student = profile?.data || profile;
  const email = first(student,["Email","email","StudentEmail","EmailAddress"]);
  const maskedEmail = email && String(email).includes("*") ? email : email ? `${email.slice(0,2)}***${email.slice(email.indexOf("@"))}` : "";
  const currentAcademicYearId = first(student,["AcademicYearID","academicYearId"]) || profile?.currentYear || year.AYID || null;
  const sourceSemester = first(student,["Semester","semester","CurrentSemester","currentSemester"]);
  const semester = Number(sourceSemester) > 0 ? Number(sourceSemester) : Math.max(1, academicYears.length || 1);
  return { ...profile, academicYears, currentYear: profile?.currentYear || currentAcademicYearId, semester, StudentID:first(student,["StudentID","studentId"]), AcademyID:first(student,["AcademyID","academyId"]), MediumID:first(student,["MediumID","mediumId"]), StandardID:first(student,["StandardID","standardId"]), DivisionID:first(student,["DivisionID","divisionId"]), AcademicYearID:currentAcademicYearId, fullName:first(student,["StudentFullName","fullName","name"]) || "", email, maskedEmail };
}
const requestHandler = async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const u = new URL(req.url, "http://localhost"), parts = u.pathname.split("/").filter(Boolean);
  try {
    if (parts[0] === "api" && parts[1] === "auth" && parts[2] === "me") {
      const token = (req.headers.authorization || "").replace("Bearer ", ""), sessions = read("_sessions"), session = sessions.find(x => x.token === token);
      if (!session) return json(res, 401, { error: "Authentication required" });
      const user = read("User").find(x => x.id === session.userId); return json(res, 200, user || { id: session.userId, role: "user" });
    }
    if (parts[0] === "api" && parts[1] === "auth" && parts[2] === "login" && req.method === "POST") {
      const { email, password } = await body(req), users = read("User"), user = users.find(x => x.email === email && x.password === password);
      if (!user) return json(res, 401, { error: "Invalid credentials" }); const token = id(); write("_sessions", read("_sessions").concat({ token, userId: user.id })); return json(res, 200, { access_token: token, user });
    }
    if (parts[0] === "api" && parts[1] === "auth" && parts[2] === "register" && req.method === "POST") {
      const { email, password } = await body(req), users = read("User"); if (users.some(x => x.email === email)) return json(res, 409, { error: "Already registered" }); const user = { id: id(), email, password, role: "user" }; write("User", users.concat(user)); return json(res, 201, user);
    }
    if (parts[0] === "api" && parts[1] === "entities") {
      const name = parts[2], itemId = parts[3], items = read(name), filters = JSON.parse(u.searchParams.get("filters") || "{}");
      if (allowedTables.has(name.toLowerCase()) && supabaseUrl) {
        const table = name.toLowerCase(), token = (req.headers.authorization || "").replace("Bearer ", ""), query = new URLSearchParams();
        for (const [key,value] of Object.entries(filters)) if (value !== undefined && value !== null && value !== "") query.set(key, `eq.${value}`);
        if (req.method === "GET") {
          const sort=(u.searchParams.get("sort")||"").replace("created_date","created_at");
          if(sort)query.set("order",`${sort.replace(/^-/, "")}.${sort.startsWith("-") ? "desc" : "asc"}`);
          const limit=u.searchParams.get("limit"); if(limit)query.set("limit",limit);
          try {
            const remote = await supabaseRequest(table,"GET",token,`?${query}`);
            if (legacyTimetableTables.has(table) && items.length) {
              const local = localEntityRows(items, filters, sort, "");
              const merged = [...remote, ...local.filter(localRow => !remote.some(remoteRow => remoteRow.id === localRow.id))];
              return json(res,200,localEntityRows(merged, filters, sort, limit));
            }
            return json(res,200,remote);
          } catch(e) {
            if (e.status === 400 && /created_at/i.test(e.message)) {
              query.delete("order");
              try { return json(res,200,await supabaseRequest(table,"GET",token,`?${query}`)); } catch (retryError) { e = retryError; }
            }
            if (legacyTimetableTables.has(table)) return json(res,200,localEntityRows(items, filters, sort, limit));
            throw e;
          }
        }
        if (req.method === "POST") return json(res,201,await supabaseRequest(table,"POST",token,"",await body(req)));
        if (req.method === "PATCH") return json(res,200,await supabaseRequest(table,"PATCH",token,`?id=eq.${encodeURIComponent(itemId)}`,await body(req)));
        if (req.method === "DELETE") { if (itemId && itemId !== "bulk") query.set("id", `eq.${itemId}`); return json(res,200,await supabaseRequest(table,"DELETE",token,`?${query}`)); }
      }
      if (req.method === "GET") { let out = items.filter(x => Object.entries(filters).every(([k,v]) => x[k] === v)); const sort=u.searchParams.get("sort"); if(sort){const k=sort.replace(/^-/,"");out.sort((a,b)=>String(a[k]||"").localeCompare(String(b[k]||""))*(sort[0]==="-"?-1:1));} return json(res,200,out.slice(0,Number(u.searchParams.get("limit"))||undefined)); }
      if (req.method === "DELETE") { const kept=items.filter(x=>!Object.entries(filters).every(([k,v])=>x[k]===v)); write(name,kept); return json(res,200,{success:true}); }
      if (req.method === "POST") { const data=await body(req), rows=parts[3]==="bulk"?data:[data]; const created=rows.map(x=>({...x,id:id(),created_date:new Date().toISOString()})); write(name,items.concat(created)); return json(res,201,parts[3]==="bulk"?created:created[0]); }
      if (req.method === "PATCH") { const data=await body(req), i=items.findIndex(x=>x.id===itemId); if(i<0)return json(res,404,{error:"Not found"}); items[i]={...items[i],...data,updated_date:new Date().toISOString()}; write(name,items); return json(res,200,items[i]); }
    }
    if (parts[0]==="api" && parts[1]==="functions" && parts[2]==="octopodValidate") {
      const { enrollmentNumber } = await body(req); if (!enrollmentNumber) return json(res,400,{error:"invalid_enrollment"});
      try { const result=await octopodValidate(enrollmentNumber); if(!result.StudentID && !result.email) return json(res,422,{error:"invalid_enrollment"}); return json(res,200,result); } catch(e) { console.error("Octopod validation failed:",e.message); return json(res,502,{error:"octopod_unavailable"}); }
    }
    if (parts[0]==="api" && parts[1]==="functions" && parts[2]==="octopodConfirmEmail") {
      const { enrollmentNumber, enteredEmail } = await body(req); try { const result=await octopodValidate(enrollmentNumber); if(!matchesMaskedEmail(enteredEmail,result.email)) return json(res,400,{error:"email_mismatch"}); return json(res,200,{email:String(enteredEmail).trim().toLowerCase()}); } catch(e) { console.error("Octopod email confirmation failed:",e.message); return json(res,502,{error:"octopod_unavailable"}); }
    }
    if (parts[0]==="api" && parts[1]==="functions" && parts[2]==="octopodCompleteRegistration") {
      const { enrollmentNumber, email, profile } = await body(req);
      if (!supabaseUrl || !supabaseKey) return json(res,503,{error:"Database is not configured"});
      const requestedBranch = String(profile?.branch || profile?.Branch || profile?.Department || process.env.OCTOPOD_DEFAULT_BRANCH || "CSE").trim().toUpperCase();
      const requestedDivision = String(profile?.division || profile?.Division || profile?.DivisionName || "D1").trim().toUpperCase();
      const registration = { enrollment_number: enrollmentNumber, full_name: profile?.fullName || profile?.StudentFullName || "Unknown", branch: ["CSE", "DS", "AIML"].includes(requestedBranch) ? requestedBranch : "CSE", division: ["D1", "D2", "DN"].includes(requestedDivision) ? requestedDivision : "D1", semester: Number(profile?.semester || profile?.currentSemester || profile?.academicYears?.length || 1) || 1, email };
      try {
        const existing = await supabaseRequest("students", "GET", supabaseKey, `?enrollment_number=eq.${encodeURIComponent(enrollmentNumber)}&select=id`);
        if (existing?.[0]?.id) await supabaseRequest("students", "PATCH", supabaseKey, `?id=eq.${encodeURIComponent(existing[0].id)}`, registration);
        else await supabaseRequest("students", "POST", supabaseKey, "", registration);
      } catch(e) { console.error("Student profile save failed:", e.message); return json(res,500,{error:"Could not save student profile"}); }
      return json(res,200,{success:true,saved:true});
    }
    if (parts[0]==="api" && parts[1]==="functions" && parts[2]==="adminUsers") {
      try {
        const users = await listSupabaseAuthUsers();
        return json(res, 200, { users: users.map(user => ({ id: user.id, email: user.email, full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email })) });
      } catch (e) { console.error("Supabase Auth user listing failed:", e.message); return json(res, 503, { error: "Supabase Auth admin access is not configured" }); }
    }
    if (parts[0]==="api" && parts[1]==="functions" && parts[2]==="resolveAdminUser") {
      const { email } = await body(req); const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes("@")) return json(res, 400, { error: "Enter a valid admin email address" });
      try {
        const user = (await listSupabaseAuthUsers()).find(candidate => String(candidate.email || "").toLowerCase() === normalizedEmail);
        if (!user) return json(res, 404, { error: "No Supabase Auth user exists for this email. Register that admin first." });
        return json(res, 200, { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email });
      } catch (e) { console.error("Supabase Auth user resolution failed:", e.message); return json(res, 503, { error: "Supabase Auth admin access is not configured on the server" }); }
    }
    if (parts[0]==="api" && parts[1]==="uploads" && req.method==="POST") {
      const { name, type, data } = await body(req); if (!data || !name) return json(res,400,{error:"Invalid upload"});
      const safeName = `${id()}-${String(name).replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      if (supabaseUrl && supabaseKey) { const response=await fetch(`${supabaseUrl}/storage/v1/object/portal-files/${encodeURIComponent(safeName)}`,{method:"POST",headers:{apikey:supabaseKey,Authorization:`Bearer ${supabaseKey}`,"Content-Type":type||"application/pdf"},body:Buffer.from(data,"base64")}); if(!response.ok)return json(res,502,{error:"File storage upload failed"}); return json(res,201,{file_url:`${supabaseUrl}/storage/v1/object/public/portal-files/${encodeURIComponent(safeName)}`}); }
      fs.writeFileSync(path.join(uploadDir,safeName),Buffer.from(data,"base64")); return json(res,201,{file_url:`/uploads/${safeName}`});
    }
    if (parts[0]==="api" && parts[1]==="uploads" && parts[2]==="delete" && req.method==="POST") {
      const { url } = await body(req); if (!url) return json(res,400,{error:"Missing file URL"});
      if (supabaseUrl && supabaseKey && url.includes("/storage/v1/object/public/portal-files/")) { const objectName=decodeURIComponent(url.split("/storage/v1/object/public/portal-files/")[1]); const response=await fetch(`${supabaseUrl}/storage/v1/object/portal-files/${encodeURIComponent(objectName)}`,{method:"DELETE",headers:{apikey:supabaseKey,Authorization:`Bearer ${supabaseKey}`}}); if(!response.ok && response.status!==404)return json(res,502,{error:"File delete failed"}); }
      else if (url.startsWith("/uploads/")) { const target=path.join(uploadDir,path.basename(url)); if(fs.existsSync(target))fs.unlinkSync(target); }
      return json(res,200,{success:true});
    }
    if (parts[0]==="api" && parts[1]==="functions" && parts[2]==="llm") {
      const cfg=await body(req), provider=cfg.provider || process.env.AI_PROVIDER || "hcnsec", key=provider==="hcnsec"?process.env.HCNSEC_API_KEY:provider==="openrouter"?process.env.OPENROUTER_API_KEY:process.env.OPENAI_API_KEY;
      if (provider==="mock") return json(res,200,{output:"AI mock response",response:"AI mock response"}); if(!key)return json(res,503,{error:`Missing API key for ${provider}`});
      const endpoint=provider==="hcnsec"?(process.env.HCNSEC_BASE_URL||"https://api.hcnsec.cn/v1/chat/completions"):provider==="openrouter"?(process.env.OPENROUTER_BASE_URL||"https://openrouter.ai/api/v1/chat/completions"):(process.env.OPENAI_BASE_URL||"https://api.openai.com/v1/chat/completions");
      const messages=cfg.messages || [{role:"user",content:cfg.prompt || "Respond briefly."}], response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({model:cfg.model || (provider==="hcnsec"?process.env.HCNSEC_MODEL:"gpt-4o-mini"),messages,temperature:cfg.temperature ?? 0.2,max_tokens:cfg.max_tokens || 2048})}), out=await response.json().catch(()=>({}));
      if(!response.ok)return json(res,response.status,{error:`${provider} API request failed`}); const text=out.choices?.[0]?.message?.content || out.output_text || ""; return json(res,200,{output:text,response:text,data:text});
    }
    if (parts[0]==="api" && parts[1]==="functions" && parts[2]==="octopodFees") {
      const { enrollmentNumber } = await body(req);
      try { const profile=await octopodValidate(enrollmentNumber); const payment=await octopodGet("/ajax/course/payment",{AcademyID:profile.AcademyID,AYID:profile.AcademicYearID,MediumID:profile.MediumID,DivisionID:profile.DivisionID,Year:profile.StandardID,StudentID:profile.StudentID,paymentCategory:"AcademicFees"}); return json(res,200,{profile,payment,...parsePayment(payment)}); } catch(e) { console.error("Octopod fees failed:",e.message); return json(res,502,{error:"octopod_unavailable"}); }
    }
    if (parts[0]==="api" && parts[1]==="functions" && parts[2]==="testAi") {
      const cfg=await body(req); if(cfg.provider==="mock") return json(res,200,{message:"Offline mock AI is available"});
      const key=cfg.provider==="hcnsec"?process.env.HCNSEC_API_KEY:cfg.provider==="openrouter"?process.env.OPENROUTER_API_KEY:cfg.provider==="gemini"?process.env.GEMINI_API_KEY:process.env.OPENAI_API_KEY;
      if(!key)return json(res,503,{error:`Missing server key for ${cfg.provider}`});
      if (cfg.provider === "hcnsec") {
        const response = await fetch(process.env.HCNSEC_BASE_URL || "https://api.hcnsec.cn/v1/chat/completions", { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${key}`}, body:JSON.stringify({model:cfg.model || process.env.HCNSEC_MODEL || "DeepSeek-V4-Pro", messages:[{role:"user",content:"Reply with OK only."}], temperature:0, max_tokens:8}) });
        if (!response.ok) return json(res, response.status, {error:`HCNSec API error (${response.status})`});
      }
      return json(res,200,{message:`${cfg.provider} API test succeeded for ${cfg.model}`});
    }
    if (parts[0]==="api" && parts[1]==="functions") return json(res,400,{error:"Function requires configuration"});
    if (req.method === "GET") { const file = u.pathname === "/" ? "/index.html" : u.pathname; const base = file.startsWith("/uploads/") ? uploadDir : path.join(root, "dist"); const target = path.join(base, file.replace(/^\/uploads\//, "")); if (fs.existsSync(target) && fs.statSync(target).isFile()) { res.writeHead(200); return fs.createReadStream(target).pipe(res); } }
    return json(res,404,{error:"Not found"});
  } catch(e) { console.error(e); json(res,500,{error:"Server error"}); }
};
const server = http.createServer(requestHandler);
if (require.main === module) {
  const port=process.env.PORT||3001;
  server.listen(port,()=>console.log(`API listening on ${port}`));
}
module.exports = requestHandler;
