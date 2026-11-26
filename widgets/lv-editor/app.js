// ======================================================
// GRIST LV-EDITOR  ·  Version 2.1 (Layout „Kompakt“)
// Teil des AVA-Systems (Ausschreibung · Vergabe · Abrechnung)
// ======================================================
"use strict";

const VERSION = "2.8.0";

const T = {
  projects: "Projekte",
  lvs: "Leistungsverzeichnisse",
  titles: "Titel",
  positions: "Positionen"
};

// Vollständiges Datenmodell. Fehlende Tabellen und Spalten legt das Widget auf Knopfdruck an.
const ch = list => JSON.stringify({ choices: list });
const EUR = JSON.stringify({ decimals: 2, maxDecimals: 2, numMode: "currency", currency: "EUR" });
const FULL_SCHEMA = [
  { table: T.projects, cols: [
    { id: "Projektnummer", type: "Text" },
    { id: "Projektname", type: "Text" },
    { id: "Bauherr", type: "Text" },
    { id: "Strasse", type: "Text", label: "Straße" },
    { id: "PLZ", type: "Text" },
    { id: "Ort", type: "Text" },
    { id: "Architekt", type: "Text" },
    { id: "Projektstatus", type: "Choice", widgetOptions: ch(["Planung", "Ausschreibung", "Ausführung", "Abgeschlossen"]) }
  ]},
  { table: T.lvs, cols: [
    { id: "LV_Nummer", type: "Text", label: "LV-Nummer" },
    { id: "LV_Bezeichnung", type: "Text", label: "LV-Bezeichnung" },
    { id: "Projekt", type: "Ref:Projekte", show: "Projektname" },
    { id: "Gewerk", type: "Choice", widgetOptions: ch(["Rohbau", "Dach", "Fenster", "Trockenbau", "Estrich", "Fliesen", "Maler", "Elektro", "Sanitär", "Heizung"]) },
    { id: "Bearbeitungsstand", type: "Choice", widgetOptions: ch(["Entwurf", "Prüfung", "Ausschreibung", "Beauftragt"]) },
    { id: "Ausgabe_Datum", type: "Date", label: "Ausgabedatum" },
    { id: "Abgabedatum", type: "Date" },
    { id: "Vorbemerkung", type: "Text", label: "Vorbemerkung (Vortext)" },
    { id: "Nachbemerkung", type: "Text", label: "Nachbemerkung (Nachtext)" },
    { id: "Vorbemerkung_ausblenden", type: "Bool", label: "Vorbemerkung ausblenden" },
    { id: "Nachbemerkung_ausblenden", type: "Bool", label: "Nachbemerkung ausblenden" },
    { id: "Vergabeverfahren", type: "Text" },
    { id: "Angebotsfrist", type: "Text" },
    { id: "Submission", type: "Text" },
    { id: "Zuschlagsfrist", type: "Text" },
    { id: "Ort_Angebotsabgabe", type: "Text", label: "Ort Angebotsabgabe" }
  ]},
  { table: T.titles, cols: [
    { id: "Titelnummer", type: "Text" },
    { id: "Titelbezeichnung", type: "Text" },
    { id: "Leistungsverzeichnis", type: "Ref:Leistungsverzeichnisse", show: "LV_Bezeichnung" },
    { id: "Uebergeordnet", type: "Ref:Titel", label: "Übergeordnet", show: "Titelbezeichnung" },
    { id: "Sortierung", type: "Numeric" },
    { id: "Vorbemerkung", type: "Text", label: "Vorbemerkung (Vortext)" },
    { id: "Nachbemerkung", type: "Text", label: "Nachbemerkung (Nachtext)" },
    { id: "Vorbemerkung_ausblenden", type: "Bool", label: "Vorbemerkung ausblenden" },
    { id: "Nachbemerkung_ausblenden", type: "Bool", label: "Nachbemerkung ausblenden" }
  ]},
  { table: T.positions, cols: [
    { id: "Titel", type: "Ref:Titel", show: "Titelbezeichnung" },
    { id: "Positionsnummer", type: "Text" },
    { id: "Sortierung", type: "Numeric" },
    { id: "Kurztext", type: "Text" },
    { id: "Langtext", type: "Text", widgetOptions: JSON.stringify({ wrap: true }) },
    { id: "Menge", type: "Numeric", widgetOptions: JSON.stringify({ decimals: 3, maxDecimals: 3 }) },
    { id: "Einheit", type: "Choice", widgetOptions: ch(["m", "m2", "m3", "Stk.", "psch", "lfm", "kg", "t", "h", "Wo"]) },
    { id: "Einheitspreis", type: "Numeric", widgetOptions: EUR },
    { id: "Gesamtpreis", type: "Numeric", isFormula: true, formula: "ROUND($Menge * $Einheitspreis, 2)", widgetOptions: EUR },
    { id: "Positionstyp", type: "Choice", widgetOptions: ch(["Normal", "Bedarfsposition", "Eventualposition", "Alternativposition"]) },
    { id: "Aktiv", type: "Bool" },
    { id: "LV", type: "Ref:Leistungsverzeichnisse", isFormula: true, formula: "$Titel.Leistungsverzeichnis", show: "LV_Bezeichnung" }
  ]}
];

const DEFAULT_SETTINGS = {
  planer: "",
  anschrift: "",
  kontakt: "",
  mwst: 19,
  step: 10
};

const DEFAULT_CHOICES = {
  Einheit: ["m", "m2", "m3", "Stk.", "psch", "lfm", "kg", "t", "h", "Wo"],
  Positionstyp: ["Normal", "Bedarfsposition", "Eventualposition", "Alternativposition"],
  Bearbeitungsstand: ["Entwurf", "Prüfung", "Ausschreibung", "Beauftragt"]
};

// Status, ab denen die OZ nicht mehr automatisch umnummeriert wird
const LOCKED_STATES = ["Ausschreibung", "Beauftragt"];

// ------------------------------------------------------
// ZUSTAND
// ------------------------------------------------------
const db = { projects: [], lvs: [], titles: [], positions: [] };
const sel = { projectId: null, lvId: null, nodeId: null, posId: null };
let settings = { ...DEFAULT_SETTINGS };
let choices = { ...DEFAULT_CHOICES };
let missingSchema = [];
let missingTables = [];
let collapsed = new Set();
let view = "edit";
let searchTerm = "";
let editingTitleId = null;
let editingTitleParent = null;

let dirty = false;
let saveTimer = null;
let savingPromise = null;
let refreshTimer = null;
let busy = false;

// ------------------------------------------------------
// HILFSFUNKTIONEN
// ------------------------------------------------------
const $ = id => document.getElementById(id);

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[c]);
}
const br = v => esc(v).replace(/\r?\n/g, "<br>");

function refId(v) {
  if (Array.isArray(v)) return v.length > 1 && v[0] === "R" ? refId(v[2]) : null;
  if (v && typeof v === "object") return refId(v.id ?? v.rowId);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function rows(table) {
  if (!table || !Array.isArray(table.id)) return [];
  const keys = Object.keys(table).filter(k => k !== "id");
  return table.id.map((id, i) => {
    const r = { id };
    for (const k of keys) r[k] = table[k][i];
    return r;
  });
}

// Liest den ersten vorhandenen Spaltennamen (alte und neue Schreibweisen)
function pick(row, ...names) {
  if (!row) return "";
  for (const n of names) if (row[n] !== undefined && row[n] !== null) return row[n];
  return "";
}

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = v => Math.round((num(v) + Number.EPSILON) * 100) / 100;

// Akzeptiert "1.250,50", "1250,5", "12.5"
function parseDe(text) {
  let s = String(text ?? "").trim().replace(/\s|€/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return num(s);
}

const fmtMoney = v => num(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = v => num(v).toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtInput = (v, d) => num(v) === 0 ? "" : num(v).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: d });
const pad = (v, n) => String(v ?? "").trim().padStart(n, "0");

function fmtDate(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return new Date(v * 1000).toLocaleDateString("de-DE");
  return String(v);
}

const isActive = v => v === true || v === 1 || v === "true";

function typeKey(p) {
  const t = String(p.Positionstyp || "").toLowerCase();
  if (t.startsWith("eventual")) return "eventual";
  if (t.startsWith("bedarf")) return "bedarf";
  if (t.startsWith("alternativ") || t.startsWith("wahl")) return "alternativ";
  return "normal";
}
const TYPE_LABEL = { eventual: "Eventual", bedarf: "Bedarf", alternativ: "Alternativ" };

// Zählt die Position in die Summe? (nur aktive Normalpositionen)
const counts = p => isActive(p.Aktiv) && typeKey(p) === "normal";
const lineTotal = p => round2(num(p.Menge) * num(p.Einheitspreis));

// ------------------------------------------------------
// MODELL: PROJEKT / LV / GLIEDERUNG
// ------------------------------------------------------
const project = () => db.projects.find(p => p.id === sel.projectId);
const lv = () => db.lvs.find(l => l.id === sel.lvId);
const title = id => db.titles.find(t => t.id === id);
const position = id => db.positions.find(p => p.id === id);

const lvNr = l => pick(l, "LV_Nummer", "LV-Nummer");
const lvName = l => pick(l, "LV_Bezeichnung", "LV-Bezeichnung");
const lvState = l => pick(l, "Bearbeitungsstand");
const isLocked = () => LOCKED_STATES.includes(lvState(lv()));
const parentOf = t => refId(t?.Uebergeordnet);
const bySort = (a, b) => num(a.Sortierung) - num(b.Sortierung) || a.id - b.id;

function lvTitles() {
  return db.titles.filter(t => refId(t.Leistungsverzeichnis) === sel.lvId);
}

function childrenOf(parentId) {
  return lvTitles()
    .filter(t => (parentOf(t) || null) === (parentId || null))
    .sort(bySort);
}

function positionsOf(nodeId) {
  return db.positions.filter(p => refId(p.Titel) === nodeId).sort(bySort);
}

function ancestors(t) {
  const chain = [];
  let cur = t, guard = 0;
  while (cur && guard++ < 10) {
    chain.unshift(cur);
    cur = title(parentOf(cur));
  }
  return chain;
}

const level = t => ancestors(t).length;
const nodeOz = t => ancestors(t).map(a => pad(a.Titelnummer, 2)).join(".");
const nodeName = t => t?.Titelbezeichnung || "Ohne Bezeichnung";

function nodeTotal(nodeId) {
  let sum = positionsOf(nodeId).filter(counts).reduce((s, p) => s + lineTotal(p), 0);
  for (const c of childrenOf(nodeId)) sum += nodeTotal(c.id);
  return round2(sum);
}

// Untertitel-Summe ist doppelt, wenn der übergeordnete Titel nur diesen einen Untertitel
// und keine eigenen Positionen hat (dann steht dieselbe Summe direkt darunter noch einmal).
function redundantSum(t) {
  const pid = parentOf(t);
  if (!pid) return false;
  return childrenOf(pid).length === 1 && !positionsOf(pid).some(p => isActive(p.Aktiv));
}

const lvTotal = () => round2(childrenOf(null).reduce((s, t) => s + nodeTotal(t.id), 0));

// Alle Knoten in Dokumentreihenfolge
function walk(parentId = null, out = []) {
  for (const t of childrenOf(parentId)) {
    out.push(t);
    walk(t.id, out);
  }
  return out;
}

function makePosOz(node, index) {
  const step = Math.max(1, Math.round(num(settings.step)) || 10);
  return `${nodeOz(node)}.${pad((index + 1) * step, 4)}`;
}

// ------------------------------------------------------
// GRIST: LADEN / SPEICHERN
// ------------------------------------------------------
async function fetchAll() {
  const load = id => grist.docApi.fetchTable(id).catch(() => null);
  const [p, l, t, pos] = await Promise.all([T.projects, T.lvs, T.titles, T.positions].map(load));
  db.projects = rows(p);
  db.lvs = rows(l);
  db.titles = rows(t);
  db.positions = rows(pos);

  const have = { [T.projects]: p, [T.lvs]: l, [T.titles]: t, [T.positions]: pos };
  missingTables = FULL_SCHEMA.filter(d => !have[d.table]).map(d => d.table);
  missingSchema = [];
  for (const d of FULL_SCHEMA) {
    if (!have[d.table]) continue;
    for (const c of d.cols) if (!(c.id in have[d.table])) missingSchema.push({ table: d.table, ...c });
  }
  if (typeof ztFetch === "function") await ztFetch(); // Zeiterfassung (zeit.js)
}

async function loadChoices() {
  try {
    const [tables, cols] = await Promise.all([
      grist.docApi.fetchTable("_grist_Tables"),
      grist.docApi.fetchTable("_grist_Tables_column")
    ]);
    const tableIds = {};
    rows(tables).forEach(t => { tableIds[t.id] = t.tableId; });
    for (const c of rows(cols)) {
      const tid = tableIds[c.parentId];
      const key = (tid === T.positions && (c.colId === "Einheit" || c.colId === "Positionstyp")) ? c.colId
        : (tid === T.lvs && c.colId === "Bearbeitungsstand") ? c.colId : null;
      if (!key || !c.widgetOptions) continue;
      const opts = JSON.parse(c.widgetOptions);
      if (Array.isArray(opts.choices) && opts.choices.length) {
        choices[key] = key === "Einheit"
          ? [...new Set([...opts.choices, ...DEFAULT_CHOICES.Einheit])]
          : opts.choices;
      }
    }
  } catch (e) {
    console.info("Auswahllisten nicht lesbar, Standardwerte werden verwendet.", e);
  }
}

async function apply(actions, { refresh = true } = {}) {
  if (!actions.length) return null;
  status("Speichern …");
  try {
    const res = await grist.docApi.applyUserActions(actions);
    if (refresh) await fetchAll();
    status("Gespeichert", "ok");
    return res;
  } catch (e) {
    console.error(e);
    status("Fehler", "err");
    toast("Speichern fehlgeschlagen: " + (e.message || e));
    throw e;
  }
}

function newRowId(res) {
  const r = res?.retValues?.[0] ?? (Array.isArray(res) ? res[0] : res);
  return refId(r);
}

// Nummeriert Titel (01, 02 …) und Positionen (01.01.0010 …) des aktuellen LV neu.
// Bei LV-Status "Ausschreibung"/"Beauftragt" bleibt die OZ unverändert.
function renumberActions(force = false) {
  if (isLocked() && !force) return [];
  const actions = [];
  const upd = (table, row, values) => {
    const changed = Object.keys(values).some(k => String(row[k] ?? "") !== String(values[k]));
    if (changed) {
      Object.assign(row, values); // lokal sofort übernehmen, damit OZ der Kinder stimmt
      actions.push(["UpdateRecord", table, row.id, values]);
    }
  };
  const visit = parentId => {
    childrenOf(parentId).forEach((t, i) => {
      upd(T.titles, t, { Titelnummer: pad(i + 1, 2), Sortierung: i + 1 });
    });
    childrenOf(parentId).forEach(t => {
      positionsOf(t.id).forEach((p, i) => {
        upd(T.positions, p, { Positionsnummer: makePosOz(t, i), Sortierung: i + 1 });
      });
      visit(t.id);
    });
  };
  visit(null);
  return actions;
}

// Freie OZ zwischen zwei Positionen (für gesperrte LVs)
function lockedOz(node, before, after) {
  const step = Math.max(1, Math.round(num(settings.step)) || 10);
  const tail = p => num(String(p?.Positionsnummer || "").split(".").pop());
  const a = before ? tail(before) : 0;
  const b = after ? tail(after) : a + 2 * step;
  const n = after ? Math.floor((a + b) / 2) : a + step;
  if (n <= a || n >= b) return null;
  return `${nodeOz(node)}.${pad(n, 4)}`;
}

// ------------------------------------------------------
// AKTUALISIERUNG
// ------------------------------------------------------
async function refresh({ quiet = false } = {}) {
  if (busy) return;
  if (dirty || savingPromise || txDirty || txSaving) return; // Eingaben nicht überschreiben
  busy = true;
  try {
    if (!quiet) status("Laden …");
    await fetchAll();
    validateSelection();
    renderAll();
    if (!quiet) status("Bereit");
  } catch (e) {
    console.error(e);
    status("Fehler", "err");
    toast("Die Grist-Daten konnten nicht geladen werden. Hat das Widget vollen Dokumentzugriff?");
  } finally {
    busy = false;
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refresh({ quiet: true }), 400);
}

function validateSelection() {
  if (!db.projects.some(p => p.id === sel.projectId)) {
    const stored = refId(localStorage.getItem("lv.project"));
    sel.projectId = db.projects.some(p => p.id === stored) ? stored : (db.projects[0]?.id ?? null);
  }
  const lvsOfProject = db.lvs.filter(l => refId(l.Projekt) === sel.projectId);
  if (!lvsOfProject.some(l => l.id === sel.lvId)) {
    const stored = refId(localStorage.getItem("lv.lv"));
    sel.lvId = lvsOfProject.some(l => l.id === stored) ? stored : (lvsOfProject[0]?.id ?? null);
    collapsed = new Set();
  }
  if (sel.nodeId && !lvTitles().some(t => t.id === sel.nodeId)) sel.nodeId = null;
  if (!sel.nodeId) {
    const first = walk().find(t => positionsOf(t.id).length) || walk()[0];
    sel.nodeId = first?.id ?? null;
  }
  if (sel.posId && !position(sel.posId)) sel.posId = null;
}

// ------------------------------------------------------
// TEXTE: Vor- und Nachbemerkungen (Reiter „Texte“)
// ------------------------------------------------------
const TEXT_PARTS = ["Vorbemerkung", "Nachbemerkung"];
const textOf = (row, part) => String((row && row[part]) || "");
const textOn = (row, part) => !!textOf(row, part).trim() && !isActive(row?.[part + "_ausblenden"]);
let textSel = { kind: "lv", id: null, part: "Vorbemerkung" };
let txDirty = false;
let txTimer = null;
let txSaving = null;

function textRow(sel2 = textSel) {
  return sel2.kind === "lv" ? lv() : title(sel2.id);
}

function textState(row, part) {
  if (!textOf(row, part).trim()) return "empty";
  return isActive(row?.[part + "_ausblenden"]) ? "off" : "full";
}

function textSlots() {
  const l = lv();
  if (!l) return [];
  const out = TEXT_PARTS.map(part => ({ kind: "lv", id: l.id, part, row: l }));
  for (const t of walk()) TEXT_PARTS.forEach(part => out.push({ kind: "node", id: t.id, part, row: t }));
  return out;
}

function renderTexts() {
  const el = $("textSlots");
  const l = lv();
  if (!l) {
    el.innerHTML = '<div class="empty"><b>Kein LV gewählt</b></div>';
    $("textEditor").hidden = true;
    return;
  }
  $("textEditor").hidden = false;
  if (textSel.kind === "node" && !title(textSel.id)) textSel = { kind: "lv", id: l.id, part: "Vorbemerkung" };
  textSel.id = textSel.kind === "lv" ? l.id : textSel.id;

  const hit = (row, part, label) => !searchTerm || `${label} ${textOf(row, part)}`.toLowerCase().includes(searchTerm);
  const slot = (kind, row, part, cls = "") => {
    const st = textState(row, part);
    const on = textSel.kind === kind && textSel.id === row.id && textSel.part === part;
    const extra = st === "off" ? "aus" : st === "full" ? `${textOf(row, part).trim().split(/\n+/).length} Abs.` : "";
    return `<button class="slot ${cls} ${on ? "on" : ""}" data-slot="${kind}:${row.id}:${part}">
      <i class="st s-${st}"></i>${kind === "lv" ? part + "en" : part}<span class="x">${extra}</span></button>`;
  };
  const html = ['<div class="sh">Leistungsverzeichnis</div>'];
  TEXT_PARTS.forEach(part => { if (hit(l, part, "LV")) html.push(slot("lv", l, part)); });
  const nodes = walk();
  if (nodes.length) html.push('<div class="sh">Titel</div>');
  for (const t of nodes) {
    const lvl = Math.min(level(t), 3);
    const label = `${nodeOz(t)} ${nodeName(t)}`;
    const parts = TEXT_PARTS.filter(part => hit(t, part, label));
    if (!parts.length) continue;
    html.push(`<div class="grp l${lvl}"><span class="oz">${esc(nodeOz(t))}</span><span>${esc(nodeName(t))}</span></div>`);
    parts.forEach(part => html.push(slot("node", t, part, `l${lvl}`)));
  }
  html.push(`<div class="legend"><span><i class="st s-full"></i>an</span><span><i class="st s-off"></i>ausgeschaltet</span><span><i class="st s-empty"></i>leer</span></div>`);
  el.innerHTML = html.join("");
}

function fillTextEditor() {
  const row = textRow();
  if (!row) return;
  const { kind, part } = textSel;
  const l = lv();
  $("txCrumb").innerHTML = kind === "lv"
    ? `Leistungsverzeichnis <span class="oz">${esc(lvNr(l))}</span> ${esc(lvName(l))}`
    : `Titel <span class="oz">${esc(nodeOz(row))}</span> ${esc(nodeName(row))}`;
  $("txTitle").textContent = kind === "lv" ? part + "en" : part;
  $("txPart").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.part === part));
  const ta = $("txText");
  ta.value = textOf(row, part);
  ta.disabled = !(part in row);
  ta.placeholder = !(part in row)
    ? "Für dieses Feld fehlt noch eine Spalte. Bitte oben im gelben Hinweis „Jetzt anlegen“ klicken."
    : kind === "lv"
      ? (part === "Vorbemerkung"
        ? "Übergreifende Rahmenbedingungen für das ganze LV: Baustellenbedingungen, Zufahrt, Lagerflächen, Arbeitszeiten, Normen, Abrechnung, Nebenleistungen …"
        : "Schlussbestimmungen, z. B. Hinweise zur Angebotsabgabe, Bestätigung der Ortsbesichtigung …")
      : (part === "Vorbemerkung"
        ? "Gilt für alle Positionen dieses Titels, z. B. Ausführungsbedingungen, Materialvorgaben, Abrechnungsregeln …"
        : "Ergänzungen am Ende dieses Titels, z. B. Abrechnungshinweise …");
  const flag = part + "_ausblenden";
  $("txOn").checked = !isActive(row[flag]);
  $("txOn").disabled = !(flag in row);
  $("txHint").textContent = kind === "lv"
    ? (part === "Vorbemerkung" ? "Steht im Druck nach dem Inhaltsverzeichnis, vor dem ersten Titel."
      : "Steht im Druck nach der Preiszusammenfassung (LV-Summe brutto).")
    : (part === "Vorbemerkung" ? "Steht im Druck direkt unter der Titelüberschrift."
      : "Steht im Druck am Ende des Titels, vor der Titelsumme.");
  $("txStatus").textContent = "";
  updateTextCount();
}

function updateTextCount() {
  const n = $("txText").value.length;
  $("txCount").textContent = `${n.toLocaleString("de-DE")} Zeichen`;
}

function renderTextPreview() {
  const el = $("textPreview");
  const row = textRow();
  const l = lv();
  if (!row || !l) { el.innerHTML = ""; return; }
  const { kind, part } = textSel;
  const live = kind === textSel.kind ? $("txText")?.value ?? textOf(row, part) : textOf(row, part);
  const state = !live.trim() ? "empty" : isActive(row[part + "_ausblenden"]) ? "off" : "full";
  const cut = s => s.length > 420 ? s.slice(0, 420) + " …" : s;
  const block = `<div class="pv-text ${state}"><i>${kind === "lv" ? part + "en" : part}</i>${
    state === "empty" ? "(leer)" : br(cut(live))}${state === "off" ? '<em>ausgeschaltet, erscheint nicht im Druck</em>' : ""}</div>`;
  const posLines = list => list.slice(0, 2).map(p => `<div class="pv-pos"><span>${esc(p.Positionsnummer)}</span><span><b>${esc(p.Kurztext)}</b><div class="ln"></div><div class="ln s"></div></span></div>`).join("");
  let body = "";
  if (kind === "lv" && part === "Vorbemerkung") {
    const first = childrenOf(null)[0];
    body = `<div class="pv-h big"><span></span><span>Vorbemerkungen</span></div>${block}
      ${first ? `<div class="pv-h big"><span>${esc(nodeOz(first))}</span><span>${esc(nodeName(first))}</span></div><div class="ln"></div><div class="ln s"></div>` : ""}`;
  } else if (kind === "lv") {
    const net = lvTotal(), vat = round2(net * settings.mwst / 100);
    body = `<div class="pv-h big"><span></span><span>Zusammenstellung</span></div>
      ${childrenOf(null).map(t => `<div class="pv-kv"><span>${esc(nodeOz(t))} ${esc(nodeName(t))}</span><span>${fmtMoney(nodeTotal(t.id))}</span></div>`).join("")}
      <div class="pv-kv b"><span>LV-Summe (netto)</span><span>${fmtMoney(net)} €</span></div>
      <div class="pv-kv b"><span>LV-Summe (brutto)</span><span>${fmtMoney(net + vat)} €</span></div>
      <div class="pv-h"><span></span><span>Nachbemerkungen</span></div>${block}`;
  } else if (part === "Vorbemerkung") {
    const kid = childrenOf(row.id)[0];
    body = `<div class="pv-h big"><span>${esc(nodeOz(row))}</span><span>${esc(nodeName(row))}</span></div>${block}
      ${kid ? `<div class="pv-h"><span>${esc(nodeOz(kid))}</span><span>${esc(nodeName(kid))}</span></div>${posLines(positionsOf(kid.id))}` : posLines(positionsOf(row.id))}`;
  } else {
    const leaf = [row, ...walk(row.id)].filter(t => positionsOf(t.id).length).pop() || row;
    body = `<div class="pv-dots">…</div>${posLines(positionsOf(leaf.id).slice(-2))}${block}
      <div class="pv-sum"><span>Summe ${esc(nodeOz(row))} ${esc(nodeName(row))}</span><span>${fmtMoney(nodeTotal(row.id))}</span></div>`;
  }
  const counts2 = { full: 0, off: 0, empty: 0 };
  textSlots().forEach(s => counts2[textState(s.row, s.part)]++);
  el.innerHTML = `
    <div class="ins-h"><span>Vorschau im Druck</span></div>
    <div class="pv">${body}</div>
    <p class="muted" style="margin:12px 0 4px">Ausgeschaltete Texte bleiben gespeichert, erscheinen aber nicht im Druck und nicht in der Dokumentansicht.</p>
    <div class="kv"><span>Texte aktiv</span><b>${counts2.full}</b></div>
    <div class="kv"><span>ausgeschaltet</span><b>${counts2.off}</b></div>
    <div class="kv"><span>leer</span><b>${counts2.empty}</b></div>`;
}

async function selectText(kind, id, part) {
  await flushText();
  textSel = { kind, id, part };
  renderTexts();
  fillTextEditor();
  renderTextPreview();
}

function onTextInput() {
  txDirty = true;
  $("txStatus").textContent = "Änderungen …";
  updateTextCount();
  renderTextPreview();
  clearTimeout(txTimer);
  txTimer = setTimeout(flushText, 700);
}

async function flushText() {
  clearTimeout(txTimer);
  if (txSaving) await txSaving;
  if (!txDirty) return;
  const row = textRow();
  const { part } = textSel;
  txDirty = false;
  if (!row || !(part in row)) return;
  const table = textSel.kind === "lv" ? T.lvs : T.titles;
  const value = $("txText").value;
  txSaving = (async () => {
    try {
      await apply([["UpdateRecord", table, row.id, { [part]: value }]]);
      $("txStatus").textContent = "Automatisch gespeichert";
      renderTexts();
    } catch (e) {
      txDirty = true;
    } finally {
      txSaving = null;
    }
  })();
  return txSaving;
}

async function toggleText(on) {
  await flushText();
  const row = textRow();
  const flag = textSel.part + "_ausblenden";
  if (!row || !(flag in row)) return;
  await apply([["UpdateRecord", textSel.kind === "lv" ? T.lvs : T.titles, row.id, { [flag]: !on }]]);
  renderTexts();
  renderTextPreview();
}

async function openTexts(kind, id) {
  await flushSave();
  textSel = { kind, id: kind === "lv" ? sel.lvId : id, part: textSel.part || "Vorbemerkung" };
  setView("texts");
}

// ------------------------------------------------------
// PROJEKTÜBERSICHT (Reiter „Projekte“)
// ------------------------------------------------------
let projFilter = "Alle", projSearch = "", projSel = null;
const projStates = () => (choices.Projektstatus && choices.Projektstatus.length) ? choices.Projektstatus : ["Planung", "Ausschreibung", "Ausführung", "Abgeschlossen"];
const projState = p => p?.Projektstatus || "Planung";
const projDot = st => "pd-" + String(st).toLowerCase().replace(/ü/g, "ue").replace(/ä/g, "ae").replace(/[^a-z]/g, "");
const lvDot = st => "dot st-" + String(st || "Entwurf").toLowerCase().replace("ü", "ue");
const lvsOfProject = pid => db.lvs.filter(l => refId(l.Projekt) === pid)
  .sort((a, b) => String(lvNr(a)).localeCompare(String(lvNr(b)), "de", { numeric: true }));
const isDone = p => /abgeschlossen/i.test(projState(p));

function lvNetOf(lvId) {
  const tids = new Set(db.titles.filter(t => refId(t.Leistungsverzeichnis) === lvId).map(t => t.id));
  return round2(db.positions.filter(p => tids.has(refId(p.Titel)) && counts(p)).reduce((s, p) => s + lineTotal(p), 0));
}

function parseDeDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return new Date(v * 1000);
  const m = String(v).match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/);
  if (!m) return null;
  let y = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (y < 100) y += 2000;
  return new Date(y, Number(m[2]) - 1, Number(m[1]));
}

function lvDates(l) {
  return [
    ["Angebotsfrist", pick(l, "Angebotsfrist") || l.Abgabedatum],
    ["Submission", pick(l, "Submission")],
    ["Zuschlag", pick(l, "Zuschlagsfrist")]
  ].map(([k, v]) => ({ k, d: parseDeDate(v), l })).filter(x => x.d);
}

const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysUntil = d => Math.round((d - today0()) / 86400000);
const fmtShort = d => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }).replace(/\.?$/, ".");
const inDays = n => n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`;

function projectInfo(p) {
  const lvs = lvsOfProject(p.id);
  const nets = new Map(lvs.map(l => [l.id, lvNetOf(l.id)]));
  const net = round2([...nets.values()].reduce((s, v) => s + v, 0));
  const t0 = today0();
  const dates = lvs.flatMap(lvDates).filter(x => x.d >= t0).sort((a, b) => a.d - b.d);
  return { p, lvs, nets, net, dates, next: dates[0] };
}

function renderProjects() {
  const all = db.projects.filter(p => p.Projektname || p.Projektnummer)
    .sort((a, b) => String(b.Projektnummer).localeCompare(String(a.Projektnummer), "de", { numeric: true }));
  const infos = all.map(projectInfo);
  const active = infos.filter(i => !isDone(i.p));
  const sum = (arr, f) => round2(arr.reduce((s, x) => s + f(x), 0));
  const awarded = active.flatMap(i => i.lvs.filter(l => lvState(l) === "Beauftragt").map(l => i.nets.get(l.id)));
  const nextSub = active.flatMap(i => i.dates.filter(d => d.k === "Submission").map(d => ({ ...d, p: i.p }))).sort((a, b) => a.d - b.d)[0];

  $("projCount").textContent = `${all.length} Projekt${all.length === 1 ? "" : "e"} · ${db.lvs.length} LV${db.lvs.length === 1 ? "" : "s"}`;
  $("projKpis").innerHTML = `
    <div class="kpi"><small>Aktive Projekte</small><b>${active.length}</b><i>${infos.length - active.length} abgeschlossen</i></div>
    <div class="kpi"><small>Kostenansatz netto</small><b>${fmtMoney(sum(active, i => i.net))} €</b><i>alle LVs aktiver Projekte</i></div>
    <div class="kpi"><small>Beauftragt netto</small><b>${fmtMoney(sum(awarded, v => v))} €</b><i>${awarded.length} LV${awarded.length === 1 ? "" : "s"} beauftragt</i></div>
    <div class="kpi"><small>Nächste Submission</small><b>${nextSub ? nextSub.d.toLocaleDateString("de-DE") : "–"}</b><i>${nextSub ? esc(`${nextSub.p.Projektnummer || ""} · LV ${lvNr(nextSub.l)} ${lvName(nextSub.l)}`) : "keine Termine eingetragen"}</i></div>`;

  const states = ["Alle", ...projStates()];
  const cnt = st => st === "Alle" ? infos.length : infos.filter(i => projState(i.p) === st).length;
  $("projFilter").innerHTML = states.map(st => `<button type="button" data-pfilter="${esc(st)}" class="${st === projFilter ? "on" : ""}">${esc(st)}<b>${cnt(st)}</b></button>`).join("");

  const q = projSearch.trim().toLowerCase();
  const shown = infos.filter(i => (projFilter === "Alle" || projState(i.p) === projFilter) &&
    (!q || [i.p.Projektnummer, i.p.Projektname, i.p.Bauherr, i.p.Ort, i.p.Strasse].join(" ").toLowerCase().includes(q)));
  if (!projSel || !all.some(p => p.id === projSel)) projSel = sel.projectId && all.some(p => p.id === sel.projectId) ? sel.projectId : all[0]?.id ?? null;

  const rows = shown.map(i => {
    const p = i.p, st = projState(p);
    const bars = i.lvs.map(l => `<i class="${lvDot(lvState(l)).replace("dot ", "")}" title="LV ${esc(lvNr(l))} ${esc(lvName(l))} · ${esc(lvState(l) || "Entwurf")}"></i>`).join("");
    const byState = {};
    i.lvs.forEach(l => { const s = lvState(l) || "Entwurf"; byState[s] = (byState[s] || 0) + 1; });
    const lbl = i.lvs.length ? Object.entries(byState).map(([s, n]) => `${n} ${s}`).join(" · ") : "noch kein LV";
    const n = i.next ? daysUntil(i.next.d) : null;
    const due = i.next
      ? `<span class="due ${n <= 14 ? "warn" : ""}">${i.next.k} ${fmtShort(i.next.d)}<small>LV ${esc(lvNr(i.next.l))} ${esc(lvName(i.next.l))} · ${inDays(n)}</small></span>`
      : `<span class="due none">–</span>`;
    return `<div class="pr ${p.id === projSel ? "on" : ""} ${isDone(p) ? "done" : ""}" data-proj="${p.id}">
      <span class="nr">${esc(p.Projektnummer || "")}</span>
      <span class="nm"><b>${esc(p.Projektname || "Ohne Namen")}</b><small>${esc([p.Bauherr, [p.PLZ, p.Ort].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "–")}</small></span>
      <span class="pst"><i class="pdot ${projDot(st)}"></i>${esc(st)}</span>
      <span class="lvbar">${bars}<span class="lbl">${esc(lbl)}</span></span>
      <span class="r">${i.lvs.length}</span>
      <span class="r sum">${i.lvs.length ? fmtMoney(i.net) : "–"}</span>
      ${due}
    </div>`;
  }).join("");

  $("projList").innerHTML = infos.length
    ? `<div class="phd"><span>Nr.</span><span>Projekt</span><span>Status</span><span>LVs nach Stand</span><span class="r">LVs</span><span class="r">netto €</span><span>Nächster Termin</span></div>
       ${rows || `<div class="empty"><b>Keine Treffer</b><span>Filter oder Suche anpassen.</span></div>`}
       <div class="legend"><span><i class="dot"></i>Entwurf</span><span><i class="dot st-pruefung"></i>Prüfung</span><span><i class="dot st-ausschreibung"></i>Ausschreibung</span><span><i class="dot st-beauftragt"></i>Beauftragt</span><span class="spacer"></span><span>Klick wählt aus · Doppelklick öffnet das Projekt</span></div>`
    : `<div class="empty"><b>Noch keine Projekte</b><span>Lege dein erstes Projekt an.</span><button class="btn btn-primary" data-new-project>+ Projekt</button></div>`;
  renderProjectPanel();
}

function renderProjectPanel() {
  const p = db.projects.find(x => x.id === projSel);
  const el = $("projectPanel");
  $("insTotalLabel").textContent = "Projekt netto";
  if (!p) { el.innerHTML = `<div class="muted">Kein Projekt gewählt.</div>`; $("lvNet").textContent = "–"; return; }
  const i = projectInfo(p);
  $("lvNet").textContent = fmtMoney(i.net) + " €";
  const st = projState(p);
  const lvRows = i.lvs.map(l => {
    const s = lvState(l) || "Entwurf";
    const d = lvDates(l).filter(x => x.d >= today0()).sort((a, b) => a.d - b.d)[0];
    const sub = [s, d ? `${d.k} ${fmtShort(d.d)}` : "", `${db.titles.filter(t => refId(t.Leistungsverzeichnis) === l.id).length} Titel`].filter(Boolean).join(" · ");
    return `<button type="button" class="plv" data-open-lv="${l.id}" title="LV öffnen">
      <i class="${lvDot(s)}"></i><span><b>LV ${esc(lvNr(l))} ${esc(lvName(l) || "Ohne Bezeichnung")}</b><small>${esc(sub)}</small></span>
      <span class="v">${fmtMoney(i.nets.get(l.id))}<small>${s === "Beauftragt" ? "beauftragt" : "Ansatz"}</small></span></button>`;
  }).join("");
  const total = i.net || 1;
  const stack = i.lvs.filter(l => i.nets.get(l.id) > 0).map(l =>
    `<i class="${lvDot(lvState(l)).replace("dot ", "")}" style="flex:${i.nets.get(l.id) / total}" title="LV ${esc(lvNr(l))} · ${fmtMoney(i.nets.get(l.id))} €"></i>`).join("");
  const share = {};
  i.lvs.forEach(l => { const s = lvState(l) || "Entwurf"; share[s] = (share[s] || 0) + i.nets.get(l.id); });
  const shareTxt = Object.entries(share).filter(([, v]) => v > 0).map(([s, v]) => `${Math.round(v / total * 100)} % ${s}`).join(" · ");
  const tl = i.dates.slice(0, 5).map((d, k) => `<div class="${k === 0 ? "next" : ""}"><b>${fmtShort(d.d)}</b> ${esc(d.k)} LV ${esc(lvNr(d.l))} ${esc(lvName(d.l))}<small>${inDays(daysUntil(d.d))}</small></div>`).join("");
  el.innerHTML = `
    <div class="ins-h"><span>Projekt</span></div>
    <div class="ins-oz">${esc(p.Projektnummer || "")}</div>
    <h2 class="pname">${esc(p.Projektname || "Ohne Namen")}</h2>
    <span class="pst"><i class="pdot ${projDot(st)}"></i>${esc(st)}</span>
    <div class="kv">
      <span>Bauherr</span><span>${esc(p.Bauherr || "–")}</span>
      <span>Adresse</span><span>${[esc(pick(p, "Strasse", "Straße")), esc([p.PLZ, p.Ort].filter(Boolean).join(" "))].filter(Boolean).join("<br>") || "–"}</span>
      <span>Planer</span><span>${esc(p.Architekt || settings.planer || "–")}</span>
    </div>
    <div class="acts-row">
      <button type="button" class="btn btn-primary" data-open-project="${p.id}" ${i.lvs.length ? "" : "disabled"}>LV öffnen</button>
      <button type="button" class="btn" data-new-lv="${p.id}">+ LV</button>
      <button type="button" class="btn" data-edit-project="${p.id}">Bearbeiten</button>
    </div>
    <div class="sec">Leistungsverzeichnisse</div>
    ${lvRows || `<div class="muted">Noch kein LV. Mit „+ LV“ anlegen.</div>`}
    ${stack ? `<div class="sec"><span>Kosten nach LV</span><span>${fmtMoney(i.net)} €</span></div><div class="stack">${stack}</div><div class="muted">${esc(shareTxt)}</div>` : ""}
    <div class="sec">Termine</div>
    ${tl ? `<div class="tl">${tl}</div>` : `<div class="muted">Keine anstehenden Termine. Termine trägst du in den LV-Angaben ein (Angebotsfrist, Submission, Zuschlagsfrist).</div>`}`;
}

async function openProject(pid, lvId = null) {
  sel.projectId = pid;
  sel.lvId = lvId ?? lvsOfProject(pid)[0]?.id ?? null;
  sel.nodeId = sel.posId = null;
  collapsed = new Set();
  localStorage.setItem("lv.project", pid);
  if (sel.lvId) localStorage.setItem("lv.lv", sel.lvId);
  validateSelection();
  setView("edit");
  renderAll();
}

function openProjectDialog(pid) {
  const p = db.projects.find(x => x.id === pid);
  if (!p) return;
  const st = $("pj_Projektstatus");
  st.innerHTML = "";
  projStates().forEach(c => st.add(new Option(c, c)));
  for (const f of ["Projektnummer", "Projektname", "Bauherr", "Strasse", "PLZ", "Ort", "Architekt", "Projektstatus"]) {
    const el = $("pj_" + f);
    const exists = f in p;
    el.closest(".field").hidden = !exists;
    el.value = exists ? (p[f] ?? "") : "";
  }
  $("projectDialog").dataset.id = pid;
  $("projectDialog").showModal();
}

async function saveProjectDialog(ev) {
  ev.preventDefault();
  const pid = Number($("projectDialog").dataset.id);
  const p = db.projects.find(x => x.id === pid);
  $("projectDialog").close();
  if (!p) return;
  const values = {};
  for (const f of ["Projektnummer", "Projektname", "Bauherr", "Strasse", "PLZ", "Ort", "Architekt", "Projektstatus"]) if (f in p) values[f] = $("pj_" + f).value;
  await apply([["UpdateRecord", T.projects, pid, values]]);
  renderAll();
}

function bindProjects() {
  $("projSearch").addEventListener("input", e => { projSearch = e.target.value; renderProjects(); });
  $("projNew").addEventListener("click", () => openQuickStart("project"));
  $("projFilter").addEventListener("click", e => {
    const b = e.target.closest("[data-pfilter]");
    if (b) { projFilter = b.dataset.pfilter; renderProjects(); }
  });
  $("projList").addEventListener("click", e => {
    if (e.target.closest("[data-new-project]")) return openQuickStart("project");
    const r = e.target.closest("[data-proj]");
    if (r) {
      projSel = Number(r.dataset.proj);
      $("projList").querySelectorAll(".pr").forEach(x => x.classList.toggle("on", x === r));
      renderProjectPanel();
    }
  });
  $("projList").addEventListener("dblclick", e => {
    const r = e.target.closest("[data-proj]");
    if (r) openProject(Number(r.dataset.proj));
  });
  $("projectPanel").addEventListener("click", e => {
    const b = e.target.closest("[data-open-lv],[data-open-project],[data-new-lv],[data-edit-project]");
    if (!b) return;
    const d = b.dataset;
    if (d.openLv) openProject(projSel, Number(d.openLv));
    else if (d.openProject) openProject(Number(d.openProject));
    else if (d.newLv) { sel.projectId = Number(d.newLv); validateSelection(); openQuickStart("lv"); }
    else if (d.editProject) openProjectDialog(Number(d.editProject));
  });
  $("projectForm").addEventListener("submit", saveProjectDialog);
  $("pjCancel").addEventListener("click", () => $("projectDialog").close());
}

// ------------------------------------------------------
// RENDERING  (Layout „Kompakt“: Icon-Leiste · Liste · Inspector)
// ------------------------------------------------------
function renderAll() {
  renderHeader();
  renderSchemaBanner();
  renderList();
  renderInspector();
  if (view === "document") renderDocument();
  if (view === "texts") { renderTexts(); if (!txDirty) fillTextEditor(); renderTextPreview(); }
  if (view === "projects") renderProjects();
  if (view === "time" && !ztIsBusy()) ztRender();
}

// Zeiterfassung nicht neu zeichnen, während getippt, gezogen oder ein Dialog bearbeitet wird
function ztIsBusy() {
  const a = document.activeElement;
  return !!(ztDrag || document.querySelector("dialog[open]") || document.querySelector(".zt-tagmenu")
    || (a && a.closest && a.closest("#ztBody") && /INPUT|SELECT|TEXTAREA/.test(a.tagName)));
}

function renderHeader() {
  const ps = $("projectSelect");
  ps.innerHTML = db.projects.length ? "" : '<option value="">Kein Projekt</option>';
  [...db.projects]
    .filter(p => p.Projektname || p.Projektnummer)
    .sort((a, b) => String(a.Projektnummer).localeCompare(String(b.Projektnummer), "de", { numeric: true }))
    .forEach(p => ps.add(new Option(`${p.Projektnummer ? p.Projektnummer + " " : ""}${p.Projektname || ""}`, p.id)));
  ps.value = sel.projectId ?? "";

  const ls = $("lvSelect");
  const list = db.lvs.filter(l => refId(l.Projekt) === sel.projectId)
    .sort((a, b) => String(lvNr(a)).localeCompare(String(lvNr(b)), "de", { numeric: true }));
  ls.innerHTML = list.length ? "" : '<option value="">Kein LV</option>';
  list.forEach(l => ls.add(new Option(`LV ${lvNr(l) ? lvNr(l) + " " : ""}${lvName(l) || "Ohne Bezeichnung"}`, l.id)));
  ls.value = sel.lvId ?? "";

  const st = lvState(lv());
  const el = $("lvStatus");
  el.hidden = !st;
  el.innerHTML = `<i class="dot st-${String(st).toLowerCase().replace("ü", "ue")}"></i>${esc(st)}${isLocked() ? " · OZ fix" : ""}`;
  el.title = isLocked() ? "Ab diesem Status werden Ordnungszahlen nicht mehr automatisch geändert." : "";

  $("lvNet").textContent = fmtMoney(lvTotal()) + " €";
  $("insTotalLabel").textContent = "LV netto";
  $("addPositionButton").disabled = !sel.lvId || !walk().length;
}

function renderSchemaBanner() {
  const b = $("schemaBanner");
  const n = missingTables.length + missingSchema.length;
  b.hidden = !n;
  if (!n) return;
  if (missingTables.length === FULL_SCHEMA.length) {
    $("schemaBannerTitle").textContent = "Ersteinrichtung";
    $("schemaBannerText").textContent =
      "Dieses Dokument enthält noch keine AVA-Tabellen. Ein Klick legt Projekte, Leistungsverzeichnisse, Titel und Positionen an.";
    $("schemaButton").textContent = "Einrichten";
  } else {
    $("schemaBannerTitle").textContent = "Datenmodell erweitern";
    $("schemaBannerText").textContent = "Es fehlen: " + [
      ...missingTables.map(t => `Tabelle ${t}`),
      ...missingSchema.map(s => `${s.table}.${s.id}`)
    ].join(", ");
    $("schemaButton").textContent = "Jetzt anlegen";
  }
}

function matchesSearch(text) {
  return !searchTerm || String(text).toLowerCase().includes(searchTerm);
}

function subtreeMatches(t) {
  if (matchesSearch(`${nodeOz(t)} ${nodeName(t)}`)) return true;
  if (positionsOf(t.id).some(p => matchesSearch(`${p.Positionsnummer} ${p.Kurztext} ${p.Langtext}`))) return true;
  return childrenOf(t.id).some(subtreeMatches);
}

function renderList() {
  const el = $("list");
  if (!sel.lvId) {
    const pr = project();
    el.innerHTML = pr
      ? `<div class="empty"><b>Projekt ${esc(pr.Projektnummer || "")} ${esc(pr.Projektname || "")} hat noch kein LV</b><span>Lege das erste Leistungsverzeichnis an, sobald du es brauchst.</span><button class="btn btn-primary" id="emptyNewLv">+ LV anlegen</button></div>`
      : `<div class="empty"><b>Noch kein Projekt</b><span>Oben über „+ Neu“ ein Projekt anlegen.</span></div>`;
    $("emptyNewLv")?.addEventListener("click", () => openQuickStart("lv"));
    return;
  }
  const total = lvTotal() || 1;
  const html = [];
  const draw = parentId => {
    const sibs = childrenOf(parentId);
    sibs.forEach((t, i) => {
      if (searchTerm && !subtreeMatches(t)) return;
      const lvl = Math.min(level(t), 3);
      const pos = positionsOf(t.id);
      const kids = childrenOf(t.id);
      const open = searchTerm ? true : !collapsed.has(t.id);
      const sum = nodeTotal(t.id);
      const count = pos.length + kids.length;
      html.push(`
        <div class="g lvl-${lvl} ${t.id === sel.nodeId && !sel.posId ? "on" : ""}" data-node="${t.id}" draggable="true" title="Ziehen zum Verschieben">
          <button class="caret ${open ? "open" : ""}" data-toggle="${t.id}" title="${open ? "Zuklappen" : "Aufklappen"}" aria-label="${open ? "Zuklappen" : "Aufklappen"}"></button>
          <span class="oz">${esc(nodeOz(t))}</span>
          <span class="n">${esc(nodeName(t))}</span>
          <span class="c">${pos.length ? pos.length + " Pos." : kids.length ? kids.length + " Untertitel" : "leer"}</span>
          ${lvl === 1 ? `<span class="share" title="${Math.round(sum / total * 100)} % des LV"><i style="width:${Math.max(2, Math.round(sum / total * 100))}%"></i></span>` : ""}
          <span class="acts">
            <button data-move-node="${t.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} title="Nach oben">↑</button>
            <button data-move-node="${t.id}" data-dir="1" ${i === sibs.length - 1 ? "disabled" : ""} title="Nach unten">↓</button>
            <button data-edit-node="${t.id}" title="Titel bearbeiten">✎</button>
            ${lvl < 3 ? `<button data-add-sub="${t.id}" title="Untertitel anlegen">+ UT</button>` : ""}
            ${kids.length ? "" : `<button data-add-pos="${t.id}" title="Position anlegen">+ Pos</button>`}
          </span>
          <span class="s">${fmtMoney(sum)}</span>
        </div>`);
      if (!open) return;
      pos.forEach((p, j) => {
        if (searchTerm && !matchesSearch(`${p.Positionsnummer} ${p.Kurztext} ${p.Langtext}`) && !matchesSearch(`${nodeOz(t)} ${nodeName(t)}`)) return;
        const k = typeKey(p);
        const active = isActive(p.Aktiv);
        html.push(`
          <div class="row ${p.id === sel.posId ? "on" : ""} ${active ? "" : "off"}" data-pos="${p.id}" draggable="true">
            <button class="adot ${active ? "on" : ""}" data-toggle-active="${p.id}" title="${active ? "Aktiv" : "Inaktiv"} (klicken zum Umschalten)"></button>
            <span class="oz">${esc(p.Positionsnummer)}</span>
            <span class="kt">${esc(p.Kurztext || "(ohne Kurztext)")}${k !== "normal" ? `<span class="tag t-${k}">${TYPE_LABEL[k]}</span>` : ""}${active ? "" : '<span class="tag t-off">inaktiv</span>'}<small>${esc(String(p.Langtext || "").split("\n")[0])}</small></span>
            <span class="r">${fmtQty(p.Menge)}</span>
            <span class="me">${esc(p.Einheit)}</span>
            <span class="r">${fmtMoney(p.Einheitspreis)}</span>
            <span class="r gb">${k === "normal" ? fmtMoney(lineTotal(p)) : '<em>nur EP</em>'}</span>
            <span class="mv">
              <span class="grip" title="Mit der Maus ziehen, um die Position zu verschieben – auch in einen anderen Titel">⠿</span>
              <button data-move-pos="${p.id}" data-dir="-1" ${j === 0 ? "disabled" : ""} title="Nach oben">↑</button>
              <button data-move-pos="${p.id}" data-dir="1" ${j === pos.length - 1 ? "disabled" : ""} title="Nach unten">↓</button>
            </span>
          </div>`);
      });
      if (!kids.length && !searchTerm && (!pos.length || t.id === sel.nodeId)) {
        html.push(`<button class="row add lvl-${lvl}" data-add-pos="${t.id}">+ Position in ${esc(nodeOz(t))}</button>`);
      }
      draw(t.id);
    });
  };
  draw(null);
  if (!walk().length) {
    html.push(`<div class="empty"><b>Noch keine Titel</b><span>Ein LV besteht aus Titeln (01, 02 …) und darin Positionen. Du kannst auch mit einer Vorlage beginnen:</span>
      <div class="tpl-row">${Object.entries(TEMPLATES).map(([k, t]) => `<button type="button" class="btn" data-template="${k}" title="${esc(t.hint)}">${esc(t.name)}</button>`).join("")}</div></div>`);
  } else if (searchTerm && !html.length) {
    html.push(`<div class="empty"><b>Keine Treffer</b><span>für „${esc(searchTerm)}“</span></div>`);
  }
  if (!searchTerm) html.push(`<button class="add-title" id="addTitleInline">+ Titel hinzufügen</button>`);
  el.innerHTML = html.join("");
}

function renderInspector() {
  const projects = view === "projects";
  $("projectPanel").hidden = !projects;
  if (projects) {
    $("posPanel").hidden = $("summaryPanel").hidden = $("textPreview").hidden = true;
    return renderProjectPanel();
  }
  const texts = view === "texts";
  const p = texts ? null : position(sel.posId);
  $("textPreview").hidden = !texts;
  $("posPanel").hidden = !p;
  $("summaryPanel").hidden = !!p || texts;
  if (texts) return;
  if (p) {
    $("inspectorOz").textContent = p.Positionsnummer || "–";
    const t = title(refId(p.Titel));
    $("inspectorPath").textContent = t ? ancestors(t).map(a => `${nodeOz(a)} ${nodeName(a)}`).join(" › ") : "";
  } else {
    renderSummary();
  }
}

function renderSummary() {
  const el = $("summaryPanel");
  const l = lv();
  if (!l) {
    el.innerHTML = `<div class="ins-h"><span>Übersicht</span></div><p class="muted">Kein LV gewählt.</p>`;
    return;
  }
  const node = title(sel.nodeId);
  const net = lvTotal(), vat = round2(net * settings.mwst / 100);
  const total = net || 1;
  const nodeBlock = node ? `
    <div class="ins-h"><span>Titel</span></div>
    <div class="ins-oz">${esc(nodeOz(node))}</div>
    <div class="ins-title">${esc(nodeName(node))}</div>
    <div class="kv"><span>Texte</span><button class="link" data-open-texts="${node.id}">${TEXT_PARTS.map(pt => `<i class="st s-${textState(node, pt)}"></i>${pt.slice(0, 4)}.`).join(" &nbsp;")}</button></div>
    <div class="kv"><span>Summe</span><b>${fmtMoney(nodeTotal(node.id))} €</b></div>
    <div class="ins-actions">
      <button class="btn btn-ghost" data-edit-node="${node.id}">Bearbeiten</button>
      ${level(node) < 3 ? `<button class="btn btn-ghost" data-add-sub="${node.id}">+ Untertitel</button>` : ""}
      ${childrenOf(node.id).length ? "" : `<button class="btn btn-ghost" data-add-pos="${node.id}">+ Position</button>`}
    </div>
    <hr>` : "";
  el.innerHTML = `
    ${nodeBlock}
    <div class="ins-h"><span>Leistungsverzeichnis</span></div>
    <div class="ins-title">${esc(lvNr(l))} ${esc(lvName(l))}</div>
    <div class="muted">${esc(project()?.Projektname || "")}${l.Gewerk ? " · " + esc(l.Gewerk) : ""}</div>
    <div class="ins-actions"><button class="btn btn-ghost" data-edit-lv>LV-Angaben</button><button class="btn btn-ghost" data-open-texts="lv">Vor-/Nachtexte</button></div>
    <div class="bars">
      ${childrenOf(null).map(t => `
        <button class="bar" data-select-node="${t.id}">
          <span class="bl"><span class="oz">${esc(nodeOz(t))}</span> ${esc(nodeName(t))}</span>
          <span class="bv">${fmtMoney(nodeTotal(t.id))}</span>
          <span class="bt"><i style="width:${Math.max(1, Math.round(nodeTotal(t.id) / total * 100))}%"></i></span>
        </button>`).join("") || '<p class="muted">Noch keine Titel.</p>'}
    </div>
    <div class="kv"><span>zzgl. ${String(settings.mwst).replace(".", ",")} % MwSt.</span><span>${fmtMoney(vat)} €</span></div>
    <div class="kv"><span>Brutto</span><span>${fmtMoney(net + vat)} €</span></div>
    <div class="hint">
      <div><kbd>⌘K</kbd> Suchen</div>
      <div><kbd>⌘↵</kbd> Neue Position</div>
      <div><kbd>Esc</kbd> Schließen</div>
    </div>`;
}

function fillForm(p) {
  $("fKurztext").value = p.Kurztext ?? "";
  $("fLangtext").value = p.Langtext ?? "";
  $("fMenge").value = fmtInput(p.Menge, 3);
  $("fEinheit").value = p.Einheit ?? "";
  $("fEinheitspreis").value = fmtInput(p.Einheitspreis, 2);
  $("fAktiv").checked = isActive(p.Aktiv);
  const seg = $("typeSeg");
  const current = p.Positionstyp || choices.Positionstyp[0] || "Normal";
  seg.innerHTML = choices.Positionstyp.map(c =>
    `<button type="button" data-type="${esc(c)}" class="${c === current ? "on" : ""}">${esc(c.replace(/position$/i, ""))}</button>`
  ).join("");
  seg.dataset.value = current;
  $("unitList").innerHTML = choices.Einheit.map(u => `<option value="${esc(u)}">`).join("");
  updateFormTotal();
  $("dirtyIndicator").textContent = "";
  autoGrow($("fLangtext"));
}

function autoGrow(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.min(320, Math.max(90, ta.scrollHeight + 2)) + "px";
}

function formValues() {
  return {
    Kurztext: $("fKurztext").value.trim(),
    Langtext: $("fLangtext").value,
    Menge: parseDe($("fMenge").value),
    Einheit: $("fEinheit").value.trim(),
    Einheitspreis: parseDe($("fEinheitspreis").value),
    Positionstyp: $("typeSeg").dataset.value || "Normal",
    Aktiv: $("fAktiv").checked
  };
}

function updateFormTotal() {
  const v = formValues();
  $("fGesamt").textContent = typeKey(v) === "normal"
    ? fmtMoney(round2(v.Menge * v.Einheitspreis)) + " €"
    : "nur Einheitspreis";
}

// ------------------------------------------------------
// AUSWAHL
// ------------------------------------------------------
async function selectNode(id) {
  await flushSave();
  sel.nodeId = id;
  sel.posId = null;
  collapsed.delete(id);
  if (view !== "edit") setView("edit");
  renderAll();
  document.querySelector(`.g[data-node="${id}"]`)?.scrollIntoView({ block: "nearest" });
}

async function selectPosition(id) {
  await flushSave();
  const p = position(id);
  if (!p) return;
  sel.posId = id;
  sel.nodeId = refId(p.Titel);
  ancestors(title(sel.nodeId)).forEach(a => collapsed.delete(a.id));
  if (view !== "edit") setView("edit");
  renderAll();
  fillForm(p);
  document.querySelector(`.row[data-pos="${id}"]`)?.scrollIntoView({ block: "nearest" });
}

async function closeInspector() {
  await flushSave();
  sel.posId = null;
  renderAll();
}

function setView(v) {
  view = v;
  document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === v));
  $("list").hidden = v !== "edit";
  $("documentView").hidden = v !== "document";
  $("textsView").hidden = v !== "texts";
  $("projectsView").hidden = v !== "projects";
  $("timeView").hidden = v !== "time";
  document.querySelector(".mid").classList.toggle("projview", v === "projects" || v === "time");
  $("app").classList.toggle("wide", v === "time");
  document.querySelector(".scroll").hidden = v === "texts" || v === "projects" || v === "time";
  $("search").placeholder = v === "texts" ? "Texte durchsuchen …" : "Suchen: OZ, Kurztext, Langtext …";
  renderInspector();
  if (v === "texts") { renderTexts(); fillTextEditor(); renderTextPreview(); }
  document.querySelector(".scroll").scrollTop = 0;
  if (v === "document") renderDocument();
  if (v === "projects") renderProjects();
  if (v === "time") ztRender();
  if (v !== "projects" && v !== "time") renderHeader();
}

// ------------------------------------------------------
// AUTOMATISCHES SPEICHERN
// ------------------------------------------------------
function onFormInput() {
  if (!sel.posId) return;
  dirty = true;
  $("dirtyIndicator").textContent = "Änderungen …";
  status("Bearbeitung");
  updateFormTotal();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 700);
}

async function flushSave() {
  clearTimeout(saveTimer);
  if (savingPromise) await savingPromise;
  if (!dirty || !sel.posId) return;
  const id = sel.posId;
  const values = formValues();
  dirty = false;
  savingPromise = (async () => {
    try {
      await apply([["UpdateRecord", T.positions, id, values]]);
      $("dirtyIndicator").textContent = "Automatisch gespeichert";
      renderHeader();
      renderList();
      renderInspector();
    } catch (e) {
      dirty = true;
    } finally {
      savingPromise = null;
    }
  })();
  return savingPromise;
}

// ------------------------------------------------------
// POSITIONEN: ANLEGEN / DUPLIZIEREN / LÖSCHEN / VERSCHIEBEN
// ------------------------------------------------------
// Ziel: angegebener Titel, sonst der gewählte, sonst der letzte Titel ohne Untertitel
function targetNode(nodeId) {
  let node = title(nodeId ?? sel.nodeId);
  if (node && childrenOf(node.id).length) node = walk(node.id).filter(t => !childrenOf(t.id).length).pop();
  if (!node) node = walk().filter(t => !childrenOf(t.id).length).pop();
  return node;
}

async function insertPosition(fields = {}, nodeId = null) {
  await flushSave();
  const node = targetNode(nodeId);
  if (!node) {
    toast("Bitte zuerst einen Titel anlegen.");
    return;
  }
  sel.nodeId = node.id;
  const list = positionsOf(node.id);
  const cur = position(sel.posId);
  const idx = cur && refId(cur.Titel) === node.id ? list.findIndex(p => p.id === cur.id) : list.length - 1;
  const before = list[idx];
  const after = list[idx + 1];

  let oz = makePosOz(node, idx + 1);
  if (isLocked()) {
    oz = lockedOz(node, before, after);
    if (!oz) {
      toast("Zwischen diesen Ordnungszahlen ist kein Platz mehr. Position bitte am Ende einfügen.");
      return;
    }
  }

  const res = await apply([["AddRecord", T.positions, null, {
    Titel: node.id,
    Sortierung: (before ? num(before.Sortierung) : 0) + 0.5,
    Positionsnummer: oz,
    Kurztext: "", Langtext: "", Menge: 0, Einheit: "", Einheitspreis: 0,
    Positionstyp: "Normal", Aktiv: true,
    ...fields
  }]]);
  const newId = newRowId(res);
  await apply(renumberActions());
  if (newId) {
    await selectPosition(newId);
    if (!fields.Kurztext) $("fKurztext").focus();
  } else renderAll();
}

async function toggleActive(id) {
  await flushSave();
  const p = position(id);
  if (!p) return;
  const on = !isActive(p.Aktiv);
  await apply([["UpdateRecord", T.positions, id, { Aktiv: on }]]);
  if (sel.posId === id) $("fAktiv").checked = on;
  renderAll();
}

async function duplicatePosition() {
  const p = position(sel.posId);
  if (!p) return;
  await flushSave();
  const { Kurztext, Langtext, Menge, Einheit, Einheitspreis, Positionstyp, Aktiv } = position(sel.posId);
  await insertPosition({ Kurztext: Kurztext ? Kurztext + " (Kopie)" : "", Langtext, Menge, Einheit, Einheitspreis, Positionstyp, Aktiv });
}

async function deletePosition() {
  const p = position(sel.posId);
  if (!p) return;
  if (!confirm(`Position ${p.Positionsnummer} „${p.Kurztext || "ohne Kurztext"}“ löschen?\n(Rückgängig über Grist: Strg/Cmd+Z)`)) return;
  clearTimeout(saveTimer);
  dirty = false;
  const list = positionsOf(refId(p.Titel));
  const idx = list.findIndex(x => x.id === p.id);
  await apply([["RemoveRecord", T.positions, p.id]]);
  await apply(renumberActions());
  const next = positionsOf(sel.nodeId)[Math.min(idx, positionsOf(sel.nodeId).length - 1)];
  sel.posId = null;
  if (next) await selectPosition(next.id); else renderAll();
}

async function movePosition(id, dir) {
  await flushSave();
  const p = position(id);
  const list = positionsOf(refId(p.Titel));
  const i = list.findIndex(x => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  if (isLocked() && !confirm("Das LV ist bereits ausgeschrieben. Beim Verschieben bleiben die Ordnungszahlen gleich, die Reihenfolge im Druck ändert sich. Fortfahren?")) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((x, k) => { x.Sortierung = k + 1; });
  await apply([
    ...list.map((x, k) => ["UpdateRecord", T.positions, x.id, { Sortierung: k + 1 }]),
    ...renumberActions()
  ]);
  renderAll();
  if (sel.posId) fillForm(position(sel.posId));
}

// Position an eine beliebige Stelle verschieben (Drag & Drop, auch in einen anderen Titel)
async function movePositionTo(id, nodeId, idx) {
  await flushSave();
  const p = position(id);
  const node = title(nodeId);
  if (!p || !node) return;
  const fromId = refId(p.Titel);
  const oldIdx = positionsOf(fromId).findIndex(x => x.id === id);
  const target = positionsOf(nodeId).filter(x => x.id !== id);
  idx = Math.max(0, Math.min(idx, target.length));
  if (fromId === nodeId && oldIdx === idx) return;
  const locked = isLocked();
  if (locked && !confirm("Das LV ist bereits ausgeschrieben. Die Position bekommt eine freie Ordnungszahl an der neuen Stelle, alle anderen OZ bleiben gleich. Fortfahren?")) return;
  let oz = null;
  if (locked) {
    oz = lockedOz(node, target[idx - 1], target[idx]);
    if (!oz) return toast("An dieser Stelle ist keine Ordnungszahl mehr frei.");
  }
  target.splice(idx, 0, p);
  p.Titel = nodeId; // lokal, damit die Neunummerierung stimmt
  const actions = target.map((x, k) => {
    x.Sortierung = k + 1;
    const v = { Sortierung: k + 1 };
    if (x.id === id) { v.Titel = nodeId; if (oz) { v.Positionsnummer = oz; x.Positionsnummer = oz; } }
    return ["UpdateRecord", T.positions, x.id, v];
  });
  if (fromId !== nodeId) {
    positionsOf(fromId).forEach((x, k) => { x.Sortierung = k + 1; actions.push(["UpdateRecord", T.positions, x.id, { Sortierung: k + 1 }]); });
    collapsed.delete(nodeId);
  }
  await apply([...actions, ...renumberActions()]);
  sel.nodeId = nodeId;
  renderAll();
  if (sel.posId) fillForm(position(sel.posId));
  if (fromId !== nodeId) toast(`Position nach ${nodeOz(node)} ${nodeName(node)} verschoben.`);
}

// Titel innerhalb derselben Ebene an eine beliebige Stelle verschieben
async function moveTitleTo(id, targetId, after) {
  await flushSave();
  const t = title(id), target = title(targetId);
  if (!t || !target || id === targetId) return;
  if ((parentOf(t) || null) !== (parentOf(target) || null)) return toast("Titel lassen sich nur innerhalb derselben Ebene verschieben.");
  if (isLocked() && !confirm("Das LV ist bereits ausgeschrieben. Die Ordnungszahlen bleiben gleich. Fortfahren?")) return;
  const sibs = childrenOf(parentOf(t)).filter(s => s.id !== id);
  const k = sibs.findIndex(s => s.id === targetId) + (after ? 1 : 0);
  sibs.splice(k, 0, t);
  sibs.forEach((s, i) => { s.Sortierung = i + 1; });
  await apply([
    ...sibs.map((s, i) => ["UpdateRecord", T.titles, s.id, { Sortierung: i + 1 }]),
    ...renumberActions()
  ]);
  renderAll();
}

// ------------------------------------------------------
// TITEL: ANLEGEN / BEARBEITEN / LÖSCHEN / VERSCHIEBEN
// ------------------------------------------------------
function openTitleDialog(id, parentId = null) {
  editingTitleId = id;
  editingTitleParent = parentId;
  const t = title(id);
  const parent = title(parentId);
  $("titleDialogHeading").textContent = t
    ? `Titel ${nodeOz(t)} bearbeiten`
    : parent ? `Neuer Untertitel in ${nodeOz(parent)} ${nodeName(parent)}` : "Neuer Titel";
  $("tBezeichnung").value = t?.Titelbezeichnung ?? "";
  $("tDelete").hidden = !t;
  $("titleDialog").showModal();
  $("tBezeichnung").focus();
}

async function saveTitleDialog(ev) {
  ev.preventDefault();
  const name = $("tBezeichnung").value.trim();
  const texts = {};
  if (!name) return;
  $("titleDialog").close();
  if (editingTitleId) {
    await apply([["UpdateRecord", T.titles, editingTitleId, { Titelbezeichnung: name, ...texts }]]);
    renderAll();
    return;
  }
  const sibs = childrenOf(editingTitleParent);
  const fields = {
    Titelbezeichnung: name, ...texts,
    Leistungsverzeichnis: sel.lvId,
    Sortierung: sibs.length + 1,
    Titelnummer: pad(sibs.length + 1, 2)
  };
  if (!missingSchema.some(s => s.id === "Uebergeordnet")) fields.Uebergeordnet = editingTitleParent || 0;
  else if (editingTitleParent) {
    toast("Für Untertitel bitte zuerst das Datenmodell erweitern (gelber Hinweis oben).");
    return;
  }
  const res = await apply([["AddRecord", T.titles, null, fields]]);
  await apply(renumberActions());
  const id = newRowId(res);
  if (editingTitleParent) collapsed.delete(editingTitleParent);
  if (id) await selectNode(id); else renderAll();
}

function descendants(id, out = []) {
  for (const c of childrenOf(id)) {
    out.push(c);
    descendants(c.id, out);
  }
  return out;
}

async function deleteTitle() {
  const t = title(editingTitleId);
  if (!t) return;
  const sub = descendants(t.id);
  const nodeIds = [t.id, ...sub.map(s => s.id)];
  const posIds = db.positions.filter(p => nodeIds.includes(refId(p.Titel))).map(p => p.id);
  const msg = `Titel ${nodeOz(t)} „${nodeName(t)}“ löschen?` +
    (sub.length || posIds.length ? `\n\nDabei werden auch ${sub.length} Untertitel und ${posIds.length} Positionen gelöscht.` : "") +
    "\n(Rückgängig über Grist: Strg/Cmd+Z)";
  if (!confirm(msg)) return;
  $("titleDialog").close();
  const actions = [];
  if (posIds.length) actions.push(["BulkRemoveRecord", T.positions, posIds]);
  actions.push(["BulkRemoveRecord", T.titles, nodeIds]);
  await apply(actions);
  await apply(renumberActions());
  sel.nodeId = null;
  sel.posId = null;
  validateSelection();
  renderAll();
}

async function moveTitle(id, dir) {
  await flushSave();
  const t = title(id);
  const sibs = childrenOf(parentOf(t));
  const i = sibs.findIndex(s => s.id === id);
  const j = i + dir;
  if (j < 0 || j >= sibs.length) return;
  if (isLocked() && !confirm("Das LV ist bereits ausgeschrieben. Die Ordnungszahlen bleiben gleich. Fortfahren?")) return;
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
  sibs.forEach((s, k) => { s.Sortierung = k + 1; });
  await apply([
    ...sibs.map((s, k) => ["UpdateRecord", T.titles, s.id, { Sortierung: k + 1 }]),
    ...renumberActions()
  ]);
  renderAll();
}

// ------------------------------------------------------
// DATENMODELL ERWEITERN
// ------------------------------------------------------
const colInfo = c => ({
  type: c.type,
  isFormula: !!c.isFormula,
  formula: c.formula || "",
  label: c.label || c.id,
  ...(c.widgetOptions ? { widgetOptions: c.widgetOptions } : {})
});

async function migrateSchema() {
  const setup = missingTables.length === FULL_SCHEMA.length;
  const lines = [
    ...missingTables.map(t => `• Tabelle ${t}`),
    ...missingSchema.map(s => `• Spalte ${s.table}.${s.id} (${s.type})`)
  ];
  if (!lines.length) return;
  const roundFix = !missingTables.includes(T.positions) && !missingSchema.some(s => s.id === "Gesamtpreis");
  const extra = roundFix ? "\n\nAußerdem wird „Gesamtpreis“ auf 2 Nachkommastellen gerundet." : "";
  if (!confirm(`Folgendes wird in Grist angelegt:\n\n${lines.join("\n")}${extra}\n\nFortfahren?`)) return;

  // Erst Tabellen mit einfachen Spalten, danach Referenz- und Formelspalten
  const actions = [];
  const later = [];
  for (const d of FULL_SCHEMA) {
    if (!missingTables.includes(d.table)) continue;
    const plain = d.cols.filter(c => !c.type.startsWith("Ref:") && !c.isFormula);
    actions.push(["AddTable", d.table, plain.map(c => ({ id: c.id, ...colInfo(c) }))]);
    d.cols.filter(c => c.type.startsWith("Ref:") || c.isFormula).forEach(c => later.push({ table: d.table, ...c }));
  }
  const added = [...later, ...missingSchema];
  for (const c of added) actions.push(["AddColumn", c.table, c.id, colInfo(c)]);
  if (roundFix) actions.push(["ModifyColumn", T.positions, "Gesamtpreis", { formula: "ROUND($Menge * $Einheitspreis, 2)" }]);

  await apply(actions);
  await setRefDisplay(added.filter(c => c.show));
  await fetchAll();
  toast(setup ? "Tabellen angelegt. Jetzt Projekt und LV anlegen." : "Datenmodell erweitert.");
  validateSelection();
  renderAll();
  if (setup) openQuickStart();
}

// Referenzspalten sollen Namen statt Zeilennummern zeigen (wie „Spalte anzeigen“ in Grist)
async function setRefDisplay(refCols) {
  if (!refCols.length) return;
  try {
    const [tables, cols] = await Promise.all([
      grist.docApi.fetchTable("_grist_Tables"),
      grist.docApi.fetchTable("_grist_Tables_column")
    ]);
    const tRef = {};
    rows(tables).forEach(t => { tRef[t.tableId] = t.id; });
    const colRows = rows(cols);
    const colRef = (table, colId) => colRows.find(c => c.parentId === tRef[table] && c.colId === colId)?.id;
    const actions = [];
    for (const c of refCols) {
      const ref = colRef(c.table, c.id);
      const vis = colRef(c.type.slice(4), c.show);
      if (!ref || !vis) continue;
      actions.push(["ModifyColumn", c.table, c.id, { visibleCol: vis }]);
      actions.push(["SetDisplayFormula", c.table, null, ref, `$${c.id}.${c.show}`]);
    }
    if (actions.length) await grist.docApi.applyUserActions(actions);
  } catch (e) {
    console.info("Anzeigespalten für Referenzen bitte in Grist manuell setzen.", e);
  }
}

// Projekt + LV in einem Dialog anlegen (nach der Ersteinrichtung oder über „+ LV“)
// mode: "lv" = neues LV im aktuellen Projekt, "project" = neues Projekt (LV optional)
function openQuickStart(mode) {
  const pr = project();
  if (!pr) mode = "project";
  mode = mode || "lv";
  $("quickStartForm").reset();
  $("qMode").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.mode === mode));
  $("qMode").querySelector('[data-mode="lv"]').disabled = !pr;
  $("qNewProject").checked = mode === "project";
  $("qWithLv").checked = mode !== "project" || !pr;
  syncQuickStart();
  $("quickStartDialog").showModal();
  (mode === "lv" ? $("qLvNummer") : $("qProjektnummer")).focus();
}

function syncQuickStart() {
  const pr = project();
  const newProject = $("qNewProject").checked;
  const withLv = !newProject || $("qWithLv").checked;
  $("qProjectFields").hidden = !newProject;
  $("qWithLvWrap").hidden = !newProject;
  $("qLvFields").hidden = !withLv;
  $("qLvNummer").required = $("qLvName").required = withLv;
  $("qProjektname").required = newProject;
  $("qHeading").textContent = newProject ? "Neues Projekt" : "Neues Leistungsverzeichnis";
  $("qProjectHint").textContent = newProject ? "" : `In Projekt ${pr?.Projektnummer || ""} ${pr?.Projektname || ""}`;
  $("qSubmit").textContent = newProject && !withLv ? "Projekt anlegen" : "Anlegen";
}

async function saveQuickStart(ev) {
  ev.preventDefault();
  const v = id => $(id).value.trim();
  $("quickStartDialog").close();
  let pid = sel.projectId;
  if ($("qNewProject").checked || !pid) {
    const res = await apply([["AddRecord", T.projects, null, {
      Projektnummer: v("qProjektnummer"), Projektname: v("qProjektname"), Bauherr: v("qBauherr"),
      Strasse: v("qStrasse"), PLZ: v("qPLZ"), Ort: v("qOrt"), Projektstatus: "Planung"
    }]]);
    pid = newRowId(res);
    if (!$("qWithLv").checked) {
      sel.projectId = pid;
      sel.lvId = sel.nodeId = sel.posId = null;
      localStorage.setItem("lv.project", pid);
      projSel = pid;
      validateSelection();
      renderAll();
      toast("Projekt angelegt. LVs legst du später über „+ Neu“ an.");
      return;
    }
  }
  const res2 = await apply([["AddRecord", T.lvs, null, {
    Projekt: pid, LV_Nummer: v("qLvNummer"), LV_Bezeichnung: v("qLvName"), Gewerk: v("qGewerk"), Bearbeitungsstand: "Entwurf"
  }]]);
  sel.projectId = pid;
  sel.lvId = newRowId(res2);
  sel.nodeId = sel.posId = null;
  validateSelection();
  if (view === "projects") setView("edit");
  renderAll();
  const tpl = $("qTemplate").value;
  if (tpl) await insertTemplate(tpl); else openTitleDialog(null, null);
}

// ------------------------------------------------------
// LV-ANGABEN (Texte, Deckblatt, Status)
// ------------------------------------------------------
const LV_FIELDS = ["LV_Nummer", "LV_Bezeichnung", "Gewerk", "Bearbeitungsstand",
  "Vergabeverfahren", "Angebotsfrist", "Submission", "Zuschlagsfrist", "Ort_Angebotsabgabe"];

function openLvDialog(focusId) {
  const l = lv();
  if (!l) return;
  const st = $("lv_Bearbeitungsstand");
  st.innerHTML = "";
  ["", ...choices.Bearbeitungsstand].forEach(c => st.add(new Option(c || "–", c)));
  for (const f of LV_FIELDS) {
    const el = $("lv_" + f);
    const exists = f in l;
    el.closest(".field").hidden = !exists;
    el.value = exists ? (l[f] ?? "") : "";
  }
  $("lvDialog").showModal();
  if (focusId) $(focusId)?.focus();
}

async function saveLvDialog(ev) {
  ev.preventDefault();
  const l = lv();
  $("lvDialog").close();
  const values = {};
  for (const f of LV_FIELDS) if (f in l) values[f] = $("lv_" + f).value;
  await apply([["UpdateRecord", T.lvs, l.id, values]]);
  renderAll();
}

// ------------------------------------------------------
// EINSTELLUNGEN
// ------------------------------------------------------
function openSettings() {
  $("sPlaner").value = settings.planer || project()?.Architekt || "";
  $("sAnschrift").value = settings.anschrift;
  $("sKontakt").value = settings.kontakt;
  $("sMwst").value = String(settings.mwst).replace(".", ",");
  $("sStep").value = settings.step;
  pendingLogo = settings.logo || "";
  showLogoPreview();
  $("settingsDialog").showModal();
}

async function saveSettings(ev) {
  ev.preventDefault();
  settings = {
    ...settings,
    planer: $("sPlaner").value.trim(),
    anschrift: $("sAnschrift").value,
    kontakt: $("sKontakt").value,
    mwst: parseDe($("sMwst").value) || 19,
    step: Math.max(1, Math.round(parseDe($("sStep").value)) || 10),
    logo: pendingLogo || ""
  };
  $("settingsDialog").close();
  try {
    await grist.widgetApi.setOptions(settings);
    toast("Einstellungen gespeichert.");
  } catch (e) {
    toast("Einstellungen nur für diese Sitzung übernommen (Widget-Optionen nicht speicherbar).");
  }
  renderAll();
}

function syncPrintStyle() {
  document.querySelectorAll("[data-pstyle]").forEach(b => b.classList.toggle("on", b.dataset.pstyle === printStyle()));
}

// Logo für den Druck: SVG bleibt Vektor, Pixelbilder werden auf max. 800 px verkleinert (PNG)
let pendingLogo = "";
function showLogoPreview() {
  $("sLogoPreview").innerHTML = pendingLogo ? `<img src="${pendingLogo}" alt="Logo">` : '<span class="muted">Kein Logo</span>';
  $("sLogoRemove").hidden = !pendingLogo;
}
function readLogo(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    const url = String(r.result);
    if (/^data:image\/svg/.test(url)) { pendingLogo = url; return showLogoPreview(); }
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 800 / Math.max(img.width, img.height));
      const c = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      pendingLogo = c.toDataURL("image/png");
      showLogoPreview();
    };
    img.src = url;
  };
  r.readAsDataURL(file);
}

// ------------------------------------------------------
// DOKUMENTANSICHT (BILDSCHIRM)
// ------------------------------------------------------
function renderDocument() {
  const el = $("documentView");
  const l = lv(), pr = project();
  if (!l || !pr) {
    el.innerHTML = '<div class="doc-empty">Bitte Projekt und LV wählen.</div>';
    return;
  }
  const out = [];
  const draw = parentId => {
    for (const t of childrenOf(parentId)) {
      const lvl = Math.min(level(t), 3);
      out.push(`<div class="doc-h l${lvl}"><span class="oz">${esc(nodeOz(t))}</span><span>${esc(nodeName(t))}</span></div>`);
      if (textOn(t, "Vorbemerkung")) out.push(`<div class="doc-pre"><b>Vorbemerkung</b><br>${esc(t.Vorbemerkung)}</div>`);
      for (const p of positionsOf(t.id)) {
        const k = typeKey(p);
        out.push(`<div class="doc-pos ${isActive(p.Aktiv) ? "" : "inactive"}" data-doc-pos="${p.id}">
          <span class="oz">${esc(p.Positionsnummer)}</span>
          <div><div class="kt">${esc(p.Kurztext || "(ohne Kurztext)")}${k !== "normal" ? `<span class="badge b-${k}">${TYPE_LABEL[k]}</span>` : ""}</div>
          ${p.Langtext ? `<div class="lt">${esc(p.Langtext)}</div>` : ""}</div>
          <span class="r">${fmtQty(p.Menge)}</span><span>${esc(p.Einheit)}</span>
          <span class="r">${fmtMoney(p.Einheitspreis)}</span>
          <span class="r">${k === "normal" ? fmtMoney(lineTotal(p)) : '<span class="nur-ep">Nur EP</span>'}</span>
        </div>`);
      }
      draw(t.id);
      if (textOn(t, "Nachbemerkung")) out.push(`<div class="doc-pre"><b>Nachbemerkung</b><br>${esc(t.Nachbemerkung)}</div>`);
      if (!redundantSum(t)) out.push(`<div class="doc-sum"><span></span><span>Summe ${esc(nodeOz(t))} ${esc(nodeName(t))}</span><span class="r">${fmtMoney(nodeTotal(t.id))} €</span></div>`);
    }
  };
  draw(null);
  const net = lvTotal(), vat = round2(net * settings.mwst / 100);
  el.innerHTML = `<div class="doc">
    <div class="doc-head">
      <div>
        <div class="eyebrow">Leistungsverzeichnis${lvState(l) ? " · " + esc(lvState(l)) : ""}</div>
        <h1>${esc(lvNr(l))} ${esc(lvName(l))}</h1>
        <div class="doc-meta">
          <span>Projekt</span><b>${esc(pr.Projektnummer)} · ${esc(pr.Projektname)}</b>
          <span>Auftraggeber</span><b>${esc(pr.Bauherr)}</b>
          ${l.Gewerk ? `<span>Gewerk</span><b>${esc(l.Gewerk)}</b>` : ""}
        </div>
      </div>
    </div>
    ${textOn(l, "Vorbemerkung") ? `<div class="doc-pre" style="margin-left:0"><b>Vorbemerkungen</b><br>${esc(l.Vorbemerkung)}</div>` : ""}
    <div class="doc-grid"><span>OZ</span><span>Leistungsbeschreibung</span><span>Menge</span><span>ME</span><span>EP €</span><span>GB €</span></div>
    ${out.join("") || '<div class="doc-empty">Noch keine Titel.</div>'}
    <div class="doc-total">
      <div><span>LV-Summe netto</span><b>${fmtMoney(net)} €</b></div>
      <div><span>zzgl. ${String(settings.mwst).replace(".", ",")} % MwSt.</span><b>${fmtMoney(vat)} €</b></div>
      <div class="big"><span>LV-Summe brutto</span><span>${fmtMoney(net + vat)} €</span></div>
    </div>
    ${textOn(l, "Nachbemerkung") ? `<div class="doc-pre" style="margin:20px 0 0"><b>Nachbemerkungen</b><br>${esc(l.Nachbemerkung)}</div>` : ""}
    <p class="muted">Inaktive Positionen sind ausgegraut. Eventual-, Bedarfs- und Alternativpositionen werden nicht in die Summe gerechnet.</p>
  </div>`;
}

// ------------------------------------------------------
// DRUCK (A4, angelehnt an klassische AVA-Ausdrucke)
// ------------------------------------------------------
function printLV(mode) {
  const l = lv(), pr = project();
  if (!l || !pr) return toast("Bitte zuerst Projekt und LV wählen.");
  const w = window.open("", "_blank");
  if (!w) return toast("Bitte Pop-ups für dieses Widget erlauben.");
  w.document.open();
  w.document.write(mode === "kosten" ? buildCostHtml() : buildPrintHtml(mode));
  w.document.close();
}

function buildPrintHtml(mode) {
  const l = lv(), pr = project();
  const priced = mode !== "ausschreibung";
  const short = mode === "kurz";
  const docTitle = mode === "ausschreibung" ? "Ausschreibung" : mode === "kurz" ? "Kurz-LV" : "Kostenvoranschlag";
  const dots = '<span class="dots"></span>';
  const money = v => priced ? fmtMoney(v) : dots;
  const now = new Date();
  const stamp = `${now.toLocaleDateString("de-DE")} ${now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  const planer = settings.planer || pr.Architekt || "";
  const addr = [pr.Strasse ?? pr["Straße"], [pr.PLZ, pr.Ort].filter(Boolean).join(" ")].filter(Boolean);
  const net = lvTotal(), vat = round2(net * settings.mwst / 100);
  const nodes = walk();
  const active = id => positionsOf(id).filter(p => isActive(p.Aktiv));

  // Positionsteil
  const body = [];
  const draw = parentId => {
    for (const t of childrenOf(parentId)) {
      body.push(`<div class="h h${Math.min(level(t), 3)}"><span>${esc(nodeOz(t))}</span><span>${esc(nodeName(t))}</span></div>`);
      if (textOn(t, "Vorbemerkung") && !short) body.push(`<div class="pre"><span class="pl">Vorbemerkung</span>${br(t.Vorbemerkung)}</div>`);
      for (const p of active(t.id)) {
        const k = typeKey(p);
        const label = k !== "normal" ? `<span class="tag">${TYPE_LABEL[k]}position</span>` : "";
        const gb = k === "normal" ? money(lineTotal(p)) : '<span class="nur">Nur Einh.-Pr.</span>';
        body.push(`<div class="pos">
          <div class="pos-text"><span class="oz">${esc(p.Positionsnummer)}</span>
            <div><b>${esc(p.Kurztext)}</b>${label}${p.Langtext && !short ? `<div class="lt">${br(p.Langtext)}</div>` : ""}</div></div>
          <div class="pos-calc"><span>${fmtQty(p.Menge)} ${esc(p.Einheit)}</span><span>${priced ? fmtMoney(p.Einheitspreis) : dots}</span><span>${gb}</span></div>
        </div>`);
      }
      draw(t.id);
      if (textOn(t, "Nachbemerkung") && !short) body.push(`<div class="pre"><span class="pl">Nachbemerkung</span>${br(t.Nachbemerkung)}</div>`);
      if (!redundantSum(t)) body.push(`<div class="sum"><span></span><span>Summe ${esc(nodeOz(t))} ${esc(nodeName(t))}</span><span>${money(nodeTotal(t.id))}</span></div>`);
    }
  };
  draw(null);

  // Zusammenstellung: tiefste Ebenen zuerst (wie im Beispiel-LV)
  const postOrder = [];
  const po = parentId => { for (const t of childrenOf(parentId)) { po(t.id); postOrder.push(t); } };
  po(null);

  const toc = nodes.map(t => `<tr class="toc-l${Math.min(level(t), 3)}"><td>${esc(nodeOz(t))}</td><td>${esc(nodeName(t))}</td></tr>`).join("");
  const recap = postOrder.filter(t => !redundantSum(t)).map(t => {
    const lv1 = level(t) === 1;
    return `<tr class="${lv1 ? "l1" : "sub sub" + Math.min(level(t), 3)}"><td>${esc(nodeOz(t))}</td><td>${esc(nodeName(t))}</td><td class="r">${money(nodeTotal(t.id))}</td></tr>`;
  }).join("");
  const eur = v => priced ? fmtMoney(v) + " €" : dots;
  const totals = `<div class="tot">
    <div class="n"><span>LV-Summe netto</span><span>${eur(net)}</span></div>
    <div><span>zzgl. ${String(settings.mwst).replace(".", ",")} % MwSt.</span><span>${eur(vat)}</span></div>
    <div class="b"><span>LV-Summe brutto</span><span>${eur(net + vat)}</span></div>
  </div>`;
  const sign = `<div class="sign"><div>Ort</div><div>Datum</div><div>Stempel und Unterschrift Bieter</div></div>`;
  const line = label => `<div class="fill"><span>${label}</span><span class="dots"></span></div>`;

  const footLeft = `${pr.Projektnummer || ""} ${pr.Projektname || ""} · LV ${lvNr(l)} ${lvName(l)}`.trim();
  const cssStr = v => '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ") + '"';
  const pagedSrc = new URL("vendor/paged.polyfill.min.js", location.href).href;
  const runningHead = `<div class="rh"><div class="rhg">
    <span>Auftraggeber</span><span>${esc(pr.Bauherr)}</span>
    <span>Planer</span><span>${esc(planer)}</span>
    <span>Projekt</span><span>${esc(pr.Projektnummer)} – ${esc(pr.Projektname)}</span>
    <span>LV</span><span>${esc(lvNr(l))} – ${esc(lvName(l))}</span>
  </div></div>`;

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>${esc(pr.Projektnummer)}_LV ${esc(lvNr(l))} ${esc(lvName(l))}</title>
<style>
  @page { size: A4; margin: 36mm 14mm 20mm 20mm;
    @top-left { content: element(rh); vertical-align: bottom; padding-bottom: 4mm; width: 100%; }
    @bottom-left { width: 92mm; content: ${cssStr(footLeft)}; font: 7.5pt Arial, sans-serif; color: #555; vertical-align: top; padding-top: 2mm; border-top: .5pt solid #bbb; }
    @bottom-center { width: 48mm; content: ${cssStr("Druck: " + stamp)}; font: 7.5pt Arial, sans-serif; color: #555; vertical-align: top; padding-top: 2mm; border-top: .5pt solid #bbb; }
    @bottom-right { width: 36mm; text-align: right; content: "Seite " counter(page) " von " counter(pages); font: 7.5pt Arial, sans-serif; color: #555; vertical-align: top; padding-top: 2mm; border-top: .5pt solid #bbb; } }
  @page cover { margin: 14mm 14mm 14mm 20mm;
    @top-left { content: none; } @bottom-left { content: none; border: 0; } @bottom-center { content: none; border: 0; } @bottom-right { content: none; border: 0; } }
  .cover { page: cover; }
  .rh { position: running(rh); }
  * { box-sizing: border-box; }
  body { font: 9pt/1.4 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  .doc-kind { font-size: 8pt; text-transform: uppercase; letter-spacing: .14em; color: #555; }
  .cover { break-after: page; min-height: 262mm; display: flex; flex-direction: column; gap: 9mm; }
  .cover h1 { font-size: 22pt; margin: 2mm 0 0; }
  .cover .big { font-size: 13pt; font-weight: bold; margin-top: 1mm; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
  .box h3 { font-size: 8pt; text-transform: uppercase; letter-spacing: .1em; color: #555; margin: 0 0 2mm; border-bottom: .5pt solid #999; padding-bottom: 1mm; }
  .fill { display: flex; gap: 3mm; align-items: flex-end; margin: 3.2mm 0; }
  .fill span:first-child { width: 30mm; flex: none; }
  .dots { flex: 1; display: inline-block; min-width: 22mm; border-bottom: .6pt dotted #333; height: 1em; }
  .sign { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 8mm; margin-top: 16mm; }
  .sign div { border-top: .6pt dotted #333; padding-top: 1mm; font-size: 7.5pt; color: #555; text-align: center; }
  .cover .sign { margin-top: auto; }
  .rh { width: 100%; text-align: left; font-size: 8pt; border-bottom: .8pt solid #111; padding-bottom: 2mm; }
  .rhg { display: grid; grid-template-columns: 26mm 1fr; }
  .rhg span:nth-child(odd) { color: #555; }
  .colhead { display: grid; grid-template-columns: 24mm 1fr 72mm; font-size: 7.5pt; font-weight: bold; padding: 2mm 0 1mm; border-bottom: .5pt solid #999; margin-top: 2mm; }
  .colhead .calc, .pos-calc { display: grid; grid-template-columns: 24mm 24mm 24mm; text-align: right; }
  .h { display: grid; grid-template-columns: 24mm 1fr; font-weight: bold; break-after: avoid; }
  .h1 { font-size: 11pt; margin: 6mm 0 2mm; } .h2 { font-size: 10pt; margin: 4mm 0 1.5mm; } .h3 { font-size: 9pt; margin: 3mm 0 1mm; }
  .pl { display: block; font-size: 7pt; text-transform: uppercase; letter-spacing: .08em; color: #666; margin-bottom: .5mm; }
  .pre { margin: 0 0 2mm 24mm; padding: 1.5mm 2.5mm; border-left: 1.5pt solid #bbb; color: #333; }
  .pos { break-inside: avoid; padding: 1.8mm 0 2.2mm; }
  .pos-text { display: grid; grid-template-columns: 24mm 1fr; }
  .lt { margin-top: .8mm; }
  .pos-calc { margin-left: auto; width: 72mm; margin-top: 1.2mm; align-items: end; }
  .pos-calc .dots { width: 21mm; margin-left: 3mm; }
  .tag { margin-left: 2mm; font-size: 7pt; padding: .2mm 1.4mm; border: .5pt solid #888; border-radius: 1mm; color: #444; }
  .nur { font-style: italic; font-size: 8pt; }
  .sum { display: grid; grid-template-columns: 24mm 1fr 30mm; align-items: end; font-weight: bold; padding: 5mm 0 3mm; border-top: .5pt solid #999; break-before: avoid; }
  .sum span:last-child { text-align: right; } .sum .dots { width: 26mm; }
  .page { break-before: page; }
  .closing { display: flex; flex-direction: column; min-height: 230mm; }
  .closing .sign { margin-top: auto; }
  table.z { width: 100%; border-collapse: collapse; }
  table.z th { font-size: 7.5pt; text-align: left; border-bottom: .5pt solid #999; padding: 0 0 1mm; }
  table.z th.r, table.z td.r { text-align: right; }
  table.z td { padding: 1.6mm 0; border-bottom: .3pt solid #e2e2e2; vertical-align: bottom; }
  table.z td:first-child { width: 24mm; }
  table.z td.r { width: 36mm; } table.z td.r .dots { width: 30mm; }
  table.z tr.l1 td { font-weight: bold; }
  table.z tr.sub td { color: #555; font-size: 8.5pt; padding: 1mm 0; } table.z tr.sub td.r .dots { width: 24mm; }
  table.z tr.sub2 td:nth-child(2) { padding-left: 5mm; } table.z tr.sub3 td:nth-child(2) { padding-left: 10mm; }
  .tot { margin: 6mm 0 0 auto; width: 92mm; break-inside: avoid; }
  .tot div { display: flex; justify-content: space-between; align-items: flex-end; padding: 1.3mm 0; }
  .tot .n { border-top: .8pt solid #111; font-weight: bold; padding-top: 2mm; }
  .tot .b { border-top: .5pt solid #999; border-bottom: 2.2pt double #111; font-weight: bold; font-size: 10.5pt; padding: 2mm 0; }
  .tot .dots { width: 34mm; flex: none; }
  .nb { margin-top: 10mm; }
  h2 { font-size: 11pt; margin: 2mm 0 3mm; }
  table.list { width: 100%; border-collapse: collapse; }
  table.list td { padding: 1.2mm 0; vertical-align: bottom; }
  table.list td:first-child { width: 24mm; }
  table.list td.r { text-align: right; width: 40mm; }
  table.list td.r .dots { width: 32mm; }
  table.list tr.strong td { font-weight: bold; border-bottom: .5pt solid #bbb; }
  table.list tr.tot td { font-weight: bold; }
  .toc-l2 td:last-child { padding-left: 4mm; } .toc-l3 td:last-child { padding-left: 8mm; }
  .toc-l1 td { font-weight: bold; padding-top: 2.2mm; }
  .note { font-size: 8pt; color: #555; margin-top: 6mm; }
</style></head><body>

<section class="cover">
  <div>
    <div class="doc-kind">${docTitle}</div>
    <div class="cols" style="margin-top:6mm">
      <div><div class="doc-kind">Projekt</div><div class="big">${esc(pr.Projektnummer)} / ${esc(pr.Projektname)}</div></div>
      <div><div class="doc-kind">Leistungsverzeichnis</div><div class="big">${esc(lvNr(l))} / ${esc(lvName(l))}</div></div>
    </div>
  </div>
  <div class="cols">
    <div class="box"><h3>Auftraggeber</h3>${esc(pr.Bauherr)}<br>${addr.map(esc).join("<br>")}</div>
    <div class="box"><h3>Planer</h3>${esc(planer)}<br>${br(settings.anschrift)}${settings.kontakt ? "<br><br>" + br(settings.kontakt) : ""}</div>
  </div>
  ${mode === "ausschreibung" ? `
  <div class="cols">
    <div class="box"><h3>Ort der Angebotsabgabe / Submission</h3>${br(pick(l, "Ort_Angebotsabgabe"))}</div>
    <div class="box"><h3>Termine</h3>
      <div class="fill"><span>Vergabeverfahren:</span>${esc(pick(l, "Vergabeverfahren")) || '<span class="dots"></span>'}</div>
      <div class="fill"><span>Angebotsabgabe:</span>${esc(pick(l, "Angebotsfrist") || fmtDate(l.Abgabedatum)) || '<span class="dots"></span>'}</div>
      <div class="fill"><span>Submission:</span>${esc(pick(l, "Submission")) || '<span class="dots"></span>'}</div>
      <div class="fill"><span>Zuschlagsfrist:</span>${esc(pick(l, "Zuschlagsfrist")) || '<span class="dots"></span>'}</div>
    </div>
  </div>
  <div class="cols">
    <div class="box"><h3>Bieter</h3>${line("Name:")}${line("Straße:")}${line("PLZ / Ort:")}${line("Land:")}${line("Ansprechpartner:")}</div>
    <div class="box"><h3>Angebot</h3>${line("LV-Summe (netto)")}${line("zzgl. MwSt.")}${line("LV-Summe (brutto)")}</div>
  </div>
  ${sign}` : `
  <div class="cols"><div></div><div class="box"><h3>Kostenansatz</h3>
    <div class="fill"><span>LV-Summe (netto)</span><b style="margin-left:auto">${fmtMoney(net)} €</b></div>
    <div class="fill"><span>zzgl. MwSt.</span><b style="margin-left:auto">${fmtMoney(vat)} €</b></div>
    <div class="fill"><span>LV-Summe (brutto)</span><b style="margin-left:auto">${fmtMoney(net + vat)} €</b></div>
    <div class="note">Stand: ${now.toLocaleDateString("de-DE")}${lvState(l) ? " · " + esc(lvState(l)) : ""}</div></div></div>`}
</section>

${runningHead}
<main>
  <h2>Inhaltsverzeichnis</h2>
  <table class="list">${toc}</table>
  ${textOn(l, "Vorbemerkung") ? `<div class="page"><h2>Vorbemerkungen</h2><div>${br(l.Vorbemerkung)}</div></div>` : ""}
  <div class="page">
    <div class="colhead"><span>OZ</span><span>Leistungsbeschreibung</span><span class="calc"><span>Menge ME</span><span>EP in €</span><span>GB in €</span></span></div>
    ${body.join("")}
  </div>

  <div class="page closing">
    <h2>Zusammenstellung</h2>
    <table class="z"><thead><tr><th>OZ</th><th>Titel</th><th class="r">Betrag in €</th></tr></thead><tbody>${recap}</tbody></table>
    ${totals}
    ${textOn(l, "Nachbemerkung") ? `<div class="nb"><span class="pl">Nachbemerkungen</span>${br(l.Nachbemerkung)}</div>` : ""}
    ${mode === "ausschreibung" ? sign : ""}
  </div>
</main>
<script>
  let printed = false;
  const go = () => { if (!printed) { printed = true; setTimeout(() => window.print(), 300); } };
  window.PagedConfig = { auto: true, after: go };
  setTimeout(() => { if (!window.PagedPolyfill) go(); }, 6000);
<\/script>
<script src="${pagedSrc}" onerror="go()"><\/script>
</body></html>`;
  return printStyle() === "modern" ? modernizePrint(html, { docTitle, pr, l, planer, stamp }) : html;
}

// ------------------------------------------------------
// DRUCKSTIL „MODERN“: gleiche Inhalte wie das klassische LV,
// Gestaltung wie die Kostenschätzung (Linien, Graustufen, Logo unten rechts)
// ------------------------------------------------------
const printStyle = () => settings.printStyle === "modern" ? "modern" : "klassisch";

function modernizePrint(html, { docTitle, pr, l, planer, stamp }) {
  const cssStr = v => '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ") + '"';
  // 1. Seitenränder und Fußzeile: Seite/Druckdatum links, Logo rechts
  html = html.replace(/@page \{ size: A4; margin:[\s\S]*?\.rh \{ position: running\(rh\); \}/, `@page { size: A4; margin: 34mm 20mm 28mm 20mm;
    @top-left { content: element(rh); vertical-align: bottom; padding-bottom: 5mm; width: 100%; }
    @bottom-left { width: 90mm; content: "Seite " counter(page) " von " counter(pages) ${cssStr("  ·  Druck " + stamp)}; font: 7pt Arial, sans-serif; color: #777; vertical-align: bottom; padding-bottom: 16.35mm; white-space: pre; }
    @bottom-right { width: 80mm; content: element(logo); vertical-align: bottom; text-align: right; padding-bottom: 16.35mm; } }
  @page cover { margin: 16mm 20mm 28mm 20mm;
    @top-left { content: none; } @bottom-left { content: none; } }
  .cover { page: cover; }
  .rh { position: running(rh); }
  .logo-run { position: running(logo); text-align: right; line-height: 0; }
  .logo-run img { max-height: 11mm; max-width: 80mm; display: inline-block; }`);
  // 2. Gestaltung
  html = html.replace("</style>", `
  /* ---- Modern ---- */
  .doc-kind { font-size: 7.5pt; letter-spacing: .18em; color: #111; font-weight: bold; }
  .m-head h1 { font-size: 22pt; margin: 2mm 0 1mm; letter-spacing: -.01em; }
  .m-head .m-sub { color: #555; font-size: 10.5pt; }
  .m-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin: 7mm 0 0; padding: 3mm 0; border-top: 1.2pt solid #111; border-bottom: .4pt solid #111; }
  .m-meta span { display: block; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .1em; color: #666; margin-bottom: .6mm; }
  .cover { gap: 8mm; min-height: 240mm; }
  .cols { gap: 8mm; }
  .box h3 { font-size: 6.5pt; letter-spacing: .1em; color: #666; font-weight: normal; border: 0; border-top: 1.2pt solid #111; padding: 1.8mm 0 0; margin: 0 0 2mm; }
  .dots { border-bottom: .5pt solid #999; }
  .sign div { border-top: .5pt solid #111; }
  .rh { display: flex; gap: 5mm; align-items: baseline; width: 100%; border-bottom: .4pt solid #111; padding-bottom: 1.5mm; font-size: 7.5pt; }
  .rh .rhg { display: none; }
  .rh .m-rh-l { margin-right: 5mm; text-transform: uppercase; letter-spacing: .12em; font-weight: bold; font-size: 7pt; }
  .rh .m-rh-r { color: #555; }
  .colhead { border-bottom: 1.2pt solid #111; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .06em; font-weight: normal; color: #666; padding-bottom: 1.5mm; }
  .h1 { font-size: 11.5pt; margin: 8mm 0 2mm; padding-bottom: 1.5mm; border-bottom: .8pt solid #111; }
  .h2 { font-size: 10pt; margin: 5mm 0 1.5mm; padding-bottom: 1mm; border-bottom: .4pt solid #999; }
  .h3 { font-size: 9pt; margin: 4mm 0 1mm; }
  .h > span:first-child { font-weight: normal; color: #555; }
  .pos { border-bottom: .3pt solid #e2e2e2; padding: 2mm 0 2.4mm; }
  .pos-text > span:first-child { color: #777; font-size: 8pt; }
  .pre { border-left: 0; border-top: .4pt solid #111; padding: 1.5mm 0 0; margin: 1mm 0 3mm 24mm; }
  .pl { font-size: 6.5pt; letter-spacing: .1em; }
  .sum { border-top: .8pt solid #111; padding-top: 2.5mm; }
  .tag { border-radius: 0; }
  h2 { font-size: 13pt; letter-spacing: -.005em; }
  table.list tr.toc-l1 td { border-bottom: .4pt solid #111; }
  table.z th { border-bottom: 1.2pt solid #111; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .06em; font-weight: normal; color: #666; }
  table.z tr.l1 td { border-bottom: .4pt solid #999; }
  .tot .n { border-top: 1.2pt solid #111; }
  .tot .b { border-top: .4pt solid #111; }
</style>`);
  // 3. Deckblatt-Kopf wie bei der Kostenschätzung
  {
    const a = html.indexOf('<section class="cover">');
    const z = html.indexOf('<div class="cols">\n    <div class="box"><h3>Auftraggeber');
    if (a >= 0 && z > a) html = html.slice(0, a) + `<section class="cover">
  <div class="m-head">
    <div class="doc-kind">${esc(docTitle)}</div>
    <h1>${esc(pr.Projektname || "")}</h1>
    <div class="m-sub">LV ${esc(lvNr(l))} ${esc(lvName(l) || "")}${l.Gewerk ? " · " + esc(l.Gewerk) : ""}</div>
    <div class="m-meta">
      <div><span>Projekt</span>${esc(pr.Projektnummer || "–")}</div>
      <div><span>Bauherr</span>${esc(pr.Bauherr || "–")}</div>
      <div><span>Aufgestellt</span>${esc(planer || "–")}<br>${new Date().toLocaleDateString("de-DE")}</div>
    </div>
  </div>
  ` + html.slice(z);
  }
  // 4. Laufender Kopf: einzeilig
  html = html.replace(/<div class="rh"><div class="rhg">/, `<div class="rh"><span class="m-rh-l">${esc(docTitle)}</span><span class="m-rh-r">${esc(`${pr.Projektnummer || ""} ${pr.Projektname || ""} · LV ${lvNr(l)} ${lvName(l)}`)}</span><div class="rhg">`);
  // 5. Logo
  // innerhalb des Deckblatts einfügen, sonst entsteht vor dem Deckblatt eine leere Seite
  if (settings.logo) html = html.replace('<section class="cover">', `<section class="cover">\n<div class="logo-run"><img src="${settings.logo}" alt=""></div>`);
  return html;
}

// ------------------------------------------------------
// KOSTENSCHÄTZUNG („LV light“): kompaktes Layout ohne Langtexte
// ------------------------------------------------------
function buildCostHtml() {
  const l = lv(), pr = project();
  const now = new Date();
  const stamp = `${now.toLocaleDateString("de-DE")} ${now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  const planer = settings.planer || pr.Architekt || "";
  const addr = [pick(pr, "Strasse", "Straße"), [pr.PLZ, pr.Ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const net = lvTotal(), vat = round2(net * settings.mwst / 100);
  const share = v => net ? Math.round(v / net * 1000) / 10 : 0;
  const pct = v => share(v).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
  const footLeft = `${pr.Projektnummer || ""} ${pr.Projektname || ""} · Kostenschätzung ${lvName(l)}`.trim();
  const cssStr = v => '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ") + '"';
  const pagedSrc = new URL("vendor/paged.polyfill.min.js", location.href).href;

  const rows = [];
  const hasActive = id => positionsOf(id).some(x => isActive(x.Aktiv)) || childrenOf(id).some(c => hasActive(c.id));
  const draw = parentId => {
    for (const t of childrenOf(parentId)) {
      if (!hasActive(t.id)) continue; // ganz abgeschaltete Gruppen weglassen
      const lvl = Math.min(level(t), 3), sum = nodeTotal(t.id);
      rows.push(`<tr class="t t${lvl}"><td>${esc(nodeOz(t))}</td><td colspan="4">${esc(nodeName(t))}</td><td class="r">${fmtMoney(sum)}</td><td class="r p">${lvl === 1 ? pct(sum) : ""}</td></tr>`);
      if (textOn(t, "Vorbemerkung")) rows.push(`<tr class="note"><td></td><td colspan="6">${br(t.Vorbemerkung)}</td></tr>`);
      for (const p of positionsOf(t.id).filter(x => isActive(x.Aktiv))) {
        const k = typeKey(p);
        rows.push(`<tr class="pos${k !== "normal" ? " opt" : ""}"><td>${esc(p.Positionsnummer)}</td><td>${esc(p.Kurztext || "")}${k !== "normal" ? ` <span class="tag">${TYPE_LABEL[k]}</span>` : ""}</td>
          <td class="r">${fmtQty(p.Menge)}</td><td>${esc(p.Einheit || "")}</td><td class="r">${fmtMoney(p.Einheitspreis)}</td>
          <td class="r">${k === "normal" ? fmtMoney(lineTotal(p)) : "<i>nur EP</i>"}</td><td></td></tr>`);
      }
      draw(t.id);
    }
  };
  draw(null);

  const top = childrenOf(null);
  // Verteilung: ein durchgehender Balken in Grautönen, darunter eine Legende als Tabelle
  const GREYS = ["#111111", "#4a4a4a", "#7a7a7a", "#a3a3a3", "#c6c6c6", "#dedede", "#2e2e2e", "#949494"];
  const parts = top.filter(t => nodeTotal(t.id) > 0);
  const stackBar = parts.map((t, i) => `<i style="flex:${nodeTotal(t.id)};background:${GREYS[i % GREYS.length]}"></i>`).join("");
  const legend = parts.map((t, i) => {
    const v = nodeTotal(t.id);
    return `<tr><td><span class="sw" style="background:${GREYS[i % GREYS.length]}"></span></td><td>${esc(nodeOz(t))}</td><td>${esc(nodeName(t))}</td><td class="r">${fmtMoney(v)}</td><td class="r">${pct(v)}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>${esc(pr.Projektnummer)}_Kostenschaetzung ${esc(lvName(l))}</title>
<style>
  /* Satzspiegel nach der Briefvorlage: 20 mm links/rechts, Logo rechtsbündig 16 mm über dem unteren Rand */
  @page { size: A4; margin: 16mm 20mm 28mm 20mm;
    @bottom-right { content: element(logo); vertical-align: bottom; text-align: right; padding-bottom: 16.35mm; width: 100mm; } }
  .logo-run { position: running(logo); text-align: right; line-height: 0; }
  .logo-run img { max-height: 11mm; max-width: 80mm; display: inline-block; }
  * { box-sizing: border-box; }
  body { font: 9pt/1.4 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  .kind { font-size: 7.5pt; letter-spacing: .18em; text-transform: uppercase; color: #111; font-weight: bold; }
  h1 { font-size: 20pt; margin: 1.5mm 0 1mm; letter-spacing: -.01em; font-weight: bold; }
  .sub { color: #555; font-size: 10pt; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin: 7mm 0 7mm; padding: 3mm 0; border-top: 1.2pt solid #111; border-bottom: .4pt solid #111; }
  .meta span { display: block; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .1em; color: #666; margin-bottom: .6mm; }
  .dist { margin-bottom: 5mm; break-inside: avoid; }
  .stackbar { display: flex; height: 7mm; gap: .6mm; margin: 1.5mm 0 3mm; }
  .stackbar i { display: block; min-width: .8mm; }
  table.leg { width: 100%; border-collapse: collapse; font-size: 8.5pt; table-layout: fixed; align-self: start; }
  table.leg td { padding: 1mm 0; border-bottom: .3pt solid #ddd; vertical-align: middle; }
  table.leg td { vertical-align: top; width: auto !important; padding-left: 0 !important; } table.leg td.r { white-space: nowrap; }
  table.leg td:nth-child(2), table.leg td:nth-child(5) { color: #666; font-size: 8pt; }
  .sw { display: inline-block; width: 3mm; height: 3mm; margin-top: .6mm; }
  .hero { display: flex; justify-content: flex-end; gap: 8mm; margin-bottom: 8mm; break-inside: avoid; }
  .total { border-top: 1.2pt solid #111; padding-top: 1mm; }
  .total div { display: flex; justify-content: space-between; gap: 4mm; padding: 1.1mm 0; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .total .n { font-weight: bold; }
  .total .b { border-top: .4pt solid #111; border-bottom: 2.2pt double #111; margin-top: 1mm; padding: 2mm 0; font-size: 11.5pt; font-weight: bold; }
  .basis { border-top: .4pt solid #111; padding: 2mm 0 0; margin: 0 0 6mm; color: #222; break-inside: avoid; }
  .lbl { font-size: 7pt; text-transform: uppercase; letter-spacing: .1em; color: #777; display: block; margin-bottom: 1mm; }
  table { width: 100%; border-collapse: collapse; }
  thead th { font-size: 7pt; text-transform: uppercase; letter-spacing: .06em; color: #777; font-weight: normal; text-align: left; padding: 0 0 1.5mm; border-bottom: .8pt solid #111; }
  th.r, td.r { text-align: right; }
  td { padding: 1.3mm 0; vertical-align: top; font-variant-numeric: tabular-nums; }
  td:first-child { width: 20mm; color: #777; font-size: 8pt; }
  td:nth-child(3) { width: 18mm; } td:nth-child(4), th:nth-child(4) { width: 10mm; padding-left: 2mm; } td:nth-child(5) { width: 20mm; } td:nth-child(6) { width: 24mm; } td:nth-child(7) { width: 13mm; }
  tr.pos td { border-bottom: .3pt solid #e6e6e6; }
  tr.opt td { color: #888; } tr.opt i { font-size: 7.5pt; }
  tr.t td { font-weight: bold; padding-top: 4mm; border-bottom: .5pt solid #999; color: #111; }
  tr.t1 td { font-size: 10pt; } tr.t1 td:first-child { font-size: 9pt; }
  tr.t2 td, tr.t3 td { padding-top: 2.5mm; font-size: 9pt; border-bottom-color: #ccc; }
  tr.t td.p { color: #111; font-size: 8pt; font-weight: normal; }
  tr.note td { color: #555; font-size: 8pt; padding: 1mm 0 1.5mm; }
  tr { break-inside: avoid; }
  tr.t { break-after: avoid; }
  .tag { font-size: 6.5pt; border: .5pt solid #aaa; padding: 0 1mm; color: #666; }
  .after { margin-top: 8mm; break-inside: avoid; }
  .hint { margin-top: 6mm; font-size: 7.5pt; color: #777; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; margin-top: 16mm; break-inside: avoid; }
  .sign div { border-top: .6pt solid #333; padding-top: 1mm; font-size: 7.5pt; color: #555; }
</style></head><body>
  ${settings.logo ? `<div class="logo-run"><img src="${settings.logo}" alt=""></div>` : ""}
  <div class="kind">Kostenschätzung</div>
  <h1>${esc(pr.Projektname || "")}</h1>
  ${(() => {
    // Untertitel nur, wenn er etwas anderes sagt als die Überschrift „Kostenschätzung“
    const sub = [lvName(l), l.Gewerk].map(x => String(x || "").trim()).filter(x => x && !/^kostensch(ä|ae)tzung$/i.test(x));
    return sub.length ? `<div class="sub">${sub.map(esc).join(" · ")}</div>` : "";
  })()}
  <div class="meta">
    <div><span>Projekt</span>${esc(pr.Projektnummer || "–")}</div>
    <div><span>Bauherr</span>${esc(pr.Bauherr || "–")}</div>
    <div><span>Aufgestellt</span>${esc(planer || "–")}<br>${now.toLocaleDateString("de-DE")}</div>
  </div>
  <div class="dist">
    <span class="lbl">Verteilung der Kosten (netto)</span>
    <div class="stackbar">${stackBar}</div>
    <table class="leg"><colgroup><col style="width:6mm"><col style="width:10mm"><col><col style="width:30mm"><col style="width:16mm"></colgroup><tbody>${legend}</tbody></table>
  </div>
  <div class="hero">
    <div class="total" style="width:74mm">
      <div class="n"><span>Summe netto</span><span>${fmtMoney(net)} €</span></div>
      <div><span>zzgl. ${String(settings.mwst).replace(".", ",")} % MwSt.</span><span>${fmtMoney(vat)} €</span></div>
      <div class="b"><span>Summe brutto</span><span>${fmtMoney(net + vat)} €</span></div>
    </div>
  </div>
  ${textOn(l, "Vorbemerkung") ? `<div class="basis"><span class="lbl">Grundlagen und Annahmen</span>${br(l.Vorbemerkung)}</div>` : ""}
  <table>
    <thead><tr><th>Nr.</th><th>Bezeichnung</th><th class="r">Menge</th><th>ME</th><th class="r">Kennwert €</th><th class="r">Betrag €</th><th class="r">Anteil</th></tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>
  <div class="after">
    <div class="total" style="width:74mm;margin-left:auto">
      <div class="n"><span>Summe netto</span><span>${fmtMoney(net)} €</span></div>
      <div><span>zzgl. ${String(settings.mwst).replace(".", ",")} % MwSt.</span><span>${fmtMoney(vat)} €</span></div>
      <div class="b"><span>Summe brutto</span><span>${fmtMoney(net + vat)} €</span></div>
    </div>
    ${textOn(l, "Nachbemerkung") ? `<div class="basis" style="margin-top:8mm"><span class="lbl">Hinweise</span>${br(l.Nachbemerkung)}</div>` : ""}
    <div class="hint">Kostenschätzung auf Grundlage des aktuellen Planungsstands. Eventual-, Bedarfs- und Alternativpositionen sind nicht in den Summen enthalten.</div>
  </div>
<script>
  let printed = false;
  const go = () => { if (!printed) { printed = true; setTimeout(() => window.print(), 300); } };
  window.PagedConfig = { auto: true, after: go };
  setTimeout(() => { if (!window.PagedPolyfill) go(); }, 6000);
<\/script>
<script src="${pagedSrc}" onerror="go()"><\/script>
</body></html>`;
}

// ------------------------------------------------------
// VORLAGEN (DIN 276 Kostenschätzung, DIN 277 Flächen)
// ------------------------------------------------------
const TEMPLATES = {
  din276: {
    name: "Kostenschätzung nach DIN 276",
    hint: "Kostengruppen 100–800 als Titel, 2. Ebene als Positionen (1 psch, Betrag eintragen)",
    titles: [
      ["KG 100 Grundstück", ["110 Grundstückswert", "120 Grundstücksnebenkosten", "130 Rechte Dritter"]],
      ["KG 200 Vorbereitende Maßnahmen", ["210 Herrichten", "220 Öffentliche Erschließung", "230 Nichtöffentliche Erschließung", "240 Ausgleichsmaßnahmen und -abgaben", "250 Übergangsmaßnahmen"]],
      ["KG 300 Bauwerk – Baukonstruktionen", ["310 Baugrube / Erdbau", "320 Gründung, Unterbau", "330 Außenwände / Vertikale Baukonstruktionen, außen", "340 Innenwände / Vertikale Baukonstruktionen, innen", "350 Decken / Horizontale Baukonstruktionen", "360 Dächer", "370 Infrastrukturanlagen", "380 Baukonstruktive Einbauten", "390 Sonstige Maßnahmen für Baukonstruktionen"]],
      ["KG 400 Bauwerk – Technische Anlagen", ["410 Abwasser-, Wasser-, Gasanlagen", "420 Wärmeversorgungsanlagen", "430 Raumlufttechnische Anlagen", "440 Elektrische Anlagen", "450 Kommunikations-, sicherheits- und informationstechnische Anlagen", "460 Förderanlagen", "470 Nutzungsspezifische und verfahrenstechnische Anlagen", "480 Gebäude- und Anlagenautomation", "490 Sonstige Maßnahmen für technische Anlagen"]],
      ["KG 500 Außenanlagen und Freiflächen", ["510 Erdbau", "520 Gründung, Unterbau", "530 Oberbau, Deckschichten", "540 Baukonstruktionen", "550 Technische Anlagen", "560 Einbauten in Außenanlagen und Freiflächen", "570 Vegetationsflächen", "580 Wasserflächen", "590 Sonstige Maßnahmen für Außenanlagen und Freiflächen"]],
      ["KG 600 Ausstattung und Kunstwerke", ["610 Allgemeine Ausstattung", "620 Besondere Ausstattung", "630 Informationstechnische Ausstattung", "640 Künstlerische Ausstattung", "690 Sonstige Ausstattung"]],
      ["KG 700 Baunebenkosten", ["710 Bauherrenaufgaben", "720 Vorbereitung der Objektplanung", "730 Objektplanung", "740 Fachplanung", "750 Künstlerische Leistungen", "760 Allgemeine Baunebenkosten", "790 Sonstige Baunebenkosten"]],
      ["KG 800 Finanzierung", ["810 Finanzierungsnebenkosten", "820 Fremdkapitalzinsen", "830 Eigenkapitalzinsen", "840 Bürgschaften", "890 Sonstige Finanzierungskosten"]]
    ].map(([t, ps]) => ({ name: t, positions: ps.map(k => ({ Kurztext: k, Menge: 1, Einheit: "psch" })) }))
  },
  din277: {
    name: "Flächen nach DIN 277",
    hint: "Grundflächen und Rauminhalt; Menge in m² bzw. m³, Kennwert in €/m² bzw. €/m³",
    titles: [
      { name: "Nutzungsfläche (NUF)", positions: ["NUF 1 Wohnen und Aufenthalt", "NUF 2 Büroarbeit", "NUF 3 Produktion, Hand- und Maschinenarbeit, Forschung und Entwicklung", "NUF 4 Lagern, Verteilen und Verkaufen", "NUF 5 Bildung, Unterricht und Kultur", "NUF 6 Heilen und Pflegen", "NUF 7 Sonstige Nutzungen"].map(k => ({ Kurztext: k, Einheit: "m2" })) },
      { name: "Technikfläche (TF)", positions: [{ Kurztext: "TF 8 Technische Anlagen", Einheit: "m2" }] },
      { name: "Verkehrsfläche (VF)", positions: [{ Kurztext: "VF 9 Verkehrserschließung und -sicherung", Einheit: "m2" }] },
      { name: "Konstruktions-Grundfläche (KGF)", positions: [{ Kurztext: "KGF Konstruktions-Grundfläche", Einheit: "m2" }] },
      { name: "Rauminhalt", positions: [{ Kurztext: "BRI Brutto-Rauminhalt", Einheit: "m3", Positionstyp: "Bedarfsposition", Langtext: "Nur zur Information (als Bedarfsposition nicht in der Summe). Für eine Kostenschätzung über den Rauminhalt die Positionsart auf Normal stellen und die Flächen oben als Bedarfspositionen führen." }] }
    ]
  }
};

async function insertTemplate(key) {
  const tpl = TEMPLATES[key];
  if (!tpl || !sel.lvId) return;
  await flushSave();
  const start = childrenOf(null).length;
  const res = await apply(tpl.titles.map((t, i) => ["AddRecord", T.titles, null, {
    Titelbezeichnung: t.name, Leistungsverzeichnis: sel.lvId, Sortierung: start + i + 1, Titelnummer: pad(start + i + 1, 2)
  }]), { refresh: false });
  const ids = (res?.retValues ?? (Array.isArray(res) ? res : [])).map(refId);
  const posActions = [];
  tpl.titles.forEach((t, i) => t.positions.forEach((p, j) => posActions.push(["AddRecord", T.positions, null, {
    Titel: ids[i], Sortierung: j + 1, Kurztext: p.Kurztext, Langtext: p.Langtext || "", Menge: p.Menge ?? 0, Einheit: p.Einheit || "",
    Einheitspreis: 0, Positionstyp: p.Positionstyp || "Normal", Aktiv: true
  }])));
  await apply(posActions);
  await apply(renumberActions());
  sel.nodeId = ids[0] ?? sel.nodeId;
  renderAll();
  toast(`Vorlage „${tpl.name}“ eingefügt. Mengen und Kennwerte eintragen, nicht benötigte Positionen löschen oder inaktiv schalten.`);
}

// ------------------------------------------------------
// EXPORT: Excel / LibreOffice Calc (.xlsx) und CSV
// ------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = bytes => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

// Minimaler ZIP-Packer (ohne Kompression) – reicht für .xlsx
function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const u16 = v => [v & 0xFF, (v >>> 8) & 0xFF];
  const u32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  for (const [name, text] of files) {
    const nameB = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const head = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0)];
    parts.push(new Uint8Array(head), nameB, data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset)]), nameB);
    offset += head.length + nameB.length + data.length;
  }
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(cdSize), ...u32(offset), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function downloadBlob(blob, name) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const exportName = ext => {
  const l = lv(), pr = project();
  return `${pr.Projektnummer || "LV"}_LV${lvNr(l)}_${lvName(l)}`.normalize("NFKD").replace(/[^\w.-]+/g, "_") + ext;
};

// Zellen-Stile (Index in cellXfs)
const XS = { text: 0, bold: 1, qty: 2, money: 3, moneyB: 4, wrap: 5, head: 6, title: 7, note: 8, h1: 9, sub: 10, moneySub: 11, big: 12, center: 13 };
const XLSX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.000"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>
<fonts count="5">
<font><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="10"/><name val="Arial"/></font>
<font><i/><sz val="9"/><color rgb="FF777777"/><name val="Arial"/></font>
<font><b/><sz val="13"/><name val="Arial"/></font>
<font><sz val="9"/><color rgb="FF666666"/><name val="Arial"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF1F1F3"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="3"><border/><border><bottom style="thin"><color rgb="FF999999"/></bottom></border><border><top style="thin"><color rgb="FF999999"/></top></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" fontId="1" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" horizontal="right"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="165" fontId="1" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="165" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" horizontal="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const xmlEsc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const colName = i => String.fromCharCode(65 + i);

// Baut ein Tabellenblatt aus Zeilen. Zelle: {v, s, f} – v Zahl oder Text, f Formel (ohne „=“)
function sheetXml(rows, { cols, freeze, landscape, footer } = {}) {
  const out = rows.map((cells, r) => {
    const cs = (cells || []).map((c, i) => {
      if (c == null) return "";
      const ref = colName(i) + (r + 1);
      const cell = typeof c === "object" ? c : { v: c };
      const s = cell.s ?? 0;
      if (cell.f) return `<c r="${ref}" s="${s}"><f>${xmlEsc(cell.f)}</f><v>${Number(cell.v) || 0}</v></c>`;
      if (typeof cell.v === "number" && isFinite(cell.v)) return `<c r="${ref}" s="${s}"><v>${cell.v}</v></c>`;
      if (cell.v == null || cell.v === "") return s ? `<c r="${ref}" s="${s}"/>` : "";
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(cell.v)}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${cs}</row>`;
  }).join("");
  const pane = freeze ? `<pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="13"/>
<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${out}</sheetData>
<pageMargins left="0.6" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="${landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>&amp;L&amp;8 ${xmlEsc(footer ?? exportName("").replace(/_/g, " "))}&amp;C&amp;8 Druck: &amp;D&amp;R&amp;8 Seite &amp;P von &amp;N</oddFooter></headerFooter>
</worksheet>`;
}

function buildWorkbook(sheets) {
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
<calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`],
    ["xl/styles.xml", XLSX_STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, s.xml])
  ];
  return makeZip(files);
}

// withPrices = false: Bieterversion, EP leer, GB rechnet sich beim Eintragen der EP von selbst
function exportXlsx(withPrices = true) {
  const l = lv(), pr = project();
  if (!l || !pr) return toast("Bitte zuerst Projekt und LV wählen.");
  const rows = [];
  const add = cells => { rows.push(cells); return rows.length; }; // gibt Excel-Zeilennummer zurück
  add([{ v: `${pr.Projektnummer || ""} ${pr.Projektname || ""}`.trim(), s: XS.h1 }]);
  add([{ v: `LV ${lvNr(l)} ${lvName(l)}`, s: XS.bold }]);
  add([{ v: `${withPrices ? "Kostenvoranschlag" : "Ausschreibung (Preise vom Bieter einzutragen)"} · Stand ${new Date().toLocaleDateString("de-DE")}${pr.Bauherr ? " · Auftraggeber: " + pr.Bauherr : ""}`, s: XS.sub }]);
  add([]);
  const H = XS.head;
  add([{ v: "OZ", s: H }, { v: "Kurztext", s: H }, { v: "Langtext", s: H }, { v: "Menge", s: H }, { v: "ME", s: H }, { v: "EP in €", s: H }, { v: "GB in €", s: H }, { v: "Art", s: H }]);
  const sumRow = new Map(); // Titel-ID -> Excel-Zeile seiner Summe

  const draw = parentId => {
    for (const t of childrenOf(parentId)) {
      add([]);
      add([{ v: nodeOz(t), s: XS.title }, { v: nodeName(t), s: XS.title }]);
      const refs = [];
      for (const p of positionsOf(t.id).filter(x => isActive(x.Aktiv))) {
        const k = typeKey(p);
        const r = rows.length + 1;
        const menge = num(p.Menge), ep = withPrices ? num(p.Einheitspreis) : null;
        add([
          { v: p.Positionsnummer },
          { v: p.Kurztext || "", s: XS.wrap },
          { v: p.Langtext || "", s: XS.wrap },
          { v: menge, s: XS.qty },
          { v: p.Einheit || "", s: XS.center },
          ep == null ? { v: "", s: XS.money } : { v: ep, s: XS.money },
          k === "normal" ? { f: `ROUND(D${r}*F${r},2)`, v: withPrices ? lineTotal(p) : 0, s: XS.money } : { v: "nur EP", s: XS.note },
          { v: k === "normal" ? "" : TYPE_LABEL[k] }
        ]);
        if (k === "normal") refs.push(`G${r}`);
      }
      draw(t.id);
      for (const c of childrenOf(t.id)) if (sumRow.has(c.id)) refs.push(sumRow.get(c.id));
      if (redundantSum(t)) { sumRow.set(t.id, refs.join("+") || "0"); continue; } // wie im Druck: doppelte Summe weglassen
      const r = add([null, { v: `Summe ${nodeOz(t)} ${nodeName(t)}`, s: XS.bold }, null, null, null, null,
        { f: refs.length ? refs.join("+") : "0", v: withPrices ? nodeTotal(t.id) : 0, s: level(t) === 1 ? XS.moneyB : XS.moneySub }]);
      sumRow.set(t.id, `G${r}`);
    }
  };
  draw(null);

  // Zusammenstellung
  add([]);
  add([]);
  add([null, { v: "Zusammenstellung", s: XS.title }]);
  const top = childrenOf(null);
  const recapRefs = [];
  for (const t of top) {
    const r = add([{ v: nodeOz(t) }, { v: nodeName(t) }, null, null, null, null,
      { f: sumRow.get(t.id), v: withPrices ? nodeTotal(t.id) : 0, s: XS.money }]);
    recapRefs.push(`G${r}`);
  }
  const net = withPrices ? lvTotal() : 0, rate = num(settings.mwst) / 100;
  const rn = add([null, { v: "LV-Summe netto", s: XS.bold }, null, null, null, null, { f: recapRefs.length ? `SUM(${recapRefs[0]}:${recapRefs[recapRefs.length - 1]})` : "0", v: net, s: XS.moneyB }]);
  const rv = add([null, { v: `zzgl. ${String(settings.mwst).replace(".", ",")} % MwSt.` }, null, null, null, null, { f: `ROUND(G${rn}*${rate},2)`, v: round2(net * rate), s: XS.money }]);
  add([null, { v: "LV-Summe brutto", s: XS.bold }, null, null, null, null, { f: `G${rn}+G${rv}`, v: round2(net + net * rate), s: XS.moneyB }]);

  const xml = sheetXml(rows, { cols: [13, 34, 64, 11, 7, 12, 14, 11], freeze: 5, landscape: true });
  const name = exportName(withPrices ? ".xlsx" : "_Bieter.xlsx");
  downloadBlob(buildWorkbook([{ name: `LV ${lvNr(l)}`, xml }]), name);
  toast(`„${name}“ heruntergeladen. Öffnet in Excel und LibreOffice Calc.`);
}

// CSV: flache Positionsliste, Semikolon, Dezimalkomma, UTF-8 mit BOM (für deutsches Excel)
function exportCsv() {
  const l = lv(), pr = project();
  if (!l || !pr) return toast("Bitte zuerst Projekt und LV wählen.");
  const q = v => {
    const s = String(v ?? "");
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const dec = (v, d) => num(v).toFixed(d).replace(".", ",");
  const lines = [["OZ", "Titel", "Kurztext", "Langtext", "Menge", "Einheit", "EP", "GB", "Art", "Aktiv"].join(";")];
  for (const t of walk()) {
    for (const p of positionsOf(t.id)) {
      const k = typeKey(p);
      lines.push([p.Positionsnummer, `${nodeOz(t)} ${nodeName(t)}`, p.Kurztext, p.Langtext,
        dec(p.Menge, 3), p.Einheit, dec(p.Einheitspreis, 2), k === "normal" ? dec(lineTotal(p), 2) : "",
        k === "normal" ? "Normal" : TYPE_LABEL[k], isActive(p.Aktiv) ? "ja" : "nein"].map(q).join(";"));
    }
  }
  const name = exportName(".csv");
  downloadBlob(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), name);
  toast(`„${name}“ heruntergeladen.`);
}

// ------------------------------------------------------
// TYPST-EXPORT
// ------------------------------------------------------
const ty = v => '"' + String(v ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n") + '"';

function exportTypst() {
  const l = lv(), pr = project();
  if (!l || !pr) return toast("Bitte zuerst Projekt und LV wählen.");
  const nowT = new Date();
  const stampT = `${nowT.toLocaleDateString("de-DE")} ${nowT.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  let s = `// Export aus dem Grist-LV-Editor ${VERSION}
#set page(paper: "a4", margin: (left: 20mm, right: 14mm, top: 18mm, bottom: 20mm), footer: context [
  #set text(size: 7.5pt, fill: luma(90))
  #line(length: 100%, stroke: 0.5pt + luma(180))
  #grid(columns: (1fr, auto, 1fr), [#${ty(`${pr.Projektnummer || ""} ${pr.Projektname || ""} · LV ${lvNr(l)} ${lvName(l)}`)}], [#${ty("Druck: " + stampT)}], align(right)[Seite #counter(page).display() von #counter(page).final().first()])
])
#set text(font: "Arial", size: 9pt, lang: "de")
#let pos(oz, kt, lt, menge, me, ep, gb) = block(breakable: false, below: 8pt)[
  #grid(columns: (24mm, 1fr), oz, [*#kt* #if lt != "" [\\ #lt]])
  #align(right)[#box(width: 26mm)[#menge #me] #box(width: 24mm)[#ep] #box(width: 24mm)[#gb]]
]

#text(size: 8pt, tracking: 1pt)[LEISTUNGSVERZEICHNIS]
#text(size: 16pt, weight: "bold")[#${ty(`${lvNr(l)} ${lvName(l)}`)}] \\
#${ty(`${pr.Projektnummer} · ${pr.Projektname}`)} \\
#line(length: 100%)

`;
  const draw = parentId => {
    for (const t of childrenOf(parentId)) {
      const size = [0, 12, 10.5, 9.5][Math.min(level(t), 3)];
      s += `#text(size: ${size}pt, weight: "bold")[#${ty(nodeOz(t))} #h(4mm) #${ty(nodeName(t))}]\n\n`;
      if (textOn(t, "Vorbemerkung")) s += `#block(inset: (left: 24mm))[_Vorbemerkung:_ #${ty(t.Vorbemerkung)}]\n\n`;
      for (const p of positionsOf(t.id).filter(p => isActive(p.Aktiv))) {
        const gb = typeKey(p) === "normal" ? fmtMoney(lineTotal(p)) : "Nur Einh.-Pr.";
        s += `#pos(${ty(p.Positionsnummer)}, ${ty(p.Kurztext)}, ${ty(p.Langtext || "")}, ${ty(fmtQty(p.Menge))}, ${ty(p.Einheit)}, ${ty(fmtMoney(p.Einheitspreis))}, ${ty(gb)})\n`;
      }
      draw(t.id);
      if (textOn(t, "Nachbemerkung")) s += `#block(inset: (left: 24mm))[_Nachbemerkung:_ #${ty(t.Nachbemerkung)}]\n\n`;
      if (!redundantSum(t)) s += `#align(right)[*Summe #${ty(nodeOz(t))}: #${ty(fmtMoney(nodeTotal(t.id)))} €*]\n\n`;
    }
  };
  if (textOn(l, "Vorbemerkung")) s = s.replace("#line(length: 100%)\n\n", `#line(length: 100%)\n\n*Vorbemerkungen* \\ #${ty(l.Vorbemerkung)}\n\n`);
  draw(null);
  if (textOn(l, "Nachbemerkung")) s += `*Nachbemerkungen* \\ #${ty(l.Nachbemerkung)}\n\n`;
  const net = lvTotal(), vat = round2(net * settings.mwst / 100);
  s += `#line(length: 100%)\n#align(right)[LV-Summe netto: *${fmtMoney(net)} €* \\ MwSt.: ${fmtMoney(vat)} € \\ *LV-Summe brutto: ${fmtMoney(net + vat)} €*]\n`;

  const name = `${pr.Projektnummer || "LV"}_LV${lvNr(l)}_${lvName(l)}`.normalize("NFKD").replace(/[^\w.-]+/g, "_") + ".typ";
  const blob = new Blob([s], { type: "text/plain;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Typst-Datei „${name}“ heruntergeladen.`);
}

// ------------------------------------------------------
// MELDUNGEN
// ------------------------------------------------------
function status(text, cls = "") {
  const el = $("saveStatus");
  el.textContent = text;
  el.className = "save-status " + cls;
}

let toastTimer;
function toast(msg) {
  const el = $("globalMessage");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}

// ------------------------------------------------------
// EVENTS
// ------------------------------------------------------
// Drag & Drop in der Positionsliste
let drag = null;
function bindDragDrop() {
  const list = $("list");
  const clear = () => list.querySelectorAll(".drop-before,.drop-after,.drop-into").forEach(x => x.classList.remove("drop-before", "drop-after", "drop-into"));
  const spot = e => {
    if (!drag) return null;
    const row = e.target.closest(".row[data-pos]");
    const g = e.target.closest(".g[data-node]");
    if (drag.kind === "pos") {
      if (row) {
        const r = row.getBoundingClientRect();
        return { el: row, cls: e.clientY < r.top + r.height / 2 ? "drop-before" : "drop-after" };
      }
      const add = e.target.closest(".row.add[data-add-pos]");
      if (add) return { el: add, cls: "drop-into", node: Number(add.dataset.addPos) };
      if (g) return { el: g, cls: "drop-into" };
      return null;
    }
    if (drag.kind === "node" && g && Number(g.dataset.node) !== drag.id) {
      const a = title(drag.id), b = title(Number(g.dataset.node));
      if ((parentOf(a) || null) !== (parentOf(b) || null)) return null;
      const r = g.getBoundingClientRect();
      return { el: g, cls: e.clientY < r.top + r.height / 2 ? "drop-before" : "drop-after" };
    }
    return null;
  };
  list.addEventListener("dragstart", e => {
    const row = e.target.closest?.(".row[data-pos]");
    const g = e.target.closest?.(".g[data-node]");
    if (row) drag = { kind: "pos", id: Number(row.dataset.pos) };
    else if (g) drag = { kind: "node", id: Number(g.dataset.node) };
    else return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(drag.id));
    (row || g).classList.add("dragging");
    list.classList.add("is-dragging");
  });
  list.addEventListener("dragover", e => {
    const s = spot(e);
    clear();
    if (!s) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    s.el.classList.add(s.cls);
  });
  list.addEventListener("dragleave", e => { if (!list.contains(e.relatedTarget)) clear(); });
  list.addEventListener("drop", e => {
    const s = spot(e);
    clear();
    if (!s) return;
    e.preventDefault();
    const d = drag;
    drag = null;
    if (d.kind === "node") return moveTitleTo(d.id, Number(s.el.dataset.node), s.cls === "drop-after");
    if (s.el.matches(".row[data-pos]")) {
      const target = position(Number(s.el.dataset.pos));
      const nodeId = refId(target.Titel);
      const others = positionsOf(nodeId).filter(x => x.id !== d.id);
      const idx = others.findIndex(x => x.id === target.id) + (s.cls === "drop-after" ? 1 : 0);
      return movePositionTo(d.id, nodeId, idx);
    }
    const nodeId = s.node ?? Number(s.el.dataset.node);
    return movePositionTo(d.id, nodeId, positionsOf(nodeId).filter(x => x.id !== d.id).length);
  });
  list.addEventListener("dragend", () => {
    drag = null;
    clear();
    list.classList.remove("is-dragging");
    list.querySelectorAll(".dragging").forEach(x => x.classList.remove("dragging"));
  });
}

function bindEvents() {
  $("projectSelect").addEventListener("change", async e => {
    await flushSave();
    sel.projectId = refId(e.target.value);
    localStorage.setItem("lv.project", sel.projectId);
    sel.lvId = sel.nodeId = sel.posId = null;
    validateSelection();
    renderAll();
  });
  $("lvSelect").addEventListener("change", async e => {
    await flushSave();
    sel.lvId = refId(e.target.value);
    localStorage.setItem("lv.lv", sel.lvId);
    sel.nodeId = sel.posId = null;
    collapsed = new Set();
    validateSelection();
    renderAll();
  });
  $("newLvButton").addEventListener("click", () => openQuickStart());

  // Icon-Leiste
  document.querySelectorAll(".rail [data-view]").forEach(b => b.addEventListener("click", async () => {
    await flushSave();
    await flushText();
    setView(b.dataset.view);
  }));
  $("refreshButton").addEventListener("click", () => refresh());
  $("settingsButton").addEventListener("click", openSettings);
  $("printMenuButton").addEventListener("click", e => {
    e.stopPropagation();
    syncPrintStyle();
    $("printMenu").hidden = !$("printMenu").hidden;
  });
  $("printMenu").addEventListener("click", e => {
    const b = e.target.closest("[data-print]");
    const st = e.target.closest("[data-pstyle]");
    if (st) {
      e.stopPropagation();
      settings.printStyle = st.dataset.pstyle;
      syncPrintStyle();
      grist.widgetApi.setOptions(settings).catch(() => {});
      return;
    }
    if (!b) return;
    $("printMenu").hidden = true;
    printLV(b.dataset.print);
  });
  $("exportTypstButton").addEventListener("click", () => { $("printMenu").hidden = true; exportTypst(); });
  $("printMenu").addEventListener("click", e => {
    const b = e.target.closest("[data-export]");
    if (!b) return;
    $("printMenu").hidden = true;
    const k = b.dataset.export;
    if (k === "xlsx") exportXlsx(true); else if (k === "xlsx-bieter") exportXlsx(false); else if (k === "csv") exportCsv();
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".menu-wrap")) $("printMenu").hidden = true;
  });

  // Dialoge
  $("settingsForm").addEventListener("submit", saveSettings);
  $("sCancel").addEventListener("click", () => $("settingsDialog").close());
  $("sLogoFile").addEventListener("change", e => { readLogo(e.target.files[0]); e.target.value = ""; });
  $("sLogoRemove").addEventListener("click", () => { pendingLogo = ""; showLogoPreview(); });
  $("titleForm").addEventListener("submit", saveTitleDialog);
  $("tCancel").addEventListener("click", () => $("titleDialog").close());
  $("tDelete").addEventListener("click", deleteTitle);
  $("lvForm").addEventListener("submit", saveLvDialog);
  $("lvCancel").addEventListener("click", () => $("lvDialog").close());
  $("schemaButton").addEventListener("click", migrateSchema);
  $("quickStartForm").addEventListener("submit", saveQuickStart);
  $("qCancel").addEventListener("click", () => $("quickStartDialog").close());
  $("qNewProject").addEventListener("change", syncQuickStart);
  $("qWithLv").addEventListener("change", syncQuickStart);
  $("qMode").addEventListener("click", e => {
    const b = e.target.closest("[data-mode]");
    if (!b || b.disabled) return;
    $("qMode").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    $("qNewProject").checked = b.dataset.mode === "project";
    syncQuickStart();
  });

  // Suche
  $("search").addEventListener("input", e => {
    searchTerm = e.target.value.trim().toLowerCase();
    if (view === "texts") return renderTexts();
    if (view !== "edit") setView("edit");
    renderList();
  });
  $("search").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const first = document.querySelector("#list .row[data-pos]");
      if (first) selectPosition(Number(first.dataset.pos));
    } else if (e.key === "Escape") {
      e.target.value = "";
      searchTerm = "";
      renderList();
      e.target.blur();
    }
  });

  $("addPositionButton").addEventListener("click", () => insertPosition());

  // Klicks in Liste und Übersicht (gemeinsame Aktionen)
  const onAction = e => {
    const tb = e.target.closest("[data-template]");
    if (tb) { e.stopPropagation(); return insertTemplate(tb.dataset.template); }
    const b = e.target.closest("[data-toggle-active],[data-open-texts],[data-toggle],[data-move-node],[data-edit-node],[data-edit-lv],[data-add-sub],[data-add-pos],[data-move-pos],[data-select-node],#addTitleInline");
    if (b) {
      e.stopPropagation();
      const d = b.dataset;
      if (b.id === "addTitleInline") openTitleDialog(null, null);
      else if (d.toggleActive) toggleActive(Number(d.toggleActive));
      else if (d.openTexts) openTexts(d.openTexts === "lv" ? "lv" : "node", Number(d.openTexts));
      else if (d.toggle) {
        const id = Number(d.toggle);
        collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
        renderList();
      }
      else if (d.moveNode) moveTitle(Number(d.moveNode), Number(d.dir));
      else if (d.editNode) openTitleDialog(Number(d.editNode));
      else if ("editLv" in d) openLvDialog();
      else if (d.addSub) openTitleDialog(null, Number(d.addSub));
      else if (d.addPos) insertPosition({}, Number(d.addPos));
      else if (d.movePos) movePosition(Number(d.movePos), Number(d.dir));
      else if (d.selectNode) selectNode(Number(d.selectNode));
      return;
    }
    const row = e.target.closest(".row[data-pos]");
    if (row) return selectPosition(Number(row.dataset.pos));
    const g = e.target.closest(".g[data-node]");
    if (g) selectNode(Number(g.dataset.node));
  };
  $("list").addEventListener("click", onAction);
  bindDragDrop();
  bindProjects();
  $("summaryPanel").addEventListener("click", onAction);
  $("list").addEventListener("dblclick", e => {
    const g = e.target.closest(".g[data-node]");
    if (g && !e.target.closest("button")) openTitleDialog(Number(g.dataset.node));
  });
  $("documentView").addEventListener("click", e => {
    const p = e.target.closest("[data-doc-pos]");
    if (p) selectPosition(Number(p.dataset.docPos));
  });

  // Texte
  $("textSlots").addEventListener("click", e => {
    const b = e.target.closest("[data-slot]");
    if (!b) return;
    const [kind, id, part] = b.dataset.slot.split(":");
    selectText(kind, Number(id), part);
  });
  $("txPart").addEventListener("click", e => {
    const b = e.target.closest("[data-part]");
    if (b) selectText(textSel.kind, textSel.id, b.dataset.part);
  });
  $("txText").addEventListener("input", onTextInput);
  $("txOn").addEventListener("change", e => toggleText(e.target.checked));

  // Inspector
  ["fKurztext", "fLangtext", "fMenge", "fEinheit", "fEinheitspreis", "fAktiv"].forEach(id => {
    $(id).addEventListener("input", onFormInput);
    $(id).addEventListener("change", onFormInput);
  });
  $("fLangtext").addEventListener("input", e => autoGrow(e.target));
  $("typeSeg").addEventListener("click", e => {
    const b = e.target.closest("[data-type]");
    if (!b) return;
    $("typeSeg").dataset.value = b.dataset.type;
    $("typeSeg").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    onFormInput();
  });
  $("posPanel").addEventListener("submit", e => { e.preventDefault(); flushSave(); });
  $("closeInspector").addEventListener("click", closeInspector);
  $("duplicateButton").addEventListener("click", duplicatePosition);
  $("deleteButton").addEventListener("click", deletePosition);

  // Tastatur
  document.addEventListener("keydown", e => {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === "k") { e.preventDefault(); $("search").focus(); $("search").select(); }
    else if (mod && k === "s") { e.preventDefault(); flushSave(); flushText(); }
    else if (mod && e.key === "Enter") { e.preventDefault(); insertPosition(); }
    else if (e.key === "Escape" && !document.querySelector("dialog[open]") && document.activeElement !== $("search") && sel.posId) closeInspector();
  });

  // Daten von außen geändert (andere Ansicht, andere Nutzer)
  window.addEventListener("focus", scheduleRefresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleRefresh(); });
  setInterval(() => { if (!document.hidden) refresh({ quiet: true }); }, 30000);
}

// ------------------------------------------------------
// START
// ------------------------------------------------------
async function init() {
  bindEvents();
  grist.ready({ requiredAccess: "full", allowSelectBy: false });
  grist.onOptions(opts => {
    settings = { ...DEFAULT_SETTINGS, ...(opts || {}) };
    if (sel.lvId) renderAll();
  });
  // Grist meldet Änderungen an der verknüpften Tabelle; zusätzlich bei jeder Nachricht neu laden.
  grist.onRecords(() => scheduleRefresh());
  grist.on("message", msg => { if (msg && (msg.dataChange || msg.tableId)) scheduleRefresh(); });

  status("Laden …");
  await loadChoices();
  await refresh();
}

init();
