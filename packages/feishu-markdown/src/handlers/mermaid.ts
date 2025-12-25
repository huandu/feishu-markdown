import { spawn } from 'node:child_process';
import { mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
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
  } = options;

  // 创建临时目录
  const tempDir = await mkdtemp(join(tmpdir(), 'mermaid-'));
  const inputFile = join(tempDir, 'input.mmd');
  const outputFile = join(tempDir, 'output.png');
  const configFile = join(tempDir, 'config.json');

  try {
    // 写入 Mermaid 代码
    await writeFile(inputFile, code, 'utf-8');

    // 写入配置文件
    const config = {
      theme,
      backgroundColor,
    };
    await writeFile(configFile, JSON.stringify(config), 'utf-8');

    // 构建命令参数
    const args = [
      '-i',
      inputFile,
      '-o',
      outputFile,
      '-c',
      configFile,
      '-b',
      backgroundColor,
    ];

    if (width) {
      args.push('-w', String(width));
    }
    if (height) {
      args.push('-H', String(height));
    }

    // 执行 mermaid-cli
    await executeMermaidCli(args);

    // 读取生成的图片
    const buffer = await readFile(outputFile);
    const fileName = `mermaid_${Date.now()}.png`;

    return { buffer, fileName };
  } finally {
    // 清理临时文件
    await cleanup(inputFile, outputFile, configFile, tempDir);
  }
}

/**
 * 执行 mermaid-cli 命令
 */
function executeMermaidCli(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // 尝试使用 npx 运行 mmdc
    const process = spawn(
      'npx',
      ['--yes', '@mermaid-js/mermaid-cli', ...args],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    let stderr = '';

    process.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    process.on('error', (error) => {
      reject(
        new MermaidError(
          `Failed to execute mermaid-cli: ${error.message}`,
          error
        )
      );
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new MermaidError(`mermaid-cli exited with code ${code}: ${stderr}`)
        );
      }
    });
  });
}

/**
 * 清理临时文件
 */
async function cleanup(...files: string[]): Promise<void> {
  for (const file of files) {
    try {
      await unlink(file);
    } catch {
      // 忽略清理错误
    }
  }
}

/**
 * 检查 mermaid-cli 是否可用
 */
export async function isMermaidAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(
      'npx',
      ['--yes', '@mermaid-js/mermaid-cli', '--version'],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    process.on('error', () => {
      resolve(false);
    });

    process.on('close', (code) => {
      resolve(code === 0);
    });
  });
}
