import { describe, expect, it } from "vitest";
import { fieldsBuilder } from "../src/fieldsBuilder";
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

describe("fieldsBuilder", () => {
  it("builds fields with a single field", () => {
    const fields2 = fieldsBuilder<ResultObject, Input>().field("id").build();
    expect(fields2).toEqual(["id"]);
  });

  it("builds group with a single field", () => {
    const fields2 = fieldsBuilder<ResultObject, Input>()
      .group("rules", (g) => g.field("rule_id"))
      .build();
    expect(fields2).toEqual([["rules", ["rule_id"]]]);
  });

  it("builds group without fields", () => {
    const fields2 = fieldsBuilder<ResultObject, Input>()
      .group("rules", (g) => g)
      .build();
    expect(fields2).toEqual([["rules", []]]);
  });

  it("builds group with nested group without fields", () => {
    const fields2 = fieldsBuilder<ResultObject, Input>()
      .group("rules", (g) => g.group("meters", (g) => g))
      .build();
    expect(fields2).toEqual([["rules", [["meters", []]]]]);
  });

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
      .group("totalEvents", { object: false }, (g) =>
        g.field("eventType", "event").field("eventCount"),
      )
      .group("uniqueEvents", (g) => g.field("eventType", "event").field("uniqueCount"))
      .build();

    expect(fields2).toEqual([
      [{ name: "totalEvents", object: false }, [{ key: "eventType", as: "event" }, "eventCount"]],
      ["uniqueEvents", [{ key: "eventType", as: "event" }, "uniqueCount"]],
    ]);
  });

  it("builds a hidden field via shorthand options", () => {
    const fields2 = fieldsBuilder().field("id", { hide: true }).build();
    expect(fields2).toEqual([{ key: "id", hide: true }]);
  });

  it("builds a hidden field via object form", () => {
    const fields2 = fieldsBuilder().field({ key: "id", hide: true }).build();
    expect(fields2).toEqual([{ key: "id", hide: true }]);
  });

  it("builds a hidden field combined with as and json", () => {
    const fields2 = fieldsBuilder()
      .field("id", "area_id", { hide: true })
      .field("meta", { json: true })
      .build();
    expect(fields2).toEqual([
      { key: "id", as: "area_id", hide: true },
      { key: "meta", json: true },
    ]);
  });

  it("keeps empty-string alias values", () => {
    const fields2 = fieldsBuilder().field("id", "").build();
    expect(fields2).toEqual([{ key: "id", as: "" }]);
  });

  it("returns a snapshot from build()", () => {
    const builder = fieldsBuilder<ResultObject, Input>().field("id");
    const first = builder.build();
    builder.field("name");
    const second = builder.build();

    expect(first).toEqual(["id"]);
    expect(second).toEqual(["id", "name"]);
  });
});
