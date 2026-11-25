// ======================================================
// Mock der Grist-Plugin-API für die lokale Vorschau (index.html?demo)
// ?demo=alt  -> Datenmodell ohne Untertitel-Spalte (zeigt den Schema-Hinweis)
// Daten liegen nur im Speicher und sind nach dem Neuladen zurückgesetzt.
// ======================================================
(function () {
  const mode = new URLSearchParams(location.search).get("demo");
  const legacy = mode === "alt";
  const empty = mode === "leer";

  const tables = {
    Projekte: [
      { id: 1, Projektnummer: "2501-MUS", Projektname: "Anbau Musterstraße 1", Bauherr: "Erika Musterfrau",
        Strasse: "Musterstraße 1", PLZ: "50667", Ort: "Köln", Architekt: "Planungsbüro Muster", Projektstatus: "Planung" },
      { id: 2, Projektnummer: "2601", Projektname: "Anbau M52", Bauherr: "Bauherr 01",
        Strasse: "Beispielallee 12", PLZ: "12345", Ort: "Köln", Architekt: "Planungsbüro Muster", Projektstatus: "Planung" }
    ],
    Leistungsverzeichnisse: [
      { id: 1, LV_Nummer: "02", LV_Bezeichnung: "Rohbauarbeiten", Projekt: 1, Gewerk: "Rohbau", Bearbeitungsstand: "Entwurf",
        Ausgabe_Datum: null, Abgabedatum: null, Vorbemerkung: "", Vergabeverfahren: "Freihändige Vergabe",
        Angebotsfrist: "", Submission: "", Zuschlagsfrist: "", Ort_Angebotsabgabe: "Planungsbüro Muster\nBeispielweg 2\n50667 Köln" },
      { id: 2, LV_Nummer: "01", LV_Bezeichnung: "Rohbauarbeiten", Projekt: 2, Gewerk: "Rohbau", Bearbeitungsstand: "", Vorbemerkung: "" }
    ],
    Titel: [],
    Positionen: []
  };

  // Beispiel-LV "02 Rohbauarbeiten" (aus dem PDF)
  const struct = [
    ["Baustelleneinrichtung", [["Baustelleneinrichtung", [
      ["Baustelleneinrichtung", "Baustelle mit allen erforderlichen zur ordnungsgemäßen und vollständigen Erbringung der Teilleistungen notwendigen Einrichtungen, Geräten und Werkzeugen einrichten und vorhalten.", 1, "psch", 4800]]]]],
    ["Abbruch- und Erdarbeiten", [
      ["Abbrucharbeiten", [
        ["Abbruch Kellertreppe", "Abbruch und Entsorgung der vorhandenen Kellertreppe", 1, "psch", 950],
        ["Vergrößern der Öffnung im EG", "Vergrößern des Durchgangs zwischen Bestand und Anbau im Erdgeschoss, inkl. notwendiger Abstützmaßnahmen, Abfuhr und Entsorgung", 1, "psch", 2400],
        ["Einbau neuer Unterzüge, EG", "Einbau neuer Unterzüge, gemäß Statik 2 x IPE240 in o.g. Öffnung zwischen Bestand und Anbau", 1, "psch", 1850]]],
      ["Erdarbeiten", [
        ["Erdaushub", "Erdaushub für die neue Bodenplatte, Fundamentaushub, Streifenfundament, Frostschürze, Aushub teils abfahren und entsorgen, teils seitlich lagern, gem. Abstimmung AG", 52.7, "m3", 48],
        ["Rohrgrabenaushub", "Rohrgrabenaushub, unterhalb der Bodenplatte, inkl. Sandeinbettung und Wiederverfüllen", 8.5, "lfm", 65]]],
      ["Kanalarbeiten", [
        ["Verlängerung des Regenwasserkanals", "Verlängerung des vorhandenen Regenwasserkanals zum Anschluss der neuen Fallrohre an das Kanalsystem, KG-Rohr DN 150 inklusive aller Formteile wie Bögen, Abzweiger etc.", 8.5, "lfm", 85]]]]],
    ["Betonarbeiten", [["Betonarbeiten", [
      ["Sauberkeitsschicht", "Falls erforderlich: Sauberkeitsschicht Beton C12/15, Dicke bis 5 cm, alternativ Noppenbahn", 1, "psch", 650, "Eventualposition"],
      ["Streifenfundament herstellen", "Unbewehrtes Streifenfundament gemäß Statik C25/30, b/h 60/80 herstellen", 10.8, "m", 145],
      ["Bodenplatte herstellen", "Bodenplatte C25/30, Beton, Stahlbeton, Dicke 18-25cm, inkl. Randschalung", 15.83, "m2", 120],
      ["Kellerwände herstellen", "Kellerwände aus Stahlbeton gem. Angaben Statik herstellen, d=20cm", 24.448, "m2", 185],
      ["Geschossdecke über KG herstellen", "Geschossdecke über KG herstellen, Deckenschalung inkl. C25/30, Höhe bis 22cm, inkl. deckengleichen Stürzen gemäß Angaben Statik", 15.83, "m2", 165]]]]],
    ["Mauerarbeiten", [["Maurerarbeiten", [
      ["Mauerwerkswände Erdgeschoss", "Aussenwände Erdgeschoss, Mauerwerk Porenbeton-Planstein PP 2, DM - roh 0.35, gem. Angaben Statik", 10.3, "m2", 135]]]]],
    ["Abdichtungs- und Dämmarbeiten", [["Dämmarbeiten", [
      ["Abdichtung der Betonaußenwände im KG", "Abdichtung der Betonkellerwände (Bitumenbahn G 200 DD oder Botament RD2 o. glw.) gemäß Angabe Statik, bis ca. 30cm über GOK", 13.6, "m2", 42],
      ["Trennlage", "Trennlage, PE-Folie", 15.83, "m2", 3.5],
      ["Dämmung unter Bodenplatte, XPS", "Dämmung unter Bodenplatte und entlang der Frostschürze (innen und aussen), XPS druckfest, Styrodur 3035 CS o.glw. 14cm stark", 30.228, "m2", 38]]]]]
  ];

  let tid = 0, pid = 0;
  struct.forEach(([name, subs], i) => {
    const top = { id: ++tid, Titelnummer: String(i + 1).padStart(2, "0"), Titelbezeichnung: name, Leistungsverzeichnis: 1,
      Sortierung: i + 1, Vorbemerkung: "", Aktiv: true, Uebergeordnet: 0 };
    tables.Titel.push(top);
    subs.forEach(([sname, positions], j) => {
      const sub = { id: ++tid, Titelnummer: String(j + 1).padStart(2, "0"), Titelbezeichnung: sname, Leistungsverzeichnis: 1,
        Sortierung: j + 1, Vorbemerkung: "", Aktiv: true, Uebergeordnet: top.id };
      tables.Titel.push(sub);
      positions.forEach(([kt, lt, m, me, ep, typ], k) => {
        tables.Positionen.push({ id: ++pid, Titel: sub.id,
          Positionsnummer: `${top.Titelnummer}.${sub.Titelnummer}.${String((k + 1) * 10).padStart(4, "0")}`,
          Sortierung: k + 1, Kurztext: kt, Langtext: lt, Menge: m, Einheit: me, Einheitspreis: ep,
          Positionstyp: typ || "Normal", Aktiv: true, LV: 1 });
      });
    });
  });
  // altes LV aus der Grist-Datei
  [["Baustelleneinrichtung", [["Baustelle einrichten", 1, "psch", 1250], ["Oberboden abtragen", 66, "m2", 18.5]]],
   ["Erdarbeiten", [["Baugrube herstellen", 80, "m3", 22]]]].forEach(([name, ps], i) => {
    const t = { id: ++tid, Titelnummer: "0" + (i + 1), Titelbezeichnung: name, Leistungsverzeichnis: 2, Sortierung: i + 1, Vorbemerkung: "", Aktiv: true, Uebergeordnet: 0 };
    tables.Titel.push(t);
    ps.forEach(([kt, m, me, ep], k) => tables.Positionen.push({ id: ++pid, Titel: t.id, Positionsnummer: `${t.Titelnummer}.${String((k + 1) * 10).padStart(4, "0")}`,
      Sortierung: k + 1, Kurztext: kt, Langtext: "", Menge: m, Einheit: me, Einheitspreis: ep, Positionstyp: "Normal", Aktiv: true, LV: 2 }));
  });

  if (legacy) {
    tables.Titel.forEach(t => delete t.Uebergeordnet);
    tables.Positionen.forEach(p => delete p.LV);
    tables.Leistungsverzeichnisse.forEach(l => ["Vergabeverfahren", "Angebotsfrist", "Submission", "Zuschlagsfrist", "Ort_Angebotsabgabe"].forEach(c => delete l[c]));
  }

  const missing = new Set(empty ? ["Projekte", "Leistungsverzeichnisse", "Titel", "Positionen"] : []);
  if (empty) for (const t of missing) tables[t] = [];

  const columns = { Projekte: new Set(), Leistungsverzeichnisse: new Set(), Titel: new Set(), Positionen: new Set() };
  for (const [t, rows] of Object.entries(tables)) rows.forEach(r => Object.keys(r).forEach(k => k !== "id" && columns[t].add(k)));
  if (!empty) columns.Positionen.add("Gesamtpreis");

  function toColumnar(t) {
    const rows = tables[t];
    const out = { id: rows.map(r => r.id) };
    for (const c of columns[t]) {
      out[c] = rows.map(r => c === "Gesamtpreis" && !empty ? Math.round(r.Menge * r.Einheitspreis * 100) / 100 : (r[c] ?? (c === "Uebergeordnet" ? 0 : null)));
    }
    return out;
  }

  let options = { planer: "Planungsbüro Muster", anschrift: "Beispielweg 2\n50667 Köln",
    kontakt: "Dipl.-Ing. Max Mustermann\nTel. 0221 000000", mwst: 19, step: 10 };
  const listeners = { options: [] };

  window.grist = {
    ready() {},
    onRecords() {},
    on() {},
    onOptions(cb) { listeners.options.push(cb); setTimeout(() => cb(options), 0); },
    widgetApi: { async setOptions(o) { options = { ...o }; } },
    docApi: {
      async fetchTable(t) {
        if (t.startsWith("_grist")) throw new Error("not in mock");
        if (missing.has(t)) throw new Error("Table not found: " + t);
        return JSON.parse(JSON.stringify(toColumnar(t)));
      },
      async applyUserActions(actions) {
        const ret = [];
        let next = id => Math.max(0, ...tables[id].map(r => r.id)) + 1;
        for (const [type, t, ...a] of actions) {
          if (type === "AddRecord") {
            const id = next(t);
            tables[t].push({ id, ...a[1] });
            Object.keys(a[1]).forEach(k => columns[t].add(k));
            ret.push(id);
          } else if (type === "UpdateRecord") {
            Object.assign(tables[t].find(r => r.id === a[0]), a[1]);
            ret.push(null);
          } else if (type === "RemoveRecord") {
            tables[t] = tables[t].filter(r => r.id !== a[0]);
            ret.push(null);
          } else if (type === "BulkRemoveRecord") {
            tables[t] = tables[t].filter(r => !a[0].includes(r.id));
            ret.push(null);
          } else if (type === "AddTable") {
            missing.delete(t);
            tables[t] = [];
            a[0].forEach(c => columns[t].add(c.id));
            ret.push(null);
          } else if (type === "AddColumn") {
            columns[t].add(a[0]);
            ret.push(null);
          } else if (type === "ModifyColumn") {
            ret.push(null);
          } else throw new Error("Mock: unbekannte Aktion " + type);
        }
        await new Promise(r => setTimeout(r, 60));
        return { actionNum: 1, retValues: ret };
      }
    }
  };
})();
