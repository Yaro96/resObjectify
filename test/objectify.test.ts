import { describe, expect, it } from "vitest";
import { type Fields, objectify } from "../index";

// biome-ignore format: list
const data = [
  { id: 111, code: 'aaa', name: "prova", rule_id: 1, formula: "asd", meter_id: 8, area_id: 31 },
  { id: 111, code: 'aaa', name: "prova", rule_id: 2, formula: "sad", meter_id: 9, area_id: 95 },
  { id: 111, code: 'aaa', name: "prova", rule_id: 1, formula: "asd", meter_id: 10, area_id: 31 },
  { id: 111, code: 'aaa', name: "prova", rule_id: 1, formula: "asd", meter_id: 10, area_id: 95 },
  { id: 111, code: 'aaa', name: "prova", rule_id: 2, formula: "sad", meter_id: 10, area_id: 95 }
]

const fields: Fields = [
  { key: "id", as: "area_id" },
  { key: "code", as: "area_code" },
  "name",
  [
    "rules",
    [
      "rule_id",
      { key: "formula", as: "rule" },
      [{ name: "meters", object: true }, [{ key: "meter_id", as: "id" }]],
      [{ name: "areas", object: false }, ["area_id"]],
    ],
  ],
];

describe("objectify", () => {
  it("builds nested arrays for rules, meters, and areas", () => {
    expect(objectify(data, fields)).toEqual([
      {
        area_id: 111,
        area_code: "aaa",
        name: "prova",
        rules: [
          { rule_id: 1, rule: "asd", meters: [8, 10], areas: [31, 95] },
          { rule_id: 2, rule: "sad", meters: [9, 10], areas: [95] },
        ],
      },
    ]);
  });

  it("returns an object map when object=true", () => {
    expect(objectify(data, fields, true)).toEqual({
      111: {
        area_id: 111,
        area_code: "aaa",
        name: "prova",
        rules: {
          1: { rule_id: 1, rule: "asd", meters: [8, 10], areas: [31, 95] },
          2: { rule_id: 2, rule: "sad", meters: [9, 10], areas: [95] },
        },
      },
    });
  });

  it("parses json fields when json=true", () => {
    const arr = [
      { id: 1, payload: '{"value":42}' },
      { id: 2, payload: null },
    ];

    const fields: Fields = ["id", { key: "payload", json: true }];

    expect(objectify(arr, fields)).toEqual([
      { id: 1, payload: { value: 42 } },
      { id: 2, payload: null },
    ]);
  });
});
