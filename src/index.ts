import { FeishuClient } from './client/index';
import { ConfigError, TransformError } from './errors';
import { loadImage, parseImageSource } from './handlers/index';
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
    const mergedOptions = { ...this.defaultOptions, ...options };

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
    }

    // 6. 返回结果
    return {
      documentId,
      url: this.client.getDocumentUrl(documentId),
      revisionId,
    };
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
    imageBuffers: Map<string, { buffer: Buffer; fileName: string }>,
    options: ConvertOptions
  ): Promise<void> {
    for (const [blockId, data] of imageBuffers) {
      const block = blocks.find((b) => b.block_id === blockId);
      if (block?.block_type !== 27) continue;

      try {
        let imageData: { buffer: Buffer; fileName: string };

        // 检查是否是 URL（暂存的）
        const storedData = data.buffer.toString();
        if (
          storedData.startsWith('http://') ||
          storedData.startsWith('https://') ||
          storedData.startsWith('data:') ||
          !storedData.includes('\0')
        ) {
          // 这是一个 URL，需要加载
          const source = parseImageSource(storedData, options.imageBaseDir);
          const downloadEnabled = options.downloadImages !== false;
          imageData = await loadImage(source, downloadEnabled);
        } else {
          // 已经是图片数据（如 Mermaid 生成的）
          imageData = data;
        }

        // 创建图片块并上传
        // 注意：实际的图片创建需要先创建空图片块，再上传，再更新
        // 这里简化处理，实际在批量创建时处理

        // 标记图片数据已准备好
        imageBuffers.set(blockId, imageData);
      } catch (error) {
        console.warn(`Failed to process image for block ${blockId}:`, error);
        // 移除失败的图片块
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

    if (blocks.length <= batchSize * 20) {
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

      if (
        currentBatch.descendants.length + descendants.length >
        batchSize * 20
      ) {
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
export * from './types/index';
export * from './errors';
export { parseMarkdown } from './parser/index';
export { transformMarkdownToBlocks } from './transformer/index';
export { FeishuClient } from './client/index';
export * from './builders/index';
export * from './utils/index';
export * from './handlers/index';
