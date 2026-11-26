# Anleitung: AVA-System in Grist einrichten (ab leerem Dokument)

Dauer: etwa 10 Minuten. Du brauchst:
- dein self-hosted Grist,
- die **Widget-URL**, z. B. `https://<dein-name>.github.io/grist-ava/widgets/lv-editor/`. Wie du sie bekommst, steht im README unter Abschnitt 1 und 2.
- Chrome, Edge oder Firefox. Für den Druck mit Seitenzahlen „x/y“ ist Chrome oder Edge am besten.

> Kurzfassung: leeres Dokument anlegen → Widget auf „Benutzerdefiniert“ umstellen und URL eintragen → „Einrichten“ klicken. Die Tabellen legt das Widget selbst an.

---

## Schritt 1: Leeres Dokument anlegen
1. Auf der Grist-Startseite **Neu hinzufügen → Leeres Dokument** wählen.
2. Das Dokument oben links umbenennen, z. B. **„AVA“**.

Grist legt automatisch eine Seite **Table1** mit einer leeren Tabelle an. Die brauchen wir gleich als „Träger“ für das Widget.

## Schritt 2: Hilfstabelle umbenennen
Ein Custom Widget in Grist hängt immer an irgendeiner Tabelle. Der LV-Editor liest seine Daten selbst und braucht diese Tabelle nicht, sie bleibt einfach leer.

1. Links unten unter **Rohdaten** die Tabelle **Table1** suchen.
2. Auf den Namen klicken und in **`LV_Ansicht`** umbenennen.

Optional: In der Tabelle die Spalten A, B, C löschen. Nötig ist das nicht.

## Schritt 3: Seite in den LV-Editor verwandeln
1. Links die Seite **Table1** öffnen (sie heißt jetzt vielleicht schon „LV_Ansicht“).
2. Oben rechts am Widget auf **⋮ → Widget ändern** klicken.
3. Als Widget **Benutzerdefiniert** (Custom) wählen, Daten: **LV_Ansicht**, dann **Speichern**.
4. In der rechten Leiste unter **WIDGET** die Option **Benutzerdefinierte URL** (Custom URL) wählen und die Widget-URL einfügen.
5. Unter **ZUGRIFFSEBENE** den Wert **Vollständiger Dokumentenzugriff** einstellen und bestätigen.
   Ohne diesen Zugriff kann das Widget keine Tabellen lesen oder anlegen.
6. Die Seite links per Doppelklick in **„LV-Editor“** umbenennen.
7. Tipp: Den Widget-Titel ausblenden oder kurz halten und die Seite über das Seitenmenü auf volle Breite ziehen.

## Schritt 4: Tabellen anlegen lassen
Das Widget meldet sich mit einem gelben Hinweis **„Ersteinrichtung“**.

1. Auf **Einrichten** klicken und die Rückfrage bestätigen.
2. Das Widget legt jetzt an:
   - **Projekte**
   - **Leistungsverzeichnisse** (verknüpft mit Projekte)
   - **Titel** (verknüpft mit LV, mit Untertiteln über „Übergeordnet“)
   - **Positionen** (verknüpft mit Titel, mit Formeln für Gesamtpreis und LV)

   Dazu kommen die passenden Auswahllisten (Einheit, Positionsart, Bearbeitungsstand, Gewerk) und Euro-Formate.
3. Kontrolle: Unter **Rohdaten** stehen jetzt diese vier Tabellen. Neue Seiten erscheinen dafür nicht, die legst du bei Bedarf in Schritt 7 an.

Wie alle Grist-Aktionen lässt sich das mit **Strg/Cmd+Z** rückgängig machen.

## Schritt 5: Erstes Projekt und LV anlegen
Direkt nach dem Einrichten öffnet sich der Dialog **„Neues Leistungsverzeichnis“**.
1. Projektnummer, Projektname, Bauherr und Adresse eintragen.
2. LV-Nummer (z. B. `02`), Gewerk und LV-Bezeichnung (z. B. „Rohbauarbeiten“) eintragen und auf **Anlegen** klicken.
3. Danach fragt das Widget nach dem ersten **Titel**, z. B. „Baustelleneinrichtung“.

Weitere LVs oder Projekte legst du jederzeit über **+ LV** oben neben der LV-Auswahl an.

## Schritt 6: Büro-Angaben für den Druck
Oben rechts auf **⚙ Einstellungen** klicken:
- **Büro / Planer**, **Anschrift**, **Ansprechpartner, Telefon, E-Mail**: erscheinen im Planer-Block auf dem Deckblatt
- **MwSt.-Satz** (Standard 19 %)
- **Schrittweite Positionen** (Standard 10, also 0010, 0020 …)

Die Angaben werden in den Optionen des Widgets gespeichert und gelten für dieses Dokument.

## Schritt 7: Arbeiten mit dem LV-Editor
| Aufgabe | So geht's |
|---|---|
| Titel anlegen | **+ Titel** unten links |
| Untertitel (01.01) | Titel markieren → **+ Untertitel** |
| Position oder Titel verschieben | mit der Maus ziehen (Position auch auf eine andere Titelzeile) |
| Titel umbenennen oder löschen | ✎ beim Überfahren oder Doppelklick auf den Titel |
| Vor- und Nachbemerkungen (LV und Titel) schreiben, ein-/ausschalten | Reiter **T „Texte“** in der linken Leiste |
| Position aktiv/inaktiv | grüner bzw. grauer Punkt vor der OZ anklicken |
| Reihenfolge | ▲▼ beim Überfahren (Titel), ↑↓ in der Tabelle (Positionen) |
| Position anlegen | Untertitel markieren → **+ Position** (oder Strg/Cmd+Enter). Sie wird hinter der markierten eingefügt. |
| Bearbeiten | Position anklicken → rechts im Inspector. Gespeichert wird automatisch. |
| Eventual- und Bedarfspositionen | im Inspector unter **Positionsart**. Sie erscheinen mit „Nur Einh.-Pr.“ ohne Summe. |
| Ansicht als Dokument | oben **Dokument** |
| Drucken / PDF | **Drucken ▾ → Ausschreibung** (ohne Preise, Bieterfelder) oder **Kostenvoranschlag**. Im Druckfenster „Als PDF speichern“ wählen. |
| OZ einfrieren | Bearbeitungsstand des LV auf **Ausschreibung** setzen (in der Tabelle Leistungsverzeichnisse) |

Deckblatt-Felder (Vergabeverfahren, Angebotsfrist, Submission, Zuschlagsfrist, Ort der Angebotsabgabe) und den LV-Status pflegst du in der Tabelle **Leistungsverzeichnisse**. Dafür ist der nächste Schritt praktisch.

## Schritt 8 (empfohlen): Seite „Projekte & LVs“ in Grist
1. **Neu hinzufügen → Neue Seite hinzufügen → Tabelle**, Daten: **Projekte**, dann **Seite hinzufügen**.
2. Auf dieser Seite **Neu hinzufügen → Widget zur Seite hinzufügen → Tabelle**, Daten: **Leistungsverzeichnisse**, **Auswählen per: PROJEKTE**.
3. Optional noch ein Widget **Karte** mit Daten **Leistungsverzeichnisse** und **Auswählen per: LEISTUNGSVERZEICHNISSE**, um die Deckblatt-Felder bequem auszufüllen.

So siehst du links die Projekte und rechts die LVs des gewählten Projekts.

## Schritt 9 (neu in 2.8): Zeiterfassung einrichten
1. Im Widget links auf das **Uhr-Symbol** klicken.
2. Oben erscheint „Zeiterfassung einrichten“ → **Jetzt einrichten**. Das Widget legt die Tabellen **Zeiteintraege** und **Tags** an, dazu drei Beispiel-Tags (Entwurf, Ausschreibung, Bauüberwachung).
3. Rechts oben über das Regler-Symbol: **deinen Namen** eintragen (wird nur auf diesem Gerät gespeichert) und die **Soll-Stunden pro Woche** (Standard 40).
4. Deine eigene Tag-Liste kannst du später in Grist direkt in die Tabelle **Tags** kopieren (Spalten *Name*, *Farbe* als #RRGGBB, *Beschreibung*, *Aktiv*). Das Widget liest sie automatisch.

So wird gearbeitet:
- **Liste:** oben Projekt, LP, Tags, Notiz, Datum und Zeit eintragen, **Enter** speichert. Zeit als `13–14:30` oder als Dauer `1,5h`. Projekt, LP und Tags bleiben für den nächsten Eintrag stehen. Klick auf eine Zeile öffnet sie zum Bearbeiten oder Löschen.
- **Kalender:** Zeit mit der Maus aufziehen = neuer Eintrag. Block ziehen = verschieben (auch auf einen anderen Tag), Unterkante ziehen = Dauer ändern. Klick = bearbeiten.
- **Timer:** „▶ Timer mit diesen Angaben starten“ unter der Eingabezeile. Oben rechts läuft die Uhr, ■ stoppt und trägt die Zeit ein.
- **Auswertung:** Woche, Monat, Quartal, Jahr oder frei; Filter nach Projekt, Person und Tätigkeit. Daraus **Stundenliste PDF** (mit Logo unten rechts) und **Export Excel**.

## Schritt 10 (neu in 2.9): Mengen und Variablen
1. Im Widget links auf das **Lineal-Symbol** (Mengen & Variablen) klicken.
2. Oben erscheint „Mengen & Variablen einrichten“ → **Jetzt einrichten**. Das Widget legt die Tabelle **Variablen** an und in **Positionen** die Spalten **Mengenformel** und **Mengenansatz**.
3. Mit **+ Variable** Werte für das Projekt anlegen, z. B. `Breite` = `4,30`, `Tiefe` = `3,68`, `Grundfläche` = `Breite × Tiefe`. Variablen gelten für alle LVs des Projekts.

So wird gearbeitet:
- **Formel im Mengenfeld:** In einer Position ins Feld *Menge* ein `=` tippen, dann rechnen: `=4,20 + 3,85 + 2 × 2,40` oder `=Grundfläche`. Erlaubt sind + − × / ( ) und Kommazahlen; `x` oder `*` gehen auch als Malzeichen. Beim Tippen schlägt das Widget passende Variablen vor (↑↓ und Enter). Die Menge wird ausgerechnet und als Zahl gespeichert.
- **Mengenansatz (Rechenzeilen):** Unter der Menge auf **≡ Mengenansatz** klicken. Jede Zeile hat eine Bezeichnung und einen Ansatz, die Summe wird die Menge. Abzüge mit Minus (`−2 × 0,885 × 2,01`). Beginnt ein Ansatz mit `×` oder `/`, rechnet er mit der Zeile darüber weiter (z. B. Wandlänge, darunter `× Raumhöhe`). **Enter** legt eine neue Zeile an.
- **Lösen:** macht aus der berechneten Menge wieder eine feste Zahl.
- **→ Variable:** speichert die Formel einer Position als neue Variable und verwendet sie dort.
- **Nachrechnen:** Ändert sich eine Variable, werden alle Mengen des Projekts sofort angepasst. Ausnahme: LVs mit Status *Ausschreibung* oder *Beauftragt* werden nicht automatisch geändert. Dort zeigt die Position einen Hinweis, und man übernimmt das neue Ergebnis bewusst.
- **Umbenennen:** Wird eine Variable umbenannt, passt das Widget alle Formeln mit an.
- In der Liste steht vor jeder berechneten Menge ein kleines **ƒ** (orange = Menge weicht vom Ergebnis ab, rot = Fehler in der Formel).
- **Drucken ▾ → Mengenermittlung** druckt alle Formeln und Rechenzeilen des LV mit den verwendeten Variablen, als Anlage zum LV.
- Wer in Grist direkt eine Zahl in *Menge* einträgt, bekommt im Widget den Hinweis „weicht ab“, mit der Wahl *Ergebnis übernehmen* oder *Formel lösen*.

## Schritt 11 (neu in 3.0): Aufgaben
1. Im Widget links auf das **Häkchen-Symbol** (Aufgaben) klicken.
2. Oben erscheint „Aufgaben einrichten“ → **Jetzt einrichten**. Das Widget legt die Tabelle **Aufgaben** an und in **Zeiteintraege** die Spalte **Aufgabe**. Ist die Zeiterfassung noch nicht eingerichtet, wird sie gleich mit angelegt.

So wird gearbeitet:
- **Schnelleingabe:** oben einfach tippen und **Enter**. Kürzel im Text werden erkannt: `#2501` (Projekt), `@Markus` (zuständig), `heute`, `morgen`, `Fr`, `12.12.`, `nächste Woche`, `16:00` (Uhrzeit) und `!` (wichtig). Unter dem Feld steht, was erkannt wurde.
- **Liste:** gruppiert nach Überfällig, Heute, Diese Woche, Später und Ohne Datum. Kreis anklicken = erledigt. Ein roter Kreis heißt „wichtig“. Erledigte Aufgaben sind unten eingeklappt.
- **Board:** Spalten Offen, In Arbeit, Warten auf andere, Erledigt. Karten mit der Maus zwischen den Spalten verschieben.
- **Details rechts:** Klick auf eine Aufgabe. Dort Projekt, LV, Status, Fälligkeit, Zuständig, Wiederholung, Leistungsphase, Tätigkeit, Schätzung, Teilschritte und Notiz. Änderungen werden sofort gespeichert.
- **Wiederholen:** täglich, wöchentlich oder monatlich. Beim Erledigen entsteht automatisch die nächste Aufgabe.
- **Zeit an der Aufgabe:** ▶ an der Aufgabe startet den Timer. Projekt, Leistungsphase, Tätigkeit und Titel werden in die Zeiterfassung übernommen. In den Details stehen die gebuchten Stunden, ein Balken gegen die Schätzung und die einzelnen Einträge. **+ Zeit nachtragen** öffnet einen Eintrag, der schon mit der Aufgabe verknüpft ist.
- **Aufgaben in der Zeiterfassung:** Im Feld „Was wurde gemacht?“ erscheinen beim Tippen die offenen Aufgaben des Projekts (↑↓ und Enter). Mit dem Häkchen **Aufgabe damit erledigt** wird die Aufgabe beim Eintragen gleich abgeschlossen. Verknüpfte Einträge haben in der Liste ein ☑.
- **Erledigt, aber ohne Zeit:** Über der Wochenliste stehen Aufgaben, die diese Woche erledigt wurden, aber keine Zeit haben. Ein Klick übernimmt sie in die Eingabezeile.
- **Meine:** Ist in der Zeiterfassung dein Name eingetragen, zeigt der Schalter „Meine“ nur Aufgaben, die dir oder niemandem zugewiesen sind.

## Schritt 12: Kurz prüfen
- In **Rohdaten → Positionen** sollte die Spalte **Titel** den Titelnamen zeigen und keine Zahl.
  Falls doch eine Zahl erscheint: Spalte anklicken → rechts **Spalte anzeigen** → *Titelbezeichnung* wählen.
  Dasselbe gilt für `Leistungsverzeichnisse.Projekt` (→ Projektname), `Titel.Leistungsverzeichnis` (→ LV_Bezeichnung), `Titel.Uebergeordnet` (→ Titelbezeichnung) und `Positionen.LV` (→ LV_Bezeichnung).
- Eigene Einheiten (z. B. „m²“ statt „m2“): Spalte **Positionen.Einheit** → rechts **Auswahlmöglichkeiten** bearbeiten. Das Widget übernimmt die Liste.

---

## Anhang A: Datenmodell zum Nachbauen oder Prüfen

Wer die Tabellen von Hand anlegen will, muss die Spalten-IDs **genau so** schreiben. Die IDs sind entscheidend, die Beschriftungen nicht.

**Projekte**
| Spalten-ID | Typ |
|---|---|
| Projektnummer | Text |
| Projektname | Text |
| Bauherr | Text |
| Strasse | Text |
| PLZ | Text |
| Ort | Text |
| Architekt | Text |
| Projektstatus | Auswahl: Planung, Ausschreibung, Ausführung, Abgeschlossen |

**Leistungsverzeichnisse**
| Spalten-ID | Typ |
|---|---|
| LV_Nummer | Text |
| LV_Bezeichnung | Text |
| Projekt | Referenz → Projekte (anzeigen: Projektname) |
| Gewerk | Auswahl |
| Bearbeitungsstand | Auswahl: Entwurf, Prüfung, Ausschreibung, Beauftragt |
| Ausgabe_Datum | Datum |
| Abgabedatum | Datum |
| Vorbemerkung | Text |
| Nachbemerkung | Text |
| Vorbemerkung_ausblenden | Toggle (Bool) |
| Nachbemerkung_ausblenden | Toggle (Bool) |
| Vergabeverfahren | Text |
| Angebotsfrist | Text |
| Submission | Text |
| Zuschlagsfrist | Text |
| Ort_Angebotsabgabe | Text |

**Titel**
| Spalten-ID | Typ |
|---|---|
| Titelnummer | Text (nur die eigene Stufe, z. B. „02“) |
| Titelbezeichnung | Text |
| Leistungsverzeichnis | Referenz → Leistungsverzeichnisse |
| Uebergeordnet | Referenz → Titel (leer = Haupttitel) |
| Sortierung | Numerisch |
| Vorbemerkung | Text |
| Nachbemerkung | Text |
| Vorbemerkung_ausblenden | Toggle (Bool) |
| Nachbemerkung_ausblenden | Toggle (Bool) |

**Positionen**
| Spalten-ID | Typ |
|---|---|
| Titel | Referenz → Titel |
| Positionsnummer | Text (volle OZ, z. B. „01.02.0010“) |
| Sortierung | Numerisch |
| Kurztext | Text |
| Langtext | Text (Zeilenumbruch an) |
| Menge | Numerisch (3 Nachkommastellen) |
| Einheit | Auswahl: m, m2, m3, Stk., psch, lfm, kg, t, h, Wo |
| Einheitspreis | Numerisch, Währung EUR |
| Gesamtpreis | **Formel:** `ROUND($Menge * $Einheitspreis, 2)` |
| Positionstyp | Auswahl: Normal, Bedarfsposition, Eventualposition, Alternativposition |
| Aktiv | Umschalter (Bool) |
| LV | **Formel:** `$Titel.Leistungsverzeichnis` (Typ Referenz → Leistungsverzeichnisse) |
| Mengenformel | Text (ab 2.9, z. B. `Grundfläche × 2`, ohne „=“) |
| Mengenansatz | Text (ab 2.9, Rechenzeilen als JSON, vom Widget gepflegt) |

**Variablen** (Mengen, ab 2.9)
| Spalten-ID | Typ |
|---|---|
| Projekt | Referenz → Projekte (Spalte anzeigen: Projektname) |
| Name | Text (Buchstaben, Ziffern, _) |
| Formel | Text (Zahl oder Formel, z. B. `Breite × Tiefe`) |
| Wert | Numerisch (vom Widget berechnet) |
| Einheit | Text |
| Notiz | Text |
| Sortierung | Numerisch |

**Tags** (Zeiterfassung)
| Spalten-ID | Typ |
|---|---|
| Name | Text |
| Farbe | Text (z. B. #7c5cdb) |
| Beschreibung | Text |
| Aktiv | Toggle |

**Zeiteintraege** (Zeiterfassung)
| Spalten-ID | Typ |
|---|---|
| Projekt | Referenz → Projekte (Spalte anzeigen: Projektname) |
| Datum | Datum |
| Start | Text (hh:mm, leer bei reiner Dauer) |
| Ende | Text (hh:mm) |
| Dauer_h | Numerisch (Stunden, z. B. 1,5) |
| LPH | Ganzzahl (Leistungsphase 1–9) |
| Tags | Referenzliste → Tags (Spalte anzeigen: Name) |
| Notiz | Text |
| Person | Text |
| Laeuft | Toggle (Timer läuft) |
| Aufgabe | Referenz → Aufgaben (ab 3.0, Spalte anzeigen: Titel) |

**Aufgaben** (ab 3.0)
| Spalten-ID | Typ |
|---|---|
| Titel | Text |
| Projekt | Referenz → Projekte (Spalte anzeigen: Projektname) |
| LV | Referenz → Leistungsverzeichnisse (Spalte anzeigen: LV_Bezeichnung) |
| Status | Auswahl: offen, in Arbeit, warten, erledigt |
| Faellig | Datum |
| Uhrzeit | Text (hh:mm) |
| Prioritaet | Toggle (wichtig) |
| Person | Text (zuständig) |
| LPH | Ganzzahl (Leistungsphase 1–9) |
| Taetigkeit | Referenz → Tags (Spalte anzeigen: Name) |
| Schaetzung_h | Numerisch (Stunden) |
| Teilschritte | Text (JSON, vom Widget gepflegt) |
| Notiz | Text |
| Wiederholung | Auswahl: täglich, wöchentlich, monatlich |
| Erledigt_am | Datum |
| Erstellt | Datum |

## Anhang B: Wenn etwas nicht klappt
| Problem | Lösung |
|---|---|
| „Die Grist-Daten konnten nicht geladen werden“ | Die Zugriffsebene des Widgets steht nicht auf **Vollständiger Dokumentenzugriff** (Schritt 3.5). |
| Das Widget bleibt weiß | Die URL prüfen und direkt im Browser öffnen. Mit `?demo` am Ende muss die Demo erscheinen. |
| Drucken öffnet nichts | Pop-ups für die Grist-Seite erlauben. |
| Keine Seitenzahlen im PDF | Chrome oder Edge verwenden (ab Version 131). |
| Nach einem Update erscheint ein gelber Hinweis | Eine neue Version braucht neue Spalten: auf **Jetzt anlegen** klicken. |
| Falsche Zahl statt Name in Referenzspalten | siehe Schritt 12 |

## Anhang C: Das bisherige Dokument „LV GPT 0.21.3“ weiterverwenden
Das geht auch: Im alten Dokument beim Widget „LV DRUCK“ die URL auf den neuen LV-Editor umstellen (Schritt 3.4–3.5) und dann auf **Jetzt anlegen** klicken. Dabei kommen 7 fehlende Spalten dazu.
Beim ersten Ändern nummeriert das Widget die alten Positionen ins neue Schema um, also aus `01.01` wird `01.0010`. Vorher am besten eine Kopie des Dokuments anlegen.
