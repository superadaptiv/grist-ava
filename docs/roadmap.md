# Roadmap AVA-System

## ✅ Stufe 1: LV erstellen (LV-Editor v2)
- Gliederung mit Titel und Untertitel, OZ `01.01.0010`, OZ-Sperre ab Ausschreibung
- Positionen anlegen, duplizieren, löschen und sortieren, mit Positionsart und Einheiten
- Automatisches Speichern, Suche, Dokumentansicht
- Druck als Ausschreibung (leere Preisfelder) oder Kostenanschlag, Typst-Export
- Schema-Assistent ergänzt fehlende Spalten

## Stufe 2: Komfort beim Erstellen
- Positionsbibliothek: Musterpositionen suchen und ins LV übernehmen
- Positionen per Drag & Drop zwischen Titeln verschieben
- Langtext mit einfacher Formatierung (fett, Listen)
- LV kopieren (z. B. aus einem alten Projekt), LV-Versionen und Änderungsvermerk
- Mengenermittlung je Position (Ansatz, L × B × H), als Grundlage für das spätere Aufmaß

## Stufe 3: GAEB
- Export **GAEB DA XML X83** (Angebotsaufforderung) an die Bieter
- Import **X84** (Angebot) in `Angebotspreise`
- Später X86 (Auftrag) und X31 (Mengen / Aufmaß)

## Stufe 4: Vergabe (Widget „Preisspiegel“)
- Positionen in Zeilen und Bieter in Spalten
- Min und Max je Zeile hervorgehoben, Abweichung zum Kostenansatz in %
- Nachlass und Skonto, Wertungssumme, Rangfolge
- Spekulationsverdacht markieren (EP weit unter oder über dem Mittelwert)
- Vergabevorschlag drucken, Zuschlag erzeugt einen Auftrag

## Stufe 5: Abrechnung (Widget „Abrechnung“)
- Aufmaß je Rechnung
- Nachträge mit Status-Workflow
- Abschlagsrechnungen kumuliert prüfen: Einbehalt, bisherige Zahlungen, Skonto
- Kostenkontrolle je Gewerk bzw. DIN-276-KG: Kostenansatz → Auftrag → Nachträge → abgerechnet → Prognose

## Technik
- Gemeinsamen Code (Formatierung, Grist-Zugriff, Druck-Bausteine) nach `shared/` auslagern
- Jedes Widget bleibt eine eigene Seite und eigene URL
- Versionen über Git-Tags (`v2.0.0`) und eine stabile URL für den Produktivbetrieb
