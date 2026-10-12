import { test } from 'node:test';
import assert from 'node:assert/strict';
import fsPromises, { readFile, writeFile, rm, symlink, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { LocalStore, CacheIntegrityError } from '../src/local-store.js';
import { chunks, deferred, withTemporaryDirectory } from './helpers.js';

async function sandbox(run: (store: LocalStore) => Promise<void>) {
  await withTemporaryDirectory(async (directory) => run(new LocalStore(directory)));
}

test('atomic concurrent writes preserve one complete archive and remove partials', () =>
  sandbox(async (store) => {
    const results = await Promise.all([
      store.receive('same', chunks('aaaa')),
      store.receive('same', chunks('bbbb')),
    ]);
    assert.equal(results.filter((result) => result.created).length, 1);
    assert(
      ['aaaa', 'bbbb'].includes(await readFile(join(store.directory, 'same', 'archive'), 'utf8')),
    );
    assert.deepEqual(await readdir(store.directory), ['same']);

    await assert.rejects(store.receive('../escape', chunks('bad')));

    const limited = new LocalStore(join(store.directory, '..'), 1);
    await assert.rejects(limited.receive('large', chunks('large')));
    assert.equal(await store.get('large'), null);
  }));

test('same-size corruption is rejected before returning an archive', () =>
  sandbox(async (store) => {
    const entry = await store.receive('hash', chunks('original'));
    await writeFile(entry.file, 'modified');

    const errors: CacheIntegrityError[] = [];
    assert.equal(await store.get('hash', (error) => errors.push(error)), null);
    assert.equal(errors.length, 1);

    assert.equal(await store.get('hash'), null);

    assert.equal((await store.receive('hash', chunks('repaired'))).created, true);
    assert.equal(await readFile((await store.get('hash')) ?? '', 'utf8'), 'repaired');
  }));

test('symlinked archives and malformed metadata are rejected', () =>
  sandbox(async (store) => {
    const entry = await store.receive('hash', chunks('original'));
    await rm(entry.file);
    await symlink(join(store.directory, 'hash', 'metadata.json'), entry.file);
    assert.equal(await store.get('hash'), null);
    assert.equal(await store.get('hash'), null);

    await store.receive('hash', chunks('original'));
    await writeFile(join(store.directory, 'hash', 'metadata.json'), '{}');
    assert.equal(await store.get('hash'), null);
  }));

test('a symlinked entry is removed without touching its target', () =>
  sandbox(async (store) => {
    await mkdir(store.directory, { recursive: true });

    const outside = join(store.directory, 'outside.txt');
    await writeFile(outside, 'outside');
    await symlink(outside, join(store.directory, 'bad'));
    assert.equal(await store.get('bad'), null);
    assert.equal(await readFile(outside, 'utf8'), 'outside');

    assert.equal(await store.get('bad'), null);
  }));

test('expired entries become misses and are removed', () =>
  sandbox(async (store) => {
    const entry = await store.receive('hash', chunks('original'));
    const description = join(store.directory, 'hash', 'metadata.json');
    const details = JSON.parse(await readFile(description, 'utf8'));
    await writeFile(description, JSON.stringify({ ...details, createdAt: 0 }));
    assert.equal(await store.get('hash'), null);
    await assert.rejects(readFile(entry.file));
  }));

test('empty archives leave no visible entries', () =>
  sandbox(async (store) => {
    await assert.rejects(store.receive('empty', chunks('')), CacheIntegrityError);
    assert.deepEqual(await readdir(store.directory), []);
  }));

test('broken input stream never becomes a local hit', () =>
  sandbox(async (store) => {
    async function* broken() {
      yield Buffer.from('partial');

      throw new Error('truncated');
    }

    await assert.rejects(store.receive('new', broken()));
    assert.equal(await store.get('new'), null);
    assert.deepEqual(await readdir(store.directory), []);
  }));

test('an incomplete upload is invisible until the atomic publish', () =>
  sandbox(async (store) => {
    const ready = deferred();
    const writing = deferred();

    async function* delayed() {
      yield Buffer.from('first');
      writing.resolve();
      await ready.promise;
      yield Buffer.from('second');
    }

    const pending = store.receive('hash', delayed());

    await writing.promise;

    try {
      assert.equal(await store.get('hash'), null);
    } finally {
      ready.resolve();
    }

    const entry = await pending;
    assert.equal(await readFile(entry.file, 'utf8'), 'firstsecond');
    assert.deepEqual(await readdir(store.directory), ['hash']);
  }));

test('a concurrent repair is not deleted by a stale corrupt read', () =>
  sandbox(async (store) => {
    for (let index = 0; index < 4; index++) {
      const hash = `race${index}`;
      const entry = await store.receive(hash, chunks('original'));
      await writeFile(entry.file, 'modified');

      const [read, repair] = await Promise.all([
        store.get(hash),
        store.receive(hash, chunks('repaired')),
      ]);
      assert(read === null || read === repair.file);
      assert.equal(await readFile((await store.get(hash)) ?? '', 'utf8'), 'repaired');
    }
  }));

test('separate LocalStore instances resolve a same-hash publish collision', () =>
  sandbox(async (store) => {
    const root = join(store.directory, '..');
    const instances = Array.from({ length: 16 }, () => new LocalStore(root));
    const results = await Promise.all(
      instances.map((instance, index) => instance.receive('shared', chunks(`archive-${index}`))),
    );
    assert.equal(results.filter((result) => result.created).length, 1);

    const canonical = await readFile((await store.get('shared')) ?? '', 'utf8');

    assert(results.every((result) => result.file === results[0]?.file));
    assert.match(canonical, /^archive-(?:[0-9]|1[0-5])$/);
    assert.deepEqual(await readdir(store.directory), ['shared']);
  }));

test('a stale corrupt reader cannot quarantine a replacement from another store', () =>
  sandbox(async (store) => {
    const other = new LocalStore(join(store.directory, '..'));
    const original = await store.receive('hash', chunks('original'));
    await writeFile(original.file, 'modified');

    const originalRename = fsPromises.rename;
    let interleaved = false;
    try {
      fsPromises.rename = async (source, target) => {
        if (
          !interleaved &&
          typeof source === 'string' &&
          typeof target === 'string' &&
          source.endsWith('/entries-v1/hash') &&
          target.includes('.tmp-corrupt-')
        ) {
          interleaved = true;

          const repaired = await other.receive('hash', chunks('repaired'));
          assert.equal(repaired.created, true);
        }

        return originalRename(source, target);
      };
      syncBuiltinESMExports();

      assert.equal(await store.get('hash'), null);
      assert.equal(interleaved, true);
      assert.equal(await readFile((await other.get('hash')) ?? '', 'utf8'), 'repaired');
    } finally {
      fsPromises.rename = originalRename;
      syncBuiltinESMExports();
    }
  }));

for (const corruptThird of [false, true]) {
  test(`a ${corruptThird ? 'corrupt' : 'valid'} third writer resolves the displaced archive`, () =>
    sandbox(async (store) => {
      const root = join(store.directory, '..');
      const second = new LocalStore(root);
      const third = new LocalStore(root);
      const original = await store.receive('hash', chunks('original'));
      await writeFile(original.file, 'modified');

      const originalRename = fsPromises.rename;
      let phase = 0;
      try {
        fsPromises.rename = async (source, target) => {
          if (typeof source === 'string' && typeof target === 'string') {
            if (
              phase === 0 &&
              source.endsWith('/entries-v1/hash') &&
              target.includes('.tmp-corrupt-')
            ) {
              phase = 1;
              assert.equal((await second.receive('hash', chunks('second'))).created, true);
            } else if (
              phase === 1 &&
              source.includes('.tmp-corrupt-') &&
              target.endsWith('/entries-v1/hash')
            ) {
              phase = 2;

              const candidate = await third.receive('hash', chunks('third'));
              assert.equal(candidate.created, true);

              if (corruptThird) {
                await writeFile(candidate.file, 'other');
              }
            }
          }

          return originalRename(source, target);
        };
        syncBuiltinESMExports();

        assert.equal(await store.get('hash'), null);
        assert.equal(phase, 2);
        assert.equal(
          await readFile((await store.get('hash')) ?? '', 'utf8'),
          corruptThird ? 'second' : 'third',
        );
        assert.deepEqual(await readdir(store.directory), ['hash']);
      } finally {
        fsPromises.rename = originalRename;
        syncBuiltinESMExports();
      }
    }));
}
