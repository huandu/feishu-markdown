import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

import { ParseError } from '@/errors';

/**
 * 解析 Markdown 文本为 AST
 */
export function parseMarkdown(markdown: string): Root {
  try {
    return fromMarkdown(markdown, {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()],
    });
  } catch (error) {
    throw new ParseError(
      'Failed to parse markdown',
      error instanceof Error ? error : undefined
    );
  }
}
