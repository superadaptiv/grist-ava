// ======================================================
// NOTIZEN und BAUZEITENPLAN  ·  Teil des LV-Editors (ab Version 4.0)
// Ein Eintrag (Tabelle „Aufgaben“) wächst mit: Text = Notiz,
// Status = Aufgabe, Beginn/Ende = Balken im Bauzeitenplan.
// Zeitbuchungen bleiben eigene Zeilen und zeigen auf den Eintrag.
// Nutzt die Helfer aus app.js, zeit.js und aufgaben.js.
// ======================================================
"use strict";

let ntProject = localStorage.getItem("lv-nt-project") || "";
let ntMode = localStorage.getItem("lv-nt-mode") || "all";      // all | notes
let ntQuery = "";
let plProject = localStorage.getItem("lv-pl-project") || "";
let plScale = localStorage.getItem("lv-pl-scale") || "month";  // week | month | quarter
let plDue = localStorage.getItem("lv-pl-due") === "1";         // Aufgaben mit Fälligkeit als kurze Balken
let plDrag = null, plJustDragged = false;

// Banner (gemeinsam)
function enBanner(prefix) {
  const need = agNeeds();
  $(prefix + "Banner").hidden = !need.length;
  $(prefix + "BannerText").textContent = agBannerText();
  return agReady();
}

// ======================================================
// NOTIZEN
// ======================================================
function ntParse(text) {
  // nur #Projekt und @Person, der Rest ist der Titel (Datumsangaben bleiben im Text)
  const out = { title: "", project: null, person: "" }, rest = [];
  for (const w of String(text || "").trim().split(/\s+/).filter(Boolean)) {
    let m;
    if ((m = /^#(.+)$/.exec(w))) {
      const q = m[1].toLowerCase();
      const p = projectsSorted().find(p => String(p.Projektnummer || "").toLowerCase().startsWith(q))
        || projectsSorted().find(p => String(p.Projektname || "").toLowerCase().includes(q));
      if (p) { out.project = p.id; continue; }
    }
    if ((m = /^@(.+)$/.exec(w))) { out.person = m[1].charAt(0).toUpperCase() + m[1].slice(1); continue; }
    rest.push(w);
  }
  out.title = rest.join(" ");
  return out;
}

async function ntAdd() {
  const inp = $("ntQuick"); if (!inp) return;
  const p = ntParse(inp.value);
  if (!p.title) return toast("Bitte einen Text eingeben.");
  const t = { title: p.title, project: p.project || Number(ntProject) || null, lv: null, status: "", due: null, time: "", high: false,
    person: p.person || ztPerson(), lp: null, tag: null, est: 0, steps: [], note: "", repeat: "", doneAt: null, created: todayKey() };
  const res = await apply([["AddRecord", AG.tasks, null, agFields(t)]], { refresh: false });
  inp.value = "";
  await agFetch();
  const id = newRowId(res);
  if (id) agSel = id;
  ntRender();
  // gleich weiterschreiben: in die Notiz springen
  setTimeout(() => $("agdNote")?.focus(), 30);
}

function ntFiltered() {
  const q = ntQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return agdb.tasks.filter(t => (!ntProject || t.project === Number(ntProject))
    && (ntMode !== "notes" || agIsNote(t))
    && (agMine(t) || !agIsTask(t))
    && q.every(w => (t.title + " " + t.note + " " + t.group).toLowerCase().includes(w)));
}

function ntRowHtml(t) {
  const today = todayKey(), c = t.created;
  const when = !c ? "–" : c === today ? "heute" : c >= weekStart(today) ? fmtDay(c).slice(0, 6) : c.slice(0, 4) === today.slice(0, 4) ? agDM(c) : fmtDEs(c);
  const pj = !ntProject && t.project ? `<span class="eb eb-pj"><i class="pdot" style="background:${projColor(t.project)}"></i>${esc(projNr(t.project) || projLabel(t.project))}</span>` : "";
  const lv = t.lv ? `<span class="eb eb-pj">${esc(lvShort(t.lv))}</span>` : "";
  return `<div class="nt-row ${agSel === t.id ? "sel" : ""} ${agDone(t) ? "done" : ""}" data-agid="${t.id}">
    <span class="nt-d">${esc(when)}</span>
    <span class="nt-c"><span class="nt-t">${esc(t.title) || "<i>Ohne Titel</i>"}</span>
      ${t.note ? `<span class="nt-x">${esc(t.note)}</span>` : ""}
      <span class="nt-b">${pj}${lv}${agBadges(t)}</span></span>
  </div>`;
}

function ntListHtml() {
  const list = ntFiltered().sort((a, b) => (b.created || "").localeCompare(a.created || "") || b.id - a.id);
  const today = todayKey(), ws = weekStart(today);
  const G = [["Heute", t => t.created === today], ["Diese Woche", t => t.created && t.created >= ws && t.created < today],
    ["Früher", t => !t.created || t.created < ws], ["", t => t.created > today]];
  let h = `<div class="ag-wrap nt-wrap"><div class="ag-add"><span class="plus">+</span><input id="ntQuick" autocomplete="off" placeholder="Notiz …   #Projekt  @Person"><kbd>Enter</kbd></div>
    <div class="ag-parse nt-hint">Jeder Eintrag beginnt als Notiz. Rechts lässt er sich zur Aufgabe, zum Timer oder zum Balken im Bauzeitenplan machen.</div>`;
  for (const [name, f] of G) {
    const g = list.filter(f); if (!g.length) continue;
    h += `<div class="ag-gh"><b>${name || "Später angelegt"}</b>${name === "Heute" ? `<span>${esc(fmtDay(today))}</span>` : `<span>${g.length}</span>`}</div>` + g.map(ntRowHtml).join("");
  }
  if (!list.length) h += `<div class="zt-empty">${ntQuery ? "Nichts gefunden." : ntMode === "notes" ? "Keine reinen Notizen. Alles ist schon Aufgabe oder im Plan." : "Noch keine Einträge. Oben etwas eintippen und Enter drücken."}</div>`;
  return h + "</div>";
}

function ntRender() {
  if (view !== "notes") return;
  const ready = enBanner("nt");
  $("ntProject").innerHTML = projectOptions(Number(ntProject) || null, { all: true });
  document.querySelectorAll("#ntMode [data-ntm]").forEach(b => b.classList.toggle("on", b.dataset.ntm === ntMode));
  const body = $("ntBody");
  if (!ready) { body.innerHTML = '<div class="zt-empty">Noch nicht eingerichtet.</div>'; agHideDetail("ntMain"); return; }
  const keep = $("ntQuick")?.value || "", focus = document.activeElement?.id === "ntQuick", scroll = body.scrollTop;
  body.innerHTML = ntListHtml();
  if ($("ntQuick")) { $("ntQuick").value = keep; if (focus) $("ntQuick").focus(); }
  body.scrollTop = scroll;
  if (agSel && !agTask(agSel)) agSel = null;
  agMountDetail("ntMain");
  agRenderDetail();
  if (typeof agRunTick === "function") agRunTick();
}

function ntBind() {
  $("ntInstall").addEventListener("click", agInstall);
  $("ntProject").addEventListener("change", e => { ntProject = e.target.value; localStorage.setItem("lv-nt-project", ntProject); ntRender(); });
  $("ntMode").addEventListener("click", e => { const b = e.target.closest("[data-ntm]"); if (!b) return; ntMode = b.dataset.ntm; localStorage.setItem("lv-nt-mode", ntMode); ntRender(); });
  $("ntSearch").addEventListener("input", e => { ntQuery = e.target.value; ntRender(); });
  const body = $("ntBody");
  body.addEventListener("click", e => {
    const row = e.target.closest("[data-agid]");
    if (row) { const id = Number(row.dataset.agid); agSel = agSel === id ? null : id; ntRender(); }
  });
  body.addEventListener("keydown", e => {
    if (e.target.id === "ntQuick" && e.key === "Enter") { e.preventDefault(); ntAdd(); }
    if (e.target.id === "ntQuick" && e.key === "Escape") e.target.value = "";
  });
}

// ======================================================
// BAUZEITENPLAN (Gantt)
// ======================================================
const PL_SCALE = { week: { px: 30, label: "Woche" }, month: { px: 4.2, label: "Monat" }, quarter: { px: 1.6, label: "Quartal" } };
const PL_COLORS = ["#2f6fd0", "#e8692c", "#17a38a", "#e3a008", "#d9639f", "#7a5af8", "#4b8f3a", "#b5532d", "#3aa0c8", "#8d6e63"];
const PL_HEAD = 52;
const plRowH = () => window.matchMedia("(max-width: 640px)").matches ? 44 : 40;

function plColor(t) {
  if (t.lv) { const ids = [...db.lvs].sort((a, b) => a.id - b.id).map(l => l.id); return PL_COLORS[Math.max(0, ids.indexOf(t.lv)) % PL_COLORS.length]; }
  return "#1d6b73";
}
function plNameW() { return window.matchMedia("(max-width: 640px)").matches ? 136 : 300; }

// Zeilen in Gruppen: [{ type: "group", name, items }, …]
function plRows() {
  const pid = Number(plProject) || null;
  const inPlan = agdb.tasks.filter(t => agInPlan(t) && (!pid || t.project === pid));
  const dueTasks = plDue ? agdb.tasks.filter(t => !agInPlan(t) && agIsTask(t) && t.due && (!pid || t.project === pid) && agMine(t)) : [];
  const all = [...inPlan.map(t => ({ t, from: t.begin, to: t.end && t.end >= t.begin ? t.end : t.begin, ms: !t.end || t.end === t.begin, due: false })),
    ...dueTasks.map(t => { const from = t.created && t.created < t.due ? t.created : t.due; return { t, from, to: t.due, ms: false, due: true }; })];
  const key = r => (!pid && r.t.project ? (projNr(r.t.project) || projLabel(r.t.project)) + " · " : "") + (r.t.group || "");
  const groups = new Map();
  for (const r of all) { const k = key(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const out = [];
  [...groups.entries()]
    .map(([name, items]) => ({ name, items: items.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.t.id - b.t.id) }))
    .sort((a, b) => (!a.name.replace(/.* · $/, "") ? 1 : 0) - (!b.name.replace(/.* · $/, "") ? 1 : 0) || a.items[0].from.localeCompare(b.items[0].from))
    .forEach(g => out.push({ type: "group", name: g.name, items: g.items, from: g.items.reduce((m, r) => r.from < m ? r.from : m, "9999"), to: g.items.reduce((m, r) => r.to > m ? r.to : m, "0000") }, ...g.items.map(r => ({ type: "item", ...r }))));
  return out;
}

// sichtbarer Zeitraum, am Raster ausgerichtet
function plRange(rows, width) {
  const today = todayKey(), sc = PL_SCALE[plScale];
  let from = today, to = today;
  rows.forEach(r => { if (r.type === "item") { if (r.from < from) from = r.from; if (r.to > to) to = r.to; } });
  const mStart = k => k.slice(0, 8) + "01";
  const addMonths = (k, n) => { const d = keyDate(k.slice(0, 8) + "01"); d.setUTCMonth(d.getUTCMonth() + n); return dateKey(d); };
  if (plScale === "week") { from = addDays(weekStart(from), -7); to = addDays(weekStart(to), 13); }
  else if (plScale === "month") { from = addMonths(from, -1); to = addDays(addMonths(to, 2), -1); }
  else { const d = keyDate(from); const q = Math.floor(d.getUTCMonth() / 3) * 3; from = addMonths(`${d.getUTCFullYear()}-${String(q + 1).padStart(2, "0")}-01`, -3); to = addDays(addMonths(mStart(to), 4), -1); }
  // mindestens die Breite füllen
  const minDays = Math.ceil(width / sc.px);
  if (agDays(from, to) + 1 < minDays) to = addDays(from, minDays - 1);
  return { from, to, days: agDays(from, to) + 1 };
}

function plHeadHtml(rg, px) {
  const x = k => agDays(rg.from, k) * px;
  let top = "", bot = "", lines = "";
  const MONF = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const today = todayKey();
  if (plScale === "week") {
    for (let k = rg.from; k <= rg.to; k = addDays(k, 1)) {
      const d = keyDate(k), wd = d.getUTCDay();
      if (wd === 1) { top += `<span class="pl-ht" style="left:${x(k)}px;width:${7 * px}px">KW ${isoWeek(k)} · ${MONF[d.getUTCMonth()]} ${d.getUTCFullYear()}</span>`; lines += `<i class="pl-vl strong" style="left:${x(k)}px"></i>`; }
      bot += `<span class="pl-hb ${wd === 0 || wd === 6 ? "we" : ""} ${k === today ? "today" : ""}" style="left:${x(k)}px;width:${px}px">${d.getUTCDate()}</span>`;
      if (wd === 0 || wd === 6) lines += `<i class="pl-we" style="left:${x(k)}px;width:${px}px"></i>`;
    }
  } else {
    let k = rg.from.slice(0, 8) + "01";
    while (k <= rg.to) {
      const d = keyDate(k), m = d.getUTCMonth(), y = d.getUTCFullYear();
      const n = new Date(Date.UTC(y, m + 1, 1)), nk = dateKey(n);
      const l = Math.max(0, x(k)), w = x(nk) - l;
      if (plScale === "month") {
        bot += `<span class="pl-hb" style="left:${l}px;width:${w}px">${MONF[m]}${m === 0 || k <= rg.from ? " " + y : ""}</span>`;
        lines += `<i class="pl-vl ${m === 0 ? "strong" : ""}" style="left:${x(k)}px"></i>`;
        if (m === 0 || k <= rg.from) top += `<span class="pl-ht" style="left:${l}px">${y}</span>`;
      } else {
        if (m % 3 === 0 || k <= rg.from) {
          const qe = dateKey(new Date(Date.UTC(y, Math.floor(m / 3) * 3 + 3, 1)));
          bot += `<span class="pl-hb" style="left:${l}px;width:${x(qe) - l}px">Q${Math.floor(m / 3) + 1}</span>`;
          lines += `<i class="pl-vl strong" style="left:${x(k)}px"></i>`;
        } else lines += `<i class="pl-vl" style="left:${x(k)}px"></i>`;
        if (m === 0 || k <= rg.from) top += `<span class="pl-ht" style="left:${l}px">${y}</span>`;
      }
      k = nk;
    }
  }
  if (plScale !== "week" && today >= rg.from && today <= rg.to) bot += `<span class="pl-htoday" style="left:${x(today) + px / 2}px">heute</span>`;
  return { head: `<div class="pl-hscale" style="width:${rg.days * px}px">${top}${bot}</div>`, lines };
}

function plRender() {
  if (view !== "plan") return;
  const ready = enBanner("pl");
  $("plProject").innerHTML = projectOptions(Number(plProject) || null, { all: true });
  document.querySelectorAll("#plScale [data-pls]").forEach(b => b.classList.toggle("on", b.dataset.pls === plScale));
  $("plDue").checked = plDue;
  const body = $("plBody");
  if (!ready || !agPlanOn()) {
    body.innerHTML = `<div class="zt-empty">${ready ? "Für den Bauzeitenplan fehlen noch die neuen Spalten. Oben „Jetzt einrichten“ wählen." : "Noch nicht eingerichtet."}</div>`;
    agHideDetail("plMain"); return;
  }
  if (agSel && !agTask(agSel)) agSel = null;
  agMountDetail("plMain");
  agRenderDetail();       // zuerst, damit die Breite der Mitte stimmt
  const rows = plRows();
  const nameW = plNameW();
  const sx = body.scrollLeft, sy = body.scrollTop;
  if (!rows.length) {
    body.innerHTML = `<div class="zt-empty pl-empty">Noch nichts im Bauzeitenplan${plProject ? " für dieses Projekt" : ""}.<br>Oben „+ Eintrag“ wählen, oder bei einer Notiz oder Aufgabe rechts „Im Bauzeitenplan“.</div>`;
    return;
  }
  const px = PL_SCALE[plScale].px;
  const rg = plRange(rows, Math.max(300, body.clientWidth - nameW - 2));
  const x = k => agDays(rg.from, k) * px;
  const W = rg.days * px;
  const { head, lines } = plHeadHtml(rg, px);
  const today = todayKey();
  const yOf = new Map(), PL_ROW = plRowH();
  let html = "";
  rows.forEach((r, i) => {
    const y = i * PL_ROW;
    if (r.type === "group") {
      const l = x(r.from), w = Math.max(4, x(addDays(r.to, 1)) - l);
      html += `<div class="pl-row pl-grp"><div class="pl-name"><b>${esc(r.name.replace(/ · $/, "") || "Ohne Gruppe")}</b></div><div class="pl-track"><i class="pl-sum" style="left:${l}px;width:${w}px"></i></div></div>`;
      return;
    }
    const t = r.t; yOf.set(t.id, y);
    const sel = agSel === t.id;
    const cb = agIsTask(t) ? `<button type="button" class="ag-cb sm ${agDone(t) ? "on" : ""}" data-agdone="${t.id}" title="${agDone(t) ? "Wieder öffnen" : "Erledigt"}"></button>` : `<span class="pl-nocb"></span>`;
    const name = `<div class="pl-name">${cb}${r.ms ? '<span class="pl-dia sm"></span>' : ""}<span class="pl-tt" title="${esc(t.title)}">${esc(t.title) || "<i>Ohne Titel</i>"}</span>${t.lv ? `<span class="pl-lv">${esc(lvShort(t.lv))}</span>` : ""}</div>`;
    let bar;
    const l = x(r.from);
    if (r.ms) {
      bar = `<div class="pl-ms ${r.due ? "" : "mv"}" data-plid="${t.id}" style="left:${l + px / 2}px"><span class="pl-dia"></span><span class="pl-lab">${esc(t.title)} ${esc(agDM(r.from))}</span></div>`;
    } else {
      const w = Math.max(px, x(addDays(r.to, 1)) - l);
      const label = r.due ? `Aufgabe · ${agDM(r.from)}–${agDM(r.to)}` : t.title + (t.progress ? ` · ${t.progress} %` : "");
      const inside = !r.due && w > label.length * 6.6 + 18;
      bar = `<div class="pl-bar ${r.due ? "due" : "mv"} ${sel ? "sel" : ""} ${agDone(t) ? "done" : ""}" data-plid="${t.id}" style="left:${l}px;width:${w}px;--bc:${r.due ? "#1d6b73" : plColor(t)}" title="${esc(t.title)} · ${esc(fmtDE(r.from))}–${esc(fmtDE(r.to))}">
        ${t.progress && !r.due ? `<i class="pl-prog" style="width:${t.progress}%"></i>` : ""}
        ${inside ? `<span class="pl-in">${esc(label)}</span>` : ""}
        ${r.due ? "" : '<i class="pl-h l" data-plh="l"></i><i class="pl-h r" data-plh="r"></i>'}</div>
        ${inside ? "" : `<span class="pl-lab" style="left:${l + w + 6}px">${esc(label)}</span>`}`;
    }
    html += `<div class="pl-row ${sel ? "sel" : ""}" data-agid="${t.id}">${name}<div class="pl-track">${bar}</div></div>`;
  });
  // Abhängigkeiten als Pfeile
  let arrows = "";
  for (const r of rows) {
    if (r.type !== "item" || r.due) continue;
    for (const pid of r.t.after) {
      const p = agTask(pid); if (!p || !agInPlan(p) || !yOf.has(pid)) continue;
      const pe = p.end && p.end >= p.begin ? p.end : p.begin;
      const x1 = x(addDays(pe, 1)) - (p.end && p.end !== p.begin ? 0 : px / 2), y1 = yOf.get(pid) + PL_ROW / 2;
      const x2 = x(r.from) + (r.ms ? px / 2 : 0), y2 = yOf.get(r.t.id) + PL_ROW / 2;
      const bad = r.from <= pe;
      const mx = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 8));
      arrows += `<path class="${bad ? "bad" : ""}" d="M${x1},${y1} H${mx} V${y2} H${x2 - 2}"/>`;
    }
  }
  const H = rows.length * PL_ROW;
  body.innerHTML = `<div class="pl-grid" style="--nw:${nameW}px;width:${nameW + W}px">
    <div class="pl-row pl-head" style="height:${PL_HEAD}px"><div class="pl-name"><span class="muted">Eintrag</span></div><div class="pl-track">${head}</div></div>
    <div class="pl-rows">
      <div class="pl-bg" style="left:${nameW}px;width:${W}px;height:${H}px">${lines}${today >= rg.from && today <= rg.to ? `<i class="pl-today" style="left:${x(today) + px / 2}px"></i>` : ""}
        <svg class="pl-arrows" width="${W}" height="${H}"><defs><marker id="plArr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker></defs>${arrows}</svg></div>
      ${html}
    </div></div>`;
  if (plDrag == null && body.dataset.scrolled !== plScale + plProject) {
    // beim ersten Öffnen zu „heute“ (etwas links davon) scrollen
    body.dataset.scrolled = plScale + plProject;
    body.scrollLeft = Math.max(0, x(today) - (plScale === "week" ? 7 : 30) * px);
    body.scrollTop = 0;
  } else { body.scrollLeft = sx; body.scrollTop = sy; }
  if (agSel && yOf.has(agSel)) { /* Auswahl bleibt sichtbar */ }
}

// Neuer Eintrag direkt im Plan
async function plNew() {
  if (!agPlanOn()) return toast("Bitte zuerst die neuen Spalten mit „Jetzt einrichten“ anlegen.");
  const pid = Number(plProject) || null;
  const begin = agNextWorkday(todayKey());
  const last = agdb.tasks.filter(x => x.group && (!pid || x.project === pid)).sort((a, b) => b.id - a.id)[0];
  const t = { title: "Neuer Eintrag", project: pid, lv: null, status: "", due: null, time: "", high: false, person: ztPerson(), lp: null, tag: null,
    est: 0, steps: [], note: "", repeat: "", doneAt: null, created: todayKey(), begin, end: agAddWorkdays(begin, 4), group: last?.group || "", after: [], progress: 0 };
  const res = await apply([["AddRecord", AG.tasks, null, agFields(t)]], { refresh: false });
  await agFetch();
  agSel = newRowId(res) || agSel;
  plRender();
  setTimeout(() => { const el = $("agdTitle"); if (el) { el.focus(); el.select(); } }, 30);
}

// ---------- Ziehen: verschieben und Dauer ändern (Maus und Stift) ----------
function plPointerDown(e) {
  if (e.pointerType === "touch" || e.button !== 0) return;
  const bar = e.target.closest(".pl-bar.mv, .pl-ms.mv"); if (!bar) return;
  const t = agTask(Number(bar.dataset.plid)); if (!t) return;
  const h = e.target.closest("[data-plh]")?.dataset.plh || "m";
  plDrag = { t, bar, h, x0: e.clientX, dd: 0, on: false, l0: parseFloat(bar.style.left), w0: parseFloat(bar.style.width) || 0 };
  document.addEventListener("pointermove", plPointerMove);
  document.addEventListener("pointerup", plPointerUp, { once: true });
  e.preventDefault();
}
function plPointerMove(e) {
  const d = plDrag; if (!d) return;
  const px = PL_SCALE[plScale].px;
  if (!d.on && Math.abs(e.clientX - d.x0) < 4) return;
  d.on = true; document.body.classList.add("pl-dragging");
  d.dd = Math.round((e.clientX - d.x0) / px);
  const lab = d.bar.nextElementSibling?.classList.contains("pl-lab") ? d.bar.nextElementSibling : null;
  if (d.h === "m") { d.bar.style.transform = `translateX(${d.dd * px}px)`; if (lab) lab.style.transform = `translateX(${d.dd * px}px)`; }
  else if (d.h === "r") { d.bar.style.width = Math.max(px, d.w0 + d.dd * px) + "px"; }
  else { const w = Math.max(px, d.w0 - d.dd * px); d.bar.style.left = (d.l0 + d.w0 - w) + "px"; d.bar.style.width = w + "px"; }
  const t = d.t, b = t.begin, en = t.end || t.begin;
  const nb = d.h === "r" ? b : addDays(b, d.h === "l" ? Math.min(d.dd, agDays(b, en)) : d.dd);
  const ne = d.h === "l" ? en : addDays(en, d.h === "r" ? Math.max(d.dd, -agDays(b, en)) : d.dd);
  d.bar.title = `${fmtDE(nb)}–${fmtDE(ne)}`;
  plTip(e, d.h === "m" && (!t.end || t.end === t.begin) ? fmtDE(nb) : `${agDM(nb)}–${agDM(ne)} · ${agWorkdays(nb, ne)} AT`);
}
function plTip(e, text) {
  let tip = document.querySelector(".pl-tip");
  if (!tip) { tip = document.createElement("div"); tip.className = "pl-tip"; document.body.appendChild(tip); }
  tip.textContent = text; tip.style.left = e.clientX + 12 + "px"; tip.style.top = e.clientY + 14 + "px";
}
async function plPointerUp() {
  document.removeEventListener("pointermove", plPointerMove);
  document.querySelector(".pl-tip")?.remove();
  document.body.classList.remove("pl-dragging");
  const d = plDrag; plDrag = null;
  if (!d) return;
  if (!d.on || !d.dd) { if (d.on) plRender(); return; }
  plJustDragged = true; setTimeout(() => { plJustDragged = false; }, 0);
  const t = d.t, b = t.begin, en = t.end && t.end >= t.begin ? t.end : null;
  let begin = b, end = en;
  if (d.h === "m") { begin = addDays(b, d.dd); end = en ? addDays(en, d.dd) : null; }
  else if (d.h === "r") { end = addDays(en || b, Math.max(d.dd, -agDays(b, en || b))); }
  else { begin = addDays(b, Math.min(d.dd, agDays(b, en || b))); }
  if (end === begin && en) end = begin;   // auf einen Tag gezogen bleibt ein Balken mit 1 Tag
  await agSavePlan({ [t.id]: { begin, end } });
}

function plBind() {
  $("plInstall").addEventListener("click", agInstall);
  $("plProject").addEventListener("change", e => { plProject = e.target.value; localStorage.setItem("lv-pl-project", plProject); plRender(); });
  $("plScale").addEventListener("click", e => { const b = e.target.closest("[data-pls]"); if (!b) return; plScale = b.dataset.pls; localStorage.setItem("lv-pl-scale", plScale); plRender(); });
  $("plDue").addEventListener("change", e => { plDue = e.target.checked; localStorage.setItem("lv-pl-due", plDue ? "1" : ""); plRender(); });
  $("plNew").addEventListener("click", plNew);
  const body = $("plBody");
  body.addEventListener("pointerdown", plPointerDown);
  body.addEventListener("click", e => {
    if (plJustDragged) { plJustDragged = false; return; }
    const done = e.target.closest("[data-agdone]"); if (done) return agToggleDone(Number(done.dataset.agdone));
    const row = e.target.closest("[data-agid]");
    if (row) { const id = Number(row.dataset.agid); agSel = agSel === id && !e.target.closest(".pl-bar, .pl-ms") ? null : id; plRender(); }
  });
  let rz = null;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (view === "plan" && !plDrag) plRender(); }, 150); });
}

ntBind();
plBind();
