# ResObjectify

Transform flat rows into nested arrays or object maps.

Useful when you receive denormalized rows (for example from SQL joins) and need API-ready output.

## Install

```bash
npm install resobjectify
```

## Import

```ts
import { objectify, fieldsBuilder, type Fields } from "resobjectify";
```

## Quick Example

```ts
import { objectify, type Fields } from "resobjectify";

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
];

const fields: Fields<Result, Row> = [
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

## Object Output Mode

Allows to group the result in an object by passing `true` as third argument to `objectify` or set `object` property the group field.

```ts
const fields: Fields<Result, Row> = [
  { key: "order_id", as: "id" },
  "customer",
  [
    { name: "items", object: false }, //this will override the mode set in the third argument
    [
      { key: "item_id", as: "id" },
      { key: "item_name", as: "name" },
      "qty"
    ]
  ]
];

const mapped = objectify<Result, Row>(rows, fields, true);
```

`mapped`:

```ts
{
  1: {
    id: 1,
    customer: "Acme",
    items: [
      { id: 10, name: "Keyboard", qty: 1 },
      { id: 11, name: "Mouse", qty: 2 },
    ],
  },
  2: {
    id: 2,
    customer: "Beta",
    items: [{ id: 20, name: "Monitor", qty: 1 }],
  },
}
```

Or also the other way around, set `object` property the group field and pass `false` as third argument to `objectify`.

```ts
const fields: Fields<Result, Row> = [
  { key: "order_id", as: "id" },
  "customer",
  [
    { name: "items", object: true }, //this will override the mode set in the third argument
    [
      { key: "item_id", as: "id" },
      { key: "item_name", as: "name" },
      "qty"
    ]
  ]
];

const mapped = objectify<Result, Row>(rows, fields, false);
```

`mapped`:

```ts
[
  {
    id: 1,
    customer: "Acme",
    items: {
      10: { id: 10, name: "Keyboard", qty: 1 },
      11: { id: 11, name: "Mouse", qty: 2 },
    },
  },
  {
    id: 2,
    customer: "Beta",
    items: {
      20: { id: 20, name: "Monitor", qty: 1 },
    },
  },
]
```

## Using `fieldsBuilder`

`fieldsBuilder` is a fluent helper to build the same `Fields` structure without manually writing nested arrays.

How it works:

- `field(key, as?, { json: true | false }?)` adds a key field at the current level.
- `group(name, { object: true | false }?, callback)` starts a nested level, and the callback receives a new builder for that level.
- `build()` returns the final `Fields` tuple that you pass to `objectify`.

```ts
const built = fieldsBuilder<Result, Row>()
  .field("order_id", "id")
  .field("customer")
  .group("items", (g) =>
    g.field("item_id", "id")
    .field("item_name", "name")
    .field("qty")
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
    ]
  ],
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

const metaFields: Fields<MetaResult, MetaRow> = ["id", { key: "meta", json: true }];
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

## Notes

- The first field in each level is the grouping key.
- If a level has only one field, output for that level is always an array.
