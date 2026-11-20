import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Git may check these out with CRLF on Windows; the assertions below assume LF.
const lf = (s: string) => s.replace(/\r\n/g, '\n');
const compose = lf(readFileSync('docker-compose.yml', 'utf8'));
const dockerfile = lf(readFileSync('Dockerfile', 'utf8'));

it('docker-compose monte /data et transmet ORIGIN, ADMIN_EMAIL, ADMIN_PASSWORD, HOUSEHOLD_NAME, TZ', () => {
  expect(compose).toMatch(/\.\/data:\/data/);
  for (const key of ['ORIGIN', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'HOUSEHOLD_NAME', 'TZ']) {
    expect(compose).toContain(`- ${key}=$` + `{${key}`);
  }
  expect(compose).toMatch(/healthcheck:/);
});

it('docker-compose lit la vraie IP cliente derrière le proxy (ADDRESS_HEADER + XFF_DEPTH=1)', () => {
  expect(compose).toContain('- ADDRESS_HEADER=x-forwarded-for');
  expect(compose).toContain('- XFF_DEPTH=1');
});

it("docker-compose n'expose pas DISABLE_SIGNUP (inscription sur invitation uniquement)", () => {
  expect(compose).not.toContain('DISABLE_SIGNUP');
});

it('Dockerfile : production, base SQLite dans /data, migrations avant le démarrage', () => {
  expect(dockerfile).toContain('ENV NODE_ENV=production');
  expect(dockerfile).toContain('ENV DATABASE_PATH=/data/apogee.sqlite');
  expect(dockerfile).toMatch(/migrate\.ts[\s\S]*exec node \/app\/build\/index\.js/);
});

it('docker-compose transmet les variables AI_*', () => {
  for (const key of ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL', 'AI_DAILY_LIMIT_PER_HOUSEHOLD']) {
    expect(compose).toContain(`- ${key}=$` + `{${key}:-}`);
  }
});

it('Dockerfile : corps de requête jusqu\'à 8 Mo (photos)', () => {
  expect(dockerfile).toContain('ENV BODY_SIZE_LIMIT=8M');
});

it('docker-compose : service backup (alpine, ./data en lecture seule, ./backups, script monté, variables BACKUP_*)', () => {
  const backup = compose.slice(compose.indexOf('\n  backup:'));
  expect(backup).toContain('image: alpine:3');
  expect(backup).toContain('container_name: apogee-backup');
  expect(backup).toContain('restart: unless-stopped');
  expect(backup).toContain('- ./data:/data:ro');
  expect(backup).toContain('- ./backups:/backups');
  expect(backup).toContain('- ./scripts/run-backup.sh:/usr/local/bin/run-backup:ro');
  expect(backup).toContain('- BACKUP_RETENTION=$' + '{BACKUP_RETENTION:-30}');
  expect(backup).toContain('- BACKUP_SCHEDULE=$' + '{BACKUP_SCHEDULE:-0 3 * * *}');
  expect(backup).toMatch(/depends_on:\s*\n\s*apogee:\s*\n\s*condition: service_healthy/);
  // `$$` keeps compose from interpolating the variables of the startup command
  expect(backup).toContain('$' + '${BACKUP_SCHEDULE}');
  expect(backup).toContain('$' + '${BACKUP_RETENTION}');
  // a failed `apk add` at boot must stop the container so `restart: unless-stopped` retries
  expect(backup).toContain(
    'apk add --no-cache sqlite tzdata >/dev/null || { echo "[boot] apk add failed"; exit 1; }'
  );
});
