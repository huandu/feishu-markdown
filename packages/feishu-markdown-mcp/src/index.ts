import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  APIError,
  FeishuMarkdown,
  type FeishuMarkdownOptions,
} from 'feishu-markdown';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import pkg from '../package.json' with { type: 'json' };

// Config storage
let feishuConfig: FeishuMarkdownOptions | null = null;

const server = new McpServer({
  name: 'feishu-markdown-mcp',
  version: pkg.version,
});

// Helper to get client
function getFeishuMarkdown(): FeishuMarkdown {
  if (!feishuConfig) {
    throw new Error('飞书配置未设置。请使用 set_config 工具或提供环境变量。');
  }
  return new FeishuMarkdown(feishuConfig);
}

// 定义 Schema
const SetConfigSchema = z.object({
  appId: z.string(),
  appSecret: z.string(),
  feishuMobile: z.string().optional(),
});

const MermaidOptionsSchema = z.object({
  enabled: z.boolean().optional(),
  theme: z.enum(['default', 'forest', 'dark', 'neutral']).optional(),
  backgroundColor: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const ConvertOptionsSchema = z.object({
  title: z.string().optional(),
  folderToken: z.string().optional(),
  imageBaseDir: z
    .string()
    .optional()
    .describe('本地图片基础路径（用于解析相对路径图片）'),
  downloadImages: z.boolean().optional(),
  mermaid: MermaidOptionsSchema.optional(),
  batchSize: z.number().optional(),
  mermaidTempDir: z.string().optional(),
});

const UploadFileSchema = z.object({
  filePath: z.string().describe('Markdown 文件的绝对路径'),
  ...ConvertOptionsSchema.shape,
});

const UploadTextSchema = z.object({
  text: z.string(),
  ...ConvertOptionsSchema.shape,
});

const UpdateDocSchema = z.object({
  url: z.string().describe('飞书文档 URL'),
  markdown: z.string(),
  mode: z.enum(['append', 'replace']).describe('更新模式'),
  ...ConvertOptionsSchema.shape,
});

// 注册工具
server.registerTool(
  'set_config',
  {
    description: '设置飞书应用配置',
    inputSchema: SetConfigSchema.shape,
  },
  async ({ appId, appSecret, feishuMobile }) => {
    feishuConfig = { appId, appSecret, feishuMobile };
    return {
      content: [{ type: 'text', text: '配置设置成功' }],
    };
  }
);

server.registerTool(
  'upload_markdown_file',
  {
    description: '上传本地 Markdown 文件到飞书',
    inputSchema: UploadFileSchema.shape,
  },
  async ({ filePath, ...options }) => {
    const markdown = await fs.readFile(filePath, 'utf-8');
    const feishu = getFeishuMarkdown();

    // 默认以 Markdown 文件所在目录作为 baseDir，从而支持图片相对路径
    const imageBaseDir = options.imageBaseDir ?? path.dirname(filePath);

    return callTool(() =>
      feishu.convert(markdown, {
        ...options,
        imageBaseDir,
        title: options.title ?? path.basename(filePath),
      })
    );
  }
);

server.registerTool(
  'upload_markdown_text',
  {
    description: '上传 Markdown 文本到飞书',
    inputSchema: UploadTextSchema.shape,
  },
  async ({ text, ...options }) => {
    const feishu = getFeishuMarkdown();
    return callTool(() =>
      feishu.convert(text, {
        ...options,
        title: options.title ?? 'Untitled',
      })
    );
  }
);

server.registerTool(
  'update_feishu_document',
  {
    description: '追加或替换飞书文档内容',
    inputSchema: UpdateDocSchema.shape,
  },
  async ({ url, markdown, mode, ...options }) => {
    const match = /(?:docx|wiki)\/([a-zA-Z0-9]+)/.exec(url);
    if (!match) {
      throw new Error('无效的飞书 URL，无法提取文档 ID');
    }
    const documentId = match[1];

    if (!documentId) {
      throw new Error('无效的飞书 URL，无法提取文档 ID');
    }

    const feishu = getFeishuMarkdown();

    return callTool(() =>
      mode === 'replace'
        ? feishu.replace(documentId, markdown, options)
        : feishu.append(documentId, markdown, options)
    );
  }
);

// 如果环境变量可用，初始化配置
if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
  feishuConfig = {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    feishuMobile: process.env.FEISHU_USER_MOBILE,
  };
}

// 安全的调用工具，如果工具抛异常，将异常信息返回给调用者
const callTool = async <T>(
  fn: () => PromiseLike<T>
): Promise<CallToolResult> => {
  try {
    const result = await fn();
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (e) {
    const result = {
      error: e instanceof Error ? e.name : 'UnknownError',
      message: `uncaught error: ${e instanceof Error ? e.message : e}`,
      fullMessage: e instanceof APIError ? e.fullMessage : undefined,
      stack: e instanceof Error ? e.stack : undefined,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
};

async function run(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Feishu Markdown MCP Server running on stdio');
}

run().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
