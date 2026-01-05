import { describe, expect, it, vi } from 'vitest';

import { FeishuMarkdown, type ImageReference } from '../src/index';
import { BlockType } from '../src/types/feishu';

// Mock FeishuClient
const mockCreateDescendantBlocks = vi.fn();
const mockUpdateBlocks = vi.fn();
const mockUploadMedia = vi.fn();
const mockCreateDocument = vi.fn();
const mockTransferOwner = vi.fn();

vi.mock('../src/client/index', () => {
  return {
    FeishuClient: vi.fn().mockImplementation(() => ({
      createDescendantBlocks: mockCreateDescendantBlocks,
      updateBlocks: mockUpdateBlocks,
      uploadMedia: mockUploadMedia,
      createDocument: mockCreateDocument,
      transferOwner: mockTransferOwner,
      getDocumentUrl: () => 'https://feishu.cn/docs/doc123',
    })),
  };
});

describe('FeishuMarkdown Upload Mapping', () => {
  it('should correctly map block IDs when API returns blocks in different order', async () => {
    const feishuMarkdown = new FeishuMarkdown({
      appId: 'appId',
      appSecret: 'appSecret',
    });

    // Mock createDocument
    mockCreateDocument.mockResolvedValue({
      document: { document_id: 'doc123', revision_id: 1 },
    });

    // Mock createDescendantBlocks
    // Scenario: Nested blocks returned in reverse order.
    // Root -> Bullet1
    // Bullet1 -> Image1

    mockCreateDescendantBlocks.mockResolvedValue({
      children: [
        {
          block_id: 'real_image_1',
          block_type: BlockType.Image,
          parent_id: 'real_bullet_1',
          children: [],
        },
        {
          block_id: 'real_bullet_1',
          block_type: BlockType.Bullet,
          parent_id: 'doc123',
          children: ['real_image_1'],
        },
      ],
      document_revision_id: 2,
      block_id_relations: [
        { temporary_block_id: 'temp_image_1', block_id: 'real_image_1' },
        {
          temporary_block_id: 'temp_bullet_1',
          block_id: 'real_bullet_1',
        },
      ],
    });

    mockUploadMedia.mockResolvedValue('file_token_123');

    // Manually construct blocks to ensure structure and bypass parser limitations
    const blocks = [
      {
        block_id: 'temp_bullet_1',
        block_type: BlockType.Bullet,
        children: ['temp_image_1'],
        parent_id: 'doc123', // parent is doc for root
      },
      {
        block_id: 'temp_image_1',
        block_type: BlockType.Image,
        children: [],
        parent_id: 'temp_bullet_1',
      },
    ];

    const imageBuffers = new Map<string, ImageReference>();
    imageBuffers.set('temp_image_1', {
      source: { type: 'path', path: 'image.png' },
      fileName: 'image.png',
    });

    // Call uploadContent directly
    await feishuMarkdown.uploadContent('doc123', blocks, imageBuffers, {
      downloadImages: false,
    });

    expect(mockUploadMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'docx_image',
      'real_image_1'
    );
  });
});
