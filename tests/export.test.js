import { describe, expect, it } from "vitest";
import {
  allGradientsToCss,
  allGradientsToJson,
  gradientToClassCss,
  gradientToCss,
  gradientToJson
} from "../src/export";
import { gradients } from "../src/gradients";

describe("gradient export", () => {
  const gradient = gradients[0];

  it("creates a copyable CSS property", () => {
    expect(gradientToCss(gradient)).toBe(
      "background-image: linear-gradient(45deg, #ff9a9e 0%, #fad0c4 100%);"
    );
  });

  it("creates a reusable CSS class", () => {
    expect(gradientToClassCss(gradient)).toBe(
      ".gradient-warm-flame {\n  background-image: linear-gradient(45deg, #ff9a9e 0%, #fad0c4 100%);\n}"
    );
  });

  it("creates structured JSON", () => {
    const parsed = JSON.parse(gradientToJson(gradient));

    expect(parsed).toEqual({
      name: "Warm Flame",
      slug: "warm-flame",
      family: "warm",
      angle: 45,
      stops: [
        { color: "#ff9a9e", position: 0 },
        { color: "#fad0c4", position: 100 }
      ],
      css: "background-image: linear-gradient(45deg, #ff9a9e 0%, #fad0c4 100%);"
    });
  });

  it("creates full CSS and JSON exports", () => {
    const css = allGradientsToCss(gradients);
    const json = JSON.parse(allGradientsToJson(gradients));

    expect(css.split("}").length - 1).toBe(gradients.length);
    expect(Object.keys(json)).toEqual(gradients.map((item) => item.slug));
    expect(json["warm-flame"].name).toBe("Warm Flame");
  });
});
