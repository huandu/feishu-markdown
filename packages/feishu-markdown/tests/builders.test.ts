import { describe, expect, it } from 'vitest';

import {
  createBulletBlock,
  createCalloutBlock,
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
} from '@/src/builders/index';
import { BlockType, CodeLanguage } from '@/src/types/feishu';

describe('Block Builders', () => {
  describe('createTextElement', () => {
    it('should create a text element with content', () => {
      const element = createTextElement('Hello, world!');
      expect(element.text_run?.content).toBe('Hello, world!');
    });

    it('should create a text element with style', () => {
      const element = createTextElement('Bold', { bold: true });
      expect(element.text_run?.content).toBe('Bold');
      expect(element.text_run?.text_element_style?.bold).toBe(true);
    });
  });

  describe('createTextBlock', () => {
    it('should create a text block with elements', () => {
      const elements = [createTextElement('Hello')];
      const block = createTextBlock(elements);
      expect(block.block_type).toBe(BlockType.Text);
      expect(block.text.elements).toHaveLength(1);
      expect(block.text.elements[0].text_run?.content).toBe('Hello');
    });

    it('should create a text block with custom block_id', () => {
      const elements = [createTextElement('Test')];
      const block = createTextBlock(elements, 'custom-id');
      expect(block.block_id).toBe('custom-id');
    });

    it('should initialize children as empty array', () => {
      const elements = [createTextElement('Test')];
      const block = createTextBlock(elements);
      expect(block.children).toEqual([]);
    });
  });

  describe('createHeadingBlock', () => {
    it('should create a heading 1 block', () => {
      const elements = [createTextElement('Title')];
      const block = createHeadingBlock(1, elements);
      expect(block.block_type).toBe(BlockType.Heading1);
      expect(block.heading1.elements).toHaveLength(1);
      expect(block.heading1.elements[0].text_run?.content).toBe('Title');
    });

    it('should create a heading 2 block', () => {
      const elements = [createTextElement('Subtitle')];
      const block = createHeadingBlock(2, elements);
      expect(block.block_type).toBe(BlockType.Heading2);
      expect(block.heading2.elements).toHaveLength(1);
    });

    it('should create a heading 3 block', () => {
      const elements = [createTextElement('Section')];
      const block = createHeadingBlock(3, elements);
      expect(block.block_type).toBe(BlockType.Heading3);
      expect(block.heading3.elements).toHaveLength(1);
    });
  });

  describe('createBulletBlock', () => {
    it('should create a bullet block', () => {
      const elements = [createTextElement('Item')];
      const block = createBulletBlock(elements);
      expect(block.block_type).toBe(BlockType.Bullet);
      expect(block.bullet.elements).toHaveLength(1);
      expect(block.bullet.elements[0].text_run?.content).toBe('Item');
    });

    it('should initialize children as empty array', () => {
      const elements = [createTextElement('Parent')];
      const block = createBulletBlock(elements);
      expect(block.children).toEqual([]);
    });
  });

  describe('createOrderedBlock', () => {
    it('should create an ordered block', () => {
      const elements = [createTextElement('First')];
      const block = createOrderedBlock(elements);
      expect(block.block_type).toBe(BlockType.Ordered);
      expect(block.ordered.elements).toHaveLength(1);
    });
  });

  describe('createCodeBlock', () => {
    it('should create a code block with language', () => {
      const block = createCodeBlock('const x = 1;', CodeLanguage.JavaScript);
      expect(block.block_type).toBe(BlockType.Code);
      expect(block.code.elements).toHaveLength(1);
      expect(block.code.elements[0].text_run?.content).toBe('const x = 1;');
      expect(block.code.style?.language).toBe(CodeLanguage.JavaScript);
    });

    it('should have language in style', () => {
      const block = createCodeBlock('text', CodeLanguage.PlainText);
      expect(block.code.style?.language).toBe(CodeLanguage.PlainText);
    });
  });

  describe('createQuoteContainerBlock', () => {
    it('should create a quote container block', () => {
      const block = createQuoteContainerBlock();
      expect(block.block_type).toBe(BlockType.QuoteContainer);
      expect(block.children).toEqual([]);
    });
  });

  describe('createDividerBlock', () => {
    it('should create a divider block', () => {
      const block = createDividerBlock();
      expect(block.block_type).toBe(BlockType.Divider);
      expect(block.divider).toEqual({});
    });
  });

  describe('createImageBlock', () => {
    it('should create an image block with file token', () => {
      const block = createImageBlock('file_token_123');
      expect(block.block_type).toBe(BlockType.Image);
      expect(block.image.token).toBe('file_token_123');
    });

    it('should include width and height if provided', () => {
      const block = createImageBlock('token', 800, 600);
      expect(block.image.width).toBe(800);
      expect(block.image.height).toBe(600);
    });
  });

  describe('createTableBlock', () => {
    it('should create a table block', () => {
      const block = createTableBlock(3, 2, [
        'cell1',
        'cell2',
        'cell3',
        'cell4',
        'cell5',
        'cell6',
      ]);
      expect(block.block_type).toBe(BlockType.Table);
      expect(block.table.property.row_size).toBe(3);
      expect(block.table.property.column_size).toBe(2);
    });

    it('should have cell IDs in children', () => {
      const block = createTableBlock(2, 2, ['c1', 'c2', 'c3', 'c4']);
      expect(block.children).toEqual(['c1', 'c2', 'c3', 'c4']);
    });
  });

  describe('createTableCellBlock', () => {
    it('should create a table cell block', () => {
      const block = createTableCellBlock();
      expect(block.block_type).toBe(BlockType.TableCell);
      expect(block.children).toEqual([]);
    });
  });

  describe('createTodoBlock', () => {
    it('should create an unchecked todo block', () => {
      const elements = [createTextElement('Task')];
      const block = createTodoBlock(elements, false);
      expect(block.block_type).toBe(BlockType.Todo);
      expect(block.todo.style?.done).toBe(false);
    });

    it('should create a checked todo block', () => {
      const elements = [createTextElement('Done task')];
      const block = createTodoBlock(elements, true);
      expect(block.todo.style?.done).toBe(true);
    });
  });

  describe('createCalloutBlock', () => {
    it('should create a callout block with options', () => {
      const block = createCalloutBlock('block-id', {
        emojiId: '💡',
        backgroundColor: 7,
      });
      expect(block.block_type).toBe(BlockType.Callout);
      expect(block.callout.emoji_id).toBe('💡');
      expect(block.callout.background_color).toBe(7);
    });

    it('should create callout with default values', () => {
      const block = createCalloutBlock();
      expect(block.block_type).toBe(BlockType.Callout);
      expect(block.children).toEqual([]);
    });
  });
});
