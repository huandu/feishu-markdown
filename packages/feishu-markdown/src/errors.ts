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
  /** HTTP status code */
  readonly statusCode: number;
  /** 飞书返回的错误码；如果没有解析出飞书错误码，则为 -1 */
  readonly feishuCode: number;
  /** 飞书返回的错误信息；如果没有解析出飞书错误信息，则为 '' */
  readonly feishuMessage: string;
  /** HTTP 响应头 */
  readonly headers?: Record<string, unknown>;
  /** 完整错误信息 */
  readonly fullMessage: string;

  constructor(
    message: string,
    options?: {
      method?: string;
      url?: string;
      request?: unknown;
      statusCode?: number;
      feishuCode?: number;
      feishuMessage?: string;
      headers?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, 'API_ERROR', options?.cause);

    this.name = 'APIError';
    this.statusCode = options?.statusCode ?? 200;
    this.headers = options?.headers;
    this.feishuCode = options?.feishuCode ?? -1;
    this.feishuMessage = options?.feishuMessage ?? '';

    const msgExtras: [string, unknown][] = [
      ['method', options?.method],
      ['url', options?.url],
      ['request', options?.request],
      ['statusCode', options?.statusCode],
      ['feishuCode', options?.feishuCode],
      ['feishuMessage', options?.feishuMessage],
      ['headers', options?.headers],
    ];
    const stringify = (v: unknown) =>
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      typeof v === 'undefined'
        ? v
        : JSON.stringify(v);
    this.fullMessage = msgExtras
      .filter((v) => v[1] !== undefined)
      .map(([k, v]) => `[${k}=${stringify(v)}]`)
      .join(' ');
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
