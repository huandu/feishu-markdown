import { run } from '@mermaid-js/mermaid-cli';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MermaidError } from '@/errors';
import type { MermaidOptions } from '@/types/options';

/**
 * 渲染 Mermaid 代码为 PNG 图片
 */
export async function renderMermaid(
  code: string,
  options: MermaidOptions = {}
): Promise<{ buffer: Buffer; fileName: string }> {
  const {
    theme = 'default',
    backgroundColor = 'white',
    width,
    height,
    tempDir: defaultTempDir,
  } = options;

  // 创建临时目录
  const cleanTempDir = !defaultTempDir;
  let tempDir = defaultTempDir ?? '';

  if (!tempDir) {
    tempDir = await mkdtemp(join(tmpdir(), 'mermaid-'));
  }

  const inputFile = join(tempDir, 'input.mmd');
  const output = join(tempDir, 'output');
  const outputFile = `${output}.png` as const;

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

    // 读取生成的图片
    const buffer = await readFile(outputFile);
    const fileName = `mermaid_${Date.now()}.png`;

    return { buffer, fileName };
  } catch (error) {
    if (error instanceof MermaidError) {
      throw error;
    }
    throw new MermaidError(
      `Mermaid rendering failed: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  } finally {
    if (cleanTempDir) {
      // 清理临时目录
      // 注意：这里不处理删除错误
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        // 忽略错误
        void e;
      }
    }
  }
}
