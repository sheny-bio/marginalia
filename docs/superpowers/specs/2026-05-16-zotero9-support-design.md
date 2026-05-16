# Zotero 9 支持迁移设计

## Context

Marginalia 当前仅支持 Zotero 7/8（manifest 中 `strict_max_version: "8.*"`）。随着 Zotero 9 发布，用户无法安装此插件。本次迁移目标是让插件在 Zotero 9 上正常运行，同时放弃对 Zotero 7 的向后兼容，保持代码简洁。

## 范围

**包含：**

- 放开 manifest 版本限制至 Zotero 9
- 升级工具链依赖（zotero-types、zotero-plugin-toolkit、zotero-plugin-scaffold）
- 替换高风险私有 API
- 修复 TypeScript 编译错误

**不包含：**

- Zotero 7 向后兼容
- 新功能开发
- 架构重构

## 设计

### 1. manifest.json 版本声明

文件：`addon/manifest.json`

```json
"applications": {
  "zotero": {
    "strict_min_version": "6.999",
    "strict_max_version": "9.*"
  }
}
```

将 `strict_max_version` 从 `8.*` 改为 `9.*`。

### 2. 依赖升级

文件：`package.json`

| 包                       | 当前             | 目标       |
| ------------------------ | ---------------- | ---------- |
| `zotero-types`           | `^4.1.0-beta.4`  | `^4.1.2`   |
| `zotero-plugin-toolkit`  | `^5.1.0-beta.13` | 最新稳定版 |
| `zotero-plugin-scaffold` | `^0.8.2`         | 最新版     |

升级后运行 `npm install`，再用 `npm run build` 暴露类型不兼容问题并逐一修复。

### 3. 高风险 API 替换

#### 3a. Zotero.Fulltext.getItemContent()

位置：`src/modules/zoteroAPI.ts`（约第 38、75 行）

问题：私有 API，类型标注为 `any`，跨版本稳定性差。

替换方案：统一改用 `Zotero.Fulltext.getItemCacheFile()` 读取缓存文件，再通过 `Zotero.File.getContentsAsync()` 读取文件内容（同文件第 55-58 行已有此模式）。

#### 3b. Zotero.Utilities.Internal.copyTextToClipboard()

位置：`src/modules/chatActions.ts`（约第 481 行）

问题：`Internal` 命名空间是明确的私有 API。

替换方案：改为标准 Web API `navigator.clipboard.writeText(text)`，Zotero 的 Firefox 环境支持此 API。

### 4. 其余 API 处理

`Zotero.Items`、`Zotero.Collections`、`Zotero.Prefs`、`Zotero.Reader.registerEventListener()`、`Zotero.ItemPaneManager.registerSection()` 均为公开稳定接口，预计无需修改。若 `tsc` 报错则按报错信息逐一修复。

## 验证

1. `npm run build` — 无 TypeScript 错误
2. `npm run lint:check` — 通过
3. `npm test` — 在 Zotero 9 中运行自动化测试
4. 手动测试：
   - 侧边栏聊天面板加载
   - SSE 流式响应
   - PDF 划词翻译弹窗
   - 引用段落收集
   - 对话历史保存/加载
