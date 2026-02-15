# Marginalia AI Chat - 团队开发任务分配

**当前进度**: Phase 1-3 基本完成，Phase 4-6 待开发
**剩余工作量**: 约 3-4 周

---

## 任务分配概览

| 开发者 | 负责模块 | 预计工时 |
|--------|----------|----------|
| Dev A | Phase 4 - 对话管理功能 | 1 周 |
| Dev B | Phase 5.1-5.2 - UI 优化 | 1 周 |
| Dev C | Phase 5.4-5.5 - 测试 | 1 周 |
| Dev D | Phase 6 - 文档和发布 | 1 周 |

---

## Dev A: 对话管理功能 (Phase 4)

### 任务 A1: 底部选项菜单
**文件**: `src/modules/chatPanel.ts`, `addon/content/chatPanel.css`
**优先级**: P0

- [ ] 实现 "+" 按钮点击显示下拉菜单
- [ ] 菜单项：
  - 复制消息
  - 导出为 Markdown
  - 清除历史
  - 工具调用开关

```typescript
// 参考实现位置: chatPanel.ts attachEventListeners()
private showOptionsMenu() {
  // 创建下拉菜单 DOM
  // 绑定菜单项点击事件
}
```

### 任务 A2: 复制消息功能
**文件**: `src/modules/chatPanel.ts`
**优先级**: P1

- [ ] 为每条消息添加复制按钮（hover 显示）
- [ ] 实现 `copyToClipboard(content: string)` 方法
- [ ] 支持复制原始 Markdown 格式

### 任务 A3: 导出为 Markdown
**文件**: `src/modules/chatPanel.ts`
**优先级**: P1

- [ ] 实现 `exportToMarkdown()` 方法
- [ ] 格式化对话为 Markdown 文件
- [ ] 调用 Zotero 文件保存对话框

```typescript
async exportToMarkdown() {
  const markdown = this.messages.map(m =>
    `**${m.role}**: ${m.content}`
  ).join('\n\n---\n\n');
  // 保存文件
}
```

### 任务 A4: 清除历史
**文件**: `src/modules/chatPanel.ts`
**优先级**: P1

- [ ] 实现确认对话框
- [ ] 调用 `storageManager.clearMessages(itemID)`
- [ ] 清空 UI 消息列表

### 任务 A5: 对话轮数限制
**文件**: `src/modules/storageManager.ts`, `src/modules/chatPanel.ts`
**优先级**: P2

- [ ] 在 `saveMessage()` 后检查消息数量
- [ ] 超过限制时删除最旧的消息
- [ ] 读取 `maxHistoryRounds` 设置

---

## Dev B: UI 优化 (Phase 5.1-5.2)

### 任务 B1: 消息列表滚动优化
**文件**: `addon/content/chatPanel.css`, `src/modules/chatPanel.ts`
**优先级**: P0

- [ ] 新消息自动滚动到底部
- [ ] 添加平滑滚动动画
- [ ] 用户手动滚动时暂停自动滚动

### 任务 B2: 输入框高度自适应
**文件**: `src/modules/chatPanel.ts`, `addon/content/chatPanel.css`
**优先级**: P1

- [ ] 监听 input 事件动态调整高度
- [ ] 设置最大高度限制
- [ ] 发送后重置高度

```typescript
private autoResizeInput(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}
```

### 任务 B3: 加载状态动画优化
**文件**: `addon/content/chatPanel.css`
**优先级**: P2

- [ ] 优化 spinner 动画
- [ ] 添加 "AI 正在思考..." 文字提示
- [ ] 流式输出时显示打字光标效果

### 任务 B4: 错误提示优化
**文件**: `src/modules/chatPanel.ts`, `addon/content/chatPanel.css`
**优先级**: P1

- [ ] 创建统一的错误提示组件
- [ ] 区分网络错误、API 错误、配置错误
- [ ] 添加重试按钮

### 任务 B5: 代码高亮
**文件**: `src/utils/markdown.ts`, `package.json`
**优先级**: P2

- [ ] 集成 highlight.js
- [ ] 配置常用语言支持
- [ ] 添加代码块复制按钮

---

## Dev C: 测试 (Phase 5.4-5.5)

### 任务 C1: 测试环境搭建
**文件**: `package.json`, `jest.config.js`
**优先级**: P0

- [ ] 配置 Jest 测试框架
- [ ] 配置 TypeScript 支持
- [ ] 创建 mock 工具（Zotero API mock）

### 任务 C2: APIClient 单元测试
**文件**: `tests/apiClient.test.ts`
**优先级**: P0

- [ ] 测试正常请求流程
- [ ] 测试流式响应处理
- [ ] 测试错误处理
- [ ] 测试连接测试功能

### 任务 C3: StorageManager 单元测试
**文件**: `tests/storageManager.test.ts`
**优先级**: P0

- [ ] 测试消息保存/加载
- [ ] 测试设置保存/加载
- [ ] 测试消息清除

### 任务 C4: ToolCaller 单元测试
**文件**: `tests/toolCaller.test.ts`
**优先级**: P1

- [ ] 测试工具调用解析
- [ ] 测试各工具执行
- [ ] 测试错误处理

### 任务 C5: 集成测试
**文件**: `tests/integration/`
**优先级**: P1

- [ ] 测试完整对话流程
- [ ] 测试工具调用流程
- [ ] 测试设置保存和加载

---

## Dev D: 文档和发布 (Phase 6)

### 任务 D1: 用户使用指南
**文件**: `docs/USER_GUIDE.md`
**优先级**: P0

- [ ] 安装说明
- [ ] 配置 API 步骤
- [ ] 基本使用教程
- [ ] 常见问题解答

### 任务 D2: 开发者文档
**文件**: `docs/DEVELOPER.md`
**优先级**: P1

- [ ] 项目架构说明
- [ ] 开发环境搭建
- [ ] 代码规范
- [ ] 贡献指南

### 任务 D3: API 文档
**文件**: `docs/API.md`
**优先级**: P2

- [ ] 模块接口说明
- [ ] 工具调用格式
- [ ] 配置项说明

### 任务 D4: 代码审查
**优先级**: P0

- [ ] 代码风格检查（ESLint）
- [ ] 安全审查（API Key 处理）
- [ ] 性能审查

### 任务 D5: 构建和发布
**优先级**: P0

- [ ] 构建生产版本
- [ ] 生成 .xpi 插件包
- [ ] 创建 GitHub Release
- [ ] 编写 CHANGELOG.md

---

## 并行开发时间线

```
Week 1:
├── Dev A: A1 (菜单) + A2 (复制)
├── Dev B: B1 (滚动) + B2 (输入框)
├── Dev C: C1 (测试环境) + C2 (APIClient 测试)
└── Dev D: D1 (用户指南)

Week 2:
├── Dev A: A3 (导出) + A4 (清除) + A5 (轮数限制)
├── Dev B: B3 (加载动画) + B4 (错误提示) + B5 (代码高亮)
├── Dev C: C3 (Storage 测试) + C4 (ToolCaller 测试)
└── Dev D: D2 (开发者文档) + D3 (API 文档)

Week 3:
├── All: 集成测试 + Bug 修复
├── Dev C: C5 (集成测试)
└── Dev D: D4 (代码审查) + D5 (发布)
```

---

## 依赖关系

```
A1 (菜单) ──┬── A2 (复制)
            ├── A3 (导出)
            └── A4 (清除)

C1 (测试环境) ──┬── C2 (APIClient)
                ├── C3 (Storage)
                └── C4 (ToolCaller)

D4 (代码审查) ── D5 (发布)
```

---

## 验收标准

### Phase 4 完成标准
- [ ] 所有菜单功能可正常使用
- [ ] 导出的 Markdown 格式正确
- [ ] 对话历史可正确清除
- [ ] 轮数限制生效

### Phase 5 完成标准
- [ ] UI 交互流畅无卡顿
- [ ] 所有单元测试通过
- [ ] 集成测试覆盖主要流程

### Phase 6 完成标准
- [ ] 文档完整可读
- [ ] 代码审查无重大问题
- [ ] 插件包可正常安装使用

---

## 沟通机制

- 每日站会：同步进度和阻塞问题
- PR Review：每个任务完成后提交 PR
- 分支策略：`feature/phase4-menu`, `feature/phase5-ui` 等
