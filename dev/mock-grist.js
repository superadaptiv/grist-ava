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
        Strasse: "Musterstraße 1", PLZ: "50667", Ort: "Köln", Architekt: "Planungsbüro Muster", Projektstatus: "Ausschreibung" },
      { id: 2, Projektnummer: "2601", Projektname: "Anbau M52", Bauherr: "Bauherr 01",
        Strasse: "Beispielallee 12", PLZ: "12345", Ort: "Köln", Architekt: "Planungsbüro Muster", Projektstatus: "Planung" },
      { id: 3, Projektnummer: "2605", Projektname: "Garage Birkenallee", Bauherr: "Familie Muster",
        Strasse: "Birkenallee 3", PLZ: "12345", Ort: "Musterstadt", Architekt: "Planungsbüro Muster", Projektstatus: "Planung" }
    ],
    Leistungsverzeichnisse: [
      { id: 1, LV_Nummer: "02", LV_Bezeichnung: "Rohbauarbeiten", Projekt: 1, Gewerk: "Rohbau", Bearbeitungsstand: "Entwurf",
        Ausgabe_Datum: null, Abgabedatum: null, Vorbemerkung: "Die Baustelle ist über die Musterstraße anfahrbar. Lagerflächen stehen nur im Vorgarten zur Verfügung (ca. 20 m²).\nAlle Leistungen sind nach VOB/C und den anerkannten Regeln der Technik auszuführen. Abrechnung nach Aufmaß, sofern nicht anders angegeben.\nDer Bestand ist während der Arbeiten bewohnt; lärmintensive Arbeiten nur werktags 8–18 Uhr.", Nachbemerkung: "Mit Abgabe des Angebots bestätigt der Bieter, die Baustelle besichtigt zu haben.", Vorbemerkung_ausblenden: false, Nachbemerkung_ausblenden: true, Vergabeverfahren: "Freihändige Vergabe",
        Angebotsfrist: "", Submission: "", Zuschlagsfrist: "", Ort_Angebotsabgabe: "Planungsbüro Muster\nBeispielweg 2\n50667 Köln" },
      { id: 2, LV_Nummer: "01", LV_Bezeichnung: "Rohbauarbeiten", Projekt: 2, Gewerk: "Rohbau", Bearbeitungsstand: "", Vorbemerkung: "" },
      { id: 3, LV_Nummer: "03", LV_Bezeichnung: "Zimmererarbeiten", Projekt: 1, Gewerk: "Zimmerer", Bearbeitungsstand: "Ausschreibung", Vorbemerkung: "",
        Submission: new Date(Date.now() + 9 * 864e5).toLocaleDateString("de-DE") + ", 10:00 Uhr", Zuschlagsfrist: new Date(Date.now() + 40 * 864e5).toLocaleDateString("de-DE") }
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
  const notes = {
    "Abbruch- und Erdarbeiten": ["Abbruchmaterial ist vom AN zu entsorgen, Entsorgungsnachweise sind vorzulegen. Bodenklasse nach Baugrundgutachten vom 12.01.2026.", "Mehr- oder Mindermengen beim Aushub werden nach Aufmaß abgerechnet."]
  };
  struct.forEach(([name, subs], i) => {
    const top = { id: ++tid, Titelnummer: String(i + 1).padStart(2, "0"), Titelbezeichnung: name, Leistungsverzeichnis: 1,
      Sortierung: i + 1, Vorbemerkung: notes[name]?.[0] || "", Nachbemerkung: notes[name]?.[1] || "", Vorbemerkung_ausblenden: false, Nachbemerkung_ausblenden: false, Aktiv: true, Uebergeordnet: 0 };
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
    tables.Titel.forEach(t => { delete t.Uebergeordnet; delete t.Nachbemerkung; delete t.Vorbemerkung_ausblenden; delete t.Nachbemerkung_ausblenden; });
    tables.Positionen.forEach(p => delete p.LV);
    tables.Leistungsverzeichnisse.forEach(l => ["Vergabeverfahren", "Angebotsfrist", "Submission", "Zuschlagsfrist", "Ort_Angebotsabgabe", "Nachbemerkung", "Vorbemerkung_ausblenden", "Nachbemerkung_ausblenden"].forEach(c => delete l[c]));
  }

  // Mengen & Variablen (ab 2.9): Variablen für Projekt 1 und berechnete Mengen im LV 02
  tables.Variablen = [
    { id: 1, Projekt: 1, Name: "Breite", Formel: "4,30", Wert: 4.3, Einheit: "m", Notiz: "Anbau außen", Sortierung: 1 },
    { id: 2, Projekt: 1, Name: "Tiefe", Formel: "3,68", Wert: 3.68, Einheit: "m", Notiz: "Anbau außen", Sortierung: 2 },
    { id: 3, Projekt: 1, Name: "Grundfläche", Formel: "Breite × Tiefe", Wert: 15.824, Einheit: "m²", Notiz: "", Sortierung: 3 },
    { id: 4, Projekt: 1, Name: "Fundament_Länge", Formel: "2 × Tiefe + Breite", Wert: 11.66, Einheit: "m", Notiz: "ohne Anschluss an Bestand", Sortierung: 4 },
    { id: 5, Projekt: 1, Name: "Kellerhöhe", Formel: "2,40", Wert: 2.4, Einheit: "m", Notiz: "lichte Höhe", Sortierung: 5 }
  ];
  const calc = {
    "Streifenfundament herstellen": { Mengenformel: "Fundament_Länge", Menge: 11.66 },
    "Bodenplatte herstellen": { Mengenformel: "Grundfläche", Menge: 15.824 },
    "Geschossdecke über KG herstellen": { Mengenformel: "Grundfläche", Menge: 15.824 },
    "Trennlage": { Mengenformel: "Grundfläche", Menge: 15.824 },
    "Mauerwerkswände Erdgeschoss": { Mengenformel: "(4,30 + 3,68) × 2,75 − 2 × 1,26 × 1,385", Menge: 18.455 },
    "Kellerwände herstellen": { Menge: 26.484, Mengenansatz: JSON.stringify([
      { t: "Seitenwände Achse 1 + 2", f: "2 × Tiefe" }, { t: "", f: "× Kellerhöhe" },
      { t: "Stirnwand Achse A", f: "Breite × Kellerhöhe" }, { t: "abzgl. Kellerfenster", f: "−2 × 1,00 × 0,75" }]) },
    "Dämmung unter Bodenplatte, XPS": { Menge: 29.816, Mengenansatz: JSON.stringify([
      { t: "unter Bodenplatte", f: "Grundfläche" }, { t: "Frostschürze innen + außen", f: "2 × Fundament_Länge × 0,60" }]) }
  };
  tables.Positionen.forEach(p => {
    Object.assign(p, { Mengenformel: "", Mengenansatz: "" });
    if (p.LV === 1 && calc[p.Kurztext]) Object.assign(p, calc[p.Kurztext]);
  });
  if (mode === "ohnemengen") tables.Positionen.forEach(p => { delete p.Mengenformel; delete p.Mengenansatz; });

  // Zeiterfassung: Demo-Einträge der laufenden und der Vorwoche (relativ zu heute)
  tables.Tags = [
    { id: 1, Name: "Entwurf", Farbe: "#7c5cdb", Beschreibung: "Planung, Varianten, Details", Aktiv: true },
    { id: 2, Name: "Ausschreibung", Farbe: "#e07b00", Beschreibung: "LV, Vergabe", Aktiv: true },
    { id: 3, Name: "Bauüberwachung", Farbe: "#0e7490", Beschreibung: "Baustelle, Abnahme", Aktiv: true }
  ];
  tables.Zeiteintraege = [];
  {
    const now = new Date(), dow = (now.getDay() + 6) % 7;
    const day = off => Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - dow + off) / 1000;
    const E = [
      [-7, "09:00", "12:30", 1, 3, [1], "Grundrisse überarbeitet"], [-7, "13:30", "16:00", 3, 2, [1], "Variante Satteldach"],
      [-6, "08:30", "12:00", 1, 5, [1], "Werkplanung Anschluss Bestand"], [-5, "09:00", "11:00", 2, 6, [2], "LV Rohbau Mengen"],
      [-4, "10:00", "11:30", 2, 8, [3], "Baustellentermin"], [-3, "13:00", "17:00", 1, 6, [2], "LV Zimmerer"],
      [0, "08:30", "12:00", 1, 3, [1], "Grundrisse EG/OG überarbeitet"], [0, "13:00", "15:30", 2, 6, [2], "LV Rohbau: Mengen ermittelt"],
      [0, "15:30", "17:00", 3, 2, [1], "Variante Pultdach"], [1, "08:00", "10:00", 2, 8, [3], "Baustellentermin Bodenplatte"],
      [1, "10:30", "12:30", 1, 6, [2], "LV 03 Zimmerer: Vorbemerkungen"], [1, "13:30", "17:30", 1, 6, [2], "Positionen Dachstuhl"],
      [2, "09:00", "11:00", 3, 2, [1], "Abstimmung mit Bauherr"], [2, "11:00", "12:00", 2, 8, [3], "Mängelliste Rohbau"],
      [2, "13:00", "16:00", 1, 5, [1, 2], "Details Anschluss Bestand"], [3, "08:00", "09:00", 1, 7, [2], "LV 03 an Bieter versendet"],
      [3, "", "", 3, 4, [], "Telefonate Bauamt", 0.75]
    ];
    E.filter(e => e[0] <= dow).forEach(([o, a, b, pr, lp, tg, nt, dur], i) => {
      const [h1, m1] = a ? a.split(":").map(Number) : [0, 0], [h2, m2] = b ? b.split(":").map(Number) : [0, 0];
      tables.Zeiteintraege.push({ id: i + 1, Projekt: pr, Datum: day(o), Start: a, Ende: b, Dauer_h: dur ?? ((h2 * 60 + m2 - h1 * 60 - m1) / 60),
        LPH: lp, Tags: ["L", ...tg], Notiz: nt, Person: "", Laeuft: false });
    });
  }

  // Aufgaben (ab 3.0): Demo-Aufgaben relativ zu heute, einige mit gebuchter Zeit
  {
    const now = new Date();
    const d = off => Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + off) / 1000;
    const dow = (now.getDay() + 6) % 7;
    const S = (...a) => JSON.stringify(a.map(([t, x]) => ({ t, d: !!x })));
    tables.Aufgaben = [
      { id: 1, Titel: "Preisanfrage Fenster an 3 Firmen", Projekt: 1, LV: 0, Status: "in Arbeit", Faellig: d(-3), Uhrzeit: "", Prioritaet: true, Person: "", LPH: 6, Taetigkeit: 2, Schaetzung_h: 4, Teilschritte: S(["LV als PDF drucken", 1], ["Firmen aus Adressliste wählen"], ["E-Mail mit Excel-Rücklauf senden"]), Notiz: "Bauherr wünscht Holz-Alu. Bindefrist mind. 6 Wochen.", Wiederholung: "", Erledigt_am: null, Erstellt: d(-8) },
      { id: 2, Titel: "Prüfstatiker Unterlagen nachreichen", Projekt: 2, LV: 0, Status: "warten", Faellig: d(-2), Uhrzeit: "", Prioritaet: false, Person: "Markus", LPH: 4, Taetigkeit: 0, Schaetzung_h: 0, Teilschritte: "", Notiz: "", Wiederholung: "", Erledigt_am: null, Erstellt: d(-10) },
      { id: 3, Titel: "Submission LV 03 vorbereiten", Projekt: 1, LV: 3, Status: "offen", Faellig: d(0), Uhrzeit: "", Prioritaet: true, Person: "", LPH: 7, Taetigkeit: 2, Schaetzung_h: 2, Teilschritte: "", Notiz: "", Wiederholung: "", Erledigt_am: null, Erstellt: d(-4) },
      { id: 4, Titel: "Stunden der Woche kontrollieren", Projekt: 0, LV: 0, Status: "offen", Faellig: d(4 - dow >= 0 ? 4 - dow : 11 - dow), Uhrzeit: "", Prioritaet: false, Person: "", LPH: 0, Taetigkeit: 0, Schaetzung_h: 0, Teilschritte: "", Notiz: "", Wiederholung: "wöchentlich", Erledigt_am: null, Erstellt: d(-20) },
      { id: 5, Titel: "Rückruf Bauherr wegen Bemusterung Fliesen", Projekt: 1, LV: 0, Status: "offen", Faellig: d(0), Uhrzeit: "16:00", Prioritaet: false, Person: "Sabine", LPH: 0, Taetigkeit: 0, Schaetzung_h: 0, Teilschritte: "", Notiz: "", Wiederholung: "", Erledigt_am: null, Erstellt: d(-1) },
      { id: 6, Titel: "Mengen Kellerwände nach Planänderung prüfen", Projekt: 1, LV: 1, Status: "offen", Faellig: d(2), Uhrzeit: "", Prioritaet: false, Person: "", LPH: 6, Taetigkeit: 2, Schaetzung_h: 1, Teilschritte: "", Notiz: "Kellerhöhe von 2,40 auf 2,55 m geändert.", Wiederholung: "", Erledigt_am: null, Erstellt: d(-1) },
      { id: 7, Titel: "Vergabevorschlag Rohbau an Bauherr", Projekt: 1, LV: 1, Status: "offen", Faellig: d(12), Uhrzeit: "", Prioritaet: false, Person: "", LPH: 7, Taetigkeit: 2, Schaetzung_h: 0, Teilschritte: "", Notiz: "", Wiederholung: "", Erledigt_am: null, Erstellt: d(-1) },
      { id: 8, Titel: "Variante Pultdach mit Bauherr abstimmen", Projekt: 3, LV: 0, Status: "offen", Faellig: null, Uhrzeit: "", Prioritaet: false, Person: "", LPH: 2, Taetigkeit: 1, Schaetzung_h: 0, Teilschritte: "", Notiz: "", Wiederholung: "", Erledigt_am: null, Erstellt: d(-6) },
      { id: 9, Titel: "LV 03 Zimmerer an Bieter versenden", Projekt: 1, LV: 3, Status: "erledigt", Faellig: d(-1), Uhrzeit: "", Prioritaet: false, Person: "", LPH: 7, Taetigkeit: 2, Schaetzung_h: 0, Teilschritte: "", Notiz: "", Wiederholung: "", Erledigt_am: d(-Math.min(dow, 1)), Erstellt: d(-9) },
      { id: 10, Titel: "Bauantrag Unterschriften einholen", Projekt: 2, LV: 0, Status: "erledigt", Faellig: d(-1), Uhrzeit: "", Prioritaet: false, Person: "", LPH: 4, Taetigkeit: 0, Schaetzung_h: 0, Teilschritte: "", Notiz: "", Wiederholung: "", Erledigt_am: d(0), Erstellt: d(-9) }
    ];
    // Zeiteinträge mit Aufgaben verknüpfen (falls in dieser Woche vorhanden)
    tables.Zeiteintraege.forEach(e => {
      e.Aufgabe = /LV 03 an Bieter/.test(e.Notiz) ? 9 : /Positionen Dachstuhl|LV Zimmerer/.test(e.Notiz) ? 3 : 0;
    });
    tables.Zeiteintraege.push({ id: 100, Projekt: 1, Datum: d(-1), Start: "14:00", Ende: "15:30", Dauer_h: 1.5, LPH: 6, Tags: ["L", 2], Notiz: "Preisanfrage Fenster: Firmen recherchiert", Person: "", Laeuft: false, Aufgabe: 1 });
  }
  if (mode === "ohneaufgaben") tables.Zeiteintraege.forEach(e => delete e.Aufgabe);

  const missing = new Set(empty ? ["Projekte", "Leistungsverzeichnisse", "Titel", "Positionen", "Zeiteintraege", "Tags"] : mode === "ohnezeit" ? ["Zeiteintraege", "Tags"] : mode === "ohnemengen" ? ["Variablen"] : mode === "ohneaufgaben" ? ["Aufgaben"] : []);
  if (empty) for (const t of [...missing, "Variablen", "Aufgaben"]) { tables[t] = []; missing.add(t); }
  if (mode === "ohnezeit") { tables.Aufgaben = []; missing.add("Aufgaben"); }

  const columns = { Projekte: new Set(), Leistungsverzeichnisse: new Set(), Titel: new Set(), Positionen: new Set(), Zeiteintraege: new Set(), Tags: new Set(), Variablen: new Set(), Aufgaben: new Set() };
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
            columns[t] = columns[t] || new Set();
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
