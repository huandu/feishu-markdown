import type {
  CodeLanguage,
  FeishuBlock,
  TableBlockData,
  TextBlockData,
  TextElement,
  TextElementStyle,
} from '@/types/feishu';
import { Align, BlockType } from '@/types/feishu';
import { generateBlockId } from '@/utils/id';

/**
 * 创建文本元素
 */
export function createTextElement(
  content: string,
  style?: TextElementStyle
): TextElement {
  return {
    text_run: {
      content,
      text_element_style: style,
    },
  };
}

/**
 * 创建文本块数据
 */
export function createTextBlockData(
  elements: TextElement[],
  style?: TextBlockData['style']
): TextBlockData {
  return {
    elements,
    style,
  };
}

/**
 * 创建文本块
 */
export function createTextBlock(
  elements: TextElement[],
  blockId?: string
): FeishuBlock {
  // Ensure elements is not empty, otherwise Feishu API will return invalid param
  const finalElements =
    elements.length > 0 ? elements : [createTextElement('')];

  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.Text,
    text: createTextBlockData(finalElements),
    children: [],
  };
}

/**
 * 创建标题块
 */
export function createHeadingBlock(
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  elements: TextElement[],
  blockId?: string
): FeishuBlock {
  const blockTypeMap: Record<number, BlockType> = {
    1: BlockType.Heading1,
    2: BlockType.Heading2,
    3: BlockType.Heading3,
    4: BlockType.Heading4,
    5: BlockType.Heading5,
    6: BlockType.Heading6,
    7: BlockType.Heading7,
    8: BlockType.Heading8,
    9: BlockType.Heading9,
  };

  const blockType = blockTypeMap[level] ?? BlockType.Heading6;
  const headingKey = `heading${level}` as keyof FeishuBlock;

  return {
    block_id: blockId ?? generateBlockId(),
    block_type: blockType,
    [headingKey]: createTextBlockData(elements),
    children: [],
  };
}

/**
 * 创建无序列表块
 */
export function createBulletBlock(
  elements: TextElement[],
  blockId?: string
): FeishuBlock {
  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.Bullet,
    bullet: createTextBlockData(elements),
    children: [],
  };
}

/**
 * 创建有序列表块
 */
export function createOrderedBlock(
  elements: TextElement[],
  blockId?: string
): FeishuBlock {
  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.Ordered,
    ordered: createTextBlockData(elements),
    children: [],
  };
}

/**
 * 创建代码块
 */
export function createCodeBlock(
  code: string,
  language: CodeLanguage,
  blockId?: string
): FeishuBlock {
  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.Code,
    code: {
      elements: [createTextElement(code)],
      style: {
        language,
        wrap: false,
      },
    },
    children: [],
  };
}

/**
 * 创建引用容器块
 */
export function createQuoteContainerBlock(blockId?: string): FeishuBlock {
  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.QuoteContainer,
    quote_container: {},
    children: [],
  };
}

/**
 * 创建引用块（用于旧版引用样式）
 */
export function createQuoteBlock(
  elements: TextElement[],
  blockId?: string
): FeishuBlock {
  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.Quote,
    quote: createTextBlockData(elements),
    children: [],
  };
}

/**
 * 创建分隔线块
 */
export function createDividerBlock(blockId?: string): FeishuBlock {
  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.Divider,
    divider: {},
    children: [],
  };
}

/**
 * 创建图片块
 */
export function createImageBlock(
  token?: string,
  width?: number,
  height?: number,
  blockId?: string
): FeishuBlock {
  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.Image,
    image: {
      token,
      width,
      height,
      align: Align.Center,
    },
    children: [],
  };
}

/**
 * 创建表格块
 */
export function createTableBlock(
  rowSize: number,
  columnSize: number,
  cellBlockIds: string[],
  blockId?: string,
  columnWidths?: number[]
): FeishuBlock {
  const tableData: TableBlockData = {
    property: {
      row_size: rowSize,
      column_size: columnSize,
      column_width: columnWidths,
    },
  };

  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.Table,
    table: tableData,
    children: cellBlockIds,
  };
}

/**
 * 创建表格单元格块
 */
export function createTableCellBlock(blockId?: string): FeishuBlock {
  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.TableCell,
    table_cell: {},
    children: [],
  };
}

/**
 * 创建任务/待办块
 */
export function createTodoBlock(
  elements: TextElement[],
  done = false,
  blockId?: string
): FeishuBlock {
  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.Todo,
    todo: {
      elements,
      style: {
        done,
      },
    },
    children: [],
  };
}

/**
 * 创建高亮块（Callout）
 */
export function createCalloutBlock(
  blockId?: string,
  options?: {
    backgroundColor?: number;
    borderColor?: number;
    emojiId?: string;
  }
): FeishuBlock {
  return {
    block_id: blockId ?? generateBlockId(),
    block_type: BlockType.Callout,
    callout: {
      background_color: options?.backgroundColor,
      border_color: options?.borderColor,
      emoji_id: options?.emojiId,
    },
    children: [],
  };
}
