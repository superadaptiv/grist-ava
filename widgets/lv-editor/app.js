// ======================================================
// GRIST LV-EDITOR  ·  Version 2.0
// Teil des AVA-Systems (Ausschreibung · Vergabe · Abrechnung)
// ======================================================
"use strict";

const VERSION = "2.0.0";

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
    { id: "Vorbemerkung", type: "Text" },
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
    { id: "Vorbemerkung", type: "Text" }
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
let expanded = new Set();
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
  if (dirty || savingPromise) return; // Eingaben nicht überschreiben
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
    expanded = new Set(lvTitles().map(t => t.id));
  }
  if (sel.nodeId && !lvTitles().some(t => t.id === sel.nodeId)) sel.nodeId = null;
  if (!sel.nodeId) {
    const first = walk().find(t => positionsOf(t.id).length) || walk()[0];
    sel.nodeId = first?.id ?? null;
  }
  if (sel.posId && !position(sel.posId)) sel.posId = null;
}

// ------------------------------------------------------
// RENDERING
// ------------------------------------------------------
function renderAll() {
  renderHeader();
  renderSchemaBanner();
  renderTree();
  renderNode();
  renderInspector();
  if (view === "document") renderDocument();
}

function renderHeader() {
  const ps = $("projectSelect");
  ps.innerHTML = db.projects.length ? "" : '<option value="">Kein Projekt</option>';
  [...db.projects]
    .filter(p => p.Projektname || p.Projektnummer)
    .sort((a, b) => String(a.Projektnummer).localeCompare(String(b.Projektnummer), "de", { numeric: true }))
    .forEach(p => ps.add(new Option(`${p.Projektnummer ? p.Projektnummer + " · " : ""}${p.Projektname || ""}`, p.id)));
  ps.value = sel.projectId ?? "";

  const ls = $("lvSelect");
  const list = db.lvs.filter(l => refId(l.Projekt) === sel.projectId)
    .sort((a, b) => String(lvNr(a)).localeCompare(String(lvNr(b)), "de", { numeric: true }));
  ls.innerHTML = list.length ? "" : '<option value="">Kein LV</option>';
  list.forEach(l => ls.add(new Option(`${lvNr(l) ? "LV " + lvNr(l) + " · " : ""}${lvName(l) || "Ohne Bezeichnung"}`, l.id)));
  ls.value = sel.lvId ?? "";

  const st = lvState(lv());
  const pill = $("lvStatus");
  pill.hidden = !st;
  pill.textContent = st + (isLocked() ? " · OZ fix" : "");
  pill.className = "pill st-" + String(st).toLowerCase().replace("ü", "ue");
  pill.title = isLocked() ? "Ab diesem Status werden Ordnungszahlen nicht mehr automatisch geändert." : "";

  $("lvNet").textContent = fmtMoney(lvTotal()) + " €";
  $("addTitleButton").disabled = !sel.lvId;
  $("addSubtitleButton").disabled = !sel.nodeId || level(title(sel.nodeId)) >= 3;
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

function renderTree() {
  const el = $("tree");
  if (!sel.lvId) {
    el.innerHTML = '<div class="tree-empty">Bitte ein Leistungsverzeichnis wählen.</div>';
    $("treeCount").textContent = "";
    return;
  }
  const nodes = walk();
  const posCount = nodes.reduce((s, t) => s + positionsOf(t.id).length, 0);
  $("treeCount").textContent = `${nodes.length} Titel · ${posCount} Pos.`;
  if (!nodes.length) {
    el.innerHTML = '<div class="tree-empty">Noch keine Titel.<br>Mit „+ Titel“ beginnen.</div>';
    return;
  }

  const html = [];
  const draw = (parentId, depth) => {
    const sibs = childrenOf(parentId);
    sibs.forEach((t, i) => {
      const kids = childrenOf(t.id);
      const pos = positionsOf(t.id);
      const subtreeHit = searchTerm && subtreeMatches(t);
      if (searchTerm && !subtreeHit) return;
      const open = searchTerm ? true : expanded.has(t.id);
      const hasContent = kids.length || pos.length;
      html.push(`
        <div class="tree-node t-level-${depth} ${t.id === sel.nodeId && !sel.posId ? "active" : ""}"
             style="padding-left:${(depth - 1) * 14}px" data-node="${t.id}">
          <button class="t-toggle" data-toggle="${t.id}" ${hasContent ? "" : "disabled"}>${hasContent ? (open ? "▼" : "▶") : ""}</button>
          <button class="t-main" data-select-node="${t.id}">
            <span class="t-oz">${esc(nodeOz(t))}</span>
            <span class="t-name">${esc(nodeName(t))}</span>
          </button>
          <span class="t-sum">${fmtMoney(nodeTotal(t.id))}</span>
          <span class="t-moves">
            <button data-move-node="${t.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} title="Nach oben">▲</button>
            <button data-move-node="${t.id}" data-dir="1" ${i === sibs.length - 1 ? "disabled" : ""} title="Nach unten">▼</button>
            <button data-edit-node="${t.id}" title="Bearbeiten">✎</button>
          </span>
        </div>`);
      if (!open) return;
      pos.forEach(p => {
        if (searchTerm && !matchesSearch(`${p.Positionsnummer} ${p.Kurztext} ${p.Langtext}`)) return;
        html.push(`
          <div class="tree-node t-pos ${p.id === sel.posId ? "active" : ""} ${isActive(p.Aktiv) ? "" : "inactive"}"
               style="padding-left:${depth * 14 + 6}px">
            <button class="t-main" data-select-pos="${p.id}">
              <span class="t-oz">${esc(String(p.Positionsnummer || "").split(".").pop())}</span>
              <span class="t-name">${esc(p.Kurztext || "(ohne Kurztext)")}</span>
            </button>
          </div>`);
      });
      draw(t.id, depth + 1);
    });
  };
  draw(null, 1);
  el.innerHTML = html.join("") || '<div class="tree-empty">Keine Treffer.</div>';
}

function subtreeMatches(t) {
  if (matchesSearch(`${nodeOz(t)} ${nodeName(t)}`)) return true;
  if (positionsOf(t.id).some(p => matchesSearch(`${p.Positionsnummer} ${p.Kurztext} ${p.Langtext}`))) return true;
  return childrenOf(t.id).some(subtreeMatches);
}

function renderNode() {
  const node = title(sel.nodeId);
  $("addPositionButton").disabled = !node;
  $("renameNodeButton").disabled = !node;
  const body = $("positionRows");
  const foot = $("positionFoot");

  if (!node) {
    $("nodeTitle").textContent = "Positionen";
    $("nodeSubtitle").textContent = sel.lvId ? "Bitte links einen Titel wählen" : "Bitte ein LV wählen";
    $("nodeHead").textContent = "";
    body.innerHTML = '<tr class="empty-row"><td colspan="7">Kein Titel ausgewählt.</td></tr>';
    foot.innerHTML = "";
    return;
  }

  $("nodeTitle").innerHTML = `<span class="t-oz">${esc(nodeOz(node))}</span>&nbsp; ${esc(nodeName(node))}`;
  const kids = childrenOf(node.id);
  const pos = positionsOf(node.id);
  $("nodeSubtitle").textContent =
    `${pos.length} ${pos.length === 1 ? "Position" : "Positionen"}` + (kids.length ? ` · ${kids.length} Untertitel` : "") +
    (node.Vorbemerkung ? " · mit Vorbemerkung" : "");
  $("nodeHead").textContent = ancestors(node).slice(0, -1).map(a => `${nodeOz(a)} ${nodeName(a)}`).join("  ›  ");

  if (!pos.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="7">
      ${kids.length ? "Dieser Titel enthält Untertitel. Positionen stehen dort." : "Noch keine Positionen. Mit „+ Position“ anlegen."}
    </td></tr>`;
  } else {
    body.innerHTML = pos.map((p, i) => {
      const k = typeKey(p);
      const active = isActive(p.Aktiv);
      const gb = k === "normal" ? fmtMoney(lineTotal(p)) : '<span class="nur-ep">Nur EP</span>';
      return `
        <tr class="${p.id === sel.posId ? "selected" : ""} ${active ? "" : "inactive"}" data-pos="${p.id}">
          <td class="c-oz">${esc(p.Positionsnummer)}</td>
          <td>
            <div class="p-short">${esc(p.Kurztext || "(ohne Kurztext)")}${k !== "normal" ? `<span class="badge b-${k}">${TYPE_LABEL[k]}</span>` : ""}${active ? "" : '<span class="badge b-inaktiv">inaktiv</span>'}</div>
            ${p.Langtext ? `<div class="p-long">${esc(p.Langtext)}</div>` : ""}
          </td>
          <td class="c-num">${fmtQty(p.Menge)}</td>
          <td class="c-unit">${esc(p.Einheit)}</td>
          <td class="c-num">${fmtMoney(p.Einheitspreis)}</td>
          <td class="c-num">${gb}</td>
          <td class="c-act"><div class="row-moves">
            <button data-move-pos="${p.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} title="Nach oben">↑</button>
            <button data-move-pos="${p.id}" data-dir="1" ${i === pos.length - 1 ? "disabled" : ""} title="Nach unten">↓</button>
          </div></td>
        </tr>`;
    }).join("");
  }
  foot.innerHTML = `<tr><td></td><td>Summe ${esc(nodeOz(node))} ${esc(nodeName(node))}</td>
    <td colspan="4" class="c-num">${fmtMoney(nodeTotal(node.id))} €</td><td></td></tr>`;
}

function renderInspector() {
  const p = position(sel.posId);
  $("inspector").hidden = !p || view !== "edit";
  document.querySelector(".workspace").classList.toggle("with-inspector", !!p && view === "edit");
  if (!p) return;
  $("inspectorOz").textContent = p.Positionsnummer || "–";
}

function fillForm(p) {
  $("fKurztext").value = p.Kurztext ?? "";
  $("fLangtext").value = p.Langtext ?? "";
  $("fMenge").value = fmtInput(p.Menge, 3);
  $("fEinheit").value = p.Einheit ?? "";
  $("fEinheitspreis").value = fmtInput(p.Einheitspreis, 2);
  $("fAktiv").checked = isActive(p.Aktiv);
  const sel2 = $("fPositionstyp");
  sel2.innerHTML = "";
  choices.Positionstyp.forEach(c => sel2.add(new Option(c, c)));
  sel2.value = p.Positionstyp || "Normal";
  if (!sel2.value) sel2.value = choices.Positionstyp[0];
  $("unitList").innerHTML = choices.Einheit.map(u => `<option value="${esc(u)}">`).join("");
  updateFormTotal();
  $("dirtyIndicator").textContent = "";
}

function formValues() {
  return {
    Kurztext: $("fKurztext").value.trim(),
    Langtext: $("fLangtext").value,
    Menge: parseDe($("fMenge").value),
    Einheit: $("fEinheit").value.trim(),
    Einheitspreis: parseDe($("fEinheitspreis").value),
    Positionstyp: $("fPositionstyp").value,
    Aktiv: $("fAktiv").checked
  };
}

function updateFormTotal() {
  const v = formValues();
  $("fGesamt").textContent = typeKey(v) === "normal"
    ? fmtMoney(round2(v.Menge * v.Einheitspreis))
    : "Nur Einheitspreis";
}

// ------------------------------------------------------
// AUSWAHL
// ------------------------------------------------------
async function selectNode(id) {
  await flushSave();
  sel.nodeId = id;
  sel.posId = null;
  expanded.add(id);
  renderAll();
}

async function selectPosition(id) {
  await flushSave();
  const p = position(id);
  if (!p) return;
  sel.posId = id;
  sel.nodeId = refId(p.Titel);
  ancestors(title(sel.nodeId)).forEach(a => expanded.add(a.id));
  if (view !== "edit") setView("edit");
  renderAll();
  fillForm(p);
  const row = document.querySelector(`tr[data-pos="${id}"]`);
  row?.scrollIntoView({ block: "nearest" });
}

async function closeInspector() {
  await flushSave();
  sel.posId = null;
  renderAll();
}

function setView(v) {
  view = v;
  document.querySelectorAll(".seg").forEach(b => b.classList.toggle("active", b.dataset.view === v));
  $("editView").hidden = v !== "edit";
  $("documentView").hidden = v !== "document";
  renderInspector();
  if (v === "document") renderDocument();
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
      renderTree();
      renderNode();
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
async function insertPosition(fields = {}) {
  await flushSave();
  const node = title(sel.nodeId);
  if (!node) return;
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
  $("tVorbemerkung").value = t?.Vorbemerkung ?? "";
  $("tDelete").hidden = !t;
  $("titleDialog").showModal();
  $("tBezeichnung").focus();
}

async function saveTitleDialog(ev) {
  ev.preventDefault();
  const name = $("tBezeichnung").value.trim();
  const pre = $("tVorbemerkung").value;
  if (!name) return;
  $("titleDialog").close();
  if (editingTitleId) {
    await apply([["UpdateRecord", T.titles, editingTitleId, { Titelbezeichnung: name, Vorbemerkung: pre }]]);
    renderAll();
    return;
  }
  const sibs = childrenOf(editingTitleParent);
  const fields = {
    Titelbezeichnung: name, Vorbemerkung: pre,
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
  if (editingTitleParent) expanded.add(editingTitleParent);
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
function openQuickStart() {
  const pr = project();
  $("qNewProject").checked = !pr;
  $("qNewProject").disabled = !pr;
  $("qProjectFields").hidden = !!pr;
  $("qProjectHint").textContent = pr ? `Neues LV in Projekt ${pr.Projektnummer || ""} ${pr.Projektname || ""}` : "";
  $("quickStartForm").reset();
  $("qNewProject").checked = !pr;
  $("quickStartDialog").showModal();
  (pr ? $("qLvNummer") : $("qProjektnummer")).focus();
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
  }
  const res2 = await apply([["AddRecord", T.lvs, null, {
    Projekt: pid, LV_Nummer: v("qLvNummer"), LV_Bezeichnung: v("qLvName"), Gewerk: v("qGewerk"), Bearbeitungsstand: "Entwurf"
  }]]);
  sel.projectId = pid;
  sel.lvId = newRowId(res2);
  sel.nodeId = sel.posId = null;
  validateSelection();
  renderAll();
  openTitleDialog(null, null);
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
  $("settingsDialog").showModal();
}

async function saveSettings(ev) {
  ev.preventDefault();
  settings = {
    planer: $("sPlaner").value.trim(),
    anschrift: $("sAnschrift").value,
    kontakt: $("sKontakt").value,
    mwst: parseDe($("sMwst").value) || 19,
    step: Math.max(1, Math.round(parseDe($("sStep").value)) || 10)
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
      if (t.Vorbemerkung) out.push(`<div class="doc-pre">${esc(t.Vorbemerkung)}</div>`);
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
      out.push(`<div class="doc-sum"><span></span><span>Summe ${esc(nodeOz(t))} ${esc(nodeName(t))}</span><span class="r">${fmtMoney(nodeTotal(t.id))} €</span></div>`);
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
    ${l.Vorbemerkung ? `<div class="doc-pre" style="margin-left:0">${esc(l.Vorbemerkung)}</div>` : ""}
    <div class="doc-grid"><span>OZ</span><span>Leistungsbeschreibung</span><span>Menge</span><span>ME</span><span>EP €</span><span>GB €</span></div>
    ${out.join("") || '<div class="doc-empty">Noch keine Titel.</div>'}
    <div class="doc-total">
      <div><span>LV-Summe netto</span><b>${fmtMoney(net)} €</b></div>
      <div><span>zzgl. ${String(settings.mwst).replace(".", ",")} % MwSt.</span><b>${fmtMoney(vat)} €</b></div>
      <div class="big"><span>LV-Summe brutto</span><span>${fmtMoney(net + vat)} €</span></div>
    </div>
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
  w.document.write(buildPrintHtml(mode));
  w.document.close();
}

function buildPrintHtml(mode) {
  const l = lv(), pr = project();
  const priced = mode !== "ausschreibung";
  const short = mode === "kurz";
  const docTitle = mode === "ausschreibung" ? "Ausschreibung" : mode === "kurz" ? "Kurz-LV" : "Kostenanschlag";
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
      if (t.Vorbemerkung && !short) body.push(`<div class="pre">${br(t.Vorbemerkung)}</div>`);
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
      body.push(`<div class="sum"><span></span><span>Summe ${esc(nodeOz(t))} ${esc(nodeName(t))}</span><span>${money(nodeTotal(t.id))}</span></div>`);
    }
  };
  draw(null);

  // Zusammenstellung: tiefste Ebenen zuerst (wie im Beispiel-LV)
  const postOrder = [];
  const po = parentId => { for (const t of childrenOf(parentId)) { po(t.id); postOrder.push(t); } };
  po(null);

  const toc = nodes.map(t => `<tr class="toc-l${Math.min(level(t), 3)}"><td>${esc(nodeOz(t))}</td><td>${esc(nodeName(t))}</td></tr>`).join("");
  const recap = postOrder.map(t => `<tr class="${level(t) === 1 ? "strong" : ""}"><td>${esc(nodeOz(t))}</td><td>${esc(nodeName(t))}</td><td class="r">${money(nodeTotal(t.id))}</td></tr>`).join("");
  const recap1 = childrenOf(null).map(t => `<tr><td>${esc(nodeOz(t))}</td><td>${esc(nodeName(t))}</td><td class="r">${money(nodeTotal(t.id))}</td></tr>`).join("");
  const totals = `
    <tr class="tot"><td></td><td class="r">LV-Summe (netto)</td><td class="r">${money(net)} €</td></tr>
    <tr><td></td><td class="r">zzgl. ${String(settings.mwst).replace(".", ",")} % MwSt.</td><td class="r">${money(vat)} €</td></tr>
    <tr class="tot"><td></td><td class="r">LV-Summe (brutto)</td><td class="r">${money(net + vat)} €</td></tr>`;
  const sign = `<div class="sign"><div>(Ort)</div><div>(Datum)</div><div>(Stempel und Unterschrift)</div></div>`;
  const line = label => `<div class="fill"><span>${label}</span><span class="dots"></span></div>`;

  const runningHead = `<div class="rh">
    <div><span>Auftraggeber</span>${esc(pr.Bauherr)}</div>
    <div><span>Planer</span>${esc(planer)}</div>
    <div><span>Projekt</span>${esc(pr.Projektnummer)} – ${esc(pr.Projektname)}</div>
    <div><span>LV</span>${esc(lvNr(l))} – ${esc(lvName(l))}</div>
  </div>`;

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>${esc(pr.Projektnummer)}_LV ${esc(lvNr(l))} ${esc(lvName(l))}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 18mm 20mm;
    @bottom-left { content: "Druckausgabe vom: ${stamp}"; font: 7.5pt Arial, sans-serif; color: #555; }
    @bottom-right { content: counter(page) "/" counter(pages); font: 7.5pt Arial, sans-serif; color: #555; } }
  * { box-sizing: border-box; }
  body { font: 9pt/1.4 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  .doc-kind { font-size: 8pt; text-transform: uppercase; letter-spacing: .14em; color: #555; }
  .cover { page-break-after: always; min-height: 255mm; display: flex; flex-direction: column; gap: 9mm; }
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
  table.frame { width: 100%; border-collapse: collapse; }
  table.frame > thead td { padding: 0 0 4mm; }
  .rh { display: grid; grid-template-columns: 26mm 1fr; font-size: 8pt; border-bottom: .8pt solid #111; padding-bottom: 2mm; }
  .rh div { display: contents; }
  .rh span { color: #555; }
  .colhead { display: grid; grid-template-columns: 24mm 1fr 72mm; font-size: 7.5pt; font-weight: bold; padding: 2mm 0 1mm; border-bottom: .5pt solid #999; margin-top: 2mm; }
  .colhead .calc, .pos-calc { display: grid; grid-template-columns: 24mm 24mm 24mm; text-align: right; }
  .h { display: grid; grid-template-columns: 24mm 1fr; font-weight: bold; break-after: avoid; }
  .h1 { font-size: 11pt; margin: 6mm 0 2mm; } .h2 { font-size: 10pt; margin: 4mm 0 1.5mm; } .h3 { font-size: 9pt; margin: 3mm 0 1mm; }
  .pre { margin: 0 0 2mm 24mm; padding: 1.5mm 2.5mm; border-left: 1.5pt solid #bbb; color: #333; }
  .pos { break-inside: avoid; padding: 1.8mm 0 2.2mm; }
  .pos-text { display: grid; grid-template-columns: 24mm 1fr; }
  .lt { margin-top: .8mm; }
  .pos-calc { margin-left: auto; width: 72mm; margin-top: 1.2mm; align-items: end; }
  .pos-calc .dots { width: 21mm; margin-left: 3mm; }
  .tag { margin-left: 2mm; font-size: 7pt; padding: .2mm 1.4mm; border: .5pt solid #888; border-radius: 1mm; color: #444; }
  .nur { font-style: italic; font-size: 8pt; }
  .sum { display: grid; grid-template-columns: 24mm 1fr 30mm; font-weight: bold; padding: 1.5mm 0 3mm; border-top: .5pt solid #999; break-before: avoid; }
  .sum span:last-child { text-align: right; } .sum .dots { width: 26mm; }
  .page { page-break-before: always; }
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

<table class="frame"><thead><tr><td>${runningHead}</td></tr></thead><tbody><tr><td>
  <h2>Inhaltsverzeichnis</h2>
  <table class="list">${toc}</table>
  ${l.Vorbemerkung ? `<div class="page"><h2>Vorbemerkungen</h2><div>${br(l.Vorbemerkung)}</div></div>` : ""}
  <div class="page">
    <div class="colhead"><span>OZ</span><span>Leistungsbeschreibung</span><span class="calc"><span>Menge ME</span><span>EP in €</span><span>GB in €</span></span></div>
    ${body.join("")}
  </div>
  <div class="page">
    <h2>Zusammenstellung der LV-Gruppen</h2>
    <table class="list">${recap}</table>
  </div>
  <div class="page">
    <h2>Zusammenstellung</h2>
    <table class="list">${recap1}${totals}</table>
    ${mode === "ausschreibung" ? sign : ""}
  </div>
</td></tr></tbody></table>
<script>window.onload = () => setTimeout(() => window.print(), 250);<\/script>
</body></html>`;
}

// ------------------------------------------------------
// TYPST-EXPORT
// ------------------------------------------------------
const ty = v => '"' + String(v ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n") + '"';

function exportTypst() {
  const l = lv(), pr = project();
  if (!l || !pr) return toast("Bitte zuerst Projekt und LV wählen.");
  let s = `// Export aus dem Grist-LV-Editor ${VERSION}
#set page(paper: "a4", margin: (left: 20mm, right: 14mm, top: 18mm, bottom: 18mm), numbering: "1/1")
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
      for (const p of positionsOf(t.id).filter(p => isActive(p.Aktiv))) {
        const gb = typeKey(p) === "normal" ? fmtMoney(lineTotal(p)) : "Nur Einh.-Pr.";
        s += `#pos(${ty(p.Positionsnummer)}, ${ty(p.Kurztext)}, ${ty(p.Langtext || "")}, ${ty(fmtQty(p.Menge))}, ${ty(p.Einheit)}, ${ty(fmtMoney(p.Einheitspreis))}, ${ty(gb)})\n`;
      }
      draw(t.id);
      s += `#align(right)[*Summe #${ty(nodeOz(t))}: #${ty(fmtMoney(nodeTotal(t.id)))} €*]\n\n`;
    }
  };
  draw(null);
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
    expanded = new Set(lvTitles().map(t => t.id));
    validateSelection();
    renderAll();
  });

  $("refreshButton").addEventListener("click", () => refresh());
  $("settingsButton").addEventListener("click", openSettings);
  $("settingsForm").addEventListener("submit", saveSettings);
  $("sCancel").addEventListener("click", () => $("settingsDialog").close());

  $("printMenuButton").addEventListener("click", e => {
    e.stopPropagation();
    $("printMenu").hidden = !$("printMenu").hidden;
  });
  $("printMenu").addEventListener("click", e => {
    const b = e.target.closest("[data-print]");
    $("printMenu").hidden = true;
    if (b) printLV(b.dataset.print);
  });
  $("exportTypstButton").addEventListener("click", exportTypst);
  document.addEventListener("click", e => {
    if (!e.target.closest(".menu-wrap")) $("printMenu").hidden = true;
  });

  $("schemaButton").addEventListener("click", migrateSchema);
  $("quickStartForm").addEventListener("submit", saveQuickStart);
  $("qCancel").addEventListener("click", () => $("quickStartDialog").close());
  $("qNewProject").addEventListener("change", e => { $("qProjectFields").hidden = !e.target.checked; });
  $("newLvButton").addEventListener("click", () => openQuickStart());

  $("treeSearch").addEventListener("input", e => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderTree();
  });
  $("tree").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.toggle) {
      const id = Number(b.dataset.toggle);
      expanded.has(id) ? expanded.delete(id) : expanded.add(id);
      renderTree();
    } else if (b.dataset.selectNode) selectNode(Number(b.dataset.selectNode));
    else if (b.dataset.selectPos) selectPosition(Number(b.dataset.selectPos));
    else if (b.dataset.moveNode) moveTitle(Number(b.dataset.moveNode), Number(b.dataset.dir));
    else if (b.dataset.editNode) openTitleDialog(Number(b.dataset.editNode));
  });
  $("tree").addEventListener("dblclick", e => {
    const b = e.target.closest("[data-select-node]");
    if (b) openTitleDialog(Number(b.dataset.selectNode));
  });

  $("addTitleButton").addEventListener("click", () => openTitleDialog(null, null));
  $("addSubtitleButton").addEventListener("click", () => openTitleDialog(null, sel.nodeId));
  $("renameNodeButton").addEventListener("click", () => openTitleDialog(sel.nodeId));
  $("titleForm").addEventListener("submit", saveTitleDialog);
  $("tCancel").addEventListener("click", () => $("titleDialog").close());
  $("tDelete").addEventListener("click", deleteTitle);

  document.querySelectorAll(".seg").forEach(b => b.addEventListener("click", async () => {
    await flushSave();
    setView(b.dataset.view);
  }));
  $("documentView").addEventListener("click", e => {
    const p = e.target.closest("[data-doc-pos]");
    if (p) selectPosition(Number(p.dataset.docPos));
  });

  $("addPositionButton").addEventListener("click", () => insertPosition());
  $("positionRows").addEventListener("click", e => {
    const mv = e.target.closest("[data-move-pos]");
    if (mv) {
      e.stopPropagation();
      movePosition(Number(mv.dataset.movePos), Number(mv.dataset.dir));
      return;
    }
    const tr = e.target.closest("tr[data-pos]");
    if (tr) selectPosition(Number(tr.dataset.pos));
  });

  ["fKurztext", "fLangtext", "fMenge", "fEinheit", "fEinheitspreis", "fPositionstyp", "fAktiv"].forEach(id => {
    $(id).addEventListener("input", onFormInput);
    $(id).addEventListener("change", onFormInput);
  });
  $("positionForm").addEventListener("submit", e => { e.preventDefault(); flushSave(); });
  $("closeInspector").addEventListener("click", closeInspector);
  $("duplicateButton").addEventListener("click", duplicatePosition);
  $("deleteButton").addEventListener("click", deletePosition);

  // Tastatur: Strg/Cmd+S speichern, Strg/Cmd+Enter neue Position, Esc schließen
  document.addEventListener("keydown", e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); flushSave(); }
    else if (mod && e.key === "Enter") { e.preventDefault(); insertPosition(); }
    else if (e.key === "Escape" && !document.querySelector("dialog[open]") && sel.posId) closeInspector();
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
