/**
 * 全屏预览的缩放动画逻辑。
 *
 * 做法是 FLIP：把被点击的圆形色块"克隆"成一个与原元素等大的 flyer，
 * 用 transform: scale() 放大到覆盖整个视口。原始色块在动画全程保持可见，
 * flyer 的终态就是全屏层本身，因此衔接处没有任何跳变。
 *
 * 本模块只做纯计算，不碰 DOM，便于单测。
 */

/** 视口对角线长度——圆要包住四角，半径下限就是它的一半。 */
export function viewportDiagonal(viewport) {
  return Math.hypot(viewport.width, viewport.height);
}

/**
 * 计算放大后的 transform。
 *
 * 只 scale 不够：放大围绕色块自身中心，而色块通常偏离视口中心，
 * 放大后 flyer 中心仍停在色块中心，圆就盖不住视口。所以放大后
 * 再平移，把圆心移到视口中心。
 *
 * 倍数按**圆心到视口最远角的距离**算——要让圆包住四个角，
 * 半径必须 ≥ 圆心到对角顶点的距离，**不是** max(宽, 高)/2
 * （那是方形的要求）。色块偏离中心时最远角会变远，倍数自动加大。
 *
 * 返回 { scale, x, y }，其中 x/y 是 translate 的像素值（向上为负）。
 */
export function computeFlyerTransform(sourceRect, viewport, overshoot = 1.02) {
  const size = Math.max(sourceRect.width, sourceRect.height);

  if (!(size > 0)) {
    throw new RangeError("sourceRect 必须有正尺寸");
  }

  const center = {
    x: sourceRect.left + sourceRect.width / 2,
    y: sourceRect.top + sourceRect.height / 2
  };

  const viewCenter = {
    x: viewport.width / 2,
    y: viewport.height / 2
  };

  // 圆心偏离视口中心的距离 + 视口半对角线 = 圆心到最远角的距离
  const reach =
    Math.hypot(center.x - viewCenter.x, center.y - viewCenter.y) +
    viewportDiagonal(viewport) / 2;

  const scale = (reach * 2 * overshoot) / size;

  return {
    scale,
    x: viewCenter.x - center.x,
    y: viewCenter.y - center.y
  };
}

/**
 * 把源元素矩形换算成 fixed 定位的 left/top/width/height。
 * 这里不做视口内收窄——收窄会让 flyer 偏离原始色块，反而产生跳变。
 * 元素在视口外时照样按原坐标放，scale(1) 阶段自然不可见。
 */
export function computeFlyerRect(rect) {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

/**
 * 从 computed transform 里解出当前缩放倍数与位移。
 * 动画中途要据此反向动画，所以必须读实际渲染值而不是我们记录的起点。
 * matrix(a, b, c, d, tx, ty) 的 a 即 scaleX，tx/ty 即位移；
 * 无 transform 时按 { scale: 1, x: 0, y: 0 } 处理。
 */
export function parseTransform(transform) {
  if (!transform || transform === "none") {
    return { scale: 1, x: 0, y: 0 };
  }

  const matrix = transform.match(/^matrix(3d)?\((.+)\)$/);

  if (!matrix) {
    const scale = transform.match(/^scale\(([\d.]+)\)$/);
    return scale
      ? { scale: Number(scale[1]), x: 0, y: 0 }
      : { scale: 1, x: 0, y: 0 };
  }

  const values = matrix[2].split(",").map((value) => Number(value.trim()));
  const is3d = matrix[1] === "3d";

  return {
    scale: Number.isFinite(values[0]) ? Math.abs(values[0]) : 1,
    x: is3d ? (Number.isFinite(values[12]) ? values[12] : 0) : (Number.isFinite(values[4]) ? values[4] : 0),
    y: is3d ? (Number.isFinite(values[13]) ? values[13] : 0) : (Number.isFinite(values[5]) ? values[5] : 0)
  };
}

/** 只要 scale 的便捷封装。 */
export function parseScaleFromTransform(transform) {
  return parseTransform(transform).scale;
}

/**
 * 缩放动画的状态机。可安全重入：
 * - 展开中重复调用 open，忽略（不会打断已在跑的动画）
 * - 收起中重复调用 close，忽略
 * - 展开中调用 close，先取当前实际缩放值再反向，不产生跳变
 * - 展开中打开另一个配色，先把当前动画 commitStyles 固化，
 *   再从当前值平滑过渡到新配色的目标值，动画不中断
 */
export function createPreviewController({ isReducedMotion = () => false } = {}) {
  let state = "closed";
  let targetScale = 1;
  let active = null;

  function commit() {
    if (!active) {
      return;
    }

    try {
      // 元素 display:none（lightbox 关闭）时 commitStyles 会抛 InvalidStateError
      active.commitStyles();
    } catch {
      // 状态已由内联样式接管，固化失败无妨
    }

    active.cancel();
    active = null;
  }

  return {
    get state() {
      return state;
    },

    get targetScale() {
      return targetScale;
    },

    /** reduced-motion 下立即到位，不做任何补间。 */
    shouldAnimate() {
      return !isReducedMotion();
    },

    /** 动画开始前调用，返回是否应当继续播放动画。 */
    beginOpen(scale) {
      if (state === "open" || state === "opening") {
        return false;
      }

      if (typeof scale === "number") {
        targetScale = scale;
      }

      commit();
      state = "opening";
      return true;
    },

    /** 动画正常结束。 */
    finishOpen() {
      if (state === "opening") {
        state = "open";
      }
    },

    /** 关闭，返回是否应当播放反向动画。目标值固定为 1（收回原尺寸）。 */
    beginClose() {
      if (state === "closed" || state === "closing") {
        return false;
      }

      targetScale = 1;
      commit();
      state = "closing";
      return true;
    },

    finishClose() {
      state = "closed";
    },

    /** 切换到另一个配色：动画不中断，从当前值接着走。 */
    retarget(scale) {
      targetScale = scale;
      commit();
      state = "opening";
    },

    /** 落盘内联样式并清掉 fill 动画，回到「无动画」状态。 */
    settle() {
      commit();
    },

    register(animation) {
      active = animation;
    }
  };
}
