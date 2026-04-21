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
objectify(data, fields, options?);
fieldsBuilder().field(...).group(...).build();
```

- `objectify(data, fields, options?)` returns an array or object map keyed by the first field.
- `fieldsBuilder` builds the same `Field[]` tuple structure as writing arrays manually.

## Quick Example

```ts
import { objectify, type Field } from "resobjectify";

type Row = {
  order_id: number;
  customer: string;
  item_id: number | null;
  item_name: string | null;
  qty: number | null;
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
  { order_id: 2, customer: "Beta", item_id: null, item_name: null, qty: null },
];

const fields: Field<Result, Row>[] = [
  { key: "order_id", as: "id" },
  "customer",
  [
    "items",
    [
      { key: "item_id", as: "id" },
      { key: "item_name", as: "name" },
      "qty",
    ],
  ],
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

Pass `{ object: true }` as the third argument to return a top-level object map.
Nested groups inherit that mode unless overridden.

```ts
const mapped = objectify<Result, Row>(rows, fields, { object: true });
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
      "qty",
    ],
  ],
];

const mappedWithArrayItems = objectify<Result, Row>(rows, fieldsWithArrayItems, {
  object: true,
});
```

`mappedWithArrayItems` keeps top-level object mode but returns `items` as an array.

## Options

### `objectify(..., options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `object` | `boolean` | `false` | Return an object map keyed by the first field at each level. |
| `allowNulls` | `boolean` | `false` | Include groups whose grouping key is `null` or `undefined` at that level. |
| `flattenSingleField` | `boolean` | `true` | Flatten single-field groups to arrays of values (`["x"]`) instead of objects (`[{ value: "x" }]`). |
| `separator` | `string` | `"-"` | Default separator used for combined keys/values (`{ keys: [...] }`) when that field does not define `separator`. |

### Group-level options

Group field options (`[{ name: "group", ...options }, nestedFields]`) support:

- `object`
- `allowNulls`
- `flattenSingleField`

These overrides apply at that nested level and cascade to descendants unless overridden again.

## Using `fieldsBuilder`

`fieldsBuilder` is a fluent helper to build the same `Field[]` structure without manually writing nested arrays.

How it works:

### Fields

- `field("key")` adds a key field.
- `field("key", "alias")` adds a renamed key field.
- `field("key", ["nested", "alias"])` places the value into a nested output path.
- `field("key", { json?, hide? })` adds options without alias.
- `field("key", "alias", { json?, hide? })` combines alias + options.

### Combined Fields

- `combinedField(["k1", "k2"], "alias")` adds a combined key field.
- `combinedField(["k1", "k2"], "alias", { separator?, hide? })` adds a combined key field with options.

### Groups

- `group(name, callback)` starts a nested level.
- `group(name, { object?, allowNulls?, flattenSingleField? }, callback)` overrides output mode for that group.

### Build

- `build()` returns the final `Field[]` tuple you pass to `objectify`.

```ts
const built = fieldsBuilder()
  .combinedField(["customer", "order_id"], "customer_order", { separator: ":", hide: true })
  .field("order_id", "id")
  .field("customer")
  .field("payload", { json: true })
  .group("items", { object: false, allowNulls: true, flattenSingleField: false }, (g) =>
    g
      .field("item_id", "id")
      .field("item_name", "name")
      .field("qty")
      .group("tags", (g2) => g2.field("tag"))
  )
  .build();
```

`built`:

```ts
[
  {
    keys: ["customer", "order_id"],
    as: "customer_order",
    separator: ":",
    hide: true,
  },
  { key: "order_id", as: "id" },
  "customer",
  { key: "payload", json: true },
  [
    { name: "items", object: false, allowNulls: true, flattenSingleField: false },
    [
      { key: "item_id", as: "id" },
      { key: "item_name", as: "name" },
      "qty",
      ["tags", ["tag"]],
    ],
  ],
];
```

## Combined Fields

Combined fields let you build one value from multiple source keys:

```ts
{ keys: ["customer", "order_id"], as: "customer_order", separator: ":" }
```

Common uses:

- Emit a composite value in output (for example `brand_model: "Acme-X100"`).
- Group by a composite key with `hide: true` so the field is omitted from each value object.
- In object-map mode, that composite value is still visible as the map key (for example `"Acme-X100": { ... }`).

Separator behavior:

- Field-level `separator` wins.
- Otherwise `options.separator` is used.
- Otherwise default `"-"` is used.

Example (combined field used as hidden nested grouping key):

```ts
const rows = [
  { catalog_id: 1, brand: "Acme", model: "X100", sku: "A-1" },
  { catalog_id: 1, brand: "Acme", model: "X100", sku: "A-2" },
  { catalog_id: 1, brand: "Acme", model: "X200", sku: "A-3" },
  { catalog_id: 1, brand: "Contoso", model: "M10", sku: "C-1" },
];

const fields: Field[] = [
  "catalog_id",
  [
    "products",
    [
      { keys: ["brand", "model"], as: "brand_model", separator: "-", hide: true },
      ["skus", ["sku"]],
    ],
  ],
];

const result = objectify(rows, fields, { object: true });
```

`result`:

```ts
{
  1:{
    catalog_id: 1,
    products: {
      "Acme-X100": { skus: ["A-1", "A-2"] },
      "Acme-X200": { skus: ["A-3"] },
      "Contoso-M10": { skus: ["C-1"] },
    },
  },
}
```

## Grouping Without A Root Key

You can start `fields` directly with groups, without a top-level key field.
This is useful when you want one aggregated object with grouped data.

```ts
const rows = [
  { order_id: 101, customer: "Acme", item_name: "Keyboard", qty: 1 },
  { order_id: 102, customer: "Acme", item_name: "Mouse", qty: 2 },
  { order_id: 201, customer: "Beta", item_name: "Monitor", qty: 1 },
];

const fields: Field[] = [
  ["quantitiesByCustomer", ["customer", ["quantities", ["qty"]]]],
  ["itemsByCustomer", ["customer", ["items", ["item_name"]]]],
];
//or with fieldsBuilder
const builtFields = fieldsBuilder()
  .group("quantitiesByCustomer", (g) =>
    g
      .field("customer")
      .group("quantities", (g1) => g1.field("qty"))
  ).group("itemsByCustomer", (g) =>
    g
      .field("customer")
      .group("items", (g1) => g1.field("item_name"))
  ).build();

const result = objectify(rows, fields);
```

`result`:

```ts
[
  {
    quantitiesByCustomer: [
      { customer: "Acme", quantities: [1, 2] },
      { customer: "Beta", quantities: [1] },
    ],
    itemsByCustomer: [
      { customer: "Acme", items: ["Keyboard", "Mouse"] },
      { customer: "Beta", items: ["Monitor"] },
    ],
  },
];
```

## Allow Nulls

By default, rows whose grouping key is `null` or `undefined` are skipped.
Set `allowNulls: true` to include them.

```ts
const rows = [
  { order_id: 101, shipment_status: "new" },
  { order_id: 102, shipment_status: null },
  { order_id: 103, shipment_status: "processing" },
  { order_id: 104, shipment_status: undefined },
  { order_id: 105, shipment_status: "new" },
];

const fields: Field[] = ["shipment_status", ["orders", ["order_id"]]];

const result = objectify(rows, fields);
```

`result`:

```ts
[
  { shipment_status: "new", orders: [101, 105] },
  { shipment_status: "processing", orders: [103] },
]
```

```ts
const withNulls = objectify(rows, fields, { allowNulls: true });
```

`withNulls`:

```ts
[
  { shipment_status: "new", orders: [101, 105] },
  { shipment_status: null, orders: [102] },
  { shipment_status: "processing", orders: [103] },
  { shipment_status: undefined, orders: [104] },
]
```

## Flatten Single Field

When a group level has only one visible field, `flattenSingleField: true` (default) collapses it to an array of scalar values instead of an array of single-key objects.

```ts
const rows = [
  { order_id: 101, item_name: "Keyboard" },
  { order_id: 101, item_name: "Mouse" },
  { order_id: 201, item_name: "Monitor" },
];

const fields: Field[] = ["order_id", ["item_names", ["item_name"]]];

const result = objectify(rows, fields);
```

`result`:

```ts
[
  { order_id: 101, item_names: ["Keyboard", "Mouse"] },
  { order_id: 201, item_names: ["Monitor"] },
]
```

```ts
const nested = objectify(rows, fields, { flattenSingleField: false });
```

`nested`:

```ts
[
  { order_id: 101, item_names: [{ item_name: "Keyboard" }, { item_name: "Mouse" }] },
  { order_id: 201, item_names: [{ item_name: "Monitor" }] },
]
```

## JSON Parsing

Use `json` to parse JSON text values:

- `json: true` parses and returns the full JSON value
- `json: [path...]` parses and returns a nested value by path

```ts
type MetaRow = { order_id: number; item_meta: string | null };
type MetaResult = { order_id: number; item_meta: { warehouse: string } | null };

const metaRows: MetaRow[] = [
  { order_id: 101, item_meta: '{"warehouse":"A1"}' },
  { order_id: 102, item_meta: null },
  { order_id: 103, item_meta: "bad-json" },
];

const metaFields: Field<MetaResult, MetaRow>[] = ["order_id", { key: "item_meta", json: true }];
const parsed = objectify<MetaResult, MetaRow>(metaRows, metaFields);
```

`parsed`:

```ts
[
  { order_id: 101, item_meta: { warehouse: "A1" } },
  { order_id: 102, item_meta: null },
  { order_id: 103, item_meta: null },
];
```

With `json: true`, invalid JSON values are converted to `null` and a parsing error is logged.

Path extraction example:

```ts
type PathRow = { order_id: number; item_meta: string };

const pathRows: PathRow[] = [
  { order_id: 101, item_meta: '[{"data":{"warehouse":"A1"}}]' },
  { order_id: 102, item_meta: '[{"data":{}}]' },
];

const pathFields: Field[] = [
  "order_id",
  { key: "item_meta", as: "warehouse", json: [0, "data", "warehouse"] },
];

const extracted = objectify(pathRows, pathFields);
```

`extracted`:

```ts
[
  { order_id: 101, warehouse: "A1" },
  { order_id: 102, warehouse: undefined },
];
```

Notes:

- Numeric path segments are supported (for arrays), e.g. `[0, "data", "value"]`.
- Missing path segments return `undefined`.
- `json: []` returns the full parsed JSON value (same result shape as `json: true`).
- `json: false` disables parsing and keeps the raw value.

## Nested Aliases

`as` can be an array of path segments to place the value into a nested output object. Works on `field`, object-form `{ key, as }`, and `combinedField`.

```ts
type Row = {
  hover: number;
  scroll: number;
  total: number;
  brand: string;
  model: string;
};

const rows: Row[] = [
  { hover: 10, scroll: 20, total: 30, brand: "Acme", model: "X1" },
];

const fields: Field[] = [
  { key: "hover", as: ["events", "Hover"] },
  { key: "scroll", as: ["events", "Scroll"] },
  "total",
  { keys: ["brand", "model"], as: ["labels", "brandModel"], separator: "-" },
];

const result = objectify(rows, fields);
```

`result`:

```ts
[
  {
    events: { Hover: 10, Scroll: 20 },
    total: 30,
    labels: { brandModel: "Acme-X1" },
  },
];
```

Notes:

- Missing intermediate objects are created automatically.
- Shared path prefixes merge into the same nested object.
- Single-segment alias (`as: ["value"]`) behaves like `as: "value"`.
- Empty alias (`as: []`) falls back to using the source key as the output name.
- Combines with `json` (parsed value placed at the nested alias) and `hide` (field omitted from output).

## Hide Fields

`hide: true` is mainly useful when a field should be used as the grouping key, but should not appear in the output object.

```ts
type Row = { customer: string; order_id: number };
const rows: Row[] = [
  { customer: "Acme", order_id: 101 },
  { customer: "Acme", order_id: 102 },
  { customer: "Beta", order_id: 201 },
];

const fields: Field[] = [{ key: "customer", hide: true }, ["orders", ["order_id"]]];
const result = objectify(rows, fields);
```

`result`:

```ts
[
  { orders: [101, 102] },
  { orders: [201] },
];
```

With `object: true`, the hidden key would still be used for top-level mapping:

```ts
const mapped = objectify(rows, fields, { object: true });
```

`mapped`:

```ts
{
  Acme: { orders: [101, 102] },
  Beta: { orders: [201] },
}
```
