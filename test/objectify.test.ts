import { describe, expect, test } from "vitest";
import objectify from "../index";

describe("objectify", () => {
  test("builds nested arrays for rules, meters, and areas", () => {
    const arr = [
      {
        id: 111,
        code: "aaa",
        name: "prova",
        rule_id: 1,
        formula: "asd",
        meter_id: 8,
        area_id: 31,
      },
      {
        id: 111,
        code: "aaa",
        name: "prova",
        rule_id: 1,
        formula: "asd",
        meter_id: 8,
        area_id: 95,
      },
      {
        id: 111,
        code: "aaa",
        name: "prova",
        rule_id: 1,
        formula: "asd",
        meter_id: 10,
        area_id: 31,
      },
      {
        id: 111,
        code: "aaa",
        name: "prova",
        rule_id: 1,
        formula: "asd",
        meter_id: 10,
        area_id: 95,
      },
      {
        id: 111,
        code: "aaa",
        name: "prova",
        rule_id: 2,
        formula: "asd",
        meter_id: 10,
        area_id: 95,
      },
    ];

    const fields = [
      { key: "id", as: "area_id" },
      { key: "code", as: "area_code" },
      "name",
      [
        "rules",
        [
          "rule_id",
          { key: "formula", as: "rule" },
          [
            { name: "meters", object: true },
            [
              { key: "meter_id", as: "id" }
            ],
          ],
          [
            { name: "areas", object: false },
            [
              "area_id"
            ],
          ],
        ],
      ],
    ] as const;

    expect(objectify(arr, fields)).toEqual([
      {
        area_id: 111,
        area_code: "aaa",
        name: "prova",
        rules: [
          { rule_id: 1, rule: "asd", meters: [8, 10], areas: [31, 95] },
          { rule_id: 2, rule: "asd", meters: [10], areas: [95] },
        ],
      },
    ]);
  });

  test("returns an object map when object=true", () => {
    const arr = [
      { id: 1, name: "alpha" },
      { id: 2, name: "beta" },
    ];

    const fields = [{ key: "id", as: "id" }, "name"] as const;

    expect(objectify(arr, fields, true)).toEqual({
      1: { id: 1, name: "alpha" },
      2: { id: 2, name: "beta" },
    });
  });

  test("parses json fields when json=true", () => {
    const arr = [
      { id: 1, payload: "{\"value\":42}" },
      { id: 2, payload: null },
    ];

    const fields = ["id", { key: "payload", json: true }] as const;

    expect(objectify(arr, fields)).toEqual([
      { id: 1, payload: { value: 42 } },
      { id: 2, payload: null },
    ]);
  });
});
