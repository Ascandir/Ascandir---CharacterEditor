# Changelog

## 0.2.4
- KI-Maler: großes Bild mit dem Mausrad zoomen (zur Mausposition hin), mit gedrückter Maustaste verschieben, Doppelklick setzt zurück. Unten rechts gibt es −/+ und „Einpassen“

## 0.2.3
- **Filter** für Völker, Klassen und Hintergründe (wie bei 5e.tools): z. B. Attributsbonus, Talent, Fertigkeiten, Werkzeuge, Sprachen, Größe, Bewegungsarten, Dunkelsicht, Resistenzen, Kreaturentyp, Quelle. Klick = einschließen, nochmal = ausschließen
- Standard-Array / gewürfelte Werte: ein bereits vergebener Wert tauscht jetzt die beiden Felder, dazu ein Knopf „Felder leeren“

## 0.2.2
- Update-Funktion repariert: kein Absturz mehr („EBUSY … resource busy or locked“), wenn noch ein altes Installationsprogramm läuft
- Das Update-Installationsprogramm läuft jetzt sichtbar statt still im Hintergrund, am Ende kann das Programm direkt gestartet werden

## 0.2.1
- Hintergrund-Entfernung mit dem KI-Modell **BiRefNet** (erkennt die Figur selbst, auch bei Verläufen und Schatten). Im KI-Maler erscheint ein Knopf zum Nachladen (ca. 0,4 GB)
- Ohne BiRefNet: verbessertes Ersatzverfahren, das auch Hintergrund-Verläufe entfernt
- Attraktivität: deutlich stärkere Skala – 0 ergibt eine wirklich hässliche, abgemagerte Gestalt, niedrige Werte zeigen grobe, unschöne Züge
- Der gewünschte Ausschnitt (z. B. Ganzkörper) steht jetzt am Anfang der KI-Anweisung und wird besser eingehalten

## 0.2.0
- **KI-Maler** im Designer: malt deinen Charakter mit lokaler KI (Z-Image Turbo über ComfyUI)
- Übernimmt Volk (inkl. Unterart, z. B. Drachenfarbe), Klasse und angelegte Ausrüstung vom Charakterbogen
- Regler: Größe in cm (passend zum Volk), Körperbau, Kurven, Muskeln, Attraktivität, Alter; dazu Haare, Augen, Haut, Merkmale, Kleidung, eigene Zusätze
- 7 Stile (Gemalt, Realistisch, 3D-Spiel, Comic, Tusche, Aquarell, Anime), Ganzkörper / Dreiviertel / Portrait
- Mehrere Varianten auf einmal, „Ausgewähltes verfeinern“ mit einstellbarer Änderungsstärke, Bildverlauf pro Charakter
- Hintergrund wird automatisch entfernt; Token mit Ring direkt aus dem Bild (Ausschnitt einstellbar), Export als PNG, als Portrait übernehmen
- **KI-Einrichtung**: Beim ersten Start installiert das Programm ComfyUI (AMD ROCm oder NVIDIA) und das Bildmodell selbst – mit Fortschritt, Speicherort-Wahl und Fortsetzen abgebrochener Downloads
- Einstellungen: KI starten/beenden, automatisches Beenden bei Inaktivität, Suche nach Updates für ComfyUI und Modelle
- Der bisherige 3D-Designer bleibt als „3D-Baukasten“ erhalten

## 0.1.7
- Foundry-Export: Charakterbogen → „Für Foundry exportieren“ erzeugt eine Datei für das dnd5e-System (in Foundry: Akteur anlegen → Rechtsklick → „Import Data“)
- Übernommen werden Attribute, Rettungswürfe, Fertigkeiten, TP, Bewegung, Dunkelsicht, Sprachen, Resistenzen, Werkzeuge, Klassen und Unterklassen, Volk, Hintergrund, alle Merkmale und Feats, Zauber und das Inventar (Rüstung und Waffen mit Werten)

## 0.1.6
- Werkzeug-Übungen (Handwerkszeug, Spielsets, Musikinstrumente, Kits) sind jetzt eine Auswahl aus den offiziellen Werkzeugen statt eines Textfelds
- Werkzeug-Auswahlen von Völkern werden ebenfalls abgefragt

## 0.1.5
- Eigene Bestätigungs- und Eingabefenster statt der Windows-Systemfenster: Eingabefelder (z. B. der Charaktername) frieren danach nicht mehr ein
- „Profil speichern“ unter Quellen & Regeln funktioniert jetzt (die Namensabfrage fehlte in der installierten Version)

## 0.1.4
- Update-Hinweis als hervorgehobener „Update“-Knopf oben in der Leiste statt eines Hinweisbalkens
- Klick auf „Update“ zeigt zuerst die Neuerungen, installiert wird erst nach Bestätigung
- Kompletter Changelog in den Einstellungen

## 0.1.3
- Update-Funktion: Das Programm sucht beim Start nach einer neuen Version auf GitHub und installiert sie auf Wunsch selbst
- Einstellungen: „Nach Updates suchen“ und automatische Prüfung abschaltbar

## 0.1.2
- Bereits gewählte Invocations, Zauber und Feats verschwinden aus späteren Auswahlen
- Voraussetzungen (z. B. „Level 5 · Pact of the Tome“) werden lesbar angezeigt und geprüft; nicht erfüllte sind ausgegraut
- Keine doppelten Einträge aus 2014 und 2024 mehr

## 0.1.1
- Alle Auswahlfenster und viele Bereiche lassen sich zuklappen
- Homebrew: alle angezeigten Pakete auf einmal aktivieren oder alle deaktivieren
- Würfelregel: Bonus pro Wert jetzt auch negativ
- Startausrüstung kann übersprungen werden
- Abstand beim „Details“-Knopf korrigiert

## 0.1.0
- Erste Version: Charakter-Assistent mit 5e.tools-Daten und Homebrew, Attribute würfeln, Charakterbogen, Leveln mit Multiclass, freie Extras, Quellen & Regeln (2014/2024), 3D-Designer mit Export, Deutsch/Englisch
