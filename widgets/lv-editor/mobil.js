// ======================================================
// Handy-Ansicht (ab v3.6) · gehört zu mobil.css
// Beschriftet die Leiste unten, öffnet Details als Vollbild
// und ergänzt „Zurück“-Knöpfe. Am Desktop ohne Wirkung.
// ======================================================
(function () {
  const mq = window.matchMedia("(max-width: 640px)");
  const isMobile = () => mq.matches;
  const app = document.getElementById("app");
  const q = s => document.querySelector(s);

  // Beschriftungen für die Leiste unten
  const labels = { projects: "Projekte", notes: "Notizen", plan: "Plan", time: "Zeit", tasks: "Aufgaben", edit: "Liste", mengen: "Mengen", texts: "Texte", document: "Dokument" };
  document.querySelectorAll(".rail [data-view]").forEach(b => { b.dataset.m = labels[b.dataset.view] || ""; });
  const setLbl = (id, t) => { const b = document.getElementById(id); if (b) b.dataset.m = t; };
  setLbl("lvMainButton", "LV"); setLbl("printMenuButton", "Drucken"); setLbl("settingsButton", "Mehr");

  // Zurück-Leiste bauen
  function backBar(label, onBack) {
    const d = document.createElement("div");
    d.className = "m-back";
    d.innerHTML = `<button type="button">‹ Zurück</button><span></span>`;
    d.querySelector("span").textContent = label;
    d.querySelector("button").addEventListener("click", onBack);
    return d;
  }

  // ---------- Seitenspalte (Position, Projekt, LV-Übersicht) als Vollbild ----------
  const ins = document.getElementById("inspector");
  const insBack = backBar("", async () => {
    app.classList.remove("m-sheet");
    if (!document.getElementById("posPanel").hidden && typeof closeInspector === "function") await closeInspector();
  });
  ins.prepend(insBack);
  function insLabel() {
    const pos = !document.getElementById("posPanel").hidden;
    insBack.querySelector("span").textContent = pos ? "Position " + (document.getElementById("inspectorOz").textContent || "")
      : (typeof view !== "undefined" && view === "projects") ? "Projekt" : "LV-Übersicht";
  }
  new MutationObserver(insLabel).observe(ins, { subtree: true, attributes: true, attributeFilter: ["hidden"] });

  // LV-Übersicht im Kopf (Summe, LV-Angaben, Titel)
  const addBtn = document.getElementById("addPositionButton");
  if (addBtn) {
    const sum = document.createElement("button");
    sum.type = "button"; sum.className = "btn btn-ghost m-sum"; sum.textContent = "Übersicht"; sum.title = "LV-Übersicht";
    sum.addEventListener("click", () => { app.classList.add("m-sheet"); insLabel(); });
    addBtn.before(sum);
  }

  // Projekt antippen öffnet die Details
  document.getElementById("projList")?.addEventListener("click", e => {
    if (!isMobile() || !e.target.closest(".pr[data-proj]")) return;
    setTimeout(() => { app.classList.add("m-sheet"); insLabel(); ins.querySelector(".ins-body").scrollTop = 0; }, 0);
  });

  // ---------- Texte: Liste, dann Editor ----------
  const texts = document.getElementById("textsView");
  const ted = document.getElementById("textEditor");
  ted.prepend(backBar("Texte", () => texts.classList.remove("m-ed")));
  document.getElementById("textSlots")?.addEventListener("click", e => {
    if (e.target.closest("[data-slot]")) texts.classList.add("m-ed");
  });
  document.addEventListener("click", e => {
    if (isMobile() && e.target.closest("[data-open-texts]")) setTimeout(() => { app.classList.remove("m-sheet"); texts.classList.add("m-ed"); }, 0);
  });

  // ---------- Eintrag (Notiz, Aufgabe, Plan): Zurück-Leiste in der Detailansicht ----------
  const agd = document.getElementById("agDetail");
  if (agd) {
    const names = { notes: "Notizen", tasks: "Aufgaben", plan: "Bauzeitenplan" };
    const ensure = () => {
      if (agd.hidden) return;
      const lbl = names[typeof view !== "undefined" ? view : "tasks"] || "Zurück";
      const old = agd.querySelector(":scope > .m-back");
      if (old) { if (old.querySelector("span").textContent !== lbl) old.querySelector("span").textContent = lbl; return; }
      agd.prepend(backBar(lbl, () => document.getElementById("agdClose")?.click()));
    };
    new MutationObserver(ensure).observe(agd, { childList: true, attributes: true, attributeFilter: ["hidden"] });
  }

  // ---------- Ansicht wechseln schließt Vollbild-Blätter ----------
  if (typeof window.setView === "function") {
    const orig = window.setView;
    window.setView = function (v) {
      app.classList.remove("m-sheet");
      texts.classList.remove("m-ed");
      return orig.apply(this, arguments);
    };
  }

  // Kalender: auf dem Handy zum heutigen Tag scrollen
  const ztBody = document.getElementById("ztBody");
  if (ztBody) new MutationObserver(() => {
    if (!isMobile()) return;
    const t = ztBody.querySelector(".zcal:not(.zcal-day) .ch.today");
    if (t && !ztBody.dataset.mToday) { ztBody.dataset.mToday = "1"; ztBody.scrollLeft = Math.max(0, t.offsetLeft - 40); }
    if (!t) delete ztBody.dataset.mToday;
  }).observe(ztBody, { childList: true });

  // Hinweise ohne Maus-Begriffe
  const fixHints = () => {
    if (!isMobile()) return;
    document.querySelectorAll("#projList .legend > span:last-child").forEach(el => {
      if (/Doppelklick/.test(el.textContent)) el.textContent = "Antippen öffnet die Projektdetails";
    });
  };
  new MutationObserver(fixHints).observe(document.getElementById("projList") || document.body, { childList: true });
})();
