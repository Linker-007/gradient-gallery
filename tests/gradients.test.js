import { describe, expect, it } from "vitest";
import { GRADIENT_FAMILIES, filterGradients, gradients } from "../src/gradients";

const allowedFamilies = ["warm", "pink", "purple", "blue", "teal", "green", "neutral"];

describe("gradient data", () => {
  it("contains at least 40 gradients", () => {
    expect(gradients.length).toBeGreaterThanOrEqual(40);
  });

  it("uses unique names and slugs", () => {
    expect(new Set(gradients.map((gradient) => gradient.name)).size).toBe(gradients.length);
    expect(new Set(gradients.map((gradient) => gradient.slug)).size).toBe(gradients.length);
  });

  it("uses valid family names", () => {
    expect(GRADIENT_FAMILIES).toEqual(["all", ...allowedFamilies]);
    expect(gradients.every((gradient) => allowedFamilies.includes(gradient.family))).toBe(true);
  });

  it("contains valid colors and ordered stops", () => {
    for (const gradient of gradients) {
      expect(gradient.stops.length).toBeGreaterThanOrEqual(2);
      expect(gradient.stops[0].position).toBe(0);
      expect(gradient.stops.at(-1).position).toBe(100);

      for (const stop of gradient.stops) {
        expect(stop.color).toMatch(/^#[0-9a-f]{6}$/);
        expect(Number.isFinite(stop.position)).toBe(true);
      }

      for (let index = 1; index < gradient.stops.length; index += 1) {
        expect(gradient.stops[index].position).toBeGreaterThan(gradient.stops[index - 1].position);
      }
    }
  });
});

describe("filterGradients", () => {
  it("returns all gradients for the all family", () => {
    expect(filterGradients("all")).toEqual(gradients);
  });

  it("returns only gradients matching a family", () => {
    const result = filterGradients("blue");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((gradient) => gradient.family === "blue")).toBe(true);
  });

  it("returns an empty array for an unknown family", () => {
    expect(filterGradients("unknown")).toEqual([]);
  });
});
