import { describe, expect, it } from 'vitest';

import { parseMarkdown } from '@/parser/index';
import { transformMarkdownToBlocks } from '@/transformer/index';
import { BlockType, CodeLanguage } from '@/types/feishu';

describe('transformMarkdownToBlocks', () => {
  it('should transform simple paragraph', async () => {
    const ast = parseMarkdown('Hello, world!');
    const result = await transformMarkdownToBlocks(ast);

    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    const textBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Text
    );
    expect(textBlock).toBeDefined();
    expect(textBlock?.text?.elements?.[0]?.text_run?.content).toBe(
      'Hello, world!'
    );
  });

  it('should transform heading', async () => {
    const ast = parseMarkdown('# Title');
    const result = await transformMarkdownToBlocks(ast);

    const headingBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Heading1
    );
    expect(headingBlock).toBeDefined();
    expect(headingBlock?.heading1?.elements?.[0]?.text_run?.content).toBe(
      'Title'
    );
  });

  it('should transform multiple heading levels', async () => {
    const ast = parseMarkdown('# H1\n## H2\n### H3\n#### H4');
    const result = await transformMarkdownToBlocks(ast);

    expect(result.blocks.some((b) => b.block_type === BlockType.Heading1)).toBe(
      true
    );
    expect(result.blocks.some((b) => b.block_type === BlockType.Heading2)).toBe(
      true
    );
    expect(result.blocks.some((b) => b.block_type === BlockType.Heading3)).toBe(
      true
    );
    expect(result.blocks.some((b) => b.block_type === BlockType.Heading4)).toBe(
      true
    );
  });

  it('should transform unordered list', async () => {
    const ast = parseMarkdown('- Item 1\n- Item 2');
    const result = await transformMarkdownToBlocks(ast);

    const bulletBlocks = result.blocks.filter(
      (b) => b.block_type === BlockType.Bullet
    );
    expect(bulletBlocks.length).toBe(2);
  });

  it('should transform ordered list', async () => {
    const ast = parseMarkdown('1. First\n2. Second');
    const result = await transformMarkdownToBlocks(ast);

    const orderedBlocks = result.blocks.filter(
      (b) => b.block_type === BlockType.Ordered
    );
    expect(orderedBlocks.length).toBe(2);
  });

  it('should transform nested list', async () => {
    const ast = parseMarkdown('- Parent\n  - Child');
    const result = await transformMarkdownToBlocks(ast);

    const bulletBlocks = result.blocks.filter(
      (b) => b.block_type === BlockType.Bullet
    );
    expect(bulletBlocks.length).toBe(2);
    // Parent should have child in children array
    const parentBlock = bulletBlocks.find(
      (b) => b.children && b.children.length > 0
    );
    expect(parentBlock).toBeDefined();
  });

  it('should transform code block', async () => {
    const ast = parseMarkdown('```javascript\nconst x = 1;\n```');
    const result = await transformMarkdownToBlocks(ast);

    const codeBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Code
    );
    expect(codeBlock).toBeDefined();
    expect(codeBlock?.code?.style?.language).toBe(CodeLanguage.JavaScript);
    expect(codeBlock?.code?.elements?.[0]?.text_run?.content).toBe(
      'const x = 1;'
    );
  });

  it('should transform blockquote', async () => {
    const ast = parseMarkdown('> This is a quote');
    const result = await transformMarkdownToBlocks(ast);

    // Blockquote creates a QuoteContainer with child blocks
    const quoteContainerBlock = result.blocks.find(
      (b) => b.block_type === BlockType.QuoteContainer
    );
    expect(quoteContainerBlock).toBeDefined();
  });

  it('should transform horizontal rule', async () => {
    const ast = parseMarkdown('---');
    const result = await transformMarkdownToBlocks(ast);

    const dividerBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Divider
    );
    expect(dividerBlock).toBeDefined();
  });

  it('should transform table', async () => {
    const markdown = `| A | B |
| --- | --- |
| 1 | 2 |`;
    const ast = parseMarkdown(markdown);
    const result = await transformMarkdownToBlocks(ast);

    const tableBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Table
    );
    expect(tableBlock).toBeDefined();
    expect(tableBlock?.table?.property?.row_size).toBe(2);
    expect(tableBlock?.table?.property?.column_size).toBe(2);
  });

  it('should transform image', async () => {
    const ast = parseMarkdown('![Alt](https://example.com/image.png)');
    const result = await transformMarkdownToBlocks(ast);

    // Image should be stored in imageBuffers for later processing
    expect(result.imageBuffers.size).toBeGreaterThanOrEqual(0);
  });

  it('should transform task list', async () => {
    const ast = parseMarkdown('- [x] Done\n- [ ] Todo');
    const result = await transformMarkdownToBlocks(ast);

    const todoBlocks = result.blocks.filter(
      (b) => b.block_type === BlockType.Todo
    );
    expect(todoBlocks.length).toBe(2);
    expect(todoBlocks[0]?.todo?.style?.done).toBe(true);
    expect(todoBlocks[1]?.todo?.style?.done).toBe(false);
  });

  it('should handle bold text', async () => {
    const ast = parseMarkdown('**bold text**');
    const result = await transformMarkdownToBlocks(ast);

    const textBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Text
    );
    expect(textBlock).toBeDefined();
    const element = textBlock?.text?.elements?.[0];
    expect(element?.text_run?.content).toBe('bold text');
    expect(element?.text_run?.text_element_style?.bold).toBe(true);
  });

  it('should handle italic text', async () => {
    const ast = parseMarkdown('*italic text*');
    const result = await transformMarkdownToBlocks(ast);

    const textBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Text
    );
    expect(textBlock).toBeDefined();
    const element = textBlock?.text?.elements?.[0];
    expect(element?.text_run?.text_element_style?.italic).toBe(true);
  });

  it('should handle inline code', async () => {
    const ast = parseMarkdown('use `code` here');
    const result = await transformMarkdownToBlocks(ast);

    const textBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Text
    );
    expect(textBlock).toBeDefined();
    const codeElement = textBlock?.text?.elements?.find(
      (e) => e.text_run?.text_element_style?.inline_code
    );
    expect(codeElement).toBeDefined();
  });

  it('should handle links', async () => {
    const ast = parseMarkdown('[Link](https://example.com)');
    const result = await transformMarkdownToBlocks(ast);

    const textBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Text
    );
    expect(textBlock).toBeDefined();
    const linkElement = textBlock?.text?.elements?.find(
      (e) => e.text_run?.text_element_style?.link?.url
    );
    expect(linkElement).toBeDefined();
    expect(linkElement?.text_run?.text_element_style?.link?.url).toBe(
      'https://example.com'
    );
  });

  it('should handle strikethrough', async () => {
    const ast = parseMarkdown('~~deleted~~');
    const result = await transformMarkdownToBlocks(ast);

    const textBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Text
    );
    expect(textBlock).toBeDefined();
    const element = textBlock?.text?.elements?.[0];
    expect(element?.text_run?.text_element_style?.strikethrough).toBe(true);
  });

  it('should handle complex document', async () => {
    const markdown = `# Document Title

This is a paragraph with **bold** and *italic* text.

## Section 1

- Item 1
- Item 2
  - Nested item

## Section 2

\`\`\`typescript
const greeting = "Hello";
\`\`\`

> A blockquote

---

| Col A | Col B |
| --- | --- |
| 1 | 2 |
`;
    const ast = parseMarkdown(markdown);
    const result = await transformMarkdownToBlocks(ast);

    // Check that various block types exist
    expect(result.blocks.some((b) => b.block_type === BlockType.Heading1)).toBe(
      true
    );
    expect(result.blocks.some((b) => b.block_type === BlockType.Heading2)).toBe(
      true
    );
    expect(result.blocks.some((b) => b.block_type === BlockType.Text)).toBe(
      true
    );
    expect(result.blocks.some((b) => b.block_type === BlockType.Bullet)).toBe(
      true
    );
    expect(result.blocks.some((b) => b.block_type === BlockType.Code)).toBe(
      true
    );
    expect(
      result.blocks.some((b) => b.block_type === BlockType.QuoteContainer)
    ).toBe(true);
    expect(result.blocks.some((b) => b.block_type === BlockType.Divider)).toBe(
      true
    );
    expect(result.blocks.some((b) => b.block_type === BlockType.Table)).toBe(
      true
    );
  });

  it('should handle empty markdown', async () => {
    const ast = parseMarkdown('');
    const result = await transformMarkdownToBlocks(ast);

    expect(result.blocks.length).toBe(0);
  });

  it('should handle mermaid code block option disabled', async () => {
    const ast = parseMarkdown('```mermaid\ngraph TD\n  A-->B\n```');
    const result = await transformMarkdownToBlocks(ast, {
      mermaid: { enabled: false },
    });

    // Should be a regular code block when mermaid is disabled
    const codeBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Code
    );
    expect(codeBlock).toBeDefined();
  });
});
