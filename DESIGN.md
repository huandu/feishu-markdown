# feishu-markdown 设计文档

## 1. 项目概述

`feishu-markdown` 是一个将 Markdown 文档转换为飞书云文档的 Node.js 工具库。它能够解析 Markdown 内容，将其转换为飞书云文档 API 所需的 Block 结构，并通过 API 上传到飞书。

### 1.1 核心特性

- 📝 完整支持常见 Markdown 语法（标题、列表、表格、代码块等）
- 🎨 保留文本样式（粗体、斜体、删除线、链接等）
- 📊 支持表格转换为飞书原生表格
- 🖼️ 支持图片上传
- 📈 支持 Mermaid 图表（自动转换为图片）
- 🔧 模块化设计，易于扩展

## 2. 系统架构

### 2.1 整体架构图

```text
┌─────────────────────────────────────────────────────────────────┐
│                         feishu-markdown                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   Markdown   │───▶│  Transformer │───▶│  Feishu Client   │   │
│  │    Parser    │    │              │    │                  │   │
│  └──────────────┘    └──────────────┘    └──────────────────┘   │
│         │                   │                     │              │
│         ▼                   ▼                     ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   AST Node   │    │ Feishu Block │    │   HTTP Client    │   │
│  │   (mdast)    │    │   Builders   │    │   (axios)        │   │
│  └──────────────┘    └──────────────┘    └──────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Special Handlers                        │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │   │
│  │  │ Mermaid │  │  Table  │  │  Image  │  │   Code      │  │   │
│  │  │ Handler │  │ Handler │  │ Handler │  │   Handler   │  │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块说明

#### 2.2.1 Markdown Parser

- 使用 `unified` + `remark-parse` 解析 Markdown 为 AST
- 支持 GFM（GitHub Flavored Markdown）扩展

#### 2.2.2 Transformer

- 遍历 AST 节点，转换为飞书 Block 结构
- 处理嵌套结构（如列表嵌套、表格单元格内容）
- 管理 Block ID 生成

#### 2.2.3 Block Builders

- 封装各类飞书 Block 的构建逻辑
- 类型安全的 Block 创建

#### 2.2.4 Feishu Client

- 封装飞书 API 调用
- 处理认证、重试、限流
- 管理文件上传

#### 2.2.5 Special Handlers

- **MermaidHandler**: 使用 mermaid-cli 将 Mermaid 代码转为图片
- **TableHandler**: 处理 Markdown 表格到飞书表格的转换
- **ImageHandler**: 处理图片下载和上传
- **CodeHandler**: 处理代码块语言映射

## 3. 数据流

```text
Markdown Text
     │
     ▼
┌────────────┐
│   Parse    │  使用 remark 解析
└────────────┘
     │
     ▼
   mdast AST
     │
     ▼
┌────────────┐
│ Transform  │  遍历 AST，转换为 Feishu Blocks
└────────────┘
     │
     ▼
 Feishu Blocks (with temp IDs)
     │
     ▼
┌────────────┐
│  Upload    │  调用飞书 API 创建文档和 Block
└────────────┘
     │
     ▼
 Document URL
```

## 4. Markdown 到 Feishu Block 映射

| Markdown 元素 | 飞书 Block Type       | Block Type ID |
| ------------- | --------------------- | ------------- |
| 段落          | Text                  | 2             |
| 标题 H1       | Heading1              | 3             |
| 标题 H2       | Heading2              | 4             |
| 标题 H3       | Heading3              | 5             |
| 标题 H4       | Heading4              | 6             |
| 标题 H5       | Heading5              | 7             |
| 标题 H6       | Heading6              | 8             |
| 无序列表项    | Bullet                | 12            |
| 有序列表项    | Ordered               | 13            |
| 代码块        | Code                  | 14            |
| 引用          | QuoteContainer + Text | 34 + 2        |
| 分隔线        | Divider               | 22            |
| 表格          | Table + TableCell     | 31 + 32       |
| 图片          | Image                 | 27            |
| 任务列表      | Todo                  | 17            |

## 5. 文本样式映射

| Markdown 语法 | TextElementStyle 属性 |
| ------------- | --------------------- |
| `**bold**`    | bold: true            |
| `*italic*`    | italic: true          |
| `~~strike~~`  | strikethrough: true   |
| `` `code` ``  | inline_code: true     |
| `[link](url)` | link: { url: "..." }  |

## 6. 代码语言映射

飞书支持的代码语言枚举（部分）：

| 语言       | CodeLanguage ID |
| ---------- | --------------- |
| PlainText  | 1               |
| Bash/Shell | 7               |
| C          | 10              |
| C++        | 9               |
| C#         | 8               |
| Go         | 22              |
| HTML       | 24              |
| Java       | 29              |
| JavaScript | 30              |
| JSON       | 28              |
| Kotlin     | 32              |
| Markdown   | 39              |
| PHP        | 43              |
| Python     | 49              |
| Ruby       | 52              |
| Rust       | 53              |
| SQL        | 56              |
| Swift      | 61              |
| TypeScript | 63              |
| XML        | 66              |
| YAML       | 67              |

## 7. 特殊处理

### 7.1 Mermaid 图表

当遇到 `mermaid` 代码块时：

1. 提取 Mermaid 代码内容
2. 调用 `@mermaid-js/mermaid-cli` 生成 PNG 图片
3. 上传图片到飞书
4. 创建 Image Block 替代原代码块

```typescript
// 伪代码
async function handleMermaid(code: string): Promise<ImageBlock> {
  const pngPath = await mermaidCli.render(code);
  const token = await uploadImage(pngPath);
  return createImageBlock(token);
}
```

### 7.2 表格处理

飞书表格结构：

- Table Block 包含 TableCell Block 作为子节点
- 需要指定 row_size 和 column_size
- 使用 Create Nested Block API 一次性创建

```typescript
interface TableStructure {
  block_type: 31; // Table
  table: {
    property: {
      row_size: number;
      column_size: number;
    };
  };
  children: string[]; // TableCell block_ids
}
```

### 7.3 图片处理

图片上传流程：

1. 创建空 Image Block
2. 上传图片到飞书 Media API
3. 更新 Image Block 的 token

支持的图片来源：

- 本地文件路径
- 网络 URL（自动下载）
- Base64 Data URL

### 7.4 嵌套列表

飞书列表通过 `children` 属性实现嵌套：

```typescript
{
  block_type: 12,  // Bullet
  bullet: { elements: [...] },
  children: ["nested_item_block_id"]
}
```

## 8. API 使用

### 8.1 创建文档流程

1. **创建空文档**
   - `POST /open-apis/docx/v1/documents`
   - 返回 `document_id`

2. **创建 Blocks**
   - `POST /open-apis/docx/v1/documents/:document_id/blocks/:block_id/descendant`
   - 使用 Create Nested Block API 批量创建带层级的 blocks

3. **上传媒体**（如需要）
   - `POST /open-apis/drive/v1/medias/upload_all`
   - 返回 `file_token`

4. **更新 Block**（如需要）
   - `PATCH /open-apis/docx/v1/documents/:document_id/blocks/:block_id`
   - 用于设置图片/文件的 token

### 8.2 限流处理

- 单应用调用频率：3次/秒
- 单文档并发编辑：3次/秒
- 单次创建 Block 上限：50个
- 单次批量创建 Block 上限：1000个

实现指数退避重试策略。

## 9. 目录结构

```text
feishu-markdown/
├── src/
│   ├── index.ts                 # 主入口
│   ├── types/                   # TypeScript 类型定义
│   │   ├── feishu.ts           # 飞书 API 类型
│   │   ├── markdown.ts         # Markdown AST 类型
│   │   └── options.ts          # 配置选项类型
│   ├── parser/                  # Markdown 解析器
│   │   └── index.ts
│   ├── transformer/             # AST 到 Block 转换器
│   │   ├── index.ts
│   │   └── visitors/           # 各节点类型访问器
│   │       ├── heading.ts
│   │       ├── paragraph.ts
│   │       ├── list.ts
│   │       ├── code.ts
│   │       ├── table.ts
│   │       ├── blockquote.ts
│   │       └── image.ts
│   ├── builders/                # Block 构建器
│   │   ├── text.ts
│   │   ├── heading.ts
│   │   ├── list.ts
│   │   ├── code.ts
│   │   ├── table.ts
│   │   ├── quote.ts
│   │   └── image.ts
│   ├── client/                  # 飞书 API 客户端
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── document.ts
│   │   └── media.ts
│   ├── handlers/                # 特殊处理器
│   │   ├── mermaid.ts
│   │   └── image.ts
│   └── utils/                   # 工具函数
│       ├── id.ts               # Block ID 生成
│       ├── language.ts         # 代码语言映射
│       └── retry.ts            # 重试逻辑
├── tests/                       # 测试文件
│   ├── parser.test.ts
│   ├── transformer.test.ts
│   ├── builders.test.ts
│   └── integration.test.ts
├── examples/                    # 使用示例
│   └── basic.ts
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
├── README.md
└── DESIGN.md
```

## 10. 错误处理

### 10.1 错误类型

```typescript
class FeishuMarkdownError extends Error {
  code: string;
  cause?: Error;
}

class ParseError extends FeishuMarkdownError {}
class TransformError extends FeishuMarkdownError {}
class UploadError extends FeishuMarkdownError {}
class APIError extends FeishuMarkdownError {
  statusCode: number;
  feishuCode: number;
}
```

### 10.2 常见错误码

| 错误码   | 说明              | 处理方式        |
| -------- | ----------------- | --------------- |
| 1770001  | 参数无效          | 检查 Block 结构 |
| 1770004  | Block 数量超限    | 分批创建        |
| 1770007  | 子 Block 数量超限 | 分批创建        |
| 99991400 | 频率限制          | 指数退避重试    |

## 11. 配置选项

```typescript
interface FeishuMarkdownOptions {
  // 认证配置
  appId: string;
  appSecret: string;

  // 可选配置
  folderToken?: string; // 目标文件夹
  documentTitle?: string; // 文档标题

  // 图片处理
  imageBaseDir?: string; // 本地图片基础路径
  downloadImages?: boolean; // 是否下载网络图片

  // Mermaid 配置
  mermaid?: {
    enabled?: boolean; // 是否启用 Mermaid 处理
    theme?: string; // Mermaid 主题
    backgroundColor?: string; // 背景色
  };

  // 高级选项
  batchSize?: number; // 批量创建大小
  retryTimes?: number; // 重试次数
  retryDelay?: number; // 重试延迟（ms）
}
```

## 12. 使用示例

### 12.1 基础用法

```typescript
import { FeishuMarkdown } from 'feishu-markdown';

const converter = new FeishuMarkdown({
  appId: 'your-app-id',
  appSecret: 'your-app-secret',
});

const markdown = `
# Hello World

This is a **bold** and *italic* text.

## Features

- Item 1
- Item 2
  - Nested item

\`\`\`javascript
console.log('Hello');
\`\`\`
`;

const result = await converter.convert(markdown, {
  title: 'My Document',
  folderToken: 'folder-token',
});

console.log('Document URL:', result.url);
```

### 12.2 高级用法

```typescript
const result = await converter.convert(markdown, {
  title: 'Complex Document',
  mermaid: {
    enabled: true,
    theme: 'default',
  },
  imageBaseDir: './assets',
  downloadImages: true,
});
```

## 13. 扩展性

### 13.1 自定义 Block 构建器

```typescript
import { BlockBuilder, registerBuilder } from 'feishu-markdown';

class CustomBuilder implements BlockBuilder {
  canHandle(node: Node): boolean {
    return node.type === 'custom';
  }

  build(node: Node): Block {
    // 自定义构建逻辑
  }
}

registerBuilder(new CustomBuilder());
```

### 13.2 自定义访问器

```typescript
import { Visitor, registerVisitor } from 'feishu-markdown';

const customVisitor: Visitor = {
  type: 'customNode',
  visit(node, context) {
    // 自定义访问逻辑
  },
};

registerVisitor(customVisitor);
```

## 14. 性能考虑

1. **批量操作**: 使用 Create Nested Block API 一次性创建多个 Block
2. **并行上传**: 图片上传可并行执行
3. **缓存**: 对 Mermaid 渲染结果进行缓存
4. **限流控制**: 自动处理 API 限流，避免请求失败

## 15. 测试策略

1. **单元测试**: 测试各个模块的独立功能
2. **集成测试**: 测试完整的转换流程（可 mock API）
3. **端到端测试**: 实际调用飞书 API（需配置环境变量）

## 16. 后续规划

- [ ] 支持更多 Block 类型（Bitable、Sheet 等）
- [ ] 支持双向转换（飞书文档 → Markdown）
- [ ] CLI 工具
- [ ] VS Code 插件集成
- [ ] Webhook 支持，实现文档自动同步
