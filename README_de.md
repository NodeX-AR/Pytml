# PYTML – Python im Browser

[![Wikidata](https://img.shields.io/badge/Wikidata-Q140185675-006699?logo=wikidata&logoColor=white)](https://www.wikidata.org/wiki/Q140185675)
[![Number of times Pytml used](https://img.shields.io/endpoint?url=https://pytml.vercel.app/api/count)](https://pytml.vercel.app/api/count)
[![Website](https://img.shields.io/badge/🌐%20Website-pytml.js.org-3b82f6?style=for-the-badge&logo=google-chrome&logoColor=white)](https://pytml.js.org/)
[![GitHub stars](https://img.shields.io/badge/⭐%20Star%20on%20GitHub-yellow?style=for-the-badge&logo=github&logoColor=black)](https://github.com/NodeX-AR/Pytml)
[![License](https://img.shields.io/github/license/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/commits/main)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15994/badge)](https://www.bestpractices.dev/projects/15994)


---
[English](README.md) | [日本語 (Japanese)](README_ja.md) | Deutsch | [简体中文 (Chinese)](README_zh.md)
---

**Python im Browser ausführen – ohne Konfiguration, ohne Server, nur ein Script-Tag.**

Pytml 2.5 ist eine leichtgewichtige JavaScript-Brücke auf Basis von **Pyodide 314.0.7**. Schreiben Sie Python direkt in HTML, arbeiten Sie mit gewöhnlichen DOM-Elementen und nutzen Sie die kleine nummerierte UI-Syntax, die die 2.5-Laufzeitumgebung unterstützt.

> Offizielles Pyodide-Related-Project. Vielen Dank an das Pyodide-Team für die Unterstützung!

---

## Schnellstart

Fügen Sie Ihrem HTML eine einzige Zeile hinzu:

```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```

Schreiben Sie dann Python:

```html
<py>
print("Hello, world!")
name = input("Your name? ")
print(f"Hi {name}!")
</py>
```

Der Inhalt des `<py>`-Tags wird als Python-Code ausgeführt. Die Ausgabe von `print()` wird auf der Seite angezeigt, und `input()` funktioniert als Eingabe im Browser.

## Pytml-2.5-UI-Syntax

Innerhalb eines `<pyN>`-Blocks (z. B. `<py1>`, `<py2>`) erkennt Pytml 2.5 nummerierte UI-Tags wie diese:

```html
<py1>

<btn1>1</btn1>
<btn2>2</btn2>
<txt1>

def show(e):
    print("You clicked a button")

btn1.on("click", show)

</py1>
```

- `<btnN>` wird zu einem echten `<button id="btnN">`.
- `<inputN>` und `<txtN>` werden zu echten Texteingabefeldern.
- Die Python-Einrückung bleibt erhalten, bevor der Quelltext an Pyodide übergeben wird.
- Die erzeugten Elemente sind über ihre ID ansprechbar (im Beispiel oben wird `btn1` mit `.on("click", show)` ein Klick-Ereignis zugewiesen).

## Normales HTML + Python

Gewöhnliche HTML-IDs stehen Python direkt zur Verfügung:

```html
<button id="hello">Click me</button>
<p id="result"></p>

<py>
def hello(event):
    result.text = "Hello from Python!"

hello.on("click", hello)
</py>
```

Die `id` eines HTML-Elements steht in Python als gleichnamige Variable zur Verfügung. Um Text zu ändern, verwenden Sie `.text`; Ereignisse registrieren Sie mit `.on("Ereignisname", Funktion)`.

## Pakete

Pytml übernimmt den Pyodide-Paket-Workflow, einschließlich `micropip`:

```python
import micropip
await micropip.install("numpy")

import numpy as np
print(np.mean([1, 2, 3]))
```

Alle in der Pyodide-Umgebung verfügbaren Pakete können auch in Pytml verwendet werden, darunter gängige wissenschaftliche Pakete wie NumPy, pandas und Matplotlib.

## Mehrere Programme

`<py1>`, `<py2>`, `<py3>` usw. sind **Bezeichner**, keine Dateinamen. **Blöcke mit demselben Bezeichner gehören zum selben Programm:**

```html
<py1>
x = 10
</py1>

<py1>
print(x)
</py1>

<py2>
print("Another program")
</py2>
```

Im Beispiel gehören die beiden `<py1>`-Blöcke zum selben Programm, sodass das im ersten Block definierte `x` im zweiten verwendet werden kann. `<py2>` läuft als eigenständiges, separates Programm.

## Lokale Dateien

Pytml unterstützt lokale HTML-Dateien, die direkt über `file://` geöffnet werden, sofern der Python-Code inline steht:

```html
<script src="https://pytml.vercel.app/pytml.js"></script>

<py>
print("Hello from a local file!")
</py>
```

Für diesen Fall ist kein Python-Webserver erforderlich. Sie können auch eine lokale Kopie von `pytml.js` mit `file://` verwenden, indem Sie die Script-Quelle auf `./pytml.js` ändern.

Eine relative externe Python-Datei wie `<py src="app.py">` kann aufgrund von Browser-Sicherheitsbeschränkungen von normalem Browser-JavaScript nicht über `file://` abgerufen werden. Verwenden Sie in diesem Fall Inline-Python oder eine HTTPS-URL für die Python-Quelle.

Ein sofort ausführbares Beispiel finden Sie in `local-file-test.html`.

## Funktionen

- Keine Konfiguration – nur ein Script-Tag
- Python in HTML
- DOM-Interaktion
- `input()` im Browser
- Nummerierte Inline-UI-Steuerelemente
- Maus-, Pointer-, Touch-, Tastatur- und Scroll-Ereignisse
- Joystick- und Gamepad-Hilfsfunktionen
- Canvas-, Audio- und Video-Hilfsfunktionen
- Hilfsfunktionen für Zwischenablage, Speicher, Downloads und Vollbildmodus
- Paketunterstützung über `micropip`
- Unterstützung für NumPy, pandas und Matplotlib über die Pyodide-Umgebung
- Datenschutzorientierte clientseitige Ausführung (der Code läuft im Browser der Nutzer)

## Links

Offizielle Website → https://pytml.js.org/

Demos → https://pytml.js.org/demo.html

GitHub → https://github.com/NodeX-AR/Pytml

## Lizenz

Pytml ist Open Source unter der Apache-2.0-Lizenz.

## Unterstützung

**Wenn Sie Pytml nützlich finden, geben Sie dem Projekt gern einen Stern auf GitHub!**

## Sicherheitshinweis

Pytml verwendet standardmäßig `element.text`, das die `textContent`-API des Browsers nutzt. Dadurch ist es zu 100 % sicher gegen ***Cross-Site-Scripting-(XSS)-Angriffe***.
Falls Sie `element.html` verwenden müssen, um rohes HTML darzustellen, übergeben Sie niemals nicht vertrauenswürdige Benutzereingaben direkt. Bereinigen Sie die Eingabe zuerst mit der eingebauten Hilfsfunktion `pytml.escape()`.

---

Hinweis: Im Beispiel „Normales HTML + Python“ sind Funktions- und Element-ID-Name identisch (`hello`). In der Praxis empfiehlt es sich, die Funktion z. B. `on_hello` zu nennen, um Namenskonflikte zu vermeiden.
