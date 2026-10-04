"""
`import tensorflow as tf` for Pytml.

The Python `tensorflow` wheel cannot run in a browser (it is a huge native
library).  Pytml therefore loads TensorFlow.js and exposes it through this
module, so the code you write looks like TensorFlow / Keras:

    import tensorflow as tf
    model = tf.keras.Sequential([tf.keras.layers.Dense(1, input_shape=[1])])
    model.compile(optimizer="sgd", loss="mse")
    model.fit([[0], [1], [2], [3]], [[-1], [1], [3], [5]], epochs=200, verbose=0)
    print(model.predict([[10]]).numpy())

Rules: snake_case names become camelCase, keyword arguments become the options
object, lists / NumPy arrays become tensors, Promises are awaited for you.
This runs in the browser (WebGL / WASM / CPU backend of TensorFlow.js).
"""
import js
from pyodide.ffi import create_proxy, to_js

_PYTML_BRIDGE = True
_tf = js.tf

_LOSSES = {
    "mse": "meanSquaredError", "mean_squared_error": "meanSquaredError",
    "mae": "meanAbsoluteError", "mean_absolute_error": "meanAbsoluteError",
    "binary_crossentropy": "binaryCrossentropy",
    "categorical_crossentropy": "categoricalCrossentropy",
    "sparse_categorical_crossentropy": "sparseCategoricalCrossentropy",
}
_ALIASES = {  # TensorFlow name -> TensorFlow.js name
    "constant": "tensor", "Variable": "variable", "reduce_sum": "sum", "reduce_mean": "mean",
    "reduce_max": "max", "reduce_min": "min", "reduce_prod": "prod", "argmax": "argMax", "argmin": "argMin",
    "matmul": "matMul", "keras": None, "math": None, "nn": None, "random": None, "linalg": None,
}
_NAMESPACES = {"math", "nn", "linalg"}
_POSITIONAL = {"axis": 0, "keepdims": 1, "keep_dims": 1}       # for sum/mean/max/min/prod/argMax ...
_TENSOR_ARGS = {"fit", "predict", "evaluate"}                   # model methods whose arrays become tensors


def _camel(name):
    if name.startswith("_") or "_" not in name:
        return name
    head, *rest = name.split("_")
    return head + "".join(p[:1].upper() + p[1:] for p in rest)


def _to_js_value(x):
    if isinstance(x, Wrapper):
        return x._obj
    if hasattr(x, "tolist") and not isinstance(x, (str, bytes)):
        x = x.tolist()
    if isinstance(x, (list, tuple)):
        return to_js([_to_js_value(i) for i in x])
    if isinstance(x, dict):
        return js.Object.fromEntries(to_js([[_camel(str(k)), _to_js_value(v)] for k, v in x.items()]))
    if callable(x):
        return create_proxy(x)
    return x


def _options(kwargs):
    out = {}
    for k, v in kwargs.items():
        if k in ("loss", "metrics") and isinstance(v, str):
            v = _LOSSES.get(v, v)
        out[_camel(k)] = v
    return _to_js_value(out)


def _is_listlike(x):
    return isinstance(x, (list, tuple)) or (hasattr(x, "tolist") and not isinstance(x, (str, bytes)))


def _wrap(v):
    """JavaScript value -> Python value."""
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    if hasattr(v, "then") and callable(getattr(v, "then", None)):
        async def resolved():
            return _wrap(await v)
        return resolved()
    if hasattr(v, "dataSync") and hasattr(v, "shape"):
        return Tensor(v)
    if hasattr(v, "to_py") and getattr(v, "constructor", None) is not None and str(v.constructor.name) == "Array":
        return [_wrap(i) for i in v]
    return Wrapper(v)


class Wrapper:
    """Any TensorFlow.js object (model, layer, optimizer, history ...)."""

    def __init__(self, obj, name=""):
        object.__setattr__(self, "_obj", obj)
        object.__setattr__(self, "_name", name)

    def __getattr__(self, name):
        if name.startswith("__"):
            raise AttributeError(name)
        obj = self._obj
        js_name = name
        alias = _ALIASES.get(name, name)
        if alias is None:                         # tf.keras / tf.math / tf.nn / tf.random namespaces
            return Wrapper(obj, name) if name == "random" else self._namespace(name)
        value = getattr(obj, alias, None)
        if value is None:
            value = getattr(obj, _camel(alias), None)
            js_name = _camel(alias)
        if value is None and getattr(self, "_name", "") == "random":
            value = getattr(js.tf, "random" + name[:1].upper() + _camel(name)[1:], None)
        if value is None:
            raise AttributeError("TensorFlow.js has no '%s'" % name)
        if callable(value):
            return self._caller(value, js_name)
        return _wrap(value)

    def _namespace(self, name):
        if name in _NAMESPACES:
            return self
        return _Keras()

    def _caller(self, fn, name):
        def call(*args, **kwargs):
            js_args = []
            for a in args:
                if name in _TENSOR_ARGS and _is_listlike(a):
                    a = _tf.tensor(_to_js_value(a))
                js_args.append(_to_js_value(a))
            if kwargs:
                positional = {k: v for k, v in kwargs.items() if k in _POSITIONAL}
                config = {k: v for k, v in kwargs.items() if k not in _POSITIONAL}
                for k, v in sorted(positional.items(), key=lambda kv: _POSITIONAL[kv[0]]):
                    while len(js_args) < _POSITIONAL[k]:
                        js_args.append(None)
                    js_args.append(_to_js_value(v))
                if config:
                    js_args.append(_options(config))
            return _wrap(fn(*js_args))
        return call

    def __repr__(self):
        return "<TensorFlow.js %s>" % (getattr(self._obj, "constructor", None) and self._obj.constructor.name or "object")


class Tensor(Wrapper):
    def __init__(self, t):
        super().__init__(t)

    @property
    def shape(self):
        return tuple(self._obj.shape)

    @property
    def dtype(self):
        return str(self._obj.dtype)

    def numpy(self):
        data = self._obj.arraySync()
        data = data.to_py() if hasattr(data, "to_py") else data
        try:
            import numpy as np
            return np.array(data)
        except ImportError:
            return data

    def tolist(self):
        data = self._obj.arraySync()
        return data.to_py() if hasattr(data, "to_py") else data

    def __float__(self):
        return float(self._obj.dataSync()[0])

    def __int__(self):
        return int(self._obj.dataSync()[0])

    def __len__(self):
        return self.shape[0]

    def __iter__(self):
        return iter(self.tolist())

    def __repr__(self):
        return "tf.Tensor(%s, shape=%s, dtype=%s)" % (self.tolist(), self.shape, self.dtype)

    def _binary(self, op, other, reverse=False):
        a, b = (_tensor(other), self) if reverse else (self, other)
        return _wrap(getattr(_tf, op)(_to_js_value(a), _to_js_value(b)))

    def __add__(self, o): return self._binary("add", o)
    def __radd__(self, o): return self._binary("add", o, True)
    def __sub__(self, o): return self._binary("sub", o)
    def __rsub__(self, o): return self._binary("sub", o, True)
    def __mul__(self, o): return self._binary("mul", o)
    def __rmul__(self, o): return self._binary("mul", o, True)
    def __truediv__(self, o): return self._binary("div", o)
    def __rtruediv__(self, o): return self._binary("div", o, True)
    def __matmul__(self, o): return self._binary("matMul", o)
    def __pow__(self, o): return self._binary("pow", o)
    def __neg__(self): return _wrap(_tf.neg(self._obj))


def _tensor(x):
    return x if isinstance(x, Tensor) else _wrap(_tf.tensor(_to_js_value(x)))


class _Keras(Wrapper):
    """tf.keras - Keras names on top of TensorFlow.js."""

    def __init__(self, path=""):
        object.__setattr__(self, "_obj", _tf)
        object.__setattr__(self, "_name", path)

    def __getattr__(self, name):
        path = self._name + "." + name if self._name else name
        if path == "Sequential":
            return lambda layers=None, **kw: _wrap(_tf.sequential(_options({"layers": layers or []})))
        if path == "Model":
            return lambda **kw: _wrap(_tf.model(_options(kw)))
        if path in ("layers", "optimizers", "losses", "metrics", "models", "activations", "utils"):
            return _Keras(path)
        if self._name == "layers":
            fn = getattr(_tf.layers, name[:1].lower() + name[1:], None)
            if fn is None:
                raise AttributeError("TensorFlow.js has no layer '%s'" % name)

            def layer(*args, **kwargs):
                if args and "units" not in kwargs and name in ("Dense",):
                    kwargs["units"] = args[0]
                    args = args[1:]
                return _wrap(fn(_options(kwargs)))
            return layer
        if self._name == "optimizers":
            fn = getattr(_tf.train, name.lower(), None)
            if fn is None:
                raise AttributeError("TensorFlow.js has no optimizer '%s'" % name)

            def optimizer(learning_rate=0.01, **kw):
                return _wrap(fn(learning_rate))
            return optimizer
        if self._name in ("losses", "metrics"):
            return getattr(_tf.losses if self._name == "losses" else _tf.metrics, _camel(name), None) or _wrap(None)
        if self._name == "models" and name in ("load_model", "Sequential"):
            return lambda *a: _wrap(_tf.loadLayersModel(*a))
        raise AttributeError("tf.keras has no '%s'" % path)


_root = Wrapper(_tf)


def __getattr__(name):                                     # module level: tf.xxx
    if name.startswith("__"):
        raise AttributeError(name)
    return getattr(_root, name)
