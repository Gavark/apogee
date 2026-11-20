import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const compose = readFileSync('docker-compose.yml', 'utf8');
const dockerfile = readFileSync('Dockerfile', 'utf8');

it('docker-compose monte /data et transmet ORIGIN, ADMIN_EMAIL, ADMIN_PASSWORD, HOUSEHOLD_NAME, TZ', () => {
  expect(compose).toMatch(/\.\/data:\/data/);
  for (const key of ['ORIGIN', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'HOUSEHOLD_NAME', 'TZ']) {
    expect(compose).toContain(`- ${key}=$` + `{${key}`);
  }
  expect(compose).toMatch(/healthcheck:/);
});

it("docker-compose n'expose pas DISABLE_SIGNUP (inscription sur invitation uniquement)", () => {
  expect(compose).not.toContain('DISABLE_SIGNUP');
});

it('Dockerfile : production, base SQLite dans /data, migrations avant le démarrage', () => {
  expect(dockerfile).toContain('ENV NODE_ENV=production');
  expect(dockerfile).toContain('ENV DATABASE_PATH=/data/apogee.sqlite');
  expect(dockerfile).toMatch(/migrate\.ts[\s\S]*exec node \/app\/build\/index\.js/);
});
