import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const dockerAvailable = spawnSync('docker', ['info']).status === 0;
const repoScripts = resolve('scripts');

// One alpine container plays every scenario in its own folder under /work; the
// tests then inspect the results on the host side.
const SCRIPT = String.raw`
set -u
apk add --no-cache sqlite >/dev/null

mkdb() { sqlite3 "$1" "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO users (name) VALUES ('a');"; }
run() { # run <scenario> <retention>
  s="/work/$1"; r="$2"
  DATA_DIR="$s/data" BACKUP_DIR="$s/backups" BACKUP_RETENTION="$r" /scripts/run-backup.sh >"$s/out.txt" 2>&1
  echo $? >"$s/exit.txt"
}
setup() { mkdir -p "/work/$1/data" "/work/$1/backups"; }

# 1. database + photos
setup ok; mkdb /work/ok/data/apogee.sqlite
mkdir /work/ok/data/photos; echo img >/work/ok/data/photos/a.jpg
run ok 30
for f in /work/ok/backups/apogee-2*.sqlite; do
  sqlite3 "$f" 'PRAGMA integrity_check;' >/work/ok/integrity.txt
  sqlite3 "$f" 'SELECT count(*) FROM users;' >/work/ok/rows.txt
done
for f in /work/ok/backups/apogee-photos-*.tar.gz; do tar -tzf "$f" >/work/ok/tar-list.txt; done

# 2. no photos folder
setup nophotos; mkdb /work/nophotos/data/apogee.sqlite
run nophotos 30

# 3. no database
setup nodb
run nodb 30

# 4. corrupt database, older backups already there
setup corrupt; head -c 4096 /dev/urandom >/work/corrupt/data/apogee.sqlite
mkdir /work/corrupt/data/photos
mkdb /work/corrupt/backups/apogee-20200101T000000Z.sqlite
run corrupt 30

# 5. rotation: 4 pairs + hand-named copies, retention 2
setup rotation; mkdb /work/rotation/data/apogee.sqlite
mkdir /work/rotation/data/photos; echo img >/work/rotation/data/photos/a.jpg
b=/work/rotation/backups
for i in 1 2 3 4; do
  d="2020010$i"; touch -d "2020-01-0$i 00:00:00" "$b/apogee-"$d"T000000Z.sqlite"
  touch -d "2020-01-0$i 00:00:00" "$b/apogee-photos-"$d"T000000Z.tar.gz"
done
touch -d "2019-01-01 00:00:00" "$b/apogee-avant-maj.sqlite" "$b/apogee-photos-avant-maj.tar.gz"
run rotation 2
`;

let tmp: string;
let dockerOutput = '';

beforeAll(() => {
  if (!dockerAvailable) return;
  tmp = mkdtempSync(join(tmpdir(), 'apogee-backup-'));
  const r = spawnSync(
    'docker',
    ['run', '--rm', '-v', `${tmp}:/work`, '-v', `${repoScripts}:/scripts:ro`, 'alpine:3', 'sh', '-c', SCRIPT],
    { encoding: 'utf8' }
  );
  dockerOutput = `${r.stdout}\n${r.stderr}`;
}, 180_000);

afterAll(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

const read = (s: string, f: string) => readFileSync(join(tmp, s, f), 'utf8').trim();
const backups = (s: string) => readdirSync(join(tmp, s, 'backups')).sort();
const exitCode = (s: string) => {
  expect(existsSync(join(tmp, s, 'exit.txt')), dockerOutput).toBe(true);
  return Number(read(s, 'exit.txt'));
};

describe('scripts/run-backup.sh', () => {
  it.skipIf(!dockerAvailable)(
    'crée une paire apogee-<TS>.sqlite + apogee-photos-<TS>.tar.gz de même horodatage, base intègre, archive lisible',
    () => {
      expect(exitCode('ok')).toBe(0);
      const files = backups('ok');
      expect(files).toHaveLength(2);
      const db = files.find((f) => f.endsWith('.sqlite'))!;
      const tar = files.find((f) => f.endsWith('.tar.gz'))!;
      expect(db).toMatch(/^apogee-\d{8}T\d{6}Z\.sqlite$/);
      const ts = db.slice('apogee-'.length, -'.sqlite'.length);
      expect(tar).toBe(`apogee-photos-${ts}.tar.gz`);
      expect(read('ok', 'integrity.txt')).toBe('ok');
      expect(read('ok', 'rows.txt')).toBe('1');
      expect(read('ok', 'tar-list.txt')).toContain('photos/a.jpg');
    },
    180_000
  );

  it.skipIf(!dockerAvailable)('sans dossier photos : base seule, sortie 0', () => {
    expect(exitCode('nophotos')).toBe(0);
    const files = backups('nophotos');
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^apogee-\d{8}T\d{6}Z\.sqlite$/);
  });

  it.skipIf(!dockerAvailable)('sans base : message, sortie 0, aucun fichier', () => {
    expect(exitCode('nodb')).toBe(0);
    expect(read('nodb', 'out.txt')).toContain('source not found');
    expect(backups('nodb')).toEqual([]);
  });

  it.skipIf(!dockerAvailable)(
    'base corrompue : aucun fichier .sqlite laissé, sortie non nulle, anciennes sauvegardes intactes',
    () => {
      expect(exitCode('corrupt')).not.toBe(0);
      expect(backups('corrupt')).toEqual(['apogee-20200101T000000Z.sqlite']);
    }
  );

  it.skipIf(!dockerAvailable)(
    'rotation : avec BACKUP_RETENTION=2 et 4 paires existantes, il reste les 2 plus récentes de chaque type ; apogee-avant-maj.sqlite est conservé',
    () => {
      expect(exitCode('rotation')).toBe(0);
      const files = backups('rotation');
      const dbs = files.filter((f) => /^apogee-\d{8}T\d{6}Z\.sqlite$/.test(f));
      const tars = files.filter((f) => /^apogee-photos-\d{8}T\d{6}Z\.tar\.gz$/.test(f));
      expect(dbs).toHaveLength(2);
      expect(tars).toHaveLength(2);
      expect(dbs).toContain('apogee-20200104T000000Z.sqlite');
      expect(tars).toContain('apogee-photos-20200104T000000Z.tar.gz');
      expect(dbs).not.toContain('apogee-20200101T000000Z.sqlite');
      expect(files).toContain('apogee-avant-maj.sqlite');
      expect(files).toContain('apogee-photos-avant-maj.tar.gz');
    }
  );
});
