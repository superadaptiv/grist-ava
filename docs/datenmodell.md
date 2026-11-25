# Datenmodell

## Heute (LV-Editor v2)

```
Projekte ─< Leistungsverzeichnisse ─< Titel ─< Positionen
                                       └─< Titel (Untertitel, über "Uebergeordnet")
```

| Tabelle | Wichtige Spalten |
|---|---|
| **Projekte** | Projektnummer, Projektname, Bauherr, Strasse, PLZ, Ort, Architekt, Projektstatus |
| **Leistungsverzeichnisse** | LV_Nummer, LV_Bezeichnung, Projekt → Projekte, Gewerk, Bearbeitungsstand, Vorbemerkung, *neu:* Nachbemerkung, Vorbemerkung_ausblenden, Nachbemerkung_ausblenden, Vergabeverfahren, Angebotsfrist, Submission, Zuschlagsfrist, Ort_Angebotsabgabe |
| **Titel** | Titelnummer („01“, nur die eigene Stufe), Titelbezeichnung, Leistungsverzeichnis, Sortierung, Vorbemerkung, *neu:* Uebergeordnet → Titel, Nachbemerkung, Vorbemerkung_ausblenden, Nachbemerkung_ausblenden |
| **Positionen** | Titel, Positionsnummer (volle OZ „01.02.0010“), Sortierung, Kurztext, Langtext, Menge, Einheit, Einheitspreis (= Kostenansatz), Gesamtpreis (`ROUND($Menge * $Einheitspreis, 2)`), Positionstyp, Aktiv, *neu:* LV (Formel `$Titel.Leistungsverzeichnis`) |

**OZ-Regel:** Titel `01`, Untertitel `01.02`, Position `01.02.0010` (Schrittweite 10, in den Einstellungen änderbar).
Die OZ wird gespeichert und nicht als Formel berechnet. So bleibt sie nach dem Versand stabil, auch wenn sich später die Reihenfolge ändert.

## Nächste Ausbaustufen (Vorschlag)

### Stammdaten
| Tabelle | Zweck |
|---|---|
| **Firmen** | Bieter und Auftragnehmer: Name, Anschrift, Ansprechpartner, Gewerke, E-Mail |
| **Einheiten** | Einheitenliste statt Choice-Spalte (Kürzel, Bezeichnung, GAEB-Kürzel) |
| **Musterpositionen** | Positionsbibliothek: Kurztext, Langtext, Einheit, Richtpreis, Gewerk, Stichworte |

### Vergabe
| Tabelle | Spalten |
|---|---|
| **Angebote** | LV, Firma, Eingangsdatum, Nachlass %, Skonto % / Tage, Status (angefragt, abgegeben, gewertet, Zuschlag, Absage), Summe (Formel) |
| **Angebotspreise** | Angebot, Position, EP, GB (Formel), Bemerkung. Ein Datensatz pro Angebot und Position |
| **Aufträge** | Angebot (Zuschlag), Auftragsdatum, Auftragssumme, Einbehalt %, Zahlungsbedingungen |

### Abrechnung
| Tabelle | Spalten |
|---|---|
| **Nachträge** | Auftrag, NT-Nr., Bezeichnung, Grund, Status (angemeldet, angeboten, geprüft, beauftragt, abgelehnt), Summe |
| **Nachtragspositionen** | Nachtrag, OZ (z. B. `03.01.0045N1`), Texte, Menge, EP |
| **Aufmaß** | Auftrags- oder Nachtragsposition, Rechnung, Bauteil/Ort, Ansatz (Text), L, B, H, Anzahl, Menge (Formel) |
| **Rechnungen** | Auftrag, Nr., Art (Abschlag, Teilschluss, Schluss), Datum, kumulierte Leistung (Formel aus Aufmaß), Einbehalt, abzüglich bisheriger Zahlungen, Skonto, Zahlbetrag, Prüfvermerk |
