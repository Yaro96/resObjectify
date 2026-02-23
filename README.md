# ResObjectify

Transform flat rows into nested arrays or nested object maps.

`resobjectify` is useful when you receive denormalized rows from SQL joins and want to shape them into API-ready objects.

## Installation

```bash
npm install resobjectify
```

## Exports

```ts
import { objectify, fieldsBuilder, type Fields } from "resobjectify";
```

## Quick Start

```ts
import { objectify, type Fields } from "resobjectify";

type Input = {
  id: number;
  code: string;
  name: string;
  rule_id: number | null;
  formula: string | null;
  meter_id: number;
};

type Result = {
  area_id: number;
  area_code: string;
  name: string;
  rules: {
    rule_id: number;
    rule: string | null;
    meters: number[];
  }[];
};

const rows: Input[] = [
  { id: 111, code: "aaa", name: "first", rule_id: 1, formula: "A", meter_id: 8 },
  { id: 111, code: "aaa", name: "first", rule_id: 1, formula: "A", meter_id: 10 },
  { id: 111, code: "aaa", name: "first", rule_id: 2, formula: "B", meter_id: 9 },
  { id: 222, code: "bbb", name: "second", rule_id: 3, formula: "X", meter_id: 5 },
];

const fields: Fields<Result, Input> = [
  { key: "id", as: "area_id" },
  { key: "code", as: "area_code" },
  "name",
  [
    "rules",[
      "rule_id",
      { key: "formula", as: "rule" },
      [
        "meters",[
          "meter_id"
        ]
      ],
    ],
  ],
];

const result = objectify<Result>(rows, fields);
```

`result` becomes:

```ts
[
  {
    area_id: 111,
    area_code: "aaa",
    name: "first",
    rules: [
      { rule_id: 1, rule: "A", meters: [8, 10] },
      { rule_id: 2, rule: "B", meters: [9] },
    ],
  },
  {
    area_id: 222,
    area_code: "bbb",
    name: "second",
    rules: [{ rule_id: 3, rule: "X", meters: [5] }],
  },
];
```

## Object Output Mode

Pass `true` as the third argument to use object maps keyed by the first field at each level.

```ts
const mapped = objectify(rows, fields, true);
```

`mapped` becomes:

```ts
{
  111: {
    area_id: 111,
    area_code: "aaa",
    name: "first",
    rules: {
      1: { rule_id: 1, rule: "A", meters: [8, 10] },
      2: { rule_id: 2, rule: "B", meters: [9] },
    },
  },
  222: {
    area_id: 222,
    area_code: "bbb",
    name: "second",
    rules: {
      1: { rule_id: 1, rule: "X", meters: [5] },
    },
  },
}
```

In this mode:

- top-level result is keyed by `id` (first field in root definition)
- nested groups with `object: true` are keyed by their first nested key
- nested groups with `object: false` return arrays

## Build Fields Fluently

You can build the same field definition with `fieldsBuilder`:

```ts
import { fieldsBuilder } from "resobjectify";

const built = fieldsBuilder<Result, Input>()
  .field("id", "area_id")
  .field("code", "area_code")
  .field("name")
  .group("rules", (g) =>
    g
      .field("rule_id")
      .field("formula", "rule")
      .group("meters", (gg) => gg.field("meter_id")),
  )
  .build();
```

## JSON Field Parsing

Set `json: true` on a key field to parse JSON text from the source row:

```ts
type JsonRow = { id: number; meta: string | null };
type JsonResult = { id: number; meta: { tier: number } | null };

const jsonRows = [
  { id: 1, meta: '{"tier":1}' },
  { id: 2, meta: null },
  { id: 3, meta: "not valid json" },
];

const jsonFields: Fields<JsonResult, JsonRow> = ["id", { key: "meta", json: true }];
const parsed = objectify<JsonResult, JsonRow>(jsonRows, jsonFields);
```

`parsed`:

```ts
[
  { id: 1, meta: { tier: 1 } },
  { id: 2, meta: null },
  { id: 3, meta: null },
]
```

Invalid JSON values are converted to `null`.

## Logic behind the scenes

- The FIRST `Field` inside the `Fields` or `GroupField` array is treated as the PRIMARY KEY on which the result will be grouped.
- If the `Fields` or `GroupField` array contains only one field, the result will be ALWAYS an array (even if `object` is `true`)

## TypeScript Notes

- `objectify` and `fieldsBuilder` are fully typed
- `Fields<Result, Input>` gives you the strictest compile-time checks
- using only `Fields<Result>` or no generics is supported for looser typing
