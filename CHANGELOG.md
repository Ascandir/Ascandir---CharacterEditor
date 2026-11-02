# Changelog

## 0.9.9
- Mapmaker / „Neu malen nach Linien“: Z-Image bekam bisher die Anweisung „reines flaches 2D, keine Schatten, wie eine gedruckte Karte“. Dadurch sahen die Bilder billig und comichaft aus. Weil der gerade Winkel schon durch die Umrisse festgelegt ist, malt Z-Image jetzt mit voller Tiefe, Schattierung, Materialien und Details. Die Linientreue steht neu auf 70 %, damit Z-Image mehr eigenen Spielraum hat

## 0.9.8
- Mapmaker / Battlemap-Modell: neue Option **„Z-Image-Stil: Neu malen nach Linien“**, als Empfehlung gekennzeichnet. SDXL mit der Battlemap-LoRA malt die gerade Draufsicht nur noch als Vorlage. Die App zieht daraus die Umrisse (Canny), und Z-Image malt das Bild **komplett neu in seinem eigenen Stil**, genau entlang dieser Umrisse (Z-Image-ControlNet, offizielle ComfyUI-Kette). Ziel: der gewohnte Z-Image-Look mit dem geraden Winkel von oben
- Dafür einmalig „Z-Image-ControlNet laden (ca. 3 GB)“. Mit „Linientreue“ stellst du ein, wie streng Z-Image den Umrissen folgt
- Weiterhin wählbar: „Mit Z-Image nachmalen“ (Übermalen mit wenig Stärke) und „Nur SDXL“

## 0.9.7
- Mapmaker / Battlemap-Modell: „Mit Z-Image nachmalen“ ist jetzt standardmäßig auf 50 % (bisher 35 %) und lässt sich bis 80 % hochdrehen. So kommt mehr vom gewohnten Z-Image-Zeichenstil durch. SDXL gibt dabei weiter den geraden Blick von oben und den Aufbau vor

## 0.9.6
- Mapmaker / Battlemap-Modell: Die **LoRA wurde bisher gar nicht angewendet**. Die Civitai-Datei ist in einem älteren Format gespeichert, das ComfyUI nicht versteht. Laut comfyui.log wurden alle 1120 Teile mit „lora key not loaded“ übersprungen. Deshalb kam reines SDXL heraus, mit schräger Perspektive. Die App wandelt die Datei jetzt beim ersten Malen automatisch in das passende Format um. Die Originaldatei bleibt als .orig erhalten
- Sollte ComfyUI eine LoRA einmal nicht anwenden können, erscheint jetzt ein Hinweis, statt dass stillschweigend ein falsches Bild entsteht

## 0.9.5
- Mapmaker: Der **KI-Berater** führte zu einem leeren, schwarzen Fenster, wenn oben rechts das Battlemap-Modell (SDXL) ausgewählt war. Weil die App sich den Reiter merkt, landete man nach dem Neustart wieder dort. Behoben. Der Berater kennt das Battlemap-Modell jetzt und schreibt dafür kurze, stichwortartige Beschreibungen
- Allgemein: Stürzt eine Ansicht wegen eines Fehlers ab, bleibt das Fenster nicht mehr schwarz. Es erscheint eine Meldung mit der Fehlerursache und einem „Zurück“-Knopf

## 0.9.4
- Mapmaker: neues **Battlemap-Modell**, gedacht für eine streng gerade 2D-Draufsicht: Stable Diffusion XL mit der LoRA „DnD Battlemaps Generator“ (Civitai), zusammen ca. 7 GB. Laden über den Hinweis im Mapmaker, danach oben rechts als „Battlemap-Modell (SDXL)“ auswählbar
- **„Mit Z-Image nachmalen“** (an): SDXL legt den Blick von oben und den Aufbau fest, danach malt Z-Image im selben Durchgang mit wenig Stärke (Standard 35 %) drüber und bringt seinen Look. Stärke und LoRA-Gewicht sind einstellbar
- Falls Civitai den Download der LoRA ohne Anmeldung nicht erlaubt: Die App öffnet die Civitai-Seite. Dort lädst du die Datei selbst herunter und wählst sie mit „Heruntergeladene LoRA auswählen …“ aus. Das SDXL-Modell lädt die App danach selbst
- Ändern, Varianten und die Schnellknöpfe (Nacht, Winter …) funktionieren auch mit dem Battlemap-Modell

## 0.9.3
- Mapmaker: **Referenzkarte für Winkel & Stil**. Du lädst eine Karte, die genau so aussieht, wie du es willst, z. B. eine Dungeondraft- oder Forgotten-Adventures-Karte. Qwen Image 2.1 / Turbo übernimmt davon Kamerawinkel (gerade von oben), Maßstab und Grafikstil, aber nicht Aufbau und Inhalt. Eine gelungene eigene Karte lässt sich mit „Als Referenzkarte nutzen“ direkt dafür verwenden
- Der Stil „Flach & klar (Inkarnate-Stil)“ ist ersetzt durch **„Wie Dungeondraft / Forgotten Adventures“**: halbrealistische, handgezeichnete Texturen mit feinen dunklen Umrissen, Dielen, Steinfliesen, Gras, Objekte als flache Draufsicht-Ausschnitte mit leichtem Schatten, Innenräume ohne Dach mit Mauern als schmale Bänder

## 0.9.2
- Mapmaker: neue Einstellung **„Tiefe“** für die Draufsicht. Standard ist **„Reines 2D“**. Die Karte wird beschrieben wie eine gedruckte Papierkarte oder ein Bauplan: flache Schattierung, keine Schlagschatten, nichts ragt aus dem Boden, Mauern sind flache Bänder auf dem Grundriss. Dazu „2D mit leichten Schatten“ und „Plastisch (2,5D)“ für alle, die mehr Tiefe wollen
- Bei „Reines 2D“ werden Schatten auch aus der Lichtbeschreibung entfernt. Mit Qwen Image 2.1 und „Strenge Draufsicht“ verbietet der Negativ-Prompt zusätzlich 2,5D, 3D-Render, Höhe, erhöhte Mauern und Schlagschatten
- Neuer Kartenstil **„Flach & klar (Inkarnate-Stil)“**, jetzt Standard für neue Karten. Er orientiert sich an den flachen Karten aus Inkarnate und Dungeondraft
- Der KI-Berater kann die Tiefe ebenfalls einstellen

## 0.9.1
- Mapmaker: **Draufsicht deutlich strenger**. Die Kamera steht jetzt ganz vorne im Prompt („strict 90 degree overhead view, camera looks straight down, orthographic like a floor plan“), denn die Modelle gewichten den Anfang am stärksten. Am Ende wird sie noch einmal betont. Dazu kommt eine genaue Beschreibung, wie Dinge von oben aussehen: Mauern nur als Oberkante, Bäume als runde Kronen, Treppen als flache Stufenreihen, alle Linien parallel zum Bildrand
- Kein Rahmen mehr um die Karte: Die Karte ist jetzt ein Ausschnitt, der über alle Bildränder hinausgeht
- Qwen Image 2.1: neue Option **„Strenge Draufsicht“** (an). Sie verbietet über einen Negativ-Prompt schräge, isometrische und perspektivische Ansichten. Das verdoppelt die Rechenzeit. Bei Z-Image und Qwen Turbo wirken Negativ-Prompts technisch nicht, dort hilft nur die Beschreibung

## 0.9.0
- **Neu: Mapmaker** (oben neben „Designer“). Damit malst du mit denselben Bildmodellen (Z-Image, Qwen Image 2.1 / Turbo) **Battlemaps für Foundry VTT**. Er funktioniert unabhängig vom gerade geöffneten Charakter
- **Kamera**: Draufsicht (passt genau aufs Foundry-Raster), leicht schräg, isometrisch, 3D-Render von oben
- **Biom / Gegend** (21, z. B. Wald, Sumpf, Wüste, Gebirge, Küste, Höhle, Unterreich, Dungeon, Stadt, Feenwild, Schattenreich) und **Ort** (z. B. Lichtung, Straße, Lager, Brücke, Ruinen, Marktplatz, Taverne außen/innen, Haus innen, Tempel, Burg, Dungeon-Raum, Gruft, Mine, Schiffsdeck, Hafen, Arena, Monsterhort)
- **Licht**: neutral (am besten für Foundrys eigene Beleuchtung), voll beleuchtet, Dämmerung, Nacht, Fackelschein, dunkel. Dazu **Wetter** und **Jahreszeit**
- **Assets zum Anhaken** mit **Mengenregler** (von einzeln bis sehr viele), in 5 Gruppen: Natur, Wasser, Wege, Bauten, Kleinkram. Zum Beispiel Bäume, Felsen, Fluss, Lava, Straße, Ruinen, Zelte, Lagerfeuer, Taverne, Häuser, Turm, Mauern, Brücke, Brunnen, Schrein, Statuen, Gräber, Marktstände, Höhleneingang, Kisten & Fässer, Karren, Knochen, Schatz, Fallen. Dazu ein **Füllgrad**-Regler von offen bis vollgestopft
- **Kartenstile** (handgemalt, klar & sauber, realistisch, Tusche/Pergament, Aquarell, düster, eigener Stil) und ein Feld für **Zusätze und Aufbau** (Deutsch wird übersetzt)
- **Größe in Feldern** (z. B. 30×20) und Pixel pro Feld (Foundry-Standard 100). Gemalt wird in etwa 1 Megapixel und danach so hochskaliert, dass das Raster exakt passt
- **Ändern der ausgewählten Karte** per Text, dazu Schnellknöpfe: Nachtversion, Winter, Herbst, Regen, Nach der Schlacht, Nebel. Außerdem **Varianten** mit gleichem Ort und Stil, aber anderem Aufbau. Am besten klappt das mit Qwen
- **KI-Berater** für Karten: Er fragt nach Ort, Szene und Aufbau, denkt an Deckung und Engstellen und stellt dann die Regler ein oder schreibt einen eigenen Prompt
- **Export für Foundry**: Bild (WebP) plus Szenendatei (.scene.json) mit Bildpfad, Größe, Feldgröße und Dunkelheit. Import über Rechtsklick auf eine Szene → „Import Data“. Optional wird das Raster ins Bild gezeichnet. Auch als einfaches WebP/PNG exportierbar
- KI-Berater: Mit „Enter“ senden gilt auch hier

## 0.8.15
- Magier (2024): Das **Zauberbuch** wächst jetzt richtig. Es startet mit 6 Zaubern und bekommt pro Stufe 2 dazu. Bisher wurde fälschlich die Zahl der vorbereiteten Zauber benutzt (4, dann +1). Die Zahl der vorbereiteten Zauber steht weiterhin im Charakterbogen
- Unterklassen (2024): Die einzelnen Merkmale einer Stufe werden jetzt als **eigene Merkmale** geführt, also z. B. Evocation Savant und Potent Cantrip beim Evoker statt nur „Evoker“. Das gilt für alle Klassen
- Magier-Schulen 2024 (Abjurer, Diviner, Evoker, Illusionist): Die **Savant-Zauber** werden abgefragt. Auf Stufe 3 sind es 2 Zauber der Schule bis Grad 2, danach 1 weiterer, sobald es einen neuen Zaubergrad gibt (Stufe 5, 7, 9 …). Sie kommen ins Zauberbuch
- Zauber aus Hintergrund-Talenten gibt es nur, wenn der Hintergrund das Talent auch vergibt, und nur die Zauber, die du dort auswählst. Ein Soldat bekommt also z. B. keine

## 0.8.14
- Charaktererstellung: **Zauber aus Volk, Hintergrund und Talenten** werden jetzt berücksichtigt. Bisher wurden sie komplett ignoriert. Beispiele:
  - Der Hintergrund Weiser (Sage) gibt das Talent Magic Initiate (Wizard). Dieses Talent wurde bisher gar nicht erkannt. Jetzt wählst du dort 2 Zaubertricks und einen Zauber des 1. Grades aus der Magierliste
  - Völker wie Tiefling, Elf (Abstammungen), Gnom oder Aasimar bekommen ihre festen Zauber automatisch, abhängig von der Charakterstufe
- Einen Zauber, den du so schon hast (z. B. Feuerpfeil / Fire Bolt), bietet die Klassenauswahl nicht noch einmal an. Unter der Auswahl steht, welche Zauber deshalb ausgeblendet sind. Das gilt auch umgekehrt zwischen allen Zauberauswahlen
- Im Charakterbogen stehen diese Zauber unter „Weitere Zauber (Volk, Hintergrund, Talente)“ mit ihrer Herkunft. Beim Foundry-Export werden sie mitgenommen

## 0.8.13
- KI-Berater: **Enter sendet** die Nachricht. Eine neue Zeile gibt es mit Umschalt+Enter

## 0.8.12
- KI-Berater: Das Fenster passt sich jetzt genau an die Fenstergröße an. Der Chatverlauf füllt den freien Platz und scrollt, Eingabefeld und „Senden“ bleiben immer sichtbar, auch beim Ändern der Fenstergröße oder mit geöffneter „Verbindung“

## 0.8.11
- KI-Berater: Ein laufender **Strata-Start lässt sich jetzt abbrechen** („Abbrechen“ in der Startanzeige). Dabei wird der Startvorgang beendet und Strata angewiesen, alles zu stoppen, was es schon gestartet hat
- Während des Starts zeigt die Anzeige die letzten Zeilen aus Strata. Nach 2 Minuten ohne Antwort erscheint ein Hinweis, unter welcher Adresse die App wartet
- Meldet Strata beim Start eine andere Adresse bzw. einen anderen Port als eingestellt, probiert die App diese Adresse selbst aus und übernimmt sie, wenn Strata dort antwortet

## 0.8.10
- „Bild bearbeiten“: Ganz oben in der linken Spalte gibt es jetzt den Knopf **„← Zurück zum Charakter-Designer“**. Die gewählte Ansicht bleibt außerdem erhalten. Vorher sprang der Designer jedes Mal wieder in „Bild bearbeiten“, solange ein importiertes Bild ausgewählt war

## 0.8.9
- KI-Maler: Neue Oberfläche **„Bild bearbeiten“** (✎). Importierte Bilder öffnen sich direkt darin, jedes andere Bild über den Knopf „✎ Bild bearbeiten“. Hier wird **nichts** aus dem Charakterbogen, dem Grafikstil oder den normalen Reglern und Feldern benutzt
- Eigene Regler, die alle in der Mitte auf „unverändert“ stehen (links = weniger, rechts = mehr): Größe, Körperbau, Muskeln, Kurven, Attraktivität, Alter und alle Körperdetails. Dazu Felder für Haare, Augen, Hautfarbe, Kleidung, Gesichtsausdruck, Pose, Hintergrund und „Weitere Änderung“. Leere Felder bleiben unverändert
- Darunter steht genau, was geändert wird. „Änderungen anwenden“ erzeugt das neue Bild (✎ in der Galerie). Danach springen die Regler wieder auf „unverändert“, so kannst du Schritt für Schritt weiterarbeiten
- Das Bild behält dabei sein eigenes Seitenverhältnis. Deine Charakter-Regler werden beim Import nicht mehr verstellt. „Zurück zum Charakter-Designer“ führt wieder zur normalen Ansicht

## 0.8.8
- KI-Maler: **Zentauren** werden deutlich zuverlässiger als ein einziges Wesen gemalt statt als Mensch, der ein Pferd reitet. Die Beschreibung ist viel genauer (menschlicher Oberkörper wächst an Stelle von Hals und Kopf aus dem Pferdekörper, vier Hufe, kein Sattel, kein Reiter) und wird am Ende des Prompts noch einmal betont
- Ganzkörperbilder von Zentauren werden im **Querformat** gemalt. Im Hochformat passt der lange Pferdekörper schlecht hinein, und die Modelle weichen dann gern auf „Reiter auf Pferd“ aus
- Kleidung und Rüstung beziehen sich bei Zentauren nur auf den Oberkörper. Die Regler für Beinlänge, Oberschenkel, Waden, Hüfte und Po werden ignoriert, weil sie sonst menschliche Beine erzeugen
- Mit eigenem Negativ-Prompt (Qwen Image 2.1) wird automatisch „Reiter, Sattel, Zügel, menschliche Beine“ ergänzt

## 0.8.7
- KI-Maler: ComfyUI wird jetzt **nach jedem fertigen Bild automatisch beendet** (auch nach Fehlern oder Abbruch). Der Arbeitsspeicher (bei Qwen 30–40 GB) ist damit sofort wieder frei. Das nächste Bild startet etwas langsamer, weil das Modell neu geladen wird. Abschalten lässt sich das unter Einstellungen → KI → „KI nach jedem fertigen Bild beenden“

## 0.8.6
- KI-Maler: **Eigene Bilder mit den Reglern anpassen**. Beim Importieren springen alle Körperregler (Körperbau, Kurven, Muskeln, Attraktivität, Größe und Körperdetails) auf ihren Normalwert. Verschiebst du danach einen Regler oder änderst ein Feld (Haare, Kleidung, Pose …), wird nur diese Änderung auf das Bild angewendet. Der Rest des Bildes (Gesicht, Kleidung, Stil) soll so bleiben
- Über dem Bild steht, was geändert wird, mit den Knöpfen „Änderungen anwenden“ und „Regler auf Ausgangswert“. Das Ergebnis wird zum neuen Ausgangspunkt, du kannst also Schritt für Schritt weiter anpassen. Wählst du ein solches Bild in der Galerie aus, werden seine Ausgangswerte wieder geladen
- Am besten klappt das mit Qwen Image 2.1, das Bilder gezielt bearbeiten kann. Z-Image malt das Bild dafür teilweise neu und weicht stärker ab

## 0.8.5
- KI-Maler: **Fortschrittsbalken** beim Malen. Im KI-Maler steht unter „Die KI malt …“ ein Balken mit „Schritt 12 von 30 · noch etwa 0:40 · 35 %“. Solange das Modell noch geladen wird, läuft der Balken als Lauflicht, danach zeigt er die echten Rechenschritte von ComfyUI und am Ende „Nachbearbeitung“ (Freistellen / Hochskalieren). Auch die Anzeige oben neben „Einstellungen“ hat einen kleinen Balken mit Prozentzahl

## 0.8.4
- Alle Textfelder im KI-Maler und im KI-Berater (KI-Anweisung, eigener Prompt, Stil-Prompt, Negativ-Prompt, Zusätze, Eingabe im Berater) haben oben rechts einen **⤢-Knopf**. Er öffnet den Text in einem großen Fenster zum bequemen Lesen und Bearbeiten, mit Zeichen- und Wortzählung und „Kopieren“. Änderungen wirken sofort, „Fertig“ oder Esc schließt das Fenster

## 0.8.3
- KI-Maler: **Grafikstil per Regler**. Unter „Grafikstil“ wählst du jetzt zwischen **Preset** (wie bisher: feste Stile und eigene Stil-Prompts) und **Regler**. Mit den Reglern mischst du Realismus, Gemalt, 3D-Render, Comic, Anime, Cartoon, Handgezeichnet, Tusche und Aquarell in Prozent. Dazu kommen Detailgrad, Farbsättigung (bis schwarz-weiß) und Licht & Stimmung (düster bis hell). Darunter siehst du, was daraus im Prompt wird
- Ein Regler-Stil lässt sich mit „Als Stil-Preset speichern“ unter einem Namen sichern (optional mit Negativ-Prompt). Er erscheint dann bei den Presets (🎚) und kann in den Reglern wieder geladen und weiter angepasst werden. Beim ersten Wechsel auf „Regler“ starten die Regler passend zum gerade gewählten Preset
- Der KI-Berater kennt auch den Regler-Stil
- Charaktererstellung: Fertigkeiten, die du schon vom Volk, vom Hintergrund oder aus einer anderen Wahl hast (z. B. Überlebenskunst beim Elfen), werden bei der Klasse nicht mehr angeboten. Unter der Auswahl steht, welche deshalb ausgeblendet sind

## 0.8.2
- KI-Maler: Nach einem Qwen-Bild hält ComfyUI das Modell im Arbeitsspeicher, damit das nächste Bild schneller startet. Die Speicherprüfung hat das fälschlich als „zu wenig frei“ gewertet. Jetzt wird das geladene Modell einfach wiederverwendet. Beim Wechsel zwischen Z-Image und Qwen gibt ComfyUI das alte Modell vorher frei, ohne dass du es von Hand beenden musst

## 0.8.1
- 3D: Die **Texturen** der TRELLIS-Modelle werden jetzt in der Vorschau angezeigt. Sie waren immer in der GLB-Datei enthalten, die Vorschau durfte sie wegen einer Sicherheitseinstellung aber nicht laden und zeigte das Modell weiß

## 0.8.0
- **KI-Berater füllt die Regler aus**: Neue Auswahl „Ergebnis: Regler ausfüllen / eigener Prompt“ (Standard: Regler). Der Berater setzt Geschlecht, Alter, Größe, Körperbau, Kurven, Muskeln, Attraktivität, Körperdetails, Haare, Haut, Augen, Merkmale, Kleidung, Pose und Ausschnitt. Mit „In die Regler übernehmen“ landet alles im KI-Maler, wo du danach weiter an den Reglern schieben kannst
- **Deutsche Beschreibungen** in Haare, Haut, Augen, Merkmale, Kleidung, Pose und Zusätze: Beim Verlassen des Feldes übersetzt dein Textmodell (Strata, falls es läuft) den Text ins Englische. Unter dem Feld steht „EN: …“, so wie es im Prompt landet. Ohne laufendes Textmodell hilft eine deutlich erweiterte Wortliste (u. a. Frisuren wie Pferdeschwanz, Dutt, Zöpfe, Irokese, Locken, schulterlang)

## 0.7.11
- Fenstertitel und Taskleiste zeigen wieder nur „Ascandir - CharacterEditor“ (der Charaktername steht weiterhin oben links im Programm)
- Irreführender Hinweis auf einen Treiber-Reset bei Abstürzen entfernt

## 0.7.10
- **Ursache der Qwen-Abbrüche gefunden und behoben**: Die automatische Abschaltung von ComfyUI nach 10 Minuten ohne Nutzung zählte ab dem Start eines Bildes und hat lange Qwen-Bilder nach etwa 10 Minuten mitten in der Berechnung beendet. Während gemalt wird, wird ComfyUI jetzt nie mehr automatisch beendet, die Wartezeit beginnt erst, wenn das Bild fertig ist

## 0.7.9
- Qwen: Vor dem Malen prüft das Programm den freien **Arbeitsspeicher**. Qwen Image 2.1 hält im schonenden Modus rund 30 GB Modelldaten im RAM. Ist weniger frei (z. B. weil Strata läuft), erscheint ein Hinweis mit „Strata beenden und malen“ bzw. „Trotzdem malen“, statt dass ComfyUI mittendrin abbricht
- Absturzmeldungen unterscheiden jetzt zwischen „Arbeitsspeicher voll“ und „Treiber-Reset“ und nennen den freien Arbeitsspeicher

## 0.7.8
- KI-Berater: Der Berater weiß jetzt, für welches **Bildmodell** er schreibt (Z-Image Turbo, Qwen Image 2.1 Turbo oder Qwen Image 2.1), und bekommt dazu Tipps, was das Modell gut kann (z. B. keine Negativ-Prompts bei Z-Image, lange genaue Beschreibungen bei Qwen). Das Modell steht über dem Eingabefeld
- Neue Auswahl **Grafikstil** im Berater: wie im KI-Maler eingestellt, ein fester Stil, einer deiner gespeicherten Stile oder „Berater schlägt vor“. Ein fester Stil wird genau so übernommen
- Ist „Hintergrund entfernen“ an, beschreibt der Berater einen leeren Hintergrund

## 0.7.7
- KI-Maler: Die Häkchen „Freizügigkeit sperren“, „Hintergrund entfernen“ und „Qwen malt den Hintergrund gleich transparent“ sind sauber ausgerichtet. Die Qwen-Option steht jetzt eingerückt unter „Hintergrund entfernen“, zu dem sie gehört

## 0.7.6
- KI-Berater: Strata startete nicht, wenn der Preset-Name Leerzeichen enthält (z. B. „IQ3_S 64K“). Der Startbefehl wird jetzt richtig in Anführungszeichen gesetzt

## 0.7.5
- **Alter** von 5 bis 1000 Jahren (Regler plus Eingabefeld). Darunter steht, ab wann das gewählte Volk erwachsen ist und wie alt es meist wird (z. B. Elf: erwachsen ab 100, lebt etwa 750 Jahre). Das Alter wird relativ zum Volk beschrieben: Ein 300-jähriger Elf ist ein junger Erwachsener, ein 300-jähriger Mensch uralt
- Bei Kindern und Jugendlichen werden Körperdetails, Kurven und Attraktivität ignoriert und die Kleidung ist immer bedeckt
- **Hintergrund mit Qwen**: Qwen Image 2.1 malt das Bild jetzt direkt mit transparentem Hintergrund, statt ihn hinterher auszuschneiden (abschaltbar; bei 2K/4K wird weiter ausgeschnitten)
- Z-Image: einheitlich hellgrauer Hintergrund ohne Bodenschatten, damit das Ausschneiden sauberer wird

## 0.7.4
- Körperdetails: Oberweite bei 100 noch deutlich übertriebener (cartoonhaft riesig, mit Größenvergleich zum Kopf), weiterhin bekleidet

## 0.7.3
- KI-Maler: Die Auswahl „Anzahl“ ist weg, es wird immer genau ein Bild gemalt

## 0.7.2
- KI-Maler: Ein Klick aufs Bild öffnet eine **große Ansicht** im Popup. Dort zoomst du mit dem Mausrad und verschiebst mit gedrückter Maustaste. Schließen per ✕, Esc oder Klick daneben. In der normalen Vorschau gehen Zoomen und Verschieben weiterhin

## 0.7.1
- KI-Maler: Die Bildvorschau lässt sich nicht mehr von Hand in der Höhe ziehen, sie passt sich nur noch automatisch an die Fenstergröße an

## 0.7.0
- **Körperdetails** erweitert: neu sind Unterarme, Bauch, Oberschenkel und Waden (Armdicke heißt jetzt Oberarme). Die Enden sind deutlich übertriebener, bei 0 bzw. 100 bewusst unrealistisch und cartoonhaft. Werte unter 15 oder über 85 stehen jetzt ganz vorne in der KI-Anweisung und wirken dadurch stärker
- **Grafikstil** steht jetzt am Anfang (und am Ende) der Anweisung und wirkt dadurch aufs ganze Bild statt nur aufs Gesicht
- **Deutsche Eingaben** bei Haut, Haaren, Augen, Merkmalen, Kleidung und Pose werden für gängige Wörter ins Englische übersetzt (z. B. „rot“ → „red“, „lange blonde Haare“ → „long blonde hair“). Die Hautfarbe wird ausdrücklich für den ganzen Körper verlangt
- **Kleidung** steht früher in der Anweisung und wird ausdrücklich verlangt, gegen den häufig freien Oberkörper
- Neuer Schalter **„Freizügigkeit sperren (alles bedeckt)“** (Standard an): erzwingt Kleidung, die Oberkörper, Arme und Beine bedeckt. Wirkt auch beim eigenen Prompt

## 0.6.14
- Ist das Malen fertig, bleibt oben grün **„✓ Fertig: Bild gemalt“** mit der benötigten Zeit stehen, bis du draufklickst (springt in den Designer) oder es mit ✕ wegklickst. Ein neuer Malauftrag ersetzt die Meldung. Fehler bleiben genauso rot stehen

## 0.6.13
- Neues Bildmodell **Qwen Image 2.1 Turbo**: 8 statt 30–45 Schritte, also etwa 2 statt 7–10 Minuten, bei kaum schlechterer Qualität. Malen, Verfeinern mit Änderungswunsch und Mehrfachansicht funktionieren wie bei Qwen Image 2.1. Text-Modell und VAE werden geteilt, wer Qwen Image 2.1 schon hat, lädt nur noch ca. 13 GB
- Oben links steht jetzt der **Name des aktuellen Charakters** statt des Programmnamens (auch im Fenstertitel)

## 0.6.12
- KI-Maler: Der Token-Bereich ist vorerst entfernt und wird später neu gemacht. Die Bildvorschau bekommt dadurch mehr Platz

## 0.6.11
- KI-Malen und 3D-Erzeugen laufen weiter, wenn du den Reiter wechselst (z. B. zum KI-Berater oder Charakterbogen). Die Ergebnisse landen trotzdem beim richtigen Charakter
- **Anzeige oben in der Leiste** neben „Einstellungen“: „KI malt · 2:31“ bzw. „3D-Modell wird erzeugt“ mit Zeit und ✕ zum Abbrechen. Ein Klick darauf führt zurück in den Designer. Danach steht dort kurz „Bild fertig“ oder „Fehlgeschlagen“

## 0.6.10
- Einstellungen → KI: Knopf, um die **Windows-Zeitgrenze für den Grafiktreiber (TDR)** von 2 auf 60 Sekunden zu erhöhen (und wieder zurückzusetzen). Verhindert Treiber-Resets bei langen KI-Berechnungen. Windows fragt nach Administratorrechten, danach ist ein Neustart nötig

## 0.6.9
- **Abbrechen-Knopf** beim KI-Malen: Das laufende Bild wird sofort gestoppt und aus der Warteschlange genommen, ComfyUI bleibt dabei an. Klappt auch, wenn ComfyUI gerade noch startet
- Abbrechen auch beim 3D-Erzeugen mit TRELLIS

## 0.6.8
- Grafikkarten-Modus „Schonend“ deutlich vorsichtiger: Das neue „dynamische“ Laden von ComfyUI (Pinned Memory, asynchrone Auslagerung) ist abgeschaltet. Es lief bei dir trotz der Einstellung noch aktiv und ist der wahrscheinlichste Grund für die Treiber-Resets mit ROCm unter Windows. Außerdem läuft der VAE-Teil (Bild ↔ KI-Raum umrechnen) auf dem Prozessor, und Modelle werden nach Gebrauch aus der Grafikkarte entfernt
- Kennt ComfyUI eine dieser Optionen nicht, startet es automatisch ohne sie
- Das ComfyUI-Protokoll wird laufend in `comfyui.log` geschrieben, auch wenn ein Treiber-Absturz das Programm mitreißt

## 0.6.7
- Absturzmeldungen von ComfyUI ohne Farbcodes (besser lesbar)

## 0.6.6
- Neuer **Grafikkarten-Modus** (Einstellungen → KI), Standard „Schonend“: ComfyUI lässt 2,5 GB Grafikspeicher für Windows und den Treiber frei, lagert mehr in den Arbeitsspeicher aus und rechnet die Aufmerksamkeit in kleineren Stücken. Verhindert Treiber-Abstürze bei großen Modellen wie Qwen Image 2.1
- Im Modus „Schonend“ malt Qwen höchstens ca. 1 Megapixel. Höhere Auflösungen entstehen über den Hochskalierer
- „Ausgewogen“ und „Schnell“ sind für mehr Tempo wählbar

## 0.6.5
- **Ohne Internet bzw. ohne 5e.tools-Daten** startet das Programm jetzt trotzdem. Designer (KI-Maler, KI-Berater, 3D) und Einstellungen funktionieren, oben erscheint ein Hinweis mit „Erneut versuchen“. Nur Charakterbogen, Erstellung und Quellen warten auf die Daten
- Einmal geladene Daten werden wie bisher gespeichert und funktionieren danach auch offline

## 0.6.4
- Alle Internet-Abrufe (5e.tools-Daten, Homebrew, Updates, KI-Modelle, TRELLIS) laufen jetzt über den Netzwerk-Stack von Chromium statt über den von Node.js. Behebt „fetch failed“ und Zeitüberschreitungen auf Rechnern, auf denen der Browser problemlos ins Internet kommt (Proxy-Einstellungen, IPv6/DNS). Klappt das trotzdem nicht, wird automatisch der alte Weg probiert
- Fehlermeldungen nennen jetzt den Server, der nicht erreichbar war

## 0.6.3
- **Strata startet automatisch**: Wenn der KI-Berater das Textmodell braucht und Strata nicht läuft, startet das Programm es mit deinem gespeicherten Strata-Preset. Wird es eine einstellbare Zeit nicht genutzt (Standard 10 Minuten), beendet das Programm es wieder. Vor dem Malen wird es automatisch beendet, damit der Grafikspeicher frei ist. Ein Strata, das du selbst gestartet hast, wird nicht angefasst
- Einstellungen dazu unter KI-Berater → Verbindung
- Downloads (KI-Modelle, TRELLIS) laufen jetzt über den Netzwerk-Stack von Chromium und versuchen es bei Verbindungsabbrüchen oder Zeitüberschreitungen bis zu 5-mal erneut, mit Fortsetzung an der Abbruchstelle

## 0.6.2
- Test-Version, um die neue Update-Funktion aus 0.6.1 auszuprobieren (keine weiteren Änderungen)

## 0.6.1
- **Update-Funktion neu gebaut**, mit dem Standard-Updater für Electron-Programme (electron-updater). Das Installationsprogramm wird jetzt im Update-Modus gestartet. Der fehlte bisher, deshalb blieb die alte Version beim Deinstallieren hängen oder es passierte gar nichts
- Jeder Update-Schritt wird in `update.log` im Programmdaten-Ordner protokolliert
- Im Update-Fenster gibt es zusätzlich „Stattdessen manuell herunterladen“

## 0.6.0
- Neuer Tab **KI-Berater** im Designer: Chat mit deinem lokalen Textmodell (Strata oder jeder OpenAI-kompatible Server). Du beschreibst den Charakter, der Berater fragt nach und baut einen Bild-Prompt. „In KI-Maler übernehmen“ setzt ihn mit einem Klick ein. Optional gehen Infos aus dem Charakterbogen und das ausgewählte Bild mit
- KI-Maler: **Prompt-Quelle** wählbar. „Regler“ ist der bisherige Weg, „Eigener Prompt“ nimmt ein großes Textfeld, in das der Berater-Prompt kommt
- Qwen: Schritte wählbar (20/30/45, Standard jetzt 30)
- Bessere Absturzmeldungen: Fortschrittsbalken werden ausgefiltert, das komplette ComfyUI-Protokoll landet in einer Datei, und es gibt einen Hinweis, wenn Strata gleichzeitig Speicher belegt

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
