import axios from 'axios';
import { readFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, resolve } from 'node:path';

import { UploadError } from '@/errors';

/**
 * 图片来源类型
 */
export interface UrlImageSource {
  type: 'url';
  url: string;
}

export interface PathImageSource {
  type: 'path';
  path: string;
}

export interface BufferImageSource {
  type: 'buffer';
  buffer: Buffer;
  fileName: string;
}

export type ImageSource = UrlImageSource | PathImageSource | BufferImageSource;

export interface ImageReference {
  source: ImageSource;
  // optional suggested file name
  fileName?: string;
}

export interface PreparedImage {
  buffer: Buffer;
  fileName: string;
}

/**
 * 解析图片来源
 */
export function parseImageSource(src: string, baseDir?: string): ImageSource {
  // Data URL
  if (src.startsWith('data:')) {
    const match = /^data:image\/(\w+);base64,(.*)$/.exec(src);
    if (match) {
      const extension = match[1];
      const base64Data = match[2];
      if (base64Data) {
        return {
          type: 'buffer',
          buffer: Buffer.from(base64Data, 'base64'),
          fileName: `image.${extension}`,
        };
      }
    }
    throw new UploadError(`Invalid data URL: ${src.substring(0, 50)}...`);
  }

  // HTTP/HTTPS URL
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return { type: 'url', url: src };
  }

  // 本地文件路径
  const filePath = isAbsolute(src)
    ? src
    : resolve(baseDir ?? process.cwd(), src);
  return { type: 'path', path: filePath };
}

/**
 * 加载图片数据
 */
export async function loadImage(
  source: ImageSource,
  downloadEnabled = true
): Promise<PreparedImage> {
  switch (source.type) {
    case 'buffer':
      return { buffer: source.buffer, fileName: source.fileName };

    case 'path':
      try {
        const buffer = await readFile(source.path);
        const fileName = basename(source.path);
        return { buffer, fileName };
      } catch (error) {
        throw new UploadError(
          `Failed to read image file: ${source.path}`,
          source.path,
          error instanceof Error ? error : undefined
        );
      }

    case 'url':
      if (!downloadEnabled) {
        throw new UploadError('Image download is disabled', source.url);
      }
      return downloadImage(source.url);

    default:
      throw new UploadError('Unknown image source type');
  }
}

/**
 * 下载图片
 */
async function downloadImage(
  url: string
): Promise<{ buffer: Buffer; fileName: string }> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024, // 50MB 限制
    });

    const buffer = Buffer.from(response.data);

    // 从 URL 或 Content-Disposition 获取文件名
    let fileName = url.split('/').pop()?.split('?')[0] ?? 'image';

    // 确保有扩展名
    if (!extname(fileName)) {
      const contentType = response.headers['content-type'] as
        | string
        | undefined;
      const extension = getExtensionFromContentType(contentType);
      fileName += extension;
    }

    return { buffer, fileName };
  } catch (error) {
    throw new UploadError(
      `Failed to download image: ${url}`,
      url,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * 根据 Content-Type 获取文件扩展名
 */
function getExtensionFromContentType(contentType: string | undefined): string {
  if (!contentType) return '.png';

  const typeMap: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
  };

  return typeMap[contentType.split(';')[0]?.trim() ?? ''] ?? '.png';
}

/**
 * 获取图片 MIME 类型
 */
export function getMimeType(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
  };

  return mimeTypes[extension] ?? 'application/octet-stream';
}
