# Feishu Markdown

[![Build](https://github.com/huandu/feishu-markdown/actions/workflows/publish-npm.yml/badge.svg)](https://github.com/huandu/feishu-markdown/actions/workflows/publish-npm.yml)
[![license](https://img.shields.io/github/license/huandu/feishu-markdown.svg)](https://github.com/huandu/feishu-markdown/blob/main/LICENSE)

本项目是一个单仓库（monorepo），用于将 Markdown 转换为飞书 / Lark 文档格式，并提供一个 MCP 服务以便与 Model Context Protocol 集成。

主要 package：

- [`feishu-markdown`](packages/feishu-markdown/README.md)：核心库，将 Markdown 转换为飞书文档结构，支持图片、流程图（Mermaid）等处理。
- [`feishu-markdown-mcp`](packages/feishu-markdown-mcp/README.md)：基于 `feishu-markdown` 的 MCP 服务，可作为模型上下文协议（Model Context Protocol）的后端插件使用。

## 快速开始

1. 安装依赖：

```shell
pnpm install
```

2. 构建所有包：

```shell
pnpm build
```

3. 在开发中运行某个包（示例）：

```shell
pnpm --filter feishu-markdown dev
```

## 开发

- 运行全部测试：`pnpm test`
- 代码风格与类型检查：`pnpm lint` / `pnpm typecheck`

## 发布

仓库提供了 GitHub Actions 工作流用于自动发布。发布到 npm 公共仓库需要在仓库 Secrets 中配置 `NPM_TOKEN`（用于 `pnpm publish`）。

## 许可证

本项目使用 MIT 许可证，详见项目根目录的 `LICENSE` 文件。

---

更多信息请查看各子包的 `package.json` 与 `README.md`。
