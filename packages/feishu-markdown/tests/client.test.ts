import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeishuClient } from '@/client';

vi.mock('axios');

describe('FeishuClient', () => {
  const mockPost = vi.fn();
  // Mock axios instance
  const mockAxiosInstance = {
    post: mockPost,
    request: vi.fn(), // request method is used by this.request
    interceptors: {
      response: { use: vi.fn() },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (axios.create as any).mockReturnValue(mockAxiosInstance);
  });

  it('should call addCollaborator when feishuEmail is set', async () => {
    const client = new FeishuClient({
      appId: 'appId',
      appSecret: 'appSecret',
      feishuEmail: 'test@example.com',
    });

    // Mock getTenantAccessToken response
    mockPost.mockResolvedValueOnce({
      data: {
        code: 0,
        tenant_access_token: 'token',
        expire: 7200,
      },
    });

    // Mock getUserIdByEmail response
    mockAxiosInstance.request.mockResolvedValueOnce({
      data: {
        code: 0,
        msg: 'success',
        data: {
          user_list: [
            {
              user_id: 'ou_123456',
              email: 'test@example.com',
            },
          ],
        },
      },
    });

    // Mock addCollaborator response
    mockAxiosInstance.request.mockResolvedValueOnce({
      data: {
        code: 0,
        msg: 'success',
      },
    });

    await client.addCollaborator('docToken');

    expect(mockPost).toHaveBeenCalledTimes(1); // Token call
    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2); // API calls

    // Check getUserIdByEmail call
    expect(mockAxiosInstance.request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'POST',
        url: '/open-apis/contact/v3/users/batch_get_id?user_id_type=user_id',
        data: {
          emails: ['test@example.com'],
        },
      })
    );

    // Check addCollaborator call
    expect(mockAxiosInstance.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'POST',
        url: '/open-apis/drive/v1/permissions/docToken/members?type=docx',
        data: {
          member_type: 'user_id',
          member_id: 'ou_123456',
          perm: 'full_access',
        },
      })
    );
  });

  it('should not call addCollaborator when feishuEmail is not set', async () => {
    const client = new FeishuClient({
      appId: 'appId',
      appSecret: 'appSecret',
    });

    await client.addCollaborator('docToken');

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockAxiosInstance.request).not.toHaveBeenCalled();
  });
});
