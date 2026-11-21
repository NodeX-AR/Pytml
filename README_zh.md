# PYTML - 在浏览器中运行 Python

[![Wikidata](https://img.shields.io/badge/Wikidata-Q140185675-006699?logo=wikidata&logoColor=white)](https://www.wikidata.org/wiki/Q140185675)
[![Number of times Pytml used](https://img.shields.io/endpoint?url=https://pytml.vercel.app/api/count)](https://pytml.vercel.app/api/count)
[![Website](https://img.shields.io/badge/🌐%20Website-pytml.js.org-3b82f6?style=for-the-badge&logo=google-chrome&logoColor=white)](https://pytml.js.org/)
[![GitHub stars](https://img.shields.io/badge/⭐%20Star%20on%20GitHub-yellow?style=for-the-badge&logo=github&logoColor=black)](https://github.com/NodeX-AR/Pytml)
[![License](https://img.shields.io/github/license/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/commits/main)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15994/badge)](https://www.bestpractices.dev/projects/15994)

---
[English (英语)](README.md) | [日本語 (日本人)](README_ja.md) | [Deutsch (德语)](README_de.md) | 简体中文
---

**零配置，在浏览器中运行 Python——无需服务器，只需一个 script 标签。**

Pytml 2.5 是一个基于 **Pyodide 314.0.7** 的轻量级 JavaScript 桥接库。你可以直接在 HTML 中编写 Python,操作普通的 DOM 元素,并使用 2.5 运行时支持的简易编号式 UI 语法。

> Pyodide 官方相关项目。感谢 Pyodide 团队的支持!

---

## 快速开始

只需在 HTML 中添加一行:

```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```

然后编写 Python:

```html
<py>
print("Hello, world!")
name = input("Your name? ")
print(f"Hi {name}!")
</py>
```

`<py>` 标签中的内容会作为 Python 代码运行。`print()` 的输出会显示在页面上,`input()` 则以浏览器输入的方式工作。

## Pytml 2.5 UI 语法

在 `<pyN>` 块(如 `<py1>`、`<py2>`)内,Pytml 2.5 能识别如下带编号的 UI 标签:

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

- `<btnN>` 会变成真正的 `<button id="btnN">`。
- `<inputN>` 和 `<txtN>` 会变成真正的文本输入框。
- 在源代码传给 Pyodide 之前,Python 的缩进会被保留。
- 生成的元素可以通过 ID 访问(上例中通过 `btn1.on("click", show)` 为 `btn1` 绑定了点击事件)。

## 普通 HTML + Python

普通 HTML 元素的 ID 可以直接在 Python 中使用:

```html
<button id="hello">Click me</button>
<p id="result"></p>

<py>
def hello(event):
    result.text = "Hello from Python!"

hello.on("click", hello)
</py>
```

HTML 元素的 `id` 会在 Python 中成为同名变量。修改文本使用 `.text`,注册事件使用 `.on("事件名", 函数)`。

## 软件包

Pytml 保留了 Pyodide 的软件包工作流程,包括 `micropip`:

```python
import micropip
await micropip.install("numpy")

import numpy as np
print(np.mean([1, 2, 3]))
```

Pyodide 环境中可用的软件包都可以在 Pytml 中使用,包括 NumPy、pandas 和 Matplotlib 等常见的科学计算包。

## 多个程序

`<py1>`、`<py2>`、`<py3>` 等是**标识符**,而不是文件名。**具有相同标识符的块属于同一个程序**:

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

在上面的示例中,两个 `<py1>` 块属于同一个程序,因此第二个块可以使用第一个块中定义的 `x`。`<py2>` 则作为独立的另一个程序运行。

## 本地文件

当 Python 代码以内联方式编写时,Pytml 支持通过 `file://` 直接打开的本地 HTML 文件:

```html
<script src="https://pytml.vercel.app/pytml.js"></script>

<py>
print("Hello from a local file!")
</py>
```

这种情况下不需要 Python Web 服务器。你也可以使用 `pytml.js` 的本地副本配合 `file://`,只需将 script 的 src 改为 `./pytml.js`。

注意:由于浏览器的安全限制,普通的浏览器 JavaScript 无法通过 `file://` 获取 `<py src="app.py">` 这样的相对路径外部 Python 文件。此时请使用内联 Python,或使用 HTTPS 的 Python 源 URL。

可直接打开的示例请参见 `local-file-test.html`。

## 功能特性

- 零配置——只需一个 script 标签
- 在 HTML 中编写 Python
- DOM 交互
- 浏览器中的 `input()`
- 带编号的内联 UI 控件
- 鼠标、指针、触摸、键盘和滚动事件
- 摇杆和游戏手柄辅助功能
- Canvas、音频和视频辅助功能
- 剪贴板、存储、下载和全屏辅助功能
- 通过 `micropip` 支持软件包
- 通过 Pyodide 环境支持 NumPy、pandas 和 Matplotlib
- 隐私优先的客户端执行(代码在用户的浏览器中运行)

## 链接

官方网站 → https://pytml.js.org/

演示 → https://pytml.js.org/demo.html

GitHub → https://github.com/NodeX-AR/Pytml

## 许可证

Pytml 基于 Apache 2.0 许可证开源。

## 支持

**如果你觉得 Pytml 有用,欢迎在 GitHub 上给它点个 Star!**

## 安全说明

Pytml 默认使用 `element.text`,它采用浏览器的 `textContent` API。这意味着它能 100% 防御***跨站脚本(XSS)攻击***。
如果你必须使用 `element.html` 来渲染原始 HTML,切勿将不受信任的用户输入直接传入。请先使用内置的 `pytml.escape()` 辅助函数对输入进行转义处理。

---

补充说明:原 README 中“普通 HTML + Python”的示例里,函数名和元素 ID 都叫 `hello`。实际使用时,建议把函数改名为 `on_hello` 等,以避免命名冲突。
