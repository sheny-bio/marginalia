# Marginalia AI Chat

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

Marginalia 是一个为 Zotero 设计的 AI 聊天插件，让你能够与论文进行智能对话，快速理解和分析学术文献。

## 功能特性

### 智能对话
- 基于论文全文的 AI 对话，支持流式响应
- 自动加载论文标题、作者、摘要和全文内容作为上下文
- 支持引用定位：AI 回复中的引用可直接跳转到 PDF 对应页面并高亮文本
- 对话历史自动保存，按论文分别存储

### 引用格式
AI 回复支持特殊的引用格式，点击引用链接可以：
- 自动打开或切换到对应的 PDF 阅读器
- 跳转到引用的页面
- 高亮显示引用的文本

引用格式示例：`[实验准确率达到95% (p.5)](#cite:5:实验准确率达到95%)`

### 对话管理
- 导出对话历史为 Markdown 文件
- 清除单篇论文的对话历史
- 单条消息复制功能
- 对话轮数限制（可配置）

### 工具调用（可选）
支持 AI 调用以下工具增强功能：
- `get_paper_info`: 获取论文基本信息
- `get_paper_content`: 获取论文全文内容
- `search_papers`: 在 Zotero 库中搜索相关论文

### 用户界面
- 集成在 Zotero 右侧面板，无缝融入工作流
- 欢迎页面提供快捷提问建议
- Markdown 渲染支持（代码块、列表、链接等）
- 流畅的动画和交互体验

## 安装

1. 下载最新版本的 `.xpi` 文件
2. 在 Zotero 中打开 `工具` -> `插件`
3. 点击右上角齿轮图标，选择 `Install Add-on From File...`
4. 选择下载的 `.xpi` 文件

## 配置

安装后，进入 `编辑` -> `首选项` -> `Marginalia` 进行配置：

### API 设置
- **API URL**: OpenAI 兼容的 API 端点（如 `https://api.openai.com/v1`）
- **API Key**: 你的 API 密钥
- **模型**: 使用的模型名称（如 `gpt-4`、`claude-3-opus-20240229`）
- **Temperature**: 控制回复的随机性（0-1）
- **Max Tokens**: 单次回复的最大 token 数

### 对话设置
- **系统提示词**: 自定义 AI 的行为和角色
- **启用工具调用**: 允许 AI 调用 Zotero 工具
- **最大对话轮数**: 限制保存的对话历史长度（0 表示不限制）

## 使用方法

1. 在 Zotero 中选择一篇论文
2. 在右侧面板找到 "AI 对话" 标签
3. 在输入框中输入问题，按 Enter 或点击发送
4. AI 会基于论文内容回答你的问题

### 快捷提问
首次打开对话时，会显示快捷提问按钮：
- 总结这篇论文
- 主要贡献是什么？
- 解释研究方法
- 有哪些局限性？

### 引用跳转
当 AI 回复包含引用时（如 `[文本 (p.5)](#cite:5:文本)`），点击引用链接可以：
1. 自动打开 PDF 阅读器
2. 跳转到第 5 页
3. 搜索并高亮 "文本"

### 对话管理
点击输入框右侧的 "+" 按钮，可以：
- 导出对话为 Markdown 文件
- 清除当前论文的对话历史

## 开发

### 环境要求
- Node.js (LTS 版本)
- Zotero 7 Beta

### 开发流程

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 Zotero 路径

# 启动开发服务器（支持热重载）
npm start

# 构建生产版本
npm run build

# 代码检查和格式化
npm run lint:check
npm run lint:fix
```

### 项目结构

```
src/
├── modules/
│   ├── apiClient.ts        # API 客户端（支持流式响应）
│   ├── chatPanel.ts         # 聊天面板 UI 和逻辑
│   ├── storageManager.ts    # 对话历史存储
│   ├── settingsManager.ts   # 配置管理
│   ├── toolCaller.ts        # 工具调用系统
│   ├── zoteroAPI.ts         # Zotero API 封装
│   └── preferenceScript.ts  # 偏好设置界面
├── utils/
│   ├── markdown.ts          # Markdown 渲染
│   └── locale.ts            # 国际化
└── hooks.ts                 # 插件生命周期钩子
```

## 技术栈

- TypeScript
- Zotero Plugin Toolkit
- Marked (Markdown 渲染)
- OpenAI 兼容 API

## 许可证

AGPL-3.0-or-later

## 致谢

本项目基于 [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) 开发。
