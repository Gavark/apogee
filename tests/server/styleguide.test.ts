import { describe, it, expect, afterEach, vi } from 'vitest';
import { load } from '../../src/routes/dev/styleguide/+page.server';

describe('/dev/styleguide', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is served outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => load({} as any)).not.toThrow();
  });

  it('is a 404 in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => load({} as any)).toThrow(expect.objectContaining({ status: 404 }));
  });
});
