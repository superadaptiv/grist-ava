# grist-ava

AVA-System (Ausschreibung · Vergabe · Abrechnung) als Custom Widgets für **Grist** (self-hosted).

| Widget | Ordner | Status |
|---|---|---|
| LV-Editor | `widgets/lv-editor/` | v2.0: Gliederung, OZ, Druck, Typst |
| Preisspiegel | `widgets/preisspiegel/` | geplant |
| Aufmaß / Rechnung | `widgets/abrechnung/` | geplant |

Die Doku liegt in `docs/`: [Datenmodell](docs/datenmodell.md), [Roadmap](docs/roadmap.md) und [Design](docs/design.md).

---

## 1. Repository auf GitHub anlegen

**Variante A, im Browser (ohne Kommandozeile)**
1. Auf github.com oben rechts **+ → New repository** wählen. Name: `grist-ava`. Ob *Public* oder *Private* passt, steht unter 2.
2. Auf **uploading an existing file** klicken und den Inhalt dieses Ordners hineinziehen (`widgets`, `dev`, `docs`, `README.md` …).
3. Mit **Commit changes** speichern.

**Variante B, mit Git im Terminal**
```bash
cd grist-ava
git remote add origin https://github.com/<DEIN-NAME>/grist-ava.git
git push -u origin main
```
Wer lieber eine Oberfläche benutzt, nimmt **GitHub Desktop** oder die Git-Funktion in VS Code.

## 2. Das Widget in Grist benutzen

Grist lädt ein Custom Widget **per URL**. Das Widget muss also irgendwo im Web erreichbar sein.

### Option 1: GitHub Pages (am einfachsten)
1. Im Repo **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`** wählen und speichern.
2. Nach etwa einer Minute ist das Widget erreichbar unter
   `https://<DEIN-NAME>.github.io/grist-ava/widgets/lv-editor/`
3. In Grist: **Neu hinzufügen → Widget hinzufügen → Benutzerdefiniert** wählen, beliebige Tabelle (z. B. `LV_Druck`), dann
   **Benutzerdefinierte URL** einfügen und die **Zugriffsebene „Vollständiger Dokumentzugriff“** einstellen.

> GitHub Pages ist im kostenlosen Tarif nur für **öffentliche** Repos verfügbar.
> Das ist hier unkritisch, denn im Repo liegt nur Code und keine Projektdaten. Die Daten bleiben in deinem Grist.
> Die Demo-Daten in `dev/mock-grist.js` sind erfunden.

### Option 2: Auf dem eigenen Server (Repo bleibt privat)
Der Ordner wird neben Grist als statische Website ausgeliefert, z. B. mit Caddy oder nginx:
```bash
git clone https://github.com/<DEIN-NAME>/grist-ava.git /srv/grist-ava
# Aktualisieren:
cd /srv/grist-ava && git pull
```
Caddy-Beispiel:
```
widgets.example.de {
  root * /srv/grist-ava
  file_server
}
```

### Option 3: In der Widget-Liste von Grist anzeigen
Bei self-hosted Grist kann man eine eigene Widget-Liste hinterlegen. Dann taucht der LV-Editor direkt in der Auswahl auf:
```
GRIST_WIDGET_LIST_URL=https://<DEIN-NAME>.github.io/grist-ava/manifest.json
```
Vorher in `manifest.json` die URL anpassen. Diese Variable ersetzt die Standardliste. Wer die Grist-Widgets weiter nutzen will, nimmt deren Einträge mit in die eigene `manifest.json` auf.

## 3. Erster Start
Beim ersten Öffnen erkennt das Widget fehlende Spalten und zeigt einen gelben Hinweis **„Datenmodell erweitern“**. Ein Klick auf **Jetzt anlegen** ergänzt diese Spalten:
- `Titel.Uebergeordnet` für Untertitel (01.01)
- `Positionen.LV` als Formel, damit man in normalen Grist-Ansichten nach LV filtern kann
- Deckblatt-Felder in `Leistungsverzeichnisse`
- `Positionen.Gesamtpreis` wird auf 2 Nachkommastellen gerundet

Alles bleibt in Grist mit Strg/Cmd+Z rückgängig zu machen.
Büro-Angaben für den Druck (Planer, Anschrift, Kontakt, MwSt.) stehen unter ⚙ **Einstellungen** und werden pro Widget gespeichert.

## 4. Entwickeln und Testen ohne Grist
```bash
cd grist-ava
python3 -m http.server 8000
# Browser: http://localhost:8000/widgets/lv-editor/index.html?demo
#          http://localhost:8000/widgets/lv-editor/index.html?demo=alt   (altes Datenmodell)
```
Der Demo-Modus benutzt `dev/mock-grist.js` mit einem Beispiel-LV (Rohbau). Änderungen bleiben nur bis zum Neuladen erhalten.

**Ablauf:** Code ändern → lokal mit `?demo` prüfen → committen und pushen → GitHub Pages aktualisiert sich → in Grist das Widget neu laden.
Für größere Umbauten lohnt sich ein Branch `dev` mit einer zweiten Grist-Seite, die auf die Test-URL zeigt.

## 5. Bedienung LV-Editor (Kurzfassung)
- **Gliederung links:** Titel und Untertitel (bis 3 Ebenen) mit Summen. Beim Überfahren erscheinen ▲▼ zum Sortieren und ✎ zum Bearbeiten. Ein Doppelklick bearbeitet den Titel.
- **Positionen:** Eine neue Position wird hinter der markierten eingefügt. Die OZ wird automatisch vergeben (`01.02.0010`, Schrittweite 10).
- **Speichern:** passiert automatisch während der Eingabe, Strg/Cmd+S speichert sofort.
- **Strg/Cmd+Enter** legt eine neue Position an, **Esc** schließt den Editor.
- **Positionsart:** Eventual-, Bedarfs- und Alternativpositionen erscheinen mit „Nur Einh.-Pr.“ und zählen nicht zur Summe.
- **OZ-Sperre:** Ab LV-Status *Ausschreibung* oder *Beauftragt* werden Ordnungszahlen nicht mehr umnummeriert. Neue Positionen bekommen eine freie Nummer dazwischen.
- **Drucken:** *Ausschreibung* (leere Preisfelder, Bieterangaben, Unterschrift), *Kostenanschlag* (mit EP und GB) oder *Kurz-LV*. Der Druck öffnet sich in einem neuen Fenster, dort „Als PDF speichern“ wählen.
