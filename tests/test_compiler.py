"""Unit tests for the Pytml compiler.  Plain CPython, no browser:  python3 tests/test_compiler.py"""
import ast
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "compiler"))
import compiler as C  # noqa: E402


def build(*blocks):
    p = C.Program()
    for i, src in enumerate(blocks, 1):
        p.add_block(str(i), src)
    p.analyze()
    return p


def out(p, i=1):
    return ast.unparse(p.transform(p.trees[str(i)]))


class AsyncInference(unittest.TestCase):
    def test_input_makes_function_async_and_call_awaited(self):
        p = build("def f():\n    return input('x')\nf()")
        text = out(p)
        self.assertIn("async def f", text)
        self.assertIn("await input('x')", text)
        self.assertIn("await f()", text)

    def test_transitive(self):
        p = build("def a():\n    return input()\ndef b():\n    return a()\ndef c():\n    return b()\nc()")
        self.assertEqual(p.async_funcs, {"a", "b", "c"})

    def test_pure_function_untouched(self):
        p = build("def f(x):\n    return x + 1\nprint(f(1))")
        self.assertNotIn("async", out(p))
        self.assertNotIn("await", out(p))

    def test_across_blocks(self):
        p = build("def ask():\n    return input()", "x = ask()")
        self.assertIn("await ask()", out(p, 2))

    def test_methods_use_maybe_await(self):
        p = build("class A:\n    def go(self):\n        return pick('a', 'b')\nA().go()")
        self.assertIn("await _pytml_maybe(A().go())", out(p))
        self.assertIn("async def go", out(p))

    def test_sleep_forms(self):
        p = build("import time\nfrom time import sleep\ntime.sleep(1)\nsleep(2)")
        text = out(p)
        self.assertIn("await sleep(1)", text)
        self.assertIn("await sleep(2)", text)
        self.assertNotIn("time.sleep", text)
        self.assertNotIn("from time", text)

    def test_generator_expression_becomes_list(self):
        p = build("def n():\n    return int(input())\nprint(sum(n() for _ in range(2)))")
        self.assertIn("sum([await n() for _ in range(2)])", out(p))

    def test_lambda_is_left_alone_so_callbacks_work(self):
        p = build("def f():\n    return input()\ncb = lambda: f()")
        self.assertIn("lambda: f()", out(p))

    def test_user_shadowing_of_primitive(self):
        p = build("def pick(x):\n    return x\nprint(pick(1))")
        self.assertNotIn("await", out(p))

    def test_existing_await_not_doubled(self):
        p = build("async def f():\n    return await sleep(1)\nasync def g():\n    await f()")
        self.assertEqual(out(p).count("await f()"), 1)

    def test_dunder_methods_cannot_wait(self):
        p = build("class A:\n    def __init__(self):\n        self.x = input()")
        with self.assertRaises(C.PytmlCompileError):
            out(p)

    def test_line_numbers_are_kept(self):
        p = build("def f():\n\n    x = input()\n    return 1/0\nf()")
        tree = p.transform(p.trees["1"])
        lines = sorted({n.lineno for n in ast.walk(tree) if hasattr(n, "lineno")})
        self.assertEqual(lines, [1, 3, 4, 5])

    def test_compiles_to_runnable_code(self):
        import asyncio, inspect
        p = build("def f(x):\n    return input(x) + '!'\nresult = f('q')")
        code = p.compile_block("1")
        ns = {}

        async def fake_input(msg):
            await asyncio.sleep(0)
            return "answer-" + msg
        ns["input"] = fake_input
        res = eval(code, ns)
        self.assertTrue(inspect.isawaitable(res))
        asyncio.run(res)
        self.assertEqual(ns["result"], "answer-q!")


class Helpers(unittest.TestCase):
    def test_clean_source(self):
        self.assertEqual(C.clean_source("\n      a = 1\n      if a:\n          b = 2\n    "), "a = 1\nif a:\n    b = 2")
        self.assertEqual(C.clean_source("print(1)"), "print(1)")

    def test_imports(self):
        tree = ast.parse("import numpy as np\nfrom sklearn.linear_model import X\nimport os.path")
        self.assertEqual(C.imports_of(tree), {"numpy", "sklearn", "os"})

    def test_hints(self):
        self.assertIn("divided by zero", C.hint_for(ZeroDivisionError()))
        self.assertIn("int()", C.hint_for(ValueError("invalid literal for int() with base 10: 'x'")))
        self.assertIn("text and numbers", C.hint_for(TypeError('can only concatenate str (not "int") to str')))
        self.assertIsNone(C.hint_for(Exception("weird")))
        try:
            ast.parse("if x\n  pass")
        except SyntaxError as e:
            self.assertIn("colon", C.hint_for(e))

    def test_name_error_suggestion(self):
        e = NameError("name 'nmae' is not defined", name="nmae")
        self.assertIn("name", C.hint_for(e, {"name": 1}))


if __name__ == "__main__":
    unittest.main(verbosity=1)
