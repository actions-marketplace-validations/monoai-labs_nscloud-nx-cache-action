import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import * as profiler from '../bench/restoration/profile.js';
import * as generator from '../bench/restoration/fixture.js';
import { syntheticCorpus } from '../bench/restoration/synthetic-profile.js';
import {
  TarEntryType,
  TarEntryMode,
  TAR_BLOCK_BYTES,
  TarHeader,
  Ascii,
  OCTAL_RADIX,
} from '../bench/restoration/tar-format.js';
import { KIBIBYTE } from '../src/units.js';
import { CacheOperation, CacheTier } from '../src/metrics.js';

const TAR_CHECKSUM_DIGITS = 6;

test('synthetic workload and stress recipes reproduce the corpus and qualify every archive', async () => {
  const corpus = await generator.readCorpus();
  const { profiles: regenerated, ...metadata } = await syntheticCorpus();
  const { profiles: saved, ...savedMetadata } = corpus;
  assert.deepEqual(metadata, savedMetadata);
  assert.equal(regenerated.length, saved.length);

  for (const actual of regenerated) {
    const expected = saved.find((profile) => profile.id === actual.id);
    assert.ok(expected);
    assert.equal(actual.attempts, expected.attempts);
    assert.deepEqual(actual.layout, expected.layout);
    generator.assertCalibration(expected, actual, { exactLayout: true });
  }

  assert.equal(corpus.profiles.length, 16);
  assert.equal(
    corpus.profiles.reduce((sum, profile) => sum + profile.attempts, 0),
    100,
  );

  const root = await mkdtemp(join(tmpdir(), 'restoration-fixture-test-'));

  try {
    const result = await generator.generateCorpus({ directory: root, all: true });

    assert.equal(result.fixtures.length, 16);

    for (const fixture of result.fixtures) {
      assert.equal(fixture.exactLayout, true);

      const bytes = await readFile(fixture.file);

      assert.equal(generator.sha256(bytes), fixture.digest);

      const expected = corpus.profiles.find((profile) => profile.id === fixture.profileId);
      assert.ok(expected);

      generator.assertCalibration(expected, profiler.profileArchive(bytes), { exactLayout: true });

      const poison = Buffer.from(bytes);
      poison[20] = (poison[20] ?? 0) ^ 255;
      assert.throws(() => profiler.profileArchive(poison));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function tarEntry(
  name: string,
  data: string | Buffer = '',
  {
    type = TarEntryType.File,
    mode = type === TarEntryType.Directory ? TarEntryMode.Directory : TarEntryMode.File,
    prefix = '',
    headerSize,
    mutate,
  }: {
    type?: string;
    mode?: number;
    prefix?: string;
    headerSize?: number;
    mutate?: (header: Buffer) => void;
  } = {},
) {
  const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const header = Buffer.alloc(TAR_BLOCK_BYTES);
  header.write(name, TarHeader.NameStart, TarHeader.NameEnd - TarHeader.NameStart);
  header.write(
    mode.toString(OCTAL_RADIX).padStart(TarHeader.ModeEnd - TarHeader.ModeStart - 1, '0') + '\0',
    TarHeader.ModeStart,
    TarHeader.ModeEnd - TarHeader.ModeStart,
  );
  header.write(
    (headerSize ?? body.length)
      .toString(OCTAL_RADIX)
      .padStart(TarHeader.SizeEnd - TarHeader.SizeStart - 1, '0') + '\0',
    TarHeader.SizeStart,
    TarHeader.SizeEnd - TarHeader.SizeStart,
  );
  header[TarHeader.TypeOffset] = type.charCodeAt(0);
  header.write('ustar\0', TarHeader.MagicStart, TarHeader.MagicEnd - TarHeader.MagicStart);
  header.write(prefix, TarHeader.PrefixStart, TarHeader.PrefixEnd - TarHeader.PrefixStart);
  header.fill(Ascii.Space, TarHeader.ChecksumStart, TarHeader.ChecksumEnd);

  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(
    checksum.toString(OCTAL_RADIX).padStart(TAR_CHECKSUM_DIGITS, '0') + '\0 ',
    TarHeader.ChecksumStart,
    TarHeader.ChecksumEnd - TarHeader.ChecksumStart,
  );
  mutate?.(header);

  return Buffer.concat([
    header,
    body,
    Buffer.alloc((TAR_BLOCK_BYTES - (body.length % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES),
  ]);
}

function archive(
  entries: Buffer[],
  { terminator = Buffer.alloc(KIBIBYTE) }: { terminator?: Buffer } = {},
) {
  return gzipSync(Buffer.concat([...entries, terminator]));
}

function pax(key: string, value: string) {
  const record = Buffer.from(`${key}=${value}\n`);
  let size = record.length + 2;
  while (size !== record.length + String(size).length + 1) {
    size = record.length + String(size).length + 1;
  }

  return Buffer.concat([Buffer.from(`${size} `), record]);
}

test('normal tar counts modes, zeros, empty directories and density while excluding replay metadata', () => {
  const bytes = archive([
    tarEntry('pkg/', '', { type: TarEntryType.Directory }),
    tarEntry('pkg/empty/', '', { type: TarEntryType.Directory }),
    tarEntry('pkg/index.js', 'data', { mode: TarEntryMode.ExecutableFile }),
    tarEntry('pkg/index.d.ts'),
    tarEntry('code', '0'),
    tarEntry('terminalOutput', 'private-console-contents'),
  ]);

  const profile = profiler.profileArchive(bytes, { includeLayout: true });
  assert.equal(profile.fileCount, 2);
  assert.equal(profile.directoryCount, 2);
  assert.equal(profile.outputBytes, 4);
  assert.equal(profile.metadataBytes, 25);
  assert.equal(profile.maxDepth, 2);
  assert.deepEqual(profile.fileSizeBytes, [0, 4]);
  assert.deepEqual(profile.directoryChildCounts, [0, 1, 3]);
  assert.deepEqual(profile.modeCounts, { 40755: 2, 100755: 1, 100644: 1 });
  assert.deepEqual(profile.extensions, {
    js: { count: 1, bytes: 4 },
    'd.ts': { count: 1, bytes: 0 },
  });

  assert.ok(profile.layout);
  assert.equal(profile.layout.length, 4);
  assert.deepEqual(
    profile.layout.map((entry) => entry.parent),
    [null, 0, 0, 0],
  );

  assert.equal(profile.filesPerMiB, 524288);
  assert.doesNotMatch(JSON.stringify(profile), /private-console|index|pkg|terminalOutput/);
});

test('anonymous layout is stable when tar entries arrive in a different order', () => {
  const directory = tarEntry('pkg/', '', { type: TarEntryType.Directory });
  const first = tarEntry('pkg/first.js', 'one');
  const second = tarEntry('pkg/second.d.ts', 'two');
  const profile = (entries: Buffer[]) =>
    profiler.profileArchive(archive(entries), { includeLayout: true });

  assert.deepEqual(
    profile([directory, first, second]).layout,
    profile([second, directory, first]).layout,
  );
});

test('PAX path and size override and GNU long names retain anonymous shape', () => {
  const longPath = `nested/${'synthetic-private-name-'.repeat(8)}.js`;
  const paxArchive = archive([
    tarEntry('global', pax('comment', 'private-pax-text'), { type: TarEntryType.GlobalPaxHeader }),
    tarEntry('extended', Buffer.concat([pax('path', longPath), pax('size', '3')]), {
      type: TarEntryType.PaxHeader,
    }),
    tarEntry('placeholder', 'abc', { headerSize: 0 }),
  ]);
  const gnuArchive = archive([
    tarEntry('././@LongLink', `${longPath}\0`, { type: TarEntryType.GnuLongName }),
    tarEntry('placeholder', 'abc'),
  ]);

  for (const bytes of [paxArchive, gnuArchive]) {
    const profile = profiler.profileArchive(bytes, { includeLayout: true });
    assert.equal(profile.fileCount, 1);
    assert.equal(profile.outputBytes, 3);
    assert.equal(profile.maxDepth, 2);
    assert.deepEqual(profile.types, { 0: 1 });

    assert.doesNotMatch(JSON.stringify(profile), /private|placeholder|LongLink|pax-text/);
  }

  const prefixed = profiler.profileArchive(
    archive([tarEntry('index.js', 'x', { prefix: 'outputs/pkg' })]),
  );
  assert.equal(prefixed.maxDepth, 3);
});

test('gzip expansion and archive entry limits are enforced before unbounded inspection', () => {
  const bytes = archive([tarEntry('one.js', Buffer.alloc(20000, 65)), tarEntry('two.js', 'two')]);
  assert.throws(
    () => profiler.profileArchive(bytes, { maxExpandedBytes: 4096 }),
    /larger|length|size|buffer/i,
  );
  assert.throws(() => profiler.profileArchive(bytes, { maxEntries: 1 }), /entry limit/);

  for (const options of [
    { maxEntries: 0 },
    { maxExpandedBytes: 0 },
    { attempts: -1 },
    { maxExpandedBytes: Infinity },
  ]) {
    assert.throws(() => profiler.profileArchive(bytes, options));
  }

  assert.throws(() => profiler.profileArchive(bytes.subarray(0, bytes.length - 2)));
});

test('bad checksums, truncated entries, invalid terminators and dangling extension records fail', () => {
  assert.throws(
    () =>
      profiler.profileArchive(
        archive([
          tarEntry('file.js', 'one', {
            mutate: (header) => {
              header[0] = header.readUInt8(0) ^ 1;
            },
          }),
        ]),
      ),
    /checksum/,
  );

  assert.throws(
    () => profiler.profileArchive(archive([tarEntry('file.js', 'one', { headerSize: 4096 })])),
    /Truncated/,
  );

  assert.throws(
    () =>
      profiler.profileArchive(
        archive([tarEntry('file.js', 'one')], { terminator: Buffer.alloc(TAR_BLOCK_BYTES) }),
      ),
    /terminator/,
  );
  assert.throws(
    () =>
      profiler.profileArchive(
        archive([tarEntry('file.js', 'one')], { terminator: Buffer.alloc(0) }),
      ),
    /Incomplete/,
  );

  assert.throws(
    () =>
      profiler.profileArchive(
        archive([tarEntry('extended', pax('path', 'file.js'), { type: TarEntryType.PaxHeader })]),
      ),
    /Incomplete/,
  );

  assert.throws(
    () =>
      profiler.profileArchive(
        archive([tarEntry('long', 'file.js\0', { type: TarEntryType.GnuLongName })]),
      ),
    /Incomplete/,
  );
});

test('unsafe names and normalized duplicate paths fail, including PAX and GNU overrides', () => {
  for (const name of ['/absolute.js', '../escape.js', 'safe/../escape.js', 'safe\\escape.js']) {
    assert.throws(() => profiler.profileArchive(archive([tarEntry(name, 'x')])), /Unsafe/);
    assert.throws(
      () =>
        profiler.profileArchive(
          archive([
            tarEntry('extended', pax('path', name), { type: TarEntryType.PaxHeader }),
            tarEntry('safe.js', 'x'),
          ]),
        ),
      /Unsafe/,
    );
    assert.throws(
      () =>
        profiler.profileArchive(
          archive([
            tarEntry('long', `${name}\0`, { type: TarEntryType.GnuLongName }),
            tarEntry('safe.js', 'x'),
          ]),
        ),
      /Unsafe/,
    );
  }

  for (const second of ['file.js', './file.js', 'nested//file.js']) {
    const first = second.startsWith('nested') ? 'nested/file.js' : 'file.js';
    assert.throws(
      () => profiler.profileArchive(archive([tarEntry(first, 'x'), tarEntry(second, 'y')])),
      /Duplicate/,
    );
  }
});

test('malformed PAX, unsupported sparse and unsupported entry types fail explicitly', () => {
  for (const body of ['999 path=file.js\n', '12 path=x.jsX', '0 path=file.js\n', '12 noequals\n']) {
    assert.throws(
      () =>
        profiler.profileArchive(
          archive([
            tarEntry('extended', body, { type: TarEntryType.PaxHeader }),
            tarEntry('file.js', 'x'),
          ]),
        ),
      /PAX/,
    );
  }

  assert.throws(
    () =>
      profiler.profileArchive(
        archive([
          tarEntry('extended', pax('GNU.sparse.map', '0,4'), { type: TarEntryType.PaxHeader }),
          tarEntry('file.js', 'x'),
        ]),
      ),
    /Sparse/,
  );
  assert.throws(
    () =>
      profiler.profileArchive(
        archive([tarEntry('device', '', { type: TarEntryType.CharacterDevice })]),
      ),
    /Unsupported/,
  );
});

test('suffix summaries never retain private basename fragments or unknown extensions', () => {
  const bytes = archive([
    tarEntry('secret-directory/report.confidential-customer-secret.js', 'private-payload'),
    tarEntry('secret-directory/source.confidential-customer-secret.d.ts', ''),
    tarEntry('secret-directory/asset.confidential-customer-secret', ''),
  ]);
  const profile = profiler.profileArchive(bytes, { includeLayout: true });
  assert.doesNotMatch(
    JSON.stringify(profile),
    /secret-directory|confidential-customer|private-payload|report\.|source\.|asset\./,
  );
  assert.deepEqual(profile.extensions, {
    js: { count: 1, bytes: 15 },
    'd.ts': { count: 1, bytes: 0 },
    '(other)': { count: 1, bytes: 0 },
  });
});

test('events preserve failures and misses but redact unstructured fields and unsafe hashes', () => {
  const log = [
    'unstructured private error',
    JSON.stringify({
      cache: {
        operation: CacheOperation.Get,
        tier: CacheTier.Artifact,
        bytes: 10,
        durationMs: 3,
        hash: 'safe-hash',
        token: 'secret',
      },
    }),
    JSON.stringify({
      cache: {
        operation: CacheOperation.Get,
        tier: CacheTier.Miss,
        durationMs: 2,
        hash: 'https://private/signed',
      },
    }),
    JSON.stringify({
      cache: {
        operation: CacheOperation.Get,
        tier: CacheTier.Error,
        durationMs: 1,
        error: 'private-url',
      },
    }),
  ].join('\n');

  const events = profiler.parseCacheEvents(log, { includeHashes: true });
  assert.doesNotMatch(JSON.stringify(events), /private|secret|signed|https/);
  assert.equal(events[0]?.hash, 'safe-hash');
  assert.ok(events[1]);
  assert.equal(events[1].hash, undefined);

  assert.deepEqual(profiler.summarizeCacheEvents(events), {
    eventCount: 3,
    successfulGets: 1,
    restoredBytes: 10,
    byPath: { 'get:artifact': 1, 'get:miss': 1, 'get:error': 1 },
  });

  assert.throws(() => profiler.parseCacheEvents('{"cache":bad}'), /Malformed/);
  assert.throws(
    () =>
      profiler.parseCacheEvents(
        JSON.stringify({
          cache: {
            operation: CacheOperation.Get,
            tier: CacheTier.Artifact,
            bytes: -1,
            durationMs: 1,
          },
        }),
      ),
    /bytes/,
  );
});

test('event reader emits only structured cache fields', () => {
  const events = profiler.parseCacheEvents(
    'secret preamble\n' +
      JSON.stringify({
        cache: {
          operation: CacheOperation.Get,
          tier: CacheTier.Artifact,
          hash: 'private-hash',
          bytes: 10,
          durationMs: 1,
          signedUrl: 'private',
        },
      }),
  );
  assert.deepEqual(events, [{ operation: 'get', tier: 'artifact', bytes: 10, durationMs: 1 }]);
});

test('failure capture preserves bounded error codes while stripping raw messages', () => {
  const log = (code: string) =>
    JSON.stringify({
      cache: {
        operation: CacheOperation.Get,
        tier: CacheTier.Error,
        durationMs: 1,
        errorCode: code,
        error: 'private signed URL',
      },
    });

  assert.deepEqual(profiler.parseCacheEvents(log('timeout')), [
    { operation: 'get', tier: 'error', durationMs: 1, errorCode: 'timeout' },
  ]);
  assert.deepEqual(profiler.parseCacheEvents(log('private value')), [
    { operation: 'get', tier: 'error', durationMs: 1 },
  ]);
});

test('corpus reader validates profiles before fixture generation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'restoration-corpus-test-'));

  try {
    const file = join(root, 'invalid.json');
    const corpus = await generator.readCorpus();
    const first = corpus.profiles[0];
    assert.ok(first);

    first.compressedBytes = -1;
    await writeFile(file, JSON.stringify(corpus));

    await assert.rejects(generator.readCorpus(file), /Invalid restoration corpus/);
    await assert.rejects(
      generator.generateCorpus({ directory: join(root, 'generated'), corpusFile: file }),
      /Invalid restoration corpus/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('custom and marginal-only corpora remain usable without built-in recipe requirements', async () => {
  const root = await mkdtemp(join(tmpdir(), 'restoration-custom-corpus-test-'));

  try {
    const source = await generator.readCorpus();
    const profile = source.profiles[0];
    assert.ok(profile);

    profile.id = 'custom-empty-output';
    delete profile.layout;

    for (const field of ['fileBytes', 'compressionRatio', 'filesPerMiB']) {
      Reflect.deleteProperty(profile, field);
    }

    const corpus = { profiles: [profile], representativeIds: [profile.id] };
    const file = join(root, 'custom.json');
    await writeFile(file, JSON.stringify(corpus));
    assert.deepEqual(await generator.readCorpus(file), corpus);

    const result = await generator.generateCorpus({
      directory: join(root, 'generated'),
      corpusFile: file,
    });
    assert.equal(result.fixtures.length, 1);
    assert.equal(result.fixtures[0]?.profileId, profile.id);
    assert.equal(result.fixtures[0]?.exactLayout, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('event reader strips ANSI color escapes around structured JSON', () => {
  const log = '{"cache":{"operation":"get","tier":"artifact","durationMs":1}}\u001b[0m';
  assert.deepEqual(profiler.parseCacheEvents(log), [
    { operation: 'get', tier: 'artifact', durationMs: 1 },
  ]);
});
