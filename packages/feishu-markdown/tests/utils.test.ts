import { describe, expect, it } from 'vitest';

import { CodeLanguage } from '@/src/types/feishu';
import { generateBlockId } from '@/src/utils/id';
import { isMermaidLanguage, mapCodeLanguage } from '@/src/utils/language';
import { delay, retryWithBackoff } from '@/src/utils/retry';

describe('Utils', () => {
  describe('generateBlockId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateBlockId());
      }
      expect(ids.size).toBe(1000);
    });

    it('should generate IDs with temp prefix', () => {
      const id = generateBlockId();
      expect(id.startsWith('temp_')).toBe(true);
    });
  });

  describe('mapCodeLanguage', () => {
    it('should map common languages', () => {
      expect(mapCodeLanguage('javascript')).toBe(CodeLanguage.JavaScript);
      expect(mapCodeLanguage('typescript')).toBe(CodeLanguage.TypeScript);
      expect(mapCodeLanguage('python')).toBe(CodeLanguage.Python);
      expect(mapCodeLanguage('java')).toBe(CodeLanguage.Java);
      expect(mapCodeLanguage('go')).toBe(CodeLanguage.Go);
      expect(mapCodeLanguage('rust')).toBe(CodeLanguage.Rust);
    });

    it('should handle aliases', () => {
      expect(mapCodeLanguage('js')).toBe(CodeLanguage.JavaScript);
      expect(mapCodeLanguage('ts')).toBe(CodeLanguage.TypeScript);
      expect(mapCodeLanguage('py')).toBe(CodeLanguage.Python);
      expect(mapCodeLanguage('rb')).toBe(CodeLanguage.Ruby);
      expect(mapCodeLanguage('sh')).toBe(CodeLanguage.Shell);
      expect(mapCodeLanguage('bash')).toBe(CodeLanguage.Bash);
    });

    it('should be case insensitive', () => {
      expect(mapCodeLanguage('JavaScript')).toBe(CodeLanguage.JavaScript);
      expect(mapCodeLanguage('PYTHON')).toBe(CodeLanguage.Python);
      expect(mapCodeLanguage('TypeScript')).toBe(CodeLanguage.TypeScript);
    });

    it('should return PlainText for unknown languages', () => {
      expect(mapCodeLanguage('unknown')).toBe(CodeLanguage.PlainText);
      expect(mapCodeLanguage('')).toBe(CodeLanguage.PlainText);
    });
  });

  describe('isMermaidLanguage', () => {
    it('should detect mermaid language', () => {
      expect(isMermaidLanguage('mermaid')).toBe(true);
      expect(isMermaidLanguage('Mermaid')).toBe(true);
      expect(isMermaidLanguage('MERMAID')).toBe(true);
    });

    it('should not match other languages', () => {
      expect(isMermaidLanguage('javascript')).toBe(false);
      expect(isMermaidLanguage('python')).toBe(false);
    });
  });

  describe('delay', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some tolerance
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first try', async () => {
      let attempts = 0;
      const result = await retryWithBackoff(async () => {
        attempts++;
        return 'success';
      });
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const result = await retryWithBackoff(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('fail');
          }
          return 'success';
        },
        { retries: 3, baseDelay: 10 }
      );
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max retries', async () => {
      let attempts = 0;
      await expect(
        retryWithBackoff(
          async () => {
            attempts++;
            throw new Error('always fail');
          },
          { retries: 2, baseDelay: 10 }
        )
      ).rejects.toThrow('always fail');
      expect(attempts).toBe(3); // Initial + 2 retries
    });

    it('should not retry when shouldRetry returns false', async () => {
      let attempts = 0;
      await expect(
        retryWithBackoff(
          async () => {
            attempts++;
            throw new Error('non-retryable');
          },
          {
            retries: 3,
            baseDelay: 10,
            shouldRetry: () => false,
          }
        )
      ).rejects.toThrow('non-retryable');
      expect(attempts).toBe(1);
    });
  });
});
