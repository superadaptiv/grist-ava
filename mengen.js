// ======================================================
// MENGEN & VARIABLEN  ·  Teil des LV-Editors (ab 2.9)
// Variablen je Projekt, Formeln im Mengenfeld, Mengenansatz (Rechenzeilen),
// automatisches Nachrechnen und Druck „Mengenermittlung“.
// Nutzt die Hilfsfunktionen aus app.js (db, apply, esc, $, toast, num, refId …).
// ======================================================
"use strict";

const MG = { vars: "Variablen" };
const MG_SCHEMA = [
  { table: MG.vars, cols: [
    { id: "Projekt", type: "Ref:Projekte", show: "Projektname" },
    { id: "Name", type: "Text" },
    { id: "Formel", type: "Text", label: "Formel / Wert" },
    { id: "Wert", type: "Numeric", widgetOptions: JSON.stringify({ decimals: 3, maxDecimals: 6 }) },
    { id: "Einheit", type: "Text" },
    { id: "Notiz", type: "Text" },
    { id: "Sortierung", type: "Numeric" }
  ]},
  { table: "Positionen", cols: [
    { id: "Mengenformel", type: "Text" },
    { id: "Mengenansatz", type: "Text", label: "Mengenansatz (Rechenzeilen)" }
  ]}
];

const mgdb = { vars: [] };
let mgMissing = [];
let mgVer = 0;
const mgCache = new Map();
// Zustand des Mengenbereichs im Inspektor
let mgForm = { mode: "plain", formula: "", rows: [], apply: true, posId: null };

const round3 = v => Math.round((num(v) + Number.EPSILON) * 1000) / 1000;
const mgKey = s => String(s ?? "").trim().replace(/\s+/g, "_").toLowerCase();
const mgReady = () => !mgMissing.length;

// ------------------------------------------------------
// Rechenkern: + − × / : ( ), Kommazahlen, Variablen
// ------------------------------------------------------
const MG_ID = /[\p{L}_][\p{L}\p{N}_]*/uy;

function mgTokens(src) {
  const s = String(src ?? ""), out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const n = /\d+(?:[.,]\d+)?/y; n.lastIndex = i;
    let m = n.exec(s);
    if (m) { out.push({ t: "num", v: Number(m[0].replace(",", ".")), a: i, b: i + m[0].length }); i += m[0].length; continue; }
    if (c === "[") {
      const e = s.indexOf("]", i);
      if (e < 0) throw new Error("„]“ fehlt");
      out.push({ t: "id", v: s.slice(i + 1, e).trim(), a: i, b: e + 1 }); i = e + 1; continue;
    }
    // „x“ als Malzeichen: 3,20 x 2,75 · 2x3 · Breite x Tiefe
    if ((c === "x" || c === "X") && out.length && ["num", ")", "id"].includes(out[out.length - 1].t) && !/[\p{L}_]/u.test(s[i + 1] || "")) {
      out.push({ t: "*", a: i, b: i + 1 }); i++; continue;
    }
    MG_ID.lastIndex = i; m = MG_ID.exec(s);
    if (m) { out.push({ t: "id", v: m[0], a: i, b: i + m[0].length }); i += m[0].length; continue; }
    const op = { "+": "+", "-": "-", "−": "-", "–": "-", "*": "*", "×": "*", "·": "*", "/": "/", ":": "/", "÷": "/", "(": "(", ")": ")" }[c];
    if (!op) throw new Error(`Zeichen „${c}“ ist nicht erlaubt`);
    out.push({ t: op, a: i, b: i + 1 }); i++;
  }
  return out;
}

// Wertet einen Ausdruck aus. resolve(name) liefert den Wert einer Variable oder wirft einen Fehler.
function mgEval(src, resolve) {
  const tk = mgTokens(src), refs = new Set();
  if (!tk.length) return { value: 0, refs, empty: true };
  let i = 0;
  const peek = () => tk[i]?.t;
  const startsFactor = t => t === "num" || t === "id" || t === "(";
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") { const o = tk[i++].t; const r = term(); v = o === "+" ? v + r : v - r; }
    return v;
  }
  function term() {
    let v = factor();
    for (;;) {
      if (peek() === "*" || peek() === "/") {
        const o = tk[i++].t, r = factor();
        if (o === "/" && r === 0) throw new Error("Division durch 0");
        v = o === "*" ? v * r : v / r;
      } else if (startsFactor(peek())) v *= factor(); // 2(3+4) oder 2 Breite
      else return v;
    }
  }
  function factor() {
    const t = tk[i++];
    if (!t) throw new Error("Ausdruck unvollständig");
    if (t.t === "-") return -factor();
    if (t.t === "+") return factor();
    if (t.t === "num") return t.v;
    if (t.t === "id") { refs.add(mgKey(t.v)); return resolve(t.v); }
    if (t.t === "(") {
      const v = expr();
      if (tk[i++]?.t !== ")") throw new Error("Klammer „)“ fehlt");
      return v;
    }
    throw new Error(t.t === ")" ? "Klammer „(“ fehlt" : `„${t.t}“ an falscher Stelle`);
  }
  const value = expr();
  if (i < tk.length) throw new Error(tk[i].t === ")" ? "Klammer „(“ fehlt" : "Ausdruck nicht verständlich");
  if (!Number.isFinite(value)) throw new Error("Ergebnis ungültig");
  return { value, refs };
}

// Variablen eines Projekts auswerten (mit Erkennung von Ringbezügen)
function mgVarsOf(pid) {
  return mgdb.vars.filter(v => v.project === pid).sort((a, b) => a.sort - b.sort || a.id - b.id);
}

function mgCtx(pid, override = null) {
  const key = mgVer + ":" + pid;
  if (!override && mgCache.has(key)) return mgCache.get(key);
  const list = mgVarsOf(pid).map(v => override && override.id === v.id ? { ...v, ...override } : v);
  const byKey = new Map(list.map(v => [mgKey(v.name), v]));
  const values = new Map(), errors = new Map(), refs = new Map(), state = new Map();
  function get(name) {
    const k = mgKey(name), v = byKey.get(k);
    if (!v) throw new Error(`Variable „${name}“ gibt es nicht`);
    if (values.has(k)) return values.get(k);
    if (errors.has(k)) throw new Error(`„${v.name}“ ist fehlerhaft`);
    if (state.get(k) === "busy") throw new Error(`Ringbezug über „${v.name}“`);
    state.set(k, "busy");
    try {
      if (!String(v.formula).trim()) throw new Error("kein Wert eingetragen");
      const r = mgEval(v.formula, get);
      refs.set(k, r.refs);
      values.set(k, r.value);
      return r.value;
    } catch (e) {
      errors.set(k, e.message);
      throw new Error(`„${v.name}“: ${e.message}`);
    } finally { state.delete(k); }
  }
  get.has = n => byKey.has(mgKey(n));
  for (const v of list) { try { get(v.name); } catch (e) { /* steht in errors */ } }
  // Variablen-Bezüge auch für fehlerhafte Variablen merken
  for (const v of list) if (!refs.has(mgKey(v.name))) { try { refs.set(mgKey(v.name), mgRefsOf(v.formula)); } catch (e) { refs.set(mgKey(v.name), new Set()); } }
  const ctx = { pid, list, byKey, values, errors, refs, get };
  if (!override) mgCache.set(key, ctx);
  return ctx;
}

function mgRefsOf(src) {
  try { return new Set(mgTokens(src).filter(t => t.t === "id").map(t => mgKey(t.v))); }
  catch (e) { return new Set(); }
}

function mgNiceErr(m) {
  if (/Ringbezug/.test(m)) return "Ringbezug: die Formel verweist über andere Variablen auf sich selbst";
  const unk = m.match(/Variable „[^“]*“ gibt es nicht/);
  return unk ? unk[0] : m.replace(/^(„[^“]*“: )+/, "");
}
function mgCalc(src, ctx) {
  try { return mgEval(src, ctx.get); }
  catch (e) { return { error: mgNiceErr(e.message), refs: mgRefsOf(src) }; }
}

// Mengenansatz: Zeilen [{t: Bezeichnung, f: Ansatz}]. Eine Zeile, die mit × oder / beginnt,
// rechnet mit dem Ergebnis der Zeile darüber weiter.
function mgCalcRows(rowsIn, ctx) {
  const out = rowsIn.map(r => ({ t: r.t || "", f: r.f || "" }));
  let sum = 0, error = null, last = -1;
  const refs = new Set();
  out.forEach((r, i) => {
    const f = r.f.trim();
    if (!f) { r.value = null; return; }
    const chain = /^[*×·/:÷]/.test(f) && last >= 0;
    const res = mgCalc(chain ? `(${out[last].value ?? 0})${f}` : f, ctx);
    res.refs?.forEach(k => refs.add(k));
    if (res.error) { r.error = res.error; error = error || `Zeile ${i + 1}: ${res.error}`; r.value = null; return; }
    if (chain) out[last].chained = true;
    r.value = res.value;
    last = i;
  });
  out.forEach(r => { if (r.value != null && !r.chained) sum += r.value; });
  return { rows: out, value: sum, error, refs };
}

// ------------------------------------------------------
// Positionen
// ------------------------------------------------------
function mgParseRows(text) {
  if (!text) return [];
  try {
    const a = JSON.parse(text);
    return Array.isArray(a) ? a.map(r => ({ t: String(r.t ?? ""), f: String(r.f ?? "") })) : [];
  } catch (e) { return []; }
}

function mgSpec(p) {
  const rowsA = mgParseRows(p?.Mengenansatz);
  if (rowsA.length) return { mode: "ansatz", rows: rowsA, formula: "" };
  const f = String(p?.Mengenformel ?? "").trim();
  return f ? { mode: "formel", formula: f, rows: [] } : { mode: "plain", formula: "", rows: [] };
}

function mgPosProject(p) {
  const t = title(refId(p.Titel));
  const l = db.lvs.find(x => x.id === refId(t?.Leistungsverzeichnis));
  return { pid: refId(l?.Projekt), lv: l };
}

function mgPosCalc(p, spec = mgSpec(p), pid = mgPosProject(p).pid) {
  if (spec.mode === "plain") return null;
  const ctx = mgCtx(pid);
  if (spec.mode === "formel") {
    const r = mgCalc(spec.formula, ctx);
    return { value: r.error ? null : r.value, error: r.error || null, refs: r.refs || new Set() };
  }
  return mgCalcRows(spec.rows, ctx);
}

// Kleines ƒ vor der Menge in der Liste
function mgMark(p) {
  if (!mgReady()) return "";
  const spec = mgSpec(p);
  if (spec.mode === "plain") return "";
  const r = mgPosCalc(p, spec);
  const how = spec.mode === "formel" ? "= " + spec.formula : `Mengenansatz (${spec.rows.length} Zeilen)`;
  if (r.error) return `<i class="mgf err" title="${esc(how)}\nFehler: ${esc(r.error)}">ƒ</i>`;
  if (Math.abs(round3(r.value) - num(p.Menge)) > 0.0005)
    return `<i class="mgf dev" title="${esc(how)}\nFormel ergibt ${fmtQty(r.value)} – Menge weicht ab">ƒ</i>`;
  return `<i class="mgf" title="${esc(how)}">ƒ</i>`;
}

// ------------------------------------------------------
// Laden und Einrichten
// ------------------------------------------------------
async function mgFetch() {
  const t = await grist.docApi.fetchTable(MG.vars).catch(() => null);
  mgMissing = [];
  if (!t) mgMissing.push({ table: MG.vars });
  else for (const c of MG_SCHEMA[0].cols) if (!(c.id in t)) mgMissing.push({ col: true, table: MG.vars, ...c });
  const pc = db.posCols || [];
  if (pc.length) for (const c of MG_SCHEMA[1].cols) if (!pc.includes(c.id)) mgMissing.push({ col: true, table: "Positionen", ...c });
  mgdb.vars = rows(t).map(r => ({
    id: r.id, project: refId(r.Projekt), name: String(r.Name ?? "").trim(), formula: String(r.Formel ?? ""),
    stored: r.Wert, unit: r.Einheit || "", note: r.Notiz || "", sort: num(r.Sortierung)
  }));
  mgVer++;
  mgCache.clear();
}

async function mgInstall() {
  const lines = mgMissing.map(m => m.col ? `• Spalte ${m.table}.${m.id}` : `• Tabelle ${m.table}`);
  if (!confirm(`Für Mengen und Variablen wird in Grist angelegt:\n\n${lines.join("\n")}\n\nFortfahren?`)) return;
  const actions = [], later = [];
  if (mgMissing.some(m => !m.col && m.table === MG.vars)) {
    const d = MG_SCHEMA[0];
    actions.push(["AddTable", d.table, d.cols.filter(c => !c.type.startsWith("Ref:")).map(c => ({ id: c.id, ...colInfo(c) }))]);
    d.cols.filter(c => c.type.startsWith("Ref:")).forEach(c => later.push({ table: d.table, ...c }));
  }
  const added = [...later, ...mgMissing.filter(m => m.col)];
  for (const c of added) actions.push(["AddColumn", c.table, c.id, colInfo(c)]);
  await apply(actions);
  await setRefDisplay(added.filter(c => c.show));
  await fetchAll();
  toast("Mengen und Variablen sind eingerichtet.");
  renderAll();
  if (sel.posId) mgFill(position(sel.posId));
}

// ------------------------------------------------------
// Inspektor: Formel / Mengenansatz einer Position
// ------------------------------------------------------
function mgFill(p) {
  const box = $("mgBox");
  if (!box) return;
  const spec = mgSpec(p);
  mgForm = { mode: spec.mode, formula: spec.formula, rows: spec.rows.length ? spec.rows : [], apply: true, posId: p?.id ?? null };
  if (p && spec.mode !== "plain") {
    const r = mgPosCalc(p, spec);
    if (!r.error && Math.abs(round3(r.value) - num(p.Menge)) > 0.0005) mgForm.apply = false;
  }
  mgDrawBox();
}

function mgDrawBox() {
  const box = $("mgBox"), m = $("fMenge");
  if (!box || !m) return;
  const mode = mgForm.mode;
  $("app").classList.toggle("ins-wide", mode === "ansatz" && mgReady());
  m.readOnly = mode !== "plain";
  m.classList.toggle("mg-calc", mode !== "plain");
  m.title = mode === "formel" ? "Menge aus Formel – bearbeiten unten" : mode === "ansatz" ? "Menge aus Mengenansatz – bearbeiten unten" : "Zahl eingeben oder mit = eine Formel beginnen";
  $("fMengeLbl").innerHTML = mode === "plain" ? "Menge" : `Menge <span class="mg-lock" title="${mode === "formel" ? "aus Formel" : "aus Mengenansatz"}">ƒ</span>`;
  if (!mgReady()) {
    box.innerHTML = `<div class="mg-links"><button type="button" class="link" data-mg="setup">ƒ Formeln und Variablen einrichten</button></div>`;
    return;
  }
  if (mode === "plain") {
    box.innerHTML = `<div class="mg-links"><button type="button" class="link" data-mg="toFormel" title="Menge berechnen, z. B. =4,20 + 3,85 oder =Grundfläche">ƒ Formel</button>
      <button type="button" class="link" data-mg="toAnsatz" title="Menge aus beschrifteten Rechenzeilen (Aufmaß)">≡ Mengenansatz</button>
      <button type="button" class="link" data-mg="vars">Variablen</button></div>`;
    return;
  }
  const dev = mgForm.apply ? "" : `<div class="mg-dev">Die Menge in Grist (${fmtQty(position(mgForm.posId)?.Menge)}) weicht vom Ergebnis ab.
      <span><button type="button" class="link" data-mg="applyCalc">Ergebnis übernehmen</button> · <button type="button" class="link" data-mg="detach">Formel lösen</button></span></div>`;
  if (mode === "formel") {
    box.innerHTML = `
      <div class="mg-h"><span>Mengenformel</span><span class="mg-acts">
        <button type="button" class="link" data-mg="saveVar" title="Diese Formel als Variable speichern und hier verwenden">→ Variable</button>
        <button type="button" class="link" data-mg="formelToAnsatz" title="In beschriftete Rechenzeilen umwandeln">→ Zeilen</button>
        <button type="button" class="link" data-mg="detach" title="Formel entfernen, Menge bleibt als feste Zahl">lösen</button></span></div>
      <div class="mg-in"><span class="eq">=</span><input type="text" id="mgFormel" class="mg-expr" spellcheck="false" autocomplete="off" value="${esc(mgForm.formula)}" placeholder="z. B. 2 × 3,50 + Grundfläche"></div>
      <div class="mg-res" id="mgRes"></div>
      <div class="mg-used" id="mgUsed"></div>${dev}
      <div class="mg-hint">Erlaubt: + − × / ( ) und Kommazahlen. Variablen per Name, Vorschläge erscheinen beim Tippen.</div>`;
  } else {
    box.innerHTML = `
      <div class="mg-h"><span>Mengenansatz</span><span class="mg-acts">
        <button type="button" class="link" data-mg="detach" title="Rechenzeilen entfernen, Menge bleibt als feste Zahl">lösen</button></span></div>
      <table class="mg-ma"><colgroup><col style="width:38%"><col><col style="width:66px"><col style="width:20px"></colgroup>
        <thead><tr><th>Bezeichnung</th><th>Ansatz</th><th class="r">Ergebnis</th><th></th></tr></thead>
        <tbody id="mgRows">${mgForm.rows.map((r, i) => `<tr data-i="${i}">
          <td><input type="text" data-k="t" value="${esc(r.t)}" placeholder="${i ? "" : "z. B. Achse A"}" autocomplete="off"></td>
          <td><input type="text" data-k="f" class="mg-expr" value="${esc(r.f)}" placeholder="3,20 × 2,75" spellcheck="false" autocomplete="off"></td>
          <td class="r" data-res></td>
          <td><button type="button" class="x" data-mg="delRow" data-i="${i}" title="Zeile löschen">✕</button></td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="4"><button type="button" class="link" data-mg="addRow">+ Zeile</button></td></tr>
        <tr class="sum"><td colspan="2">Summe = Menge</td><td class="r" id="mgSum" colspan="2"></td></tr></tfoot>
      </table>${dev}
      <div class="mg-hint"><kbd>Enter</kbd> neue Zeile. Beginnt ein Ansatz mit × oder /, rechnet er mit der Zeile darüber weiter (z. B. Länge, dann × Höhe). Abzüge mit Minus.</div>`;
  }
  mgUpdateResults();
}

// Ergebnisse neu berechnen, ohne die Eingabefelder neu zu zeichnen (Fokus bleibt)
function mgUpdateResults() {
  const p = position(mgForm.posId);
  if (!p) return null;
  const pid = mgPosProject(p).pid, ctx = mgCtx(pid);
  const unit = esc($("fEinheit")?.value || p.Einheit || "");
  let res;
  if (mgForm.mode === "formel") {
    res = mgCalc(mgForm.formula, ctx);
    const el = $("mgRes");
    if (el) el.innerHTML = res.error
      ? `<span class="mg-err">${esc(res.error)}</span>`
      : res.empty ? `<span class="muted">Formel eingeben</span>` : `<span>Ergebnis</span><b>${fmtQty(res.value)} ${unit}</b>`;
    const used = $("mgUsed");
    if (used) used.innerHTML = [...(res.refs || [])].map(k => {
      const v = ctx.byKey.get(k);
      return v ? `<button type="button" class="vchip" data-mg="vars" title="${esc(v.formula)}">${esc(v.name)} <i>${ctx.values.has(k) ? fmtQty(ctx.values.get(k)).replace(/,?0+$/, "") : "?"} ${esc(v.unit)}</i></button>` : "";
    }).join("");
  } else if (mgForm.mode === "ansatz") {
    res = mgCalcRows(mgForm.rows, ctx);
    document.querySelectorAll("#mgRows tr").forEach(tr => {
      const r = res.rows[+tr.dataset.i]; if (!r) return;
      const td = tr.querySelector("[data-res]");
      tr.classList.toggle("chained", !!r.chained);
      tr.classList.toggle("neg", r.value != null && r.value < 0);
      td.innerHTML = r.error ? `<span class="mg-err" title="${esc(r.error)}">Fehler</span>` : r.value == null ? "" : fmtQty(r.value);
      td.title = r.error || (r.chained ? "wird in der nächsten Zeile weitergerechnet" : "");
    });
    const s = $("mgSum");
    if (s) s.innerHTML = res.error ? `<span class="mg-err">${esc(res.error)}</span>` : `${fmtQty(res.value)} ${unit}`;
  } else return null;
  if (!res.error && mgForm.apply && !res.empty) $("fMenge").value = fmtInput(round3(res.value), 3);
  return res;
}

// Für formValues() in app.js: Formel, Ansatz und berechnete Menge
function mgFormValues() {
  if (!mgReady() || !sel.posId || mgForm.posId !== sel.posId) return {};
  const out = {
    Mengenformel: mgForm.mode === "formel" ? mgForm.formula.trim() : "",
    Mengenansatz: mgForm.mode === "ansatz" ? JSON.stringify(mgForm.rows.filter(r => r.t.trim() || r.f.trim())) : ""
  };
  if (out.Mengenansatz === "[]") out.Mengenansatz = "";
  if (mgForm.mode === "plain") return out;
  const p = position(sel.posId);
  const r = mgForm.mode === "formel" ? mgCalc(mgForm.formula, mgCtx(mgPosProject(p).pid)) : mgCalcRows(mgForm.rows, mgCtx(mgPosProject(p).pid));
  out.Menge = (!r.error && mgForm.apply) ? round3(r.value) : num(p.Menge);
  return out;
}

function mgChanged() { mgForm.apply = true; mgUpdateResults(); onFormInput(); }

function mgSetMode(mode, focus = true) {
  const p = position(sel.posId);
  if (!p) return;
  const cur = parseDe($("fMenge").value);
  if (mode === "formel") mgForm.formula = mgForm.formula || (cur ? fmtInput(cur, 3) : "");
  if (mode === "ansatz" && !mgForm.rows.length) {
    mgForm.rows = mgForm.mode === "formel" && mgForm.formula ? [{ t: "", f: mgForm.formula }]
      : cur ? [{ t: "", f: fmtInput(cur, 3) }] : [{ t: "", f: "" }];
  }
  if (mode === "plain") { mgForm.formula = ""; mgForm.rows = []; }
  mgForm.mode = mode;
  mgForm.apply = true;
  mgDrawBox();
  onFormInput();
  if (focus && mode === "formel") { const i = $("mgFormel"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  if (focus && mode === "ansatz") document.querySelector("#mgRows tr:last-child [data-k='f']")?.focus();
}

async function mgSaveAsVar() {
  const p = position(sel.posId);
  if (!p || !mgForm.formula.trim()) return toast("Erst eine Formel eingeben.");
  const pid = mgPosProject(p).pid;
  const sug = mgValidName(String(p.Kurztext || "Menge").split(/[,(]/)[0], pid) ? String(p.Kurztext).split(/[,(]/)[0].trim().replace(/\s+/g, "_") : "";
  const raw = prompt("Name der neuen Variable (Buchstaben, Ziffern, _):", sug);
  if (raw == null) return;
  const name = raw.trim().replace(/\s+/g, "_");
  const err = mgValidName(name, pid);
  if (err) return toast(err);
  await flushSave();
  await apply([["AddRecord", MG.vars, null, { Projekt: pid, Name: name, Formel: mgForm.formula.trim(), Einheit: p.Einheit || "", Sortierung: mgNextSort(pid) }]], { refresh: false });
  await mgFetch();
  mgForm.formula = name;
  mgDrawBox();
  onFormInput();
  toast(`Variable „${name}“ angelegt.`);
}

// ------------------------------------------------------
// Vorschläge beim Tippen (Variablen)
// ------------------------------------------------------
let mgAcState = null;
function mgAcFrag(inp) {
  const pos = inp.selectionStart ?? inp.value.length;
  const before = inp.value.slice(0, pos);
  const m = before.match(/\[([^\]]*)$/) || before.match(/([\p{L}_][\p{L}\p{N}_]*)$/u);
  if (!m) return null;
  return { text: m[1], from: pos - m[0].length, to: pos };
}
function mgAcOpen(inp) {
  const f = mgAcFrag(inp);
  const pid = sel.projectId;
  if (!f || !pid) return mgAcClose();
  const q = mgKey(f.text);
  const self = inp.closest("[data-var]")?.dataset.var;
  const ctx = mgCtx(pid);
  const list = ctx.list.filter(v => String(v.id) !== self && mgKey(v.name).includes(q) && mgKey(v.name) !== q)
    .sort((a, b) => mgKey(b.name).startsWith(q) - mgKey(a.name).startsWith(q) || a.name.localeCompare(b.name, "de"))
    .slice(0, 8);
  if (!list.length || (!q && !inp.value.slice(0, f.from).endsWith("["))) return mgAcClose();
  let el = $("mgAc");
  if (!el) { el = document.createElement("div"); el.id = "mgAc"; el.className = "mg-ac"; document.body.appendChild(el); }
  mgAcState = { inp, f, list, i: 0 };
  const r = inp.getBoundingClientRect();
  el.style.left = Math.min(r.left, window.innerWidth - 300) + "px";
  el.style.top = r.bottom + 4 + "px";
  mgAcDraw();
}
function mgAcDraw() {
  const el = $("mgAc"), s = mgAcState;
  if (!el || !s) return;
  const ctx = mgCtx(sel.projectId);
  el.innerHTML = `<div class="h">Variablen · ↑↓ und Enter</div>` + s.list.map((v, i) => {
    const k = mgKey(v.name);
    return `<div class="o ${i === s.i ? "on" : ""}" data-i="${i}"><span><span class="vchip">${esc(v.name)}</span><small>${esc(v.formula)}</small></span><b>${ctx.values.has(k) ? fmtQty(ctx.values.get(k)) : "?"} ${esc(v.unit)}</b></div>`;
  }).join("");
  el.hidden = false;
}
function mgAcPick(i) {
  const s = mgAcState;
  if (!s) return;
  const v = s.list[i], val = s.inp.value;
  const bracket = val.slice(0, s.f.from + 1).endsWith("[") && val[s.f.from] === "[";
  const ins = v.name;
  const end = bracket && val[s.f.to] === "]" ? s.f.to + 1 : s.f.to;
  s.inp.value = val.slice(0, s.f.from) + ins + val.slice(end);
  const c = s.f.from + ins.length;
  s.inp.setSelectionRange(c, c);
  mgAcClose();
  s.inp.dispatchEvent(new Event("input", { bubbles: true }));
  s.inp.focus();
}
function mgAcClose() { mgAcState = null; const el = $("mgAc"); if (el) el.hidden = true; }
function mgAcKey(e) {
  const s = mgAcState;
  if (!s || s.inp !== e.target) return false;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { s.i = (s.i + (e.key === "ArrowDown" ? 1 : -1) + s.list.length) % s.list.length; mgAcDraw(); }
  else if (e.key === "Enter" || e.key === "Tab") mgAcPick(s.i);
  else if (e.key === "Escape") mgAcClose();
  else return false;
  e.preventDefault(); e.stopPropagation();
  return true;
}

// ------------------------------------------------------
// Bereich „Mengen & Variablen“
// ------------------------------------------------------
function mgValidName(name, pid, selfId = null) {
  if (!name) return "Bitte einen Namen eingeben.";
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name)) return "Name: nur Buchstaben, Ziffern und _ (keine Leerzeichen, nicht mit Ziffer beginnen).";
  if (/^x$/i.test(name)) return "„x“ ist als Malzeichen reserviert.";
  if (mgVarsOf(pid).some(v => v.id !== selfId && mgKey(v.name) === mgKey(name))) return `Die Variable „${name}“ gibt es in diesem Projekt schon.`;
  return null;
}
const mgNextSort = pid => Math.max(0, ...mgVarsOf(pid).map(v => v.sort)) + 1;

// Positionen eines Projekts mit Formel oder Mengenansatz
function mgFormulaPositions(pid) {
  const out = [];
  for (const p of db.positions) {
    const spec = mgSpec(p);
    if (spec.mode === "plain") continue;
    const { pid: ppid, lv: l } = mgPosProject(p);
    if (ppid !== pid) continue;
    out.push({ p, spec, lv: l, calc: mgPosCalc(p, spec, pid) });
  }
  return out.sort((a, b) => String(lvNr(a.lv)).localeCompare(String(lvNr(b.lv)), "de", { numeric: true })
    || String(a.p.Positionsnummer).localeCompare(String(b.p.Positionsnummer), "de", { numeric: true }));
}

const mgLvLocked = l => LOCKED_STATES.includes(lvState(l));
function mgPosState(x) {
  if (x.calc.error) return "err";
  if (Math.abs(round3(x.calc.value) - num(x.p.Menge)) > 0.0005) return mgLvLocked(x.lv) ? "locked" : "dev";
  return "ok";
}

function mgRender() {
  if (view !== "mengen") return;
  const ps = $("mgProject");
  ps.innerHTML = db.projects.length ? "" : '<option value="">Kein Projekt</option>';
  [...db.projects].filter(p => p.Projektname || p.Projektnummer)
    .sort((a, b) => String(a.Projektnummer).localeCompare(String(b.Projektnummer), "de", { numeric: true }))
    .forEach(p => ps.add(new Option(`${p.Projektnummer ? p.Projektnummer + " " : ""}${p.Projektname || ""}`, p.id)));
  ps.value = sel.projectId ?? "";
  $("mgBanner").hidden = mgReady();
  $("mgBannerText").textContent = mgMissing.some(m => !m.col)
    ? "Es fehlt die Tabelle „Variablen“ und in „Positionen“ die Spalten für Formel und Mengenansatz. Ein Klick legt sie an."
    : "Es fehlen Spalten: " + mgMissing.map(m => `${m.table}.${m.id}`).join(", ");
  $("mgAdd").disabled = !mgReady() || !sel.projectId;
  const body = $("mgBody");
  if (!sel.projectId) { body.innerHTML = `<div class="empty"><b>Kein Projekt gewählt</b></div>`; $("mgRecalc").hidden = true; return; }
  if (!mgReady()) { body.innerHTML = ""; $("mgRecalc").hidden = true; return; }
  const pid = sel.projectId, ctx = mgCtx(pid), fps = mgFormulaPositions(pid);
  // Wer verwendet welche Variable?
  const usedBy = new Map();
  const addUse = (k, label) => { if (!usedBy.has(k)) usedBy.set(k, []); usedBy.get(k).push(label); };
  for (const v of ctx.list) for (const k of ctx.refs.get(mgKey(v.name)) || []) addUse(k, { v });
  for (const x of fps) for (const k of x.calc.refs || []) addUse(k, { p: x.p });
  const dev = fps.filter(x => mgPosState(x) === "dev").length;
  $("mgRecalc").hidden = !dev;
  $("mgRecalc").textContent = `${dev} Menge${dev === 1 ? "" : "n"} aktualisieren`;

  const varRows = ctx.list.map(v => {
    const k = mgKey(v.name), err = ctx.errors.has(k) ? mgNiceErr(ctx.errors.get(k)) : null;
    const uses = (usedBy.get(k) || []).map(u => u.p
      ? `<button type="button" class="mg-use" data-open-pos="${u.p.id}" title="${esc(u.p.Kurztext)}">${esc(u.p.Positionsnummer || "Pos.")}</button>`
      : `<span class="mg-use v">${esc(u.v.name)}</span>`).join("");
    return `<tr data-var="${v.id}">
      <td><input type="text" data-k="name" value="${esc(v.name)}" placeholder="Name" spellcheck="false" autocomplete="off"></td>
      <td><input type="text" data-k="formula" class="mg-expr mono" value="${esc(v.formula)}" placeholder="z. B. 4,20 + 3,85 oder Breite × Tiefe" spellcheck="false" autocomplete="off"></td>
      <td class="r res">${err ? `<span class="mg-err" title="${esc(err)}">${esc(err)}</span>` : fmtQty(ctx.values.get(k))}</td>
      <td><input type="text" data-k="unit" value="${esc(v.unit)}" placeholder="Einheit" list="mgUnitList" autocomplete="off"></td>
      <td><input type="text" data-k="note" value="${esc(v.note)}" placeholder="Notiz" autocomplete="off"></td>
      <td><div class="uses">${uses || '<span class="muted">–</span>'}</div></td>
      <td><button type="button" class="x" data-del-var="${v.id}" title="Variable löschen">✕</button></td></tr>`;
  }).join("");

  const stateLbl = { ok: "", dev: '<span class="mg-st dev">weicht ab</span>', locked: '<span class="mg-st lock" title="LV ist ausgeschrieben oder beauftragt: Mengen werden nicht automatisch geändert">weicht ab · LV gesperrt</span>', err: '<span class="mg-st err">Fehler</span>' };
  const posRows = fps.map(x => {
    const st = mgPosState(x);
    const how = x.spec.mode === "formel" ? `= ${esc(x.spec.formula)}` : `<span class="muted">Mengenansatz, ${x.spec.rows.length} Zeile${x.spec.rows.length === 1 ? "" : "n"}</span>`;
    return `<tr class="mg-prow" data-open-pos="${x.p.id}">
      <td class="mono muted">${esc(lvNr(x.lv) ? "LV " + lvNr(x.lv) : "")}</td>
      <td class="mono">${esc(x.p.Positionsnummer)}</td>
      <td class="kt">${esc(x.p.Kurztext || "(ohne Kurztext)")}</td>
      <td class="mono fx">${how}</td>
      <td class="r">${fmtQty(x.p.Menge)} ${esc(x.p.Einheit || "")}</td>
      <td>${st === "err" ? `<span class="mg-st err" title="${esc(x.calc.error)}">Fehler</span>` : st === "ok" ? "" : stateLbl[st] + ` <small class="muted">→ ${fmtQty(x.calc.value)}</small>`}</td></tr>`;
  }).join("");

  body.innerHTML = `
    <p class="mg-intro">Variablen gelten für alle LVs des Projekts. In einer Position gibst du im Mengenfeld <b>=</b> und dann eine Formel ein, z. B. <code>=Grundfläche</code> oder <code>=2 × Fundament_Länge × 0,60</code>. Ändert sich eine Variable, rechnen alle Positionen mit.</p>
    <table class="mg-vt">
      <colgroup><col style="width:17%"><col style="width:30%"><col style="width:11%"><col style="width:7%"><col style="width:15%"><col><col style="width:28px"></colgroup>
      <thead><tr><th>Name</th><th>Formel / Wert</th><th class="r">Ergebnis</th><th>Einheit</th><th>Notiz</th><th>verwendet in</th><th></th></tr></thead>
      <tbody>${varRows || `<tr><td colspan="7" class="muted mg-none">Noch keine Variablen. Lege z. B. „Grundfläche“ mit <code>8,75 × 7,10</code> an.</td></tr>`}</tbody>
    </table>
    <datalist id="mgUnitList">${((typeof choices !== "undefined" && choices.Einheit) || DEFAULT_CHOICES.Einheit).map(u => `<option value="${esc(u)}">`).join("")}</datalist>
    <button type="button" class="link mg-addrow" id="mgAdd2">+ Variable</button>
    <h3 class="mg-sec">Positionen mit berechneter Menge <span class="muted">${fps.length}</span></h3>
    ${fps.length ? `<table class="mg-pt"><colgroup><col style="width:64px"><col style="width:96px"><col style="width:28%"><col><col style="width:120px"><col style="width:200px"></colgroup><tbody>${posRows}</tbody></table>`
      : `<p class="muted">Noch keine. Öffne eine Position und tippe im Feld Menge ein <b>=</b>.</p>`}`;
}

async function mgAddVar() {
  const pid = sel.projectId;
  if (!pid || !mgReady()) return;
  let n = mgVarsOf(pid).length + 1, name = "Variable_" + n;
  while (mgValidName(name, pid)) name = "Variable_" + ++n;
  const res = await apply([["AddRecord", MG.vars, null, { Projekt: pid, Name: name, Formel: "", Sortierung: mgNextSort(pid) }]], { refresh: false });
  await mgFetch();
  mgRender();
  const id = newRowId(res);
  const inp = document.querySelector(`tr[data-var="${id}"] [data-k="name"]`);
  if (inp) { inp.focus(); inp.select(); }
}

// Verweise in einem Ausdruck umbenennen (nur ganze Namen)
function mgRenameIn(src, oldName, newName) {
  let tk;
  try { tk = mgTokens(src); } catch (e) { return src; }
  let out = String(src), shift = 0;
  for (const t of tk) {
    if (t.t !== "id" || mgKey(t.v) !== mgKey(oldName)) continue;
    out = out.slice(0, t.a + shift) + newName + out.slice(t.b + shift);
    shift += newName.length - (t.b - t.a);
  }
  return out;
}

async function mgSaveVarField(inp) {
  const tr = inp.closest("tr[data-var]"), id = +tr.dataset.var;
  const v = mgdb.vars.find(x => x.id === id);
  if (!v) return;
  const k = inp.dataset.k, val = inp.value;
  const actions = [];
  if (k === "name") {
    const name = val.trim().replace(/\s+/g, "_");
    if (name === v.name) return;
    const err = mgValidName(name, v.project, id);
    if (err) { toast(err); inp.value = v.name; return; }
    actions.push(["UpdateRecord", MG.vars, id, { Name: name }]);
    // Verweise in Variablen und Positionen mit umbenennen
    for (const o of mgVarsOf(v.project)) {
      const f = mgRenameIn(o.formula, v.name, name);
      if (f !== o.formula) actions.push(["UpdateRecord", MG.vars, o.id, { Formel: f }]);
    }
    for (const x of mgFormulaPositions(v.project)) {
      if (x.spec.mode === "formel") {
        const f = mgRenameIn(x.spec.formula, v.name, name);
        if (f !== x.spec.formula) actions.push(["UpdateRecord", T.positions, x.p.id, { Mengenformel: f }]);
      } else {
        const rowsN = x.spec.rows.map(r => ({ ...r, f: mgRenameIn(r.f, v.name, name) }));
        if (JSON.stringify(rowsN) !== JSON.stringify(x.spec.rows)) actions.push(["UpdateRecord", T.positions, x.p.id, { Mengenansatz: JSON.stringify(rowsN) }]);
      }
    }
  } else {
    const col = { formula: "Formel", unit: "Einheit", note: "Notiz" }[k];
    const old = { formula: v.formula, unit: v.unit, note: v.note }[k];
    if (val === old) return;
    actions.push(["UpdateRecord", MG.vars, id, { [col]: val }]);
  }
  await apply(actions, { refresh: false });
  await fetchAll();
  await mgRecalc(v.project, { quiet: true });
  mgRender();
}

async function mgDeleteVar(id) {
  const v = mgdb.vars.find(x => x.id === id);
  if (!v) return;
  const ctx = mgCtx(v.project), k = mgKey(v.name);
  const users = [
    ...ctx.list.filter(o => (ctx.refs.get(mgKey(o.name)) || new Set()).has(k)).map(o => o.name),
    ...mgFormulaPositions(v.project).filter(x => (x.calc.refs || new Set()).has(k)).map(x => x.p.Positionsnummer)
  ];
  const msg = users.length
    ? `„${v.name}“ wird verwendet in: ${users.join(", ")}.\nDiese Formeln zeigen danach einen Fehler, die Mengen bleiben aber stehen.\n\nTrotzdem löschen?`
    : `Variable „${v.name}“ löschen?`;
  if (!confirm(msg)) return;
  await apply([["RemoveRecord", MG.vars, id]], { refresh: false });
  await fetchAll();
  mgRender();
}

// Alle Variablen-Werte und berechneten Mengen eines Projekts nachziehen
async function mgRecalc(pid, { quiet = false } = {}) {
  if (!mgReady() || !pid) return;
  const ctx = mgCtx(pid), actions = [];
  for (const v of ctx.list) {
    const k = mgKey(v.name);
    const val = ctx.values.has(k) ? Math.round(ctx.values.get(k) * 1e6) / 1e6 : null;
    if (val !== null && (v.stored === null || v.stored === undefined || Math.abs(num(v.stored) - val) > 1e-9)) actions.push(["UpdateRecord", MG.vars, v.id, { Wert: val }]);
  }
  let locked = 0, changed = 0, errs = 0;
  for (const x of mgFormulaPositions(pid)) {
    const st = mgPosState(x);
    if (st === "err") errs++;
    if (st === "locked") locked++;
    if (st !== "dev") continue;
    actions.push(["UpdateRecord", T.positions, x.p.id, { Menge: round3(x.calc.value) }]);
    changed++;
  }
  if (actions.length) await apply(actions);
  if (changed || !quiet) renderAll();
  const parts = [];
  if (changed) parts.push(`${changed} Menge${changed === 1 ? "" : "n"} aktualisiert`);
  if (locked) parts.push(`${locked} in gesperrten LVs nicht geändert`);
  if (errs) parts.push(`${errs} Formel${errs === 1 ? "" : "n"} mit Fehler`);
  if (parts.length && (changed || !quiet || locked)) toast(parts.join(" · ") + ".");
  else if (!quiet) toast("Alle Mengen sind aktuell.");
}

// ------------------------------------------------------
// Druck: Mengenermittlung zum aktuellen LV
// ------------------------------------------------------
const mgPretty = s => esc(String(s ?? "").replace(/\*/g, "×").replace(/-/g, "−"));

function mgLvPositions() {
  const out = [];
  for (const t of walk()) for (const p of positionsOf(t.id)) {
    if (!isActive(p.Aktiv)) continue;
    const spec = mgSpec(p);
    if (spec.mode !== "plain") out.push({ p, spec, calc: mgPosCalc(p, spec, sel.projectId) });
  }
  return out;
}

// Für den Druck: weitergerechnete Zeilen (× Höhe) mit der Zeile darüber zusammenfassen
function mgPrintRows(rowsC) {
  const out = [];
  for (const r of rowsC) {
    if (!r.t.trim() && !r.f.trim()) continue;
    const prev = out[out.length - 1];
    if (prev && prev.chained && /^[*×·/:÷]/.test(r.f.trim())) {
      prev.f = `${prev.f} ${r.f.trim()}`; prev.value = r.value; prev.error = r.error; prev.chained = r.chained;
      if (r.t.trim()) prev.t = prev.t ? `${prev.t}, ${r.t}` : r.t;
    } else out.push({ ...r });
  }
  return out;
}

function mgBuildPrintHtml() {
  const l = lv(), pr = project();
  const list = mgLvPositions();
  const ctx = mgCtx(sel.projectId);
  // alle direkt und indirekt verwendeten Variablen
  const used = new Set();
  const visit = k => { if (used.has(k) || !ctx.byKey.has(k)) return; used.add(k); (ctx.refs.get(k) || []).forEach(visit); };
  list.forEach(x => (x.calc.refs || []).forEach(visit));
  const vars = ctx.list.filter(v => used.has(mgKey(v.name)));
  const blocks = list.map(({ p, spec, calc }) => {
    const unit = esc(p.Einheit || "");
    const lines = spec.mode === "formel"
      ? `<tr><td></td><td class="f">${mgPretty(spec.formula)}</td><td class="r">${calc.error ? "Fehler" : fmtQty(calc.value)}</td></tr>`
      : mgPrintRows(calc.rows).map(r => `<tr><td>${esc(r.t)}</td><td class="f">${mgPretty(r.f)}</td><td class="r">${r.error ? "Fehler" : r.value == null ? "" : fmtQty(r.value)}</td></tr>`).join("");
    return `<section class="pos">
      <div class="ph"><span class="oz">${esc(p.Positionsnummer)}</span><span class="kt">${esc(p.Kurztext)}</span><span class="m">${fmtQty(p.Menge)} ${unit}</span></div>
      <table class="rows"><colgroup><col style="width:78mm"><col><col style="width:24mm"></colgroup>${lines}
        ${spec.mode === "ansatz" ? `<tr class="s"><td>Summe</td><td></td><td class="r">${fmtQty(p.Menge)} ${unit}</td></tr>` : ""}</table></section>`;
  }).join("");
  const varTable = vars.length ? `<h2>Verwendete Variablen</h2>
    <table class="vars"><colgroup><col style="width:42mm"><col><col style="width:22mm"><col style="width:16mm"></colgroup>
    <thead><tr><th>Name</th><th>Formel / Wert</th><th class="r">Wert</th><th>Einheit</th></tr></thead>
    <tbody>${vars.map(v => { const k = mgKey(v.name); return `<tr><td>${esc(v.name)}</td><td class="f">${mgPretty(v.formula)}</td><td class="r">${ctx.values.has(k) ? fmtQty(ctx.values.get(k)) : "Fehler"}</td><td>${esc(v.unit)}</td></tr>`; }).join("")}</tbody></table>` : "";
  const stamp = new Date().toLocaleDateString("de-DE");
  const pagedSrc = new URL("vendor/paged.polyfill.min.js", location.href).href;
  const logo = settings.logo || "";
  const font = `"Family", "Iowan Old Style", Charter, Georgia, serif`;
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Mengenermittlung LV ${esc(lvNr(l))} ${esc(pr?.Projektnummer || "")}</title><style>
  @page { size: A4; margin: 20mm 20mm 28mm 20.5mm;
    @bottom-left { content: "Seite " counter(page) " von " counter(pages) "  ·  erstellt am ${stamp}"; vertical-align: bottom; padding-bottom: 16.6mm; font: 300 7.5pt ${font}; color: #8a8a8a; width: 69mm; }
    @bottom-right { content: element(logo); vertical-align: bottom; text-align: right; padding-bottom: 16.35mm; width: 100mm; } }
  html { font: 300 9pt/1.35 ${font}; color: #111; }
  body { margin: 0; }
  .logo-run { position: running(logo); text-align: right; line-height: 0; }
  .logo-run img { height: 4.66mm; width: auto; max-width: 80mm; display: inline-block; }
  h1 { font-weight: 500; font-size: 10.5pt; margin: 0 0 9mm; }
  h2 { font-weight: 500; font-size: 10pt; margin: 10mm 0 3mm; break-after: avoid; }
  .meta { border-collapse: collapse; margin-bottom: 8mm; font-size: 10pt; }
  .meta td { padding: 0 0 1.1mm; vertical-align: top; }
  .meta td:first-child { width: 33mm; }
  .pos { break-inside: avoid; margin-bottom: 5mm; }
  .ph { display: flex; gap: 4mm; border-bottom: .6pt solid #111; padding-bottom: 1.2mm; margin-bottom: 1.6mm; font-weight: 400; }
  .ph .oz { width: 24mm; flex: none; font-variant-numeric: tabular-nums; }
  .ph .kt { flex: 1; }
  .ph .m { font-variant-numeric: tabular-nums; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td, th { padding: .5mm 0 .9mm; vertical-align: top; }
  th { font-weight: 300; text-align: left; border-bottom: .6pt solid #111; padding-bottom: 1.2mm; }
  .rows td:first-child { padding-left: 28mm; }
  .vars th:last-child, .vars td:last-child { padding-left: 4mm; }
  .f { font-variant-numeric: tabular-nums; }
  .r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.s td { border-top: .4pt solid #999; padding-top: 1mm; font-weight: 400; }
  .vars tbody tr:first-child td { padding-top: 2mm; }
  .vars tr { break-inside: avoid; }
  </style></head><body>
  ${logo ? `<div class="logo-run"><img src="${logo}" alt=""></div>` : ""}
  <h1>Mengenermittlung</h1>
  <table class="meta"><tr><td>Projekt</td><td>${esc(pr?.Projektname || "")}</td></tr><tr><td>Projekt-Nr.</td><td>${esc(pr?.Projektnummer || "")}</td></tr>
    <tr><td>Leistungsverzeichnis</td><td>LV ${esc(lvNr(l))} ${esc(lvName(l))}</td></tr><tr><td>Stand</td><td>${stamp}</td></tr></table>
  ${blocks}
  ${varTable}
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
// Ereignisse
// ------------------------------------------------------
function mgBind() {
  // Inspektor
  $("fMenge").addEventListener("input", e => {
    if (!mgReady() || mgForm.mode !== "plain") return;
    const v = e.target.value.trim();
    if (!v.startsWith("=")) return;
    mgForm.formula = v.slice(1).trim();
    mgSetMode("formel");
  });
  $("fMenge").addEventListener("click", () => {
    if (mgForm.mode === "formel") $("mgFormel")?.focus();
    if (mgForm.mode === "ansatz") document.querySelector("#mgRows [data-k='f']")?.focus();
  });
  $("fEinheit").addEventListener("input", () => mgUpdateResults());
  const box = $("mgBox");
  box.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "mgFormel") { mgForm.formula = t.value; mgChanged(); }
    else if (t.closest("#mgRows")) {
      const i = +t.closest("tr").dataset.i;
      mgForm.rows[i][t.dataset.k] = t.value;
      mgChanged();
    }
    if (t.classList.contains("mg-expr")) mgAcOpen(t);
  });
  box.addEventListener("keydown", e => {
    if (mgAcKey(e)) return;
    const t = e.target;
    if (e.key === "Enter" && t.closest("#mgRows")) {
      e.preventDefault();
      const i = +t.closest("tr").dataset.i;
      mgForm.rows.splice(i + 1, 0, { t: "", f: "" });
      mgDrawBox();
      document.querySelector(`#mgRows tr[data-i="${i + 1}"] [data-k="${t.dataset.k === "t" ? "t" : "f"}"]`)?.focus();
    }
    if (e.key === "Enter" && t.id === "mgFormel") { e.preventDefault(); flushSave(); }
  });
  box.addEventListener("focusout", () => setTimeout(() => { if (!document.activeElement?.classList.contains("mg-expr")) mgAcClose(); }, 150));
  box.addEventListener("click", async e => {
    const b = e.target.closest("[data-mg]");
    if (!b) return;
    const a = b.dataset.mg;
    if (a === "toFormel") mgSetMode("formel");
    else if (a === "toAnsatz") mgSetMode("ansatz");
    else if (a === "formelToAnsatz") { mgForm.rows = []; mgSetMode("ansatz"); }
    else if (a === "detach") {
      mgForm.mode = "plain"; mgForm.formula = ""; mgForm.rows = []; mgForm.apply = true;
      $("fMenge").value = fmtInput(position(sel.posId)?.Menge, 3);
      mgDrawBox(); onFormInput();
    }
    else if (a === "applyCalc") { mgForm.apply = true; mgDrawBox(); onFormInput(); }
    else if (a === "addRow") {
      mgForm.rows.push({ t: "", f: "" }); mgDrawBox();
      document.querySelector("#mgRows tr:last-child [data-k='t']")?.focus();
    }
    else if (a === "delRow") {
      mgForm.rows.splice(+b.dataset.i, 1);
      if (!mgForm.rows.length) mgForm.rows.push({ t: "", f: "" });
      mgDrawBox(); mgChanged();
    }
    else if (a === "saveVar") mgSaveAsVar();
    else if (a === "vars" || a === "setup") { await flushSave(); setView("mengen"); }
  });
  // Vorschlagsliste
  document.addEventListener("mousedown", e => {
    const o = e.target.closest("#mgAc .o");
    if (o) { e.preventDefault(); mgAcPick(+o.dataset.i); }
    else if (!e.target.closest("#mgAc")) mgAcClose();
  });
  // Bereich Mengen & Variablen
  $("mgInstall").addEventListener("click", mgInstall);
  $("mgAdd").addEventListener("click", mgAddVar);
  $("mgRecalc").addEventListener("click", () => mgRecalc(sel.projectId));
  $("mgProject").addEventListener("change", e => {
    const pid = Number(e.target.value) || null;
    sel.projectId = pid;
    sel.lvId = db.lvs.filter(l => refId(l.Projekt) === pid).sort((a, b) => String(lvNr(a)).localeCompare(String(lvNr(b)), "de", { numeric: true }))[0]?.id ?? null;
    sel.nodeId = sel.posId = null;
    if (pid) localStorage.setItem("lv.project", pid);
    mgRender();
  });
  const body = $("mgBody");
  body.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.k === "formula") {
      const tr = t.closest("tr[data-var]"), id = +tr.dataset.var;
      const ctx = mgCtx(sel.projectId, { id, formula: t.value });
      const v = ctx.list.find(x => x.id === id), k = mgKey(v.name);
      const err = ctx.errors.has(k) ? mgNiceErr(ctx.errors.get(k)) : null;
      tr.querySelector(".res").innerHTML = err ? `<span class="mg-err" title="${esc(err)}">${esc(err)}</span>` : fmtQty(ctx.values.get(k));
      mgAcOpen(t);
    }
  });
  body.addEventListener("keydown", e => {
    if (mgAcKey(e)) return;
    if (e.key === "Enter" && e.target.matches("tr[data-var] input")) { e.preventDefault(); e.target.blur(); }
    if (e.key === "Escape" && e.target.matches("tr[data-var] input")) { const v = mgdb.vars.find(x => x.id === +e.target.closest("tr").dataset.var); if (v) e.target.value = { name: v.name, formula: v.formula, unit: v.unit, note: v.note }[e.target.dataset.k]; e.target.blur(); }
  });
  body.addEventListener("change", e => { if (e.target.matches("tr[data-var] input")) mgSaveVarField(e.target); });
  body.addEventListener("focusout", () => setTimeout(() => { if (!document.activeElement?.classList.contains("mg-expr")) mgAcClose(); }, 150));
  body.addEventListener("click", async e => {
    const d = e.target.closest("[data-del-var]");
    if (d) return mgDeleteVar(+d.dataset.delVar);
    if (e.target.closest("#mgAdd2")) return mgAddVar();
    const o = e.target.closest("[data-open-pos]");
    if (o && !e.target.closest("input")) {
      const p = position(+o.dataset.openPos);
      if (!p) return;
      const { pid, lv: l } = mgPosProject(p);
      sel.projectId = pid; sel.lvId = l?.id ?? null;
      setView("edit");
      await selectPosition(p.id);
    }
  });
}

mgBind();
// Falls app.js schon fertig geladen hat, bevor diese Datei kam
mgFetch().then(() => {
  if (!db.positions.length && !db.projects.length) return;
  renderAll();
  if (sel.posId && position(sel.posId)) mgFill(position(sel.posId));
}).catch(() => {});
