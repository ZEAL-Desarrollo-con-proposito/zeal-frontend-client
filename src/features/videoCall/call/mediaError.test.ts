import { describe, expect, it } from 'vitest';
import { mediaErrorReason } from './mediaError';

describe('mediaErrorReason', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['NotSupportedError', 'unsupported'],
    ['TypeError', 'unknown'],
  ])('%s → %s', (name, reason) => {
    expect(mediaErrorReason(new DOMException('fallo', name))).toBe(reason);
  });

  it('cualquier otra cosa es un error desconocido', () => {
    expect(mediaErrorReason('fallo')).toBe('unknown');
  });
});
