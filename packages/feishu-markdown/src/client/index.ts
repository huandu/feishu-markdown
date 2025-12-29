import axios from 'axios';
import type { AxiosError, AxiosInstance } from 'axios';
import FormData from 'form-data';

import { APIError } from '@/errors';
import type {
  CreateBlocksResponse,
  CreateDescendantBlocksRequest,
  CreateDocumentRequest,
  CreateDocumentResponse,
  FeishuBlock,
  TenantAccessTokenResponse,
  UpdateBlockRequest,
} from '@/types/feishu';
import type { FeishuMarkdownOptions } from '@/types/options';
import { retryWithBackoff } from '@/utils/retry';

/**
 * 飞书 API 客户端
 */
export class FeishuClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryTimes: number;
  private readonly retryDelay: number;
  private readonly http: AxiosInstance;
  private readonly userAccessToken?: string;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(options: FeishuMarkdownOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.baseUrl = options.baseUrl ?? 'https://open.feishu.cn';
    this.timeout = options.timeout ?? 30000;
    this.retryTimes = options.retryTimes ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.userAccessToken = options.userAccessToken;

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  /**
   * 获取访问令牌
   * 如果配置了 userAccessToken，直接返回
   * 否则获取 tenant_access_token
   */
  private async getAccessToken(): Promise<string> {
    if (this.userAccessToken) {
      return this.userAccessToken;
    }
    return this.getTenantAccessToken();
  }

  /**
   * 获取租户访问令牌
   */
  private async getTenantAccessToken(): Promise<string> {
    // 检查缓存的令牌是否有效（提前 5 分钟过期）
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 300000) {
      return this.accessToken;
    }

    const response = await retryWithBackoff(async () => {
      try {
        return await this.http.post<TenantAccessTokenResponse>(
          '/open-apis/auth/v3/tenant_access_token/internal',
          {
            app_id: this.appId,
            app_secret: this.appSecret,
          }
        );
      } catch (error) {
        this.handleAxiosError(error);
      }
    }, this.getRetryOptions());

    if (response.data.code !== 0 || !response.data.tenant_access_token) {
      throw new APIError(
        `Failed to get tenant access token: ${response.data.msg}`,
        {
          feishuCode: response.data.code,
        }
      );
    }

    this.accessToken = response.data.tenant_access_token;
    // expire 是秒数，转换为毫秒时间戳
    this.tokenExpiresAt = Date.now() + (response.data.expire ?? 7200) * 1000;

    return this.accessToken;
  }

  /**
   * 处理 Axios 错误
   */
  private handleAxiosError(error: unknown): never {
    const axiosError = error as AxiosError<{ code: number; msg: string }>;
    if (axiosError.response) {
      throw new APIError(axiosError.response.data?.msg ?? axiosError.message, {
        statusCode: axiosError.response.status,
        feishuCode: axiosError.response.data?.code,
        headers: axiosError.response.headers,
      });
    }
    throw error;
  }

  /**
   * 获取重试配置
   */
  private getRetryOptions() {
    return {
      retries: this.retryTimes,
      baseDelay: this.retryDelay,
      shouldRetry: (error: unknown) => {
        if (error instanceof APIError) {
          return error.isRateLimitError();
        }
        return false;
      },
      calculateDelay: (error: unknown, attempt: number) => {
        if (
          error instanceof APIError &&
          error.isRateLimitError() &&
          error.headers
        ) {
          const reset = error.headers['x-ogw-ratelimit-reset'] as string;
          if (reset) {
            const resetSeconds = parseInt(reset, 10);
            if (!isNaN(resetSeconds)) {
              return resetSeconds * 1000;
            }
          }
        }

        // 默认指数退避策略
        const delayMs = Math.min(this.retryDelay * Math.pow(2, attempt), 30000);
        return delayMs * (0.75 + Math.random() * 0.5);
      },
    };
  }

  /**
   * 发送带认证的请求
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    data?: unknown
  ): Promise<T> {
    const token = await this.getAccessToken();

    return retryWithBackoff(async () => {
      try {
        const response = await this.http.request<T>({
          method,
          url,
          data,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        return response.data;
      } catch (error) {
        this.handleAxiosError(error);
      }
    }, this.getRetryOptions());
  }

  /**
   * 创建新文档
   */
  async createDocument(
    options: CreateDocumentRequest = {}
  ): Promise<CreateDocumentResponse> {
    const response = await this.request<CreateDocumentResponse>(
      'POST',
      '/open-apis/docx/v1/documents',
      options
    );

    if (response.code !== 0) {
      throw new APIError(`Failed to create document: ${response.msg}`, {
        feishuCode: response.code,
      });
    }

    return response;
  }

  /**
   * 创建嵌套块
   * 使用 Create Nested Block API 一次性创建带层级关系的块
   */
  async createDescendantBlocks(
    documentId: string,
    parentBlockId: string,
    request: CreateDescendantBlocksRequest
  ): Promise<CreateBlocksResponse> {
    const response = await this.request<CreateBlocksResponse>(
      'POST',
      `/open-apis/docx/v1/documents/${documentId}/blocks/${parentBlockId}/descendant`,
      request
    );

    if (response.code !== 0) {
      throw new APIError(`Failed to create blocks: ${response.msg}`, {
        feishuCode: response.code,
      });
    }

    return response;
  }

  /**
   * 更新块
   */
  async updateBlock(
    documentId: string,
    blockId: string,
    request: UpdateBlockRequest
  ): Promise<void> {
    const response = await this.request<{ code: number; msg: string }>(
      'PATCH',
      `/open-apis/docx/v1/documents/${documentId}/blocks/${blockId}`,
      request
    );

    if (response.code !== 0) {
      throw new APIError(`Failed to update block: ${response.msg}`, {
        feishuCode: response.code,
      });
    }
  }

  /**
   * 上传媒体文件
   */
  async uploadMedia(
    file: Buffer,
    fileName: string,
    parentType: 'docx_image' | 'docx_file',
    parentNode: string,
    size?: number
  ): Promise<string> {
    const token = await this.getAccessToken();

    // 使用 FormData 上传文件
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('file_name', fileName);
    formData.append('parent_type', parentType);
    formData.append('parent_node', parentNode);
    formData.append('size', String(size ?? file.length));

    const response = await retryWithBackoff(async () => {
      try {
        const result = await this.http.post<{
          code: number;
          msg: string;
          data?: { file_token: string };
        }>('/open-apis/drive/v1/medias/upload_all', formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            ...formData.getHeaders(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });
        return result.data;
      } catch (error) {
        this.handleAxiosError(error);
      }
    }, this.getRetryOptions());

    if (response.code !== 0 || !response.data?.file_token) {
      throw new APIError(`Failed to upload media: ${response.msg}`, {
        feishuCode: response.code,
      });
    }

    return response.data.file_token;
  }

  /**
   * 创建图片块并上传图片
   */
  async createImageBlock(
    documentId: string,
    parentBlockId: string,
    imageBuffer: Buffer,
    fileName: string,
    index?: number
  ): Promise<FeishuBlock> {
    // 1. 创建空图片块
    const createResponse = await this.request<CreateBlocksResponse>(
      'POST',
      `/open-apis/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children`,
      {
        index,
        children: [
          {
            block_type: 27, // Image
            image: {},
          },
        ],
      }
    );

    if (createResponse.code !== 0 || !createResponse.data?.children[0]) {
      throw new APIError(
        `Failed to create image block: ${createResponse.msg}`,
        {
          feishuCode: createResponse.code,
        }
      );
    }

    const imageBlock = createResponse.data.children[0];
    const blockId = imageBlock.block_id;

    if (!blockId) {
      throw new APIError('Image block created but no block_id returned');
    }

    // 2. 上传图片
    const fileToken = await this.uploadMedia(
      imageBuffer,
      fileName,
      'docx_image',
      blockId
    );

    // 3. 更新图片块的 token
    await this.updateBlock(documentId, blockId, {
      replace_image: {
        token: fileToken,
      },
    });

    return {
      ...imageBlock,
      image: {
        ...imageBlock.image,
        token: fileToken,
      },
    };
  }

  /**
   * 删除块
   */
  async deleteBlock(documentId: string, blockId: string): Promise<void> {
    const response = await this.request<{ code: number; msg: string }>(
      'DELETE',
      `/open-apis/docx/v1/documents/${documentId}/blocks/${blockId}`
    );

    if (response.code !== 0) {
      throw new APIError(`Failed to delete block: ${response.msg}`, {
        feishuCode: response.code,
      });
    }
  }

  /**
   * 获取子块列表
   */
  async listChildren(
    documentId: string,
    blockId: string,
    pageToken?: string,
    pageSize = 500
  ): Promise<{ items: FeishuBlock[]; pageToken?: string; hasMore: boolean }> {
    const response = await this.request<{
      code: number;
      msg: string;
      data: { items: FeishuBlock[]; page_token?: string; has_more: boolean };
    }>(
      'GET',
      `/open-apis/docx/v1/documents/${documentId}/blocks/${blockId}/children?page_size=${pageSize}${
        pageToken ? `&page_token=${pageToken}` : ''
      }`
    );

    if (response.code !== 0) {
      throw new APIError(`Failed to list children: ${response.msg}`, {
        feishuCode: response.code,
      });
    }

    return {
      items: response.data.items,
      pageToken: response.data.page_token,
      hasMore: response.data.has_more,
    };
  }

  /**
   * 获取文档 URL
   */
  getDocumentUrl(documentId: string): string {
    return `https://feishu.cn/docx/${documentId}`;
  }
}
