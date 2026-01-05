import { run } from '@mermaid-js/mermaid-cli';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MermaidError } from '@/errors';
import type { MermaidOptions } from '@/types/options';

export interface MermaidFile {
  path: string;
  fileName: string;
}

/**
 * 渲染 Mermaid 代码为 PNG 图片
 */
export async function renderMermaid(
  code: string,
  options: MermaidOptions
): Promise<MermaidFile> {
  const {
    theme = 'default',
    backgroundColor = 'white',
    width,
    height,
    tempDir,
  } = options;

  if (!tempDir) {
    throw new MermaidError('Mermaid tempDir is required');
  }

  const inputFile = join(tempDir, `mermaid_${Date.now()}_input.mmd`);
  const outputBase = join(tempDir, `mermaid_${Date.now()}_output`);
  const outputFile = `${outputBase}.png` as const;

  try {
    // 写入 Mermaid 代码
    await writeFile(inputFile, code, 'utf-8');

    // 构建配置
    const parseMMDOptions = {
      backgroundColor,
      mermaidConfig: {
        theme,
        backgroundColor,
      },
      viewport:
        width || height
          ? { width: width ?? 800, height: height ?? 600 }
          : undefined,
    };

    // 执行转换
    await run(inputFile, outputFile, {
      parseMMDOptions,
      outputFormat: 'png',
      quiet: true,
    });

    const fileName = `mermaid_${Date.now()}.png`;

    // 优化：返回文件路径而不是 Buffer
    return { path: outputFile, fileName };
  } catch (error) {
    if (error instanceof MermaidError) {
      throw error;
    }
    throw new MermaidError(
      `Mermaid rendering failed: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}
