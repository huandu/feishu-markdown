import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { FeishuClient } from '@/client/index';
import { ConfigError, TransformError } from '@/errors';
import type { ImageReference, PreparedImage } from '@/handlers';
import { loadImage } from '@/handlers';
import { parseMarkdown } from '@/parser';
import { transformMarkdownToBlocks } from '@/transformer';
import type {
  BatchUpdateBlockRequest,
  DescendantBlock,
  FeishuBlock,
} from '@/types/feishu';
import { BlockType } from '@/types/feishu';
import type {
  ConvertOptions,
  ConvertResult,
  FeishuMarkdownOptions,
} from '@/types/options';

interface UploadContentBatch {
  parentBlockId: string;
  blocks: DescendantBlock[];
  children: DescendantBlock[];
}

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
      const { blocks, imageBuffers } = await transformMarkdownToBlocks(
        ast,
        mergedOptions
      );

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
      const { document } = await this.client.createDocument(createDocRequest);

      const documentId = document.document_id;
      if (!documentId) {
        throw new TransformError(
          'Failed to create document: no document_id returned'
        );
      }

      // 4. 上传内容
      const revisionId = await this.uploadContent(
        documentId,
        blocks,
        imageBuffers,
        mergedOptions,
        document.revision_id
      );

      // 5. 转移文档所有者
      await this.client.transferOwner(documentId);

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
      const { blocks, imageBuffers } = await transformMarkdownToBlocks(
        ast,
        mergedOptions
      );

      if (blocks.length === 0) {
        return {
          documentId,
          url: this.client.getDocumentUrl(documentId),
          revisionId: 0,
        };
      }

      // 3. 上传内容
      const revisionId = await this.uploadContent(
        documentId,
        blocks,
        imageBuffers,
        mergedOptions
      );

      // 4. 返回结果
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
      const data = await this.client.listChildren(
        documentId,
        documentId,
        pageToken
      );
      pageToken = data.page_token;
      hasMore = data.has_more;

      for (const item of data.items) {
        if (item.block_id) {
          await this.client.deleteBlock(documentId, item.block_id);
        }
      }
    }

    // 2. 追加新内容
    return this.append(documentId, markdown, options);
  }

  /**
   * 上传内容（创建块、处理图片）
   * @returns 最新的文档修订版本 ID
   */
  async uploadContent(
    documentId: string,
    blocks: DescendantBlock[],
    imageBuffers: Map<string, ImageReference>,
    options: ConvertOptions,
    initialRevisionId = 0
  ): Promise<number> {
    // 1. 处理图片
    await this.processImages(blocks, imageBuffers, options);

    // 2. 创建所有块
    // 首先需要将所有 blocks 切分成符合要求的 batch，每个 batch 需要保证：
    // - 总 blocks 数量不超过 maxDescendants
    // - 如果单个 batch 的所有子孙（blocks 和 children 的总数）超过了 maxDescendants，需要进一步拆分成更小的 batch
    //
    // 然后才能够按顺序批量上传
    const createdBlocks: FeishuBlock[] = [];
    const idMapping = new Map<string, string>();
    const blockChildren = new Set(blocks.flatMap(({ children }) => children));
    const maxDescendants = 1000; // 飞书 API 一次最多创建 1000 个块

    // 2.1. 将 blocks 按照顶层 block 切分成最小的 batch，包含一个顶层 block 和它的所有 children
    const unitBatches = blocks.reduce<UploadContentBatch[]>(
      (batches, block) => {
        if (blockChildren.has(block.block_id)) {
          batches[batches.length - 1]?.children.push(block);
        } else {
          batches.push({
            parentBlockId: documentId,
            blocks: [block],
            children: [],
          });
        }

        return batches;
      },
      []
    );

    // 2.2. 将过大的 batch 切分成更小的 batch，以符合 maxDescendants 要求
    const splitBatches = unitBatches.flatMap((batch) =>
      this.splitBatch(batch, maxDescendants)
    );

    // 2.3. 对于比较小的顶层 block，在不超过 maxDescendants 的前提下进行合并；
    const batches = splitBatches.reduce<UploadContentBatch[]>(
      (batches, batch) => {
        const cnt = batch.blocks.length + batch.children.length;
        const lastBatch = batches.length
          ? batches[batches.length - 1]
          : undefined;
        const lastBatchCnt = lastBatch
          ? lastBatch.blocks.length + lastBatch.children.length
          : 0;

        if (
          lastBatch &&
          lastBatchCnt + cnt <= maxDescendants &&
          lastBatch.parentBlockId === batch.parentBlockId
        ) {
          lastBatch.blocks.push(...batch.blocks);
          lastBatch.children.push(...batch.children);
        } else {
          batches.push(batch);
        }

        return batches;
      },
      []
    );

    // 2.4. 调用飞书接口上传内容
    let lastRevisionId = initialRevisionId;

    for (const batch of batches) {
      const { children, document_revision_id, block_id_relations } =
        await this.client.createDescendantBlocks(
          documentId,
          batch.parentBlockId, // 父块为文档根节点
          {
            children_id: batch.blocks.map(({ block_id }) => block_id),
            descendants: [...batch.blocks, ...batch.children],
          }
        );

      createdBlocks.push(...children);
      lastRevisionId = document_revision_id;

      for (const { temporary_block_id, block_id } of block_id_relations) {
        idMapping.set(temporary_block_id, block_id);
      }
    }

    // 3. 收集图片更新请求
    const updateRequests: BatchUpdateBlockRequest[] = [];

    for (const block of blocks) {
      if (block.block_type !== BlockType.Image) continue;

      const realBlockId = idMapping.get(block.block_id);
      if (!realBlockId) {
        console.warn(
          `Could not find real ID for image block ${block.block_id}`
        );
        continue;
      }

      const prepared = imageBuffers.get(block.block_id);
      if (!prepared) continue;
      const { fileName, source } = prepared;

      let fileToken: string;

      try {
        if (source.type === 'buffer') {
          fileToken = await this.client.uploadMedia(
            source.buffer,
            fileName ?? 'image.png',
            'docx_image',
            realBlockId,
            source.buffer.length
          );
        } else if (source.type === 'path') {
          fileToken = await this.client.uploadMedia(
            source.path,
            fileName ?? basename(source.path) ?? 'image.png',
            'docx_image',
            realBlockId
          );
        } else {
          continue;
        }

        updateRequests.push({
          block_id: realBlockId,
          replace_image: { token: fileToken },
        });
      } catch (error) {
        console.error(
          `Failed to upload media for block ${realBlockId}:`,
          error
        );
      }
    }

    // 4. 批量更新图片块
    if (updateRequests.length > 0) {
      await this.client.updateBlocks(documentId, updateRequests);
    }

    return lastRevisionId;
  }

  /**
   * 拆分过大的 batch
   * 如果 batch 的 block 总数不超过 max，则直接返回 `[batch]`；
   * 否则将 batch 按照深度遍历，拆分成满足 max 的若干 batch。
   *
   * 这里假定：
   * - batch 只有一个顶级的 block（即 `batch.blocks.length === 1`
   * - batch 的 children 按照深度优先序排列
   */
  private splitBatch(
    batch: UploadContentBatch,
    max: number
  ): UploadContentBatch[] {
    const cnt = batch.blocks.length + batch.children.length;

    if (cnt < max) {
      return [batch];
    }

    // 这里假定 batch 里面有且只有一个 block
    const parentBlock = batch.blocks[0];

    if (!parentBlock) {
      return [];
    }

    const parentBatch: UploadContentBatch = {
      ...batch,
      children: [],
    };
    const children = new Set(parentBlock.children);
    const childrenBatches = batch.children.reduce<UploadContentBatch[]>(
      (batches, block) => {
        if (children.has(block.block_id)) {
          batches.push({
            parentBlockId: parentBlock.block_id,
            blocks: [block],
            children: [],
          });
        } else {
          batches[batches.length - 1]?.children.push(block);
        }

        return batches;
      },
      []
    );
    return [parentBatch, ...childrenBatches].flatMap((batch) =>
      this.splitBatch(batch, max)
    );
  }

  /**
   * 仅解析 Markdown 并返回飞书块结构（不上传）
   */
  async parse(
    markdown: string,
    options: ConvertOptions = {}
  ): Promise<DescendantBlock[]> {
    const ast = parseMarkdown(markdown);
    const { blocks } = await transformMarkdownToBlocks(ast, options);
    return blocks;
  }

  /**
   * 处理图片：下载和上传
   */
  private async processImages(
    blocks: DescendantBlock[],
    imageBuffers: Map<string, ImageReference>,
    options: ConvertOptions
  ): Promise<void> {
    for (const [blockId, data] of imageBuffers) {
      const block = blocks.find((b) => b.block_id === blockId);
      if (block?.block_type !== BlockType.Image) continue;

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

        // 将 imageBuffers 中的条目置为已准备好的数据
        if (imageData.buffer) {
          imageBuffers.set(blockId, {
            source: {
              type: 'buffer',
              buffer: imageData.buffer,
              fileName: imageData.fileName,
            },
            fileName: imageData.fileName,
          });
        } else if (imageData.path) {
          imageBuffers.set(blockId, {
            source: {
              type: 'path',
              path: imageData.path,
            },
            fileName: imageData.fileName,
          });
        }
      } catch (error) {
        console.warn(`Failed to process image for block ${blockId}:`, error);
        imageBuffers.delete(blockId);
      }
    }
  }
}
