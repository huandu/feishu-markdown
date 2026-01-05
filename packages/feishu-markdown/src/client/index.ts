import axios from 'axios';
import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
} from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { APIError, FeishuDataError } from '@/errors';
import type { PreparedImage } from '@/handlers/image';
import { BlockType } from '@/types/feishu';
import type {
  BatchGetIdResponse,
  BatchUpdateBlockRequest,
  BlockChildrenResponse,
  CreateBlocksResponse,
  CreateDescendantBlocksRequest,
  CreateDocumentRequest,
  CreateDocumentResponse,
  FeishuAPIResponse,
  FeishuBlock,
  TenantAccessTokenResponse,
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
  private readonly feishuMobile?: string;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private feishuOpenId?: string | null;

  constructor(options: FeishuMarkdownOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.baseUrl = options.baseUrl ?? 'https://open.feishu.cn';
    this.timeout = options.timeout ?? 30000;
    this.retryTimes = options.retryTimes ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.feishuMobile = options.feishuMobile;

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
   * 获取 tenant_access_token
   */
  private async getAccessToken(): Promise<string> {
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

    const method = 'POST';
    const url = '/open-apis/auth/v3/tenant_access_token/internal';

    const response = await retryWithBackoff(async () => {
      try {
        return await this.http.post<TenantAccessTokenResponse>(url, {
          app_id: this.appId,
          app_secret: this.appSecret,
        });
      } catch (error) {
        this.handleAxiosError(method, url, error);
      }
    }, this.getRetryOptions());

    if (response.data.code !== 0 || !response.data.tenant_access_token) {
      throw new APIError(
        `Failed to get tenant access token: ${response.data.msg}`,
        {
          method,
          url,
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
  private handleAxiosError(method: string, url: string, error: unknown): never {
    const axiosError = error as AxiosError<FeishuAPIResponse>;
    if (axiosError.response) {
      throw new APIError(
        axiosError.response.data?.msg ?? `transport: ${axiosError.message}`,
        {
          method,
          url,
          statusCode: axiosError.response.status,
          feishuCode: axiosError.response.data?.code,
          headers: axiosError.response.headers,
        }
      );
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
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const token = await this.getAccessToken();

    return retryWithBackoff(async () => {
      try {
        const headers: Record<string, unknown> & { Authorization?: string } =
          {};
        if (config?.headers) {
          Object.assign(headers, config.headers);
        }
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response: AxiosResponse<FeishuAPIResponse<T>> =
          await this.http.request({
            method,
            url,
            data,
            ...config,
            headers: headers as unknown as AxiosRequestHeaders,
          });

        if (response.data.code !== 0) {
          throw new APIError(response.data.msg ?? 'Unknown error', {
            method,
            url,
            request: data,
            feishuCode: response.data.code,
            feishuMessage: response.data.msg,
          });
        }

        return response.data.data;
      } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          if (
            axiosError.response.status >= 400 &&
            axiosError.response.status < 600
          ) {
            const responseData = axiosError.response.data;
            let parsedData: unknown = responseData;

            if (typeof responseData === 'string') {
              try {
                parsedData = JSON.parse(responseData);
              } catch {
                // ignore
              }
            }

            if (
              parsedData &&
              typeof parsedData === 'object' &&
              'code' in parsedData
            ) {
              const errorData = parsedData as FeishuAPIResponse;
              throw new APIError(errorData.msg ?? 'Unknown business error', {
                method,
                url,
                request: data,
                feishuCode: errorData.code,
                feishuMessage: errorData.msg,
                statusCode: axiosError.response.status,
              });
            }
          }

          throw new APIError('Unknown server error', {
            method,
            url,
            request: data,
            statusCode: axiosError.response.status,
          });
        }
        this.handleAxiosError(method, url, error);
      }
    }, this.getRetryOptions());
  }

  /**
   * 创建新文档
   */
  async createDocument(
    options: CreateDocumentRequest = {}
  ): Promise<CreateDocumentResponse> {
    const method = 'POST';
    const url = '/open-apis/docx/v1/documents';
    return this.request<CreateDocumentResponse>(method, url, options);
  }

  /**
   * 通过手机号获取用户 ID
   */
  async getOpenIdByMobile(mobile: string): Promise<string | null> {
    const method = 'POST';
    const url = '/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id';
    const { user_list } = await this.request<BatchGetIdResponse>(method, url, {
      mobiles: [mobile],
    });

    const user = user_list?.[0];
    if (!user?.user_id) {
      return null;
    }

    return user.user_id;
  }

  /**
   * 添加协作者
   */
  async addCollaborator(token: string): Promise<void> {
    const openId = await this.fetchOpenId();

    if (!openId) {
      return;
    }

    const method = 'POST';
    const url = `/open-apis/drive/v1/permissions/${token}/members?type=docx`;
    await this.request<null>(method, url, {
      member_type: 'openid',
      member_id: openId,
      perm: 'full_access',
    });
  }

  /**
   * 获取 Open ID
   */
  private async fetchOpenId(): Promise<string | null> {
    if (this.feishuOpenId !== undefined) {
      return this.feishuOpenId;
    }

    if (!this.feishuMobile) {
      this.feishuOpenId = null;
      return null;
    }

    this.feishuOpenId = await this.getOpenIdByMobile(this.feishuMobile);

    if (!this.feishuOpenId) {
      throw new FeishuDataError(
        `Failed to find open ID for mobile: ${this.feishuMobile}`
      );
    }

    return this.feishuOpenId;
  }

  /**
   * 转移文档所有者
   * 1. 如果设置了 feishuMobile，才会执行这个操作
   * 2. 调用飞书接口转移 owner
   */
  async transferOwner(token: string): Promise<void> {
    const openId = await this.fetchOpenId();

    if (!openId) {
      return;
    }

    const method = 'POST';
    const url = `/open-apis/drive/v1/permissions/${token}/members/transfer_owner?type=docx`;

    await this.request<null>(method, url, {
      member_type: 'openid',
      member_id: openId,
    });
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
    const method = 'POST';
    const url = `/open-apis/docx/v1/documents/${documentId}/blocks/${parentBlockId}/descendant`;
    return this.request<CreateBlocksResponse>(method, url, request);
  }

  /**
   * 批量更新块
   */
  async updateBlocks(
    documentId: string,
    requests: BatchUpdateBlockRequest[]
  ): Promise<void> {
    const method = 'PATCH';
    const url = `/open-apis/docx/v1/documents/${documentId}/blocks/batch_update`;
    await this.request<null>(method, url, {
      requests,
    });
  }

  /**
   * 上传媒体文件
   */
  async uploadMedia(
    file: Buffer | string,
    fileName: string,
    parentType: 'docx_image' | 'docx_file',
    parentNode: string,
    size?: number
  ): Promise<string> {
    // 使用 FormData 上传文件
    const formData = new FormData();

    if (Buffer.isBuffer(file)) {
      formData.append('file', file, fileName);
      formData.append('size', String(size ?? file.length));
    } else {
      const stream = createReadStream(file);
      formData.append('file', stream, fileName);

      if (size === undefined) {
        const stats = await stat(file);
        size = stats.size;
      }
      formData.append('size', String(size));
    }

    formData.append('file_name', fileName);
    formData.append('parent_type', parentType);
    formData.append('parent_node', parentNode);

    const method = 'POST';
    const url = '/open-apis/drive/v1/medias/upload_all';

    const data = await this.request<{ file_token: string }>(
      method,
      url,
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    if (!data?.file_token) {
      throw new APIError('Failed to upload media: no file_token returned', {
        method,
        url,
      });
    }

    return data.file_token;
  }

  /**
   * 创建图片块并上传图片
   */
  async createImageBlock(
    documentId: string,
    parentBlockId: string,
    image: PreparedImage,
    index?: number
  ): Promise<FeishuBlock> {
    const { buffer, path, fileName } = image;
    const file = buffer ?? path;

    if (!file) {
      throw new FeishuDataError(
        'Image must have either path or buffer to upload'
      );
    }

    // 1. 创建空图片块
    const method = 'POST';
    const url = `/open-apis/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children`;
    const { children } = await this.request<CreateBlocksResponse>(method, url, {
      index,
      children: [
        {
          block_type: BlockType.Image,
          image: {},
        },
      ],
    });

    if (!children[0]) {
      throw new APIError('Failed to create image block: no children returned', {
        method,
        url,
      });
    }

    const imageBlock = children[0];
    const blockId = imageBlock.block_id;

    if (!blockId) {
      throw new APIError('Image block created but no block_id returned', {
        method,
        url,
      });
    }

    // 2. 上传图片
    const fileToken = await this.uploadMedia(
      file,
      fileName,
      'docx_image',
      blockId
    );

    // 3. 更新图片块的 token
    await this.updateBlocks(documentId, [
      {
        block_id: blockId,
        replace_image: {
          token: fileToken,
        },
      },
    ]);

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
    const method = 'DELETE';
    const url = `/open-apis/docx/v1/documents/${documentId}/blocks/${blockId}`;
    await this.request<null>(method, url);
  }

  /**
   * 获取子块列表
   */
  async listChildren(
    documentId: string,
    blockId: string,
    pageToken?: string,
    pageSize = 500
  ): Promise<BlockChildrenResponse> {
    const method = 'GET';
    const url = `/open-apis/docx/v1/documents/${documentId}/blocks/${blockId}/children?page_size=${pageSize}${
      pageToken ? `&page_token=${pageToken}` : ''
    }`;
    return this.request<BlockChildrenResponse>(method, url);
  }

  /**
   * 获取文档 URL
   */
  getDocumentUrl(documentId: string): string {
    return `https://feishu.cn/docx/${documentId}`;
  }
}
