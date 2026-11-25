# PYTML - ブラウザで動くPython

[![Wikidata](https://img.shields.io/badge/Wikidata-Q140185675-006699?logo=wikidata&logoColor=white)](https://www.wikidata.org/wiki/Q140185675)
[![Website](https://img.shields.io/badge/🌐%20Website-pytml.js.org-3b82f6?style=for-the-badge&logo=google-chrome&logoColor=white)](https://pytml.js.org/)
[![GitHub stars](https://img.shields.io/badge/⭐%20Star%20on%20GitHub-yellow?style=for-the-badge&logo=github&logoColor=black)](https://github.com/NodeX-AR/Pytml)
[![License](https://img.shields.io/github/license/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/commits/main)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15994/badge)](https://www.bestpractices.dev/projects/15994) 

---
[English (英語)](README.md) | 日本語 | [Deutsch (ドイツ語)](README_de.md) | [简体中文 (中国語)](README_zh.md)
---

**設定不要でブラウザ上でPythonを実行 ― サーバーは不要、scriptタグ1行だけです。**

Pytml 2.5は、**Pyodide 314.0.7** をベースにした軽量なJavaScriptブリッジです。HTMLの中にPythonを書き、通常のDOM要素を操作でき、2.5ランタイムが対応する番号付きの簡易UI構文も使えます。

> **Pyodide公式の関連プロジェクトです。サポートしてくださったPyodideチームに感謝します。**  
> **Ditampilake ing [Python Weekly Edisi 772](https://www.pythonweekly.com/p/python-weekly-issue-772-november-19-2026)!**

---

## クイックスタート

HTMLに次の1行を追加します。

```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```

あとはPythonを書くだけです。

```html
<py>
print("Hello, world!")
name = input("Your name? ")
print(f"Hi {name}!")
</py>
```

`<py>` タグの中がPythonコードとして実行されます。`print()` の出力は画面に表示され、`input()` はブラウザ上の入力として動作します。

## Pytml 2.5 のUI構文

`<pyN>` ブロック(`<py1>`、`<py2>` など)の中では、Pytml 2.5は次のような番号付きUIタグを認識します。

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

- `<btnN>` は、実際の `<button id="btnN">` に変換されます。
- `<inputN>` と `<txtN>` は、実際のテキスト入力欄に変換されます。
- Pythonのインデントは、ソースコードがPyodideに渡される前に保持されます。
- 変換された要素はIDで参照できます(上の例では `btn1` に `.on("click", show)` でクリックイベントを登録しています)。

## 通常のHTML + Python

通常のHTMLのIDも、そのままPythonから使えます。

```html
<button id="hello">Click me</button>
<p id="result"></p>

<py>
def hello(event):
    result.text = "Hello from Python!"

hello.on("click", hello)
</py>
```

HTML要素に付けた `id` が、Pythonの中で同名の変数として使えます。テキストを変更するには `.text` を使い、イベントは `.on("イベント名", 関数)` で登録します。

## パッケージ

Pytmlは、`micropip` を含むPyodideのパッケージの仕組みをそのまま利用できます。

```python
import micropip
await micropip.install("numpy")

import numpy as np
print(np.mean([1, 2, 3]))
```

Pyodide環境で利用できるパッケージは、Pytmlからも使えます。NumPy、pandas、Matplotlibなどの代表的な科学計算パッケージも含まれます。

## 複数のプログラム

`<py1>`、`<py2>`、`<py3>` ……は、ファイル名ではなく**識別子**です。**同じ識別子を持つブロックは、同じプログラムに属します**。

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

上の例では、2つの `<py1>` ブロックは同じプログラムなので、1つ目で定義した `x` を2つ目で使えます。`<py2>` は別のプログラムとして独立して動作します。

## ローカルファイル

Pythonコードがインラインで書かれている場合、`file://` で直接開いたローカルのHTMLファイルでもPytmlは動作します。

```html
<script src="https://pytml.vercel.app/pytml.js"></script>

<py>
print("Hello from a local file!")
</py>
```

この場合、PythonのWebサーバーは不要です。`pytml.js` のローカルコピーを使う場合は、scriptタグのsrcを `./pytml.js` に変更すれば、`file://` でも利用できます。

なお、`<py src="app.py">` のような相対パスの外部Pythonファイルは、ブラウザのセキュリティ制限により、通常のブラウザJavaScriptでは `file://` から読み込めません。その場合は、インラインのPythonか、HTTPSのPythonソースURLを使用してください。

すぐに開ける例として `local-file-test.html` を参照してください。

## 機能

- 設定不要 ― scriptタグ1つだけ
- HTMLの中でPythonを記述
- DOM操作
- ブラウザ上での `input()`
- 番号付きのインラインUIコントロール
- マウス、ポインター、タッチ、キーボード、スクロールの各イベント
- ジョイスティックとゲームパッドのヘルパー
- Canvas、オーディオ、ビデオのヘルパー
- クリップボード、ストレージ、ダウンロード、フルスクリーンのヘルパー
- `micropip` によるパッケージ対応
- Pyodide環境を通じたNumPy、pandas、Matplotlibの対応
- プライバシー重視のクライアントサイド実行(コードはユーザーのブラウザ内で実行されます)

## リンク

公式サイト → https://pytml.js.org/

デモ → https://pytml.js.org/demo.html

GitHub → https://github.com/NodeX-AR/Pytml

## ライセンス

PytmlはApache 2.0ライセンスのオープンソースです。

## サポート

**Pytmlが役に立ったら、ぜひGitHubでスターをお願いします!**

## セキュリティに関する注意

Pytmlは、デフォルトで `element.text` を使用します。これはブラウザの `textContent` APIを利用するもので、***クロスサイトスクリプティング(XSS)攻撃*** に対して100%安全です。
どうしても生のHTMLを表示するために `element.html` を使う場合は、信頼できないユーザー入力を直接渡さないでください。まず、組み込みの `pytml.escape()` ヘルパーで入力をサニタイズ(無害化)してから使用してください。

---

補足: 元のREADMEの「通常のHTML + Python」の例では、関数名と要素ID(どちらも `hello`)が同じになっています。実際に使うときは、関数名を `on_hello` などに変えると、名前の衝突を避けられます。

必要でしたら、この翻訳をMarkdownファイルにしてお渡しすることもできます。
