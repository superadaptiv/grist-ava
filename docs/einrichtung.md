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
| Titel umbenennen oder löschen | ✎ beim Überfahren oder Doppelklick auf den Titel |
| Vor- und Nachbemerkungen (LV und Titel) schreiben, ein-/ausschalten | Reiter **T „Texte“** in der linken Leiste |
| Position aktiv/inaktiv | grüner bzw. grauer Punkt vor der OZ anklicken |
| Reihenfolge | ▲▼ beim Überfahren (Titel), ↑↓ in der Tabelle (Positionen) |
| Position anlegen | Untertitel markieren → **+ Position** (oder Strg/Cmd+Enter). Sie wird hinter der markierten eingefügt. |
| Bearbeiten | Position anklicken → rechts im Inspector. Gespeichert wird automatisch. |
| Eventual- und Bedarfspositionen | im Inspector unter **Positionsart**. Sie erscheinen mit „Nur Einh.-Pr.“ ohne Summe. |
| Ansicht als Dokument | oben **Dokument** |
| Drucken / PDF | **Drucken ▾ → Ausschreibung** (ohne Preise, Bieterfelder) oder **Kostenanschlag**. Im Druckfenster „Als PDF speichern“ wählen. |
| OZ einfrieren | Bearbeitungsstand des LV auf **Ausschreibung** setzen (in der Tabelle Leistungsverzeichnisse) |

Deckblatt-Felder (Vergabeverfahren, Angebotsfrist, Submission, Zuschlagsfrist, Ort der Angebotsabgabe) und den LV-Status pflegst du in der Tabelle **Leistungsverzeichnisse**. Dafür ist der nächste Schritt praktisch.

## Schritt 8 (empfohlen): Seite „Projekte & LVs“ in Grist
1. **Neu hinzufügen → Neue Seite hinzufügen → Tabelle**, Daten: **Projekte**, dann **Seite hinzufügen**.
2. Auf dieser Seite **Neu hinzufügen → Widget zur Seite hinzufügen → Tabelle**, Daten: **Leistungsverzeichnisse**, **Auswählen per: PROJEKTE**.
3. Optional noch ein Widget **Karte** mit Daten **Leistungsverzeichnisse** und **Auswählen per: LEISTUNGSVERZEICHNISSE**, um die Deckblatt-Felder bequem auszufüllen.

So siehst du links die Projekte und rechts die LVs des gewählten Projekts.

## Schritt 9: Kurz prüfen
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

## Anhang B: Wenn etwas nicht klappt
| Problem | Lösung |
|---|---|
| „Die Grist-Daten konnten nicht geladen werden“ | Die Zugriffsebene des Widgets steht nicht auf **Vollständiger Dokumentenzugriff** (Schritt 3.5). |
| Das Widget bleibt weiß | Die URL prüfen und direkt im Browser öffnen. Mit `?demo` am Ende muss die Demo erscheinen. |
| Drucken öffnet nichts | Pop-ups für die Grist-Seite erlauben. |
| Keine Seitenzahlen im PDF | Chrome oder Edge verwenden (ab Version 131). |
| Nach einem Update erscheint ein gelber Hinweis | Eine neue Version braucht neue Spalten: auf **Jetzt anlegen** klicken. |
| Falsche Zahl statt Name in Referenzspalten | siehe Schritt 9 |

## Anhang C: Das bisherige Dokument „LV GPT 0.21.3“ weiterverwenden
Das geht auch: Im alten Dokument beim Widget „LV DRUCK“ die URL auf den neuen LV-Editor umstellen (Schritt 3.4–3.5) und dann auf **Jetzt anlegen** klicken. Dabei kommen 7 fehlende Spalten dazu.
Beim ersten Ändern nummeriert das Widget die alten Positionen ins neue Schema um, also aus `01.01` wird `01.0010`. Vorher am besten eine Kopie des Dokuments anlegen.
