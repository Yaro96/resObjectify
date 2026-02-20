import { describe, expect, it } from "vitest";
import { type Fields, objectify } from "../index";

// biome-ignore format: list
const data = [
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

const fields: Fields = [
	{ key: "id", as: "area_id" },
	{ key: "code", as: "area_code" },
	"name",
	{ key: "meta", json: true },
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
		expect(objectify(data, fields, true)).toEqual({
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
