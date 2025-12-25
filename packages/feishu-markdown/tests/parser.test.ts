import { describe, expect, it } from 'vitest';

import { parseMarkdown } from '@/src/parser/index';

describe('parseMarkdown', () => {
  it('should parse basic paragraph', () => {
    const result = parseMarkdown('Hello, world!');
    expect(result.type).toBe('root');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].type).toBe('paragraph');
  });

  it('should parse headings', () => {
    const result = parseMarkdown('# H1\n## H2\n### H3');
    expect(result.children).toHaveLength(3);
    expect(result.children[0].type).toBe('heading');
    expect((result.children[0] as { depth: number }).depth).toBe(1);
    expect(result.children[1].type).toBe('heading');
    expect((result.children[1] as { depth: number }).depth).toBe(2);
    expect(result.children[2].type).toBe('heading');
    expect((result.children[2] as { depth: number }).depth).toBe(3);
  });

  it('should parse unordered list', () => {
    const result = parseMarkdown('- Item 1\n- Item 2\n- Item 3');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].type).toBe('list');
    const list = result.children[0] as {
      ordered: boolean;
      children: unknown[];
    };
    expect(list.ordered).toBe(false);
    expect(list.children).toHaveLength(3);
  });

  it('should parse ordered list', () => {
    const result = parseMarkdown('1. First\n2. Second\n3. Third');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].type).toBe('list');
    const list = result.children[0] as {
      ordered: boolean;
      children: unknown[];
    };
    expect(list.ordered).toBe(true);
    expect(list.children).toHaveLength(3);
  });

  it('should parse code block', () => {
    const result = parseMarkdown('```javascript\nconst x = 1;\n```');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].type).toBe('code');
    const code = result.children[0] as { lang: string; value: string };
    expect(code.lang).toBe('javascript');
    expect(code.value).toBe('const x = 1;');
  });

  it('should parse blockquote', () => {
    const result = parseMarkdown('> This is a quote');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].type).toBe('blockquote');
  });

  it('should parse thematic break', () => {
    const result = parseMarkdown('---');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].type).toBe('thematicBreak');
  });

  it('should parse GFM table', () => {
    const markdown = `| Name | Age |
| --- | --- |
| Alice | 20 |
| Bob | 25 |`;
    const result = parseMarkdown(markdown);
    expect(result.children).toHaveLength(1);
    expect(result.children[0].type).toBe('table');
    const table = result.children[0] as { children: unknown[] };
    expect(table.children).toHaveLength(3); // header + 2 rows
  });

  it('should parse inline formatting', () => {
    const result = parseMarkdown('**bold** and *italic* and `code`');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].type).toBe('paragraph');
    const paragraph = result.children[0] as { children: unknown[] };
    expect(paragraph.children.length).toBeGreaterThan(1);
  });

  it('should parse links', () => {
    const result = parseMarkdown('[Link](https://example.com)');
    expect(result.children).toHaveLength(1);
    const paragraph = result.children[0] as {
      children: { type: string; url?: string }[];
    };
    const link = paragraph.children.find((c) => c.type === 'link');
    expect(link).toBeDefined();
    expect(link?.url).toBe('https://example.com');
  });

  it('should parse images', () => {
    const result = parseMarkdown('![Alt text](https://example.com/image.png)');
    expect(result.children).toHaveLength(1);
    const paragraph = result.children[0] as {
      children: { type: string; url?: string }[];
    };
    const image = paragraph.children.find((c) => c.type === 'image');
    expect(image).toBeDefined();
    expect(image?.url).toBe('https://example.com/image.png');
  });

  it('should handle empty input', () => {
    const result = parseMarkdown('');
    expect(result.type).toBe('root');
    expect(result.children).toHaveLength(0);
  });

  it('should parse strikethrough (GFM)', () => {
    const result = parseMarkdown('~~deleted~~');
    expect(result.children).toHaveLength(1);
    const paragraph = result.children[0] as { children: { type: string }[] };
    const deleteNode = paragraph.children.find((c) => c.type === 'delete');
    expect(deleteNode).toBeDefined();
  });

  it('should parse task list (GFM)', () => {
    const result = parseMarkdown('- [x] Done\n- [ ] Todo');
    expect(result.children).toHaveLength(1);
    const list = result.children[0] as {
      children: { checked: boolean | null }[];
    };
    expect(list.children[0].checked).toBe(true);
    expect(list.children[1].checked).toBe(false);
  });
});
