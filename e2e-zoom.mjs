// 用法：npm run dev 起服务后，另开终端跑 node e2e-zoom.mjs
// 需要本地已装 playwright（npm i -D playwright），不是本项目的硬依赖
import { chromium } from "playwright";

const URL = process.env.PREVIEW_URL ?? "http://localhost:5173/";
const out = (...a) => process.stdout.write(a.join(" ") + "\n");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 620 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

// 需求1：transform-origin 必须是色块几何中心
const origin = await page.evaluate(() => {
  const orb = document.querySelector(".gradient-orb");
  return getComputedStyle(orb.parentElement).transformOrigin;
});
out("① preview 容器 transform-origin:", origin);

// 动画时长须用 --dur-fast：慢速下圆涨不满，前段全是灰底
out("   动效时长:", await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--dur-fast").trim()
));

// 记录被点击色块的位置，用于后续比对
await page.locator(".gradient-preview").nth(2).boundingBox();

// 点击后立即采样：flyer 应与源色块同位同尺寸（scale=1）
// 用 evaluate 同步触发点击并立即读，避免采样滞后于动画推进
const mid = await page.evaluate((idx) => {
  const btn = document.querySelectorAll(".gradient-preview")[idx];
  const orb = btn.querySelector(".gradient-orb");
  const src = orb.getBoundingClientRect();
  btn.click();
  const f = document.querySelector("#flyer");
  const r = f.getBoundingClientRect();
  return {
    src: { x: Math.round(src.x), y: Math.round(src.y), w: Math.round(src.width) },
    flyer: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    transform: getComputedStyle(f).transform,
    radius: getComputedStyle(f).borderRadius,
    hidden: document.querySelector("#lightbox").hidden,
    orbVisible: !!orb && getComputedStyle(orb).display !== "none"
  };
}, 2);

out("② 点击瞬间 flyer 矩形:", JSON.stringify(mid.flyer));
out("   源色块矩形:          ", JSON.stringify(mid.src));
out("   完全重合:", mid.flyer.x === mid.src.x && mid.flyer.y === mid.src.y && mid.flyer.w === mid.src.w);
out("   起始为正圆:", mid.flyer.w === mid.flyer.h, `(${mid.flyer.w}×${mid.flyer.h})`, "| border-radius:", mid.radius);
out("   起始 transform:", mid.transform, "| 原始色块仍可见:", mid.orbVisible);

// 采样动画中间态，确认是渐变放大而非切换
await page.waitForTimeout(120);
const during = await page.evaluate(() => getComputedStyle(document.querySelector("#flyer")).transform);
out("③ 动画中 transform:", during);
out("   动画中仍为正圆:", await page.evaluate(() => {
  const r = document.querySelector("#flyer").getBoundingClientRect();
  return Math.abs(r.width - r.height) <= 1;
}));

// 等动画结束
await page.waitForTimeout(500);
const done = await page.evaluate(() => {
  const f = document.querySelector("#flyer");
  const r = f.getBoundingClientRect();
  const lb = document.querySelector("#lightbox").getBoundingClientRect();
  return {
    transform: getComputedStyle(f).transform,
    coversViewport: r.width >= lb.width && r.height >= lb.height,
    round: Math.abs(r.width - r.height) <= 1,
    settled: document.querySelector("#lightbox").classList.contains("is-settled"),
    nameText: document.querySelector("#lightbox-name").textContent,
    nameFont: getComputedStyle(document.querySelector("#lightbox-name")).fontFamily,
    nameStyle: getComputedStyle(document.querySelector("#lightbox-name")).fontStyle,
    nameSpacing: getComputedStyle(document.querySelector("#lightbox-name")).letterSpacing,
    nameSize: getComputedStyle(document.querySelector("#lightbox-name")).fontSize,
    nameTransform: getComputedStyle(document.querySelector("#lightbox-name")).textTransform,
    scrollbar: document.body.classList.contains("is-locked")
  };
});
out("④ 终态 transform:", done.transform);
out("   覆盖视口:", done.coversViewport, "| 终态为正圆:", done.round, "| is-settled:", done.settled, "| body 锁滚动:", done.scrollbar);
out("⑥ 名称:", done.nameText);
out("   font-family:", done.nameFont.slice(0, 60));
out("   font-style:", done.nameStyle, "| letter-spacing:", done.nameSpacing);
out("   font-size:", done.nameSize, "| text-transform:", done.nameTransform);

await page.screenshot({ path: "E:/Deepseek-project/gradient-gallery/shot-zoom-settled.png" });

// 需求4：连续切换不残留
await page.locator("#lightbox").click({ position: { x: 540, y: 310 } });
await page.waitForTimeout(30);
const closing = await page.evaluate(() => ({
  hidden: document.querySelector("#lightbox").hidden,
  transform: getComputedStyle(document.querySelector("#flyer")).transform
}));
out("⑦ 关闭动画起始 transform:", closing.transform, "| hidden:", closing.hidden, "(false=正在收起)");

await page.waitForTimeout(500);
const closed = await page.evaluate(() => ({
  hidden: document.querySelector("#lightbox").hidden,
  transform: getComputedStyle(document.querySelector("#flyer")).transform,
  locked: document.body.classList.contains("is-locked"),
  anims: document.querySelector("#flyer").getAnimations().length
}));
out("   关闭完成 hidden:", closed.hidden, "| transform:", closed.transform, "| 解锁滚动:", !closed.locked, "| 残留动画:", closed.anims);

// 快速连点：动画进行中再次点击 / 切换其他配色
await page.locator(".gradient-preview").nth(0).click();
await page.waitForTimeout(70);
const midSwitch = await page.evaluate(() => ({
  hidden: document.querySelector("#lightbox").hidden,
  transform: getComputedStyle(document.querySelector("#flyer")).transform
}));
out("⑧ 展开中 transform:", midSwitch.transform, "| hidden:", midSwitch.hidden);

await page.locator("#lightbox").click({ position: { x: 540, y: 310 }, force: true });
await page.waitForTimeout(70);
await page.locator(".gradient-preview").nth(5).click();
await page.waitForTimeout(900);
const churn = await page.evaluate(() => {
  const f = document.querySelector("#flyer");
  const r = f.getBoundingClientRect();
  const lb = document.querySelector("#lightbox");
  return {
    transform: getComputedStyle(f).transform,
    hidden: lb.hidden,
    settled: lb.classList.contains("is-settled"),
    covers: r.width >= window.innerWidth && r.height >= window.innerHeight,
    name: document.querySelector("#lightbox-name").textContent,
    anims: f.getAnimations().length
  };
});
out("   连点切换后 → transform:", churn.transform);
out("   hidden:", churn.hidden, "| is-settled:", churn.settled, "| 覆盖视口:", churn.covers);
out("   名称(应与最后点击一致):", churn.name);
out("   残留动画:", churn.anims, "(应为 0)");

await page.screenshot({ path: "E:/Deepseek-project/gradient-gallery/shot-zoom-churn.png" });

// 需求5：reduced-motion
const page2 = await browser.newPage({ viewport: { width: 1080, height: 620 } });
await page2.emulateMedia({ reducedMotion: "reduce" });
await page2.goto(URL, { waitUntil: "networkidle" });
await page2.waitForTimeout(500);
await page2.locator(".gradient-preview").nth(1).click();
const instant = await page2.evaluate(() => {
  const f = document.querySelector("#flyer");
  return {
    transform: getComputedStyle(f).transform,
    running: f.getAnimations().length,
    hidden: document.querySelector("#lightbox").hidden,
    settled: document.querySelector("#lightbox").classList.contains("is-settled"),
    nameOpacity: getComputedStyle(document.querySelector("#lightbox-name")).opacity
  };
});
out("⑨ reduced-motion → 运行中的动画数:", instant.running, "(应为 0)");
out("   直接到位 transform:", instant.transform);
out("   hidden:", instant.hidden, "| 名称可见 opacity:", instant.nameOpacity);

out("控制台错误:", errors.length ? errors.join(" | ") : "无");
await browser.close();
