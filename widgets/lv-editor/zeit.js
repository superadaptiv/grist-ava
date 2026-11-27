// ======================================================
// ZEITERFASSUNG  ·  Teil des LV-Editors (ab Version 2.8)
// Zeiteinträge je Projekt mit Leistungsphase (HOAI) und Tags.
// Reiter: Liste · Kalender · Auswertung. Stundenliste als PDF.
// Nutzt die globalen Helfer aus app.js (db, apply, esc, toast …).
// ======================================================
"use strict";

const ZT = { entries: "Zeiteintraege", tags: "Tags" };
const ZT_SCHEMA = [
  { table: ZT.tags, cols: [
    { id: "Name", type: "Text" },
    { id: "Farbe", type: "Text" },
    { id: "Beschreibung", type: "Text" },
    { id: "Aktiv", type: "Bool" }
  ]},
  { table: ZT.entries, cols: [
    { id: "Projekt", type: "Ref:Projekte", show: "Projektname" },
    { id: "Datum", type: "Date" },
    { id: "Start", type: "Text", label: "Von" },
    { id: "Ende", type: "Text", label: "Bis" },
    { id: "Dauer_h", type: "Numeric", label: "Dauer (h)", widgetOptions: JSON.stringify({ decimals: 2, maxDecimals: 2 }) },
    { id: "LPH", type: "Int", label: "Leistungsphase" },
    { id: "Tags", type: "RefList:Tags", show: "Name" },
    { id: "Notiz", type: "Text" },
    { id: "Person", type: "Text" },
    { id: "Laeuft", type: "Bool", label: "Timer läuft" }
  ]}
];
const ZT_DEFAULT_TAGS = [
  { Name: "Entwurf", Farbe: "#7c5cdb", Beschreibung: "Planung, Varianten, Details", Aktiv: true },
  { Name: "Ausschreibung", Farbe: "#e07b00", Beschreibung: "LV, Vergabe", Aktiv: true },
  { Name: "Bauüberwachung", Farbe: "#0e7490", Beschreibung: "Baustelle, Abnahme", Aktiv: true }
];
const LPH = ["", "Grundlagenermittlung", "Vorplanung", "Entwurfsplanung", "Genehmigungsplanung", "Ausführungsplanung",
  "Vorbereitung der Vergabe", "Mitwirkung bei der Vergabe", "Objektüberwachung", "Objektbetreuung"];
// Projektfarben: feste Reihenfolge (validierte Kategorienpalette), Farbe hängt am Projekt, nicht am Rang
const ZT_COLORS = ["#257de0", "#f47230", "#00b894", "#f2a600", "#ee7fac", "#008a17", "#6a4ce2", "#ec4647"];
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const zdb = { entries: [], tags: [] };
let ztMissing = [];          // fehlende Tabellen/Spalten
let ztTab = "list";          // list | cal | stats
let ztAnchor = todayKey();   // Bezugstag (Woche/Monat … wird daraus abgeleitet)
let ztPeriod = "week";       // week | month | quarter | year | free
let ztFree = { from: "", to: "" };
let ztFilter = { project: "", person: "", tag: "" };
let ztQuick = null;          // Zustand der Eingabezeile
let ztEdit = null;           // Eintrag im Dialog
let ztTick = null;
let ztDay = null;            // Tag für die Tagesansicht neben der Liste

// ------------------------------------------------------
// Datum und Zeit
// ------------------------------------------------------
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const keyDate = k => { const [y, m, d] = k.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const dateKey = d => d.toISOString().slice(0, 10);
const addDays = (k, n) => { const d = keyDate(k); d.setUTCDate(d.getUTCDate() + n); return dateKey(d); };
const weekStart = k => { const d = keyDate(k); return addDays(k, -((d.getUTCDay() + 6) % 7)); };
const secToKey = s => (s == null || s === "" || !isFinite(s)) ? null : dateKey(new Date(Number(s) * 1000));
const keyToSec = k => keyDate(k).getTime() / 1000;
const fmtDay = k => { const d = keyDate(k); return `${WD[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.`; };
const fmtDE = k => { const [y, m, d] = k.split("-"); return `${d}.${m}.${y}`; };
const fmtDEs = k => { const [y, m, d] = k.split("-"); return `${d}.${m}.${y.slice(2)}`; };
function isoWeek(k) {
  const d = keyDate(k); const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const y = d.getUTCFullYear(), jan4 = new Date(Date.UTC(y, 0, 4));
  return 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}
const toMin = t => { const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(t || "").trim()); return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null; };
const hm = m => `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, "0")}`;
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m) % 60).padStart(2, "0")}`;
const hrs = m => (Math.round(m / 6) / 10).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " h";
const q15 = m => Math.max(15, Math.round(m / 15) * 15);   // Dauer auf 15 Minuten runden
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };

// Eingabe „13–14:30“, „13:00-14:30“, „1,5h“, „90min“, „1:30“ (Dauer) → { start, end, dur }
function parseTimeInput(text) {
  const s = String(text || "").trim().toLowerCase().replace(/\s+/g, "").replace(/[–—]/g, "-").replace(/uhr/g, "");
  if (!s) return null;
  let m = /^(\d{1,2}(?::\d{2})?)-(\d{1,2}(?::\d{2})?)$/.exec(s.replace(/\./g, ":"));
  if (m) {
    let a = toMin(m[1]), b = toMin(m[2]);
    if (a == null || b == null || b <= a || b > 24 * 60) return null;
    a = Math.round(a / 15) * 15; b = Math.min(24 * 60, a + q15(b - a));
    return { start: a, end: b, dur: b - a };
  }
  m = /^(\d+(?:[.,]\d+)?)(h|std)$/.exec(s);
  if (m) { const d = Math.round(parseFloat(m[1].replace(",", ".")) * 60); return d > 0 ? { start: null, end: null, dur: q15(d) } : null; }
  m = /^(\d+)(m|min)$/.exec(s);
  if (m) return Number(m[1]) > 0 ? { start: null, end: null, dur: q15(Number(m[1])) } : null;
  m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) { const d = Number(m[1]) * 60 + Number(m[2]); return d > 0 ? { start: null, end: null, dur: q15(d) } : null; }
  m = /^(\d+(?:[.,]\d+)?)$/.exec(s);
  if (m) { const d = Math.round(parseFloat(m[1].replace(",", ".")) * 60); return d > 0 && d <= 24 * 60 ? { start: null, end: null, dur: q15(d) } : null; }
  return null;
}

// ------------------------------------------------------
// Daten
// ------------------------------------------------------
const ztPerson = () => localStorage.getItem("lv-zeit-person") || "";
const ztSoll = () => num(settings.soll) || 40;
const ztReady = () => !ztMissing.some(m => m.table);

async function ztFetch() {
  const load = id => grist.docApi.fetchTable(id).catch(() => null);
  const [e, t] = await Promise.all([load(ZT.entries), load(ZT.tags)]);
  const have = { [ZT.entries]: e, [ZT.tags]: t };
  ztMissing = [];
  for (const d of ZT_SCHEMA) {
    if (!have[d.table]) { ztMissing.push({ table: d.table }); continue; }
    for (const c of d.cols) if (!(c.id in have[d.table])) ztMissing.push({ col: true, table: d.table, ...c });
  }
  zdb.hasTask = !!e && "Aufgabe" in e;
  zdb.tags = rows(t).map(r => ({ id: r.id, name: r.Name || "", color: r.Farbe || "#a1a1aa", desc: r.Beschreibung || "", active: r.Aktiv !== false }));
  zdb.entries = rows(e).map(r => {
    const start = toMin(r.Start), end = toMin(r.Ende), running = isActive(r.Laeuft);
    const tags = Array.isArray(r.Tags) ? r.Tags.slice(r.Tags[0] === "L" ? 1 : 0).map(Number).filter(Boolean) : [];
    return {
      id: r.id, project: refId(r.Projekt), date: secToKey(r.Datum), start, end, running,
      hours: num(r.Dauer_h), lp: Number(r.LPH) || null, tags, note: r.Notiz || "", person: r.Person || "",
      task: refId(r.Aufgabe)
    };
  }).filter(x => x.date);
}

function durOf(e) {
  if (e.running && e.start != null) return Math.max(0, (e.date === todayKey() ? nowMin() : 24 * 60) - e.start);
  if (e.start != null && e.end != null && e.end > e.start) return e.end - e.start;
  return Math.round(e.hours * 60);
}
const projById = id => db.projects.find(p => p.id === id);
const projLabel = id => { const p = projById(id); return p ? (p.Projektname || p.Projektnummer || "Projekt " + id) : "Ohne Projekt"; };
const projNr = id => projById(id)?.Projektnummer || "";
function projColor(id) {
  const order = [...db.projects].sort((a, b) => a.id - b.id).map(p => p.id);
  const i = order.indexOf(id);
  return i < 0 ? "#a1a1aa" : ZT_COLORS[i % ZT_COLORS.length];
}
const tagById = id => zdb.tags.find(t => t.id === id);
const tagChip = id => { const t = tagById(id); return t ? `<span class="ztag" style="--tc:${esc(t.color)}">${esc(t.name)}</span>` : ""; };
const mine = e => !ztPerson() || !e.person || e.person === ztPerson();
const projectsSorted = () => [...db.projects].filter(p => p.Projektname || p.Projektnummer)
  .sort((a, b) => String(a.Projektnummer).localeCompare(String(b.Projektnummer), "de", { numeric: true }));

function entryFields(x) {
  const f = {
    Projekt: x.project || 0, Datum: keyToSec(x.date),
    Start: x.start != null ? hhmm(x.start) : "", Ende: x.end != null ? hhmm(x.end) : "",
    Dauer_h: Math.round((x.dur ?? 0) / 60 * 100) / 100, LPH: x.lp || null,
    Tags: ["L", ...(x.tags || [])], Notiz: x.note || "", Laeuft: !!x.running
  };
  if (x.person != null) f.Person = x.person;
  if (zdb.hasTask) f.Aufgabe = x.task || 0;     // Verknüpfung zur Aufgabe (ab 3.0)
  return f;
}

// ------------------------------------------------------
// Einrichtung (Tabellen anlegen)
// ------------------------------------------------------
async function ztInstall() {
  const lines = ztMissing.map(m => m.col ? `• Spalte ${m.table}.${m.id}` : `• Tabelle ${m.table}`);
  if (!confirm(`Für die Zeiterfassung wird in Grist angelegt:\n\n${lines.join("\n")}\n\nFortfahren?`)) return;
  const newTables = ztMissing.filter(m => !m.col).map(m => m.table);
  const actions = [], later = [];
  for (const d of ZT_SCHEMA) {
    if (!newTables.includes(d.table)) continue;
    const plain = d.cols.filter(c => !/^(Ref|RefList):/.test(c.type));
    actions.push(["AddTable", d.table, plain.map(c => ({ id: c.id, ...colInfo(c) }))]);
    d.cols.filter(c => /^(Ref|RefList):/.test(c.type)).forEach(c => later.push({ table: d.table, ...c }));
  }
  const added = [...later, ...ztMissing.filter(m => m.col)];
  for (const c of added) actions.push(["AddColumn", c.table, c.id, colInfo(c)]);
  if (newTables.includes(ZT.tags)) ZT_DEFAULT_TAGS.forEach(t => actions.push(["AddRecord", ZT.tags, null, t]));
  await apply(actions, { refresh: false });
  await setRefDisplay(added.filter(c => c.show).map(c => ({ ...c, type: "Ref:" + c.type.split(":")[1] })));
  await ztFetch();
  toast("Zeiterfassung eingerichtet. Drei Beispiel-Tags sind angelegt.");
  ztRender();
}

// ------------------------------------------------------
// Rendern
// ------------------------------------------------------
function ztRender() {
  if (["tasks", "notes", "plan"].includes(view) && typeof agRefresh === "function") return agRefresh();   // Einträge zeigen gebuchte Zeiten
  if (view !== "time") return;
  const ready = ztReady();
  $("ztBanner").hidden = ready && !ztMissing.length;
  $("ztBannerText").textContent = ready
    ? `Es fehlen Spalten: ${ztMissing.map(m => m.id).join(", ")}.`
    : "Es fehlen die Tabellen „Zeiteintraege“ und „Tags“. Sie werden mit einem Klick angelegt, dazu drei Beispiel-Tags.";
  document.querySelectorAll("#ztTabs [data-zt]").forEach(b => b.classList.toggle("on", b.dataset.zt === ztTab));
  ztRenderNav();
  ztRenderTimer();
  const body = $("ztBody");
  if (!ready) { body.innerHTML = '<div class="zt-empty">Noch nicht eingerichtet.</div>'; ztDayside(false); return; }
  const keep = ztTab === "list" ? ztSaveQuickFocus() : null;
  if (ztTab === "list") body.innerHTML = ztListHtml();
  else if (ztTab === "cal") body.innerHTML = ztCalHtml();
  else body.innerHTML = ztStatsHtml();
  if (ztTab === "list") ztRestoreQuick(keep);
  ztDayside(ztTab === "list");
  if (ztTab === "cal") ztScrollCal();
  ztRunTick();
}

function ztRange() {
  const a = ztAnchor;
  if (ztTab !== "stats" || ztPeriod === "week") { const s = weekStart(a); return { from: s, to: addDays(s, 6) }; }
  const d = keyDate(a), y = d.getUTCFullYear(), m = d.getUTCMonth();
  const k = (yy, mm, dd) => dateKey(new Date(Date.UTC(yy, mm, dd)));
  if (ztPeriod === "month") return { from: k(y, m, 1), to: k(y, m + 1, 0) };
  if (ztPeriod === "quarter") { const q = Math.floor(m / 3) * 3; return { from: k(y, q, 1), to: k(y, q + 3, 0) }; }
  if (ztPeriod === "year") return { from: k(y, 0, 1), to: k(y, 11, 31) };
  const f = ztFree.from || weekStart(a), t = ztFree.to || addDays(weekStart(a), 6);
  return f <= t ? { from: f, to: t } : { from: t, to: f };
}

function ztRenderNav() {
  const { from, to } = ztRange();
  const M = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const d = keyDate(ztAnchor);
  let big, small;
  if (ztTab !== "stats" || ztPeriod === "week") { big = `KW ${isoWeek(from)}`; small = `${fmtDE(from).slice(0, 6)}–${fmtDE(to)}`; }
  else if (ztPeriod === "month") { big = M[d.getUTCMonth()]; small = String(d.getUTCFullYear()); }
  else if (ztPeriod === "quarter") { big = `Q${Math.floor(d.getUTCMonth() / 3) + 1}`; small = String(d.getUTCFullYear()); }
  else if (ztPeriod === "year") { big = String(d.getUTCFullYear()); small = ""; }
  else { big = "Zeitraum"; small = `${fmtDE(from)}–${fmtDE(to)}`; }
  $("ztWeekLbl").textContent = big;
  $("ztWeekRange").textContent = small;
  const free = ztTab === "stats" && ztPeriod === "free";
  $("ztPrev").disabled = $("ztNext").disabled = free;
}

function ztShift(dir) {
  if (ztTab !== "stats" || ztPeriod === "week") ztAnchor = addDays(ztAnchor, 7 * dir);
  else {
    const d = keyDate(ztAnchor);
    const n = ztPeriod === "month" ? 1 : ztPeriod === "quarter" ? 3 : ztPeriod === "year" ? 12 : 0;
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n * dir);
    ztAnchor = dateKey(d);
  }
  ztRender();
}

// ---------- Timer ----------
const ztRunning = () => zdb.entries.find(e => e.running && (!ztPerson() || e.person === ztPerson() || !e.person));
function ztRenderTimer() {
  const r = ztRunning(), el = $("ztTimer");
  if (!r) { el.hidden = true; return; }
  el.hidden = false;
  const task = r.task && typeof agTask === "function" ? agTask(r.task) : null;
  el.innerHTML = `<span class="pulse"></span><span class="tl"><i class="pdot" style="background:${projColor(r.project)}"></i>${esc(task ? task.title : projLabel(r.project))}${r.lp ? ` · LP ${r.lp}` : ""}</span>
    <b id="ztTimerClock">${ztClock(r)}</b><button type="button" class="stop" id="ztStop" title="Timer stoppen"><i></i></button>`;
}
function ztClock(r) {
  const s = Math.max(0, Math.floor(durOf(r) * 60));
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function ztRunTick() {
  clearInterval(ztTick);
  if (!ztRunning()) return;
  ztTick = setInterval(() => {
    if (view !== "time") return;
    const r = ztRunning(); if (!r) return clearInterval(ztTick);
    const c = $("ztTimerClock"); if (c) c.textContent = ztClock(r);
    document.querySelectorAll(`[data-run-dur="${r.id}"]`).forEach(x => { x.textContent = hm(durOf(r)); });
  }, 1000);
}
async function ztStartTimer() {
  const q = ztReadQuick();
  if (!q.project) return toast("Bitte zuerst ein Projekt wählen.");
  const old = ztRunning();
  const actions = [];
  if (old) actions.push(["UpdateRecord", ZT.entries, old.id, ztStopFields(old)]);
  const start = Math.floor(nowMin());
  actions.push(["AddRecord", ZT.entries, null, entryFields({ ...q, date: todayKey(), start, end: null, dur: 0, running: true, person: ztPerson() })]);
  const task = q.task && typeof agTask === "function" ? agTask(q.task) : null;
  if (task && task.status === "offen") actions.push(["UpdateRecord", AG.tasks, task.id, { Status: "in Arbeit" }]);
  q.task = null; q.closeTask = false; q.note = "";
  await apply(actions, { refresh: false });
  await ztFetch(); if (task) await agFetch(); ztRender();
  toast("Timer läuft.");
}
function ztStopFields(r) {
  const raw = r.date === todayKey() ? Math.max(r.start + 1, Math.round(nowMin())) : 24 * 60 - 1;
  const end = Math.min(24 * 60, r.start + q15(raw - r.start));   // auf 15 Minuten gerundet
  return { Ende: hhmm(end), Dauer_h: Math.round((end - r.start) / 60 * 100) / 100, Laeuft: false };
}
async function ztStopTimer() {
  const r = ztRunning(); if (!r) return;
  await apply([["UpdateRecord", ZT.entries, r.id, ztStopFields(r)]], { refresh: false });
  await ztFetch(); ztRender();
  toast("Timer gestoppt und eingetragen.");
}

// ---------- Auswahlfelder ----------
function projectOptions(selId, { all = false } = {}) {
  return (all ? `<option value="">Alle Projekte</option>` : `<option value="">Projekt wählen …</option>`) +
    projectsSorted().map(p => `<option value="${p.id}" ${p.id === selId ? "selected" : ""}>${esc(p.Projektnummer ? p.Projektnummer + " · " : "")}${esc(p.Projektname || "")}</option>`).join("");
}
const lpOptions = v => `<option value="">LP –</option>` + LPH.slice(1).map((n, i) => `<option value="${i + 1}" ${v === i + 1 ? "selected" : ""}>LP ${i + 1} · ${n}</option>`).join("");

// ---------- Liste ----------
function ztQuickDefaults() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("lv-zeit-quick") || "{}"); } catch (e) {}
  return { project: saved.project || sel.projectId || null, lp: saved.lp || null, tags: saved.tags || [], note: "", date: todayKey(), time: "", task: null, closeTask: false };
}
function ztReadQuick() {
  if (!ztQuick) ztQuick = ztQuickDefaults();
  const g = id => $(id);
  if (g("zqProject")) {
    ztQuick.project = Number(g("zqProject").value) || null;
    ztQuick.lp = Number(g("zqLp").value) || null;
    ztQuick.note = g("zqNote").value;
    ztQuick.date = g("zqDate").value || todayKey();
    ztQuick.time = g("zqTime").value;
    if (g("zqClose")) ztQuick.closeTask = g("zqClose").checked;
  }
  return ztQuick;
}
function ztSaveQuickFocus() { if (!$("zqProject")) return null; ztReadQuick(); return document.activeElement?.id || null; }
function ztRestoreQuick(focusId) { if (focusId && $(focusId)) $(focusId).focus(); }

function ztQuickHtml() {
  const q = ztQuick || (ztQuick = ztQuickDefaults());
  const tags = q.tags.map(id => tagById(id) ? `<button type="button" class="ztag on" data-qtag="${id}" style="--tc:${esc(tagById(id).color)}" title="Entfernen">${esc(tagById(id).name)}</button>` : "").join("");
  return `<div class="zq">
    <select id="zqProject" class="zf" title="Projekt">${projectOptions(q.project)}</select>
    <select id="zqLp" class="zf zf-lp" title="Leistungsphase (HOAI)">${lpOptions(q.lp)}</select>
    <div class="zf zf-tags" id="zqTags">${tags}<button type="button" class="zt-addtag" id="zqTagBtn">+ Tag</button></div>
    <input id="zqNote" class="zf" autocomplete="off" placeholder="${ztTasksOn() ? "Was wurde gemacht? Eintrag wählen …" : "Was wurde gemacht? (optional)"}" value="${esc(q.note)}">
    <input id="zqDate" class="zf zf-date" type="date" value="${esc(q.date)}">
    <input id="zqTime" class="zf zf-time" placeholder="Zeit wählen …" autocomplete="off" value="${esc(q.time)}">
    <button type="button" class="btn btn-primary" id="zqAdd">Eintragen</button>
  </div>
  <div class="zq-hint"><span>Zeit anklicken oder tippen: <kbd>13–14:30</kbd> / <kbd>1,5h</kbd></span><span><kbd>Enter</kbd> speichert</span>
    <button type="button" class="link" id="zqTimer">▶ Timer mit diesen Angaben starten</button><span>Zeile anklicken = bearbeiten</span></div>
  ${ztQuickTaskHtml(q)}<div class="zq-ac" id="zqAc" hidden></div>`;
}

// ---------- Aufgaben in der Eingabezeile (ab 3.0) ----------
const ztTasksOn = () => !!zdb.hasTask && typeof agdb !== "undefined" && agdb.tasks.length > 0;
function ztQuickTaskHtml(q) {
  const t = q.task && typeof agTask === "function" ? agTask(q.task) : null;
  if (!t) { q.task = null; return ""; }
  return `<div class="zq-task"><span class="ck">${agKindIcon(t)}</span>Eintrag: <b>${esc(t.title)}</b><button type="button" class="x" id="zqTaskX" title="Verknüpfung lösen">✕</button>
    ${!agIsTask(t) ? "" : agDone(t) ? `<span class="muted">bereits erledigt</span>` : `<label><input type="checkbox" id="zqClose" ${q.closeTask ? "checked" : ""}> Aufgabe damit erledigt</label>`}</div>`;
}
// ab v4.0: alle Einträge vorschlagen (Aufgaben, Notizen, Bauzeitenplan), nicht nur Aufgaben
let ztAcSel = 0;
function ztAcList() {
  if (!ztTasksOn()) return [];
  const pid = Number($("zqProject")?.value) || null;
  const words = ($("zqNote")?.value || "").toLowerCase().split(/\s+/).filter(Boolean);
  const cur = ztQuick?.task, today = todayKey();
  const rank = t => agIsTask(t) && ["over", "today"].includes(agGroupOf(t)) ? 0          // heute fällig zuerst
    : ztRunning()?.task === t.id ? 0
    : agIsTask(t) && t.status === "in Arbeit" ? 1
    : agInPlan(t) && t.begin <= today && (t.end || t.begin) >= today ? 1              // läuft gerade im Plan
    : t.created === today ? 2 : 3;
  return agdb.tasks.filter(t => (!agDone(t) || (agInPlan(t) && (t.end || t.begin) >= today)) && t.id !== cur && (!pid || t.project === pid)
      && (!t.person || !ztPerson() || t.person === ztPerson() || !agIsTask(t))
      && words.every(w => (t.title + " " + t.group).toLowerCase().includes(w)))
    .sort((a, b) => rank(a) - rank(b) || (b.created || "").localeCompare(a.created || "") || b.id - a.id)
    .slice(0, 7);
}
// Menüpunkte: Einträge, dann „Neuer Eintrag … (als Notiz merken)“, dann „ohne Eintrag buchen“
function ztAcItems() {
  const list = ztAcList().map(t => ({ kind: "entry", t }));
  const text = ($("zqNote")?.value || "").trim();
  if (text && ztTasksOn() && !agdb.tasks.some(t => t.title.toLowerCase() === text.toLowerCase())) list.push({ kind: "new", text });
  if (list.length) list.push({ kind: "none" });
  return list;
}
function ztAcSub(t, pid) {
  const b = agBooked(t.id), bits = [];
  if (!pid && t.project) bits.push(esc(projNr(t.project) || projLabel(t.project)));
  if (agIsTask(t)) bits.push(agDone(t) ? "Aufgabe erledigt" : "Aufgabe" + (t.due ? ", " + esc(agFmtDue(t)) + (t.due <= todayKey() ? " fällig" : "") : ""));
  else if (agInPlan(t)) bits.push("Bauzeitenplan" + (t.lv ? " · " + esc(lvShort(t.lv)) : ""));
  else bits.push("Notiz" + (t.created === todayKey() ? " von heute" : t.created ? " vom " + agDM(t.created) : ""));
  if (b) bits.push(hm(b) + (t.est ? " / " + String(t.est).replace(".", ",") : "") + " h");
  return bits.join(" · ");
}
function ztAcDraw() {
  const box = $("zqAc"), inp = $("zqNote"); if (!box || !inp) return;
  const items = ztAcItems();
  if (!items.length || document.activeElement !== inp) { box.hidden = true; return; }
  ztAcSel = Math.min(ztAcSel, items.length - 1);
  const pid = Number($("zqProject")?.value) || null;
  box.innerHTML = `<div class="h">Eintrag verknüpfen${pid ? " · " + esc(projNr(pid) || projLabel(pid)) : ""}</div>` + items.map((it, i) => {
    if (it.kind === "new") return `<div class="o oo ${i === ztAcSel ? "on" : ""}" data-zqnew="1">+ Neuer Eintrag „${esc(it.text)}“ <small>(als Notiz merken)</small></div>`;
    if (it.kind === "none") return `<div class="o oo ${i === ztAcSel ? "on" : ""}" data-zqnone="1">ohne Eintrag buchen</div>`;
    const t = it.t;
    return `<div class="o ${i === ztAcSel ? "on" : ""}" data-zqtask="${t.id}"><span class="ki ${agIsTask(t) ? "k-task" : agInPlan(t) ? "k-plan" : "k-note"}">${agKindIcon(t)}</span><span class="tx"><span class="t">${esc(t.title)}</span><small>${ztAcSub(t, pid)}</small></span></div>`;
  }).join("") + `<div class="f">↑↓ wählen · Enter übernehmen · Esc frei schreiben</div>`;
  const r = inp.getBoundingClientRect(), host = $("ztBody").getBoundingClientRect();
  box.style.left = (r.left - host.left + $("ztBody").scrollLeft) + "px";
  box.style.top = (r.bottom - host.top + $("ztBody").scrollTop + 4) + "px";
  box.style.width = Math.max(r.width, 420) + "px";
  box.hidden = false;
}
function ztAcPick(id) {
  const t = agTask(id); if (!t) return;
  const q = ztReadQuick();
  q.task = id; q.closeTask = false;
  if (!q.note.trim() || agIsTask(t) || agInPlan(t)) q.note = t.title;   // eigene Beschreibung bleibt, wenn man frei geschrieben hat
  if (t.project) q.project = t.project;
  if (t.lp) q.lp = t.lp;
  if (t.tag) q.tags = [t.tag];
  $("zqAc").hidden = true;
  // Felder direkt setzen, sonst liest ztRender den alten Text wieder ein
  if ($("zqProject")) { $("zqProject").value = q.project || ""; $("zqLp").value = q.lp || ""; $("zqNote").value = q.note; }
  ztRender();
  $("zqTime")?.focus();
}
// Aus der Beschreibung direkt einen Eintrag (Notiz) machen und verknüpfen
async function ztAcNew() {
  const q = ztReadQuick(), text = q.note.trim(); if (!text) return;
  const res = await apply([["AddRecord", AG.tasks, null, agFields({ title: text, project: q.project, status: "", person: ztPerson(), lp: q.lp, tag: q.tags[0] || null, created: todayKey() })]], { refresh: false });
  await agFetch();
  const id = newRowId(res);
  $("zqAc").hidden = true;
  if (id) { q.task = id; toast("Als Notiz gemerkt und verknüpft."); }
  ztRender();
  $("zqTime")?.focus();
}
// true = Taste wurde vom Vorschlagsmenü verarbeitet
function ztAcKey(e) {
  const box = $("zqAc");
  if (e.target.id !== "zqNote" || !box || box.hidden) return false;
  const items = ztAcItems();
  if (e.key === "ArrowDown") { ztAcSel = (ztAcSel + 1) % items.length; ztAcDraw(); }
  else if (e.key === "ArrowUp") { ztAcSel = (ztAcSel - 1 + items.length) % items.length; ztAcDraw(); }
  else if (e.key === "Enter" && items[ztAcSel]) {
    const it = items[ztAcSel];
    if (it.kind === "entry") ztAcPick(it.t.id);
    else if (it.kind === "new") ztAcNew();
    else box.hidden = true;
  }
  else if (e.key === "Escape") box.hidden = true;
  else return false;
  e.preventDefault();
  return true;
}
// Aufgaben dieser Woche, die erledigt sind, aber keine gebuchte Zeit haben
function ztCheckHtml() {
  if (!ztTasksOn()) return "";
  const { from, to } = ztRange();
  const list = agdb.tasks.filter(t => agDone(t) && t.doneAt && t.doneAt >= from && t.doneAt <= to
    && (!t.person || !ztPerson() || t.person === ztPerson()) && !agEntries(t.id).length);
  if (!list.length) return "";
  return `<div class="zq-check"><b>Erledigt, aber ohne Zeit</b>${list.slice(0, 6).map(t => `<button type="button" class="link" data-zqtask="${t.id}" title="Zeit für diese Aufgabe eintragen">${esc(t.title)}</button>`).join("")}${list.length > 6 ? `<span class="muted">+${list.length - 6}</span>` : ""}</div>`;
}

function ztWeekEntries() {
  const { from, to } = ztRange();
  return zdb.entries.filter(e => e.date >= from && e.date <= to && mine(e));
}

// Verknüpfter Eintrag als kleines Abzeichen (ab v4.0)
function ztEntryChip(e) {
  const t = e.task && typeof agTask === "function" ? agTask(e.task) : null; if (!t) return "";
  const k = agIsTask(t) ? "eb-task" : agInPlan(t) ? "eb-plan" : "eb-note";
  return ` <span class="eb ${k} zr-ent" title="Eintrag: ${esc(t.title)}">${agKindIcon(t)}${t.title === e.note ? "" : esc(t.title)}</span>`;
}
function ztRowHtml(e) {
  const d = durOf(e);
  return `<div class="zr ${e.running ? "run" : ""}" data-zentry="${e.id}">
    <span class="tm">${e.start != null ? hm(e.start) + "–" + (e.running ? "läuft" : e.end != null ? hm(e.end) : "") : "–"}</span>
    <span class="pj"><i class="pdot" style="background:${projColor(e.project)}"></i><small>${esc(projNr(e.project))}</small><span>${esc(projLabel(e.project))}</span></span>
    <span class="lp">${e.lp ? "LP " + e.lp : ""}</span>
    <span class="ztg">${e.tags.map(tagChip).join("")}</span>
    <span class="nt">${esc(e.note)}${ztEntryChip(e)}</span>
    <span class="du" ${e.running ? `data-run-dur="${e.id}"` : ""}>${hm(d)}</span></div>`;
}

function ztDayKey() {
  const { from, to } = ztRange(), t = todayKey();
  if (ztDay && ztDay >= from && ztDay <= to) return ztDay;
  return t >= from && t <= to ? t : from;
}
// v3.7: Tageskalender im Inspector-Stil (Kopf wie Projekte / LV, Raster füllt die Höhe, Summe unten)
const WDL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONL = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
function ztDayCalHtml(k) {
  const es = zdb.entries.filter(e => e.date === k && mine(e));
  const timed = es.filter(e => e.start != null), today = todayKey();
  CAL.px = CAL.dayPx;
  CAL.h0 = Math.min(7, ...timed.map(e => Math.floor(e.start / 60)));
  CAL.h1 = Math.max(20, ...timed.map(e => Math.ceil((e.end ?? (e.running ? nowMin() : e.start + 60)) / 60)));
  const n = CAL.h1 - CAL.h0, H = n * CAL.px;
  const hours = [...Array(n + 1)].map((_, i) => `<div class="hl" style="top:${i * CAL.px}px">${CAL.h0 + i}:00</div>`).join("");
  let col = `<div class="col" data-day="${k}" style="height:${H}px;--px:${CAL.px}px">`;
  for (const e of timed) {
    const end = e.running ? (k === today ? nowMin() : 24 * 60) : (e.end ?? e.start + durOf(e));
    const top = (e.start / 60 - CAL.h0) * CAL.px, h = Math.max(18, (end - e.start) / 60 * CAL.px - 2);
    col += `<div class="blk ${e.running ? "run" : ""}" data-zentry="${e.id}" style="top:${top + 1}px;height:${h}px;--pc:${projColor(e.project)}">
      <b>${esc(projLabel(e.project))}</b>${h > 30 ? `<span class="t">${hm(e.start)}–${e.running ? "läuft" : hm(end)}${e.lp ? " · LP " + e.lp : ""}</span>` : ""}
      ${h > 58 ? `<div class="ztg">${e.tags.map(tagChip).join("")}</div>` : ""}${h > 90 && e.note ? `<div class="nt">${esc(e.note)}</div>` : ""}
      ${e.running ? "" : '<i class="rz"></i>'}</div>`;
  }
  if (k === today) { const x = nowMin() / 60; if (x >= CAL.h0 && x <= CAL.h1) col += `<div class="now" style="top:${(x - CAL.h0) * CAL.px}px"></div>`; }
  col += `</div>`;
  const untimed = es.filter(e => e.start == null);
  const chips = untimed.length ? `<div class="zt-duntimed">${untimed.map(e => `<div class="chip" data-zentry="${e.id}" style="--pc:${projColor(e.project)}" title="${esc(projLabel(e.project))}">${hm(durOf(e))} ${esc(projLabel(e.project))}</div>`).join("")}</div>` : "";
  return `${chips}<div class="zcal zcal-day zt-dgrid"><div class="zt-dhours" style="height:${H}px">${hours}</div>${col}</div>`;
}
function ztDayPanelHtml() {
  const k = ztDayKey(), d = keyDate(k);
  const es = zdb.entries.filter(e => e.date === k && mine(e)), sum = es.reduce((a, e) => a + durOf(e), 0);
  const nav = (s, t, p) => `<button type="button" class="zt-nav" data-ztday="${s}" title="${t}"><svg viewBox="0 0 20 20"><path d="${p}"/></svg></button>`;
  return `<aside class="zt-dayp"><div class="zt-dhead">
      <div class="ins-h"><span>Tageskalender · KW ${isoWeek(k)}</span><span class="zt-dnav">${nav(-1, "Tag zurück", "M12 5l-5 5 5 5")}${nav(1, "Tag weiter", "M8 5l5 5-5 5")}</span></div>
      <div class="zt-ddate">${WDL[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONL[d.getUTCMonth()]}${k === todayKey() ? '<span class="pill">heute</span>' : ""}</div>
      <div class="muted">${es.length ? `${es.length} ${es.length === 1 ? "Eintrag" : "Einträge"}` : "Keine Einträge"}</div></div>
    <div class="zt-daycal" id="ztDayCal">${ztDayCalHtml(k)}</div>
    <div class="ins-total"><span>Summe Tag</span><b>${hm(sum)} h</b></div></aside>`;
}
function ztScrollDay() {
  const el = $("ztDayCal"); if (!el) return;
  const first = Math.min(8, ...zdb.entries.filter(e => e.date === ztDayKey() && e.start != null).map(e => Math.floor(e.start / 60)));
  el.scrollTop = Math.max(0, (first - CAL.h0) * CAL.px - 10);
}
// Stundenhöhe so wählen, dass das Raster die Spalte bis zur Summenzeile füllt (mind. 40 px)
function ztFitDay() {
  const el = $("ztDayCal"); if (!el || !el.clientHeight) return false;
  const n = CAL.h1 - CAL.h0, rest = [...el.children].reduce((a, c) => a + c.offsetHeight, 0) - CAL.px * n;
  const px = Math.max(40, Math.floor((el.clientHeight - rest - 2) / n));
  if (px === CAL.dayPx) return false;
  CAL.dayPx = px; return true;
}
function ztDayNav(step) {
  ztDay = addDays(ztDayKey(), step);
  const { from, to } = ztRange();
  if (ztDay < from || ztDay > to) ztAnchor = ztDay;
}
function ztListHtml() {
  return ztListMainHtml();
}
// Tageskalender als eigene rechte Spalte, durchgehend bis oben (wie Inspector in Projekte / LV)
function ztDayside(on) {
  const el = $("dayside"), app = $("app"); if (!el) return;
  on = !!on && ztReady();
  el.hidden = !on;
  app.classList.toggle("dayview", on);
  app.classList.toggle("wide", !on && ["time", "mengen", "tasks", "notes", "plan"].includes(view));
  if (!on) { el.innerHTML = ""; return; }
  el.innerHTML = ztDayPanelHtml();
  if (ztFitDay()) el.innerHTML = ztDayPanelHtml();
  ztScrollDay();
}
let ztFitT = null;
window.addEventListener("resize", () => {
  clearTimeout(ztFitT);
  ztFitT = setTimeout(() => { if (!$("dayside")?.hidden && $("ztDayCal") && ztFitDay()) { $("dayside").innerHTML = ztDayPanelHtml(); ztScrollDay(); } }, 120);
});
function ztListMainHtml() {
  const list = ztWeekEntries();
  const days = [...new Set(list.map(e => e.date))].sort().reverse();
  const today = todayKey();
  const groups = days.map(k => {
    const es = list.filter(e => e.date === k).sort((a, b) => (b.start ?? -1) - (a.start ?? -1) || b.id - a.id);
    const sum = es.reduce((s, e) => s + durOf(e), 0);
    return `<div class="zday"><div class="zdh ${k === today ? "today" : ""} ${k === ztDayKey() ? "cur" : ""}" data-day="${k}" title="Im Tageskalender zeigen"><b>${fmtDay(k)}</b>${es.length} ${es.length === 1 ? "Eintrag" : "Einträge"}<span class="s">${hrs(sum)}</span></div>${es.map(ztRowHtml).join("")}</div>`;
  }).join("");
  const tot = list.reduce((s, e) => s + durOf(e), 0);
  return ztQuickHtml() + ztCheckHtml() + (groups
    ? `${groups}<div class="zfoot">Summe KW ${isoWeek(ztRange().from)}: <b>${hrs(tot)}</b>${ztPerson() ? ` · ${esc(ztPerson())}` : ""}</div>`
    : `<div class="zt-empty">Keine Einträge in dieser Woche. Oben eintragen oder im Kalender eine Zeit aufziehen.</div>`);
}

async function ztAddQuick() {
  const q = ztReadQuick();
  if (!q.project) { toast("Bitte ein Projekt wählen."); $("zqProject").focus(); return; }
  const t = parseTimeInput(q.time);
  if (!t) { toast("Zeit bitte als 13–14:30 oder als Dauer wie 1,5h eingeben."); $("zqTime").focus(); return; }
  await apply([["AddRecord", ZT.entries, null, entryFields({ ...q, ...t, person: ztPerson(), running: false })]], { refresh: false });
  localStorage.setItem("lv-zeit-quick", JSON.stringify({ project: q.project, lp: q.lp, tags: q.tags }));
  const close = q.closeTask && q.task && agTask(q.task) && !agDone(agTask(q.task)) ? q.task : null;
  q.note = ""; q.time = ""; q.task = null; q.closeTask = false;
  if (close) { await agToggleDone(close); toast("Eingetragen, Aufgabe erledigt."); }
  $("zqNote").value = ""; $("zqTime").value = "";
  await ztFetch();
  if (q.date < ztRange().from || q.date > ztRange().to) ztAnchor = q.date;
  ztRender();
  $("zqTime")?.focus();
}

// Tag-Auswahl (Menü mit Suche, auch für lange Tag-Listen)
function ztTagMenu(anchor, selected, onChange) {
  document.querySelector(".zt-tagmenu")?.remove();
  const m = document.createElement("div");
  m.className = "zt-tagmenu";
  const draw = (f = "") => {
    const list = zdb.tags.filter(t => t.active && t.name.toLowerCase().includes(f.toLowerCase()));
    m.querySelector(".tl").innerHTML = list.map(t => `<label><input type="checkbox" value="${t.id}" ${selected.includes(t.id) ? "checked" : ""}><i style="background:${esc(t.color)}"></i>${esc(t.name)}<small>${esc(t.desc)}</small></label>`).join("")
      || `<div class="muted" style="padding:6px 8px">Kein Tag gefunden.</div>`;
  };
  m.innerHTML = `<input type="search" placeholder="Tag suchen …"><div class="tl"></div><button type="button" class="link" data-newtag>+ Neuer Tag</button>`;
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.min(r.left, innerWidth - 280) + "px";
  m.style.top = (r.bottom + 4) + "px";
  draw();
  const inp = m.querySelector("input"); inp.focus();
  inp.addEventListener("input", () => draw(inp.value));
  m.addEventListener("change", e => {
    const id = Number(e.target.value);
    const i = selected.indexOf(id);
    if (e.target.checked && i < 0) selected.push(id); else if (!e.target.checked && i >= 0) selected.splice(i, 1);
    onChange();
  });
  m.querySelector("[data-newtag]").addEventListener("click", async () => {
    const name = (inp.value || prompt("Name des neuen Tags:") || "").trim();
    if (!name) return;
    const res = await apply([["AddRecord", ZT.tags, null, { Name: name, Farbe: "#71717a", Beschreibung: "", Aktiv: true }]], { refresh: false });
    await ztFetch();
    const id = newRowId(res); if (id) selected.push(id);
    onChange(); draw(inp.value);
  });
  setTimeout(() => {
    const close = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("mousedown", close); } };
    document.addEventListener("mousedown", close);
  }, 0);
}

// ---------- Kalender ----------
const CAL = { h0: 7, h1: 20, px: 44, dayPx: 44 };   // dayPx: Stundenhöhe im Tageskalender (v3.7, an die Höhe angepasst)
function ztCalHtml(dayList = null) {
  const s = weekStart(ztAnchor), days = dayList || [...Array(7)].map((_, i) => addDays(s, i));
  CAL.px = 44;
  const es = zdb.entries.filter(e => e.date >= days[0] && e.date <= days[days.length - 1] && mine(e));
  const timed = es.filter(e => e.start != null);
  CAL.h0 = Math.min(7, ...timed.map(e => Math.floor(e.start / 60)));
  CAL.h1 = Math.max(20, ...timed.map(e => Math.ceil((e.end ?? (e.running ? nowMin() : e.start + 60)) / 60)));
  const H = (CAL.h1 - CAL.h0) * CAL.px, today = todayKey();
  let head = `<div class="ch corner"></div>`;
  let cols = `<div class="hours">${[...Array(CAL.h1 - CAL.h0)].map((_, i) => `<div style="height:${CAL.px}px">${i ? CAL.h0 + i + ":00" : ""}</div>`).join("")}</div>`;
  days.forEach((k, i) => {
    const de = es.filter(e => e.date === k), sum = de.reduce((a, e) => a + durOf(e), 0);
    const untimed = de.filter(e => e.start == null);
    head += `<div class="ch ${k === today ? "today" : ""} ${i > 4 ? "we" : ""}"><small>${WD[keyDate(k).getUTCDay()]}</small><b>${keyDate(k).getUTCDate()}.</b>${sum ? `<span class="s">${hrs(sum)}</span>` : ""}
      ${untimed.map(e => `<div class="chip" data-zentry="${e.id}" style="--pc:${projColor(e.project)}" title="${esc(projLabel(e.project))}">${hm(durOf(e))} ${esc(projLabel(e.project))}</div>`).join("")}</div>`;
    cols += `<div class="col ${i > 4 ? "we" : ""}" data-day="${k}" style="height:${H}px;background-size:100% ${CAL.px}px">`;
    for (const e of de.filter(x => x.start != null)) {
      const end = e.running ? (k === today ? nowMin() : 24 * 60) : (e.end ?? e.start + durOf(e));
      const top = (e.start / 60 - CAL.h0) * CAL.px, h = Math.max(18, (end - e.start) / 60 * CAL.px - 2);
      cols += `<div class="blk ${e.running ? "run" : ""}" data-zentry="${e.id}" style="top:${top + 1}px;height:${h}px;--pc:${projColor(e.project)}">
        <b>${esc(projLabel(e.project))}</b>${h > 30 ? `<span class="t">${hm(e.start)}–${e.running ? "läuft" : hm(end)}${e.lp ? " · LP " + e.lp : ""}</span>` : ""}
        ${h > 58 ? `<div class="ztg">${e.tags.map(tagChip).join("")}</div>` : ""}${h > 90 && e.note ? `<div class="nt">${esc(e.note)}</div>` : ""}
        ${e.running ? "" : '<i class="rz"></i>'}</div>`;
    }
    if (k === today) { const n = nowMin() / 60; if (n >= CAL.h0 && n <= CAL.h1) cols += `<div class="now" style="top:${(n - CAL.h0) * CAL.px}px"></div>`; }
    cols += `</div>`;
  });
  if (dayList) return `<div class="zcal zcal-day">${head}${cols}</div>`;
  const used = [...new Set(es.map(e => e.project))];
  return `<div class="zcal">${head}${cols}</div>
    <div class="zlgd">${used.map(id => `<span><i class="pdot" style="background:${projColor(id)}"></i>${esc(projNr(id))} ${esc(projLabel(id))}</span>`).join("")}
    <span class="spacer"></span><span class="muted">Aufziehen = neuer Eintrag · Block ziehen = verschieben · Unterkante ziehen = Dauer · Klick = bearbeiten</span></div>`;
}
function ztScrollCal() {
  const body = $("ztBody");
  const first = Math.min(8, ...zdb.entries.filter(e => e.start != null).map(e => Math.floor(e.start / 60)));
  body.scrollTop = Math.max(0, (first - CAL.h0) * CAL.px - 10);
}

const snap = m => Math.round(m / 15) * 15;
function ztCalMinutes(col, clientY) {
  const r = col.getBoundingClientRect();
  return Math.max(CAL.h0 * 60, Math.min(CAL.h1 * 60, CAL.h0 * 60 + (clientY - r.top) / CAL.px * 60));
}
let ztDrag = null;
function ztCalPointerDown(ev) {
  if (ev.button !== 0) return;
  const blk = ev.target.closest(".blk"), col = ev.target.closest(".col");
  if (!col) return;
  if (blk) {
    const e = zdb.entries.find(x => x.id === Number(blk.dataset.zentry));
    if (!e) return;
    const mode = ev.target.classList.contains("rz") ? "resize" : "move";
    ztDrag = { mode, e, blk, x0: ev.clientX, y0: ev.clientY, moved: false, start: e.start, end: e.end ?? e.start + durOf(e), day: e.date };
  } else {
    const m = snap(ztCalMinutes(col, ev.clientY));
    const g = document.createElement("div");
    g.className = "blk ghost"; col.appendChild(g);
    ztDrag = { mode: "new", col, a: m, b: m + 60, ghost: g, y0: ev.clientY, moved: false };
    ztDrawGhost();
  }
  ev.preventDefault();
  document.addEventListener("pointermove", ztCalPointerMove);
  document.addEventListener("pointerup", ztCalPointerUp, { once: true });
}
function ztDrawGhost() {
  const d = ztDrag, a = Math.min(d.a, d.b), b = Math.max(d.a, d.b);
  d.ghost.style.top = ((a / 60 - CAL.h0) * CAL.px + 1) + "px";
  d.ghost.style.height = Math.max(14, (b - a) / 60 * CAL.px - 2) + "px";
  d.ghost.innerHTML = `<b>Neuer Eintrag</b><span class="t">${hm(a)}–${hm(b)}</span>`;
}
function ztCalPointerMove(ev) {
  const d = ztDrag; if (!d) return;
  if (Math.abs(ev.clientY - d.y0) > 3 || Math.abs(ev.clientX - (d.x0 ?? ev.clientX)) > 3) d.moved = true;
  if (d.mode === "new") {
    const m = snap(ztCalMinutes(d.col, ev.clientY));
    d.b = m === d.a ? d.a + 15 : m; ztDrawGhost();
  } else if (d.mode === "resize") {
    const col = d.blk.closest(".col");
    d.end = Math.max(d.start + 15, snap(ztCalMinutes(col, ev.clientY)));
    d.blk.style.height = Math.max(18, (d.end - d.start) / 60 * CAL.px - 2) + "px";
  } else {
    const dy = (ev.clientY - d.y0) / CAL.px * 60, len = d.end - d.start;
    const ns = Math.max(CAL.h0 * 60, Math.min(CAL.h1 * 60 - len, snap(d.e.start + dy)));
    const over = document.elementsFromPoint(ev.clientX, ev.clientY).find(x => x.classList?.contains("col"));
    if (over && over !== d.blk.parentElement) over.appendChild(d.blk);
    d.day = d.blk.parentElement.dataset.day;
    d.start = ns; d.end = ns + len;
    d.blk.style.top = ((ns / 60 - CAL.h0) * CAL.px + 1) + "px";
    d.blk.classList.add("dragging");
  }
}
async function ztCalPointerUp() {
  document.removeEventListener("pointermove", ztCalPointerMove);
  const d = ztDrag; ztDrag = null;
  if (!d) return;
  if (d.mode === "new") {
    const a = Math.min(d.a, d.b), b = Math.max(d.a, d.b);
    const q = ztReadQuick();
    ztOpenDialog({ id: null, project: q.project, date: d.col.dataset.day, start: a, end: d.moved ? b : a + 60, lp: q.lp, tags: [...q.tags], note: "", person: ztPerson() }, () => d.ghost.remove());
    return;
  }
  if (!d.moved) { if (!d.e.running) ztOpenDialog({ ...d.e }); return; }
  if (d.e.running) return ztRender();
  await apply([["UpdateRecord", ZT.entries, d.e.id, { Datum: keyToSec(d.day), Start: hhmm(d.start), Ende: hhmm(d.end), Dauer_h: Math.round((d.end - d.start) / 60 * 100) / 100 }]], { refresh: false });
  await ztFetch(); ztRender();
}

// ---------- Zeitauswahl (Von / Bis / Dauer anklicken) ----------
let ztTp = null;   // { input, start }
const ZT_DURS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480];
function ztFmtDur(d) { return d < 60 ? `${d} min` : String(d / 60).replace(".", ",") + " h"; }
function ztFmtDurS(d) { return d < 60 ? `${d}m` : String(d / 60).replace(".", ",") + "h"; }
function ztTpAnschluss(input) {
  // Ende des letzten Eintrags am gewählten Tag (nur in der Eingabezeile)
  const date = input.id === "zqTime" ? ($("zqDate")?.value || todayKey()) : ($("zdDate")?.value || "");
  const ends = zdb.entries.filter(e => e.date === date && mine(e) && e.end != null).map(e => e.end);
  return ends.length ? Math.max(...ends) : null;
}
function ztTpOpen(input) {
  if (ztTp && ztTp.input === input && document.querySelector(".zt-tp")) return;
  ztTpClose();
  const cur = parseTimeInput(input.value);
  ztTp = { input, start: cur && cur.start != null ? cur.start : null, end: cur && cur.end != null ? cur.end : null };
  const m = document.createElement("div");
  m.className = "zt-tp";
  m.addEventListener("mousedown", e => e.preventDefault());   // Fokus bleibt im Feld
  m.addEventListener("click", ztTpClick);
  document.body.appendChild(m);
  ztTpDraw();
  const r = input.getBoundingClientRect(), w = m.offsetWidth || 222;
  m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + "px";
  const below = r.bottom + 6, h = m.offsetHeight;
  m.style.top = (below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below) + "px";
}
function ztTpDraw() {
  const m = document.querySelector(".zt-tp"); if (!m || !ztTp) return;
  const { start, end, input } = ztTp, an = ztTpAnschluss(input);
  const slots = []; for (let t = 6 * 60; t <= 22 * 60; t += 15) slots.push(t);
  const von = slots.map(t => `<button type="button" data-tp="von" data-v="${t}" class="${t === start ? "on" : ""}">${hm(t)}</button>`).join("");
  const bis = start == null
    ? `<div class="tp-empty">erst Beginn wählen</div>`
    : slots.filter(t => t > start).map(t => `<button type="button" data-tp="bis" data-v="${t}" class="${t === end ? "on" : ""}">${hm(t)}</button>`).join("");
  const cur = start != null && end != null ? end - start : null;
  const durs = ZT_DURS.map(d => `<button type="button" data-tp="dur" data-v="${d}" class="${d === cur ? "on" : ""}" title="${ztFmtDur(d)}">${ztFmtDurS(d)}</button>`).join("");
  m.innerHTML = `<div class="tp-quick">${an != null ? `<button type="button" data-tp="von" data-v="${an}" title="Beginn = Ende des letzten Eintrags">ab ${hm(an)}</button>` : ""}<button type="button" data-tp="jetzt">jetzt</button></div>
    <div class="tp-head"><span>Von</span><span>Dauer</span><span>Bis</span></div>
    <div class="tp-cols"><div class="tp-col" data-c="von">${von}</div><div class="tp-col tp-dur" data-c="dur">${durs}</div><div class="tp-col" data-c="bis">${bis}</div></div>`;
  const a = m.querySelector(".tp-col[data-c=von] .on") || m.querySelector('.tp-col[data-c=von] [data-v="480"]');
  if (a) a.parentElement.scrollTop = Math.max(0, a.offsetTop - 60);
  const b = m.querySelector(".tp-col[data-c=bis] .on") || m.querySelector(".tp-col[data-c=bis] button");
  if (b) b.parentElement.scrollTop = Math.max(0, b.offsetTop - 60);
  const c = m.querySelector(".tp-col[data-c=dur] .on");
  if (c) c.parentElement.scrollTop = Math.max(0, c.offsetTop - 60);
}
function ztTpSet(text) {
  const inp = ztTp.input; inp.value = text;
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  ztTpClose(); inp.focus();
}
function ztTpClick(e) {
  const b = e.target.closest("[data-tp]"); if (!b || !ztTp) return;
  const k = b.dataset.tp, v = Number(b.dataset.v);
  if (k === "jetzt") { ztTp.start = Math.floor(nowMin() / 15) * 15; ztTp.end = null; return ztTpDraw(); }
  if (k === "von") { ztTp.start = v; ztTp.end = null; ztTp.input.value = hm(v) + "–"; return ztTpDraw(); }
  if (k === "bis") return ztTpSet(`${hm(ztTp.start)}–${hm(v)}`);
  if (k === "dur") {
    if (ztTp.start != null) return ztTpSet(`${hm(ztTp.start)}–${hm(Math.min(24 * 60, ztTp.start + v))}`);
    return ztTpSet(String(v / 60).replace(".", ",") + "h");
  }
}
function ztTpClose() { document.querySelector(".zt-tp")?.remove(); ztTp = null; }
document.addEventListener("click", e => { if (e.target.id === "zqTime" || e.target.id === "zdTime") ztTpOpen(e.target); });
document.addEventListener("focusout", e => { if (ztTp && e.target === ztTp.input) setTimeout(() => { if (ztTp && document.activeElement !== ztTp.input) ztTpClose(); }, 120); });
document.addEventListener("keydown", e => { if (!ztTp && e.key === "ArrowDown" && (e.target.id === "zqTime" || e.target.id === "zdTime")) { e.preventDefault(); return ztTpOpen(e.target); } if (ztTp && (e.key === "Escape" || e.key === "Enter" || e.key === "Tab")) { if (e.key === "Escape") e.stopPropagation(); ztTpClose(); } }, true);
document.addEventListener("scroll", e => { if (ztTp && !e.target.closest?.(".zt-tp")) ztTpClose(); }, true);

// ---------- Dialog Eintrag ----------
let ztDialogCancel = null;
function ztOpenDialog(e, onCancel = null) {
  ztEdit = { ...e, tags: [...(e.tags || [])] };
  ztDialogCancel = onCancel;
  const dur = e.start == null ? durOf(e) : null;
  $("zdTitle").textContent = e.id ? "Eintrag bearbeiten" : "Neuer Eintrag";
  $("zdProject").innerHTML = projectOptions(e.project);
  $("zdDate").value = e.date || todayKey();
  $("zdTime").value = e.start != null ? `${hhmm(e.start)}–${hhmm(e.end ?? e.start + 60)}` : (dur ? String(Math.round(dur / 6) / 10).replace(".", ",") + "h" : "");
  $("zdNote").value = e.note || "";
  ztDrawDialogTask(e.project);
  $("zdDelete").hidden = !e.id;
  ztDrawDialogLp(); ztDrawDialogTags();
  $("ztDialog").showModal();
  $("zdProject").focus();
}
function ztDrawDialogTask(pid) {
  const wrap = $("zdTaskWrap"); if (!wrap) return;
  wrap.hidden = !zdb.hasTask || typeof agdb === "undefined";
  if (wrap.hidden) return;
  const list = agdb.tasks.filter(t => t.id === ztEdit.task || (!agDone(t) && (!pid || t.project === pid)));
  const kind = t => agIsTask(t) ? "Aufgabe" : agInPlan(t) ? "Plan" : "Notiz";
  $("zdTask").innerHTML = `<option value="">kein Eintrag</option>` + list.map(t => `<option value="${t.id}" ${t.id === ztEdit.task ? "selected" : ""}>${esc(t.title)} · ${kind(t)}${agDone(t) ? " (erledigt)" : ""}</option>`).join("");
}
function ztDrawDialogLp() {
  $("zdLp").innerHTML = LPH.slice(1).map((n, i) => `<button type="button" data-lp="${i + 1}" class="${ztEdit.lp === i + 1 ? "on" : ""}" title="${n}">${i + 1}</button>`).join("");
  $("zdLpName").textContent = ztEdit.lp ? `LP ${ztEdit.lp} · ${LPH[ztEdit.lp]}` : "Keine Leistungsphase gewählt";
}
function ztDrawDialogTags() {
  const act = zdb.tags.filter(t => t.active || ztEdit.tags.includes(t.id));
  const many = act.length > 12;
  const show = many ? act.filter(t => ztEdit.tags.includes(t.id)) : act;
  $("zdTags").innerHTML = show.map(t => `<button type="button" class="ztag ${ztEdit.tags.includes(t.id) ? "on" : "off"}" data-dtag="${t.id}" style="--tc:${esc(t.color)}">${esc(t.name)}</button>`).join("")
    + `<button type="button" class="zt-addtag" id="zdTagMore">${many ? "+ Tag wählen" : "+ Tag"}</button>`;
}
async function ztSaveDialog(ev) {
  ev?.preventDefault();
  const project = Number($("zdProject").value) || null;
  if (!project) return toast("Bitte ein Projekt wählen.");
  const t = parseTimeInput($("zdTime").value);
  if (!t) return toast("Zeit bitte als 13–14:30 oder als Dauer wie 1,5h eingeben.");
  const x = { ...ztEdit, project, date: $("zdDate").value || todayKey(), note: $("zdNote").value, ...t, running: false };
  if ($("zdTaskWrap") && !$("zdTaskWrap").hidden) x.task = Number($("zdTask").value) || null;
  const f = entryFields(x);
  if (!x.id) f.Person = ztPerson();
  $("ztDialog").close();
  ztDialogCancel = null;
  await apply([x.id ? ["UpdateRecord", ZT.entries, x.id, f] : ["AddRecord", ZT.entries, null, f]], { refresh: false });
  await ztFetch(); ztRender();
}
async function ztDeleteEntry() {
  if (!ztEdit?.id || !confirm("Diesen Eintrag löschen?")) return;
  $("ztDialog").close();
  await apply([["RemoveRecord", ZT.entries, ztEdit.id]], { refresh: false });
  await ztFetch(); ztRender();
}

// ---------- Auswertung ----------
function ztStatsData() {
  const { from, to } = ztRange();
  const f = ztFilter;
  return zdb.entries.filter(e => e.date >= from && e.date <= to
    && (!f.project || e.project === Number(f.project))
    && (!f.person || (e.person || "–") === f.person)
    && (!f.tag || (f.tag === "none" ? !e.tags.length : e.tags.includes(Number(f.tag)))));
}
function ztStatsHtml() {
  const { from, to } = ztRange();
  const list = ztStatsData();
  const total = list.reduce((s, e) => s + durOf(e), 0);
  const nDays = Math.round((keyDate(to) - keyDate(from)) / 864e5) + 1;
  const workDays = [...new Set(list.map(e => e.date))].length;
  const weeks = nDays / 7, soll = ztSoll() * Math.max(1, Math.round(weeks * 10) / 10);
  const byP = {}, byL = {}, byT = {}, mx = {};
  for (const e of list) {
    const d = durOf(e);
    byP[e.project] = (byP[e.project] || 0) + d;
    byL[e.lp || 0] = (byL[e.lp || 0] || 0) + d;
    const ts = e.tags.length ? e.tags : [0];
    ts.forEach(t => { byT[t] = (byT[t] || 0) + d / ts.length; });
    (mx[e.project] = mx[e.project] || {})[e.lp || 0] = (mx[e.project][e.lp || 0] || 0) + d;
  }
  const topP = Object.entries(byP).sort((a, b) => b[1] - a[1])[0];
  const persons = [...new Set(zdb.entries.map(e => e.person || "–"))].sort();
  const periodBtn = (k, l) => `<button type="button" data-zperiod="${k}" class="${ztPeriod === k ? "on" : ""}">${l}</button>`;

  const bar = `<div class="zst-bar">
    <div class="seg zst-period">${periodBtn("week", "Woche")}${periodBtn("month", "Monat")}${periodBtn("quarter", "Quartal")}${periodBtn("year", "Jahr")}${periodBtn("free", "Frei")}</div>
    ${ztPeriod === "free" ? `<input type="date" class="zf zf-date" id="zsFrom" value="${from}"><span class="muted">bis</span><input type="date" class="zf zf-date" id="zsTo" value="${to}">` : ""}
    <select class="zf" id="zsProject">${projectOptions(Number(ztFilter.project) || null, { all: true })}</select>
    <select class="zf" id="zsPerson"><option value="">Alle Personen</option>${persons.map(p => `<option ${ztFilter.person === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
    <select class="zf" id="zsTag"><option value="">Alle Tätigkeiten</option>${zdb.tags.map(t => `<option value="${t.id}" ${String(t.id) === ztFilter.tag ? "selected" : ""}>${esc(t.name)}</option>`).join("")}<option value="none" ${ztFilter.tag === "none" ? "selected" : ""}>Ohne Tag</option></select>
    <span class="spacer"></span>
    <button type="button" class="btn btn-ghost" id="zsPdf">Stundenliste PDF</button>
    <button type="button" class="btn btn-ghost" id="zsXlsx">Export Excel</button>
  </div>`;
  const kpis = `<div class="kpis zst-kpis">
    <div class="kpi"><small>Stunden</small><b>${hrs(total)}</b><div class="meter"><i style="width:${Math.min(100, total / 60 / soll * 100)}%"></i></div><i>von ${String(Math.round(soll * 10) / 10).replace(".", ",")} h Soll</i></div>
    <div class="kpi"><small>Ø pro Arbeitstag</small><b>${workDays ? hrs(total / workDays) : "–"}</b><i>${workDays} ${workDays === 1 ? "Tag" : "Tage"} mit Einträgen</i></div>
    <div class="kpi"><small>Projekte</small><b>${Object.keys(byP).length}</b><i>${topP ? "meiste Zeit: " + esc(projLabel(Number(topP[0]))) : "–"}</i></div>
    <div class="kpi"><small>Einträge</small><b>${list.length}</b><i>${list.some(e => e.running) ? "davon 1 läuft" : "&nbsp;"}</i></div>
    <div class="kpi"><small>Ohne Tag</small><b>${list.filter(e => !e.tags.length).length}</b><i>${list.filter(e => !e.lp).length} ohne Leistungsphase</i></div>
  </div>`;
  if (!list.length) return bar + kpis + `<div class="zt-empty">Keine Einträge im gewählten Zeitraum.</div>`;

  // Balken: Tage (bis 31 Tage) oder Wochen/Monate
  const buckets = [];
  if (nDays <= 31) for (let i = 0; i < nDays; i++) { const k = addDays(from, i); buckets.push({ key: k, from: k, to: k, label: nDays <= 7 ? `${WD[keyDate(k).getUTCDay()]} ${keyDate(k).getUTCDate()}.` : String(keyDate(k).getUTCDate()), soll: ztSoll() / 5, we: [0, 6].includes(keyDate(k).getUTCDay()) }); }
  else if (nDays <= 120) { let k = weekStart(from); while (k <= to) { buckets.push({ key: k, from: k, to: addDays(k, 6), label: "KW " + isoWeek(k), soll: ztSoll() }); k = addDays(k, 7); } }
  else { const d = keyDate(from); d.setUTCDate(1); while (dateKey(d) <= to) { const a = dateKey(d); const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); buckets.push({ key: a, from: a, to: dateKey(e), label: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"][d.getUTCMonth()], soll: ztSoll() * 4.33 }); d.setUTCMonth(d.getUTCMonth() + 1); } }
  const pids = Object.keys(byP).map(Number).sort((a, b) => byP[b] - byP[a]);
  buckets.forEach(b => { b.by = {}; b.sum = 0; list.filter(e => e.date >= b.from && e.date <= b.to).forEach(e => { const d = durOf(e); b.by[e.project] = (b.by[e.project] || 0) + d; b.sum += d; }); });
  const maxV = Math.max(buckets[0].soll, ...buckets.map(b => b.sum / 60)) * 1.12;
  const step = maxV > 120 ? 40 : maxV > 60 ? 20 : maxV > 24 ? 10 : maxV > 12 ? 4 : 2;
  const H = 240, sollLine = buckets[0].soll;
  let grid = "";
  for (let v = 0; v <= maxV; v += step) grid += `<div class="yl" style="bottom:${22 + v / maxV * H}px"><span>${v} h</span></div>`;
  grid += `<div class="yl soll" style="bottom:${22 + sollLine / maxV * H}px"><span>Soll</span></div>`;
  const colsHtml = buckets.map(b => {
    const segs = pids.filter(p => b.by[p]).map(p => `<i style="height:${b.by[p] / 60 / maxV * H}px;background:${projColor(p)}"></i>`).join("");
    const tip = `<b>${esc(b.label)} · ${hrs(b.sum)}</b>` + pids.filter(p => b.by[p]).map(p => `<div class="r"><span><i class="pdot" style="background:${projColor(p)}"></i>${esc(projLabel(p))}</span>${hrs(b.by[p])}</div>`).join("");
    return `<div class="zcol ${b.we ? "we" : ""}" data-tip="${esc(tip)}">${segs}${b.sum && buckets.length <= 16 ? `<span class="tot" style="bottom:${b.sum / 60 / maxV * H + 4}px">${hrs(b.sum).replace(" h", "")}</span>` : ""}<span class="x">${esc(b.label)}</span></div>`;
  }).join("");
  const chart = `<div class="card zst-card"><h4>Stunden pro ${nDays <= 31 ? "Tag" : nDays <= 120 ? "Woche" : "Monat"}</h4><div class="sub">nach Projekt, gestrichelt: Soll ${String(Math.round(sollLine * 10) / 10).replace(".", ",")} h</div>
    ${pids.length > 1 ? `<div class="zleg">${pids.map(p => `<span><i class="pdot" style="background:${projColor(p)}"></i>${esc(projLabel(p))}</span>`).join("")}</div>` : ""}
    <div class="zchart" style="height:${H + 30}px;grid-template-columns:34px repeat(${buckets.length},minmax(0,1fr))">${grid}<div></div>${colsHtml}<div class="ztip" hidden></div></div></div>`;

  const maxL = Math.max(...Object.values(byL));
  const lpRows = [...Array(9)].map((_, i) => i + 1).map(k => { const v = byL[k] || 0; return `<div class="zlph ${v ? "" : "z"}"><span class="n">LP ${k}</span><span class="nm">${LPH[k]}</span><span class="track"><i style="width:${v / maxL * 100}%"></i></span><span class="v">${v ? hrs(v) : "–"}</span></div>`; }).join("")
    + (byL[0] ? `<div class="zlph"><span class="n">–</span><span class="nm">ohne Leistungsphase</span><span class="track"><i style="width:${byL[0] / maxL * 100}%"></i></span><span class="v">${hrs(byL[0])}</span></div>` : "");
  const tE = Object.entries(byT).sort((a, b) => b[1] - a[1]), maxT = Math.max(...tE.map(x => x[1]));
  const tagRows = tE.map(([k, v]) => { const t = tagById(Number(k)); return `<div class="zhb"><span class="l">${t ? tagChip(t.id) : '<span class="muted">ohne Tag</span>'}</span><span class="v">${hrs(v)}</span><span class="track"><i style="width:${v / maxT * 100}%;background:${t ? esc(t.color) : "#a1a1aa"}"></i></span></div>`; }).join("");
  const side = `<div class="card zst-card"><h4>Nach Leistungsphase</h4><div class="sub">LP 1–9 nach HOAI</div>${lpRows}
    <h4 style="margin-top:16px">Nach Tätigkeit</h4><div class="sub">Einträge mit mehreren Tags zählen anteilig</div>${tagRows}</div>`;

  const shade = v => !v ? "" : v < 90 ? "#f4f4f5" : v < 180 ? "#d4d4d8" : v < 300 ? "#a1a1aa" : v < 480 ? "#71717a" : "#3f3f46";
  const ink = v => v >= 300 ? "#fff" : "#18181b";
  const colT = {};
  let mxHtml = `<tr><th>Projekt</th>${[...Array(9)].map((_, i) => `<th title="${LPH[i + 1]}">LP ${i + 1}</th>`).join("")}${byL[0] ? "<th>ohne</th>" : ""}<th>Summe</th></tr>`;
  for (const p of pids) {
    let s = 0;
    mxHtml += `<tr><td class="nm"><i class="pdot" style="background:${projColor(p)}"></i> ${esc(projLabel(p))}</td>`;
    for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 9, ...(byL[0] ? [0] : [])]) {
      const v = mx[p]?.[k] || 0; s += v; colT[k] = (colT[k] || 0) + v;
      mxHtml += v ? `<td style="background:${shade(v)};color:${ink(v)}" title="${hrs(v)}">${hrs(v).replace(" h", "")}</td>` : `<td class="z">·</td>`;
    }
    mxHtml += `<td class="sum">${hrs(s)}</td></tr>`;
  }
  mxHtml += `<tr class="tot"><td class="nm">Summe</td>${[1, 2, 3, 4, 5, 6, 7, 8, 9, ...(byL[0] ? [0] : [])].map(k => `<td>${colT[k] ? hrs(colT[k]).replace(" h", "") : '<span class="z">–</span>'}</td>`).join("")}<td class="sum">${hrs(total)}</td></tr>`;
  const matrix = `<div class="card zst-card"><h4>Projekt × Leistungsphase</h4><div class="sub">Stunden je Projekt und LP. Dunkler = mehr Stunden.</div><div class="zmx-wrap"><table class="zmx">${mxHtml}</table></div></div>`;

  return bar + kpis + `<div class="zst-grid">${chart}${side}</div>` + matrix;
}

// ---------- Export Excel ----------
function ztExportXlsx() {
  const list = ztStatsData().sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? 0) - (b.start ?? 0));
  if (!list.length) return toast("Keine Einträge im gewählten Zeitraum.");
  const { from, to } = ztRange();
  const H = XS.head, rowsX = [];
  rowsX.push([{ v: "Zeiterfassung", s: XS.h1 }]);
  rowsX.push([{ v: `Zeitraum ${fmtDE(from)} – ${fmtDE(to)}${ztFilter.project ? " · " + projLabel(Number(ztFilter.project)) : ""}${ztFilter.person ? " · " + ztFilter.person : ""}`, s: XS.sub }]);
  rowsX.push([]);
  rowsX.push(["Datum", "von", "bis", "Dauer h", "Projekt-Nr.", "Projekt", "LP", "Tags", "Beschreibung", "Person"].map(v => ({ v, s: H })));
  const first = rowsX.length + 1;
  for (const e of list) {
    rowsX.push([
      { v: fmtDE(e.date) }, { v: e.start != null ? hhmm(e.start) : "" }, { v: e.end != null ? hhmm(e.end) : "" },
      { v: Math.round(durOf(e) / 60 * 100) / 100, s: XS.money }, { v: projNr(e.project) }, { v: projLabel(e.project) },
      e.lp ? { v: e.lp, s: XS.center } : { v: "" }, { v: e.tags.map(t => tagById(t)?.name).filter(Boolean).join(", ") },
      { v: e.note, s: XS.wrap }, { v: e.person }
    ]);
  }
  const last = rowsX.length;
  rowsX.push([{ v: "Summe", s: XS.bold }, null, null, { f: `SUM(D${first}:D${last})`, v: Math.round(list.reduce((s, e) => s + durOf(e), 0) / 60 * 100) / 100, s: XS.moneyB }]);
  const name = `Zeiterfassung_${from}_${to}.xlsx`;
  const xml = sheetXml(rowsX, { cols: [11, 7, 7, 9, 11, 26, 5, 22, 48, 14], freeze: 4, landscape: true, footer: "Zeiterfassung " + fmtDE(from) + " – " + fmtDE(to) });
  downloadBlob(buildWorkbook([{ name: "Zeiterfassung", xml }]), name);
  toast(`„${name}“ heruntergeladen.`);
}

// ---------- Stundenliste PDF ----------
function ztPrintTimesheet() {
  const list = ztStatsData().filter(e => !e.running);
  if (!list.length) return toast("Keine abgeschlossenen Einträge im gewählten Zeitraum.");
  const w = window.open("", "_blank");
  if (!w) return toast("Bitte Pop-ups für dieses Widget erlauben.");
  w.document.open();
  w.document.write(buildTimesheetHtml(list));
  w.document.close();
}

function buildTimesheetHtml(list) {
  const { from, to } = ztRange();
  const rowsS = list.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? 0) - (b.start ?? 0));
  const pids = [...new Set(rowsS.map(e => e.project))];
  const multi = pids.length > 1;
  const pr = multi ? null : projById(pids[0]);
  const fmtDur = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m) % 60).padStart(2, "0")} h`;
  let total = 0;
  const body = rowsS.map(e => {
    const d = durOf(e); total += d;
    return `<tr><td>${fmtDEs(e.date)}</td><td>${e.start != null ? hhmm(e.start) : ""}</td><td>${e.end != null ? hhmm(e.end) : ""}</td><td class="r">${fmtDur(d)}</td><td>${e.lp || ""}</td>${multi ? `<td>${esc(projNr(e.project) || projLabel(e.project))}</td>` : ""}<td>${esc(e.note)}</td></tr>`;
  }).join("");
  const stamp = new Date().toLocaleDateString("de-DE");
  const pagedSrc = new URL("vendor/paged.polyfill.min.js", location.href).href;
  const logo = settings.logo || "";
  const meta = multi
    ? `<tr><td>Projekte</td><td>${pids.map(p => esc(projNr(p) || projLabel(p))).join(", ")}</td></tr>`
    : `<tr><td>Projekt</td><td>${esc(pr?.Projektname || "")}</td></tr><tr><td>Projekt-Nr.</td><td>${esc(pr?.Projektnummer || "")}</td></tr>`;
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Stundenliste ${esc(pr?.Projektnummer || "")} ${fmtDE(from)}–${fmtDE(to)}</title><style>
  @page { size: A4; margin: 20mm 20mm 28mm 20.5mm;
    @bottom-left { content: "Seite " counter(page) " von " counter(pages) "  ·  erstellt am ${stamp}"; vertical-align: bottom; padding-bottom: 16.6mm; font: 300 7.5pt "Family", "Iowan Old Style", Charter, Georgia, serif; color: #8a8a8a; width: 69mm; }
    @bottom-right { content: element(logo); vertical-align: bottom; text-align: right; padding-bottom: 16.35mm; width: 100mm; } }
  html { font: 300 9pt/1.32 "Family", "Iowan Old Style", Charter, Georgia, serif; color: #111; }
  body { margin: 0; }
  .logo-run { position: running(logo); text-align: right; line-height: 0; }
  .logo-run img { height: 4.66mm; width: auto; max-width: 80mm; display: inline-block; }
  h1 { font-weight: 500; font-size: 10.5pt; margin: 0 0 9mm; }
  .meta { border-collapse: collapse; margin-bottom: 8.5mm; font-size: 10pt; }
  .meta td { padding: 0 0 1.1mm; vertical-align: top; }
  .meta td:first-child { width: 33mm; }
  table.t { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .t th { font-weight: 300; font-size: 10pt; text-align: left; padding: 0 0 1.4mm; border-bottom: .6pt solid #111; }
  .t tbody tr:first-child td { padding-top: 4.2mm; }
  .t td { padding: 0 0 1.5mm; vertical-align: top; }
  .t tr { break-inside: avoid; }
  .t.pb { break-before: page; }
  .t .r { text-align: right; padding-right: 4mm; }
  .sum { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 2.5mm; border-top: .6pt solid #111; break-inside: avoid; }
  .sum td { padding: 1.8mm 0 0; font-weight: 400; }
  .sum .r { text-align: right; padding-right: 4mm; }
  </style></head><body>
  ${logo ? `<div class="logo-run"><img src="${logo}" alt=""></div>` : ""}
  <h1>Stundenliste</h1>
  <table class="meta">${meta}<tr><td>Zeitraum</td><td>${fmtDE(from)} – ${fmtDE(to)}</td></tr>${ztFilter.person ? `<tr><td>Bearbeitung</td><td>${esc(ztFilter.person)}</td></tr>` : ""}</table>
  <table class="t">
    <colgroup><col style="width:16.5mm"><col style="width:11mm"><col style="width:11mm"><col style="width:15.5mm"><col style="width:9mm">${multi ? '<col style="width:20mm">' : ""}<col></colgroup>
    <thead><tr><th>Datum</th><th>von</th><th>bis</th><th class="r">Dauer</th><th>LP</th>${multi ? "<th>Projekt</th>" : ""}<th>Beschreibung</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <table class="sum"><colgroup><col style="width:38.5mm"><col style="width:15.5mm"><col></colgroup>
    <tr><td>Summe</td><td class="r">${fmtDur(total)}</td><td></td></tr></table>
<script>
  // Tabelle vorab auf Seiten aufteilen, damit der Tabellenkopf auf jeder Seite steht
  function splitTable() {
    const mm = v => v * 96 / 25.4, t = document.querySelector("table.t");
    if (!t) return;
    document.body.style.width = "169.5mm";
    const rows = [...t.tBodies[0].rows], head = t.tHead.getBoundingClientRect().height;
    const first = t.getBoundingClientRect().top - document.body.getBoundingClientRect().top;
    const avail = mm(297 - 20 - 28) - mm(6);
    const groups = [[]]; let used = first + head;
    for (const r of rows) {
      const h = r.getBoundingClientRect().height;
      if (used + h > avail && groups[groups.length - 1].length) { groups.push([]); used = head + mm(4.2); }
      groups[groups.length - 1].push(r); used += h;
    }
    document.body.style.width = "";
    let prev = t;
    for (const g of groups.slice(1)) {
      const n = t.cloneNode(false); n.append(t.querySelector("colgroup").cloneNode(true), t.tHead.cloneNode(true));
      const tb = document.createElement("tbody"); g.forEach(r => tb.appendChild(r)); n.appendChild(tb);
      n.classList.add("pb"); prev.after(n); prev = n;
    }
  }
  let printed = false;
  const go = () => { if (!printed) { printed = true; setTimeout(() => window.print(), 300); } };
  window.PagedConfig = { auto: true, before: splitTable, after: go };
  setTimeout(() => { if (!window.PagedPolyfill) go(); }, 6000);
<\/script>
<script src="${pagedSrc}" onerror="go()"><\/script>
</body></html>`;
}

// ---------- Einstellungen Zeiterfassung (Name, Soll, Tags) ----------
let ztTagDraft = [];
function ztOpenSetup() {
  $("zsName").value = ztPerson();
  $("zsSoll").value = String(ztSoll()).replace(".", ",");
  ztTagDraft = zdb.tags.map(t => ({ ...t }));
  ztDrawTagDraft();
  $("ztSetupDialog").showModal();
}
function ztDrawTagDraft() {
  $("zsTags").innerHTML = ztTagDraft.filter(t => !t.del).map((t, i) => `<div class="ztr" data-i="${ztTagDraft.indexOf(t)}">
    <input type="color" value="${esc(t.color)}" data-k="color" title="Farbe">
    <input type="text" value="${esc(t.name)}" data-k="name" placeholder="Name">
    <input type="text" value="${esc(t.desc)}" data-k="desc" placeholder="Beschreibung (optional)">
    <label class="act" title="Aktiv (in der Auswahl sichtbar)"><input type="checkbox" data-k="active" ${t.active ? "checked" : ""}>aktiv</label>
    <button type="button" class="x" data-del title="Löschen">✕</button></div>`).join("") || `<div class="muted">Noch keine Tags.</div>`;
}
async function ztSaveSetup(ev) {
  ev.preventDefault();
  localStorage.setItem("lv-zeit-person", $("zsName").value.trim());
  const soll = parseDe($("zsSoll").value) || 40;
  const actions = [];
  for (const t of ztTagDraft) {
    const f = { Name: t.name.trim(), Farbe: t.color, Beschreibung: t.desc, Aktiv: !!t.active };
    if (t.del && t.id) actions.push(["RemoveRecord", ZT.tags, t.id]);
    else if (!t.del && !t.id && f.Name) actions.push(["AddRecord", ZT.tags, null, f]);
    else if (!t.del && t.id) {
      const o = tagById(t.id);
      if (o && (o.name !== f.Name || o.color !== f.Farbe || o.desc !== f.Beschreibung || o.active !== f.Aktiv)) actions.push(["UpdateRecord", ZT.tags, t.id, f]);
    }
  }
  $("ztSetupDialog").close();
  if (actions.length) await apply(actions, { refresh: false });
  if (soll !== num(settings.soll)) {
    settings = { ...settings, soll };
    try { await grist.widgetApi.setOptions(settings); } catch (e) { /* nur für diese Sitzung */ }
  }
  await ztFetch(); ztRender();
  toast("Zeiterfassung gespeichert.");
}

// ------------------------------------------------------
// Ereignisse
// ------------------------------------------------------
function ztBind() {
  $("ztTabs").addEventListener("click", e => { const b = e.target.closest("[data-zt]"); if (b) { if (ztTab === "list") ztReadQuick(); ztTab = b.dataset.zt; ztRender(); } });
  $("ztPrev").addEventListener("click", () => ztShift(-1));
  $("ztNext").addEventListener("click", () => ztShift(1));
  $("ztToday").addEventListener("click", () => { ztAnchor = todayKey(); ztDay = null; ztRender(); });
  $("ztInstall").addEventListener("click", ztInstall);
  $("ztSetup").addEventListener("click", ztOpenSetup);
  $("ztTimer").addEventListener("click", e => { if (e.target.closest("#ztStop")) ztStopTimer(); });

  const body = $("ztBody");
  body.addEventListener("click", e => {
    const dn = e.target.closest("[data-ztday]");
    if (dn) {
      ztReadQuick();
      ztDayNav(Number(dn.dataset.ztday));
      return ztRender();
    }
    const dh = e.target.closest(".zdh[data-day]");
    if (dh) { ztDay = dh.dataset.day; return ztRender(); }
    const t = e.target;
    if (t.closest("#zqAdd")) return ztAddQuick();
    if (t.closest("#zqTimer")) return ztStartTimer();
    const pick = t.closest("[data-zqtask]");
    if (pick) { e.preventDefault(); return ztAcPick(Number(pick.dataset.zqtask)); }
    if (t.closest("[data-zqnew]")) { e.preventDefault(); return ztAcNew(); }
    if (t.closest("[data-zqnone]")) { $("zqAc").hidden = true; return $("zqTime")?.focus(); }
    if (t.closest("#zqTaskX")) { ztReadQuick(); ztQuick.task = null; ztQuick.closeTask = false; return ztRender(); }
    if (t.closest("#zqTagBtn")) { ztReadQuick(); return ztTagMenu(t.closest("#zqTagBtn"), ztQuick.tags, () => ztRender()); }
    const qt = t.closest("[data-qtag]");
    if (qt) { ztReadQuick(); ztQuick.tags = ztQuick.tags.filter(x => x !== Number(qt.dataset.qtag)); return ztRender(); }
    const p = t.closest("[data-zperiod]");
    if (p) { ztPeriod = p.dataset.zperiod; return ztRender(); }
    if (t.closest("#zsPdf")) return ztPrintTimesheet();
    if (t.closest("#zsXlsx")) return ztExportXlsx();
    const row = t.closest(".zr[data-zentry], .chip[data-zentry]");
    if (row) {
      const en = zdb.entries.find(x => x.id === Number(row.dataset.zentry));
      if (en && en.running) return toast("Der Eintrag läuft noch. Erst den Timer oben stoppen.");
      if (en) ztOpenDialog(en);
    }
  });
  body.addEventListener("keydown", e => {
    if (ztAcKey(e)) return;
    if (e.key === "Enter" && e.target.closest(".zq") && e.target.tagName !== "BUTTON") { e.preventDefault(); ztAddQuick(); }
  });
  body.addEventListener("change", e => {
    const id = e.target.id;
    if (id === "zsProject") ztFilter.project = e.target.value;
    else if (id === "zsPerson") ztFilter.person = e.target.value;
    else if (id === "zsTag") ztFilter.tag = e.target.value;
    else if (id === "zsFrom" || id === "zsTo") { ztFree = { from: $("zsFrom").value, to: $("zsTo").value }; }
    else return;
    ztRender();
  });
  body.addEventListener("pointerdown", e => { if (ztTab === "cal" || e.target.closest(".zt-daycal")) ztCalPointerDown(e); });
  const side = $("dayside");
  side.addEventListener("pointerdown", e => { if (e.target.closest(".zt-daycal")) ztCalPointerDown(e); });
  side.addEventListener("click", e => {
    const dn = e.target.closest("[data-ztday]");
    if (dn) { if (view === "time") ztReadQuick(); ztDayNav(Number(dn.dataset.ztday)); return ztRender(); }
    const ch = e.target.closest(".chip[data-zentry]");
    if (ch) {
      const en = zdb.entries.find(x => x.id === Number(ch.dataset.zentry));
      if (en && en.running) return toast("Der Eintrag läuft noch. Erst den Timer oben stoppen.");
      if (en) ztOpenDialog({ ...en });
    }
  });
  // Vorschläge aus den Aufgaben im Feld „Was wurde gemacht?“
  body.addEventListener("focusin", e => { if (e.target.id === "zqNote") { ztAcSel = 0; ztAcDraw(); } });
  body.addEventListener("input", e => { if (e.target.id === "zqNote") { ztAcSel = 0; ztAcDraw(); } });
  body.addEventListener("focusout", e => { if (e.target.id === "zqNote") setTimeout(() => { if (document.activeElement?.id !== "zqNote" && $("zqAc")) $("zqAc").hidden = true; }, 150); });
  body.addEventListener("mousedown", e => { if (e.target.closest("#zqAc")) e.preventDefault(); });
  body.addEventListener("mousemove", e => {
    const c = e.target.closest(".zcol"), tip = body.querySelector(".ztip");
    if (!tip) return;
    if (!c) { tip.hidden = true; return; }
    tip.innerHTML = c.dataset.tip; tip.hidden = false;
    const ch = c.parentElement.getBoundingClientRect(), r = c.getBoundingClientRect();
    tip.style.left = Math.min(ch.width - 200, r.right - ch.left + 6) + "px";
    tip.style.top = "8px";
  });

  // Dialog Eintrag
  $("ztForm").addEventListener("submit", ztSaveDialog);
  $("zdCancel").addEventListener("click", () => $("ztDialog").close());
  $("ztDialog").addEventListener("close", () => { if (ztDialogCancel) { ztDialogCancel(); ztDialogCancel = null; } });
  $("zdDelete").addEventListener("click", ztDeleteEntry);
  $("zdProject").addEventListener("change", e => { if (ztEdit) ztDrawDialogTask(Number(e.target.value) || null); });
  $("zdLp").addEventListener("click", e => { const b = e.target.closest("[data-lp]"); if (!b) return; const v = Number(b.dataset.lp); ztEdit.lp = ztEdit.lp === v ? null : v; ztDrawDialogLp(); });
  $("zdTags").addEventListener("click", e => {
    const b = e.target.closest("[data-dtag]");
    if (b) { const id = Number(b.dataset.dtag); ztEdit.tags = ztEdit.tags.includes(id) ? ztEdit.tags.filter(x => x !== id) : [...ztEdit.tags, id]; return ztDrawDialogTags(); }
    if (e.target.closest("#zdTagMore")) ztTagMenu(e.target, ztEdit.tags, ztDrawDialogTags);
  });

  // Dialog Einstellungen
  $("ztSetupForm").addEventListener("submit", ztSaveSetup);
  $("zsCancel").addEventListener("click", () => $("ztSetupDialog").close());
  $("zsAddTag").addEventListener("click", () => { ztTagDraft.push({ id: null, name: "", color: "#71717a", desc: "", active: true }); ztDrawTagDraft(); [...$("zsTags").querySelectorAll('[data-k="name"]')].pop()?.focus(); });
  $("zsTags").addEventListener("input", e => {
    const r = e.target.closest(".ztr"); if (!r) return;
    const t = ztTagDraft[Number(r.dataset.i)], k = e.target.dataset.k;
    if (k) t[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  });
  $("zsTags").addEventListener("click", e => {
    if (!e.target.closest("[data-del]")) return;
    const t = ztTagDraft[Number(e.target.closest(".ztr").dataset.i)];
    const used = t.id && zdb.entries.some(x => x.tags.includes(t.id));
    if (used && !confirm(`„${t.name}“ wird in Einträgen verwendet. Trotzdem löschen? (Tipp: stattdessen „aktiv“ abwählen)`)) return;
    t.del = true; ztDrawTagDraft();
  });
}
ztBind();
// Falls app.js schon geladen hat, bevor diese Datei bereit war
ztFetch().then(() => { if (view === "time") ztRender(); }).catch(e => console.info("Zeiterfassung: Daten nicht lesbar.", e));
