import "./style.css";
import { GRADIENT_FAMILIES, filterGradients } from "./gradients";
import {
  allGradientsToCss,
  allGradientsToJson,
  gradientToCss,
  gradientToJson
} from "./export";
import { renderCards, renderFilters } from "./ui";
import {
  computeFlyerTransform,
  createPreviewController,
  parseTransform
} from "./preview-animation";

const FAMILY_LABELS = {
  all: "全部",
  warm: "暖色",
  pink: "粉色",
  purple: "紫色",
  blue: "蓝色",
  teal: "青色",
  green: "绿色",
  neutral: "中性"
};

const COPY_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1.5" width="9" height="11" rx="2"/><path d="M10.5 12.5v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1"/></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9"/></svg>`;

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="app-shell">
    <nav class="filter-bar" aria-label="按色系筛选">
      <div class="filters" id="filters" role="group"></div>
    </nav>

    <section class="gallery" id="gallery"></section>
    <p class="empty-state" id="empty-state" hidden>没有匹配的配色</p>
  </main>

  <div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true">
    <div class="flyer" id="flyer" aria-hidden="true"></div>
    <button class="lightbox-copy" id="lightbox-copy" type="button" title="复制 CSS" aria-label="复制 CSS">${COPY_ICON}</button>
    <button class="lightbox-close" id="lightbox-close" type="button" title="关闭" aria-label="关闭预览">${CLOSE_ICON}</button>
    <p class="lightbox-name" id="lightbox-name"></p>
  </div>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`;

const filtersEl = document.querySelector("#filters");
const galleryEl = document.querySelector("#gallery");
const emptyEl = document.querySelector("#empty-state");
const lightboxEl = document.querySelector("#lightbox");
const flyerEl = document.querySelector("#flyer");
const lightboxName = document.querySelector("#lightbox-name");
const toastEl = document.querySelector("#toast");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const controller = createPreviewController({
  isReducedMotion: () => reducedMotion.matches
});

let activeFamily = "all";
let previewSlug = null;
let reducedMotionListenerBound = false;

function visibleGradients() {
  return filterGradients(activeFamily);
}

function render() {
  const items = visibleGradients();

  filtersEl.innerHTML = renderFilters(GRADIENT_FAMILIES, activeFamily, FAMILY_LABELS);
  galleryEl.innerHTML = renderCards(items);
  emptyEl.hidden = items.length > 0;
}

function findBySlug(slug) {
  return visibleGradients().find((gradient) => gradient.slug === slug);
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

let toastTimer = 0;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove("is-visible");
  }, 1600);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 权限被拒时回退
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  textarea.remove();
  return ok;
}

async function handleCopy(slug) {
  const gradient = findBySlug(slug);

  if (!gradient) {
    return;
  }

  const ok = await copyText(gradientToCss(gradient));
  showToast(ok ? `已复制 ${gradient.name}` : "复制失败");
}

const cssValue = (gradient) =>
  gradientToCss(gradient).replace("background-image: ", "").replace(/;$/, "");

/** 读取 flyer 当前实际渲染的 transform（scale + 位移）。 */
function currentFlyerTransform() {
  return parseTransform(window.getComputedStyle(flyerEl).transform);
}

/** 把 {scale,x,y} 组装成 transform 字符串。 */
function transformOf({ scale, x, y }) {
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

/** 找出卡片里真正显示的那个圆（不是外层 preview 容器）。 */
function orbOf(sourceEl) {
  return sourceEl.querySelector(".gradient-orb") || sourceEl;
}

function placeFlyer(gradient, sourceEl) {
  // 动画主体必须与卡片里的**圆**同尺寸同位置：外层 .gradient-preview
  // 是矩形容器，直接拿它当 flyer 会被 border-radius 拉成椭圆。
  const orb = orbOf(sourceEl);

  // 先量圆的位置：一旦显示 lightbox 并锁 body 滚动就会重排，
  // 此时量到的是旧值，动画起点会与色块错位。
  const rect = orb.getBoundingClientRect();

  // 圆必须先显示 lightbox 才量得到真实视口（移动端 100dvh / 安全区）
  lightboxEl.hidden = false;
  const boxRect = lightboxEl.getBoundingClientRect();
  const viewport = {
    width: boxRect.width || window.innerWidth,
    height: boxRect.height || window.innerHeight
  };

  const live = orb.getBoundingClientRect();
  const target = computeFlyerTransform(live, viewport);

  Object.assign(flyerEl.style, {
    left: `${live.left}px`,
    top: `${live.top}px`,
    width: `${live.width}px`,
    height: `${live.height}px`,
    backgroundImage: cssValue(gradient)
  });

  return target;
}

/** 与 scale 对应的零位移起点。 */
function originTransform() {
  return transformOf({ scale: 1, x: 0, y: 0 });
}

/**
 * 缩放动画。transform-origin 取几何中心（CSS 默认 50% 50%），
 * 与需求一致：色块从自身中心放大。
 *
 * 每一帧都是 `translate + scale` 的组合：位移把放大的圆拉回视口中心，
 * 缩放负责铺满。两者同时补间。
 *
 * 时长用 --dur-fast（160ms）而非 --dur-slow：圆涨到铺满需要十倍尺寸，
 * 慢速下前 1/3 时间圆外都是灰底，看着像「没铺满」。
 *
 * 关键点：动画结束后**不能** cancel()，否则 fill:forwards 写下的
 * transform 会随之清掉，flyer 会瞬间缩回原尺寸。收尾交给 settle()。
 */
function runScale(from, to, onDone) {
  const styles = getComputedStyle(document.documentElement);
  const duration = styles.getPropertyValue("--dur-fast").trim() || "160ms";
  const easing = styles.getPropertyValue("--ease-out").trim();

  const animation = flyerEl.animate(
    [{ transform: transformOf(from) }, { transform: transformOf(to) }],
    {
      duration: Number.parseFloat(duration),
      easing,
      fill: "forwards"
    }
  );

  controller.register(animation);
  animation.finished
    .then(() => {
      // 可能已被新的动画取代，此时不该覆盖新状态
      if (controller.targetScale === to.scale) {
        onDone();
      }
    })
    .catch(() => {
      // cancel() 会 reject，属预期
    });

  return animation;
}

function openPreview(slug, sourceEl) {
  const gradient = findBySlug(slug);

  if (!gradient || !sourceEl) {
    return;
  }

  const alreadyOpen = previewSlug !== null;
  previewSlug = slug;
  lightboxName.textContent = gradient.name;

  const target = placeFlyer(gradient, sourceEl);

  if (controller.shouldAnimate()) {
    if (alreadyOpen) {
      // 已在全屏态：换配色。从当前实际 transform 接着走，动画不中断。
      controller.retarget(target.scale);
      runScale(currentFlyerTransform(), target, () => settlePreview(target));
      return;
    }

    if (!controller.beginOpen(target.scale)) {
      return;
    }

    flyerEl.style.transform = originTransform();
    document.body.classList.add("is-locked");
    document.querySelector("#lightbox-close")?.focus();

    // 原始色块保持可见，flyer 从它的几何中心放大，两者叠加无缝
    runScale({ scale: 1, x: 0, y: 0 }, target, () => settlePreview(target));
    return;
  }

  // reduced-motion：跳过缩放，直接到位
  if (!controller.beginOpen(target.scale)) {
    return;
  }

  flyerEl.style.transform = transformOf(target);
  lightboxEl.classList.add("is-settled");
  document.body.classList.add("is-locked");
  document.querySelector("#lightbox-close")?.focus();
  controller.finishOpen();
}

/** 放大到位后让名称淡入，与放大动作错开。 */
function settlePreview(target) {
  // 落进内联样式后清掉 fill 动画，避免残留 getAnimations()
  controller.settle();
  flyerEl.style.transform = transformOf(target);
  lightboxEl.classList.add("is-settled");
  controller.finishOpen();
}

function closePreview() {
  if (previewSlug === null) {
    return;
  }

  previewSlug = null;
  lightboxEl.classList.remove("is-settled");

  if (controller.shouldAnimate() && controller.beginClose()) {
    // 从当前实际 transform 反向收回，与展开严格互逆
    runScale(currentFlyerTransform(), { scale: 1, x: 0, y: 0 }, () => {
      // 收进内联样式，避免 fill 动画被 cancel 后状态丢失
      controller.settle();
      flyerEl.style.transform = originTransform();
      lightboxEl.hidden = true;
      document.body.classList.remove("is-locked");
      controller.finishClose();
    });
    return;
  }

  flyerEl.style.transform = originTransform();
  lightboxEl.hidden = true;
  document.body.classList.remove("is-locked");
  controller.finishClose();
}

filtersEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-family]");

  if (!button) {
    return;
  }

  activeFamily = button.dataset.family;
  render();
});

galleryEl.addEventListener("click", (event) => {
  const target = event.target;
  const copyButton = target.closest("[data-copy]");

  if (copyButton) {
    handleCopy(copyButton.dataset.copy);
    return;
  }

  const cssButton = target.closest("[data-download-css]");

  if (cssButton) {
    const gradient = findBySlug(cssButton.dataset.downloadCss);

    if (gradient) {
      download(
        `${gradient.slug}.css`,
        cssValue(gradient),
        "text/css"
      );
      showToast(`已下载 ${gradient.slug}.css`);
    }
    return;
  }

  const jsonButton = target.closest("[data-download-json]");

  if (jsonButton) {
    const gradient = findBySlug(jsonButton.dataset.downloadJson);

    if (gradient) {
      download(`${gradient.slug}.json`, gradientToJson(gradient), "application/json");
      showToast(`已下载 ${gradient.slug}.json`);
    }
    return;
  }

  const previewButton = target.closest("[data-preview]");

  if (previewButton) {
    openPreview(previewButton.dataset.preview, previewButton);
  }
});

document.querySelector("#lightbox-close").addEventListener("click", closePreview);

document.querySelector("#lightbox-copy").addEventListener("click", () => {
  if (previewSlug) {
    handleCopy(previewSlug);
  }
});

lightboxEl.addEventListener("click", (event) => {
  if (event.target === lightboxEl) {
    closePreview();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePreview();
  }
});

// 滚动时全屏层不该跟着漂移，直接锁住（iOS 也要）
window.addEventListener("scroll", () => {
  if (previewSlug !== null && lightboxEl.hidden) {
    closePreview();
  }
}, { passive: true });

render();

window.__gradientGallery = {
  allCss: () => allGradientsToCss(filterGradients("all")),
  allJson: () => allGradientsToJson(filterGradients("all"))
};
