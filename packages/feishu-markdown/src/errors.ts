/**
 * feishu-markdown 基础错误类
 */
export class FeishuMarkdownError extends Error {
  code: string;
  cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = 'FeishuMarkdownError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Markdown 解析错误
 */
export class ParseError extends FeishuMarkdownError {
  constructor(message: string, cause?: Error) {
    super(message, 'PARSE_ERROR', cause);
    this.name = 'ParseError';
  }
}

/**
 * AST 转换错误
 */
export class TransformError extends FeishuMarkdownError {
  nodeType?: string;

  constructor(message: string, nodeType?: string, cause?: Error) {
    super(message, 'TRANSFORM_ERROR', cause);
    this.name = 'TransformError';
    this.nodeType = nodeType;
  }
}

/**
 * 上传错误
 */
export class UploadError extends FeishuMarkdownError {
  filePath?: string;

  constructor(message: string, filePath?: string, cause?: Error) {
    super(message, 'UPLOAD_ERROR', cause);
    this.name = 'UploadError';
    this.filePath = filePath;
  }
}

/**
 * 飞书 API 错误
 */
export class APIError extends FeishuMarkdownError {
  statusCode?: number;
  feishuCode?: number;
  headers?: Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      method?: string;
      url?: string;
      statusCode?: number;
      feishuCode?: number;
      headers?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    const msgExtras: [string, unknown][] = [
      ['method', options?.method],
      ['url', options?.url],
      ['statusCode', options?.statusCode],
      ['feishuCode', options?.feishuCode],
      ['headers', options?.headers],
    ];
    const extras = msgExtras
      .filter((v) => v[1] !== undefined)
      .map(([k, v]) => `[${k}=${JSON.stringify(v)}]`)
      .join(' ');
    super(
      extras ? `${message} ${extras}` : message,
      'API_ERROR',
      options?.cause
    );

    this.name = 'APIError';
    this.statusCode = options?.statusCode;
    this.feishuCode = options?.feishuCode;
    this.headers = options?.headers;
  }

  /**
   * 是否为限流错误
   */
  isRateLimitError(): boolean {
    return this.feishuCode === 99991400 || this.statusCode === 429;
  }

  /**
   * 是否为权限错误
   */
  isPermissionError(): boolean {
    return this.statusCode === 403 || this.feishuCode === 1770032;
  }
}

/**
 * 配置错误
 */
export class ConfigError extends FeishuMarkdownError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', cause);
    this.name = 'ConfigError';
  }
}

/**
 * Mermaid 渲染错误
 */
export class MermaidError extends FeishuMarkdownError {
  constructor(message: string, cause?: Error) {
    super(message, 'MERMAID_ERROR', cause);
    this.name = 'MermaidError';
  }
}

/**
 * 飞书数据错误
 * 大概率是因为数据不存在或格式不正确引起的错误
 */
export class FeishuDataError extends FeishuMarkdownError {
  constructor(message: string, cause?: Error) {
    super(message, 'FEISHU_DATA_ERROR', cause);
    this.name = 'FeishuDataError';
  }
}
