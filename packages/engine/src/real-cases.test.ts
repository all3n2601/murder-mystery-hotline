import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCase } from "./case.js";

const CASES = join(import.meta.dirname, "../../../cases");

describe("shipped case packs", () => {
  for (const dir of readdirSync(CASES)) {
    it(`${dir} passes the validator`, () => {
      const r = loadCase(JSON.parse(readFileSync(join(CASES, dir, "case.json"), "utf8")));
      expect(r.ok ? [] : r.errors).toEqual([]);
    });
  }
});
