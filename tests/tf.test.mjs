import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { runPage } from './helpers.mjs';

const require = createRequire(import.meta.url);
const page = (body) => `<!DOCTYPE html><html><body>${body}</body></html>`;

test('import tensorflow: tensors, operators and a trained Keras-style model', async () => {
  const tf = require('@tensorflow/tfjs');
  await tf.setBackend('cpu');
  const p = await runPage(page(`<py>
import tensorflow as tf
a = tf.constant([[1.0, 2.0], [3.0, 4.0]])
b = a * 2 + 1
print(b.tolist(), b.shape)
print(float(tf.reduce_sum(a)))
print((a @ a).tolist())

model = tf.keras.Sequential([tf.keras.layers.Dense(1, input_shape=[1])])
model.compile(optimizer=tf.keras.optimizers.SGD(learning_rate=0.1), loss="mse")
model.fit([[0.0], [1.0], [2.0], [3.0]], [[-1.0], [1.0], [3.0], [5.0]], epochs=300, verbose=0)
y = model.predict([[10.0]]).tolist()[0][0]
print("predict", round(y))
</py>`), { extraGlobals: { tf } });
  await p.finished(60000);
  const t = p.text();
  assert.match(t, /\[\[3, 5\], \[7, 9\]\]/);
  assert.match(t, /10\.0/);
  assert.match(t, /\[\[7, 10\], \[15, 22\]\]/);
  assert.match(t, /predict 19/);
});
