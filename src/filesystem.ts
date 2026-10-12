import { constants } from 'node:fs';

const OWNER_READ_WRITE = constants.S_IRUSR | constants.S_IWUSR;
const OWNER_FULL_ACCESS = OWNER_READ_WRITE | constants.S_IXUSR;
const GROUP_READ_EXECUTE = constants.S_IRGRP | constants.S_IXGRP;
const OTHER_READ_EXECUTE = constants.S_IROTH | constants.S_IXOTH;

export const FilePermissions = Object.freeze({
  OwnerOnlyFile: OWNER_READ_WRITE,
  OwnerOnlyDirectory: OWNER_FULL_ACCESS,
  Executable: OWNER_FULL_ACCESS | GROUP_READ_EXECUTE | OTHER_READ_EXECUTE,
  ReadableFile: OWNER_READ_WRITE | constants.S_IRGRP | constants.S_IROTH,
  Mask:
    OWNER_FULL_ACCESS |
    GROUP_READ_EXECUTE |
    constants.S_IWGRP |
    OTHER_READ_EXECUTE |
    constants.S_IWOTH,
});

export const FileOpenMode = Object.freeze({
  Read: 'r',
  ExclusiveWrite: 'wx',
});
