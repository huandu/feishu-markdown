import type {
  Blockquote,
  Code,
  Heading,
  Html,
  Image,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  RootContentMap,
  Table,
} from 'mdast';

import {
  createBulletBlock,
  createCodeBlock,
  createDividerBlock,
  createHeadingBlock,
  createImageBlock,
  createOrderedBlock,
  createQuoteContainerBlock,
  createTableBlock,
  createTableCellBlock,
  createTextBlock,
  createTextElement,
  createTodoBlock,
} from '@/builders/index';
import { parseImageSource } from '@/handlers/index';
import type { ImageReference } from '@/handlers/index';
import { renderMermaid } from '@/handlers/mermaid';
import type {
  DescendantBlock,
  FeishuBlock,
  TextElement,
  TextElementStyle,
} from '@/types/feishu';
import type { ConvertOptions, MermaidOptions } from '@/types/options';
import {
  generateBlockId,
  isMermaidLanguage,
  mapCodeLanguage,
} from '@/utils/index';

/**
 * 转换上下文
 */
interface TransformContext {
  options: ConvertOptions;
  blocks: DescendantBlock[];
  imageBuffers: Map<string, ImageReference>;
}

export interface TransformResult {
  blocks: DescendantBlock[];
  imageBuffers: Map<string, ImageReference>;
}

/**
 * 文本样式上下文（用于处理嵌套样式）
 */
interface StyleContext {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  inlineCode?: boolean;
  link?: string;
}

/**
 * 将 Markdown AST 转换为飞书块结构
 */
export async function transformMarkdownToBlocks(
  ast: Root,
  options: ConvertOptions = {}
): Promise<TransformResult> {
  const context: TransformContext = {
    options,
    blocks: [],
    imageBuffers: new Map(),
  };

  for (const node of ast.children) {
    await visitNode(node, context, null);
  }

  return {
    blocks: context.blocks,
    imageBuffers: context.imageBuffers,
  };
}

/**
 * 访问并处理单个节点
 */
async function visitNode(
  node: RootContent,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  const handler = nodeHandlers[node.type] as
    | NodeHandler<RootContent>
    | undefined;
  if (handler) {
    await handler(node, context, parentBlockId);
  } else {
    // 未知节点类型，尝试提取文本内容
    console.warn(`Unknown node type: ${node.type}`);
  }
}

/**
 * 添加块到上下文
 */
function addBlock(
  block: FeishuBlock,
  context: TransformContext,
  parentBlockId: string | null
): void {
  const descendantBlock: DescendantBlock = {
    ...block,
    block_id: block.block_id ?? generateBlockId(),
    children: block.children ?? [],
  };

  context.blocks.push(descendantBlock);

  if (parentBlockId !== null) {
    // 找到父块并添加子块 ID
    const parentBlock = context.blocks.find(
      (b) => b.block_id === parentBlockId
    );
    if (parentBlock) {
      parentBlock.children.push(descendantBlock.block_id);
    }
  }
}

/**
 * 节点处理器类型
 */
type NodeHandler<T extends RootContent> = (
  node: T,
  context: TransformContext,
  parentBlockId: string | null
) => Promise<void>;

type NodeHandlers = {
  [K in keyof RootContentMap]?: NodeHandler<RootContentMap[K]>;
};

/**
 * 节点处理器映射
 */
const nodeHandlers: NodeHandlers = {
  paragraph: handleParagraph,
  heading: handleHeading,
  list: handleList,
  listItem: handleListItem,
  code: handleCode,
  blockquote: handleBlockquote,
  thematicBreak: handleThematicBreak,
  table: handleTable,
  image: handleImage,
  html: handleHtml,
};

/**
 * 处理段落
 */
async function handleParagraph(
  paragraphNode: Paragraph,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  // 检查段落中是否只包含一个图片
  if (
    paragraphNode.children.length === 1 &&
    paragraphNode.children[0]?.type === 'image'
  ) {
    await handleImage(paragraphNode.children[0], context, parentBlockId);
    return;
  }

  const elements = extractTextElements(paragraphNode.children);
  if (elements.length === 0) {
    return;
  }

  const block = createTextBlock(elements);
  addBlock(block, context, parentBlockId);
}

/**
 * 处理标题
 */
async function handleHeading(
  headingNode: Heading,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  const elements = extractTextElements(headingNode.children);

  // 限制标题级别在 1-9 之间
  const level = Math.min(Math.max(headingNode.depth, 1), 9) as
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9;

  const block = createHeadingBlock(level, elements);
  addBlock(block, context, parentBlockId);
}

/**
 * 处理列表
 */
async function handleList(
  listNode: List,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  for (const item of listNode.children) {
    await handleListItem(
      item,
      context,
      parentBlockId,
      listNode.ordered ?? false
    );
  }
}

/**
 * 处理列表项
 */
async function handleListItem(
  itemNode: ListItem,
  context: TransformContext,
  parentBlockId: string | null,
  ordered = false
): Promise<void> {
  // 检查是否是任务列表项
  if (itemNode.checked !== null && itemNode.checked !== undefined) {
    await handleTaskListItem(itemNode, context, parentBlockId);
    return;
  }

  // 提取第一个段落的内容作为列表项文本
  let elements: TextElement[] = [];
  const childrenToProcess: RootContent[] = [];

  for (const child of itemNode.children) {
    if (child.type === 'paragraph' && elements.length === 0) {
      elements = extractTextElements(child.children);
    } else if (child.type === 'list') {
      // 嵌套列表，稍后处理
      childrenToProcess.push(child);
    } else if (child.type === 'paragraph') {
      // 额外的段落，作为子块处理
      childrenToProcess.push(child);
    }
  }

  if (elements.length === 0) {
    elements = [createTextElement('')];
  }

  const block = ordered
    ? createOrderedBlock(elements)
    : createBulletBlock(elements);
  addBlock(block, context, parentBlockId);

  // 处理嵌套内容
  for (const child of childrenToProcess) {
    await visitNode(child, context, block.block_id ?? null);
  }
}

/**
 * 处理任务列表项
 */
async function handleTaskListItem(
  node: ListItem,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  let elements: TextElement[] = [];

  // 提取第一个段落的内容
  for (const child of node.children) {
    if (child.type === 'paragraph') {
      elements = extractTextElements(child.children);
      break;
    }
  }

  if (elements.length === 0) {
    elements = [createTextElement('')];
  }

  const block = createTodoBlock(elements, node.checked ?? false);
  addBlock(block, context, parentBlockId);
}

/**
 * 处理代码块
 */
async function handleCode(
  codeNode: Code,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  const lang = codeNode.lang;

  // 检查是否是 Mermaid 代码块
  if (isMermaidLanguage(lang) && context.options.mermaid?.enabled !== false) {
    await handleMermaidCode(codeNode, context, parentBlockId);
    return;
  }

  const language = mapCodeLanguage(lang);
  const block = createCodeBlock(codeNode.value, language);
  addBlock(block, context, parentBlockId);
}

/**
 * 处理 Mermaid 代码块
 */
async function handleMermaidCode(
  node: Code,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  const mermaidOptions: MermaidOptions = {
    theme: 'default',
    backgroundColor: 'white',
    ...context.options.mermaid,
    tempDir: context.options.mermaidTempDir,
  };

  try {
    const { path, fileName } = await renderMermaid(node.value, mermaidOptions);

    const blockId = generateBlockId();
    const block = createImageBlock(undefined, undefined, undefined, blockId);
    addBlock(block, context, parentBlockId);

    // 保存图片路径供后续上传 — 存为 path 源
    context.imageBuffers.set(blockId, {
      source: { type: 'path', path },
      fileName,
    });
  } catch (error) {
    // 如果 Mermaid 渲染失败，回退到普通代码块
    console.warn(
      'Mermaid rendering failed, falling back to code block:',
      error
    );
    const language = mapCodeLanguage('mermaid');
    const block = createCodeBlock(node.value, language);
    addBlock(block, context, parentBlockId);
  }
}

/**
 * 处理引用块
 */
async function handleBlockquote(
  quoteNode: Blockquote,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  // 创建引用容器
  const containerBlock = createQuoteContainerBlock();
  addBlock(containerBlock, context, parentBlockId);

  // 处理引用内容
  for (const child of quoteNode.children) {
    await visitNode(child, context, containerBlock.block_id ?? null);
  }
}

/**
 * 处理分隔线
 */
async function handleThematicBreak(
  _node: RootContent,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  const block = createDividerBlock();
  addBlock(block, context, parentBlockId);
}

/**
 * 处理表格
 */
async function handleTable(
  tableNode: Table,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  const rows = tableNode.children;

  if (rows.length === 0) {
    return;
  }

  const columnSize = rows[0]?.children.length ?? 0;

  if (columnSize === 0) {
    return;
  }

  // 计算每列的最大内容长度
  const colMaxLengths = new Array<number>(columnSize).fill(0);
  for (const row of rows) {
    row.children.forEach((cell, colIndex) => {
      if (colIndex < columnSize) {
        const elements = extractTextElements(cell.children);
        const len = elements.reduce(
          (acc, el) => acc + (el.text_run?.content.length ?? 0),
          0
        );
        colMaxLengths[colIndex] = Math.max(len, colMaxLengths[colIndex] ?? 0);
      }
    });
  }

  const flexibleColumnDefaultWidth = 130;
  let flexibleColumnCount = 0;
  let columnWidths: number[] = colMaxLengths.map((count) => {
    if (count <= 2) return 50;
    if (count <= 4) return 80;
    if (count === 5) return 100;
    if (count === 6) return 120;

    flexibleColumnCount++;
    return flexibleColumnDefaultWidth; // >= 6
  });

  if (flexibleColumnCount) {
    const maxTableWidth = 820;
    const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
    if (totalWidth < maxTableWidth) {
      const delta = Math.floor(
        (maxTableWidth - totalWidth) / flexibleColumnCount
      );
      columnWidths = columnWidths.map((w) =>
        w === flexibleColumnDefaultWidth ? w + delta : w
      );
    }
  }

  // 为每个单元格创建块
  const cellBlockIds: string[] = [];
  const cellBlocks: DescendantBlock[] = [];
  const cellContentBlocks: DescendantBlock[] = [];

  for (const row of rows) {
    const tableRow = row;
    for (const cell of tableRow.children) {
      const tableCell = cell;
      const cellBlockId = generateBlockId();
      cellBlockIds.push(cellBlockId);

      // 创建单元格块
      const cellBlock = createTableCellBlock(cellBlockId);

      // 提取单元格内容
      const elements = extractTextElements(tableCell.children);
      const contentBlockId = generateBlockId();
      const contentBlock: DescendantBlock = {
        ...createTextBlock(elements, contentBlockId),
        block_id: contentBlockId,
        children: [],
      };

      cellBlocks.push({
        ...cellBlock,
        block_id: cellBlockId,
        children: [contentBlockId],
      });
      cellContentBlocks.push(contentBlock);
    }
  }

  // 创建表格块
  const tableBlockId = generateBlockId();
  const tableBlock = createTableBlock(
    rows.length,
    columnSize,
    cellBlockIds,
    tableBlockId,
    columnWidths
  );

  // 添加表格块
  addBlock(tableBlock, context, parentBlockId);

  // 添加单元格块和内容块
  for (const cellBlock of cellBlocks) {
    context.blocks.push(cellBlock);
  }

  for (const contentBlock of cellContentBlocks) {
    context.blocks.push(contentBlock);
  }
}

/**
 * 处理图片
 */
async function handleImage(
  imageNode: Image,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  const blockId = generateBlockId();
  const block = createImageBlock(undefined, undefined, undefined, blockId);
  addBlock(block, context, parentBlockId);

  // 保存图片 URL 供后续处理
  // 实际的图片下载和上传在主转换流程中处理
  const imageUrl = imageNode.url;
  const fileName = imageNode.alt ?? imageUrl.split('/').pop() ?? 'image.png';

  // 这里先标记图片来源（URL 或本地路径），实际加载在后续步骤中进行
  const source = parseImageSource(imageUrl, context.options.imageBaseDir);
  context.imageBuffers.set(blockId, {
    source,
    fileName,
  });
}

/**
 * 处理 HTML 块
 */
async function handleHtml(
  htmlNode: Html,
  context: TransformContext,
  parentBlockId: string | null
): Promise<void> {
  // 将 HTML 作为纯文本处理
  const elements = [createTextElement(htmlNode.value)];
  const block = createTextBlock(elements);
  addBlock(block, context, parentBlockId);
}

/**
 * 从 phrasing content 中提取文本元素
 */
function extractTextElements(
  nodes: PhrasingContent[],
  styleContext: StyleContext = {}
): TextElement[] {
  const elements: TextElement[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'text': {
        const textNode = node;
        const style = buildTextStyle(styleContext);
        elements.push(createTextElement(textNode.value, style));
        break;
      }
      case 'strong': {
        const strongNode = node;
        const childElements = extractTextElements(strongNode.children, {
          ...styleContext,
          bold: true,
        });
        elements.push(...childElements);
        break;
      }
      case 'emphasis': {
        const emNode = node;
        const childElements = extractTextElements(emNode.children, {
          ...styleContext,
          italic: true,
        });
        elements.push(...childElements);
        break;
      }
      case 'delete': {
        const deleteNode = node;
        const childElements = extractTextElements(deleteNode.children, {
          ...styleContext,
          strikethrough: true,
        });
        elements.push(...childElements);
        break;
      }
      case 'inlineCode': {
        const codeNode = node;
        const style = buildTextStyle({ ...styleContext, inlineCode: true });
        elements.push(createTextElement(codeNode.value, style));
        break;
      }
      case 'link': {
        const linkNode = node;
        const childElements = extractTextElements(linkNode.children, {
          ...styleContext,
          link: linkNode.url,
        });
        elements.push(...childElements);
        break;
      }
      case 'image': {
        // 内联图片作为文本占位符
        const imageNode = node;
        const alt = imageNode.alt ?? '[image]';
        elements.push(createTextElement(alt, buildTextStyle(styleContext)));
        break;
      }
      case 'break': {
        elements.push(createTextElement('\n', buildTextStyle(styleContext)));
        break;
      }
      default: {
        // 尝试递归处理未知节点
        if ('children' in node && Array.isArray(node.children)) {
          const childElements = extractTextElements(
            node.children,
            styleContext
          );
          elements.push(...childElements);
        }
      }
    }
  }

  return elements;
}

/**
 * 构建文本样式
 */
function buildTextStyle(context: StyleContext): TextElementStyle | undefined {
  const style: TextElementStyle = {};
  let hasStyle = false;

  if (context.bold) {
    style.bold = true;
    hasStyle = true;
  }
  if (context.italic) {
    style.italic = true;
    hasStyle = true;
  }
  if (context.strikethrough) {
    style.strikethrough = true;
    hasStyle = true;
  }
  if (context.underline) {
    style.underline = true;
    hasStyle = true;
  }
  if (context.inlineCode) {
    style.inline_code = true;
    hasStyle = true;
  }
  if (context.link) {
    style.link = { url: encodeURI(context.link) };
    hasStyle = true;
  }

  return hasStyle ? style : undefined;
}
