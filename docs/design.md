# Design-Leitlinien

## v2.1: Layout „Kompakt“ (aktuell)
- Schmale Icon-Leiste links (Liste, Dokument, Drucken, Neu laden, Einstellungen)
- Kopfzeile: LV · Projekt als unauffällige Auswahl, Status-Punkt, Suchfeld (⌘K), „+ Position“
- Das ganze LV als eine durchgehende Liste: Titel als Gruppenköpfe mit Summe und Kostenbalken, Positionen als Zeilen
- Rechts der Inspector: bei gewählter Position das Formular ohne Rahmen, sonst eine Übersicht über Titel und LV (Summen, Anteile, MwSt., Brutto)
- Titel-Aktionen (↑↓, ✎, + UT, + Pos) erscheinen beim Überfahren

## v2.0
- **Drei Spalten wie bei moderner Bürosoftware:** links die Gliederung (Baum), in der Mitte die Positionen, rechts der Inspector zum Bearbeiten. Er erscheint nur, wenn eine Position gewählt ist.
- **Kopfleiste statt Auswahlkasten:** Projekt › LV als „Breadcrumb“, dazu der Status als Pill und die LV-Summe immer sichtbar.
- **Ruhige Flächen:** weiße Karten auf hellgrauem Grund, dünne Linien, wenig Schatten.
- **Akzentfarbe Grist-Grün** (`#16a37a`), damit das Widget zu Grist passt. Sie ist in `style.css` unter `--accent-solid` zentral änderbar.
- **Dark Mode:** Die Farben übernehmen die Grist-Theme-Variablen (`--grist-theme-*`).
- **Monospace für die OZ**, damit die Nummern bündig untereinander stehen. Zahlen sind tabellarisch und rechtsbündig.
- **Farbige Badges** für Eventual-, Bedarfs- und Alternativpositionen, durchgestrichen für inaktive.
- **Weniger Klicks:** automatisches Speichern, Tastaturkürzel, Aktionen erscheinen beim Überfahren (Sortieren, Bearbeiten).
- **Druck im Stil klassischer AVA-Ausdrucke:** Deckblatt mit Bieterfeldern, Kopfzeile auf jeder Seite, Seitenzahl x/y, Summen je Ebene, Zusammenstellung.

## Ideen für später
- Gliederung per Drag & Drop
- Kompakt- und Komfortansicht (Zeilenhöhe) umschaltbar
- Kleines Balkendiagramm der Kosten je Titel über der Tabelle
- Befehlspalette (Strg/Cmd+K): „Neue Position“, „Gehe zu 03.01“, „Drucken“
- Firmenlogo im Druck (als Bild-URL in den Einstellungen)


## v2.2 – Reiter „Texte“ und Aktiv-Punkt

- Vor- und Nachbemerkungen (LV und je Titel) stehen nicht mehr in der Positionsliste oder in Dialogen, sondern im eigenen Reiter **T „Texte“** (linke Leiste, über „Dokument“). Jeder Text hat einen Schalter „Im LV anzeigen“; ausgeschaltete Texte bleiben gespeichert, erscheinen aber nicht im Druck.
- Reihenfolge im Druck: Deckblatt → Inhaltsverzeichnis → LV-Vorbemerkung → Titel (Titel-Vorbemerkung unter der Überschrift, Titel-Nachbemerkung vor der Titelsumme) → Zusammenstellung → LV-Nachbemerkung.
- Grüner Punkt vor der OZ = Position aktiv, grau = inaktiv. Klick schaltet um.

## v2.3 – Druckausgabe

- Der Druck teilt die Seiten selbst auf (Paged.js, liegt unter `widgets/lv-editor/vendor/`). Dadurch sehen Fußzeile, Kopfzeile und Seitenumbrüche in Chrome, Safari und Firefox gleich aus.
- Fußzeile auf jeder Seite außer dem Deckblatt: Projekt · LV links, Druckdatum Mitte, „Seite X von Y“ rechts.
- Schlussseite: nur noch eine „Zusammenstellung“ (Untertitel eingerückt, Titel fett), darunter Summenblock netto / MwSt. / brutto, LV-Nachbemerkung und bei der Ausschreibung die Unterschriftszeile.

## v2.4 – Bedienung

- Kopfleiste passt sich der Breite an: Auf schmalen Bildschirmen (z. B. MacBook 13") schrumpft die Suche zur Lupe und klappt beim Anklicken auf. Projektname und Status werden bei sehr wenig Platz ausgeblendet.
- Positionen lassen sich mit der Maus ziehen: zwischen andere Positionen, auf eine Titelzeile (ans Ende dieses Titels) oder auf „+ Position in …“. Titel lassen sich innerhalb derselben Ebene ziehen. Die OZ werden danach neu vergeben (bei gesperrtem LV bekommt nur die verschobene Position eine freie OZ).
- „+ Neu“ legt wahlweise ein LV im aktuellen Projekt oder ein neues Projekt an. Beim neuen Projekt ist „Gleich ein LV anlegen“ abwählbar.

## v2.5 / v2.6 – Projekte, Export, Vorlagen, Kostenschätzung

- **Projekte** (oberstes Symbol links): Kennzahlen, Filter nach Projektstatus, Liste mit LVs nach Bearbeitungsstand, Netto-Summe und nächstem Termin (aus Angebotsfrist, Submission, Zuschlagsfrist der LVs). Rechts Details, LV-Liste, Kostenverteilung, Termine. Doppelklick öffnet das Projekt.
- **Export** (Druckmenü): Excel/Calc (.xlsx) mit Formeln, Excel/Calc für Bieter (ohne EP, GB rechnet beim Eintragen mit), CSV (Semikolon, Dezimalkomma).
- **Vorlagen** beim Anlegen eines LV oder in einem leeren LV: Kostenschätzung nach DIN 276 (KG 100–800, 2. Ebene als Positionen), Flächen nach DIN 277 (NUF 1–7, TF 8, VF 9, KGF, BRI).
- **Druck „Kostenschätzung“**: kompaktes Layout ohne Langtexte, Kopf mit Projektdaten, Verteilung als Balken, Summenkasten, Grundlagen (LV-Vorbemerkung) und Hinweise (LV-Nachbemerkung). Ganz abgeschaltete Gruppen werden weggelassen.

## v2.7 – Druckstil Modern, Auf-/Zuklappen

- Im Druckmenü oben „Druckstil: Klassisch | Modern“ (wird gespeichert). Modern = gleiche Inhalte wie das klassische LV (Deckblatt, Inhaltsverzeichnis, Vorbemerkungen, Positionen mit Langtext, Zusammenstellung, Unterschrift), gestaltet wie die Kostenschätzung: Linien statt Kästen, einzeiliger Seitenkopf, unten links „Seite X von Y · Druck“, unten rechts das Logo aus den Einstellungen. Satzspiegel 20 mm links/rechts.
- Titel werden mit großen +/− Schaltflächen auf- und zugeklappt.

## v3.0 – Aufgaben, gekoppelt an die Zeiterfassung

- Neuer Bereich „Aufgaben“ (Häkchen-Symbol, Dateien `aufgaben.js`, `aufgaben.css`), ruhige Gestaltung: Liste nach Fälligkeit gruppiert, Board nach Status, Details in einer eigenen rechten Spalte.
- Schnelleingabe mit Kürzeln (#Projekt, @Person, heute/morgen/Wochentag/Datum, Uhrzeit, !).
- Variante A: Timer direkt an der Aufgabe. Beim Start entsteht ein normaler Zeiteintrag mit Projekt, LP, Tätigkeit und Titel als Notiz, verknüpft über `Zeiteintraege.Aufgabe`. Gebuchte Stunden und Schätzung je Aufgabe.
- Variante C: Aufgaben-Vorschläge im Feld „Was wurde gemacht?“ der Zeiterfassung, Häkchen „Aufgabe damit erledigt“, Hinweis „Erledigt, aber ohne Zeit“. Im Eintrags-Dialog lässt sich die Aufgabe nachträglich zuordnen.
- Wiederkehrende Aufgaben legen beim Erledigen die nächste an. Variante B („Mein Tag“ mit Tageskalender) ist vorbereitet und kann darauf aufbauen.

## v2.9 – Mengen und Variablen

- Neuer Bereich „Mengen & Variablen“ (Lineal-Symbol, Dateien `mengen.js`, `mengen.css`). Variablen je Projekt mit Name, Formel/Wert, Ergebnis, Einheit, Notiz und „verwendet in“; darunter alle Positionen mit berechneter Menge und ihr Status.
- Eigener kleiner Rechenkern (kein `eval`): + − × / : ( ), Komma als Dezimalzeichen, `x` als Malzeichen, Variablen per Name oder `[Name]`, Erkennung von Ringbezügen und unbekannten Namen.
- Variante A: `=` im Mengenfeld startet eine Formel, Vorschläge beim Tippen. Variante B: Mengenansatz mit beschrifteten Rechenzeilen, Minuszeilen, Weiterrechnen mit `×` am Zeilenanfang.
- `Menge` bleibt eine normale Zahl (Druck, Export, Summen unverändert). Die Formel steht in `Mengenformel` bzw. `Mengenansatz`.
- Nachrechnen nach jeder Variablen-Änderung; gesperrte LVs (Ausschreibung/Beauftragt) werden ausgelassen. Umbenennen zieht alle Formeln nach.
- Druck „Mengenermittlung“ im Stil der Stundenliste, mit Liste der verwendeten Variablen.
- Variante C (Raumbuch) ist vorbereitet: Räume würden Variablen automatisch erzeugen.

## v2.8 – Zeiterfassung

- Neuer Bereich über das Uhr-Symbol in der Leiste (Dateien `zeit.js`, `zeit.css`). Volle Breite, ohne Seitenleiste.
- Reiter **Liste · Kalender · Auswertung**. Woche blättern mit ‹ ›, „Heute“ springt zurück.
- Eintrag: Projekt, Datum, von–bis oder Dauer, Leistungsphase 1–9 (HOAI), Tags (mehrere), Notiz, Person.
- Liste: Eingabezeile mit Enter, Tage absteigend mit Tagessumme. Kalender: Woche 7–20 Uhr (erweitert sich), Aufziehen/Verschieben/Dauer ziehen in 15-Minuten-Schritten, Einträge ohne Uhrzeit oben im Tageskopf.
- Timer: genau ein laufender Eintrag (`Laeuft`), Stoppen trägt Ende und Dauer ein.
- Auswertung: Kennzahlen, gestapelte Balken je Tag/Woche/Monat nach Projekt mit Soll-Linie, Stunden je LP, je Tag (anteilig bei mehreren Tags), Matrix Projekt × LP. Projektfarben aus fester Palette, Farbe hängt am Projekt.
- Stundenliste PDF nach Vorlage des Büros (Variante A): Projekt, Projekt-Nr., Zeitraum, Tabelle Datum/von/bis/Dauer/LP/Beschreibung, Summe; unten links Seite X von Y und Erstelldatum, unten rechts Logo; Schrift „Family“ (falls installiert); Tabellenkopf auf jeder Seite.
- Excel-Export der gefilterten Einträge mit Summenformel.
- Name der Person nur lokal (localStorage), Soll-Stunden in den Widget-Optionen.
