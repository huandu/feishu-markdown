# Feishu Markdown MCP Server

[![npm version](https://img.shields.io/npm/v/feishu-markdown-mcp.svg)](https://www.npmjs.com/package/feishu-markdown-mcp)
[![npm downloads](https://img.shields.io/npm/dm/feishu-markdown-mcp.svg)](https://www.npmjs.com/package/feishu-markdown-mcp)
[![Build](https://github.com/huandu/feishu-markdown/actions/workflows/publish.yml/badge.svg)](https://github.com/huandu/feishu-markdown/actions/workflows/publish.yml)

这是一个 Model Context Protocol (MCP) 服务器，提供与飞书（Lark）文档交互的工具。它允许你将 Markdown 文件或文本上传到飞书，并更新现有文档。

## 功能特性

- **Mermaid 自动渲染**：识别 ` ```mermaid ` 代码块，自动生成图片并插入飞书文档（无需手动截图/上传）。
- **本地图片自动上传**：支持 `![...](./local.png)` / `![...](../assets/a.jpg)` / 绝对路径等本地图片引用，自动上传并替换为飞书可用的图片。
- **自动转交文档所有权**：可将新建文档的 owner 转交给指定飞书用户，让用户获得完全控制权（权限、分享、移动、删除等）。
- **上传 Markdown 文件/文本**：将本地文件或文本转换为飞书新版文档并上传。
- **更新现有文档**：对现有飞书文档执行 `append`（追加）或 `replace`（覆盖）。
- **可在 MCP 客户端直接使用**：VS Code / Cursor 等支持 MCP 的客户端可通过 stdio 方式集成。
- **超长 Markdown 支持**：可将超长或大型 Markdown 文档上传到飞书云文档，支持分块上传以处理大文件。
- **保留原始样式**：在转换过程中尽可能保留 Markdown 的原始样式，包括代码块、表格、列表与复杂嵌套结构，最大程度还原原文格式。

## 使用示例（Prompt）

### 1) 上传本地 Markdown 文件（含 Mermaid + 本地图片）

```text
请把这个 Markdown 文件上传到飞书：path/to/doc.md
```

如果 `doc.md` 里包含以下内容：

````markdown
```mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Do]
  B -->|No| D[End]
```

![architecture](./images/arch.png)
````

服务会自动：

- 将 Mermaid 渲染成图片并上传
- 将 `./images/arch.png` 解析为本地图片并上传（默认以 Markdown 文件所在目录作为相对路径基准）

### 2) 追加内容到现有飞书文档

```text
把下面内容追加到这个飞书文档末尾：https://feishu.cn/docx/xxxxx

## 更新说明

- 这是新增的内容
```

## VSCode 使用（MCP Server）

推荐使用 VScode 自带的自动添加 MCP 服务的功能（Automatically discover MCP servers），详情见 [VSCode MCP 文档](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)。

如果需要手动创建 `mcp.json` 文件，下面是一个已经配置好的示例（放置于仓库根目录的 `.vscode/mcp.json`）：

```json
{
 "servers": {
  "Feishu Markdown": {
   "command": "npx",
   "args": [
    "-y",
    "feishu-markdown-mcp@latest"
   ],
   "env": {
    "FEISHU_APP_ID": "${input:feishu-markdown-mcp-app-id}",
    "FEISHU_APP_SECRET": "${input:feishu-markdown-mcp-app-secret}"
   },
   "type": "stdio"
  }
 },
 "inputs": [
  {
   "id": "feishu-markdown-mcp-app-id",
   "type": "promptString",
   "description": "输入飞书 App ID"
  },
  {
   "id": "feishu-markdown-mcp-app-secret",
   "type": "promptString",
   "description": "输入飞书 App Secret"
  },
  {
    "id": "feishu-markdown-mcp-feishu-mobile",
    "type": "promptString",
    "description": "输入飞书用户手机号（可选）"
  }
 ]
}
```

基本说明：

- `servers` 下定义了一个名为 "Feishu Markdown" 的 MCP 服务器条目，使用 `npx feishu-markdown-mcp` 启动已构建的包（`cwd` 指向工作区根目录）。
- `env` 将 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 分别映射为 VSCode 启动时的提示输入（由 `inputs` 定义），也可以直接在系统环境或 CI 中设置这两个变量。
- `inputs` 用于在 VSCode 启动时提示输入 App ID/Secret，提升安全性而不把凭据写入仓库。

关于飞书 App 的权限：请在飞书开放平台创建应用（<https://open.feishu.cn/app>），并为该 App 授予以下权限：

- 基础权限
  - 创建及编辑新版文档：`docx:document`
  - 上传图片和附件到云文档中：`docs:document.media:upload`
- 获取用户信息（用于通过手机号找到用户 ID，从而转交文档所有权给用户）
  - 获取用户 user ID：`contact:user.employee_id:readonly`
  - 通过手机号或邮箱获取用户 ID：`contact:user.id:readonly`

获得 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 后，可以通过上述 `mcp.json` 运行或把它们作为环境变量提供（详见下方“环境变量”一节）。

## 安装

此包是 `feishu-markdown` monorepo 的一部分。

```bash
pnpm install
pnpm build
```

## 使用方法

### 环境变量

你可以使用环境变量配置服务器：

- `FEISHU_APP_ID`: 你的飞书 App ID。
- `FEISHU_APP_SECRET`: 你的飞书 App Secret。
- `FEISHU_USER_MOBILE`: (可选) 飞书用户手机号。
  - 如果设置：每次创建新文档后，会自动将文档所有权转交给该用户（owner transfer）。
  - 这能确保最终文档由用户本人完全控制（权限、分享、移动、删除等）。

### 运行服务器

```bash
node dist/index.js
```

### 工具

#### `set_config`

设置飞书应用配置（如果未通过环境变量提供）。

- `appId` (string): 飞书 App ID。
- `appSecret` (string): 飞书 App Secret。
- `feishuMobile` (string, 可选): 飞书用户手机号。如果设置，每次创建文档后会自动将该用户添加为协作者并授予完全访问权限。

#### `upload_markdown_file`

上传本地 markdown 文件。

- `filePath` (string): Markdown 文件的绝对路径。
- `title` (string, 可选): 文档标题。
- `folderToken` (string, 可选): 创建文档的目标文件夹 Token。
- `imageBaseDir` (string, 可选): 本地图片基础路径（用于解析相对路径图片）。默认使用系统临时目录，并且会在上传完成后自动删除。
- `downloadImages` (boolean, 可选): 是否下载网络图片。
- `mermaid` (object, 可选): Mermaid 图表配置。
- `batchSize` (number, 可选): 批量创建块的大小。

#### `upload_markdown_text`

上传 markdown 文本。

- `text` (string): Markdown 内容。
- `title` (string, 可选): 文档标题。
- `folderToken` (string, 可选): 创建文档的目标文件夹 Token。
- `imageBaseDir` (string, 可选): 本地图片基础路径（用于解析相对路径图片）。
- `downloadImages` (boolean, 可选): 是否下载网络图片。
- `mermaid` (object, 可选): Mermaid 图表配置。
- `batchSize` (number, 可选): 批量创建块的大小。

#### `update_feishu_document`

更新现有文档。

- `url` (string): 飞书文档的 URL (例如 `https://feishu.cn/docx/xyz...`)。
- `markdown` (string): 新的 markdown 内容。
- `mode` (string): `append` (追加到末尾) 或 `replace` (覆盖文档)。
- `imageBaseDir` (string, 可选): 本地图片基础路径（用于解析相对路径图片）。
- `downloadImages` (boolean, 可选): 是否下载网络图片。
- `mermaid` (object, 可选): Mermaid 图表配置。
- `batchSize` (number, 可选): 批量创建块的大小。

## 开发

```bash
# 监听模式
pnpm dev

# 代码检查
pnpm lint
```
