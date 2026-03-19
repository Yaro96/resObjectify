# ResObjectify

Transform flat rows into nested arrays or object maps.

Useful when you receive denormalized rows (for example from SQL joins) and need API-ready output.

## When To Use

- Input is flat rows with repeated parent data (typical SQL join output).
- You want nested API response shapes with minimal manual grouping code.
- You need either array output or object-map output depending on use case.

## Install

```bash
npm install resobjectify
```

## Import

```ts
import { objectify, fieldsBuilder, type Field } from "resobjectify";
```

## API At A Glance

```ts
objectify(data, fields, object?);
fieldsBuilder().field(...).group(...).build();
```

- `objectify(data, fields)` returns arrays by default.
- `objectify(data, fields, true)` returns an object map keyed by the first field.
- `fieldsBuilder` builds the same `Field[]` tuple structure as writing arrays manually.

## Quick Example

```ts
import { objectify, type Field } from "resobjectify";

type Row = {
  order_id: number;
  customer: string;
  item_id: number;
  item_name: string;
  qty: number;
};

type Result = {
  id: number;
  customer: string;
  items: { id: number; name: string; qty: number }[];
};

const rows: Row[] = [
  { order_id: 1, customer: "Acme", item_id: 10, item_name: "Keyboard", qty: 1 },
  { order_id: 1, customer: "Acme", item_id: 11, item_name: "Mouse", qty: 2 },
  { order_id: 2, customer: "Beta", item_id: 20, item_name: "Monitor", qty: 1 },
  { order_id: 2, customer: "Beta", item_id: null },
];

const fields: Field<Result, Row>[] = [
  { key: "order_id", as: "id" },
  "customer",
  [
    "items",
    [
      { key: "item_id", as: "id" },
      { key: "item_name", as: "name" },
      "qty"
    ]
  ]
];

const result = objectify<Result, Row>(rows, fields);
```

`result`:

```ts
[
  {
    id: 1,
    customer: "Acme",
    items: [
      { id: 10, name: "Keyboard", qty: 1 },
      { id: 11, name: "Mouse", qty: 2 },
    ],
  },
  {
    id: 2,
    customer: "Beta",
    items: [{ id: 20, name: "Monitor", qty: 1 }],
  },
];
```

Behavior in this example:

- The first field at each level is the grouping key (`order_id` at root, `item_id` in `items`).
- Rows with `null` or `undefined` grouping keys are skipped at that level.

## Object Output Mode

Pass `true` as the third argument to return a top-level object map.
Nested groups inherit that mode unless overridden.

```ts
const mapped = objectify<Result, Row>(rows, fields, true);
```

`mapped`:

```ts
{
  1: {
    id: 1,
    customer: "Acme",
    items: {
      10: { id: 10, name: "Keyboard", qty: 1 },
      11: { id: 11, name: "Mouse", qty: 2 },
    },
  },
  2: {
    id: 2,
    customer: "Beta",
    items: {
      20: { id: 20, name: "Monitor", qty: 1 },
    },
  },
}
```

Override a nested group mode with `{ object: false }` (or `{ object: true }`):

```ts
const fieldsWithArrayItems: Field<Result, Row>[] = [
  { key: "order_id", as: "id" },
  "customer",
  [
    { name: "items", object: false }, // overrides the third argument for this group
    [
      { key: "item_id", as: "id" },
      { key: "item_name", as: "name" },
      "qty"
    ]
  ]
];

const mappedWithArrayItems = objectify<Result, Row>(rows, fieldsWithArrayItems, true);
```

`mappedWithArrayItems` keeps top-level object mode but returns `items` as an array.
If a level contains only one field, that level is always emitted as an array.

## Using `fieldsBuilder`

`fieldsBuilder` is a fluent helper to build the same `Field[]` structure without manually writing nested arrays.

How it works:

- `field("key")` adds a key field.
- `field("key", "alias")` adds a renamed key field.
- `field("key", { json: true | false, hide: true | false })` adds options without alias.
- `field("key", "alias", { json: true | false, hide: true | false })` combines alias + options.
- `group(name, callback)` starts a nested level.
- `group(name, { object: true | false }, callback)` overrides output mode for that group.
- `build()` returns the final `Field[]` tuple you pass to `objectify`.

```ts
const built = fieldsBuilder<Result, Row>()
  .field("order_id", "id")
  .field("customer")
  .group("items", (g) =>
    g.field("item_id", "id")
    .field("item_name", "name")
    .field("qty")
    .field("meta", { json: true })
  ).build();
```

`built`:

```ts
[
  { key: "order_id", as: "id" },
  "customer",
  ["items",
    [
      { key: "item_id", as: "id" },
      { key: "item_name", as: "name" },
      "qty"
      { key: "meta", json: true }
    ]
  ],
];
```

## Grouping Without A Root Key

You can start `fields` directly with groups, without a top-level key field.
This is useful when you want one aggregated object with grouped data.

```ts
const rows = [
  { type: "A", count: 10, uniqueCount: 5 },
  { type: "B", count: 20, uniqueCount: 10 },
  { type: "A", count: 30, uniqueCount: 15 },
];

const fields: Field[] = [
  ["totalEvents", ["type", ["counts", ["count"]]]],
  ["uniqueEvents", ["type", ["uniques", ["uniqueCount"]]]],
];
//or with fieldsBuilder
const builtFields = fieldsBuilder()
  .group("totalEvents", (g) =>
    g
      .field("type")
      .group("counts", (g1) => g1.field("count"))
  ).group("uniqueEvents", (g) =>
    g
      .field("type")
      .group("uniques", (g1) => g1.field("uniqueCount"))
  ).build();

const result = objectify(rows, fields);
```

`result`:

```ts
[
  {
    totalEvents: [
      { type: "A", counts: [10, 30] },
      { type: "B", counts: [20] },
    ],
    uniqueEvents: [
      { type: "A", uniques: [5, 15] },
      { type: "B", uniques: [10] },
    ],
  },
];
```

## JSON Parsing

Use `json: true` to parse JSON text values.

```ts
type MetaRow = { id: number; meta: string | null };
type MetaResult = { id: number; meta: { tier: number } | null };

const metaRows: MetaRow[] = [
  { id: 1, meta: '{"tier":1}' },
  { id: 2, meta: null },
  { id: 3, meta: "bad-json" },
];

const metaFields: Field<MetaResult, MetaRow>[] = ["id", { key: "meta", json: true }];
const parsed = objectify<MetaResult, MetaRow>(metaRows, metaFields);
```

`parsed`:

```ts
[
  { id: 1, meta: { tier: 1 } },
  { id: 2, meta: null },
  { id: 3, meta: null },
];
```

With `json: true`, invalid JSON values are converted to `null` and a parsing error is logged.

## Hide Fields

`hide: true` is mainly useful when a field should be used as the grouping key, but should not appear in the output object.

```ts
type Row = { category: string; value: number };
const rows: Row[] = [
  { category: "A", value: 10 },
  { category: "A", value: 30 },
  { category: "B", value: 20 },
];

const fields: Field[] = [{ key: "category", hide: true }, ["values", ["value"]]];
const result = objectify(rows, fields);
```

`result`:

```ts
[
  { values: [10, 30] },
  { values: [20] },
];
```

With `object: true`, the hidden key would still be used for top-level mapping:

```ts
const mapped = objectify(rows, fields, true);
```

`mapped`:

```ts
{
  A: { values: [10, 30] },
  B: { values: [20] },
}
```
