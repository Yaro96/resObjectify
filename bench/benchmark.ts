import { performance } from "node:perf_hooks";

import { objectify, objectifyFast, type Fields } from "../index";

type BenchConfig = {
  roots: number;
  rules: number;
  meters: number;
  areas: number;
  iterations: number;
  samples: number;
};

const config: BenchConfig = {
  roots: Number(process.env.ROOTS ?? 100),
  rules: Number(process.env.RULES ?? 3),
  meters: Number(process.env.METERS ?? 4),
  areas: Number(process.env.AREAS ?? 5),
  iterations: Number(process.env.ITERATIONS ?? 25),
  samples: Number(process.env.SAMPLES ?? 5),
};

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

const data = makeData(config);
console.log(data)

const baseline = objectify(data, fields);
const fast = objectifyFast(data, fields);

if (JSON.stringify(baseline) !== JSON.stringify(fast)) {
  throw new Error("objectify and objectifyFast outputs differ");
}

console.log(
  `Rows: ${data.length}, roots: ${config.roots}, rules: ${config.rules}, meters: ${config.meters}, areas: ${config.areas}`,
);
console.log(
  `Samples: ${config.samples}, iterations per sample: ${config.iterations}`,
);

runBench("objectify (recursion)", () => objectify(data, fields), config);
runBench("objectifyFast (grouped)", () => objectifyFast(data, fields), config);

function runBench(label: string, fn: () => unknown, cfg: BenchConfig) {
  // Warm-up
  for (let i = 0; i < 3; i++) {
    fn();
  }

  const times: number[] = [];
  for (let i = 0; i < cfg.samples; i++) {
    const start = performance.now();
    for (let j = 0; j < cfg.iterations; j++) {
      fn();
    }
    const end = performance.now();
    times.push((end - start) / cfg.iterations);
  }

  const min = Math.min(...times);
  const max = Math.max(...times);
  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;

  console.log(
    `${label}: avg ${avg.toFixed(3)}ms (min ${min.toFixed(3)}ms, max ${max.toFixed(3)}ms)`,
  );
}

function makeData(cfg: BenchConfig) {
  const rows: Array<Record<string, unknown>> = [];
  for (let r = 0; r < cfg.roots; r++) {
    const id = 1000 + r;
    const code = `code-${r % 10}`;
    const name = `name-${r % 5}`;
    const meta = JSON.stringify({ tier: r % 3, active: r % 2 === 0 });
    for (let rule = 1; rule <= cfg.rules; rule++) {
      const formula = rule % 2 === 0 ? null : `rule-${rule}`;
      for (let meter = 0; meter < cfg.meters; meter++) {
        for (let area = 0; area < cfg.areas; area++) {
          rows.push({
            id,
            code,
            name,
            rule_id: rule,
            formula,
            meter_id: meter + 1,
            area_id: area + 1,
            meta,
          });
        }
      }
    }
  }
  return shuffle(rows);
}

function shuffle<T>(items: T[]) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
