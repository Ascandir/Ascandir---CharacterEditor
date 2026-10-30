# Ascandir – CharacterEditor

D&D-5e-Charaktereditor für Windows mit Daten aus 5e.tools (offizielle Bücher und Homebrew) und einem 3D-Designer.
*D&D 5e character editor for Windows using 5e.tools data (official books and homebrew) plus a 3D designer.*

## Version 0.1.0

**Enthalten / Included**
- Charakter-Assistent: Volk (inkl. Unteroptionen wie Drachenahnenschaft), Klasse mit Startstufe, Hintergrund, Attribute, alle Pflichtauswahlen, Startausrüstung
- Attribute: Standard-Array, Point Buy, Würfeln mit frei einstellbarer Würfelregel (Anzahl, Würfelart, streichen, Bonus, 1er neu würfeln, Anzahl Werte) und Wurf-Verlauf, manuell
- Charakterbogen: Werte, Rettungswürfe, Fertigkeiten, RK, TP, Merkmale, Zauber/Zauberplätze, Inventar, Notizen
- Leveln inkl. Multiclass mit Voraussetzungsprüfung; vergangene Stufen nachträglich ändern oder entfernen
- Freie Extras außerhalb der Regeln (Feats, Merkmale, Zauber, Attributswerte, Fertigkeiten, TP, RK)
- Quellen & Regeln: D&D 2014 / 2024, Bücher einzeln an/aus, komplette 5e.tools-Homebrew-Sammlung durchsuchbar, eigene Homebrew-Dateien, Kampagnen-Profile (exportierbar)
- Speichern (automatisch), Charakterliste, Import/Export als JSON
- 3D-Designer (Baukasten): Größe, Körperbau, Muskeln, Alter, Kopf, Haare, Rüstung, Waffe, Schild, Umhang, Farben; Stilwechsel live (Realistisch, Gemalt, Comic, Miniatur); Export als PNG mit transparentem Hintergrund, rundes Token, GLB
- Deutsch / Englisch umschaltbar (Programm und Installer)
- Treiberprüfung: Hinweis bei zu altem AMD-Treiber (aktualisiert nie selbst)

**Geplant / Planned (0.2.0+)**: lokale KI (ComfyUI mit ROCm, TRELLIS), Modell-Downloads im Installer, Modell-Updates, KI-Text-Modus, KI-Stilvorschau, Foundry-Export.

## Hinweise
- Die 5e.tools-Daten werden beim ersten Start heruntergeladen und lokal zwischengespeichert. Sie sind nicht Teil dieses Repos.
- Nur für den privaten Gebrauch.

## Build
```
npm ci
npm run dist   # erzeugt release/Ascandir-CharacterEditor-Setup-<version>.exe
npm test       # Regel-Engine-Tests (brauchen lokale 5e.tools-Daten, siehe tests/)
```
Jeder Push auf `main` baut den Installer über GitHub Actions und veröffentlicht ihn als Release `v<version>` (Version aus package.json).
