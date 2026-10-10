# 交给开发 agent 的任务说明

请在 `gradient-gallery/` 目录内继续开发，不要修改工作区其他项目。

## 任务

按照以下规格完成渐变色配色库：

- 使用 `src/gradients.js` 中的渐变数据
- 使用 `src/export.js` 中的 CSS 与 JSON 导出函数
- 使用 `src/ui.js` 中的筛选器和卡片渲染函数
- 在 `src/main.js` 中实现应用状态、事件绑定、复制反馈、下载、全屏预览
- 在 `src/style.css` 中完成截图同款视觉系统和响应式布局
- 保持 `tests/gradients.test.js` 和 `tests/export.test.js` 通过
- 如需新增核心逻辑，先添加 Vitest 测试再实现

## 验收命令

在 `gradient-gallery/` 目录运行：

```powershell
npm install
npm test
npm run build
```

## 验收标准

- 至少 40 组渐变数据
- 顶部可按色系筛选
- 复制输出：
  `background-image: linear-gradient(45deg, #ff9a9e 0%, #fad0c4 100%);`
- 单个 CSS 下载生成 `.gradient-<slug>` class
- 单个 JSON 下载包含 `name`、`slug`、`family`、`angle`、`stops`、`css`
- 全部 CSS 和全部 JSON 下载可用
- 点击预览铺满页面
- 再次点击或按 `Escape` 返回
- 移动端不出现横向溢出
- 支持 `prefers-reduced-motion: reduce`
