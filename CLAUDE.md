# Marginalia 开发指南

## 插件概述

Marginalia 是一个 Zotero 7 AI 阅读助手插件，基于 OpenAI 兼容 API，提供论文智能对话、划词翻译和引用提问功能。当前版本 3.2.0。

技术栈：TypeScript + Zotero Plugin Toolkit + marked（Markdown 渲染）+ zotero-plugin-scaffold（构建）

## 已开发功能

- **AI 论文对话**：侧边栏聊天面板，基于论文全文上下文与 AI 对话，支持 SSE 流式响应
- **划词翻译**：PDF 阅读器中选中文字一键翻译为中文，结果显示在弹窗中
- **引用提问**：选中论文段落收集到侧边栏，作为独立上下文参数传递给 AI
- **侧边栏自动激活**：点击引用按钮自动打开侧边栏并定位到插件面板
- **对话管理**：历史保存/加载、导出 Markdown、清除历史、单条复制、轮数限制
- **国际化**：支持 zh-CN / en-US，提示词使用中文，专业术语保留英文

## 项目结构

```
src/
├── index.ts                     # 插件入口，全局变量初始化
├── addon.ts                     # Addon 类，持有运行时数据
├── hooks.ts                     # 生命周期调度：startup/shutdown/windowLoad
├── modules/
│   ├── apiClient.ts             # OpenAI 兼容 API 客户端（支持流式 SSE）
│   ├── chatPanel.ts             # 核心：聊天面板 UI 和逻辑（ItemPaneManager 注册）
│   ├── translationPopup.ts      # PDF 划词翻译和引用弹窗（Reader 事件监听）
│   ├── storageManager.ts        # 对话持久化（JSON 文件，按条目存储）
│   ├── settingsManager.ts       # 配置管理（Zotero.Prefs 读写）
│   ├── zoteroAPI.ts             # Zotero 数据访问封装（条目信息、全文提取、搜索）
│   └── preferenceScript.ts      # 偏好设置面板事件绑定
└── utils/
    ├── locale.ts                # Fluent 国际化（getString 自动加 addonRef 前缀）
    ├── markdown.ts              # Markdown 渲染（marked + XHTML 兼容）
    ├── prefs.ts                 # 类型安全的 Prefs 工具函数
    ├── window.ts                # 窗口存活检测
    └── ztoolkit.ts              # ZoteroToolkit 初始化

addon/
├── bootstrap.js                 # Zotero 7 bootstrapped 插件入口
├── manifest.json                # WebExtension manifest
├── prefs.js                     # 默认偏好值
├── content/
│   ├── preferences.xhtml        # 偏好设置面板
│   ├── zoteroPane.css           # 样式表
│   └── icons/                   # 插件图标
└── locale/{en-US,zh-CN}/        # Fluent 国际化文件（addon.ftl / mainWindow.ftl / preferences.ftl）
```

## 关键架构决策

- **UI 构建方式**：chatPanel 和 translationPopup 均使用纯 DOM 操作 + 内联样式，不依赖外部 CSS 类
- **面板注册**：通过 `Zotero.ItemPaneManager.registerSection({ paneID: "marginalia-chat" })` 注册侧边栏
- **侧边栏控制**：通过 `ZoteroContextPane.sidenav` (XULElement) 操作，`sidenav.container.scrollToPane()` 定位面板
- **国际化注意**：`getString()` 会自动加 `config.addonRef`（"marginalia"）前缀，locale key 不要重复加前缀
- **对话存储**：JSON 文件存储在 `{Zotero数据目录}/marginalia/conversation_{itemID}.json`
- **引用机制**：引用内容在 system message 中作为独立区块，与全文和用户问题分离

## Zotero 接口查询规范

每次开发新功能前，必须先阅读 `node_modules/zotero-types` 目录下的类型定义文件，查询是否有合适的 Zotero 内置接口可以快速完成需求，避免重复造轮子。

关键类型文件路径：

- 条目操作: `node_modules/zotero-types/types/xpcom/data/item.d.ts`
- 集合操作: `node_modules/zotero-types/types/xpcom/data/collection.d.ts`
- 库操作: `node_modules/zotero-types/types/xpcom/data/library.d.ts`
- 搜索: `node_modules/zotero-types/types/xpcom/data/search.d.ts`
- 标签: `node_modules/zotero-types/types/xpcom/data/tags.d.ts`
- 附件: `node_modules/zotero-types/types/xpcom/attachments.d.ts`
- 注释: `node_modules/zotero-types/types/xpcom/annotations.d.ts`
- 阅读器: `node_modules/zotero-types/types/xpcom/reader.d.ts`
- 阅读器类型: `node_modules/zotero-types/types/reader/common/types.d.ts`
- 事件通知: `node_modules/zotero-types/types/xpcom/notifier.d.ts`
- 偏好设置: `node_modules/zotero-types/types/xpcom/prefs.d.ts`
- 数据库: `node_modules/zotero-types/types/xpcom/db.d.ts`
- URI 工具: `node_modules/zotero-types/types/xpcom/uri.d.ts`
- 通用工具: `node_modules/zotero-types/types/xpcom/utilities/utilities.d.ts`
- 主面板: `node_modules/zotero-types/types/zoteroPane.d.ts`
- 标签页: `node_modules/zotero-types/types/zoteroTabs.d.ts`
- 笔记: `node_modules/zotero-types/types/xpcom/data/notes.d.ts`
- 编辑器实例: `node_modules/zotero-types/types/xpcom/editorInstance.d.ts`
- 全文索引: `node_modules/zotero-types/types/xpcom/fulltext.d.ts`
- 插件 API: `node_modules/zotero-types/types/xpcom/pluginAPI/`
- 上下文面板: `node_modules/zotero-types/types/zoteroContextPane.d.ts`
