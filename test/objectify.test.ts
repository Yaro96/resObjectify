import { describe, expect, it } from "vitest";
import { objectify } from "../src/objectify";
import type { Field } from "../types";

type Input = {
  id: number;
  code: string;
  name: string;
  rule_id: number | null;
  formula?: string | null;
  meter_id?: number;
  area_id?: number | null;
  meta: string | null;
};

type ResultObject = {
  area_id: number;
  area_code: string;
  name: string;
  meta: { tier: number } | null;
  rules: Record<
    PropertyKey,
    {
      rule_id: number;
      rule: string | null;
      meters: number[];
      areas: number[];
    }
  >;
};

// biome-ignore format: list
const data: Input[] = [
	{ id: 222, code: "bbb", name: "second", rule_id: 1, formula: "r1", meter_id: 5, area_id: 40, meta: '{"tier":2}' },
	{ id: 111, code: "aaa", name: "first", rule_id: 1, formula: "asd", meter_id: 8, area_id: 31, meta: '{"tier":1,"active":true}' },
	{ id: 222, code: "bbb", name: "second", rule_id: 2, formula: null, meter_id: 6, area_id: 41, meta: '{"tier":2}' },
	{ id: 111, code: "aaa", name: "first", rule_id: 2, formula: "sad", meter_id: 9, area_id: 95, meta: '{"tier":1,"active":true}' },
	{ id: 111, code: "aaa", name: "first", rule_id: 1, formula: "asd", meter_id: 10, area_id: 31, meta: '{"tier":1,"active":true}' },
	{ id: 222, code: "bbb", name: "second", rule_id: 2, formula: null, meter_id: 7, area_id: null, meta: null },
	{ id: 444, code: "ddd", name: "fourth", rule_id: 5, formula: "void", meter_id: 4, area_id: null, meta: null },
	{ id: 111, code: "aaa", name: "first", rule_id: 1, formula: "asd", meter_id: 10, area_id: 95, meta: '{"tier":1,"active":true}' },
	{ id: 111, code: "aaa", name: "first", rule_id: 2, formula: "sad", meter_id: 10, area_id: 95, meta: '{"tier":1,"active":true}' },
	{ id: 111, code: "aaa", name: "first", rule_id: 2, formula: "sad", meter_id: 12, area_id: null, meta: '{"tier":1,"active":true}' },
	{ id: 333, code: "ccc", name: "fail", rule_id: null, meta: null },
];

const fields: Field<ResultObject, Input>[] = [
  { key: "id", as: "area_id" },
  { key: "code", as: "area_code" },
  "name",
  { key: "meta", json: true },
  [
    "rules",
    [
      "rule_id",
      { key: "formula", as: "rule" },
      [{ name: "meters", object: true }, ["meter_id"]],
      [{ name: "areas", object: false }, ["area_id"]],
    ],
  ],
];

describe("objectify", () => {
  it("handles empty data", () => {
    expect(objectify([], fields)).toEqual([]);
    expect(objectify([], fields, true)).toEqual({});
  });

  it("handles empty fields", () => {
    expect(objectify(data, [])).toEqual([]);
    expect(objectify(data, [], true)).toEqual({});
  });

  it("handles group without fields", () => {
    // @ts-expect-error - we want to test the behavior of the function
    expect(objectify(data, ["id", ["rules"]])).toEqual([
      { id: 222, rules: [] },
      { id: 111, rules: [] },
      { id: 444, rules: [] },
      { id: 333, rules: [] },
    ]);
    expect(objectify(data, ["id", [{ name: "rules", object: true }, []]])).toEqual([
      { id: 222, rules: {} },
      { id: 111, rules: {} },
      { id: 444, rules: {} },
      { id: 333, rules: {} },
    ]);
  });

  it("handles group with a single field", () => {
    expect(objectify(data, [["rules", ["rule_id"]]])).toEqual([
      {
        rules: [1, 2, 5],
      },
    ]);
    expect(objectify(data, [["rules", ["rule_id"]]], true)).toEqual({
      rules: [1, 2, 5],
    });
  });

  it("handles group without fields", () => {
    expect(objectify(data, [["rules", []]])).toEqual([
      {
        rules: [],
      },
    ]);
    expect(objectify(data, [["rules", []]], true)).toEqual({
      rules: {},
    });
  });

  it("handles group with nested group without fields", () => {
    expect(objectify(data, [["rules", [["meters", []]]]])).toEqual([
      {
        rules: [{ meters: [] }],
      },
    ]);
    expect(objectify(data, [["rules", [["meters", []]]]], true)).toEqual({
      rules: { meters: {} },
    });
  });

  it("handles group with nested group with a single field", () => {
    expect(objectify(data, [["rules", [["meters", ["meter_id"]]]]])).toEqual([
      {
        rules: [{ meters: [5, 8, 6, 9, 10, 7, 4, 12] }],
      },
    ]);
    expect(objectify(data, [["rules", [["meters", ["meter_id"]]]]], true)).toEqual({
      rules: { meters: [5, 8, 6, 9, 10, 7, 4, 12] },
    });
  });

  it("handles nested group with a single field", () => {
    expect(objectify(data, ["id", ["rules", [["meters", ["meter_id"]]]]])).toEqual([
      { id: 222, rules: [{ meters: [5, 6, 7] }] },
      { id: 111, rules: [{ meters: [8, 9, 10, 12] }] },
      { id: 444, rules: [{ meters: [4] }] },
      { id: 333, rules: [{ meters: [] }] },
    ]);
    expect(objectify(data, ["id", ["rules", [["meters", ["meter_id"]]]]], true)).toEqual({
      222: { id: 222, rules: { meters: [5, 6, 7] } },
      111: { id: 111, rules: { meters: [8, 9, 10, 12] } },
      444: { id: 444, rules: { meters: [4] } },
      333: { id: 333, rules: { meters: [] } },
    });
  });

  it("builds nested arrays for rules, meters, and areas", () => {
    expect(objectify<ResultObject, Input>(data, fields)).toEqual([
      {
        area_id: 222,
        area_code: "bbb",
        name: "second",
        meta: { tier: 2 },
        rules: [
          { rule_id: 1, rule: "r1", meters: [5], areas: [40] },
          { rule_id: 2, rule: null, meters: [6, 7], areas: [41] },
        ],
      },
      {
        area_id: 111,
        area_code: "aaa",
        name: "first",
        meta: { tier: 1, active: true },
        rules: [
          { rule_id: 1, rule: "asd", meters: [8, 10], areas: [31, 95] },
          { rule_id: 2, rule: "sad", meters: [9, 10, 12], areas: [95] },
        ],
      },
      {
        area_code: "ddd",
        area_id: 444,
        meta: null,
        name: "fourth",
        rules: [{ rule_id: 5, rule: "void", meters: [4], areas: [] }],
      },
      {
        area_code: "ccc",
        area_id: 333,
        meta: null,
        name: "fail",
        rules: [],
      },
    ]);
  });

  it("returns an object map when object=true", () => {
    expect(objectify<ResultObject, Input>(data, fields, true)).toEqual({
      222: {
        area_id: 222,
        area_code: "bbb",
        name: "second",
        meta: { tier: 2 },
        rules: {
          1: { rule_id: 1, rule: "r1", meters: [5], areas: [40] },
          2: { rule_id: 2, rule: null, meters: [6, 7], areas: [41] },
        },
      },
      111: {
        area_id: 111,
        area_code: "aaa",
        name: "first",
        meta: { tier: 1, active: true },
        rules: {
          1: { rule_id: 1, rule: "asd", meters: [8, 10], areas: [31, 95] },
          2: { rule_id: 2, rule: "sad", meters: [9, 10, 12], areas: [95] },
        },
      },
      444: {
        area_code: "ddd",
        area_id: 444,
        meta: null,
        name: "fourth",
        rules: {
          5: { areas: [], meters: [4], rule: "void", rule_id: 5 },
        },
      },
      333: {
        area_code: "ccc",
        area_id: 333,
        meta: null,
        name: "fail",
        rules: {},
      },
    });
  });

  it("parses json fields when json=true", () => {
    type InputJson = {
      id: number;
      payload: string | null;
    };

    const arr: InputJson[] = [
      { id: 1, payload: '{"value":42}' },
      { id: 2, payload: null },
    ];

    type ResultJson = {
      id: number;
      payload: {
        value: number;
      } | null;
    };

    const fields: Field<ResultJson, InputJson>[] = ["id", { key: "payload", json: true }];

    expect(objectify(arr, fields)).toEqual([
      { id: 1, payload: { value: 42 } },
      { id: 2, payload: null },
    ]);
  });

  it("supports empty-string keys", () => {
    type EmptyKeyInput = {
      "": number;
      v: string;
    };

    const arr: EmptyKeyInput[] = [
      { "": 1, v: "a" },
      { "": 3, v: "b" },
    ];

    const fields: Field<EmptyKeyInput, EmptyKeyInput>[] = ["", "v"];

    expect(objectify(arr, fields)).toEqual([
      { "": 1, v: "a" },
      { "": 3, v: "b" },
    ]);

    expect(objectify(arr, fields, true)).toEqual({
      1: { "": 1, v: "a" },
      3: { "": 3, v: "b" },
    });
  });

  it("supports falsy root key values (0 and false)", () => {
    type FalsyKeyInput = {
      id: number | boolean;
      value: string;
    };

    const arr: FalsyKeyInput[] = [
      { id: 0, value: "zero" },
      { id: false, value: "false" },
      { id: 1, value: "one" },
    ];

    const fields: Field<FalsyKeyInput, FalsyKeyInput>[] = ["id", "value"];

    expect(objectify(arr, fields)).toEqual([
      { id: 0, value: "zero" },
      { id: false, value: "false" },
      { id: 1, value: "one" },
    ]);

    expect(objectify(arr, fields, true)).toEqual({
      0: { id: 0, value: "zero" },
      false: { id: false, value: "false" },
      1: { id: 1, value: "one" },
    });
  });

  it("allow to group without a key field", () => {
    type Input = {
      eventType: string;
      eventCount: number;
      uniqueCount: number;
    };

    type Result = {
      totalEvents: { eventType: string; eventCount: number; uniques: number[]; totals: number[] }[];
      uniqueEvents: {
        eventType: string;
        uniqueCount: number;
        totals: number[];
        uniques: number[];
      }[];
    };

    const fields: Field<Result, Input>[] = [
      [
        "totalEvents",
        ["eventType", "eventCount", ["uniques", ["uniqueCount"]], ["totals", ["eventCount"]]],
      ],
      [
        "uniqueEvents",
        ["eventType", "uniqueCount", ["totals", ["eventCount"]], ["uniques", ["uniqueCount"]]],
      ],
    ];

    const data: Input[] = [
      { eventType: "click", eventCount: 10, uniqueCount: 5 },
      { eventType: "view", eventCount: 20, uniqueCount: 10 },
      { eventType: "click", eventCount: 30, uniqueCount: 15 },
      { eventType: "view", eventCount: 40, uniqueCount: 20 },
    ];

    expect(objectify(data, fields)).toEqual([
      {
        totalEvents: [
          { eventType: "click", eventCount: 10, uniques: [5, 15], totals: [10, 30] },
          { eventType: "view", eventCount: 20, uniques: [10, 20], totals: [20, 40] },
        ],
        uniqueEvents: [
          { eventType: "click", uniqueCount: 5, totals: [10, 30], uniques: [5, 15] },
          { eventType: "view", uniqueCount: 10, totals: [20, 40], uniques: [10, 20] },
        ],
      },
    ]);

    expect(objectify(data, fields, true)).toEqual({
      totalEvents: {
        click: { eventType: "click", eventCount: 10, uniques: [5, 15], totals: [10, 30] },
        view: { eventType: "view", eventCount: 20, uniques: [10, 20], totals: [20, 40] },
      },
      uniqueEvents: {
        click: { eventType: "click", uniqueCount: 5, totals: [10, 30], uniques: [5, 15] },
        view: { eventType: "view", uniqueCount: 10, totals: [20, 40], uniques: [10, 20] },
      },
    });

    const fieldsHidden: Field<Result, Input>[] = [
      [
        "totalEvents",
        [
          { key: "eventType", hide: true },
          "eventCount",
          ["uniques", ["uniqueCount"]],
          ["totals", ["eventCount"]],
        ],
      ],
      [
        "uniqueEvents",
        [
          { key: "eventType", hide: true },
          "uniqueCount",
          ["totals", ["eventCount"]],
          ["uniques", ["uniqueCount"]],
        ],
      ],
    ];

    expect(objectify(data, fieldsHidden, true)).toEqual({
      totalEvents: {
        click: { eventCount: 10, uniques: [5, 15], totals: [10, 30] },
        view: { eventCount: 20, uniques: [10, 20], totals: [20, 40] },
      },
      uniqueEvents: {
        click: { uniqueCount: 5, totals: [10, 30], uniques: [5, 15] },
        view: { uniqueCount: 10, totals: [20, 40], uniques: [10, 20] },
      },
    });
  });

  it("supports grouping by multiple fields via nested hidden groups", () => {
    const rows = [
      { eventType: "click", country: "US", count: 10 },
      { eventType: "view", country: "US", count: 20 },
      { eventType: "click", country: "US", count: 30 },
      { eventType: "click", country: "CA", count: 7 },
    ];

    const fields: Field[] = [
      [
        { name: "events" },
        [
          { key: "eventType", hide: true },
          [{ name: "countries" }, ["country", "eventType", ["counts", ["count"]]]],
        ],
      ],
    ];

    expect(objectify(rows, fields)).toEqual([
      {
        events: [
          {
            countries: [
              {
                country: "US",
                counts: [10, 30],
                eventType: "click",
              },
              {
                country: "CA",
                counts: [7],
                eventType: "click",
              },
            ],
          },
          {
            countries: [
              {
                country: "US",
                counts: [20],
                eventType: "view",
              },
            ],
          },
        ],
      },
    ]);
  });

  it("supports flat grouping by multiple keys", () => {
    const rows = [
      { eventType: "click", country: "US", count: 10 },
      { eventType: "view", country: "US", count: 20 },
      { eventType: "click", country: "US", count: 30 },
      { eventType: "click", country: "CA", count: 7 },
      { eventType: "view", country: null, count: 99 },
    ];

    const fields: Field[] = [
      [
        "events",
        [
          { keys: ["eventType", "country"], as: "eventCountry", separator: "-", hide: true },
          "eventType",
          "country",
          ["counts", ["count"]],
        ],
      ],
    ];

    expect(objectify(rows, fields)).toEqual([
      {
        events: [
          { eventType: "click", country: "US", counts: [10, 30] },
          { eventType: "view", country: "US", counts: [20] },
          { eventType: "click", country: "CA", counts: [7] },
        ],
      },
    ]);

    expect(objectify(rows, fields, true)).toEqual({
      events: {
        "click-US": { eventType: "click", country: "US", counts: [10, 30] },
        "view-US": { eventType: "view", country: "US", counts: [20] },
        "click-CA": { eventType: "click", country: "CA", counts: [7] },
      },
    });
  });

  it("supports multi-key grouping inside a nested group", () => {
    const rows = [
      { brand: "Acme", city: "NY", day: "Mon", orderId: 10 },
      { brand: "Acme", city: "NY", day: "Mon", orderId: 11 },
      { brand: "Acme", city: "NY", day: "Tue", orderId: 12 },
      { brand: "Acme", city: "SF", day: "Mon", orderId: 13 },
      { brand: "Acme", city: "SF", day: "Mon", orderId: 14 },
      { brand: "Beta", city: "NY", day: "Mon", orderId: 20 },
      { brand: "Beta", city: null, day: "Mon", orderId: 21 },
      { brand: "Beta", city: "NY", day: "Tue", orderId: 22 },
      { brand: "Beta", city: "LA", day: "Mon", orderId: 23 },
      { brand: "Gamma", city: "LA", day: "Mon", orderId: 30 },
      { brand: "Gamma", city: "LA", day: null, orderId: 31 },
    ];

    const fields: Field[] = [
      "brand",
      [
        "windows",
        [{ keys: ["city", "day"], as: "window", separator: "@" }, ["orderIds", ["orderId"]]],
      ],
    ];

    expect(objectify(rows, fields)).toEqual([
      {
        brand: "Acme",
        windows: [
          { window: "NY@Mon", orderIds: [10, 11] },
          { window: "NY@Tue", orderIds: [12] },
          { window: "SF@Mon", orderIds: [13, 14] },
        ],
      },
      {
        brand: "Beta",
        windows: [
          { window: "NY@Mon", orderIds: [20] },
          { window: "NY@Tue", orderIds: [22] },
          { window: "LA@Mon", orderIds: [23] },
        ],
      },
      {
        brand: "Gamma",
        windows: [{ window: "LA@Mon", orderIds: [30] }],
      },
    ]);
  });

  it("omits a hidden field from the output", () => {
    type HideInput = { id: number; secret: string; name: string };
    type HideResult = { id: number; name: string };

    const rows: HideInput[] = [
      { id: 1, secret: "abc", name: "Alice" },
      { id: 2, secret: "xyz", name: "Bob" },
    ];

    const fields: Field<HideResult, HideInput>[] = ["id", { key: "secret", hide: true }, "name"];

    expect(objectify(rows, fields)).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);

    expect(objectify(rows, fields, true)).toEqual({
      1: { id: 1, name: "Alice" },
      2: { id: 2, name: "Bob" },
    });
  });

  it("omits a hidden key field from output but still groups rows by it", () => {
    type Row = { category: string; value: number };
    const rows: Row[] = [
      { category: "A", value: 10 },
      { category: "A", value: 30 },
      { category: "B", value: 20 },
    ];

    const fields: Field[] = [{ key: "category", hide: true }, ["values", ["value"]]];
    expect(objectify(rows, fields)).toEqual([{ values: [10, 30] }, { values: [20] }]);

    expect(objectify(rows, fields, true)).toEqual({
      A: { values: [10, 30] },
      B: { values: [20] },
    });
  });

  it("uses a hidden key field for object keys when object=true", () => {
    type HideKeyInput = { category: string; value: number };
    type HideKeyResult = { value: number };

    const rows: HideKeyInput[] = [
      { category: "a", value: 1 },
      { category: "b", value: 2 },
      { category: "a", value: 3 },
      { category: "c", value: 4 },
    ];

    const fields: Field<HideKeyResult, HideKeyInput>[] = [{ key: "category", hide: true }, "value"];

    expect(objectify(rows, fields, true)).toEqual({
      a: { value: 1 },
      b: { value: 2 },
      c: { value: 4 },
    });
  });

  it("omits a hidden field inside a nested group", () => {
    type NestedHideInput = { id: number; rule_id: number; formula: string | null };
    type NestedHideResult = {
      id: number;
      rules: { formula: string | null }[];
    };

    const rows: NestedHideInput[] = [
      { id: 1, rule_id: 10, formula: "x" },
      { id: 1, rule_id: 20, formula: "y" },
      { id: 2, rule_id: 10, formula: "z" },
    ];

    const fields: Field<NestedHideResult, NestedHideInput>[] = [
      "id",
      ["rules", [{ key: "rule_id", hide: true }, "formula"]],
    ];

    expect(objectify(rows, fields)).toEqual([
      { id: 1, rules: [{ formula: "x" }, { formula: "y" }] },
      { id: 2, rules: [{ formula: "z" }] },
    ]);

    expect(objectify(rows, fields, true)).toEqual({
      1: { id: 1, rules: { 10: { formula: "x" }, 20: { formula: "y" } } },
      2: { id: 2, rules: { 10: { formula: "z" } } },
    });
  });

  it("handles a hidden key field in a nested group", () => {
    const rows = [
      { id: 1, rule_id: 10, formula: "x" },
      { id: 1, rule_id: 20, formula: "y" },
      { id: 2, rule_id: 10, formula: "z" },
    ];

    const fields: Field[] = [
      "id",
      [{ name: "rules", object: false }, [{ key: "rule_id", hide: true }, "formula"]],
    ];

    expect(objectify(rows, fields)).toEqual([
      { id: 1, rules: [{ formula: "x" }, { formula: "y" }] },
      { id: 2, rules: [{ formula: "z" }] },
    ]);

    expect(objectify(rows, fields, true)).toEqual({
      1: { id: 1, rules: [{ formula: "x" }, { formula: "y" }] },
      2: { id: 2, rules: [{ formula: "z" }] },
    });
  });

  it("returns null when json=true and value is not a string", () => {
    type JsonInput = {
      id: number;
      payload: unknown;
    };
    type JsonResult = {
      id: number;
      payload: { ok: boolean } | null;
    };

    const rows: JsonInput[] = [
      { id: 1, payload: { ok: true } },
      { id: 2, payload: 123 },
    ];
    const fields: Field<JsonResult, JsonInput>[] = ["id", { key: "payload", json: true }];

    expect(objectify(rows, fields)).toEqual([
      { id: 1, payload: null },
      { id: 2, payload: 123 },
    ]);
  });
});
