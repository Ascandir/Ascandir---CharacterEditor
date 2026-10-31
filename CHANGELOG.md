# Changelog

## 0.5.2
- Klassenauswahl wie bei 5e.tools: Trefferwürfel und TP, Hauptattribut, Rettungswürfe, Rüstung, Waffen, Werkzeuge, Fertigkeiten, Zauberattribut, Mehrklassen-Voraussetzung und Startausrüstung
- **Klassentabelle** über alle 20 Stufen mit Übungsbonus, Merkmalen, Klassenspalten (z. B. Rages, Channel Divinity, Cantrips, Prepared Spells) und **Zauberplätzen pro Grad**. Die gewählte Stufe ist hervorgehoben
- Alle Klassenmerkmale mit Beschreibung zum Aufklappen. Ein Klick auf ein Merkmal in der Tabelle springt dorthin. Unter-Merkmale (z. B. Divine Spark, Turn Undead) werden jetzt mit Text angezeigt
- Liste aller verfügbaren Unterklassen

## 0.5.1
- KI-Maler: Das Bildmodell wählst du jetzt oben rechts per Auswahlliste, auf Höhe von „KI-Maler“ und „3D (TRELLIS)“

## 0.5.0
- KI-Maler: zweites Bildmodell **Qwen Image 2.1** (ca. 30 GB, im KI-Maler per Knopf ladbar). Hält sich viel genauer an Beschreibungen, malt bis 2K direkt, ist aber deutlich langsamer
- Mit Qwen bearbeitet „Ausgewähltes verfeinern“ das Bild gezielt statt es neu zu malen. Dazu gibt es das Feld **Änderungswunsch** (z. B. „give him a red cloak“)
- Mit Qwen nimmt die **Mehrfachansicht** das ausgewählte Bild als echte Vorlage, dadurch bleiben Gesicht, Körper und Ausrüstung in allen Ansichten gleich
- Eigene Stile haben jetzt auch einen **Negativ-Prompt** (wirkt nur mit Qwen)
- Ist ComfyUI zu alt für Qwen, erscheint ein Knopf zum Aktualisieren

## 0.4.2
- Update-Installation: Das Installationsprogramm startete seit 0.3.4 unsichtbar im Hintergrund. Es öffnet sich jetzt wieder sichtbar. Falls es trotzdem nicht startet, öffnet sich der Ordner mit dem Installationsprogramm
- KI-Maler: Tiervölker deutlich genauer beschrieben (Aarakocra, Kenku, Owlin, Tabaxi, Echsenvolk, Tortle, Harengon, Minotaurus, Kobold): ganzer Tierkopf, Federn/Fell/Schuppen am ganzen Körper, Vogelbeine mit Krallen, Flügel auf dem Rücken usw.

## 0.4.1
- KI-Maler: Fehler „fetch failed“ behoben. ComfyUI ist bei großen Bildern (Hochskalieren, Speichern) zeitweise nicht erreichbar, das Programm wartet jetzt geduldig statt abzubrechen
- Stürzt ComfyUI wirklich ab, zeigt die Fehlermeldung den Grund aus dem ComfyUI-Protokoll (z. B. „Grafikspeicher voll“)
- 2K/4K werden jetzt in „Standard“ gemalt und dann hochskaliert, das braucht weniger Speicher

## 0.4.0
- **Klickbare Verweise**: Talente, Zauber, Gegenstände und optionale Merkmale in Beschreibungen (z. B. das Talent eines Hintergrunds) sind anklickbar und zeigen ihre Beschreibung
- **Weapon Mastery** (2024) für Barbar, Kämpfer, Paladin, Waldläufer und Schurke als Auswahl, inklusive Beschreibung der Mastery-Eigenschaft. Die Anzahl steigt mit der Stufe
- 2014-Waldläufer: Auswahl für Favored Enemy und Natural Explorer
- KI-Maler: Auflösung **2K und 4K** (gemalt in „Hoch“, dann mit dem Real-ESRGAN-Hochskalierer vergrößert, ca. 0,07 GB Download)
- KI-Maler: **eigene Stile speichern** mit Namen. Sie stehen dann neben den festen Stilen zur Auswahl und lassen sich ändern oder löschen

## 0.3.6
- KI einrichten: Vorschlag, die KI im Ordner **„models“ im Programmordner** zu installieren. Dieser Ordner bleibt bei Updates erhalten
- Wählst du selbst einen Ordner, wird darin ein Unterordner „models“ angelegt
- Wechselst du den Ordner, wird die vorhandene KI (ComfyUI, Modelle, TRELLIS) dorthin verschoben statt neu geladen

## 0.3.5
- Beim Start beendet das Programm übrig gebliebene KI-Prozesse aus einer früheren Sitzung (z. B. ComfyUI, das nach dem Beenden über den Task-Manager weiterlief und Grafikspeicher und Modelldateien belegt hat)
- Vor einem Update werden auch alle Prozesse aus dem KI-Ordner beendet
- Der KI-Ordner kann nicht mehr innerhalb des Programmordners liegen, weil ein Update ihn sonst löschen würde

## 0.3.4
- Update-Installation hängt nicht mehr: Das Programm beendet vorher ComfyUI und TRELLIS, schließt sich vollständig und startet das Installationsprogramm erst, wenn kein Teil der alten Version mehr läuft
- Das Programm kann nur noch einmal gleichzeitig laufen (ein zweiter Start holt das vorhandene Fenster nach vorne)

## 0.3.3
- Körperdetails deutlich stärker: 7 Stufen, die Enden sind bewusst übertrieben (0 = z. B. komplett flach, 100 = riesig und cartoonhaft)
- Verfeinern nach geänderten Körperdetails oder Körperform: Die geänderten Werte werden in der KI-Anweisung nach vorne gezogen, und die Änderungsstärke wird automatisch auf mindestens 68 % angehoben, damit sich die Figur auch wirklich ändert
- Hinweis, wenn die KI-Anweisung von Hand geändert wurde, denn dann wirken die Regler nicht
- Auflösung wählbar: Schnell, Standard, Hoch, Sehr hoch (bis ca. 2 Megapixel)

## 0.3.2
- KI-Maler: Die Bildvorschau passt ihre Höhe jetzt automatisch an die Fenstergröße an
- Am unteren Rand der Vorschau gibt es einen Griff, mit dem du die Höhe selbst ziehen kannst. Die Höhe wird gemerkt, ein Doppelklick auf den Griff stellt wieder auf automatisch
- Die 3D-Ansicht passt sich ebenfalls an die Fenstergröße an

## 0.3.1
- TRELLIS wird jetzt **vom Programm selbst installiert**: Programmteil (Vulkan für AMD, CUDA für NVIDIA) und die TRELLIS.2-Modelle landen in deinem KI-Ordner. Modellgröße wählbar: F16 (16,5 GB), Q8 (9,5 GB), Q4 (6 GB). Abgebrochene Downloads werden fortgesetzt
- Eigene Installation läuft auf einem eigenen Port und stört ein separat installiertes Trellis Studio nicht
- Neue TRELLIS-Versionen werden erkannt und lassen sich per Knopf aktualisieren
- Vor dem 3D-Erzeugen wird die Bild-KI beendet, damit der Grafikspeicher frei ist

## 0.3.0
- Der 3D-Baukasten ist raus. Neu im Designer: **3D (TRELLIS)**. Das Programm benutzt dein installiertes TRELLIS (trellis.cpp / Trellis Studio), startet es selbst und schickt das Bild hin
- Als Vorlage wird automatisch die neueste Mehrfachansicht genommen. TRELLIS verarbeitet genau ein Bild, deshalb wählst du die Ansicht (Standard: vorne)
- Auflösung 512/1024/1536, mit oder ohne Textur, Seed. Fertige Modelle werden pro Charakter gespeichert, im Programm drehbar angezeigt und lassen sich als GLB exportieren
- Ist TRELLIS nicht installiert, startet ein Knopf den offiziellen Installer

## 0.2.7
- KI-Maler: Grafikstil **„Eigener Stil“** mit Textfeld, in dem du den Stil frei beschreibst

## 0.2.6
- KI-Maler: Textfeld **Pose** (z. B. „kneeling, drawing a sword“)
- **Körperdetails** zum Aufklappen: Schulterbreite, Armlänge, Armdicke, Oberweite/Brust, Taille, Hüfte, Po, Beinlänge, Beindicke, Kopfgröße. 50 = normal, Doppelklick auf einen Regler setzt ihn zurück

## 0.2.5
- KI-Maler: **eigene Bilder importieren** (Knopf „Bild importieren“ oder ins Bild ziehen) und danach mit „Ausgewähltes verfeinern“ von der KI anpassen lassen
- **Mehrfachansicht**: erzeugt ein Blatt mit 4 Ansichten (vorne, rechts, hinten, links), auf Wunsch am ausgewählten Bild orientiert. „Ansichten einzeln speichern (TRELLIS)“ legt jede Ansicht als freigestelltes PNG in einen Ordner

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
