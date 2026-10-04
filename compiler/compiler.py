"""
Pytml compiler (v3.0.0)
=======================

Beginners write ordinary, *blocking-looking* Python:

    name = input("Your name? ")
    sleep(1)
    print("Hi", name)

A browser tab can never really block, so the compiler rewrites such code into
code that waits without freezing the page.  It looks at **every <py> block of
the page at once** and:

  1. finds every function that (directly or through other functions) uses a
     waiting call - input(), sleep(), pick(), wait_for(), time.sleep() ...
  2. turns those functions into `async def`,
  3. puts `await` in front of every call to them (also across blocks,
     also for methods, also inside comprehensions),
  4. leaves everything else untouched, with the original line numbers,
     so error messages still point at the line the user wrote.

The result is standard Python (an AST), so every Python library that works in
Pyodide keeps working: NumPy, Pandas, SciPy, scikit-learn, Matplotlib ...

This file has no browser dependency; it is unit-tested with plain CPython.
"""
import ast
import difflib
import keyword
import textwrap
import traceback

# Names that wait for the user / the clock.  They are provided by the Pytml
# runtime as coroutine functions, so every call must be awaited.
PRIMITIVES = {"input", "sleep", "pick", "wait_for", "fetch_text", "fetch_json"}

# Methods of the TensorFlow.js bridge that return promises.  Only considered
# when the page imports tensorflow.
TF_ASYNC_METHODS = {"fit", "fit_dataset", "evaluate_dataset", "load_layers_model", "save"}

MAYBE = "_pytml_maybe"   # runtime helper: await only if the value is awaitable


class PytmlCompileError(Exception):
    """A problem Pytml found before running the code (with a plain-English hint)."""

    def __init__(self, message, line=None, hint=None):
        super().__init__(message)
        self.line = line
        self.hint = hint


def clean_source(source):
    """Remove the indentation HTML adds around code and blank lines at the ends.

    Line 1 of the result is the first line of real code.
    """
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return textwrap.dedent("\n".join(lines))


def imports_of(tree):
    """Top-level module names imported anywhere in a tree."""
    found = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                found.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
            found.add(node.module.split(".")[0])
    return found


_SCOPES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)


def _walk_scope(roots):
    """Walk nodes without entering nested functions, lambdas or classes."""
    stack = list(roots)
    while stack:
        node = stack.pop()
        yield node
        for child in ast.iter_child_nodes(node):
            if not isinstance(child, _SCOPES):
                stack.append(child)


def _collect_defs(node, out, in_class=False):
    for child in ast.iter_child_nodes(node):
        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
            out.append((child, in_class))
            _collect_defs(child, out, False)
        elif isinstance(child, ast.ClassDef):
            _collect_defs(child, out, True)
        else:
            _collect_defs(child, out, in_class)


class Program:
    """All Python of one page.  Analyse once, then compile each block."""

    def __init__(self):
        self.trees = {}            # block name -> ast.Module
        self.errors = {}           # block name -> SyntaxError
        self.sources = {}          # block name -> cleaned source text
        self.async_ids = set()     # id() of function nodes that become async
        self.async_funcs = set()
        self.sync_funcs = set()
        self.async_methods = set()
        self.shadowed = set()      # primitives the user redefined themselves
        self.time_aliases = {"time"}
        self.uses_tf = False
        self._defs = []

    # ---- adding code ------------------------------------------------------
    def add_block(self, name, source):
        source = clean_source(source)
        self.sources[name] = source
        try:
            self.trees[name] = ast.parse(source, filename="<py %s>" % name)
        except SyntaxError as err:
            self.errors[name] = err
        return source

    # ---- analysis ---------------------------------------------------------
    def analyze(self):
        """Whole-page analysis.  Safe to call again after adding blocks."""
        self._defs = []
        self.shadowed = set()
        self.time_aliases = {"time"}
        self.uses_tf = False
        for tree in self.trees.values():
            _collect_defs(tree, self._defs)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in PRIMITIVES:
                    self.shadowed.add(node.name)
                elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store) and node.id in PRIMITIVES:
                    self.shadowed.add(node.id)
                elif isinstance(node, ast.Import):
                    for a in node.names:
                        if a.name == "time" and a.asname:
                            self.time_aliases.add(a.asname)
            if "tensorflow" in imports_of(tree):
                self.uses_tf = True

        self.async_ids = {id(n) for n, _ in self._defs if isinstance(n, ast.AsyncFunctionDef)}
        changed = True
        while changed:
            changed = False
            self._refresh_names()
            for node, _is_method in self._defs:
                if id(node) not in self.async_ids and self._needs_async(node):
                    self.async_ids.add(id(node))
                    changed = True
        self._refresh_names()

    def _refresh_names(self):
        self.async_funcs, self.sync_funcs, self.async_methods = set(), set(), set()
        for node, is_method in self._defs:
            is_async = id(node) in self.async_ids
            if is_method:
                if is_async:
                    self.async_methods.add(node.name)
            elif is_async:
                self.async_funcs.add(node.name)
            else:
                self.sync_funcs.add(node.name)

    def call_kind(self, call):
        """None | 'prim' | 'func' | 'maybe'  (does this call need an await?)"""
        f = call.func
        if isinstance(f, ast.Name):
            if f.id in PRIMITIVES and f.id not in self.shadowed:
                return "prim"
            if f.id in self.async_funcs:
                return "maybe" if f.id in self.sync_funcs else "func"
        elif isinstance(f, ast.Attribute):
            if f.attr == "sleep" and isinstance(f.value, ast.Name) and f.value.id in self.time_aliases:
                return "prim"
            if f.attr in self.async_methods:
                return "maybe"
            if self.uses_tf and f.attr in TF_ASYNC_METHODS:
                return "maybe"
        return None

    def _needs_async(self, fn):
        for node in _walk_scope(fn.body):
            if isinstance(node, ast.Call) and self.call_kind(node):
                return True
        return False

    # ---- compiling --------------------------------------------------------
    def transform(self, tree):
        new = _Transformer(self).visit(tree)
        return ast.fix_missing_locations(new)

    def compile_block(self, name):
        if name in self.errors:
            raise self.errors[name]
        tree = self.transform(self.trees[name])
        return compile(tree, "<py %s>" % name, "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)

    def compile_snippet(self, name, source):
        """Compile a small piece of code (an attribute such as py-click)."""
        source = clean_source(source)
        self.sources[name] = source
        tree = ast.parse(source, filename="<%s>" % name)
        tree = self.transform(tree)
        return compile(tree, "<%s>" % name, "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)


class _Transformer(ast.NodeTransformer):
    def __init__(self, program):
        self.prog = program
        self.ctx = ["module"]

    def _can_await(self):
        return self.ctx[-1] in ("module", "async")

    # functions -------------------------------------------------------------
    def _function(self, node):
        make_async = id(node) in self.prog.async_ids
        node.decorator_list = [self.visit(d) for d in node.decorator_list]
        node.args = self.visit(node.args)
        self.ctx.append("async" if make_async else "sync")
        node.body = [r for s in node.body for r in _as_list(self.visit(s))]
        self.ctx.pop()
        if make_async and isinstance(node, ast.FunctionDef):
            if node.name.startswith("__") and node.name.endswith("__"):
                raise PytmlCompileError(
                    "%s() cannot wait for the user" % node.name, node.lineno,
                    "Special methods like %s cannot use input(), pick() or sleep(). "
                    "Move that code into a normal method and call it yourself." % node.name)
            for sub in _walk_scope(node.body):
                if isinstance(sub, (ast.Yield, ast.YieldFrom)):
                    raise PytmlCompileError(
                        "%s() uses yield and also waits for the user" % node.name, node.lineno,
                        "A generator function cannot use input(), pick() or sleep(). "
                        "Collect the values in a list and return it instead.")
            new = ast.AsyncFunctionDef(
                name=node.name, args=node.args, body=node.body,
                decorator_list=node.decorator_list, returns=node.returns,
                type_comment=None, type_params=getattr(node, "type_params", []))
            return ast.copy_location(new, node)
        return node

    visit_FunctionDef = _function
    visit_AsyncFunctionDef = _function

    def visit_Lambda(self, node):
        self.ctx.append("lambda")
        self.generic_visit(node)
        self.ctx.pop()
        return node

    def visit_ClassDef(self, node):
        node.decorator_list = [self.visit(d) for d in node.decorator_list]
        node.bases = [self.visit(b) for b in node.bases]
        self.ctx.append("class")
        node.body = [r for s in node.body for r in _as_list(self.visit(s))]
        self.ctx.pop()
        return node

    # expressions -----------------------------------------------------------
    def visit_Await(self, node):
        if isinstance(node.value, ast.Call):
            node.value._pt_awaited = True
        self.generic_visit(node)
        return node

    def visit_Call(self, node):
        self.generic_visit(node)
        kind = self.prog.call_kind(node)
        if not kind or getattr(node, "_pt_awaited", False) or not self._can_await():
            return node
        if kind == "prim" and isinstance(node.func, ast.Attribute):   # time.sleep(x) -> sleep(x)
            node.func = ast.copy_location(ast.Name(id="sleep", ctx=ast.Load()), node.func)
        value = node
        if kind == "maybe":
            helper = ast.copy_location(ast.Name(id=MAYBE, ctx=ast.Load()), node)
            value = ast.copy_location(ast.Call(func=helper, args=[node], keywords=[]), node)
        return ast.copy_location(ast.Await(value=value), node)

    def visit_GeneratorExp(self, node):
        self.generic_visit(node)
        if any(isinstance(n, ast.Await) for n in ast.walk(node)):
            # an async generator cannot be consumed by sum(), join() ... so
            # evaluate it eagerly instead.
            return ast.copy_location(ast.ListComp(elt=node.elt, generators=node.generators), node)
        return node

    def visit_ImportFrom(self, node):
        if node.module == "time" and not node.level:
            node.names = [a for a in node.names if a.name != "sleep"]
            if not node.names:
                return ast.copy_location(ast.Pass(), node)
        return node


def _as_list(x):
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


# ---------------------------------------------------------------------------
# Friendly error messages
# ---------------------------------------------------------------------------
def hint_for(exc, namespace=None):
    """One plain-English sentence that helps a beginner fix the error."""
    msg = str(exc)
    if isinstance(exc, PytmlCompileError):
        return exc.hint
    if isinstance(exc, IndentationError):
        return ("Python uses spaces at the start of a line to group code. Lines inside "
                "if / for / def / while must be indented by the same amount (4 spaces is standard).")
    if isinstance(exc, SyntaxError):
        low = msg.lower()
        if "expected ':'" in low:
            return "A line that starts with if / elif / else / for / while / def / class must end with a colon ':'."
        if "was never closed" in low or "unmatched" in low or "closing parenthesis" in low:
            return "Every opening bracket ( [ { needs a matching closing one ) ] }. Check the line shown and the one before it."
        if "unterminated string" in low or "unterminated f-string" in low:
            return "A piece of text starts with a quote but never ends with one. Add the missing quote."
        if "perhaps you forgot a comma" in low:
            return "Items in a list, a call or a dictionary must be separated by commas."
        if "cannot assign to" in low or "maybe you meant '=='" in low:
            return "Use '==' to compare two things and '=' to store a value in a name."
        if "<" in msg or "&" in msg:
            return "If your code contains < or & inside a <py> tag, write it as &lt; and &amp; or use <script type=\"text/python\"> instead."
        return "Python could not read this line. Check for a missing colon, quote, bracket or comma."
    if isinstance(exc, NameError):
        name = getattr(exc, "name", None) or ""
        extra = ""
        if namespace and name:
            close = difflib.get_close_matches(name, [k for k in namespace if not k.startswith("_")], n=1)
            if close:
                extra = " Did you mean '%s'?" % close[0]
        return ("'%s' has no value yet. Create it first (name = ...), check the spelling "
                "(capital letters matter) and make sure the line that creates it runs before this one.%s" % (name, extra))
    if isinstance(exc, ZeroDivisionError):
        return "You divided by zero. Check the number you divide by - it should never be 0."
    if isinstance(exc, ModuleNotFoundError):
        name = getattr(exc, "name", "") or ""
        return ("The module '%s' is not available in the browser. Pytml tried to install it automatically but it "
                "is not a pure-Python package. Many libraries (numpy, pandas, scipy, matplotlib, scikit-learn ...) work; "
                "libraries that need a server, a GPU driver or a system library do not." % name)
    if isinstance(exc, ValueError):
        if "invalid literal for int()" in msg:
            return ("int() only accepts whole numbers written with digits, like '12'. What was given is not that "
                    "(maybe empty, has spaces, letters or a decimal point). For decimals use float().")
        if "could not convert string to float" in msg:
            return "float() only accepts numbers like '3.14'. The text given is not a number."
        if "not enough values to unpack" in msg or "too many values to unpack" in msg:
            return "You are splitting a collection into names, but the number of names does not match the number of items."
        return None
    if isinstance(exc, TypeError):
        if "can only concatenate str" in msg or ("unsupported operand" in msg and "str" in msg):
            return "You mixed text and numbers. Convert with str(number) or int(text), or use an f-string: f\"value: {x}\"."
        if "NoneType" in msg:
            return "A value is None (nothing). A function without 'return' gives None - check where this value came from."
        if "not callable" in msg:
            return "You put () after something that is not a function. Check for a name that is used as both a variable and a function."
        if "positional argument" in msg:
            return "The number of values given to the function does not match what it expects. Check the function's def line."
        if "not subscriptable" in msg:
            return "You used [ ] on something that is not a list, string or dictionary."
        return None
    if isinstance(exc, IndexError):
        return "You asked for an item position that does not exist. Positions start at 0 and end at len(list) - 1."
    if isinstance(exc, KeyError):
        return "That key is not in the dictionary. Use dict.get(key) to avoid the error, or check the spelling of the key."
    if isinstance(exc, AttributeError):
        return "That object has no such attribute or method. Check the spelling and the type of the object (use type(x))."
    if isinstance(exc, FileNotFoundError):
        return "Python in the browser cannot see files on your computer. Fetch a file from a URL or create it first."
    if isinstance(exc, RecursionError):
        return "A function kept calling itself and never stopped. Make sure it has a condition that ends the recursion."
    if isinstance(exc, EOFError):
        return "input() was cancelled."
    return None


def format_error(exc, namespace=None):
    """Short, readable traceback that only shows the user's own lines."""
    if isinstance(exc, PytmlCompileError):
        lines = ["Problem in your code" + (" (line %d)" % exc.line if exc.line else ""), str(exc)]
    elif isinstance(exc, SyntaxError):
        where = (exc.filename or "").strip("<>").replace("py ", "block ")
        lines = ["Python could not read your code (%s, line %s):" % (where or "code", exc.lineno or "?")]
        if exc.text:
            lines.append("    " + exc.text.strip())
        lines.append("%s: %s" % (type(exc).__name__, exc.msg))
    else:
        lines = ["Traceback (most recent call last):"]
        for fr in traceback.extract_tb(exc.__traceback__):
            if not fr.filename.startswith(("<py ", "<py-")):
                continue
            where = fr.filename.strip("<>").replace("py ", "block ")
            lines.append("  %s, line %s%s" % (where, fr.lineno, "" if fr.name == "<module>" else ", in " + fr.name))
            if fr.line:
                lines.append("    " + fr.line.strip())
        lines.append("".join(traceback.format_exception_only(type(exc), exc)).rstrip())
    hint = hint_for(exc, namespace)
    if hint:
        lines.append("Hint: " + hint)
    return "\n".join(lines)
