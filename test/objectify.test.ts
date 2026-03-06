import { describe, expect, it } from "vitest";
import { fieldsBuilder } from "../src/fieldsBuilder";
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

type ResultArray = {
  area_id: number;
  area_code: string;
  name: string;
  meta: { tier: number } | null;
  rules: {
    rule_id: number;
    rule: string | null;
    meters: number[];
    areas: number[];
  }[];
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
  it("builds nested arrays for rules, meters, and areas", () => {
    expect(objectify<ResultArray>(data, fields)).toEqual([
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
    expect(objectify<ResultObject>(data, fields, true)).toEqual({
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

  it("allow to group without a key field", () => {
    type Input = {
      eventType: string;
      eventCount: number;
      uniqueCount: number;
    };

    type Result = {
      totalEvents: { eventType: string; eventCount: number }[];
      uniqueEvents: { eventType: string; uniqueCount: number }[];
    };

    const fields: Field<Result, Input>[] = [
      ["totalEvents", ["eventType", "eventCount"]],
      ["uniqueEvents", ["eventType", "uniqueCount"]],
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
          { eventType: "click", eventCount: 10 },
          { eventType: "view", eventCount: 20 },
        ],
        uniqueEvents: [
          { eventType: "click", uniqueCount: 5 },
          { eventType: "view", uniqueCount: 10 },
        ],
      },
    ]);
  });

  it("allow to group without a key field", () => {
    type Input = {
      eventType: string;
      eventCount: number;
      uniqueCount: number;
    };

    type Result = {
      eventType: string;
      eventCounts: number[];
      uniqueCounts: number[];
    };

    const fields: Field<Result, Input>[] = [
      "eventType",
      ["eventCounts", ["eventCount"]],
      ["uniqueCounts", ["uniqueCount"]],
    ];

    const data: Input[] = [
      { eventType: "click", eventCount: 10, uniqueCount: 5 },
      { eventType: "view", eventCount: 20, uniqueCount: 10 },
      { eventType: "click", eventCount: 30, uniqueCount: 15 },
      { eventType: "view", eventCount: 40, uniqueCount: 20 },
    ];

    expect(objectify(data, fields)).toEqual([
      {
        eventType: "click",
        eventCounts: [10, 30],
        uniqueCounts: [5, 15],
      },
      {
        eventType: "view",
        eventCounts: [20, 40],
        uniqueCounts: [10, 20],
      },
    ]);
  });
});

describe("fieldsBuilder", () => {
  it("builds fields with plain keys", () => {
    const fields2 = fieldsBuilder<ResultObject, Input>()
      .field("id", "area_id")
      .field("code", "area_code")
      .field("name")
      .field("meta", { json: true })
      .group("rules", (g) =>
        g
          .field("rule_id")
          .field("formula", "rule")
          .group("meters", { object: true }, (g) => g.field("meter_id"))
          .group("areas", { object: false }, (g) => g.field("area_id")),
      )
      .build();

    expect(fields2).toEqual(fields);
  });

  it("builds fields without strict typing", () => {
    const fields2 = fieldsBuilder()
      .field("id", "area_id")
      .field("code", "area_code")
      .field("name")
      .field("meta", { json: true })
      .group("rules", (g) =>
        g
          .field("rule_id")
          .field("formula", "rule")
          .group("meters", { object: true }, (g) => g.field("meter_id"))
          .group("areas", { object: false }, (g) => g.field("area_id")),
      )
      .build();

    expect(fields2).toEqual(fields);
  });

  it("builds fields with object parameters", () => {
    const fields2 = fieldsBuilder()
      .field({ key: "id", as: "area_id" })
      .field({ key: "code", as: "area_code" })
      .field("name")
      .field({ key: "meta", json: true })
      .group("rules", (g) =>
        g
          .field("rule_id")
          .field({ key: "formula", as: "rule" })
          .group({ name: "meters", object: true }, (g) => g.field("meter_id"))
          .group({ name: "areas", object: false }, (g) => g.field("area_id")),
      )
      .build();

    expect(fields2).toEqual(fields);
  });

  it("builds fields with only result type", () => {
    const fields2 = fieldsBuilder<ResultArray>()
      .field("id", "area_id")
      .field("code", "area_code")
      .field("name")
      .field("meta", { json: true })
      .group("rules", (g) =>
        g
          .field("rule_id")
          .field("formula", "rule")
          .group("meters", { object: true }, (g) => g.field("meter_id"))
          .group("areas", { object: false }, (g) => g.field("area_id")),
      )
      .build();

    expect(fields2).toEqual(fields);
  });

  it("builds fields without a key field", () => {
    type Input = {
      eventType: string;
      eventCount: number;
      uniqueCount: number;
    };

    type Result = {
      totalEvents: { event: string; eventCount: number }[];
      uniqueEvents: { event: string; uniqueCount: number }[];
    };

    const fields2 = fieldsBuilder<Result, Input>()
      .group("totalEvents", (g) => g.field("eventType", "event").field("eventCount"))
      .group("uniqueEvents", (g) => g.field("eventType", "event").field("uniqueCount"))
      .build();

    expect(fields2).toEqual([
      ["totalEvents", [{ key: "eventType", as: "event" }, "eventCount"]],
      ["uniqueEvents", [{ key: "eventType", as: "event" }, "uniqueCount"]],
    ]);
  });
});
