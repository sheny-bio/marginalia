# Marginalia 开发指南

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
