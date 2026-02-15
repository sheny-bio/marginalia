# Marginalia AI Chat Plugin - 设计文档

**项目名称**: Marginalia AI Chat
**日期**: 2026-02-15
**状态**: 设计已批准

---

## 1. 项目概述

Marginalia 是一个 Zotero 7 插件，允许用户在阅读论文时，通过侧边栏与 AI 进行实时对话，基于当前论文进行问答和分析。

### 核心特性
- 侧边栏对话框（不打扰阅读体验）
- 支持 OpenAI 兼容的 API（自定义 URL 和 API Key）
- 按文献保存对话历史
- 工具调用功能（AI 可访问其他论文信息）
- 对话管理（清除历史、导出为 Markdown、复制消息）
- 美观简洁的 UI 设计

---

## 2. 整体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────┐
│         Zotero 7 主窗口                  │
├─────────────────────────────────────────┤
│  Item Pane (右侧侧边栏)                  │
│  ┌───────────────────────────────────┐  │
│  │ [标签页] [标签页] [AI Chat] ◄─────┤  │
│  ├───────────────────────────────────┤  │
│  │                                   │  │
│  │  对话框区域                        │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ AI: 你好，我是 Marginalia... │  │  │
│  │  │                             │  │  │
│  │  │ User: 这篇论文讲什么？      │  │  │
│  │  │ AI: 这篇论文主要讨论...     │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  输入框 + 按钮区域                 │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ [输入框] [发送] [+选项]     │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 职责 | 技术栈 |
|------|------|--------|
| **ChatPanel** | 侧边栏对话框主组件 | TypeScript + HTML/CSS |
| **MessageList** | 消息列表展示 | React-like 组件 |
| **InputBox** | 输入框 + 发送按钮 | HTML/CSS |
| **OptionsMenu** | 底部"+"选项菜单 | 下拉菜单 |
| **SettingsPanel** | 设置页面 | Zotero 偏好设置 UI |
| **APIClient** | OpenAI 兼容 API 调用 | TypeScript |
| **ToolCaller** | 工具调用执行器 | TypeScript |
| **StorageManager** | 数据库操作 | Zotero SQLite |

---

## 3. 数据存储结构

### 3.1 数据库表设计

#### 表 1: marginalia_conversations
```sql
CREATE TABLE marginalia_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  itemID INTEGER NOT NULL,           -- Zotero Item ID
  role TEXT NOT NULL,                -- 'user' 或 'assistant'
  content TEXT NOT NULL,             -- 消息内容
  timestamp INTEGER NOT NULL,        -- Unix 时间戳
  toolCalls JSON,                    -- 工具调用信息（可选）
  FOREIGN KEY (itemID) REFERENCES items(itemID)
);
```

#### 表 2: marginalia_settings
```sql
CREATE TABLE marginalia_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 3.2 存储的设置项

| 设置项 | 类型 | 说明 |
|--------|------|------|
| `apiUrl` | string | OpenAI 兼容的 API 地址 |
| `apiKey` | string | API 密钥（加密存储） |
| `model` | string | 使用的模型名称（如 gpt-4o-mini） |
| `maxHistoryRounds` | number | 保存的最大对话轮数（默认 20） |
| `enableToolCalling` | boolean | 是否启用工具调用 |
| `systemPrompt` | string | 系统提示词 |

---

## 4. 工具调用框架

### 4.1 可用工具定义

```typescript
const tools = [
  {
    name: "get_paper_info",
    description: "获取指定论文的基本信息（标题、作者、摘要等）",
    parameters: {
      itemID: "number",  // Zotero Item ID
    }
  },
  {
    name: "get_paper_content",
    description: "获取指定论文的全文内容（通过 Zotero.FullText API）",
    parameters: {
      itemID: "number",
    }
  },
  {
    name: "search_papers",
    description: "在当前库中搜索相关论文",
    parameters: {
      query: "string",
      limit: "number"  // 最多返回多少篇
    }
  }
];
```

### 4.2 工具调用流程

1. 用户启用"工具调用"开关
2. AI 在回复中包含工具调用请求（JSON 格式）
3. 插件解析工具调用，调用相应的 Zotero API
4. 将结果返回给 AI，AI 继续对话
5. 对话完成，自动保存到数据库

### 4.3 安全考虑

- 工具调用只暴露必要的 API（不允许删除或修改论文）
- 用户可以手动启用/禁用工具调用功能
- 工具调用结果会被记录在对话历史中

---

## 5. 设置页面设计

### 5.1 设置页面布局

```
┌─────────────────────────────────────────┐
│  Marginalia AI Chat 设置                 │
├─────────────────────────────────────────┤
│                                         │
│  API 配置                               │
│  ┌─────────────────────────────────┐   │
│  │ API URL:                        │   │
│  │ [https://api.openai.com/v1]     │   │
│  │                                 │   │
│  │ API Key:                        │   │
│  │ [••••••••••••••••••••]          │   │
│  │                                 │   │
│  │ Model:                          │   │
│  │ [gpt-4o-mini ▼]                │   │
│  │                                 │   │
│  │ [测试连接] [保存]               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  对话设置                               │
│  ┌─────────────────────────────────┐   │
│  │ 最大保存对话轮数: [20]          │   │
│  │ 启用工具调用: [✓]               │   │
│  │ 系统提示词:                     │   │
│  │ [你是一个专业的学术论文分析助手] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [清除所有对话历史]                     │
│                                         │
└─────────────────────────────────────────┘
```

### 5.2 "测试连接"功能

- 发送一个简单的 API 请求到配置的 URL
- 显示连接状态（成功/失败）
- 如果失败，显示错误信息

---

## 6. 对话流程与 UI/UX 细节

### 6.1 对话框的完整交互流程

```
用户选中论文
    ↓
点击 AI Chat 标签页
    ↓
加载该论文的对话历史（如果有）
    ↓
显示消息列表
    ↓
用户输入问题
    ↓
点击发送按钮
    ↓
显示"正在思考..."加载状态
    ↓
流式显示 AI 回复（Markdown 格式）
    ↓
如果启用工具调用，AI 可能会调用工具
    ↓
对话完成，自动保存到数据库
```

### 6.2 消息展示细节

- **用户消息**：右对齐，蓝色背景
- **AI 消息**：左对齐，灰色背景，支持 Markdown 渲染（加粗、列表、代码块等）
- **工具调用**：显示为可折叠的卡片（"🔧 调用了 get_paper_info"）
- **加载状态**：显示动画加载指示器

### 6.3 底部"+"选项菜单

```
┌─────────────────────────────┐
│ [📋 复制消息]               │
│ [💾 导出为 Markdown]        │
│ [🗑️ 清除历史]              │
│ [⚙️ 工具调用开关]           │
└─────────────────────────────┘
```

**功能说明：**
- **复制消息**：复制单条消息到剪贴板
- **导出为 Markdown**：导出当前论文的所有对话为 Markdown 文件
- **清除历史**：删除当前论文的所有对话
- **工具调用开关**：启用/禁用工具调用功能

---

## 7. 错误处理与边界情况

### 7.1 API 错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| 连接失败 | 显示"无法连接到 API，请检查设置" |
| 认证失败 | 显示"API Key 无效，请检查设置" |
| 速率限制 | 显示"请求过于频繁，请稍后再试" |
| 超时 | 显示"请求超时，请重试" |

### 7.2 数据边界情况

| 情况 | 处理方式 |
|------|---------|
| 论文没有摘要 | 使用 Zotero.FullText 获取全文内容 |
| 对话历史超过最大轮数 | 自动删除最早的对话 |
| 用户切换论文 | 保存当前论文的对话，加载新论文的对话 |
| 工具调用失败 | 显示错误信息，继续对话 |

### 7.3 安全考虑

- API Key 加密存储在 Zotero 数据库中
- 不在日志中记录 API Key
- 工具调用只暴露必要的 API（不允许删除或修改论文）

---

## 8. 技术栈

| 层级 | 技术 |
|------|------|
| **语言** | TypeScript |
| **框架** | Zotero Plugin Toolkit |
| **UI** | HTML/CSS/JavaScript |
| **数据库** | SQLite (Zotero) |
| **API 调用** | Fetch API |
| **Markdown 渲染** | marked.js 或类似库 |

---

## 9. 开发阶段

### Phase 1: MVP（最小可行产品）
- [ ] 基础侧边栏 UI
- [ ] API 配置和测试连接
- [ ] 基础对话功能（无流式输出）
- [ ] 对话历史保存

### Phase 2: 增强功能
- [ ] 流式输出支持
- [ ] Markdown 渲染
- [ ] 工具调用框架

### Phase 3: 完整功能
- [ ] 对话管理（清除、导出、复制）
- [ ] 高级设置（系统提示词、温度等）
- [ ] UI 优化和主题支持

---

## 10. 成功标准

- ✅ 用户可以在侧边栏与 AI 对话
- ✅ 对话历史按文献保存
- ✅ 支持 OpenAI 兼容的 API
- ✅ 工具调用功能正常工作
- ✅ UI 美观简洁，不打扰阅读
- ✅ 所有额外功能（清除、导出、复制）正常工作

---

## 11. 文件结构设计

### 11.1 项目文件组织

```
src/
├── index.ts                          # 插件入口
├── addon.ts                          # Addon 类定义
├── hooks.ts                          # 生命周期钩子
├── modules/
│   ├── chatPanel.ts                  # 侧边栏主组件
│   ├── apiClient.ts                  # OpenAI API 客户端
│   ├── toolCaller.ts                 # 工具调用执行器
│   ├── storageManager.ts             # 数据库操作
│   ├── settingsManager.ts            # 设置管理
│   └── zoteroAPI.ts                  # Zotero API 封装
├── utils/
│   ├── markdown.ts                   # Markdown 渲染
│   ├── crypto.ts                     # API Key 加密
│   ├── logger.ts                     # 日志工具
│   └── constants.ts                  # 常量定义
└── types/
    └── index.ts                      # TypeScript 类型定义

addon/
├── content/
│   ├── chatPanel.html                # 侧边栏 HTML
│   ├── chatPanel.css                 # 侧边栏样式
│   ├── preferences.xhtml             # 设置页面
│   └── icons/
└── locale/
    ├── en-US/
    │   ├── addon.ftl
    │   ├── mainWindow.ftl
    │   └── preferences.ftl
    └── zh-CN/
        ├── addon.ftl
        ├── mainWindow.ftl
        └── preferences.ftl
```

---

## 12. API 客户端实现方案

### 12.1 OpenAI 兼容 API 调用

```typescript
// src/modules/apiClient.ts
interface APIConfig {
  url: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

class APIClient {
  private config: APIConfig;

  async chat(messages: Message[], onChunk?: (chunk: string) => void): Promise<string> {
    const response = await fetch(`${this.config.url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return this.handleStream(response, onChunk);
  }

  private async handleStream(response: Response, onChunk?: (chunk: string) => void): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let fullText = '';
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content || '';
            if (content) {
              fullText += content;
              onChunk?.(content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    return fullText;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

---

## 13. Zotero API 调用方式

### 13.1 获取论文内容

```typescript
// src/modules/zoteroAPI.ts
class ZoteroAPI {
  // 获取论文基本信息
  static getPaperInfo(itemID: number) {
    const item = Zotero.Items.get(itemID);
    return {
      title: item.getField('title'),
      authors: item.getCreators(),
      abstract: item.getField('abstractNote'),
      year: item.getField('date'),
      tags: item.getTags(),
    };
  }

  // 获取论文全文内容
  static async getPaperContent(itemID: number): Promise<string> {
    try {
      const text = await Zotero.FullText.getItemText(itemID);
      return text || '无法获取文献内容，请确保 PDF 已被索引';
    } catch (error) {
      return `获取内容失败: ${error}`;
    }
  }

  // 搜索论文
  static searchPapers(query: string, limit: number = 10) {
    const search = new Zotero.Search();
    search.addCondition('title', 'contains', query);
    const results = search.search();
    return results.slice(0, limit).map(id => this.getPaperInfo(id));
  }

  // 获取当前选中的论文
  static getSelectedItem() {
    const pane = Zotero.getActiveZoteroPane();
    const items = pane.getSelectedItems();
    return items.length > 0 ? items[0] : null;
  }
}
```

---

## 14. UI 组件 CSS 设计

### 14.1 侧边栏样式

```css
/* addon/content/chatPanel.css */

.marginalia-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.marginalia-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.marginalia-message {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.marginalia-message.user {
  justify-content: flex-end;
}

.marginalia-message.assistant {
  justify-content: flex-start;
}

.marginalia-message-content {
  max-width: 85%;
  padding: 10px 12px;
  border-radius: 8px;
  word-wrap: break-word;
  line-height: 1.5;
}

.marginalia-message.user .marginalia-message-content {
  background: #007AFF;
  color: white;
}

.marginalia-message.assistant .marginalia-message-content {
  background: #E5E5EA;
  color: #000;
}

.marginalia-input-area {
  padding: 12px;
  border-top: 1px solid #E5E5EA;
  display: flex;
  gap: 8px;
}

.marginalia-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #D1D1D6;
  border-radius: 6px;
  font-size: 14px;
  resize: none;
  max-height: 100px;
}

.marginalia-button {
  padding: 8px 16px;
  background: #007AFF;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.marginalia-button:hover {
  background: #0051D5;
}

.marginalia-button:disabled {
  background: #D1D1D6;
  cursor: not-allowed;
}

.marginalia-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #999;
  font-size: 13px;
}

.marginalia-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #E5E5EA;
  border-top-color: #007AFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.marginalia-tool-call {
  background: #F5F5F5;
  border-left: 3px solid #007AFF;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin: 4px 0;
}

.marginalia-options-menu {
  position: absolute;
  background: white;
  border: 1px solid #D1D1D6;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  z-index: 1000;
}

.marginalia-options-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
}

.marginalia-options-menu button:hover {
  background: #F5F5F5;
}
```

---

## 15. 测试策略

### 15.1 单元测试

```typescript
// test/apiClient.test.ts
describe('APIClient', () => {
  it('should handle streaming responses', async () => {
    // Mock fetch
    // Test stream parsing
  });

  it('should handle API errors', async () => {
    // Test error handling
  });

  it('should test connection', async () => {
    // Test connection validation
  });
});
```

### 15.2 集成测试

- 测试侧边栏 UI 加载
- 测试对话保存和加载
- 测试工具调用功能
- 测试设置页面保存

### 15.3 手动测试清单

- [ ] 侧边栏正常显示
- [ ] 可以发送消息并收到回复
- [ ] 流式输出正常显示
- [ ] 对话历史正确保存
- [ ] 工具调用功能正常
- [ ] 设置页面可以保存配置
- [ ] API 连接测试功能正常

---

## 16. 部署和发布流程

### 16.1 构建流程

```bash
# 开发模式
npm run start

# 构建生产版本
npm run build

# 发布
npm run release
```

### 16.2 版本管理

- 遵循 Semantic Versioning (SemVer)
- 在 `package.json` 中更新版本号
- 在 `addon/manifest.json` 中更新版本号

### 16.3 发布检查清单

- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] 文档已更新
- [ ] 版本号已更新
- [ ] CHANGELOG 已更新
- [ ] 构建成功
- [ ] 发布到 Zotero 插件市场

---

## 17. 后续优化方向

- 支持更多 LLM 提供商（Claude、Gemini 等）
- 对话搜索功能
- 对话分支管理
- 自定义快捷键
- 主题和外观定制
- 离线模式支持
- 对话导入/导出功能
- 批量处理多篇论文
