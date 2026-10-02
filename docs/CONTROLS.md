# Inline Controls

Pytml 2.5 supports a small numbered control vocabulary inside `<pyN>` blocks.

## Buttons

```html
<py1>
<btn1>+</btn1>
<btn2>-</btn2>
</py1>
```

Each becomes a real button immediately before the `<pyN>` element.

## Inputs

```html
<py1>
<input1>Type your name</input1>
</py1>
```

creates `<input id="input1" type="text">`. Attributes on the custom tag are copied to the real input.

## Text inputs

```html
<py1>
<txt1>Search...</txt1>
</py1>
```

is a convenient text-input shorthand.

## Numbering

`btn1` through `btn99` are explicitly supported, and the parser accepts larger numbers as well. IDs must be unique in the document.

## Placement

Generated controls are inserted immediately before their owning `<pyN>` element in source order. The `<pyN>` block itself remains hidden from the page after Pytml discovers it.
