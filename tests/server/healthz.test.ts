import { it, expect } from 'vitest';
import { GET } from '../../src/routes/healthz/+server';

it('healthz répond 200 "ok"', async () => {
  const res = await GET({} as any);
  expect(res.status).toBe(200);
  expect(await res.text()).toBe('ok');
});
