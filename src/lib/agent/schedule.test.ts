import { describe, expect, it } from "vitest";
import { isDue } from "./schedule";

// Lagos is UTC+1 all year.
const at = (iso: string) => new Date(iso).getTime();

describe("isDue", () => {
  it("never runs when off", () => expect(isDue("off", null)).toBe(false));
  it("runs hourly", () => {
    expect(isDue("hourly", null)).toBe(true);
    expect(isDue("hourly", at("2026-11-22T10:00:00Z"), at("2026-11-22T10:30:00Z"))).toBe(false);
    expect(isDue("hourly", at("2026-11-22T10:00:00Z"), at("2026-11-22T11:00:00Z"))).toBe(true);
  });
  it("runs daily once after the target local time", () => {
    // 08:00 Lagos = 07:00 UTC
    expect(isDue("daily@08:00", null, at("2026-11-22T06:59:00Z"))).toBe(false);
    expect(isDue("daily@08:00", null, at("2026-11-22T07:01:00Z"))).toBe(true);
    expect(isDue("daily@08:00", at("2026-11-22T07:01:00Z"), at("2026-11-22T15:00:00Z"))).toBe(false);
    expect(isDue("daily@08:00", at("2026-11-22T07:01:00Z"), at("2026-11-23T07:05:00Z"))).toBe(true);
  });
});
