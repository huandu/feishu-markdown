/**
 * Markdown 转飞书文档配置选项
 */
export interface FeishuMarkdownOptions {
  /**
   * 飞书应用 App ID
   */
  appId: string;

  /**
   * 飞书应用 App Secret
   */
  appSecret: string;

  /**
   * API 基础 URL
   * @default 'https://open.feishu.cn'
   */
  baseUrl?: string;

  /**
   * 请求超时时间（毫秒）
   * @default 30000
   */
  timeout?: number;

  /**
   * 重试次数
   * @default 3
   */
  retryTimes?: number;

  /**
   * 重试基础延迟（毫秒）
   * @default 1000
   */
  retryDelay?: number;
}

/**
 * 文档转换选项
 */
export interface ConvertOptions {
  /**
   * 文档标题
   */
  title?: string;

  /**
   * 目标文件夹 token
   */
  folderToken?: string;

  /**
   * 本地图片基础路径（用于解析相对路径图片）
   */
  imageBaseDir?: string;

  /**
   * 是否下载网络图片
   * @default true
   */
  downloadImages?: boolean;

  /**
   * Mermaid 图表配置
   */
  mermaid?: MermaidOptions;

  /**
   * 每批创建的块数量上限
   * @default 50
   */
  batchSize?: number;
}

/**
 * Mermaid 配置选项
 */
export interface MermaidOptions {
  /**
   * 是否启用 Mermaid 处理
   * @default true
   */
  enabled?: boolean;

  /**
   * Mermaid 主题
   * @default 'default'
   */
  theme?: 'default' | 'forest' | 'dark' | 'neutral';

  /**
   * 背景颜色
   * @default 'white'
   */
  backgroundColor?: string;

  /**
   * 输出图片宽度
   */
  width?: number;

  /**
   * 输出图片高度
   */
  height?: number;
}

/**
 * 转换结果
 */
export interface ConvertResult {
  /**
   * 文档 ID
   */
  documentId: string;

  /**
   * 文档 URL
   */
  url: string;

  /**
   * 文档修订版本
   */
  revisionId: number;
}
