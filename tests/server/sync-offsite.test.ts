import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	existsSync,
	readFileSync,
	readdirSync,
	utimesSync,
	rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Windows PowerShell 5.1 is what the scheduled task uses; fall back to pwsh.
const shell = ['powershell.exe', 'powershell', 'pwsh'].find(
	(bin) => spawnSync(bin, ['-NoProfile', '-Command', 'exit 0']).status === 0
);
const script = resolve('scripts/sync-backups-offsite.ps1');
const isWindows = process.platform === 'win32';
const MISSING_DRIVE = String.fromCharCode(81, 58, 92); // Q:, a drive letter that should not exist

const DAY = 86_400_000;
function put(dir: string, name: string, ageDays: number, content = name) {
	const p = join(dir, name);
	writeFileSync(p, content);
	const t = new Date(Date.now() - ageDays * DAY);
	utimesSync(p, t, t);
}

describe.skipIf(!shell)('sync-backups-offsite.ps1', () => {
	let root: string, src: string, dst: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'apogee-sync-'));
		src = join(root, 'backups');
		dst = join(root, 'dest');
		mkdirSync(src);
		mkdirSync(dst);
	});
	afterEach(() => rmSync(root, { recursive: true, force: true }));

	function run(args: string[]) {
		return spawnSync(
			shell!,
			['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
			{ encoding: 'utf8' }
		);
	}
	const base = () => ['-Destination', dst, '-Source', src];

	it('copies recent sqlite and tar.gz files, named copies included, and skips old ones', () => {
		put(src, 'apogee-20261120T030000Z.sqlite', 1);
		put(src, 'apogee-photos-20261120T030000Z.tar.gz', 1);
		put(src, 'apogee-avant-maj.sqlite', 2);
		put(src, 'apogee-20261110T030000Z.sqlite', 10);
		const r = run(base());
		expect(r.status, r.stdout + r.stderr).toBe(0);
		expect(readdirSync(dst).sort()).toEqual([
			'apogee-20261120T030000Z.sqlite',
			'apogee-avant-maj.sqlite',
			'apogee-photos-20261120T030000Z.tar.gz'
		]);
		expect(readFileSync(join(dst, 'apogee-avant-maj.sqlite'), 'utf8')).toBe('apogee-avant-maj.sqlite');
		expect(readFileSync(join(src, 'sync-offsite.log'), 'utf8')).toContain('OK: 3 copied');
	});

	it('rotates old files at the destination', () => {
		put(src, 'apogee-20261120T030000Z.sqlite', 1);
		put(dst, 'apogee-20261101T030000Z.sqlite', 19);
		put(dst, 'apogee-photos-20261101T030000Z.tar.gz', 19);
		const r = run(base());
		expect(r.status, r.stdout + r.stderr).toBe(0);
		expect(readdirSync(dst)).toEqual(['apogee-20261120T030000Z.sqlite']);
	});

	it('safety net: deletes nothing when the destination has no recent file', () => {
		put(dst, 'apogee-20261101T030000Z.sqlite', 19);
		put(dst, 'apogee-photos-20261101T030000Z.tar.gz', 19);
		const r = run(base());
		expect(r.status, r.stdout + r.stderr).toBe(0);
		expect(readdirSync(dst).sort()).toEqual([
			'apogee-20261101T030000Z.sqlite',
			'apogee-photos-20261101T030000Z.tar.gz'
		]);
		expect(r.stdout).toContain('rotation skipped');
	});

	it('missing source folder: nothing to copy, exit 0', () => {
		const r = run(['-Destination', dst, '-Source', join(root, 'absent')]);
		expect(r.status, r.stdout + r.stderr).toBe(0);
		expect(r.stdout).toContain('rien a copier');
		expect(readdirSync(dst)).toEqual([]);
	});

	it.skipIf(!isWindows || existsSync(MISSING_DRIVE))(
		'destination on a missing drive: exit 1',
		() => {
			put(src, 'apogee-20261120T030000Z.sqlite', 1);
			const r = run(['-Destination', MISSING_DRIVE + 'nope', '-Source', src]);
			expect(r.status).toBe(1);
			expect(r.stdout).toContain('FAILED');
			expect(existsSync(MISSING_DRIVE + 'nope')).toBe(false);
		}
	);

	it('creates a missing destination folder', () => {
		put(src, 'apogee-20261120T030000Z.sqlite', 1);
		const nested = join(root, 'new', 'dir');
		mkdirSync(join(root, 'new'));
		const r = run(['-Destination', nested, '-Source', src]);
		expect(r.status, r.stdout + r.stderr).toBe(0);
		expect(existsSync(join(nested, 'apogee-20261120T030000Z.sqlite'))).toBe(true);
	});

	it('-DryRun changes nothing', () => {
		put(src, 'apogee-20261120T030000Z.sqlite', 1);
		put(dst, 'apogee-20261101T030000Z.sqlite', 19);
		const r = run([...base(), '-DryRun']);
		expect(r.status, r.stdout + r.stderr).toBe(0);
		expect(r.stdout).toContain('would copy');
		expect(r.stdout).toContain('would delete');
		expect(readdirSync(dst)).toEqual(['apogee-20261101T030000Z.sqlite']);
		expect(existsSync(join(src, 'sync-offsite.log'))).toBe(false);
	});
});
