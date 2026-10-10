import { gradientToCss } from "./export";

export function gradientStyle(gradient) {
  return gradientToCss(gradient).replace("background-image: ", "").replace(/;$/, "");
}

export function renderFilters(families, activeFamily, labels) {
  return families
    .map(
      (family) => `
        <button
          class="filter-pill ${family === activeFamily ? "is-active" : ""}"
          type="button"
          data-family="${family}"
          aria-pressed="${family === activeFamily}"
        >
          <span class="filter-dot filter-dot-${family}" aria-hidden="true"></span>
          <span class="filter-label">${labels[family]}</span>
        </button>
      `
    )
    .join("");
}

export function renderCards(items) {
  return items
    .map(
      (gradient) => `
        <article class="gradient-card" data-slug="${gradient.slug}">
          <header class="card-head">
            <h2 class="card-title">${gradient.name}</h2>
            <button class="icon-btn" type="button" data-copy="${gradient.slug}" title="复制 CSS" aria-label="复制 ${gradient.name} 的 CSS">
              <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1.5" width="9" height="11" rx="2"/><path d="M10.5 12.5v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1"/></svg>
            </button>
          </header>

          <button class="gradient-preview" type="button" data-preview="${gradient.slug}" aria-label="预览 ${gradient.name}">
            <span class="gradient-orb" style="background: ${gradientStyle(gradient)}"></span>
          </button>

          <footer class="card-foot">
            <div class="swatches" aria-label="${gradient.name} 色标">
              ${gradient.stops
                .map(
                  (stop) => `
                    <span class="swatch" style="background: ${stop.color}" title="${stop.color}"></span>
                  `
                )
                .join("")}
            </div>

            <div class="card-tools">
              <button class="icon-btn tool-extra" type="button" data-download-css="${gradient.slug}" title="下载 CSS" aria-label="下载 ${gradient.name} 的 CSS">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v8.5m0 0 3-3m-3 3-3-3"/><path d="M2 11.5v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1"/></svg>
              </button>
              <button class="icon-btn tool-extra" type="button" data-download-json="${gradient.slug}" title="下载 JSON" aria-label="下载 ${gradient.name} 的 JSON">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h6"/></svg>
              </button>
              <button class="icon-btn" type="button" data-copy="${gradient.slug}" title="复制 CSS" aria-label="复制 ${gradient.name} 的 CSS">
                <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1.5" width="9" height="11" rx="2"/><path d="M10.5 12.5v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1"/></svg>
              </button>
            </div>
          </footer>
        </article>
      `
    )
    .join("");
}
