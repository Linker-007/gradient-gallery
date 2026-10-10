import { describe, expect, it } from "vitest";
import {
  computeFlyerRect,
  computeFlyerTransform,
  createPreviewController,
  parseScaleFromTransform,
  viewportDiagonal
} from "../src/preview-animation";

const VIEWPORT = { width: 1000, height: 700 };
// 中心 (500, 350) 恰为视口中心
const CENTER_RECT = { left: 440, top: 290, width: 120, height: 120 };
const CORNER_RECT = { left: 850, top: 20, width: 110, height: 110 };
const TOP_MID_RECT = { left: 430, top: 0, width: 120, height: 120 };

/**
 * 终态是否铺满视口。
 *
 * flyer 是 border-radius:50% 的圆，所以必须检查**圆本身**是否包住
 * 视口四角——只比外接矩形会漏判：圆的外接矩形可以盖住视口，
 * 但四个角仍落在圆外（这正是曾经出现的 bug）。
 */
function coversViewport(result, sourceRect, viewport) {
  const cx = sourceRect.left + sourceRect.width / 2 + result.x;
  const cy = sourceRect.top + sourceRect.height / 2 + result.y;
  const radius = (sourceRect.width * result.scale) / 2;

  const corners = [
    [0, 0],
    [viewport.width, 0],
    [0, viewport.height],
    [viewport.width, viewport.height]
  ];

  return corners.every(([x, y]) => Math.hypot(x - cx, y - cy) <= radius);
}

/** 圆心是否落在视口中心（居中是圆形铺满的必要条件）。 */
function circleCentred(result, sourceRect, viewport) {
  const cx = sourceRect.left + sourceRect.width / 2 + result.x;
  const cy = sourceRect.top + sourceRect.height / 2 + result.y;

  return (
    Math.abs(cx - viewport.width / 2) < 0.001 &&
    Math.abs(cy - viewport.height / 2) < 0.001
  );
}

describe("viewportDiagonal", () => {
  it("computes the diagonal of a viewport", () => {
    expect(viewportDiagonal({ width: 800, height: 600 })).toBe(1000);
  });
});

describe("computeFlyerTransform", () => {
  it("centres a centred source with no translation", () => {
    const result = computeFlyerTransform(CENTER_RECT, VIEWPORT);

    expect(result.x).toBeCloseTo(0, 6);
    expect(result.y).toBeCloseTo(0, 6);
  });

  it("translates an off-centre source to the viewport centre", () => {
    const result = computeFlyerTransform(CORNER_RECT, VIEWPORT);

    // 色块中心 (905, 75) → 视口中心 (500, 350)
    expect(result.x).toBeCloseTo(500 - 905, 6);
    expect(result.y).toBeCloseTo(350 - 75, 6);
  });

  it("covers the viewport for a centred source", () => {
    const result = computeFlyerTransform(CENTER_RECT, VIEWPORT);

    expect(coversViewport(result, CENTER_RECT, VIEWPORT)).toBe(true);
    expect(circleCentred(result, CENTER_RECT, VIEWPORT)).toBe(true);
  });

  it("covers the viewport for a corner source", () => {
    const result = computeFlyerTransform(CORNER_RECT, VIEWPORT);

    expect(coversViewport(result, CORNER_RECT, VIEWPORT)).toBe(true);
    expect(circleCentred(result, CORNER_RECT, VIEWPORT)).toBe(true);
  });

  it("covers the viewport for a source touching the top edge", () => {
    const result = computeFlyerTransform(TOP_MID_RECT, VIEWPORT);

    expect(coversViewport(result, TOP_MID_RECT, VIEWPORT)).toBe(true);
    expect(circleCentred(result, TOP_MID_RECT, VIEWPORT)).toBe(true);
  });

  it("covers the viewport on portrait screens", () => {
    const viewport = { width: 390, height: 844 };
    const rect = { left: 30, top: 300, width: 150, height: 150 };

    const result = computeFlyerTransform(rect, viewport);

    expect(coversViewport(result, rect, viewport)).toBe(true);
    expect(circleCentred(result, rect, viewport)).toBe(true);
  });

  it("covers the viewport for every card position in a grid", () => {
    // 三行三列全覆盖，防止只测了中心点就以为没问题
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const rect = {
          left: 20 + col * 320,
          top: 20 + row * 220,
          width: 120,
          height: 120
        };

        const result = computeFlyerTransform(rect, VIEWPORT);

        expect(coversViewport(result, rect, VIEWPORT)).toBe(true);
        expect(circleCentred(result, rect, VIEWPORT)).toBe(true);
      }
    }
  });

  it("scales larger for sources farther from the centre", () => {
    const center = computeFlyerTransform(CENTER_RECT, VIEWPORT);
    const corner = computeFlyerTransform(CORNER_RECT, VIEWPORT);

    expect(corner.scale).toBeGreaterThan(center.scale);
  });

  it("applies overshoot to avoid hairline seams", () => {
    const exact = computeFlyerTransform(CENTER_RECT, VIEWPORT, 1);
    const padded = computeFlyerTransform(CENTER_RECT, VIEWPORT, 1.02);

    expect(padded.scale / exact.scale).toBeCloseTo(1.02, 5);
  });

  it("handles non-square sources via the longer side", () => {
    const rect = { left: 100, top: 100, width: 200, height: 60 };

    const result = computeFlyerTransform(rect, VIEWPORT);

    expect(coversViewport(result, rect, VIEWPORT)).toBe(true);
    expect(circleCentred(result, rect, VIEWPORT)).toBe(true);
  });

  it("rejects degenerate rectangles", () => {
    expect(() =>
      computeFlyerTransform({ left: 0, top: 0, width: 0, height: 0 }, VIEWPORT)
    ).toThrow(RangeError);
  });

  it("produces a circle that encloses all four corners when centred", () => {
    // 圆心居中时，半径必须 ≥ 视口半对角线才能包住四角。
    // 只按 max(宽,高) 算会短 20% 左右，四角露灰。
    const result = computeFlyerTransform(CENTER_RECT, VIEWPORT);
    const diameter = CENTER_RECT.width * result.scale;

    expect(diameter).toBeGreaterThanOrEqual(viewportDiagonal(VIEWPORT));
    expect(coversViewport(result, CENTER_RECT, VIEWPORT)).toBe(true);
  });

  it("keeps the circle covering the viewport on portrait screens", () => {
    const viewport = { width: 390, height: 844 };
    const rect = { left: 130, top: 300, width: 132, height: 132 };
    const result = computeFlyerTransform(rect, viewport);

    expect(rect.width * result.scale).toBeGreaterThanOrEqual(viewportDiagonal(viewport));
    expect(coversViewport(result, rect, viewport)).toBe(true);
  });

  it("overshoots past the viewport corners to avoid hairline seams", () => {
    const result = computeFlyerTransform(CENTER_RECT, VIEWPORT);
    const diameter = CENTER_RECT.width * result.scale;

    // 1.02 的余量用来吃掉子像素锯齿，不宜过大
    expect(diameter).toBeGreaterThan(viewportDiagonal(VIEWPORT));
    expect(diameter).toBeLessThan(viewportDiagonal(VIEWPORT) * 1.1);
  });

  it("encloses corners for a wide viewport where the short side is much smaller", () => {
    // 最容易漏判的形状：宽扁视口，四角离圆心远
    const viewport = { width: 1920, height: 480 };
    const rect = { left: 900, top: 174, width: 120, height: 120 };
    const result = computeFlyerTransform(rect, viewport);

    expect(coversViewport(result, rect, viewport)).toBe(true);
  });
});

describe("computeFlyerRect", () => {
  it("keeps the source geometry so scale(1) looks identical", () => {
    const rect = { left: 120, top: 240, width: 132, height: 132 };
    const result = computeFlyerRect(rect);

    expect(result).toEqual({ left: 120, top: 240, width: 132, height: 132 });
  });

  it("does not clamp offscreen sources into view", () => {
    // 收窄会让 flyer 偏离原始色块，产生可见跳变
    const result = computeFlyerRect({ left: -500, top: -300, width: 100, height: 100 });

    expect(result.left).toBe(-500);
    expect(result.top).toBe(-300);
  });
});

describe("parseScaleFromTransform", () => {
  it("returns 1 for no transform", () => {
    expect(parseScaleFromTransform("none")).toBe(1);
    expect(parseScaleFromTransform("")).toBe(1);
    expect(parseScaleFromTransform(null)).toBe(1);
  });

  it("reads scale from a 2D matrix", () => {
    expect(parseScaleFromTransform("matrix(2.5, 0, 0, 2.5, 10, 20)")).toBe(2.5);
  });

  it("reads scale from a 3D matrix", () => {
    expect(
      parseScaleFromTransform("matrix3d(3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1)")
    ).toBe(3);
  });

  it("reads a bare scale function", () => {
    expect(parseScaleFromTransform("scale(1.75)")).toBe(1.75);
  });

  it("takes the absolute value", () => {
    expect(parseScaleFromTransform("matrix(-2, 0, 0, -2, 0, 0)")).toBe(2);
  });
});

describe("createPreviewController", () => {
  it("skips animation when reduced motion is on", () => {
    const controller = createPreviewController({ isReducedMotion: () => true });

    expect(controller.shouldAnimate()).toBe(false);
  });

  it("animates by default", () => {
    expect(createPreviewController().shouldAnimate()).toBe(true);
  });

  it("ignores repeated open calls so the animation is not interrupted", () => {
    const controller = createPreviewController();

    expect(controller.beginOpen()).toBe(true);
    expect(controller.beginOpen()).toBe(false);
    expect(controller.beginOpen()).toBe(false);
  });

  it("ignores repeated close calls", () => {
    const controller = createPreviewController();

    expect(controller.beginClose()).toBe(false);
    expect(controller.beginClose()).toBe(false);
  });

  it("allows close right after open", () => {
    const controller = createPreviewController();

    controller.beginOpen();
    expect(controller.beginClose()).toBe(true);
  });

  it("transitions closed → opening → open", () => {
    const controller = createPreviewController();

    expect(controller.state).toBe("closed");
    controller.beginOpen();
    expect(controller.state).toBe("opening");
    controller.finishOpen();
    expect(controller.state).toBe("open");
  });

  it("ignores finishOpen when closing", () => {
    const controller = createPreviewController();

    controller.beginOpen();
    controller.beginClose();
    controller.finishOpen();
    expect(controller.state).toBe("closing");
  });

  it("retargets mid-animation without losing the opening state", () => {
    const controller = createPreviewController();

    controller.beginOpen();
    controller.retarget(9);
    expect(controller.state).toBe("opening");
    expect(controller.targetScale).toBe(9);
  });

  it("records the target scale passed to beginOpen", () => {
    const controller = createPreviewController();

    controller.beginOpen(7.5);
    expect(controller.targetScale).toBe(7.5);
  });

  it("does not overwrite the target when beginOpen is called without a scale", () => {
    const controller = createPreviewController();

    controller.beginOpen(4);
    controller.finishOpen();
    controller.beginOpen();
    expect(controller.targetScale).toBe(4);
  });

  it("sets target to 1 when closing", () => {
    const controller = createPreviewController();

    controller.beginOpen(8);
    controller.finishOpen();
    controller.beginClose();
    expect(controller.targetScale).toBe(1);
  });

  it("commits and cancels the tracked animation on settle", () => {
    const controller = createPreviewController();
    let cancelled = false;

    controller.register({
      commitStyles() {},
      cancel() {
        cancelled = true;
      }
    });

    controller.settle();
    expect(cancelled).toBe(true);
  });

  it("swallows commitStyles errors when the element is not rendered", () => {
    const controller = createPreviewController();
    let cancelled = false;

    controller.register({
      commitStyles() {
        throw new Error("Target element is not rendered.");
      },
      cancel() {
        cancelled = true;
      }
    });

    expect(() => controller.settle()).not.toThrow();
    expect(cancelled).toBe(true);
  });
});
