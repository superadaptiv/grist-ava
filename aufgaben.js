// ======================================================
// AUFGABEN  ·  Teil des LV-Editors (ab Version 3.0)
// Einfache Aufgaben je Projekt (Liste und Board), gekoppelt an die
// Zeiterfassung: Timer direkt an der Aufgabe, gebuchte Zeit je Aufgabe,
// Aufgaben-Vorschläge in der Eingabezeile der Zeiterfassung.
// Nutzt die globalen Helfer aus app.js und zeit.js.
// ======================================================
"use strict";

const AG = { tasks: "Aufgaben" };
const AG_STATES = ["offen", "in Arbeit", "warten", "erledigt"];
const AG_STATE_LABEL = { "offen": "Offen", "in Arbeit": "In Arbeit", "warten": "Warten auf andere", "erledigt": "Erledigt" };
const AG_REPEAT = ["", "täglich", "wöchentlich", "monatlich"];
const AG_TABLE = { table: AG.tasks, cols: [
  { id: "Titel", type: "Text" },
  { id: "Projekt", type: "Ref:Projekte", show: "Projektname" },
  { id: "LV", type: "Ref:Leistungsverzeichnisse", show: "LV_Bezeichnung" },
  { id: "Status", type: "Choice", widgetOptions: JSON.stringify({ choices: AG_STATES }) },
  { id: "Faellig", type: "Date", label: "Fällig" },
  { id: "Uhrzeit", type: "Text" },
  { id: "Prioritaet", type: "Bool", label: "Priorität hoch" },
  { id: "Person", type: "Text", label: "Zuständig" },
  { id: "LPH", type: "Int", label: "Leistungsphase" },
  { id: "Taetigkeit", type: "Ref:Tags", show: "Name", label: "Tätigkeit" },
  { id: "Schaetzung_h", type: "Numeric", label: "Schätzung (h)" },
  { id: "Teilschritte", type: "Text" },
  { id: "Notiz", type: "Text", widgetOptions: JSON.stringify({ wrap: true }) },
  { id: "Wiederholung", type: "Choice", widgetOptions: JSON.stringify({ choices: AG_REPEAT.filter(Boolean) }) },
  { id: "Erledigt_am", type: "Date", label: "Erledigt am" },
  { id: "Erstellt", type: "Date" },
  // ab v4.0: Bauzeitenplan. Ein Eintrag mit Beginn erscheint im Plan, Ende leer = Meilenstein.
  { id: "Beginn", type: "Date" },
  { id: "Ende", type: "Date" },
  { id: "Gruppe", type: "Text" },
  { id: "Folgt_auf", type: "RefList:Aufgaben", show: "Titel", label: "Folgt auf" },
  { id: "Fortschritt", type: "Numeric", label: "Fortschritt %" }
]};
// Verknüpfung Zeiteintrag → Aufgabe
const AG_LINK_COL = { col: true, table: "Zeiteintraege", id: "Aufgabe", type: "Ref:Aufgaben", show: "Titel" };

const agdb = { tasks: [] };   // alle Einträge (Notizen, Aufgaben, Plan), Tabelle „Aufgaben“
let agCols = new Set();      // vorhandene Spalten, damit fehlende Plan-Spalten nichts kaputt machen
let agMissing = [];
let agMode = localStorage.getItem("lv-ag-mode") || "list";   // list | board
let agWho = localStorage.getItem("lv-ag-who") || "all";      // all | mine
let agProject = "";                                           // Filter (Projekt-ID als Text)
let agSel = null;                                             // gewählte Aufgabe
let agShowDone = false;
let agTick = null;
let agDragId = null;
let agSaveTimer = null;

// ------------------------------------------------------
// Daten
// ------------------------------------------------------
// ab v4.0: leerer Status = keine Aufgabe (reine Notiz oder nur Plan)
function agNorm(s) { const v = String(s || "").trim(); return !v ? "" : AG_STATES.includes(v) ? v : "offen"; }
const agRefs = v => Array.isArray(v) ? v.slice(v[0] === "L" ? 1 : 0).map(Number).filter(Boolean) : [];
function agSteps(v) {
  try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a.filter(x => x && x.t != null).map(x => ({ t: String(x.t), d: !!x.d })) : []; }
  catch (e) { return []; }
}

async function agFetch() {
  const t = await grist.docApi.fetchTable(AG.tasks).catch(() => null);
  agMissing = [];
  agCols = new Set(t ? Object.keys(t) : []);
  if (!t) agMissing.push({ table: AG.tasks });
  else for (const c of AG_TABLE.cols) if (!(c.id in t)) agMissing.push({ col: true, table: AG.tasks, ...c });
  agdb.tasks = rows(t).map(r => ({
    id: r.id, title: r.Titel || "", project: refId(r.Projekt), lv: refId(r.LV), status: agNorm(r.Status),
    due: secToKey(r.Faellig), time: r.Uhrzeit || "", high: !!r.Prioritaet, person: r.Person || "",
    lp: Number(r.LPH) || null, tag: refId(r.Taetigkeit), est: num(r.Schaetzung_h) || 0,
    steps: agSteps(r.Teilschritte), note: r.Notiz || "", repeat: AG_REPEAT.includes(r.Wiederholung) ? r.Wiederholung || "" : "",
    doneAt: secToKey(r.Erledigt_am), created: secToKey(r.Erstellt),
    begin: secToKey(r.Beginn), end: secToKey(r.Ende), group: r.Gruppe || "", after: agRefs(r.Folgt_auf),
    progress: Math.max(0, Math.min(100, Number(r.Fortschritt) || 0))
  }));
}

// Alles, was für Aufgaben + Kopplung noch fehlt (inkl. Zeiterfassung, wegen „Tätigkeit“ = Tags)
function agNeeds() {
  const n = [...ztMissing, ...agMissing];
  if (!zdb.hasTask) n.push(AG_LINK_COL);
  return n;
}
// Text für die Einrichtungs-Banner in Notizen, Aufgaben und Bauzeitenplan
function agBannerText() {
  const need = agNeeds();
  if (agReady()) {
    const plan = need.filter(m => m.table === AG.tasks && ["Beginn", "Ende", "Gruppe", "Folgt_auf", "Fortschritt"].includes(m.id));
    if (plan.length === need.length) return `Neu in 4.0: Für Notizen und Bauzeitenplan bekommt die Tabelle „Aufgaben“ ${plan.length} Spalten (${plan.map(m => m.id).join(", ")}). Bestehende Aufgaben und Zeiten bleiben unverändert.`;
    return `Es fehlen Spalten: ${need.map(m => m.table + "." + m.id).join(", ")}.`;
  }
  return `Es fehlen die Tabellen ${need.filter(m => !m.col).map(m => "„" + m.table + "“").join(", ")}. Sie werden mit einem Klick angelegt.`;
}
const agReady = () => !agMissing.some(m => !m.col) && !ztMissing.some(m => !m.col);
const agTask = id => agdb.tasks.find(t => t.id === id);
const agDone = t => t.status === "erledigt";
const agIsTask = t => !!t.status;                 // Aufgabe = Status gesetzt
const agInPlan = t => !!t.begin;                  // Bauzeitenplan = Beginn gesetzt
const agIsNote = t => !t.status && !t.begin;      // reine Notiz
const agPlanOn = () => agCols.has("Beginn");      // Plan-Spalten schon angelegt?
const agMine = t => agWho !== "mine" || !ztPerson() || !t.person || t.person === ztPerson();
const agEntries = id => zdb.entries.filter(e => e.task === id);
const agBooked = id => agEntries(id).reduce((s, e) => s + durOf(e), 0);
const agRunningFor = id => { const r = ztRunning(); return r && r.task === id ? r : null; };
const lvById = id => db.lvs.find(l => l.id === id);
const lvShort = id => { const l = lvById(id); return l ? (l.LV_Nummer ? "LV " + l.LV_Nummer : (l.LV_Bezeichnung || "LV")) : ""; };
const lvLabel = id => { const l = lvById(id); return l ? [l.LV_Nummer ? "LV " + l.LV_Nummer : "", l.LV_Bezeichnung || ""].filter(Boolean).join(" ") : ""; };

const AG_FIELD = {
  title: "Titel", project: "Projekt", lv: "LV", status: "Status", due: "Faellig", time: "Uhrzeit", high: "Prioritaet",
  person: "Person", lp: "LPH", tag: "Taetigkeit", est: "Schaetzung_h", steps: "Teilschritte", note: "Notiz",
  repeat: "Wiederholung", doneAt: "Erledigt_am", created: "Erstellt",
  begin: "Beginn", end: "Ende", group: "Gruppe", after: "Folgt_auf", progress: "Fortschritt"
};
function agCol(k, v) {
  if (k === "due" || k === "doneAt" || k === "created" || k === "begin" || k === "end") return v ? keyToSec(v) : null;
  if (k === "after") return v && v.length ? ["L", ...v] : null;
  if (k === "progress") return v || 0;
  if (k === "project" || k === "lv" || k === "tag") return v || 0;
  if (k === "steps") return JSON.stringify(v || []);
  if (k === "lp") return v || null;
  if (k === "est") return v || null;
  if (k === "high") return !!v;
  return v ?? "";
}
function agFields(patch) {
  const f = {};
  for (const [k, v] of Object.entries(patch)) if (AG_FIELD[k] && (!agCols.size || agCols.has(AG_FIELD[k]))) f[AG_FIELD[k]] = agCol(k, v);
  return f;
}
// Ansicht neu zeichnen, in der man gerade ist (Aufgaben, Notizen oder Bauzeitenplan)
function agRefresh() {
  if (view === "notes" && typeof ntRender === "function") return ntRender();
  if (view === "plan" && typeof plRender === "function") return plRender();
  agRender();
}

async function agUpdate(id, patch, { quiet = false } = {}) {
  const t = agTask(id); if (!t) return;
  Object.assign(t, patch);                 // sofort lokal, damit die Ansicht nicht springt
  await apply([["UpdateRecord", AG.tasks, id, agFields(patch)]], { refresh: false });
  if (!quiet) { await agFetch(); agRefresh(); }
}

// ------------------------------------------------------
// Einrichtung
// ------------------------------------------------------
async function agInstall() {
  const need = agNeeds();
  const lines = need.map(m => m.col ? `• Spalte ${m.table}.${m.id}` : `• Tabelle ${m.table}`);
  if (!confirm(`Für Notizen, Aufgaben und Bauzeitenplan (mit Zeiterfassung) wird in Grist angelegt:\n\n${lines.join("\n")}\n\nFortfahren?`)) return;
  const newTables = need.filter(m => !m.col).map(m => m.table);
  const actions = [], later = [];
  const isRef = c => /^(Ref|RefList):/.test(c.type);
  for (const d of [...ZT_SCHEMA, AG_TABLE]) {
    if (!newTables.includes(d.table)) continue;
    actions.push(["AddTable", d.table, d.cols.filter(c => !isRef(c)).map(c => ({ id: c.id, ...colInfo(c) }))]);
    d.cols.filter(isRef).forEach(c => later.push({ table: d.table, ...c }));
  }
  const added = [...later, ...need.filter(m => m.col)];
  for (const c of added) actions.push(["AddColumn", c.table, c.id, colInfo(c)]);
  if (newTables.includes(ZT.tags)) ZT_DEFAULT_TAGS.forEach(t => actions.push(["AddRecord", ZT.tags, null, t]));
  await apply(actions, { refresh: false });
  await setRefDisplay(added.filter(c => c.show).map(c => ({ ...c, type: "Ref:" + c.type.split(":")[1] })));
  await ztFetch(); await agFetch();
  toast("Einträge sind eingerichtet. Bestehende Aufgaben bleiben, wie sie sind.");
  agRefresh();
}

// ------------------------------------------------------
// Datum
// ------------------------------------------------------
function agWeekEnd() { return addDays(weekStart(todayKey()), 6); }
function agGroupOf(t) {
  if (agDone(t)) return "done";
  if (!t.due) return "nodate";
  const today = todayKey();
  if (t.due < today) return "over";
  if (t.due === today) return "today";
  if (t.due <= agWeekEnd()) return "week";
  return "later";
}
function agFmtDue(t) {
  if (!t.due) return "";
  const today = todayKey(), d = keyDate(t.due);
  let s;
  if (t.due === today) s = "heute";
  else if (t.due === addDays(today, 1)) s = "morgen";
  else if (t.due === addDays(today, -1)) s = "gestern";
  else if (t.due > today && t.due <= addDays(today, 6)) s = fmtDay(t.due);
  else s = `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.` + (d.getUTCFullYear() !== keyDate(today).getUTCFullYear() ? String(d.getUTCFullYear()).slice(2) : "");
  return t.time ? `${s} ${t.time}` : s;
}
function agNextDue(t) {
  const base = t.due || todayKey();
  if (t.repeat === "täglich") return addDays(base, 1);
  if (t.repeat === "wöchentlich") return addDays(base, 7);
  if (t.repeat === "monatlich") { const d = keyDate(base); d.setUTCMonth(d.getUTCMonth() + 1); return dateKey(d); }
  return null;
}

// ------------------------------------------------------
// Schnelleingabe: „Text #2501 @Markus morgen 16:00 !“
// ------------------------------------------------------
const AG_WD = { mo: 1, montag: 1, di: 2, dienstag: 2, mi: 3, mittwoch: 3, do: 4, donnerstag: 4, fr: 5, freitag: 5, sa: 6, samstag: 6, so: 0, sonntag: 0 };
function agParse(text) {
  const out = { title: "", project: null, person: "", due: null, time: "", high: false };
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const rest = [];
  const today = todayKey();
  for (let i = 0; i < words.length; i++) {
    const w = words[i], lw = w.toLowerCase().replace(/[.,]$/, "");
    let m;
    if ((m = /^#(.+)$/.exec(w))) {
      const q = m[1].toLowerCase();
      const p = projectsSorted().find(p => String(p.Projektnummer || "").toLowerCase().startsWith(q))
        || projectsSorted().find(p => String(p.Projektname || "").toLowerCase().includes(q));
      if (p) { out.project = p.id; continue; }
    }
    if ((m = /^@(.+)$/.exec(w))) { out.person = m[1].charAt(0).toUpperCase() + m[1].slice(1); continue; }
    if (/^!+$/.test(w) || lw === "!hoch" || lw === "!wichtig") { out.high = true; continue; }
    if (lw === "heute") { out.due = today; continue; }
    if (lw === "morgen") { out.due = addDays(today, 1); continue; }
    if (lw === "übermorgen" || lw === "uebermorgen") { out.due = addDays(today, 2); continue; }
    if ((lw === "nächste" || lw === "naechste") && /^woche/i.test(words[i + 1] || "")) { out.due = addDays(weekStart(today), 7); i++; continue; }
    if (lw in AG_WD && (lw.length > 2 || i > 0)) {
      const now = keyDate(today).getUTCDay(); let diff = (AG_WD[lw] - now + 7) % 7;
      out.due = addDays(today, diff); continue;
    }
    if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/.exec(w))) {
      const y0 = keyDate(today).getUTCFullYear();
      let y = m[3] ? Number(m[3]) : y0; if (y < 100) y += 2000;
      let k = dateKey(new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1]))));
      if (!m[3] && k < today) k = dateKey(new Date(Date.UTC(y + 1, Number(m[2]) - 1, Number(m[1]))));
      out.due = k; continue;
    }
    if (lw === "um" && /^\d{1,2}(:\d{2})?$/.test(words[i + 1] || "")) continue;
    if ((m = /^(\d{1,2}):(\d{2})(uhr)?$/i.exec(w)) && Number(m[1]) < 24) { out.time = `${m[1].padStart(2, "0")}:${m[2]}`; if (!out.due) out.due = today; continue; }
    rest.push(w);
  }
  out.title = rest.join(" ");
  return out;
}

async function agAddQuick() {
  const inp = $("agQuick"); if (!inp) return;
  const p = agParse(inp.value);
  if (!p.title) { toast("Bitte einen Titel eingeben."); return; }
  const project = p.project || Number(agProject) || null;
  const t = { title: p.title, project, lv: null, status: "offen", due: p.due, time: p.time, high: p.high,
    person: p.person || ztPerson(), lp: null, tag: null, est: 0, steps: [], note: "", repeat: "", doneAt: null, created: todayKey() };
  const res = await apply([["AddRecord", AG.tasks, null, agFields(t)]], { refresh: false });
  inp.value = ""; agDrawParse();
  await agFetch();
  const id = newRowId(res);
  if (id) agSel = id;
  agRefresh();
  $("agQuick")?.focus();
}

function agDrawParse() {
  const el = $("agParse"), inp = $("agQuick"); if (!el || !inp) return;
  const p = agParse(inp.value);
  const bits = [];
  if (p.project) bits.push(`Projekt <b>${esc(projNr(p.project) || projLabel(p.project))}</b>`);
  else if (agProject) bits.push(`Projekt <b>${esc(projNr(Number(agProject)) || projLabel(Number(agProject)))}</b>`);
  if (p.person) bits.push(`für <b>${esc(p.person)}</b>`);
  if (p.due) bits.push(`fällig <b>${esc(agFmtDue({ due: p.due, time: p.time }))}</b>`);
  if (p.high) bits.push(`<b>wichtig</b>`);
  el.innerHTML = inp.value.trim() ? bits.join(" · ") : "";
}

// ------------------------------------------------------
// Erledigen, Timer
// ------------------------------------------------------
async function agToggleDone(id) {
  const t = agTask(id); if (!t) return;
  const actions = [];
  if (agDone(t)) {
    actions.push(["UpdateRecord", AG.tasks, id, agFields({ status: "offen", doneAt: null })]);
  } else {
    const run = agRunningFor(id);
    if (run) actions.push(["UpdateRecord", ZT.entries, run.id, ztStopFields(run)]);
    actions.push(["UpdateRecord", AG.tasks, id, agFields({ status: "erledigt", doneAt: todayKey() })]);
    const next = t.repeat ? agNextDue(t) : null;
    if (next) actions.push(["AddRecord", AG.tasks, null, agFields({ ...t, status: "offen", due: next, doneAt: null, created: todayKey(),
      steps: t.steps.map(s => ({ ...s, d: false })), begin: null, end: null, after: [], progress: 0 })]);
    if (next) setTimeout(() => toast(`Erledigt. Nächste Wiederholung am ${fmtDE(next)}.`), 50);
  }
  await apply(actions, { refresh: false });
  await ztFetch(); await agFetch();
  agRefresh();
}

async function agStartTimer(id) {
  const t = agTask(id); if (!t) return;
  if (!ztReady()) return toast("Bitte zuerst die Zeiterfassung einrichten.");
  if (!t.project) { toast("Bitte der Aufgabe zuerst ein Projekt zuordnen."); agSel = id; agRefresh(); $("agdProject")?.focus(); return; }
  const old = ztRunning();
  const actions = [];
  if (old) actions.push(["UpdateRecord", ZT.entries, old.id, ztStopFields(old)]);
  actions.push(["AddRecord", ZT.entries, null, entryFields({ project: t.project, lp: t.lp, tags: t.tag ? [t.tag] : [], note: t.title,
    date: todayKey(), start: Math.floor(nowMin()), end: null, dur: 0, running: true, person: ztPerson(), task: id })]);
  if (t.status === "offen") actions.push(["UpdateRecord", AG.tasks, id, agFields({ status: "in Arbeit" })]);
  await apply(actions, { refresh: false });
  await ztFetch(); await agFetch();
  agRefresh();
  toast("Timer läuft.");
}

// ------------------------------------------------------
// Aufgabe in den Tageskalender ziehen = Zeiteintrag (v3.4)
// ------------------------------------------------------
let agRowDrag = null, agRowDragJustDropped = false;
function agRowDragStart(ev) {
  if (ev.button !== 0 || ev.target.closest("button, input, select, textarea, a")) return;
  if (!document.querySelector("#dayside .zt-daycal")) return;
  const t = agTask(Number(ev.target.closest(".ag-row").dataset.agid));
  if (!t || agDone(t)) return;
  agRowDrag = { t, x0: ev.clientX, y0: ev.clientY, on: false, float: null, ghost: null, col: null, start: null };
  document.addEventListener("pointermove", agRowDragMove);
  document.addEventListener("pointerup", agRowDragEnd, { once: true });
}
function agRowDragMove(ev) {
  const d = agRowDrag; if (!d) return;
  if (!d.on) {
    if (Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 6) return;
    d.on = true;
    d.float = document.createElement("div");
    d.float.className = "ag-dragfloat";
    d.float.innerHTML = `<i class="pdot" style="background:${projColor(d.t.project)}"></i>${esc(d.t.title || "Aufgabe")}`;
    document.body.appendChild(d.float);
    document.body.classList.add("ag-dragging");
    document.querySelector(`#agBody .ag-row[data-agid="${d.t.id}"]`)?.classList.add("dragsrc");
  }
  ev.preventDefault();
  d.float.style.left = ev.clientX + 12 + "px"; d.float.style.top = ev.clientY + 10 + "px";
  const col = document.elementsFromPoint(ev.clientX, ev.clientY).find(x => x.classList?.contains("col") && x.closest(".zt-daycal"));
  if (col !== d.col) { d.ghost?.remove(); d.ghost = null; d.col = col || null; }
  if (!col) return;
  const len = 60;
  d.start = Math.min(CAL.h1 * 60 - len, snap(ztCalMinutes(col, ev.clientY) - 15));
  if (!d.ghost) { d.ghost = document.createElement("div"); d.ghost.className = "blk ghost"; col.appendChild(d.ghost); }
  d.ghost.style.top = ((d.start / 60 - CAL.h0) * CAL.px + 1) + "px";
  d.ghost.style.height = (len / 60 * CAL.px - 2) + "px";
  d.ghost.style.setProperty("--pc", projColor(d.t.project));
  d.ghost.innerHTML = `<b>${esc(d.t.title || "Aufgabe")}</b><span class="t">${hm(d.start)}–${hm(d.start + len)}</span>`;
}
async function agRowDragEnd() {
  document.removeEventListener("pointermove", agRowDragMove);
  const d = agRowDrag; agRowDrag = null;
  if (!d || !d.on) return;
  agRowDragJustDropped = true; setTimeout(() => { agRowDragJustDropped = false; }, 0);
  d.float?.remove(); d.ghost?.remove();
  document.body.classList.remove("ag-dragging");
  document.querySelectorAll("#agBody .dragsrc").forEach(x => x.classList.remove("dragsrc"));
  if (!d.col || d.start == null) return;
  const t = d.t, date = d.col.dataset.day, start = d.start, end = d.start + 60;
  if (!t.project) {
    // ohne Projekt: Dialog öffnen, Projekt dort wählen
    return ztOpenDialog({ id: null, project: null, date, start, end, lp: t.lp, tags: t.tag ? [t.tag] : [], note: t.title, person: ztPerson(), task: t.id });
  }
  const actions = [["AddRecord", ZT.entries, null, entryFields({ project: t.project, lp: t.lp, tags: t.tag ? [t.tag] : [], note: t.title,
    date, start, end, dur: 60, running: false, person: ztPerson(), task: t.id })]];
  if (t.status === "offen") actions.push(["UpdateRecord", AG.tasks, t.id, agFields({ status: "in Arbeit" })]);
  await apply(actions, { refresh: false });
  await ztFetch(); await agFetch(); agRefresh();
  toast(`${hm(start)}–${hm(end)} eingetragen. Unterkante ziehen ändert die Dauer.`);
}

// ------------------------------------------------------
// Rendern
// ------------------------------------------------------
function agIsBusy() {
  const a = document.activeElement;
  return !!(agDragId || document.querySelector("dialog[open]")
    || (a && a.closest && (a.closest("#agDetail") || a.closest("#agBody") || a.closest("#ntBody") || a.closest("#plBody")) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)));
}

function agFiltered() {
  return agdb.tasks.filter(t => agIsTask(t) && agMine(t) && (!agProject || t.project === Number(agProject)));
}

function agRender() {
  if (view !== "tasks") return;
  const need = agNeeds();
  const ready = agReady();
  $("agBanner").hidden = !need.length;
  $("agBannerText").textContent = agBannerText();
  document.querySelectorAll("#agMode [data-agm]").forEach(b => b.classList.toggle("on", b.dataset.agm === agMode));
  document.querySelectorAll("#agWho [data-agw]").forEach(b => b.classList.toggle("on", b.dataset.agw === agWho));
  $("agWho").hidden = !ztPerson();
  $("agProject").innerHTML = projectOptions(Number(agProject) || null, { all: true });
  agRenderTimer();
  const body = $("agBody");
  if (!ready) { if (typeof ztDayside === "function") ztDayside(false); body.innerHTML = '<div class="zt-empty">Noch nicht eingerichtet.</div>'; agHideDetail("agMain"); return; }
  const keepQuick = $("agQuick")?.value || "";
  const focusQuick = document.activeElement?.id === "agQuick";
  const scroll = body.scrollTop;
  const withDay = agMode !== "board" && !agSel && typeof ztReady === "function" && ztReady();
  body.innerHTML = agMode === "board" ? agBoardHtml() : `<div class="ag-split">${agListHtml()}</div>`;
  ztDayside(withDay);
  if ($("agQuick")) { $("agQuick").value = keepQuick; agDrawParse(); if (focusQuick) $("agQuick").focus(); }
  body.scrollTop = scroll;
  if (agSel && !agTask(agSel)) agSel = null;
  agMountDetail("agMain");
  agRenderDetail();
  agRunTick();
}

function agRenderTimer() {
  const r = ztRunning(), el = $("agTimer");
  if (!r) { el.hidden = true; return; }
  el.hidden = false;
  const t = r.task ? agTask(r.task) : null;
  el.innerHTML = `<span class="pulse"></span><span class="tl"><i class="pdot" style="background:${projColor(r.project)}"></i>${esc(t ? t.title : projLabel(r.project))}</span>
    <b id="agTimerClock">${ztClock(r)}</b><button type="button" class="stop" id="agStop" title="Timer stoppen"><i></i></button>`;
}
function agRunTick() {
  clearInterval(agTick);
  if (!ztRunning()) return;
  agTick = setInterval(() => {
    if (!["tasks", "notes", "plan"].includes(view)) return clearInterval(agTick);
    const r = ztRunning(); if (!r) return clearInterval(agTick);
    const c = $("agTimerClock"); if (c) c.textContent = ztClock(r);
    document.querySelectorAll(`[data-ag-run="${r.task}"]`).forEach(x => { x.textContent = hm(agBooked(r.task)); });
  }, 1000);
}

function agMeta(t, { withPerson = true, withProject = true } = {}) {
  const bits = [];
  if (withProject && t.project) bits.push(esc(projNr(t.project) || projLabel(t.project)));
  if (t.lv) bits.push(esc(lvShort(t.lv)));
  if (withPerson && t.person && t.person !== ztPerson()) bits.push(esc(t.person));
  if (t.steps.length) bits.push(`${t.steps.filter(s => s.d).length}/${t.steps.length}`);
  if (t.repeat) bits.push(`↻ ${esc(t.repeat)}`);
  if (agWaiting(t)) bits.push("wartet");
  return bits.join(" · ");
}
const agWaiting = t => t.status === "warten";

function agRowHtml(t) {
  // Zeile im Stil der Zeiterfassung: Spalten mit Linien
  const run = agRunningFor(t.id), booked = agBooked(t.id), grp = agGroupOf(t);
  const est = t.est ? String(t.est).replace(".", ",") + " h" : "";
  const time = booked || run
    ? `<span class="ag-tm ${run ? "on" : ""}">${run ? "● " : ""}<span ${run ? `data-ag-run="${t.id}"` : ""}>${hm(booked)}</span>${est ? ` / ${est}` : ""}</span>`
    : (est ? `<span class="ag-tm">~ ${est}</span>` : "");
  const due = agDone(t) && t.doneAt ? "erledigt " + fmtDay(t.doneAt) : agFmtDue(t);
  const pj = t.project
    ? `<i class="pdot" style="background:${projColor(t.project)}"></i><small>${esc(projNr(t.project))}</small><span>${esc(projLabel(t.project))}</span>`
    : '<span class="muted">–</span>';
  return `<div class="ag-row ${agSel === t.id ? "sel" : ""} ${run ? "run" : ""} ${agDone(t) ? "done" : ""}" data-agid="${t.id}">
    <span class="c-cb"><button type="button" class="ag-cb ${t.high ? "hi" : ""}" data-agdone="${t.id}" title="${agDone(t) ? "Wieder öffnen" : "Erledigt"}"></button></span>
    <span class="c-due ag-due ${grp === "over" ? "over" : ""}">${esc(due) || "–"}</span>
    <span class="c-pj">${pj}</span>
    <span class="c-tt"><span class="ag-tt">${esc(t.title) || "<i>Ohne Titel</i>"}</span><span class="ag-meta">${agMeta(t, { withProject: false })}${agRowBadges(t)}</span></span>
    <span class="c-lp">${t.lp ? "LP " + t.lp : ""}</span>
    <span class="c-tm">${time}</span>
    <span class="c-pl">${agDone(t) ? "" : `<button type="button" class="ag-play ${run ? "on" : ""}" data-agplay="${t.id}" title="${run ? "Timer stoppen" : "Timer starten"}">${run ? "<i></i>" : '<svg viewBox="0 0 20 20"><path d="M7 5l8 5-8 5z"/></svg>'}</button>`}</span>
  </div>`;
}

// Abzeichen in der Aufgabenliste: Notiz (wenn Text da) und Bauzeitenplan
function agRowBadges(t) {
  const skip = ["task", "time"]; if (!String(t.note || "").trim()) skip.push("note");
  const b = agBadges(t, { skip });
  return b ? `<span class="ag-badges">${b}</span>` : "";
}
function agSort(a, b) {
  return (a.due || "9999").localeCompare(b.due || "9999") || (a.time || "99").localeCompare(b.time || "99") || (b.high - a.high) || a.id - b.id;
}

function agListHtml() {
  const list = agFiltered();
  const G = [["over", "Überfällig"], ["today", "Heute"], ["week", "Diese Woche"], ["later", "Später"], ["nodate", "Ohne Datum"]];
  const open = list.filter(t => !agDone(t));
  let h = `<div class="ag-wrap"><div class="ag-add"><span class="plus">+</span><input id="agQuick" autocomplete="off" placeholder="Neue Aufgabe …   #Projekt  @Person  morgen  16:00  !"><kbd>Enter</kbd></div><div class="ag-parse" id="agParse"></div>`;
  for (const [k, n] of G) {
    const g = open.filter(t => agGroupOf(t) === k).sort(agSort);
    if (!g.length) continue;
    const sum = g.reduce((a, t) => a + agBooked(t.id), 0);
    h += `<div class="ag-gh ${k === "over" ? "red" : ""}"><b>${n}</b><span>${g.length} ${g.length === 1 ? "Aufgabe" : "Aufgaben"}</span>${sum ? `<span class="s">${hm(sum)} h</span>` : ""}</div>` + g.map(agRowHtml).join("");
  }
  if (!open.length) h += `<div class="zt-empty">Keine offenen Aufgaben${agProject ? " in diesem Projekt" : ""}. Oben eine eintippen und Enter drücken.</div>`;
  const done = list.filter(agDone).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "") || b.id - a.id);
  if (done.length) {
    h += `<button type="button" class="ag-gh ag-more" id="agToggleDone">${agShowDone ? "▾" : "›"} ${done.length} erledigt ${agShowDone ? "ausblenden" : "anzeigen"}</button>`;
    if (agShowDone) h += done.slice(0, 60).map(agRowHtml).join("");
  }
  return h + "</div>";
}

function agBoardHtml() {
  const list = agFiltered();
  return `<div class="ag-board">` + AG_STATES.map(s => {
    let cs = list.filter(t => t.status === s).sort(agSort);
    if (s === "erledigt") cs = cs.sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "")).slice(0, 12);
    const n = list.filter(t => t.status === s).length;
    return `<div class="ag-col" data-agcol="${s}"><h3>${AG_STATE_LABEL[s]} <span>${n}</span></h3>` +
      cs.map(t => {
        const run = agRunningFor(t.id), grp = agGroupOf(t), booked = agBooked(t.id);
        return `<div class="ag-card ${agSel === t.id ? "sel" : ""} ${run ? "run" : ""} ${t.high && !agDone(t) ? "hi" : ""}" draggable="true" data-agid="${t.id}">
          <div class="ag-tt">${esc(t.title) || "<i>Ohne Titel</i>"}</div>
          <div class="ag-cm"><span>${agMeta(t, { withPerson: true }) || "&nbsp;"}</span><span class="${grp === "over" ? "over" : ""}">${esc(agDone(t) ? "" : agFmtDue(t))}</span></div>
          ${booked || run ? `<div class="ag-cm"><span class="ag-tm ${run ? "on" : ""}">${run ? "● " : ""}<span ${run ? `data-ag-run="${t.id}"` : ""}>${hm(booked)}</span> h</span></div>` : ""}
        </div>`;
      }).join("") + (s === "offen" ? `<button type="button" class="ag-addc" data-agnew>+ Aufgabe</button>` : "") + `</div>`;
  }).join("") + `</div>`;
}

// ---------- Abzeichen und Symbole (ab v4.0) ----------
const AG_ICON = {
  note: '<svg class="ei" viewBox="0 0 20 20"><path d="M5 2.5h7l3 3v12H5z M12 2.5v3h3 M7.5 9h5M7.5 12h5M7.5 15h3"/></svg>',
  task: '<svg class="ei" viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="3.5"/><path d="M6.8 10.2l2.3 2.3 4.2-4.8"/></svg>',
  time: '<svg class="ei" viewBox="0 0 20 20"><circle cx="10" cy="10.5" r="6.5"/><path d="M10 6.5v4l2.6 1.8M8 2.5h4"/></svg>',
  plan: '<svg class="ei" viewBox="0 0 20 20"><path d="M3 3v14M3 6h8M7 10h9M5 14h6"/></svg>',
  play: '<svg class="ei" viewBox="0 0 20 20"><path d="M7 5l8 5-8 5z"/></svg>'
};
const AG_MON = ["Jan", "Feb", "März", "Apr", "Mai", "Juni", "Juli", "Aug", "Sep", "Okt", "Nov", "Dez"];
const agKindIcon = t => agIsTask(t) ? AG_ICON.task : agInPlan(t) ? AG_ICON.plan : AG_ICON.note;
const agDays = (a, b) => Math.round((keyDate(b) - keyDate(a)) / 864e5);
const agDM = k => { const d = keyDate(k); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.`; };
// Arbeitstage (Mo–Fr) zwischen zwei Tagen, beide eingeschlossen
function agWorkdays(a, b) {
  let n = 0;
  for (let k = a, i = 0; k <= b && i < 2000; k = addDays(k, 1), i++) { const w = keyDate(k).getUTCDay(); if (w && w < 6) n++; }
  return n;
}
function agAddWorkdays(k, n) {
  let d = k, i = 0;
  while (i < n) { d = addDays(d, 1); const w = keyDate(d).getUTCDay(); if (w && w < 6) i++; }
  return d;
}
const agNextWorkday = k => { let d = k; while ([0, 6].includes(keyDate(d).getUTCDay())) d = addDays(d, 1); return d; };
// „März 2027“, „Jan–Feb 2027“, „◆ 15.01.“
function agPlanLabel(t) {
  if (!t.begin) return "";
  if (!t.end || t.end === t.begin) return "◆ " + agDM(t.begin);
  const a = keyDate(t.begin), b = keyDate(t.end);
  const ya = a.getUTCFullYear(), yb = b.getUTCFullYear();
  if (ya === yb && a.getUTCMonth() === b.getUTCMonth()) return `${AG_MON[a.getUTCMonth()]} ${ya}`;
  if (ya === yb) return `${AG_MON[a.getUTCMonth()]}–${AG_MON[b.getUTCMonth()]} ${ya}`;
  return `${AG_MON[a.getUTCMonth()]} ${String(ya).slice(2)}–${AG_MON[b.getUTCMonth()]} ${String(yb).slice(2)}`;
}
function agDurLabel(t) {
  if (!t.begin) return "";
  if (!t.end || t.end === t.begin) return "Meilenstein";
  if (t.end < t.begin) return "Ende liegt vor dem Beginn";
  const at = agWorkdays(t.begin, t.end), cal = agDays(t.begin, t.end) + 1;
  if (cal >= 14) { const w = Math.round(cal / 7); return `${w} Wochen (${at} AT)`; }
  return `${at} AT`;
}
// Abzeichen: was ein Eintrag schon ist
function agBadges(t, { skip = [] } = {}) {
  const b = [];
  if (!skip.includes("note")) b.push(`<span class="eb eb-note">${AG_ICON.note}Notiz</span>`);
  if (agIsTask(t) && !skip.includes("task")) {
    const due = agDone(t) ? (t.doneAt ? "erledigt " + agDM(t.doneAt) : "erledigt") : [AG_STATE_LABEL[t.status].replace("Warten auf andere", "wartet").toLowerCase(), agFmtDue(t)].filter(Boolean).join(" · ");
    b.push(`<span class="eb eb-task ${agGroupOf(t) === "over" ? "over" : ""}">${AG_ICON.task}${esc(due)}</span>`);
  }
  const booked = typeof zdb !== "undefined" ? agBooked(t.id) : 0, run = typeof ztRunning === "function" && agRunningFor(t.id);
  if ((booked || run) && !skip.includes("time")) b.push(`<span class="eb eb-time ${run ? "on" : ""}">${AG_ICON.time}<span ${run ? `data-ag-run="${t.id}"` : ""}>${hm(booked)}</span> h</span>`);
  if (agInPlan(t) && !skip.includes("plan")) b.push(`<span class="eb eb-plan">${AG_ICON.plan}${esc(agPlanLabel(t))}</span>`);
  return b.join("");
}

// ---------- Detail (rechte Spalte, gemeinsam für Notizen, Aufgaben und Bauzeitenplan) ----------
// Die Detailspalte wird in die gerade sichtbare Ansicht gehängt.
function agMountDetail(mainId) {
  const d = $("agDetail"), main = $(mainId);
  if (d && main && d.parentElement !== main) main.appendChild(d);
}
function agHideDetail(mainId) {
  agMountDetail(mainId);
  $("agDetail").hidden = true; $(mainId)?.classList.remove("has-detail");
}
function agRenderDetail() {
  const d = $("agDetail"), main = d.parentElement;
  const t = agSel ? agTask(agSel) : null;
  d.hidden = !t; main?.classList.toggle("has-detail", !!t);
  if (!t) return;
  if (agIsBusy() && d.dataset.id === String(t.id) && d.contains(document.activeElement)) { agRefreshDetailTime(t); return; }
  d.dataset.id = t.id;
  const lvs = db.lvs.filter(l => !t.project || refId(l.Projekt) === t.project);
  const persons = [...new Set([ztPerson(), ...agdb.tasks.map(x => x.person), ...zdb.entries.map(e => e.person)].filter(Boolean))];
  const tags = zdb.tags.filter(x => x.active || x.id === t.tag);
  const task = agIsTask(t), plan = agInPlan(t), booked = agBooked(t.id), run = agRunningFor(t.id);
  const timeSec = task || booked > 0 || !!run || t.est > 0;
  const origin = t.created ? ` · erstellt ${fmtDay(t.created).replace(/\s.*/, "")} ${agDM(t.created)}` : "";
  const kind = [task ? "Aufgabe" : "", plan ? "Bauzeitenplan" : "", !task && !plan ? "Notiz" : ""].filter(Boolean).join(" + ");
  const rm = k => `<button type="button" class="agd-rm" data-agrm="${k}" title="Nur diese Eigenschaft entfernen, der Eintrag bleibt">entfernen</button>`;
  let h = `
    <div class="agd-h"><span class="agd-kicker">Eintrag</span><span class="muted agd-kind">${kind}${origin}</span>
      ${!run && ztReady() ? `<button type="button" class="btn btn-ghost agd-timer" data-agplay="${t.id}" title="Timer starten">${AG_ICON.play}Timer</button>` : ""}
      <button type="button" class="x" id="agdClose" title="Schließen (Esc)">✕</button></div>
    <textarea class="agd-title" id="agdTitle" rows="1" placeholder="Titel">${esc(t.title)}</textarea>
    <div class="agd-rows agd-base">
      <label><span>Projekt</span><select id="agdProject">${projectOptions(t.project)}</select></label>
      <label><span>LV</span><select id="agdLv"><option value="">kein LV</option>${lvs.map(l => `<option value="${l.id}" ${l.id === t.lv ? "selected" : ""}>${esc(lvLabel(l.id))}</option>`).join("")}</select></label>
    </div>`;
  if (task) h += `
    <div class="agd-sh k-task">${AG_ICON.task}<b>Aufgabe</b>${rm("task")}</div>
    <div class="agd-rows">
      <label><span>Status</span><select id="agdStatus">${AG_STATES.map(s => `<option value="${s}" ${s === t.status ? "selected" : ""}>${AG_STATE_LABEL[s]}</option>`).join("")}</select></label>
      <label><span>Fällig</span><span class="agd-two"><input type="date" id="agdDue" value="${esc(t.due || "")}"><input id="agdTime" placeholder="Uhrzeit" value="${esc(t.time)}"></span></label>
      <label><span>Zuständig</span><input id="agdPerson" list="agdPersons" value="${esc(t.person)}" placeholder="niemand"><datalist id="agdPersons">${persons.map(p => `<option value="${esc(p)}">`).join("")}</datalist></label>
      <label><span>Priorität</span><span class="agd-chk"><input type="checkbox" id="agdHigh" ${t.high ? "checked" : ""}> hoch</span></label>
      <label><span>Wiederholen</span><select id="agdRepeat">${AG_REPEAT.map(r => `<option value="${r}" ${r === t.repeat ? "selected" : ""}>${r || "nein"}</option>`).join("")}</select></label>
    </div>
    <div class="agd-sub">Teilschritte</div>
    <div id="agdSteps"></div>
    <input class="agd-newstep" id="agdNewStep" placeholder="+ Teilschritt (Enter)">`;
  if (timeSec) h += `
    <div class="agd-sh k-time">${AG_ICON.time}<b>Zeit</b><span class="agd-shr" id="agdTimeSum"></span></div>
    <div class="agd-rows">
      <label><span>LP</span><select id="agdLp">${lpOptions(t.lp)}</select></label>
      <label><span>Tätigkeit</span><select id="agdTag"><option value="">–</option>${tags.map(x => `<option value="${x.id}" ${x.id === t.tag ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
      <label><span>Schätzung</span><input id="agdEst" inputmode="decimal" placeholder="Stunden" value="${t.est ? String(t.est).replace(".", ",") : ""}"></label>
    </div>
    <div id="agdTime2"></div>`;
  if (plan) {
    const cand = agdb.tasks.filter(x => x.id !== t.id && agInPlan(x) && x.project === t.project && !t.after.includes(x.id) && !agFollows(x.id, t.id));
    const groups = [...new Set(agdb.tasks.filter(x => x.group && (!t.project || x.project === t.project)).map(x => x.group))];
    h += `
    <div class="agd-sh k-plan">${AG_ICON.plan}<b>Bauzeitenplan</b>${rm("plan")}</div>
    <div class="agd-rows">
      <label><span>Beginn</span><input type="date" id="agdBegin" value="${esc(t.begin || "")}"></label>
      <label><span>Ende</span><input type="date" id="agdEnd" value="${esc(t.end || "")}" title="Leer = Meilenstein"></label>
      <label><span>Dauer</span><span class="agd-val ${t.end && t.end < t.begin ? "over" : ""}">${esc(agDurLabel(t))}</span></label>
      <label><span>Gruppe</span><input id="agdGroup" list="agdGroups" value="${esc(t.group)}" placeholder="z. B. Planung, Ausführung"><datalist id="agdGroups">${groups.map(g => `<option value="${esc(g)}">`).join("")}</datalist></label>
      <div class="agd-lab"><span>Folgt auf</span><span class="agd-after">${t.after.map(id => agTask(id)).filter(Boolean).map(p => `<span class="agd-chip" data-agopen="${p.id}">${esc(p.title || "Ohne Titel")}<button type="button" class="x" data-agunafter="${p.id}" title="Verknüpfung lösen">✕</button></span>`).join("")}
        ${cand.length ? `<select id="agdAfter"><option value="">+ Vorgänger …</option>${cand.sort((a, b) => a.begin.localeCompare(b.begin)).map(x => `<option value="${x.id}">${esc(x.title || "Ohne Titel")} · ${esc(agDM(x.end || x.begin))}</option>`).join("")}</select>` : (t.after.length ? "" : `<span class="muted">–</span>`)}</span></div>
      <label><span>Fortschritt</span><span class="agd-two agd-prog"><input type="range" id="agdProgress" min="0" max="100" step="10" value="${t.progress}"><output id="agdProgOut">${t.progress} %</output></span></label>
    </div>`;
  }
  h += `
    <div class="agd-sh k-note">${AG_ICON.note}<b>Notiz</b></div>
    <textarea class="agd-note" id="agdNote" rows="4" placeholder="Notiz, Gedanken, Gesprächsnotiz …">${esc(t.note)}</textarea>`;
  const make = [];
  if (!task) make.push(`<button type="button" class="agd-make k-task" data-agmk="task">${AG_ICON.task}<span><b>Aufgabe</b><small>Status, Fälligkeit, zuständig</small></span><i>+</i></button>`);
  if (!timeSec) make.push(`<button type="button" class="agd-make k-time" data-agmk="timer">${AG_ICON.play}<span><b>Timer starten</b><small>oder <u data-agmk="addtime">Zeit nachtragen</u>, wird hier verknüpft</small></span><i>+</i></button>`);
  if (!plan) make.push(`<button type="button" class="agd-make k-plan" data-agmk="plan" ${agPlanOn() ? "" : "disabled title=\"Erst die Spalten für den Bauzeitenplan einrichten\""}>${AG_ICON.plan}<span><b>Im Bauzeitenplan</b><small>${agPlanOn() ? "Zeitraum oder Meilenstein, optional LV" : "erst „Jetzt einrichten“ für die neuen Spalten"}</small></span><i>+</i></button>`);
  if (make.length) h += `<div class="agd-sh k-make"><b>Daraus machen</b></div><div class="agd-makes">${make.join("")}</div>`;
  h += `<div class="agd-foot"><button type="button" class="btn btn-danger" id="agdDelete">Löschen</button></div>`;
  d.innerHTML = h;
  agRefreshDetailTime(t);
  if (task) agDrawSteps(t);
  agAutoGrow($("agdTitle"));
}
// true, wenn a (direkt oder über andere) auf b folgt – verhindert Kreise
function agFollows(a, b, seen = new Set()) {
  const x = agTask(a); if (!x || seen.has(a)) return false; seen.add(a);
  return x.after.includes(b) || x.after.some(p => agFollows(p, b, seen));
}
// Nachfolger nach hinten schieben, wenn sie vor dem Ende eines Vorgängers beginnen
function agCascade(changes) {
  const get = id => ({ ...agTask(id), ...(changes[id] || {}) });
  // Eintrag hinter seine Vorgänger schieben (Dauer bleibt gleich)
  const fix = id => {
    const cur = get(id); if (!cur.begin) return false;
    const min = cur.after.map(get).filter(p => p.begin).reduce((m, p) => { const e = addDays(p.end && p.end >= p.begin ? p.end : p.begin, 1); return e > m ? e : m; }, "");
    if (!min || cur.begin >= min) return false;
    const start = agNextWorkday(min), shift = agDays(cur.begin, start);
    changes[id] = { ...(changes[id] || {}), begin: start, end: cur.end ? addDays(cur.end, shift) : null };
    return true;
  };
  const queue = Object.keys(changes).map(Number);
  queue.forEach(fix);
  let guard = 0;
  while (queue.length && guard++ < 500) {
    const id = queue.shift();
    for (const s of agdb.tasks.filter(x => x.after.includes(id) && x.begin)) if (fix(s.id)) queue.push(s.id);
  }
  return changes;
}
async function agSavePlan(changes, { msg = "" } = {}) {
  const n0 = Object.keys(changes).length;
  agCascade(changes);
  const moved = Object.keys(changes).length - n0;
  const actions = Object.entries(changes).map(([id, p]) => { Object.assign(agTask(Number(id)), p); return ["UpdateRecord", AG.tasks, Number(id), agFields(p)]; });
  if (!actions.length) return;
  await apply(actions, { refresh: false });
  await agFetch(); agRefresh();
  if (moved > 0) toast(`${moved} ${moved === 1 ? "Nachfolger wurde" : "Nachfolger wurden"} mit verschoben.`);
  else if (msg) toast(msg);
}
// „Daraus machen“ und „entfernen“
async function agMake(id, what) {
  const t = agTask(id); if (!t) return;
  if ($("agDetail").contains(document.activeElement)) document.activeElement.blur();   // sonst bleibt das Detail stehen
  if (what === "task") {
    await agUpdate(id, { status: "offen", person: t.person || ztPerson() }, { quiet: true }); agRefresh();
    toast("Ist jetzt auch eine Aufgabe."); $("agdDue")?.focus();
  } else if (what === "timer") {
    await agStartTimer(id);
  } else if (what === "addtime") {
    if (!ztReady()) return toast("Bitte zuerst die Zeiterfassung einrichten.");
    ztOpenDialog({ id: null, project: t.project, date: todayKey(), start: null, end: null, hours: 0, lp: t.lp, tags: t.tag ? [t.tag] : [], note: t.title, task: id });
  } else if (what === "plan") {
    if (!agPlanOn()) return toast("Bitte zuerst die neuen Spalten mit „Jetzt einrichten“ anlegen.");
    const begin = agNextWorkday(t.due && t.due >= todayKey() ? t.due : todayKey());
    const last = agdb.tasks.filter(x => x.group && x.project === t.project && x.id !== id).sort((a, b) => b.id - a.id)[0];
    await agUpdate(id, { begin, end: agAddWorkdays(begin, 9), group: t.group || last?.group || "" }, { quiet: true }); agRefresh();
    toast("Steht jetzt auch im Bauzeitenplan (2 Wochen). Zeitraum rechts anpassen.");
  }
}
async function agRemove(id, what) {
  const t = agTask(id); if (!t) return;
  if ($("agDetail").contains(document.activeElement)) document.activeElement.blur();
  if (what === "task") {
    const run = agRunningFor(id);
    if (run) await apply([["UpdateRecord", ZT.entries, run.id, ztStopFields(run)]], { refresh: false });
    await agUpdate(id, { status: "", due: null, time: "", repeat: "", doneAt: null, high: false }, { quiet: true });
    toast(agInPlan(t) ? "Keine Aufgabe mehr. Der Eintrag bleibt im Bauzeitenplan." : "Keine Aufgabe mehr. Der Eintrag bleibt als Notiz.");
  } else if (what === "plan") {
    await agUpdate(id, { begin: null, end: null, after: [], progress: 0 }, { quiet: true });
    toast("Aus dem Bauzeitenplan genommen. Der Eintrag bleibt.");
  }
  await ztFetch(); await agFetch(); agRefresh();
}
function agAutoGrow(el) { if (!el) return; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }

function agRefreshDetailTime(t) {
  const el = $("agdTime2"); if (!el) return;
  const run = agRunningFor(t.id), es = agEntries(t.id).slice().sort((a, b) => b.date.localeCompare(a.date) || (b.start ?? 0) - (a.start ?? 0));
  const booked = agBooked(t.id), pct = t.est ? Math.min(100, booked / (t.est * 60) * 100) : 0;
  const over = t.est && booked > t.est * 60;
  if ($("agdTimeSum")) $("agdTimeSum").textContent = es.length ? `${hm(booked)} h aus ${es.length} ${es.length === 1 ? "Buchung" : "Buchungen"}` : "";
  el.innerHTML = `
    <div class="agd-tsum"><span><b ${run ? `data-ag-run="${t.id}"` : ""}>${hm(booked)}</b> h gebucht</span>${t.est ? `<span class="${over ? "over" : ""}">geschätzt ${String(t.est).replace(".", ",")} h</span>` : ""}</div>
    ${t.est ? `<div class="agd-bar"><i style="width:${pct}%;${over ? "background:var(--danger)" : ""}"></i></div>` : ""}
    ${es.slice(0, 8).map(e => `<div class="agd-ent" data-zentry="${e.id}"><span>${e.date === todayKey() ? "heute" : fmtDay(e.date)}</span><span class="n">${esc(e.running ? "läuft seit " + hm(e.start) : e.note)}</span><b>${hm(durOf(e))}</b></div>`).join("")}
    ${es.length > 8 ? `<div class="muted" style="padding:4px 0">… und ${es.length - 8} weitere</div>` : ""}
    <div class="agd-tbtn">${agDone(t) ? "" : run
      ? `<button type="button" class="btn btn-ghost" data-agplay="${t.id}">■ Timer stoppen</button>`
      : `<button type="button" class="btn btn-primary" data-agplay="${t.id}">▶ Timer starten</button>`}
      <button type="button" class="btn btn-ghost" id="agdAddTime">+ Zeit nachtragen</button></div>`;
}

function agDrawSteps(t) {
  const el = $("agdSteps"); if (!el) return;
  el.innerHTML = t.steps.map((s, i) => `<div class="agd-step ${s.d ? "d" : ""}" data-i="${i}"><button type="button" class="ag-cb sm" data-step="${i}"></button><input value="${esc(s.t)}" data-steptext="${i}"><button type="button" class="x" data-stepdel="${i}" title="Entfernen">✕</button></div>`).join("");
}

async function agSaveField(id, key, value) {
  const t = agTask(id); if (!t) return;
  const patch = { [key]: value };
  if (key === "status") {
    if (value === "erledigt" && !agDone(t)) return agToggleDone(id);
    if (value !== "erledigt" && agDone(t)) patch.doneAt = null;
  }
  if (key === "project" && t.lv && lvById(t.lv) && refId(lvById(t.lv).Projekt) !== value) patch.lv = null;
  await agUpdate(id, patch, { quiet: key === "title" || key === "note" || key === "steps" });
  if (key === "title" || key === "note" || key === "steps") {
    // Liste leise nachziehen, ohne das Detail neu aufzubauen
    const row = document.querySelector(`#agBody [data-agid="${id}"] .ag-tt`);
    if (row && key === "title") row.textContent = value || "Ohne Titel";
    const meta = document.querySelector(`#agBody .ag-row[data-agid="${id}"] .ag-meta`);
    if (meta && key === "steps") meta.innerHTML = agMeta(t, { withProject: false });
  }
}

async function agDelete(id) {
  const t = agTask(id); if (!t) return;
  const n = agEntries(id).length;
  if (!confirm(`Eintrag „${t.title}“ ganz löschen (Notiz, Aufgabe und Plan)?${n ? `\n\nDie ${n} gebuchten Zeiteinträge bleiben erhalten, verlieren aber die Verknüpfung.` : ""}\n\nWer nur einen Teil loswerden will, nimmt „entfernen“ am Abschnitt.`)) return;
  const actions = agEntries(id).map(e => ["UpdateRecord", ZT.entries, e.id, { Aufgabe: 0 }]);
  agdb.tasks.filter(x => x.after.includes(id)).forEach(x => actions.push(["UpdateRecord", AG.tasks, x.id, agFields({ after: x.after.filter(y => y !== id) })]));
  actions.push(["RemoveRecord", AG.tasks, id]);
  agSel = null;
  await apply(actions, { refresh: false });
  await ztFetch(); await agFetch(); agRefresh();
}

// ------------------------------------------------------
// Ereignisse
// ------------------------------------------------------
function agBind() {
  $("agInstall").addEventListener("click", agInstall);
  $("agMode").addEventListener("click", e => { const b = e.target.closest("[data-agm]"); if (!b) return; agMode = b.dataset.agm; localStorage.setItem("lv-ag-mode", agMode); agRender(); });
  $("agWho").addEventListener("click", e => { const b = e.target.closest("[data-agw]"); if (!b) return; agWho = b.dataset.agw; localStorage.setItem("lv-ag-who", agWho); agRender(); });
  $("agProject").addEventListener("change", e => { agProject = e.target.value; agRender(); });
  $("agTimer").addEventListener("click", e => { if (e.target.closest("#agStop")) ztStopTimer(); });

  const body = $("agBody");
  body.addEventListener("pointerdown", e => {
    if (e.target.closest(".zt-daycal")) return ztCalPointerDown(e);
    if (e.target.closest(".ag-row[data-agid]")) agRowDragStart(e);
  });
  body.addEventListener("click", e => {
    if (agRowDragJustDropped) { agRowDragJustDropped = false; e.stopPropagation(); return; }
    const dn = e.target.closest("[data-ztday]");
    if (dn) { ztDayNav(Number(dn.dataset.ztday)); return agRender(); }
    const ch = e.target.closest(".zt-dayp .chip[data-zentry]");
    if (ch) { const en = zdb.entries.find(x => x.id === Number(ch.dataset.zentry)); if (en && !en.running) ztOpenDialog({ ...en }); return; }
    if (e.target.closest(".zt-dayp")) return;
    const t = e.target;
    const done = t.closest("[data-agdone]"); if (done) return agToggleDone(Number(done.dataset.agdone));
    const play = t.closest("[data-agplay]"); if (play) { const id = Number(play.dataset.agplay); return agRunningFor(id) ? ztStopTimer() : agStartTimer(id); }
    if (t.closest("#agToggleDone")) { agShowDone = !agShowDone; return agRender(); }
    if (t.closest("[data-agnew]")) { agMode = "list"; agRender(); return $("agQuick")?.focus(); }
    const row = t.closest("[data-agid]");
    if (row) { const id = Number(row.dataset.agid); agSel = agSel === id && !t.closest(".ag-card") ? null : id; return agRender(); }
  });
  body.addEventListener("input", e => { if (e.target.id === "agQuick") agDrawParse(); });
  body.addEventListener("keydown", e => {
    if (e.target.id === "agQuick" && e.key === "Enter") { e.preventDefault(); agAddQuick(); }
    if (e.target.id === "agQuick" && e.key === "Escape") { e.target.value = ""; agDrawParse(); }
  });
  // Board: Ziehen zwischen Spalten
  body.addEventListener("dragstart", e => { const c = e.target.closest(".ag-card"); if (!c) return; agDragId = Number(c.dataset.agid); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(agDragId)); c.classList.add("drag"); });
  body.addEventListener("dragend", () => { agDragId = null; body.querySelectorAll(".drag, .over").forEach(x => x.classList.remove("drag", "over")); });
  body.addEventListener("dragover", e => { const col = e.target.closest("[data-agcol]"); if (!col || !agDragId) return; e.preventDefault(); body.querySelectorAll(".ag-col.over").forEach(x => x !== col && x.classList.remove("over")); col.classList.add("over"); });
  body.addEventListener("drop", async e => {
    const col = e.target.closest("[data-agcol]"); if (!col || !agDragId) return;
    e.preventDefault();
    const id = agDragId; agDragId = null;
    const t = agTask(id); if (!t || t.status === col.dataset.agcol) return agRender();
    await agSaveField(id, "status", col.dataset.agcol);
  });

  const d = $("agDetail");
  d.addEventListener("click", e => {
    const t = e.target, id = agSel; if (!id) return;
    if (t.closest("#agdClose")) { agSel = null; return agRefresh(); }
    if (t.closest("#agdDelete")) return agDelete(id);
    const mk = t.closest("[data-agmk]"); if (mk && !mk.disabled) { e.stopPropagation(); return agMake(id, mk.dataset.agmk); }
    const rmv = t.closest("[data-agrm]"); if (rmv) return agRemove(id, rmv.dataset.agrm);
    const un = t.closest("[data-agunafter]");
    if (un) { const k = agTask(id); return agSavePlan({ [id]: { after: k.after.filter(x => x !== Number(un.dataset.agunafter)) } }); }
    const op = t.closest("[data-agopen]"); if (op) { agSel = Number(op.dataset.agopen); return agRefresh(); }
    const play = t.closest("[data-agplay]"); if (play) return agRunningFor(id) ? ztStopTimer() : agStartTimer(id);
    if (t.closest("#agdAddTime")) {
      const k = agTask(id);
      if (!ztReady()) return toast("Bitte zuerst die Zeiterfassung einrichten.");
      return ztOpenDialog({ id: null, project: k.project, date: todayKey(), start: null, end: null, hours: 0, lp: k.lp, tags: k.tag ? [k.tag] : [], note: k.title, task: id });
    }
    const ent = t.closest(".agd-ent[data-zentry]");
    if (ent) { const en = zdb.entries.find(x => x.id === Number(ent.dataset.zentry)); if (en && !en.running) ztOpenDialog(en); return; }
    const st = t.closest("[data-step]");
    if (st) { const k = agTask(id), i = Number(st.dataset.step); k.steps[i].d = !k.steps[i].d; agDrawSteps(k); return agSaveField(id, "steps", k.steps); }
    const sd = t.closest("[data-stepdel]");
    if (sd) { const k = agTask(id); k.steps.splice(Number(sd.dataset.stepdel), 1); agDrawSteps(k); return agSaveField(id, "steps", k.steps); }
  });
  d.addEventListener("change", e => {
    const id = agSel, el = e.target; if (!id) return;
    const map = { agdProject: ["project", v => Number(v) || null], agdLv: ["lv", v => Number(v) || null], agdStatus: ["status", v => v],
      agdDue: ["due", v => v || null], agdTime: ["time", v => { const m = /^(\d{1,2})(?::|\.)?(\d{2})?$/.exec(v.trim()); return m ? `${m[1].padStart(2, "0")}:${m[2] || "00"}` : ""; }],
      agdPerson: ["person", v => v.trim()], agdHigh: ["high", (v, x) => x.checked], agdRepeat: ["repeat", v => v],
      agdLp: ["lp", v => Number(v) || null], agdTag: ["tag", v => Number(v) || null], agdEst: ["est", v => parseDe(v) || 0],
      agdGroup: ["group", v => v.trim()], agdProgress: ["progress", v => Number(v) || 0] };
    if (el.id === "agdBegin" || el.id === "agdEnd" || el.id === "agdAfter") el.blur();
    if (el.id === "agdBegin" || el.id === "agdEnd") {
      const k = agTask(id); let begin = k.begin, end = k.end;
      if (el.id === "agdBegin") {
        if (!el.value) return agRemove(id, "plan");
        const shift = begin ? agDays(begin, el.value) : 0;
        begin = el.value; if (end) end = addDays(end, shift);       // Dauer bleibt beim Verschieben gleich
      } else end = el.value || null;
      return agSavePlan({ [id]: { begin, end } });
    }
    if (el.id === "agdAfter") {
      const k = agTask(id), p = agTask(Number(el.value)); if (!p) return;
      return agSavePlan({ [id]: { after: [...k.after, p.id], begin: k.begin, end: k.end } }, { msg: `Folgt jetzt auf „${p.title}“.` });
    }
    const m = map[el.id]; if (!m) return;
    el.blur();
    agSaveField(id, m[0], m[1](el.value, el));
  });
  d.addEventListener("input", e => {
    const id = agSel, el = e.target; if (!id) return;
    if (el.id === "agdTitle") agAutoGrow(el);
    if (el.id === "agdProgress" && $("agdProgOut")) $("agdProgOut").textContent = el.value + " %";
    if (el.id === "agdTitle" || el.id === "agdNote") {
      clearTimeout(agSaveTimer);
      const key = el.id === "agdTitle" ? "title" : "note", val = el.value;
      agSaveTimer = setTimeout(() => agSaveField(id, key, key === "title" ? val.replace(/\s*\n\s*/g, " ").trim() : val), 600);
    }
    if (el.dataset.steptext != null) {
      const k = agTask(id); k.steps[Number(el.dataset.steptext)].t = el.value;
      clearTimeout(agSaveTimer); agSaveTimer = setTimeout(() => agSaveField(id, "steps", k.steps), 600);
    }
  });
  d.addEventListener("keydown", e => {
    const id = agSel, el = e.target; if (!id) return;
    if (el.id === "agdTitle" && e.key === "Enter") { e.preventDefault(); el.blur(); }
    if (el.id === "agdNewStep" && e.key === "Enter" && el.value.trim()) {
      e.preventDefault();
      const k = agTask(id); k.steps.push({ t: el.value.trim(), d: false }); el.value = "";
      agDrawSteps(k); agSaveField(id, "steps", k.steps);
    }
  });
  d.addEventListener("focusout", e => {
    // Titel/Notiz sofort sichern, wenn das Feld verlassen wird
    if (agSaveTimer && (e.target.id === "agdTitle" || e.target.id === "agdNote" || e.target.dataset.steptext != null)) {
      clearTimeout(agSaveTimer); agSaveTimer = null;
      const id = agSel, k = agTask(id); if (!k) return;
      if (e.target.id === "agdTitle") agSaveField(id, "title", e.target.value.replace(/\s*\n\s*/g, " ").trim());
      else if (e.target.id === "agdNote") agSaveField(id, "note", e.target.value);
      else agSaveField(id, "steps", k.steps);
    }
  });
  document.addEventListener("keydown", e => {
    if (["tasks", "notes", "plan"].includes(view) && e.key === "Escape" && agSel && !document.querySelector("dialog[open]")) { agSel = null; agRefresh(); }
  });
}
agBind();
agFetch().then(() => { if (["tasks", "notes", "plan"].includes(view)) agRefresh(); }).catch(e => console.info("Aufgaben: Daten nicht lesbar.", e));
