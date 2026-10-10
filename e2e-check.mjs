// 用法：npm run dev 起服务后，另开终端跑 node e2e-zoom.mjs
// 需要本地已装 playwright（npm i -D playwright），不是本项目的硬依赖
import { chromium } from "playwright";

const URL = process.env.PREVIEW_URL ?? "http://localhost:5173/";
const out = (...a) => process.stdout.write(a.join(" ") + "\n");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 600 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

out("卡片数:", await page.locator(".gradient-card").count());
out("筛选按钮:", await page.locator(".filter-pill").count());
out("激活筛选:", await page.locator(".filter-pill.is-active").textContent());

// 背景色应为浅色
out("body 背景:", await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
out("卡片背景:", await page.evaluate(() => {
  const c = document.querySelector(".gradient-card");
  return c ? getComputedStyle(c).backgroundColor : "无卡片";
}));

// 悬停卡片：下载按钮应浮现
await page.locator(".gradient-card").first().hover();
await page.waitForTimeout(400);
const extraVisible = await page.locator(".gradient-card").first().locator(".tool-extra").first().isVisible();
out("hover 时下载按钮可见:", extraVisible);

await page.screenshot({ path: "E:/Deepseek-project/gradient-gallery/shot-grid.png" });

// 筛选
await page.click('[data-family="blue"]');
await page.waitForTimeout(300);
out("筛选 blue 后卡片数:", await page.locator(".gradient-card").count());
await page.click('[data-family="all"]');
await page.waitForTimeout(300);

// 点击预览
await page.locator(".gradient-preview").first().click();
await page.waitForTimeout(500);
out("预览层 hidden:", await page.locator("#lightbox").getAttribute("hidden"));
out("预览层背景图:", (await page.evaluate(() => getComputedStyle(document.querySelector("#lightbox")).backgroundImage)).slice(0, 80));
out("预览层名称:", await page.locator("#lightbox-name").textContent());
await page.screenshot({ path: "E:/Deepseek-project/gradient-gallery/shot-preview.png" });

await page.keyboard.press("Escape");
await page.waitForTimeout(400);
out("Escape 后 hidden:", await page.locator("#lightbox").getAttribute("hidden"));

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
out("横向溢出:", overflow + "px");

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
out("移动端横向溢出:", (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) + "px");
out("移动端筛选标签:", await page.locator(".filter-pill").first().locator(".filter-label").isVisible());
await page.screenshot({ path: "E:/Deepseek-project/gradient-gallery/shot-mobile.png" });

out("控制台错误:", errors.length ? errors.join(" | ") : "无");
await browser.close();
