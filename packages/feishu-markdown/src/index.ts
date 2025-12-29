import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FeishuClient } from './client/index';
import { ConfigError, TransformError } from './errors';
import type { ImageReference, PreparedImage } from './handlers/index';
import { loadImage } from './handlers/index';
import { parseMarkdown } from './parser/index';
import { transformMarkdownToBlocks } from './transformer/index';
import type { DescendantBlock } from './types/feishu';
import type {
  ConvertOptions,
  ConvertResult,
  FeishuMarkdownOptions,
} from './types/options';

/**
 * Markdown 转飞书文档主类
 */
export class FeishuMarkdown {
  private readonly client: FeishuClient;
  private readonly defaultOptions: Partial<ConvertOptions>;

  constructor(options: FeishuMarkdownOptions) {
    if (!options.appId || !options.appSecret) {
      throw new ConfigError('appId and appSecret are required');
    }

    this.client = new FeishuClient(options);
    this.defaultOptions = {};
  }

  /**
   * 将 Markdown 转换并上传到飞书文档
   */
  async convert(
    markdown: string,
    options: ConvertOptions = {}
  ): Promise<ConvertResult> {
    const mergedOptions: ConvertOptions = {
      ...this.defaultOptions,
      ...options,
      mermaid: {
        ...this.defaultOptions.mermaid,
        ...options.mermaid,
      },
    };

    let tempDirCreated = false;
    if (!mergedOptions.mermaidTempDir) {
      mergedOptions.mermaidTempDir = await mkdtemp(
        join(tmpdir(), 'feishu-markdown-')
      );
      tempDirCreated = true;
    }

    try {
      // 1. 解析 Markdown
      const ast = parseMarkdown(markdown);

      // 2. 转换为飞书块
      const { blocks, rootChildrenIds, imageBuffers } =
        await transformMarkdownToBlocks(ast, mergedOptions);

      if (blocks.length === 0) {
        throw new TransformError('No content to convert');
      }

      // 3. 创建文档
      const createDocRequest: { folder_token?: string; title?: string } = {};
      if (mergedOptions.folderToken) {
        createDocRequest.folder_token = mergedOptions.folderToken;
      }
      if (mergedOptions.title) {
        createDocRequest.title = mergedOptions.title;
      }
      const createResponse = await this.client.createDocument(createDocRequest);

      const documentId = createResponse.data?.document.document_id;
      if (!documentId) {
        throw new TransformError(
          'Failed to create document: no document_id returned'
        );
      }

      // 添加协作者
      await this.client.addCollaborator(documentId);

      // 4. 处理图片
      await this.processImages(documentId, blocks, imageBuffers, mergedOptions);

      // 5. 批量创建块
      const batchSize = mergedOptions.batchSize ?? 50;
      let revisionId = createResponse.data?.document.revision_id ?? 1;

      // 按批次创建块
      const batches = this.splitIntoBatches(blocks, rootChildrenIds, batchSize);

      for (const batch of batches) {
        const response = await this.client.createDescendantBlocks(
          documentId,
          documentId, // 父块为文档根节点
          {
            children_id: batch.childrenIds,
            descendants: batch.descendants,
          }
        );
        revisionId = response.data?.document_revision_id ?? revisionId;
        // 上传本批次中所有图片块的媒体并更新块的 image token
        for (const block of batch.descendants) {
          if (block.block_type !== 27) continue;
          const prepared = imageBuffers.get(block.block_id);
          if (prepared?.source.type !== 'buffer') continue;

          try {
            const buf = prepared.source.buffer;
            const fileName =
              prepared.source.fileName ?? prepared.fileName ?? 'image.png';
            const fileToken = await this.client.uploadMedia(
              buf,
              fileName,
              'docx_image',
              documentId,
              buf.length
            );
            await this.client.updateBlock(documentId, block.block_id, {
              replace_image: { token: fileToken },
            });
          } catch (err) {
            console.warn(
              `Failed to upload image for block ${block.block_id}:`,
              err
            );
          }
        }
      }

      // 6. 返回结果
      return {
        documentId,
        url: this.client.getDocumentUrl(documentId),
        revisionId,
      };
    } finally {
      if (tempDirCreated && mergedOptions.mermaidTempDir) {
        try {
          await rm(mergedOptions.mermaidTempDir, {
            recursive: true,
            force: true,
          });
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * 追加 Markdown 内容到文档末尾
   */
  async append(
    documentId: string,
    markdown: string,
    options: ConvertOptions = {}
  ): Promise<ConvertResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    // 1. 解析 Markdown
    const ast = parseMarkdown(markdown);

    // 2. 转换为飞书块
    const { blocks, rootChildrenIds, imageBuffers } =
      await transformMarkdownToBlocks(ast, mergedOptions);

    if (blocks.length === 0) {
      return {
        documentId,
        url: this.client.getDocumentUrl(documentId),
        revisionId: 0,
      };
    }

    // 3. 处理图片
    await this.processImages(documentId, blocks, imageBuffers, mergedOptions);

    // 4. 批量创建块
    const batchSize = mergedOptions.batchSize ?? 50;
    let revisionId = 0;

    // 按批次创建块
    const batches = this.splitIntoBatches(blocks, rootChildrenIds, batchSize);

    for (const batch of batches) {
      const response = await this.client.createDescendantBlocks(
        documentId,
        documentId, // 父块为文档根节点
        {
          children_id: batch.childrenIds,
          descendants: batch.descendants,
        }
      );
      revisionId = response.data?.document_revision_id ?? revisionId;
      // 上传本批次中所有图片块
      for (const block of batch.descendants) {
        if (block.block_type !== 27) continue;
        const prepared = imageBuffers.get(block.block_id);
        if (prepared?.source.type !== 'buffer') continue;

        try {
          const buf = prepared.source.buffer;
          const fileName =
            prepared.source.fileName ?? prepared.fileName ?? 'image.png';
          const fileToken = await this.client.uploadMedia(
            buf,
            fileName,
            'docx_image',
            block.block_id,
            buf.length
          );
          await this.client.updateBlock(documentId, block.block_id, {
            replace_image: { token: fileToken },
          });
        } catch (err) {
          console.warn(
            `Failed to upload image for block ${block.block_id}:`,
            err
          );
        }
      }
    }

    // 5. 返回结果
    return {
      documentId,
      url: this.client.getDocumentUrl(documentId),
      revisionId,
    };
  }

  /**
   * 替换文档内容为 Markdown
   */
  async replace(
    documentId: string,
    markdown: string,
    options: ConvertOptions = {}
  ): Promise<ConvertResult> {
    // 1. 删除所有子块
    let pageToken: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const result = await this.client.listChildren(
        documentId,
        documentId,
        pageToken
      );
      pageToken = result.pageToken;
      hasMore = result.hasMore;

      for (const item of result.items) {
        if (item.block_id) {
          await this.client.deleteBlock(documentId, item.block_id);
        }
      }
    }

    // 2. 追加新内容
    return this.append(documentId, markdown, options);
  }

  /**
   * 仅解析 Markdown 并返回飞书块结构（不上传）
   */
  async parse(
    markdown: string,
    options: ConvertOptions = {}
  ): Promise<{
    blocks: DescendantBlock[];
    rootChildrenIds: string[];
  }> {
    const ast = parseMarkdown(markdown);
    const { blocks, rootChildrenIds } = await transformMarkdownToBlocks(
      ast,
      options
    );
    return { blocks, rootChildrenIds };
  }

  /**
   * 处理图片：下载和上传
   */
  private async processImages(
    _documentId: string,
    blocks: DescendantBlock[],
    imageBuffers: Map<string, ImageReference>,
    options: ConvertOptions
  ): Promise<void> {
    for (const [blockId, data] of imageBuffers) {
      const block = blocks.find((b) => b.block_id === blockId);
      if (block?.block_type !== 27) continue;

      try {
        let imageData: PreparedImage;

        const downloadEnabled = options.downloadImages !== false;

        if (data.source.type === 'buffer') {
          imageData = {
            buffer: data.source.buffer,
            fileName: data.source.fileName ?? data.fileName ?? 'image.png',
          };
        } else {
          // url or path — load via handler
          imageData = await loadImage(data.source, downloadEnabled);
        }

        // 将 imageBuffers 中的条目置为已准备好的二进制数据
        imageBuffers.set(blockId, {
          source: {
            type: 'buffer',
            buffer: imageData.buffer,
            fileName: imageData.fileName,
          },
          fileName: imageData.fileName,
        });
      } catch (error) {
        console.warn(`Failed to process image for block ${blockId}:`, error);
        imageBuffers.delete(blockId);
      }
    }
  }

  /**
   * 将块分批
   */
  private splitIntoBatches(
    blocks: DescendantBlock[],
    rootChildrenIds: string[],
    batchSize: number
  ): { childrenIds: string[]; descendants: DescendantBlock[] }[] {
    // 对于嵌套块 API，我们需要保持块的层级关系
    // 这里简化处理，一次性发送所有块
    // 实际生产中可能需要更复杂的分批逻辑

    if (blocks.length <= batchSize) {
      // 如果总块数较少，一次性发送
      return [
        {
          childrenIds: rootChildrenIds,
          descendants: blocks,
        },
      ];
    }

    // 对于大量块，按根节点分批
    const batches: { childrenIds: string[]; descendants: DescendantBlock[] }[] =
      [];
    const blockMap = new Map(blocks.map((b) => [b.block_id, b]));

    const processedIds = new Set<string>();

    // 收集一个根节点及其所有后代
    const collectDescendants = (id: string): DescendantBlock[] => {
      const result: DescendantBlock[] = [];
      const block = blockMap.get(id);
      if (!block || processedIds.has(id)) return result;

      processedIds.add(id);
      result.push(block);

      for (const childId of block.children) {
        result.push(...collectDescendants(childId));
      }

      return result;
    };

    let currentBatch: {
      childrenIds: string[];
      descendants: DescendantBlock[];
    } = {
      childrenIds: [],
      descendants: [],
    };

    for (const rootId of rootChildrenIds) {
      const descendants = collectDescendants(rootId);

      if (currentBatch.descendants.length + descendants.length > batchSize) {
        if (currentBatch.childrenIds.length > 0) {
          batches.push(currentBatch);
        }
        currentBatch = {
          childrenIds: [rootId],
          descendants: descendants,
        };
      } else {
        currentBatch.childrenIds.push(rootId);
        currentBatch.descendants.push(...descendants);
      }
    }

    if (currentBatch.childrenIds.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }
}

// 导出所有类型和工具
export * from './builders/index';
export { FeishuClient } from './client/index';
export * from './errors';
export * from './handlers/index';
export { parseMarkdown } from './parser/index';
export { transformMarkdownToBlocks } from './transformer/index';
export * from './types/index';
export * from './utils/index';
