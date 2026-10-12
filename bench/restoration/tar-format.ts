/**
 * Describe tar header fields, entry flags and numeric encodings.
 * Named format values make parser checks and synthetic archive construction
 * readable. Imported by profiling and its fixtures; this module is not a command.
 */

import { constants } from 'node:fs';
import { FilePermissions } from '../../src/filesystem.js';

export const TAR_BLOCK_BYTES = 512;
export const TAR_TERMINATOR_BYTES = 2 * TAR_BLOCK_BYTES;
export const OCTAL_RADIX = 8;
export const BYTE_VALUE_RANGE = 256;
export const SIGNED_BYTE_MAX = BYTE_VALUE_RANGE / 2 - 1;

export const Ascii = Object.freeze({
  Space: ' '.charCodeAt(0),
  LineFeed: '\n'.charCodeAt(0),
  Zero: '0'.charCodeAt(0),
  Escape: 27,
});
export const TarNumberEncoding = Object.freeze({
  BinaryFlag: 0x80,
  NegativeFlag: 0x40,
  ValueMask: 0x7f,
});
export const TarHeader = Object.freeze({
  NameStart: 0,
  NameEnd: 100,
  ModeStart: 100,
  ModeEnd: 108,
  SizeStart: 124,
  SizeEnd: 136,
  ChecksumStart: 148,
  ChecksumEnd: 156,
  TypeOffset: 156,
  MagicStart: 257,
  MagicEnd: 263,
  PrefixStart: 345,
  PrefixEnd: 500,
});
export const TarEntryType = Object.freeze({
  File: '0',
  HardLink: '1',
  SymbolicLink: '2',
  CharacterDevice: '3',
  BlockDevice: '4',
  Directory: '5',
  Fifo: '6',
  ContiguousFile: '7',
  PaxHeader: 'x',
  GlobalPaxHeader: 'g',
  GnuLongName: 'L',
  GnuLongLink: 'K',
});
export const TarEntryMode = Object.freeze({
  Directory: constants.S_IFDIR | FilePermissions.Executable,
  File: constants.S_IFREG | FilePermissions.ReadableFile,
  ExecutableFile: constants.S_IFREG | FilePermissions.Executable,
});
