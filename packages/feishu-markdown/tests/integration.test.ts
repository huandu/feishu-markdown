import { describe, expect, it } from 'vitest';

import {
  APIError,
  ConfigError,
  MermaidError,
  ParseError,
  TransformError,
  UploadError,
} from '@/errors';
import { FeishuMarkdown } from '@/index';

describe('FeishuMarkdown', () => {
  describe('constructor', () => {
    it('should throw ConfigError when appId is missing', () => {
      expect(() => {
        new FeishuMarkdown({ appId: '', appSecret: 'secret' });
      }).toThrow(ConfigError);
    });

    it('should throw ConfigError when appSecret is missing', () => {
      expect(() => {
        new FeishuMarkdown({ appId: 'appId', appSecret: '' });
      }).toThrow(ConfigError);
    });

    it('should create instance with valid credentials', () => {
      const instance = new FeishuMarkdown({
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
      });
      expect(instance).toBeInstanceOf(FeishuMarkdown);
    });
  });

  describe('parse', () => {
    it('should parse markdown without uploading', async () => {
      const instance = new FeishuMarkdown({
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
      });

      const result = await instance.parse('# Hello World\n\nThis is a test.');

      expect(result.blocks.length).toBeGreaterThan(0);
      expect(result.rootChildrenIds.length).toBeGreaterThan(0);
    });

    it('should parse complex markdown', async () => {
      const instance = new FeishuMarkdown({
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
      });

      const markdown = `# Document Title

## Introduction

This is a **bold** and *italic* text with \`inline code\`.

## Lists

- Item 1
- Item 2
  - Nested item
- Item 3

1. First
2. Second
3. Third

## Code

\`\`\`typescript
const greeting: string = "Hello, Feishu!";
console.log(greeting);
\`\`\`

## Table

| Name | Age | City |
| --- | --- | --- |
| Alice | 25 | Beijing |
| Bob | 30 | Shanghai |

## Quote

> This is a blockquote.

---

The end.
`;

      const result = await instance.parse(markdown);

      expect(result.blocks.length).toBeGreaterThan(10);
      expect(result.rootChildrenIds.length).toBeGreaterThan(5);
    });
  });
});

describe('Error Classes', () => {
  describe('ConfigError', () => {
    it('should have correct name', () => {
      const error = new ConfigError('Config issue');
      expect(error.name).toBe('ConfigError');
      expect(error.message).toBe('Config issue');
      expect(error.code).toBe('CONFIG_ERROR');
    });
  });

  describe('APIError', () => {
    it('should store status and code', () => {
      const error = new APIError('API failed', {
        statusCode: 400,
        feishuCode: 100001,
      });
      expect(error.name).toBe('APIError');
      expect(error.statusCode).toBe(400);
      expect(error.feishuCode).toBe(100001);
    });

    it('should detect rate limit error', () => {
      const error = new APIError('Rate limited', { statusCode: 429 });
      expect(error.isRateLimitError()).toBe(true);
    });
  });

  describe('TransformError', () => {
    it('should have correct name', () => {
      const error = new TransformError('Transform failed');
      expect(error.name).toBe('TransformError');
      expect(error.code).toBe('TRANSFORM_ERROR');
    });

    it('should store node type', () => {
      const error = new TransformError('Unknown node', 'customNode');
      expect(error.nodeType).toBe('customNode');
    });
  });

  describe('UploadError', () => {
    it('should have correct name', () => {
      const error = new UploadError('Upload failed');
      expect(error.name).toBe('UploadError');
      expect(error.code).toBe('UPLOAD_ERROR');
    });

    it('should store file path', () => {
      const error = new UploadError('Upload failed', '/path/to/file.png');
      expect(error.filePath).toBe('/path/to/file.png');
    });
  });

  describe('ParseError', () => {
    it('should have correct name', () => {
      const error = new ParseError('Parse failed');
      expect(error.name).toBe('ParseError');
      expect(error.code).toBe('PARSE_ERROR');
    });
  });

  describe('MermaidError', () => {
    it('should have correct name', () => {
      const error = new MermaidError('Mermaid render failed');
      expect(error.name).toBe('MermaidError');
      expect(error.code).toBe('MERMAID_ERROR');
    });
  });
});
