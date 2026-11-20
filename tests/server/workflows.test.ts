import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8').replace(/
/g, '
');
const ci = read('.github/workflows/ci.yml');
const publish = read('.github/workflows/docker-publish.yml');
const release = read('.github/workflows/release.yml');

it('ci.yml : cible main et lance check, test et build', () => {
  expect(ci).toMatch(/pull_request:\s*\n\s*branches: \[main\]/);
  expect(ci).toMatch(/push:\s*\n\s*branches-ignore: \[main\]/);
  expect(ci).toContain('npm ci --ignore-scripts');
  for (const cmd of ['npm run check', 'npm test', 'npm run build']) expect(ci).toContain(cmd);
  expect(ci).not.toContain('master');
});

it('docker-publish.yml : image gavark/apogee, amd64 + arm64 natifs, tags v* et main', () => {
  expect(publish).toContain('IMAGE_NAME: gavark/apogee');
  expect(publish).toContain('linux/amd64');
  expect(publish).toContain('linux/arm64');
  expect(publish).toMatch(/branches: \[main\]/);
  expect(publish).toContain("tags: ['v*']");
  expect(publish).toContain('type=raw,value=latest,enable={{is_default_branch}}');
});

it('docker-publish.yml : un job test (check + test) conditionne le build', () => {
  expect(publish).toMatch(/jobs:\n(?:.*\n)*?  test:\n/);
  expect(publish).toContain('npm ci --ignore-scripts');
  for (const cmd of ['npm run check', 'npm test']) expect(publish).toContain(cmd);
  expect(publish).toMatch(/node-version: '22'/);
  expect(publish).toMatch(/\n {2}build:\n {4}needs: test\n/);
});

it('release.yml : se déclenche sur les tags v*', () => {
  expect(release).toMatch(/push:\s*\n\s*tags: \['v\*'\]/);
  expect(release).toContain('gh release create');
});

it('modèles d\'issues : config.yml pointe vers le dépôt apogee', () => {
  const config = read('.github/ISSUE_TEMPLATE/config.yml');
  expect(config).toContain('https://github.com/Gavark/apogee');
  expect(config).not.toContain('babysleep');
});
