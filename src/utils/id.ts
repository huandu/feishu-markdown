import { nanoid } from 'nanoid';

/**
 * 生成一个临时的块 ID
 * 用于在创建嵌套块时标识块之间的关系
 */
export function generateBlockId(): string {
  return `temp_${nanoid(12)}`;
}
