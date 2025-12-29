import { describe, expect, it, vi } from 'vitest';

import { parseMarkdown } from '@/parser/index';
import { transformMarkdownToBlocks } from '@/transformer/index';
import { BlockType } from '@/types/feishu';

vi.mock('@/handlers/mermaid', () => {
  return {
    renderMermaid: vi.fn(async () => ({
      buffer: Buffer.from('png-data'),
      fileName: 'mermaid_test.png',
    })),
  };
});

describe('mermaid handling', () => {
  it('parses mermaid code block and generates an image block with buffer', async () => {
    const markdown = '```mermaid\ngraph TD\n  A-->B\n```';

    const ast = parseMarkdown(markdown);
    const result = await transformMarkdownToBlocks(ast, {
      mermaid: { enabled: true },
    });

    const imageBlock = result.blocks.find(
      (b) => b.block_type === BlockType.Image
    );
    expect(imageBlock).toBeDefined();

    // Ensure an image buffer was saved for upload
    expect(result.imageBuffers.size).toBeGreaterThanOrEqual(1);

    const first = result.imageBuffers.values().next().value;
    expect(first).toBeDefined();
    if (first?.source?.type === 'buffer') {
      expect(first.source.buffer).toEqual(Buffer.from('png-data'));
      expect(first.source.fileName).toBe('mermaid_test.png');
    } else {
      throw new Error('expected buffer source');
    }
  });
});
