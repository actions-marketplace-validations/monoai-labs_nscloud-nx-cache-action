#!/usr/bin/env node
import { createRequire as bundleCreateRequire } from 'node:module';
const require = bundleCreateRequire(import.meta.url);

// src/units.ts
var KIBIBYTE = 1024;
var MEBIBYTE = KIBIBYTE * KIBIBYTE;
var GIBIBYTE = MEBIBYTE * KIBIBYTE;
var SECOND_MS = 1e3;
var MINUTE_MS = 60 * SECOND_MS;
var HOUR_MS = 60 * MINUTE_MS;
var HOURS_PER_DAY = 24;
var DAY_MS = HOURS_PER_DAY * HOUR_MS;

// src/config.ts
var CacheAccess = Object.freeze({ ReadOnly: "read-only", ReadWrite: "read-write" });
var CacheFailureMode = Object.freeze({ FailOpen: "fail-open", Strict: "strict" });
var DEFAULT_MAX_DISK_BYTES = 10 * GIBIBYTE;
var DEFAULT_EXTRACTION_BYTES = 2 * GIBIBYTE;
var DEFAULT_MAX_ARCHIVE_BYTES = 512 * MEBIBYTE;
var MAX_ARCHIVE_METADATA_BYTES = 4 * KIBIBYTE;
var DEFAULT_RETENTION_HOURS = 7 * HOURS_PER_DAY;
var DEFAULT_RETENTION_MS = DEFAULT_RETENTION_HOURS * HOUR_MS;
var DEFAULT_LOCAL_DISK_BYTES = DEFAULT_MAX_DISK_BYTES - DEFAULT_EXTRACTION_BYTES;

// src/process-constants.ts
import { constants } from "node:os";
var ProcessSignal = Object.freeze({
  Interrupt: "SIGINT",
  Terminate: "SIGTERM",
  Kill: "SIGKILL"
});
var PROCESS_EXISTENCE_PROBE = 0;
var NODE_USER_ARGUMENT_OFFSET = 2;
var SIGNAL_EXIT_CODE_BASE = 128;
var ExitCode = Object.freeze({
  Success: 0,
  Failure: 1,
  Interrupted: SIGNAL_EXIT_CODE_BASE + constants.signals.SIGINT,
  Terminated: SIGNAL_EXIT_CODE_BASE + constants.signals.SIGTERM
});

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/code.js
var Code;
(function(Code2) {
  Code2[Code2["Canceled"] = 1] = "Canceled";
  Code2[Code2["Unknown"] = 2] = "Unknown";
  Code2[Code2["InvalidArgument"] = 3] = "InvalidArgument";
  Code2[Code2["DeadlineExceeded"] = 4] = "DeadlineExceeded";
  Code2[Code2["NotFound"] = 5] = "NotFound";
  Code2[Code2["AlreadyExists"] = 6] = "AlreadyExists";
  Code2[Code2["PermissionDenied"] = 7] = "PermissionDenied";
  Code2[Code2["ResourceExhausted"] = 8] = "ResourceExhausted";
  Code2[Code2["FailedPrecondition"] = 9] = "FailedPrecondition";
  Code2[Code2["Aborted"] = 10] = "Aborted";
  Code2[Code2["OutOfRange"] = 11] = "OutOfRange";
  Code2[Code2["Unimplemented"] = 12] = "Unimplemented";
  Code2[Code2["Internal"] = 13] = "Internal";
  Code2[Code2["Unavailable"] = 14] = "Unavailable";
  Code2[Code2["DataLoss"] = 15] = "DataLoss";
  Code2[Code2["Unauthenticated"] = 16] = "Unauthenticated";
})(Code || (Code = {}));

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/is-message.js
function isMessage(arg, schema) {
  const isMessage2 = arg !== null && typeof arg == "object" && "$typeName" in arg && typeof arg.$typeName == "string";
  if (!isMessage2) {
    return false;
  }
  if (schema === void 0) {
    return true;
  }
  return schema.typeName === arg.$typeName;
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js
var ScalarType;
(function(ScalarType2) {
  ScalarType2[ScalarType2["DOUBLE"] = 1] = "DOUBLE";
  ScalarType2[ScalarType2["FLOAT"] = 2] = "FLOAT";
  ScalarType2[ScalarType2["INT64"] = 3] = "INT64";
  ScalarType2[ScalarType2["UINT64"] = 4] = "UINT64";
  ScalarType2[ScalarType2["INT32"] = 5] = "INT32";
  ScalarType2[ScalarType2["FIXED64"] = 6] = "FIXED64";
  ScalarType2[ScalarType2["FIXED32"] = 7] = "FIXED32";
  ScalarType2[ScalarType2["BOOL"] = 8] = "BOOL";
  ScalarType2[ScalarType2["STRING"] = 9] = "STRING";
  ScalarType2[ScalarType2["BYTES"] = 12] = "BYTES";
  ScalarType2[ScalarType2["UINT32"] = 13] = "UINT32";
  ScalarType2[ScalarType2["SFIXED32"] = 15] = "SFIXED32";
  ScalarType2[ScalarType2["SFIXED64"] = 16] = "SFIXED64";
  ScalarType2[ScalarType2["SINT32"] = 17] = "SINT32";
  ScalarType2[ScalarType2["SINT64"] = 18] = "SINT64";
})(ScalarType || (ScalarType = {}));

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js
function varint64read() {
  const buf = this.buf;
  let pos = this.pos;
  let lo = 0;
  let hi = 0;
  for (let shift = 0; shift < 28; shift += 7) {
    const b = buf[pos++];
    lo |= (b & 127) << shift;
    if ((b & 128) == 0) {
      this.pos = pos;
      this.assertBounds();
      this.varint64Lo = lo;
      this.varint64Hi = hi;
      return;
    }
  }
  const middleByte = buf[pos++];
  lo |= (middleByte & 15) << 28;
  hi = (middleByte & 112) >> 4;
  if ((middleByte & 128) == 0) {
    this.pos = pos;
    this.assertBounds();
    this.varint64Lo = lo;
    this.varint64Hi = hi;
    return;
  }
  for (let shift = 3; shift <= 31; shift += 7) {
    const b = buf[pos++];
    hi |= (b & 127) << shift;
    if ((b & 128) == 0) {
      this.pos = pos;
      this.assertBounds();
      this.varint64Lo = lo;
      this.varint64Hi = hi;
      return;
    }
  }
  throw new Error("invalid varint");
}
var TWO_PWR_32_DBL = 4294967296;
function int64FromString(dec) {
  const minus = dec[0] === "-";
  if (minus) {
    dec = dec.slice(1);
  }
  const base = 1e6;
  let lowBits = 0;
  let highBits = 0;
  function add1e6digit(begin, end) {
    const digit1e6 = Number(dec.slice(begin, end));
    highBits *= base;
    lowBits = lowBits * base + digit1e6;
    if (lowBits >= TWO_PWR_32_DBL) {
      highBits = highBits + (lowBits / TWO_PWR_32_DBL | 0);
      lowBits = lowBits % TWO_PWR_32_DBL;
    }
  }
  add1e6digit(-24, -18);
  add1e6digit(-18, -12);
  add1e6digit(-12, -6);
  add1e6digit(-6);
  return minus ? negate(lowBits, highBits) : newBits(lowBits, highBits);
}
function int64ToString(lo, hi) {
  let bits = newBits(lo, hi);
  const negative = bits.hi & 2147483648;
  if (negative) {
    bits = negate(bits.lo, bits.hi);
  }
  const result = uInt64ToString(bits.lo, bits.hi);
  return negative ? "-" + result : result;
}
function uInt64ToString(lo, hi) {
  ({ lo, hi } = toUnsigned(lo, hi));
  if (hi <= 2097151) {
    return String(TWO_PWR_32_DBL * hi + lo);
  }
  const low = lo & 16777215;
  const mid = (lo >>> 24 | hi << 8) & 16777215;
  const high = hi >> 16 & 65535;
  let digitA = low + mid * 6777216 + high * 6710656;
  let digitB = mid + high * 8147497;
  let digitC = high * 2;
  const base = 1e7;
  if (digitA >= base) {
    digitB += Math.floor(digitA / base);
    digitA %= base;
  }
  if (digitB >= base) {
    digitC += Math.floor(digitB / base);
    digitB %= base;
  }
  return digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) + decimalFrom1e7WithLeadingZeros(digitA);
}
function toUnsigned(lo, hi) {
  return { lo: lo >>> 0, hi: hi >>> 0 };
}
function newBits(lo, hi) {
  return { lo: lo | 0, hi: hi | 0 };
}
function negate(lowBits, highBits) {
  highBits = ~highBits;
  if (lowBits) {
    lowBits = ~lowBits + 1;
  } else {
    highBits += 1;
  }
  return newBits(lowBits, highBits);
}
var decimalFrom1e7WithLeadingZeros = (digit1e7) => {
  const partial = String(digit1e7);
  return "0000000".slice(partial.length) + partial;
};
function varint32write(value, bytes) {
  if (value >>> 0 < 128) {
    bytes.push(value);
    return;
  }
  if (value >= 0) {
    while (value > 127) {
      bytes.push(value & 127 | 128);
      value = value >>> 7;
    }
    bytes.push(value);
  } else {
    for (let i = 0; i < 9; i++) {
      bytes.push(value & 127 | 128);
      value = value >> 7;
    }
    bytes.push(1);
  }
}
function varint32read() {
  let b = this.buf[this.pos++];
  if ((b & 128) === 0) {
    this.assertBounds();
    return b;
  }
  let result = b & 127;
  b = this.buf[this.pos++];
  result |= (b & 127) << 7;
  if ((b & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 14;
  if ((b & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 21;
  if ((b & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 15) << 28;
  for (let readBytes = 5; (b & 128) !== 0 && readBytes < 10; readBytes++)
    b = this.buf[this.pos++];
  if ((b & 128) !== 0)
    throw new Error("invalid varint");
  this.assertBounds();
  return result >>> 0;
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js
var protoInt64 = /* @__PURE__ */ makeInt64Support();
function makeInt64Support() {
  const dv = new DataView(new ArrayBuffer(8));
  const ok = typeof BigInt === "function" && typeof dv.getBigInt64 === "function" && typeof dv.getBigUint64 === "function" && typeof dv.setBigInt64 === "function" && typeof dv.setBigUint64 === "function" && (!!globalThis.Deno || !!globalThis.Bun || typeof process != "object" || typeof process.env != "object" || process.env.BUF_BIGINT_DISABLE !== "1");
  if (ok) {
    const MIN = BigInt("-9223372036854775808");
    const MAX = BigInt("9223372036854775807");
    const UMIN = BigInt("0");
    const UMAX = BigInt("18446744073709551615");
    return {
      zero: BigInt(0),
      supported: true,
      parse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > MAX || bi < MIN) {
          throw new Error(`invalid int64: ${value}`);
        }
        return bi;
      },
      uParse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > UMAX || bi < UMIN) {
          throw new Error(`invalid uint64: ${value}`);
        }
        return bi;
      },
      enc(value) {
        dv.setBigInt64(0, this.parse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      uEnc(value) {
        dv.setBigInt64(0, this.uParse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      dec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigInt64(0, true);
      },
      uDec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigUint64(0, true);
      }
    };
  }
  return {
    zero: "0",
    supported: false,
    parse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return value;
    },
    uParse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return value;
    },
    enc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return int64FromString(value);
    },
    uEnc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return int64FromString(value);
    },
    dec(lo, hi) {
      return int64ToString(lo, hi);
    },
    uDec(lo, hi) {
      return uInt64ToString(lo, hi);
    }
  };
}
function assertInt64String(value) {
  if (!/^-?[0-9]+$/.test(value)) {
    throw new Error("invalid int64: " + value);
  }
}
function assertUInt64String(value) {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error("invalid uint64: " + value);
  }
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js
function scalarZeroValue(type, longAsString) {
  switch (type) {
    case ScalarType.STRING:
      return "";
    case ScalarType.BOOL:
      return false;
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return 0;
    case ScalarType.INT64:
    case ScalarType.UINT64:
    case ScalarType.SFIXED64:
    case ScalarType.FIXED64:
    case ScalarType.SINT64:
      return longAsString ? "0" : protoInt64.zero;
    case ScalarType.BYTES:
      return new Uint8Array(0);
    default:
      return 0;
  }
}
function isScalarZeroValue(type, value) {
  switch (type) {
    case ScalarType.BOOL:
      return value === false;
    case ScalarType.STRING:
      return value === "";
    case ScalarType.BYTES:
      return value instanceof Uint8Array && !value.byteLength;
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return Object.is(value, 0);
    default:
      return value == 0;
  }
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js
var IMPLICIT = 2;
var unsafeLocal = /* @__PURE__ */ Symbol.for("reflect unsafe local");
function unsafeOneofCase(target, oneof) {
  const c = target[oneof.localName].case;
  if (c === void 0) {
    return c;
  }
  return oneof.fields.find((f) => f.localName === c);
}
function unsafeIsSet(target, field) {
  const name = field.localName;
  if (field.oneof) {
    return target[field.oneof.localName].case === name;
  }
  if (field.presence != IMPLICIT) {
    return target[name] !== void 0 && Object.prototype.hasOwnProperty.call(target, name);
  }
  switch (field.fieldKind) {
    case "list":
      return target[name].length > 0;
    case "map":
      return Object.keys(target[name]).length > 0;
    case "scalar":
      return !isScalarZeroValue(field.scalar, target[name]);
    case "enum":
      return target[name] !== field.enum.values[0].number;
  }
  throw new Error("message field with implicit presence");
}
function unsafeIsSetExplicit(target, localName) {
  return Object.prototype.hasOwnProperty.call(target, localName) && target[localName] !== void 0;
}
function unsafeGet(target, field) {
  if (field.oneof) {
    const oneof = target[field.oneof.localName];
    if (oneof.case === field.localName) {
      return oneof.value;
    }
    return void 0;
  }
  return target[field.localName];
}
function unsafeSet(target, field, value) {
  if (field.oneof) {
    target[field.oneof.localName] = {
      case: field.localName,
      value
    };
  } else {
    target[field.localName] = value;
  }
}
function unsafeClear(target, field) {
  const name = field.localName;
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    if (target[oneofLocalName].case === name) {
      target[oneofLocalName] = { case: void 0 };
    }
  } else if (field.presence != IMPLICIT) {
    delete target[name];
  } else {
    switch (field.fieldKind) {
      case "map":
        target[name] = {};
        break;
      case "list":
        target[name] = [];
        break;
      case "enum":
        target[name] = field.enum.values[0].number;
        break;
      case "scalar":
        target[name] = scalarZeroValue(field.scalar, field.longAsString);
        break;
    }
  }
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/reflect/guard.js
function isObject(arg) {
  return arg !== null && typeof arg == "object" && !Array.isArray(arg);
}
function isReflectList(arg, field) {
  var _a, _b, _c, _d;
  if (isObject(arg) && unsafeLocal in arg && "add" in arg && "field" in arg && typeof arg.field == "function") {
    if (field !== void 0) {
      const a = field;
      const b = arg.field();
      return a.listKind == b.listKind && a.scalar === b.scalar && ((_a = a.message) === null || _a === void 0 ? void 0 : _a.typeName) === ((_b = b.message) === null || _b === void 0 ? void 0 : _b.typeName) && ((_c = a.enum) === null || _c === void 0 ? void 0 : _c.typeName) === ((_d = b.enum) === null || _d === void 0 ? void 0 : _d.typeName);
    }
    return true;
  }
  return false;
}
function isReflectMap(arg, field) {
  var _a, _b, _c, _d;
  if (isObject(arg) && unsafeLocal in arg && "has" in arg && "field" in arg && typeof arg.field == "function") {
    if (field !== void 0) {
      const a = field, b = arg.field();
      return a.mapKey === b.mapKey && a.mapKind == b.mapKind && a.scalar === b.scalar && ((_a = a.message) === null || _a === void 0 ? void 0 : _a.typeName) === ((_b = b.message) === null || _b === void 0 ? void 0 : _b.typeName) && ((_c = a.enum) === null || _c === void 0 ? void 0 : _c.typeName) === ((_d = b.enum) === null || _d === void 0 ? void 0 : _d.typeName);
    }
    return true;
  }
  return false;
}
function isReflectMessage(arg, messageDesc2) {
  return isObject(arg) && unsafeLocal in arg && "desc" in arg && isObject(arg.desc) && arg.desc.kind === "message" && (messageDesc2 === void 0 || arg.desc.typeName == messageDesc2.typeName);
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js
function isWrapper(arg) {
  return isWrapperTypeName(arg.$typeName);
}
function isWrapperDesc(messageDesc2) {
  const f = messageDesc2.fields[0];
  return isWrapperTypeName(messageDesc2.typeName) && f !== void 0 && f.fieldKind == "scalar" && f.name == "value" && f.number == 1;
}
function hasCustomJsonRepresentation(desc) {
  switch (desc.typeName) {
    case "google.protobuf.Any":
    case "google.protobuf.Timestamp":
    case "google.protobuf.Duration":
    case "google.protobuf.FieldMask":
    case "google.protobuf.Struct":
    case "google.protobuf.Value":
    case "google.protobuf.ListValue":
      return true;
    default:
      return isWrapperDesc(desc);
  }
}
var wrapperTypeNames = /* @__PURE__ */ new Set([
  "google.protobuf.DoubleValue",
  "google.protobuf.FloatValue",
  "google.protobuf.Int64Value",
  "google.protobuf.UInt64Value",
  "google.protobuf.Int32Value",
  "google.protobuf.UInt32Value",
  "google.protobuf.BoolValue",
  "google.protobuf.StringValue",
  "google.protobuf.BytesValue"
]);
function isWrapperTypeName(name) {
  return wrapperTypeNames.has(name);
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/create.js
var EDITION_PROTO3 = 999;
var EDITION_PROTO2 = 998;
var IMPLICIT2 = 2;
function create(schema, init) {
  if (isMessage(init, schema)) {
    return init;
  }
  return compiledCreate(schema)(init);
}
var compiledCreates = /* @__PURE__ */ new WeakMap();
function compiledCreate(desc) {
  let compiled = compiledCreates.get(desc);
  if (compiled === void 0) {
    compiled = compileCreate(desc);
    compiledCreates.set(desc, compiled);
  }
  return compiled;
}
var INIT_SINGULAR = 0;
var INIT_LIST = 1;
var INIT_MAP = 2;
var INIT_ONEOF = 3;
function compileCreate(desc) {
  const typeName = desc.typeName;
  const { properties, prototype } = compileInitMessage(desc);
  return (init) => {
    let message;
    if (prototype !== void 0) {
      message = Object.create(prototype);
      message.$typeName = typeName;
    } else {
      message = { $typeName: typeName };
    }
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      const name = property.name;
      const initValue = init === null || init === void 0 ? void 0 : init[name];
      switch (property.kind) {
        case INIT_SINGULAR:
          if (initValue != null) {
            message[name] = property.convert !== void 0 ? property.convert(initValue) : initValue;
          } else if (property.constant !== void 0) {
            message[name] = property.constant;
          }
          break;
        case INIT_LIST:
          message[name] = property.convert !== void 0 && Array.isArray(initValue) ? initValue.map(property.convert) : initValue !== null && initValue !== void 0 ? initValue : [];
          break;
        case INIT_MAP:
          if (property.convert === void 0 || !isObject(initValue)) {
            message[name] = initValue !== null && initValue !== void 0 ? initValue : {};
          } else {
            const converted = {};
            const keys = Object.keys(initValue);
            for (let k = 0; k < keys.length; k++) {
              converted[keys[k]] = property.convert(initValue[keys[k]]);
            }
            message[name] = converted;
          }
          break;
        case INIT_ONEOF: {
          const oneofValue = initValue;
          if ((oneofValue === null || oneofValue === void 0 ? void 0 : oneofValue.case) != null) {
            const convert = property.convert.get(oneofValue.case);
            if (convert !== void 0) {
              message[name] = {
                case: oneofValue.case,
                value: convert(oneofValue.value)
              };
              break;
            }
          }
          message[name] = { case: void 0 };
          break;
        }
      }
    }
    return message;
  };
}
function compileInitMessage(desc) {
  var _a, _b;
  const properties = [];
  const prototype = {};
  const usePrototype = needsPrototypeChain(desc);
  for (const member of desc.members) {
    const name = member.localName;
    if (member.kind == "oneof") {
      properties.push({
        name,
        kind: INIT_ONEOF,
        constant: void 0,
        convert: compileConvertOneof(member)
      });
      continue;
    }
    switch (member.fieldKind) {
      case "message": {
        properties.push({
          name,
          kind: INIT_SINGULAR,
          constant: void 0,
          convert: compileConvertMessage(member)
        });
        break;
      }
      case "list": {
        properties.push({
          name,
          kind: INIT_LIST,
          constant: void 0,
          convert: member.listKind == "message" ? (_a = compileConvertMessage(member)) !== null && _a !== void 0 ? _a : ((value) => value) : member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        });
        break;
      }
      case "map": {
        properties.push({
          name,
          kind: INIT_MAP,
          constant: void 0,
          convert: member.mapKind == "message" ? (_b = compileConvertMessage(member)) !== null && _b !== void 0 ? _b : ((value) => value) : member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        });
        break;
      }
      default: {
        const zeroValue = createZeroValue(member);
        properties.push({
          name,
          kind: INIT_SINGULAR,
          constant: member.presence == IMPLICIT2 ? zeroValue : void 0,
          convert: member.fieldKind == "scalar" && member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        });
        if (usePrototype) {
          prototype[name] = zeroValue;
        }
        break;
      }
    }
  }
  return {
    properties,
    prototype: usePrototype ? prototype : void 0
  };
}
function compileConvertOneof(oneof) {
  const converters = /* @__PURE__ */ new Map();
  for (const field of oneof.fields) {
    let convert;
    if (field.fieldKind == "message") {
      convert = compileConvertMessage(field);
    } else if (field.fieldKind == "scalar" && field.scalar == ScalarType.BYTES) {
      convert = toU8Arr;
    }
    converters.set(field.localName, convert !== null && convert !== void 0 ? convert : ((value) => value));
  }
  return converters;
}
function compileConvertMessage(field) {
  if (field.fieldKind == "message" && !field.oneof && isWrapperDesc(field.message)) {
    return field.message.fields[0].scalar == ScalarType.BYTES ? toU8Arr : void 0;
  }
  if (field.message.typeName == "google.protobuf.Struct" && field.parent.typeName !== "google.protobuf.Value") {
    return void 0;
  }
  const messageDesc2 = field.message;
  let compiled;
  return (value) => {
    if (!isObject(value) || isMessage(value, messageDesc2)) {
      return value;
    }
    compiled !== null && compiled !== void 0 ? compiled : compiled = compiledCreate(messageDesc2);
    return compiled(value);
  };
}
function toU8Arr(value) {
  return Array.isArray(value) ? new Uint8Array(value) : value;
}
function needsPrototypeChain(desc) {
  switch (desc.file.edition) {
    case EDITION_PROTO3:
      return false;
    case EDITION_PROTO2:
      return true;
    default:
      return desc.fields.some((f) => f.presence != IMPLICIT2 && f.fieldKind != "message" && !f.oneof);
  }
}
function createZeroValue(field) {
  const defaultValue = field.getDefaultValue();
  if (defaultValue !== void 0) {
    return field.fieldKind == "scalar" && field.longAsString ? defaultValue.toString() : defaultValue;
  }
  return field.fieldKind == "scalar" ? scalarZeroValue(field.scalar, field.longAsString) : field.enum.values[0].number;
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/reflect/error.js
var errorNames = [
  "FieldValueInvalidError",
  "FieldListRangeError",
  "ForeignFieldError"
];
var FieldError = class extends Error {
  constructor(fieldOrOneof, message, name = "FieldValueInvalidError") {
    super(message);
    this.name = name;
    this.field = () => fieldOrOneof;
  }
};
function isFieldError(arg) {
  return arg instanceof Error && errorNames.includes(arg.name) && "field" in arg && typeof arg.field == "function";
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js
var te;
function configureTextEncoding(textEncoding) {
  var _a;
  te = Object.assign(Object.assign({}, textEncoding), { encodeUtf8Into: (_a = textEncoding.encodeUtf8Into) !== null && _a !== void 0 ? _a : emulateEncodeInto(textEncoding.encodeUtf8.bind(textEncoding)) });
}
function getTextEncoding() {
  if (!te) {
    const globals = globalThis;
    if (!globals.TextEncoder || !globals.TextDecoder) {
      throw new Error("encoding API missing: install TextEncoder and TextDecoder on globalThis");
    }
    const textEncoder = new globals.TextEncoder();
    const textDecoder = new globals.TextDecoder();
    let textDecoderStrict;
    const config = {
      encodeUtf8(text) {
        return textEncoder.encode(text);
      },
      decodeUtf8(bytes, strict) {
        if (strict) {
          if (!textDecoderStrict) {
            textDecoderStrict = new globals.TextDecoder("utf-8", {
              fatal: true
            });
          }
          return textDecoderStrict.decode(bytes);
        }
        return textDecoder.decode(bytes);
      },
      checkUtf8(text) {
        try {
          encodeURIComponent(text);
          return true;
        } catch (_) {
          return false;
        }
      }
    };
    if (textEncoder.encodeInto) {
      config.encodeUtf8Into = textEncoder.encodeInto.bind(textEncoder);
    }
    const nativeStringIsWellFormed = String.prototype.isWellFormed;
    if (nativeStringIsWellFormed) {
      config.checkUtf8 = (text) => {
        return nativeStringIsWellFormed.call(text);
      };
    }
    configureTextEncoding(config);
  }
  return te;
}
function emulateEncodeInto(encodeUtf8) {
  return (text, dest) => {
    const bytes = encodeUtf8(text);
    dest.set(bytes);
    return { written: bytes.byteLength };
  };
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js
var WireType;
(function(WireType2) {
  WireType2[WireType2["Varint"] = 0] = "Varint";
  WireType2[WireType2["Bit64"] = 1] = "Bit64";
  WireType2[WireType2["LengthDelimited"] = 2] = "LengthDelimited";
  WireType2[WireType2["StartGroup"] = 3] = "StartGroup";
  WireType2[WireType2["EndGroup"] = 4] = "EndGroup";
  WireType2[WireType2["Bit32"] = 5] = "Bit32";
})(WireType || (WireType = {}));
var FLOAT32_MAX = 34028234663852886e22;
var FLOAT32_MIN = -34028234663852886e22;
var UINT32_MAX = 4294967295;
var INT32_MAX = 2147483647;
var INT32_MIN = -2147483648;
var BinaryWriter = class {
  constructor(encodeUtf8) {
    this.stackPos = [];
    this.encodeUtf8Into = encodeUtf8 ? emulateEncodeInto(encodeUtf8) : getTextEncoding().encodeUtf8Into;
    this.buffer = EMPTY_BUFFER;
    this.viewCache = EMPTY_VIEW;
    this.pos = 0;
  }
  ensureCapacity(size) {
    const required = this.pos + size;
    if (required > this.buffer.length) {
      let newLen = this.buffer.length || INITIAL_SIZE;
      while (newLen < required)
        newLen *= 2;
      const newBuf = new Uint8Array(newLen);
      if (this.pos > 0)
        newBuf.set(this.buffer);
      this.buffer = newBuf;
    }
  }
  /**
   * The DataView over `buffer`, rebuilt only if the buffer has grown since it
   * was last used.
   */
  view() {
    const bytes = this.buffer;
    const view = this.viewCache;
    if (view.byteLength === bytes.byteLength)
      return view;
    const newView = new DataView(bytes.buffer);
    this.viewCache = newView;
    return newView;
  }
  /**
   * Return all bytes written and reset this writer.
   */
  finish() {
    const result = this.buffer.slice(0, this.pos);
    this.pos = 0;
    this.stackPos = [];
    return result;
  }
  /**
   * Start a new fork for length-delimited data like a message
   * or a packed repeated field.
   *
   * Must be joined later with `join()`.
   */
  fork() {
    this.stackPos.push(this.pos);
    this.ensureCapacity(DEFAULT_LEN_PREFIX_SIZE);
    this.buffer[this.pos++] = 0;
    return this;
  }
  /**
   * Join the last fork. Write its length and bytes, then
   * return to the previous state.
   */
  join() {
    const forkPos = this.stackPos.pop();
    if (forkPos === void 0)
      throw new Error("invalid state, fork stack empty");
    const len = this.pos - forkPos - DEFAULT_LEN_PREFIX_SIZE;
    const lenPrefixSize = varint32Size(len);
    if (lenPrefixSize > DEFAULT_LEN_PREFIX_SIZE) {
      this.ensureCapacity(lenPrefixSize - DEFAULT_LEN_PREFIX_SIZE);
      this.buffer.copyWithin(forkPos + lenPrefixSize, forkPos + DEFAULT_LEN_PREFIX_SIZE, this.pos);
    }
    this.pos = forkPos;
    this.uint32(len);
    this.pos += len;
    return this;
  }
  /**
   * Writes a tag (field number and wire type).
   *
   * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
   *
   * Generated code should compute the tag ahead of time and call `uint32()`.
   */
  tag(fieldNo, type) {
    return this.uint32((fieldNo << 3 | type) >>> 0);
  }
  /**
   * Write a chunk of raw bytes.
   */
  raw(chunk) {
    this.ensureCapacity(chunk.length);
    this.buffer.set(chunk, this.pos);
    this.pos += chunk.length;
    return this;
  }
  /**
   * Write a `uint32` value, an unsigned 32 bit varint.
   */
  uint32(value) {
    assertUInt32(value);
    this.ensureCapacity(5);
    if (value < 128) {
      this.buffer[this.pos++] = value;
      return this;
    }
    while (value > 127) {
      this.buffer[this.pos++] = value & 127 | 128;
      value >>>= 7;
    }
    this.buffer[this.pos++] = value;
    return this;
  }
  /**
   * Write a `int32` value, a signed 32 bit varint.
   */
  int32(value) {
    assertInt32(value);
    if (value >= 0) {
      return this.uint32(value);
    }
    this.ensureCapacity(10);
    for (let i = 0; i < 9; i++) {
      this.buffer[this.pos++] = value & 127 | 128;
      value >>= 7;
    }
    this.buffer[this.pos++] = 1;
    return this;
  }
  /**
   * Write a `bool` value, a varint.
   */
  bool(value) {
    this.ensureCapacity(1);
    this.buffer[this.pos++] = value ? 1 : 0;
    return this;
  }
  /**
   * Write a `bytes` value, length-delimited arbitrary data.
   */
  bytes(value) {
    this.uint32(value.byteLength);
    return this.raw(value);
  }
  /**
   * Write a `string` value, length-delimited data converted to UTF-8 text.
   */
  string(value) {
    if (typeof value !== "string") {
      value = String(value);
    }
    const len = value.length;
    if (len <= ASCII_MAX_LENGTH) {
      this.ensureCapacity(len + 1);
      const ascii = this.buffer;
      let pos = this.pos;
      ascii[pos++] = len;
      let i = 0;
      for (; i < len; i++) {
        const code = value.charCodeAt(i);
        if (code > 127)
          break;
        ascii[pos++] = code;
      }
      if (i == len) {
        this.pos = pos;
        return this;
      }
    }
    this.ensureCapacity(len * 3 + 5);
    const lenPrefixSizeGuess = varint32Size(len);
    const buf = this.buffer;
    const start = this.pos;
    const { written } = this.encodeUtf8Into(value, buf.subarray(start + lenPrefixSizeGuess));
    const lenPrefixSize = varint32Size(written);
    if (lenPrefixSize != lenPrefixSizeGuess) {
      buf.copyWithin(start + lenPrefixSize, start + lenPrefixSizeGuess, start + lenPrefixSizeGuess + written);
    }
    this.uint32(written);
    this.pos += written;
    return this;
  }
  /**
   * Write a `float` value, 32-bit floating point number.
   */
  float(value) {
    assertFloat32(value);
    this.ensureCapacity(4);
    this.view().setFloat32(this.pos, value, true);
    this.pos += 4;
    return this;
  }
  /**
   * Write a `double` value, a 64-bit floating point number.
   */
  double(value) {
    this.ensureCapacity(8);
    this.view().setFloat64(this.pos, value, true);
    this.pos += 8;
    return this;
  }
  /**
   * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
   */
  fixed32(value) {
    assertUInt32(value);
    this.ensureCapacity(4);
    this.view().setUint32(this.pos, value, true);
    this.pos += 4;
    return this;
  }
  /**
   * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
   */
  sfixed32(value) {
    assertInt32(value);
    this.ensureCapacity(4);
    this.view().setInt32(this.pos, value, true);
    this.pos += 4;
    return this;
  }
  /**
   * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
   */
  sint32(value) {
    assertInt32(value);
    return this.uint32((value << 1 ^ value >> 31) >>> 0);
  }
  /**
   * Write a `sfixed64` value, a signed, fixed-length 64-bit integer.
   */
  sfixed64(value) {
    const tc = protoInt64.enc(value);
    this.ensureCapacity(8);
    const view = this.view();
    view.setInt32(this.pos, tc.lo, true);
    view.setInt32(this.pos + 4, tc.hi, true);
    this.pos += 8;
    return this;
  }
  /**
   * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
   */
  fixed64(value) {
    const tc = protoInt64.uEnc(value);
    this.ensureCapacity(8);
    const view = this.view();
    view.setInt32(this.pos, tc.lo, true);
    view.setInt32(this.pos + 4, tc.hi, true);
    this.pos += 8;
    return this;
  }
  /**
   * Write a `int64` value, a signed 64-bit varint.
   */
  int64(value) {
    const tc = protoInt64.enc(value);
    return this.writeVarint64(tc.lo, tc.hi);
  }
  /**
   * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64(value) {
    const tc = protoInt64.enc(value), sign = tc.hi >> 31, lo = tc.lo << 1 ^ sign, hi = (tc.hi << 1 | tc.lo >>> 31) ^ sign;
    return this.writeVarint64(lo, hi);
  }
  /**
   * Write a `uint64` value, an unsigned 64-bit varint.
   */
  uint64(value) {
    const tc = protoInt64.uEnc(value);
    return this.writeVarint64(tc.lo, tc.hi);
  }
  /**
   * Write a 64-bit varint directly into the buffer. Accepts the value as
   * split low/high 32-bit words.
   *
   * Ported from varint64write() to avoid the intermediate number[] buffer.
   * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/writer.js#L344
   */
  writeVarint64(lo, hi) {
    this.ensureCapacity(10);
    const buf = this.buffer;
    let pos = this.pos;
    for (let i = 0; i < 28; i = i + 7) {
      const shift = lo >>> i;
      const hasNext = !(shift >>> 7 == 0 && hi == 0);
      buf[pos++] = (hasNext ? shift | 128 : shift) & 255;
      if (!hasNext) {
        this.pos = pos;
        return this;
      }
    }
    const splitBits = lo >>> 28 & 15 | (hi & 7) << 4;
    const hasMoreBits = !(hi >> 3 == 0);
    buf[pos++] = (hasMoreBits ? splitBits | 128 : splitBits) & 255;
    if (!hasMoreBits) {
      this.pos = pos;
      return this;
    }
    for (let i = 3; i < 31; i = i + 7) {
      const shift = hi >>> i;
      const hasNext = !(shift >>> 7 == 0);
      buf[pos++] = (hasNext ? shift | 128 : shift) & 255;
      if (!hasNext) {
        this.pos = pos;
        return this;
      }
    }
    buf[pos++] = hi >>> 31 & 1;
    this.pos = pos;
    return this;
  }
};
var INITIAL_SIZE = 128;
var DEFAULT_LEN_PREFIX_SIZE = 1;
var EMPTY_BUFFER = new Uint8Array(0);
var EMPTY_VIEW = new DataView(EMPTY_BUFFER.buffer);
var ASCII_MAX_LENGTH = 32;
function varint32Size(value) {
  if (value < 128)
    return 1;
  if (value < 16384)
    return 2;
  if (value < 2097152)
    return 3;
  if (value < 268435456)
    return 4;
  return 5;
}
var BinaryReader = class {
  constructor(buf, decodeUtf8 = getTextEncoding().decodeUtf8) {
    this.decodeUtf8 = decodeUtf8;
    this.varint64Lo = 0;
    this.varint64Hi = 0;
    this.varint64 = varint64read;
    this.uint32 = varint32read;
    this.buf = buf;
    this.len = buf.length;
    this.pos = 0;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  /**
   * Reads a tag - field number and wire type. Tags are uint32 varints; values
   * that do not fit in uint32 are rejected.
   */
  tag() {
    const start = this.pos;
    const tag = this.uint32();
    const bytesRead = this.pos - start;
    if (bytesRead > 5 || bytesRead == 5 && this.buf[this.pos - 1] > 15) {
      throw new Error("illegal tag: varint overflows uint32");
    }
    const fieldNo = tag >>> 3;
    const wireType = tag & 7;
    if (fieldNo <= 0 || wireType > 5) {
      throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
    }
    return [fieldNo, wireType];
  }
  /**
   * Skip one element and return the skipped data.
   *
   * When skipping StartGroup, provide the tags field number to check for
   * matching field number in the EndGroup tag. Recursion into nested groups
   * is guarded by the `recursionLimit` argument: When the limit is reached,
   * this method throws.
   */
  skip(wireType, fieldNo, recursionLimit = 100) {
    let start = this.pos;
    switch (wireType) {
      case WireType.Varint:
        while (this.buf[this.pos++] & 128) {
        }
        break;
      // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
      case WireType.Bit64:
        this.pos += 4;
      case WireType.Bit32:
        this.pos += 4;
        break;
      case WireType.LengthDelimited:
        let len = this.uint32();
        this.pos += len;
        break;
      case WireType.StartGroup:
        if (recursionLimit <= 0) {
          throw new Error("maximum recursion depth reached");
        }
        for (; ; ) {
          const [fn, wt] = this.tag();
          if (wt === WireType.EndGroup) {
            if (fieldNo !== void 0 && fn !== fieldNo) {
              throw new Error("invalid end group tag");
            }
            break;
          }
          this.skip(wt, fn, recursionLimit - 1);
        }
        break;
      default:
        throw new Error("cant skip wire type " + wireType);
    }
    this.assertBounds();
    return this.buf.subarray(start, this.pos);
  }
  /**
   * Throws error if position in byte array is out of range.
   */
  assertBounds() {
    if (this.pos > this.len)
      throw new RangeError("premature EOF");
  }
  /**
   * Read a `int32` field, a signed 32 bit varint.
   */
  int32() {
    return this.uint32() | 0;
  }
  /**
   * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
   */
  sint32() {
    let zze = this.uint32();
    return zze >>> 1 ^ -(zze & 1);
  }
  /**
   * Read a `int64` field, a signed 64-bit varint.
   */
  int64() {
    this.varint64();
    return protoInt64.dec(this.varint64Lo, this.varint64Hi);
  }
  /**
   * Read a `uint64` field, an unsigned 64-bit varint.
   */
  uint64() {
    this.varint64();
    return protoInt64.uDec(this.varint64Lo, this.varint64Hi);
  }
  /**
   * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64() {
    this.varint64();
    let lo = this.varint64Lo;
    let hi = this.varint64Hi;
    let s = -(lo & 1);
    lo = (lo >>> 1 | (hi & 1) << 31) ^ s;
    hi = hi >>> 1 ^ s;
    return protoInt64.dec(lo, hi);
  }
  /**
   * Read a `bool` field, a variant.
   */
  bool() {
    const b = this.buf[this.pos];
    if (b < 128) {
      this.pos++;
      return b !== 0;
    }
    this.varint64();
    return this.varint64Lo !== 0 || this.varint64Hi !== 0;
  }
  /**
   * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
   */
  fixed32() {
    return this.view.getUint32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
   */
  sfixed32() {
    return this.view.getInt32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
   */
  fixed64() {
    return protoInt64.uDec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
   */
  sfixed64() {
    return protoInt64.dec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `float` field, 32-bit floating point number.
   */
  float() {
    return this.view.getFloat32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `double` field, a 64-bit floating point number.
   */
  double() {
    return this.view.getFloat64((this.pos += 8) - 8, true);
  }
  /**
   * Read a `bytes` field, length-delimited arbitrary data.
   */
  bytes() {
    let len = this.uint32(), start = this.pos;
    this.pos += len;
    this.assertBounds();
    return this.buf.subarray(start, start + len);
  }
  /**
   * Read a `string` field, length-delimited data converted to UTF-8 text. If
   * `strict` is true, throw on invalid UTF-8 instead of substituting U+FFFD.
   */
  string(strict) {
    const bytes = this.bytes();
    const len = bytes.length;
    if (len <= ASCII_MAX_LENGTH) {
      const codes = new Array(len);
      for (let i = 0; i < len; i++) {
        const byte = bytes[i];
        if (byte > 127) {
          return this.decodeUtf8(bytes, strict);
        }
        codes[i] = byte;
      }
      return String.fromCharCode.apply(String, codes);
    }
    return this.decodeUtf8(bytes, strict);
  }
};
function assertInt32(arg) {
  if (typeof arg == "string") {
    arg = Number(arg);
  } else if (typeof arg != "number") {
    throw new Error("invalid int32: " + typeof arg);
  }
  if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN)
    throw new Error("invalid int32: " + arg);
}
function assertUInt32(arg) {
  if (typeof arg == "string") {
    arg = Number(arg);
  } else if (typeof arg != "number") {
    throw new Error("invalid uint32: " + typeof arg);
  }
  if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0)
    throw new Error("invalid uint32: " + arg);
}
function assertFloat32(arg) {
  if (typeof arg == "string") {
    const o = arg;
    arg = Number(arg);
    if (Number.isNaN(arg) && o !== "NaN") {
      throw new Error("invalid float32: " + o);
    }
  } else if (typeof arg != "number") {
    throw new Error("invalid float32: " + typeof arg);
  }
  if (Number.isFinite(arg) && (arg > FLOAT32_MAX || arg < FLOAT32_MIN))
    throw new Error("invalid float32: " + arg);
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect-check.js
function checkField(field, value) {
  const check = field.fieldKind == "list" ? isReflectList(value, field) : field.fieldKind == "map" ? isReflectMap(value, field) : checkSingular(field, value);
  if (check === true) {
    return void 0;
  }
  let reason;
  switch (field.fieldKind) {
    case "list":
      reason = `expected ${formatReflectList(field)}, got ${formatVal(value)}`;
      break;
    case "map":
      reason = `expected ${formatReflectMap(field)}, got ${formatVal(value)}`;
      break;
    default: {
      reason = reasonSingular(field, value, check);
    }
  }
  return new FieldError(field, reason);
}
function checkListItem(field, index, value) {
  const check = checkSingular(field, value);
  if (check !== true) {
    return new FieldError(field, `list item #${index + 1}: ${reasonSingular(field, value, check)}`);
  }
  return void 0;
}
function checkMapEntry(field, key, value) {
  const checkKey = checkScalarValue(field.mapKey)(key);
  if (checkKey !== true) {
    return new FieldError(field, `invalid map key: ${reasonSingular({ scalar: field.mapKey }, key, checkKey)}`);
  }
  const checkVal = checkSingular(field, value);
  if (checkVal !== true) {
    return new FieldError(field, `map entry ${formatVal(key)}: ${reasonSingular(field, value, checkVal)}`);
  }
  return void 0;
}
function checkSingular(field, value) {
  if (field.scalar !== void 0) {
    return checkScalarValue(field.scalar)(value);
  }
  if (field.enum !== void 0) {
    if (field.enum.open) {
      return checkScalarValue(ScalarType.INT32)(value);
    }
    return field.enum.values.some((v) => v.number === value);
  }
  return isReflectMessage(value, field.message);
}
function checkScalarValue(scalar) {
  switch (scalar) {
    case ScalarType.DOUBLE:
      return (value) => typeof value == "number";
    case ScalarType.FLOAT:
      return (value) => {
        if (typeof value != "number") {
          return false;
        }
        if (Number.isNaN(value) || !Number.isFinite(value)) {
          return true;
        }
        if (value > FLOAT32_MAX || value < FLOAT32_MIN) {
          return `${value.toFixed()} out of range`;
        }
        return true;
      };
    case ScalarType.INT32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32:
      return (value) => {
        if (typeof value !== "number" || !Number.isInteger(value)) {
          return false;
        }
        if (value > INT32_MAX || value < INT32_MIN) {
          return `${value.toFixed()} out of range`;
        }
        return true;
      };
    case ScalarType.FIXED32:
    case ScalarType.UINT32:
      return (value) => {
        if (typeof value !== "number" || !Number.isInteger(value)) {
          return false;
        }
        if (value > UINT32_MAX || value < 0) {
          return `${value.toFixed()} out of range`;
        }
        return true;
      };
    case ScalarType.BOOL:
      return (value) => typeof value == "boolean";
    case ScalarType.STRING:
      return (value) => {
        if (typeof value != "string") {
          return false;
        }
        return getTextEncoding().checkUtf8(value) || "invalid UTF8";
      };
    case ScalarType.BYTES:
      return (value) => value instanceof Uint8Array;
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return (value) => {
        if (typeof value == "bigint" || typeof value == "number" || typeof value == "string" && value.length > 0) {
          try {
            protoInt64.parse(value);
            return true;
          } catch (_) {
            return `${value} out of range`;
          }
        }
        return false;
      };
    case ScalarType.FIXED64:
    case ScalarType.UINT64:
      return (value) => {
        if (typeof value == "bigint" || typeof value == "number" || typeof value == "string" && value.length > 0) {
          try {
            protoInt64.uParse(value);
            return true;
          } catch (_) {
            return `${value} out of range`;
          }
        }
        return false;
      };
  }
}
function reasonSingular(field, val, details) {
  details = typeof details == "string" ? `: ${details}` : `, got ${formatVal(val)}`;
  if (field.scalar !== void 0) {
    return `expected ${scalarTypeDescription(field.scalar)}` + details;
  }
  if (field.enum !== void 0) {
    return `expected ${field.enum.toString()}` + details;
  }
  return `expected ${formatReflectMessage(field.message)}` + details;
}
function formatVal(val) {
  switch (typeof val) {
    case "object":
      if (val === null) {
        return "null";
      }
      if (val instanceof Uint8Array) {
        return `Uint8Array(${val.length})`;
      }
      if (Array.isArray(val)) {
        return `Array(${val.length})`;
      }
      if (isReflectList(val)) {
        return formatReflectList(val.field());
      }
      if (isReflectMap(val)) {
        return formatReflectMap(val.field());
      }
      if (isReflectMessage(val)) {
        return formatReflectMessage(val.desc);
      }
      if (isMessage(val)) {
        return `message ${val.$typeName}`;
      }
      return "object";
    case "string":
      return val.length > 30 ? "string" : `"${val.split('"').join('\\"')}"`;
    case "boolean":
      return String(val);
    case "number":
      return String(val);
    case "bigint":
      return String(val) + "n";
    default:
      return typeof val;
  }
}
function formatReflectMessage(desc) {
  return `ReflectMessage (${desc.typeName})`;
}
function formatReflectList(field) {
  switch (field.listKind) {
    case "message":
      return `ReflectList (${field.message.toString()})`;
    case "enum":
      return `ReflectList (${field.enum.toString()})`;
    case "scalar":
      return `ReflectList (${ScalarType[field.scalar]})`;
  }
}
function formatReflectMap(field) {
  switch (field.mapKind) {
    case "message":
      return `ReflectMap (${ScalarType[field.mapKey]}, ${field.message.toString()})`;
    case "enum":
      return `ReflectMap (${ScalarType[field.mapKey]}, ${field.enum.toString()})`;
    case "scalar":
      return `ReflectMap (${ScalarType[field.mapKey]}, ${ScalarType[field.scalar]})`;
  }
}
function scalarTypeDescription(scalar) {
  switch (scalar) {
    case ScalarType.STRING:
      return "string";
    case ScalarType.BOOL:
      return "boolean";
    case ScalarType.INT64:
    case ScalarType.SINT64:
    case ScalarType.SFIXED64:
      return "bigint (int64)";
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return "bigint (uint64)";
    case ScalarType.BYTES:
      return "Uint8Array";
    case ScalarType.DOUBLE:
      return "number (float64)";
    case ScalarType.FLOAT:
      return "number (float32)";
    case ScalarType.FIXED32:
    case ScalarType.UINT32:
      return "number (uint32)";
    case ScalarType.INT32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32:
      return "number (int32)";
  }
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/reflect/message.js
var NULL_VALUE = 0;
function localMessageMapper(field) {
  if (usesJsonRepresentation(field)) {
    return {
      toMessage: (local) => wktStructToReflect(local),
      toLocal: (message) => wktStructToLocal(message)
    };
  }
  if (field.fieldKind == "message" && !field.oneof && isWrapperDesc(field.message)) {
    const wrapperDesc = field.message;
    const valueLocalName = wrapperDesc.fields[0].localName;
    return {
      toMessage: (local) => {
        const message = create(wrapperDesc);
        if (local !== void 0) {
          message[valueLocalName] = local;
        }
        return message;
      },
      toLocal: (message) => message[valueLocalName]
    };
  }
  const childDesc = field.message;
  return {
    toMessage: (local) => local === void 0 ? create(childDesc) : local,
    toLocal: (message) => message
  };
}
function usesJsonRepresentation(field) {
  return field.message.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value";
}
function wktStructToReflect(json) {
  const struct = {
    $typeName: "google.protobuf.Struct",
    fields: {}
  };
  if (isObject(json)) {
    for (const k of Object.keys(json)) {
      struct.fields[k] = wktValueToReflect(json[k]);
    }
  }
  return struct;
}
function wktStructToLocal(val) {
  const json = {};
  for (const k of Object.keys(val.fields)) {
    json[k] = wktValueToLocal(val.fields[k]);
  }
  return json;
}
function wktValueToLocal(val) {
  switch (val.kind.case) {
    case "structValue":
      return wktStructToLocal(val.kind.value);
    case "listValue":
      return val.kind.value.values.map(wktValueToLocal);
    case "nullValue":
    case void 0:
      return null;
    default:
      return val.kind.value;
  }
}
function wktValueToReflect(json) {
  const value = {
    $typeName: "google.protobuf.Value",
    kind: { case: void 0 }
  };
  switch (typeof json) {
    case "number":
      value.kind = { case: "numberValue", value: json };
      break;
    case "string":
      value.kind = { case: "stringValue", value: json };
      break;
    case "boolean":
      value.kind = { case: "boolValue", value: json };
      break;
    case "object":
      if (json === null) {
        value.kind = { case: "nullValue", value: NULL_VALUE };
      } else if (Array.isArray(json)) {
        const listValue = {
          $typeName: "google.protobuf.ListValue",
          values: []
        };
        if (Array.isArray(json)) {
          for (const e of json) {
            listValue.values.push(wktValueToReflect(e));
          }
        }
        value.kind = {
          case: "listValue",
          value: listValue
        };
      } else {
        value.kind = {
          case: "structValue",
          value: wktStructToReflect(json)
        };
      }
      break;
  }
  return value;
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect.js
function reflect(messageDesc2, message, check = true) {
  return new ReflectMessageImpl(messageDesc2, message, check);
}
var messageSortedFields = /* @__PURE__ */ new WeakMap();
var ReflectMessageImpl = class {
  get sortedFields() {
    const cached = messageSortedFields.get(this.desc);
    if (cached) {
      return cached;
    }
    const sortedFields = this.desc.fields.concat().sort((a, b) => a.number - b.number);
    messageSortedFields.set(this.desc, sortedFields);
    return sortedFields;
  }
  constructor(messageDesc2, message, check = true) {
    this.lists = /* @__PURE__ */ new Map();
    this.maps = /* @__PURE__ */ new Map();
    this.check = check;
    this.desc = messageDesc2;
    this.message = this[unsafeLocal] = message !== null && message !== void 0 ? message : create(messageDesc2);
    this.fields = messageDesc2.fields;
    this.oneofs = messageDesc2.oneofs;
    this.members = messageDesc2.members;
  }
  findNumber(number) {
    if (!this._fieldsByNumber) {
      this._fieldsByNumber = new Map(this.desc.fields.map((f) => [f.number, f]));
    }
    return this._fieldsByNumber.get(number);
  }
  oneofCase(oneof) {
    assertOwn(this.message, oneof);
    return unsafeOneofCase(this.message, oneof);
  }
  isSet(field) {
    assertOwn(this.message, field);
    return unsafeIsSet(this.message, field);
  }
  clear(field) {
    assertOwn(this.message, field);
    unsafeClear(this.message, field);
  }
  get(field) {
    assertOwn(this.message, field);
    const value = unsafeGet(this.message, field);
    switch (field.fieldKind) {
      case "list":
        let list = this.lists.get(field);
        if (!list || list[unsafeLocal] !== value) {
          this.lists.set(
            field,
            // biome-ignore lint/suspicious/noAssignInExpressions: no
            list = new ReflectListImpl(field, value, this.check)
          );
        }
        return list;
      case "map":
        let map = this.maps.get(field);
        if (!map || map[unsafeLocal] !== value) {
          this.maps.set(
            field,
            // biome-ignore lint/suspicious/noAssignInExpressions: no
            map = new ReflectMapImpl(field, value, this.check)
          );
        }
        return map;
      case "message":
        return messageToReflect(field, value, this.check);
      case "scalar":
        return value === void 0 ? scalarZeroValue(field.scalar, false) : longToReflect(field, value);
      case "enum":
        return value !== null && value !== void 0 ? value : field.enum.values[0].number;
    }
  }
  set(field, value) {
    assertOwn(this.message, field);
    if (this.check) {
      const err = checkField(field, value);
      if (err) {
        throw err;
      }
    }
    let local;
    if (field.fieldKind == "message") {
      local = messageToLocal(field, value);
    } else if (isReflectMap(value) || isReflectList(value)) {
      local = value[unsafeLocal];
    } else {
      local = longToLocal(field, value);
    }
    unsafeSet(this.message, field, local);
  }
  getUnknown() {
    return this.message.$unknown;
  }
  setUnknown(value) {
    this.message.$unknown = value;
  }
};
function assertOwn(owner, member) {
  if (member.parent.typeName !== owner.$typeName) {
    throw new FieldError(member, `cannot use ${member.toString()} with message ${owner.$typeName}`, "ForeignFieldError");
  }
}
var ReflectListImpl = class {
  field() {
    return this._field;
  }
  get size() {
    return this._arr.length;
  }
  constructor(field, unsafeInput, check) {
    this._field = field;
    this._arr = this[unsafeLocal] = unsafeInput;
    this.check = check;
  }
  get(index) {
    const item = this._arr[index];
    return item === void 0 ? void 0 : listItemToReflect(this._field, item, this.check);
  }
  set(index, item) {
    if (index < 0 || index >= this._arr.length) {
      throw new FieldError(this._field, `list item #${index + 1}: out of range`);
    }
    if (this.check) {
      const err = checkListItem(this._field, index, item);
      if (err) {
        throw err;
      }
    }
    this._arr[index] = listItemToLocal(this._field, item);
  }
  add(item) {
    if (this.check) {
      const err = checkListItem(this._field, this._arr.length, item);
      if (err) {
        throw err;
      }
    }
    this._arr.push(listItemToLocal(this._field, item));
    return void 0;
  }
  clear() {
    this._arr.splice(0, this._arr.length);
  }
  [Symbol.iterator]() {
    return this.values();
  }
  keys() {
    return this._arr.keys();
  }
  *values() {
    for (const item of this._arr) {
      yield listItemToReflect(this._field, item, this.check);
    }
  }
  *entries() {
    for (let i = 0; i < this._arr.length; i++) {
      yield [i, listItemToReflect(this._field, this._arr[i], this.check)];
    }
  }
};
var ReflectMapImpl = class {
  constructor(field, unsafeInput, check = true) {
    this.obj = this[unsafeLocal] = unsafeInput !== null && unsafeInput !== void 0 ? unsafeInput : {};
    this.check = check;
    this._field = field;
  }
  field() {
    return this._field;
  }
  set(key, value) {
    if (this.check) {
      const err = checkMapEntry(this._field, key, value);
      if (err) {
        throw err;
      }
    }
    this.obj[mapKeyToLocal(key)] = mapValueToLocal(this._field, value);
    return this;
  }
  delete(key) {
    const k = mapKeyToLocal(key);
    const has = Object.prototype.hasOwnProperty.call(this.obj, k);
    if (has) {
      delete this.obj[k];
    }
    return has;
  }
  clear() {
    for (const key of Object.keys(this.obj)) {
      delete this.obj[key];
    }
  }
  get(key) {
    let val = this.obj[mapKeyToLocal(key)];
    if (val !== void 0) {
      val = mapValueToReflect(this._field, val, this.check);
    }
    return val;
  }
  has(key) {
    return Object.prototype.hasOwnProperty.call(this.obj, mapKeyToLocal(key));
  }
  *keys() {
    for (const objKey of Object.keys(this.obj)) {
      yield mapKeyToReflect(objKey, this._field.mapKey);
    }
  }
  *entries() {
    for (const objEntry of Object.entries(this.obj)) {
      yield [
        mapKeyToReflect(objEntry[0], this._field.mapKey),
        mapValueToReflect(this._field, objEntry[1], this.check)
      ];
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  get size() {
    return Object.keys(this.obj).length;
  }
  *values() {
    for (const val of Object.values(this.obj)) {
      yield mapValueToReflect(this._field, val, this.check);
    }
  }
  forEach(callbackfn, thisArg) {
    for (const mapEntry of this.entries()) {
      callbackfn.call(thisArg, mapEntry[1], mapEntry[0], this);
    }
  }
};
function messageToLocal(field, value) {
  if (!isReflectMessage(value)) {
    return value;
  }
  if (isWrapper(value.message) && !field.oneof && field.fieldKind == "message") {
    return value.message.value;
  }
  if (value.desc.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value") {
    return wktStructToLocal(value.message);
  }
  return value.message;
}
function messageToReflect(field, value, check) {
  if (value !== void 0) {
    if (isWrapperDesc(field.message) && !field.oneof && field.fieldKind == "message") {
      value = {
        $typeName: field.message.typeName,
        value: longToReflect(field.message.fields[0], value)
      };
    } else if (field.message.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value" && isObject(value)) {
      value = wktStructToReflect(value);
    }
  }
  return new ReflectMessageImpl(field.message, value, check);
}
function listItemToLocal(field, value) {
  if (field.listKind == "message") {
    return messageToLocal(field, value);
  }
  return longToLocal(field, value);
}
function listItemToReflect(field, value, check) {
  if (field.listKind == "message") {
    return messageToReflect(field, value, check);
  }
  return longToReflect(field, value);
}
function mapValueToLocal(field, value) {
  if (field.mapKind == "message") {
    return messageToLocal(field, value);
  }
  return longToLocal(field, value);
}
function mapValueToReflect(field, value, check) {
  if (field.mapKind == "message") {
    return messageToReflect(field, value, check);
  }
  return value;
}
function mapKeyToLocal(key) {
  return typeof key == "string" || typeof key == "number" ? key : String(key);
}
function mapKeyToReflect(key, type) {
  switch (type) {
    case ScalarType.STRING:
      return key;
    case ScalarType.INT32:
    case ScalarType.FIXED32:
    case ScalarType.UINT32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32: {
      const n = Number.parseInt(key);
      if (Number.isFinite(n)) {
        return n;
      }
      break;
    }
    case ScalarType.BOOL:
      switch (key) {
        case "true":
          return true;
        case "false":
          return false;
      }
      break;
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      try {
        return protoInt64.uParse(key);
      } catch (_a) {
      }
      break;
    default:
      try {
        return protoInt64.parse(key);
      } catch (_b) {
      }
      break;
  }
  return key;
}
function longToReflect(field, value) {
  switch (field.scalar) {
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      if ("longAsString" in field && field.longAsString && typeof value == "string") {
        value = protoInt64.parse(value);
      }
      break;
    case ScalarType.FIXED64:
    case ScalarType.UINT64:
      if ("longAsString" in field && field.longAsString && typeof value == "string") {
        value = protoInt64.uParse(value);
      }
      break;
  }
  return value;
}
function longToLocal(field, value) {
  switch (field.scalar) {
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      if ("longAsString" in field && field.longAsString) {
        value = String(value);
      } else if (typeof value == "string" || typeof value == "number") {
        value = protoInt64.parse(value);
      }
      break;
    case ScalarType.FIXED64:
    case ScalarType.UINT64:
      if ("longAsString" in field && field.longAsString) {
        value = String(value);
      } else if (typeof value == "string" || typeof value == "number") {
        value = protoInt64.uParse(value);
      }
      break;
  }
  return value;
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js
var nativeSetFromBase64 = Uint8Array.prototype.setFromBase64;
function base64Decode(base64Str) {
  const len = base64Str.length;
  let size = len - (len + 3 >> 2);
  if ((len & 3) == 0 && base64Str[len - 1] == "=") {
    size -= base64Str[len - 2] == "=" ? 2 : 1;
  }
  const bytes = new Uint8Array(size);
  let written = -1;
  if (nativeSetFromBase64) {
    try {
      const result = nativeSetFromBase64.call(bytes, base64Str);
      if (result.read == len) {
        written = result.written;
      }
    } catch (_a) {
    }
  }
  if (written < 0) {
    written = setFromBase64(bytes, base64Str);
  }
  return written == size ? bytes : bytes.subarray(0, written);
}
function setFromBase64(bytes, base64Str) {
  const table = getDecodeTable();
  let bytePos = 0, groupPos = 0, b, p = 0;
  for (let i = 0; i < base64Str.length; i++) {
    b = table[base64Str.charCodeAt(i)];
    if (b === void 0) {
      switch (base64Str[i]) {
        // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
        case "=":
          groupPos = 0;
        // reset state when padding found
        case "\n":
        case "\r":
        case "	":
        case " ":
          continue;
        // skip white-space, and padding
        default:
          throw Error("invalid base64 string");
      }
    }
    switch (groupPos) {
      case 0:
        p = b;
        groupPos = 1;
        break;
      case 1:
        bytes[bytePos++] = p << 2 | (b & 48) >> 4;
        p = b;
        groupPos = 2;
        break;
      case 2:
        bytes[bytePos++] = (p & 15) << 4 | (b & 60) >> 2;
        p = b;
        groupPos = 3;
        break;
      case 3:
        bytes[bytePos++] = (p & 3) << 6 | b;
        groupPos = 0;
        break;
    }
  }
  if (groupPos == 1)
    throw Error("invalid base64 string");
  return bytePos;
}
var nativeToBase64 = Uint8Array.prototype.toBase64;
var toBase64OptionsMap = {
  std: { alphabet: "base64", omitPadding: false },
  std_raw: { alphabet: "base64", omitPadding: true },
  url: { alphabet: "base64url", omitPadding: true }
};
function base64Encode(bytes, encoding = "std") {
  if (nativeToBase64) {
    return nativeToBase64.call(bytes, toBase64OptionsMap[encoding]);
  }
  const table = getEncodeTable(encoding);
  const pad = encoding == "std";
  let base64 = "", groupPos = 0, b, p = 0;
  for (let i = 0; i < bytes.length; i++) {
    b = bytes[i];
    switch (groupPos) {
      case 0:
        base64 += table[b >> 2];
        p = (b & 3) << 4;
        groupPos = 1;
        break;
      case 1:
        base64 += table[p | b >> 4];
        p = (b & 15) << 2;
        groupPos = 2;
        break;
      case 2:
        base64 += table[p | b >> 6];
        base64 += table[b & 63];
        groupPos = 0;
        break;
    }
  }
  if (groupPos) {
    base64 += table[p];
    if (pad) {
      base64 += "=";
      if (groupPos == 1)
        base64 += "=";
    }
  }
  return base64;
}
var encodeTableStd;
var encodeTableUrl;
var decodeTable;
function getEncodeTable(encoding) {
  if (!encodeTableStd) {
    encodeTableStd = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
    encodeTableUrl = encodeTableStd.slice(0, -2).concat("-", "_");
  }
  return encoding == "url" ? (
    // biome-ignore lint/style/noNonNullAssertion: TS fails to narrow down
    encodeTableUrl
  ) : encodeTableStd;
}
function getDecodeTable() {
  if (!decodeTable) {
    decodeTable = [];
    const encodeTable = getEncodeTable("std");
    for (let i = 0; i < encodeTable.length; i++)
      decodeTable[encodeTable[i].charCodeAt(0)] = i;
    decodeTable["-".charCodeAt(0)] = encodeTable.indexOf("+");
    decodeTable["_".charCodeAt(0)] = encodeTable.indexOf("/");
  }
  return decodeTable;
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/reflect/names.js
function protoCamelCase(snakeCase) {
  let capNext = false;
  const b = [];
  for (let i = 0; i < snakeCase.length; i++) {
    let c = snakeCase.charAt(i);
    switch (c) {
      case "_":
        capNext = true;
        break;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        b.push(c);
        capNext = false;
        break;
      default:
        if (capNext) {
          capNext = false;
          c = c.toUpperCase();
        }
        b.push(c);
        break;
    }
  }
  return b.join("");
}
function protoSnakeCase(lowerCamelCase) {
  return lowerCamelCase.replace(/[A-Z]/g, (letter) => "_" + letter.toLowerCase());
}
var reservedObjectProperties = /* @__PURE__ */ new Set([
  // names reserved by JavaScript
  "constructor",
  "toString",
  "toJSON",
  "valueOf"
]);
function safeObjectProperty(name) {
  return reservedObjectProperties.has(name) ? name + "$" : name;
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/restore-json-names.js
function restoreJsonNames(message) {
  for (const f of message.field) {
    if (!unsafeIsSetExplicit(f, "jsonName")) {
      f.jsonName = protoCamelCase(f.name);
    }
  }
  message.nestedType.forEach(restoreJsonNames);
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wire/text-format.js
function parseTextFormatEnumValue(descEnum, value) {
  const enumValue = descEnum.values.find((v) => v.name === value);
  if (!enumValue) {
    throw new Error(`cannot parse ${descEnum} default value: ${value}`);
  }
  return enumValue.number;
}
function parseTextFormatScalarValue(type, value) {
  switch (type) {
    case ScalarType.STRING:
      return value;
    case ScalarType.BYTES: {
      const u = unescapeBytesDefaultValue(value);
      if (u === false) {
        throw new Error(`cannot parse ${ScalarType[type]} default value: ${value}`);
      }
      return u;
    }
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return protoInt64.parse(value);
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return protoInt64.uParse(value);
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      switch (value) {
        case "inf":
          return Number.POSITIVE_INFINITY;
        case "-inf":
          return Number.NEGATIVE_INFINITY;
        case "nan":
          return Number.NaN;
        default:
          return parseFloat(value);
      }
    case ScalarType.BOOL:
      return value === "true";
    case ScalarType.INT32:
    case ScalarType.UINT32:
    case ScalarType.SINT32:
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
      return parseInt(value, 10);
  }
}
function unescapeBytesDefaultValue(str) {
  const b = [];
  const input = {
    tail: str,
    c: "",
    next() {
      if (this.tail.length == 0) {
        return false;
      }
      this.c = this.tail[0];
      this.tail = this.tail.substring(1);
      return true;
    },
    take(n) {
      if (this.tail.length >= n) {
        const r = this.tail.substring(0, n);
        this.tail = this.tail.substring(n);
        return r;
      }
      return false;
    }
  };
  while (input.next()) {
    switch (input.c) {
      case "\\":
        if (input.next()) {
          switch (input.c) {
            case "\\":
              b.push(input.c.charCodeAt(0));
              break;
            case "b":
              b.push(8);
              break;
            case "f":
              b.push(12);
              break;
            case "n":
              b.push(10);
              break;
            case "r":
              b.push(13);
              break;
            case "t":
              b.push(9);
              break;
            case "v":
              b.push(11);
              break;
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7": {
              const s = input.c;
              const t = input.take(2);
              if (t === false) {
                return false;
              }
              const n = parseInt(s + t, 8);
              if (Number.isNaN(n)) {
                return false;
              }
              b.push(n);
              break;
            }
            case "x": {
              const s = input.c;
              const t = input.take(2);
              if (t === false) {
                return false;
              }
              const n = parseInt(s + t, 16);
              if (Number.isNaN(n)) {
                return false;
              }
              b.push(n);
              break;
            }
            case "u": {
              const s = input.c;
              const t = input.take(4);
              if (t === false) {
                return false;
              }
              const n = parseInt(s + t, 16);
              if (Number.isNaN(n)) {
                return false;
              }
              const chunk = new Uint8Array(4);
              const view = new DataView(chunk.buffer);
              view.setInt32(0, n, true);
              b.push(chunk[0], chunk[1], chunk[2], chunk[3]);
              break;
            }
            case "U": {
              const s = input.c;
              const t = input.take(8);
              if (t === false) {
                return false;
              }
              const tc = protoInt64.uEnc(s + t);
              const chunk = new Uint8Array(8);
              const view = new DataView(chunk.buffer);
              view.setInt32(0, tc.lo, true);
              view.setInt32(4, tc.hi, true);
              b.push(chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5], chunk[6], chunk[7]);
              break;
            }
          }
        }
        break;
      default:
        b.push(input.c.charCodeAt(0));
    }
  }
  return new Uint8Array(b);
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/reflect/nested-types.js
function* nestedTypes(desc) {
  switch (desc.kind) {
    case "file":
      for (const message of desc.messages) {
        yield message;
        yield* nestedTypes(message);
      }
      yield* desc.enums;
      yield* desc.services;
      yield* desc.extensions;
      break;
    case "message":
      for (const message of desc.nestedMessages) {
        yield message;
        yield* nestedTypes(message);
      }
      yield* desc.nestedEnums;
      yield* desc.nestedExtensions;
      break;
  }
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/registry.js
function createFileRegistry(...args2) {
  const registry = createBaseRegistry();
  if (!args2.length) {
    return registry;
  }
  if ("$typeName" in args2[0] && args2[0].$typeName == "google.protobuf.FileDescriptorSet") {
    for (const file of args2[0].file) {
      addFile(file, registry);
    }
    return registry;
  }
  if ("$typeName" in args2[0]) {
    let recurseDeps = function(file) {
      const deps = [];
      for (const protoFileName of file.dependency) {
        if (registry.getFile(protoFileName) != void 0) {
          continue;
        }
        if (seen.has(protoFileName)) {
          continue;
        }
        const dep = resolve(protoFileName);
        if (!dep) {
          throw new Error(`Unable to resolve ${protoFileName}, imported by ${file.name}`);
        }
        if ("kind" in dep) {
          registry.addFile(dep, false, true);
        } else {
          seen.add(dep.name);
          deps.push(dep);
        }
      }
      return deps.concat(...deps.map(recurseDeps));
    };
    const input = args2[0];
    const resolve = args2[1];
    const seen = /* @__PURE__ */ new Set();
    for (const file of [input, ...recurseDeps(input)].reverse()) {
      addFile(file, registry);
    }
  } else {
    for (const fileReg of args2) {
      for (const file of fileReg.files) {
        registry.addFile(file);
      }
    }
  }
  return registry;
}
function createBaseRegistry() {
  const types = /* @__PURE__ */ new Map();
  const extendees = /* @__PURE__ */ new Map();
  const files = /* @__PURE__ */ new Map();
  return {
    kind: "registry",
    types,
    extendees,
    [Symbol.iterator]() {
      return types.values();
    },
    get files() {
      return files.values();
    },
    addFile(file, skipTypes, withDeps) {
      files.set(file.proto.name, file);
      if (!skipTypes) {
        for (const type of nestedTypes(file)) {
          this.add(type);
        }
      }
      if (withDeps) {
        for (const f of file.dependencies) {
          this.addFile(f, skipTypes, withDeps);
        }
      }
    },
    add(desc) {
      if (desc.kind == "extension") {
        let numberToExt = extendees.get(desc.extendee.typeName);
        if (!numberToExt) {
          extendees.set(
            desc.extendee.typeName,
            // biome-ignore lint/suspicious/noAssignInExpressions: no
            numberToExt = /* @__PURE__ */ new Map()
          );
        }
        numberToExt.set(desc.number, desc);
      }
      types.set(desc.typeName, desc);
    },
    get(typeName) {
      return types.get(typeName);
    },
    getFile(fileName) {
      return files.get(fileName);
    },
    getMessage(typeName) {
      const t = types.get(typeName);
      return (t === null || t === void 0 ? void 0 : t.kind) == "message" ? t : void 0;
    },
    getEnum(typeName) {
      const t = types.get(typeName);
      return (t === null || t === void 0 ? void 0 : t.kind) == "enum" ? t : void 0;
    },
    getExtension(typeName) {
      const t = types.get(typeName);
      return (t === null || t === void 0 ? void 0 : t.kind) == "extension" ? t : void 0;
    },
    getExtensionFor(extendee, no) {
      var _a;
      return (_a = extendees.get(extendee.typeName)) === null || _a === void 0 ? void 0 : _a.get(no);
    },
    getService(typeName) {
      const t = types.get(typeName);
      return (t === null || t === void 0 ? void 0 : t.kind) == "service" ? t : void 0;
    }
  };
}
var EDITION_PROTO22 = 998;
var EDITION_PROTO32 = 999;
var EDITION_UNSTABLE = 9999;
var TYPE_STRING = 9;
var TYPE_GROUP = 10;
var TYPE_MESSAGE = 11;
var TYPE_BYTES = 12;
var TYPE_ENUM = 14;
var LABEL_REPEATED = 3;
var LABEL_REQUIRED = 2;
var JS_STRING = 1;
var IDEMPOTENCY_UNKNOWN = 0;
var EXPLICIT = 1;
var IMPLICIT3 = 2;
var LEGACY_REQUIRED = 3;
var PACKED = 1;
var DELIMITED = 2;
var OPEN = 1;
var VERIFY = 2;
var maximumEdition = 1001;
var featureDefaults = {
  // EDITION_PROTO2
  998: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 2,
    // CLOSED,
    repeatedFieldEncoding: 2,
    // EXPANDED,
    utf8Validation: 3,
    // NONE,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 2,
    // LEGACY_BEST_EFFORT,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1
    // EXPORT_ALL,
  },
  // EDITION_PROTO3
  999: {
    fieldPresence: 2,
    // IMPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1
    // EXPORT_ALL,
  },
  // EDITION_2023
  1e3: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1
    // EXPORT_ALL,
  },
  // EDITION_2024
  1001: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 1,
    // STYLE2024,
    defaultSymbolVisibility: 2
    // EXPORT_TOP_LEVEL,
  }
};
function addFile(proto, reg) {
  var _a, _b;
  const file = {
    kind: "file",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    edition: getFileEdition(proto),
    name: proto.name.replace(/\.proto$/, ""),
    dependencies: findFileDependencies(proto, reg),
    enums: [],
    messages: [],
    extensions: [],
    services: [],
    toString() {
      return `file ${proto.name}`;
    }
  };
  const mapEntriesStore = /* @__PURE__ */ new Map();
  const mapEntries = {
    get(typeName) {
      return mapEntriesStore.get(typeName);
    },
    add(desc) {
      var _a2;
      assert(((_a2 = desc.proto.options) === null || _a2 === void 0 ? void 0 : _a2.mapEntry) === true);
      mapEntriesStore.set(desc.typeName, desc);
    }
  };
  for (const enumProto of proto.enumType) {
    addEnum(enumProto, file, void 0, reg);
  }
  for (const messageProto of proto.messageType) {
    addMessage(messageProto, file, void 0, reg, mapEntries);
  }
  for (const serviceProto of proto.service) {
    addService(serviceProto, file, reg);
  }
  addExtensions(file, reg);
  for (const mapEntry of mapEntriesStore.values()) {
    addFields(mapEntry, reg, mapEntries);
  }
  for (const message of file.messages) {
    addFields(message, reg, mapEntries);
    addExtensions(message, reg);
  }
  reg.addFile(file, true);
}
function addExtensions(desc, reg) {
  switch (desc.kind) {
    case "file":
      for (const proto of desc.proto.extension) {
        const ext = newField(proto, desc, reg);
        desc.extensions.push(ext);
        reg.add(ext);
      }
      break;
    case "message":
      for (const proto of desc.proto.extension) {
        const ext = newField(proto, desc, reg);
        desc.nestedExtensions.push(ext);
        reg.add(ext);
      }
      for (const message of desc.nestedMessages) {
        addExtensions(message, reg);
      }
      break;
  }
}
function addFields(message, reg, mapEntries) {
  const allOneofs = message.proto.oneofDecl.map((proto) => newOneof(proto, message));
  const oneofsSeen = /* @__PURE__ */ new Set();
  for (const proto of message.proto.field) {
    const oneof = findOneof(proto, allOneofs);
    const field = newField(proto, message, reg, oneof, mapEntries);
    message.fields.push(field);
    message.field[field.localName] = field;
    if (oneof === void 0) {
      message.members.push(field);
    } else {
      oneof.fields.push(field);
      if (!oneofsSeen.has(oneof)) {
        oneofsSeen.add(oneof);
        message.members.push(oneof);
      }
    }
  }
  for (const oneof of allOneofs.filter((o) => oneofsSeen.has(o))) {
    message.oneofs.push(oneof);
  }
  for (const child of message.nestedMessages) {
    addFields(child, reg, mapEntries);
  }
}
function addEnum(proto, file, parent, reg) {
  var _a, _b, _c, _d, _e;
  const sharedPrefix = findEnumSharedPrefix(proto.name, proto.value);
  const desc = {
    kind: "enum",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    file,
    parent,
    open: true,
    name: proto.name,
    typeName: makeTypeName(proto, parent, file),
    value: {},
    values: [],
    sharedPrefix,
    toString() {
      return `enum ${this.typeName}`;
    }
  };
  desc.open = isEnumOpen(desc);
  reg.add(desc);
  for (const p of proto.value) {
    const name = p.name;
    desc.values.push(
      // biome-ignore lint/suspicious/noAssignInExpressions: no
      desc.value[p.number] = {
        kind: "enum_value",
        proto: p,
        deprecated: (_d = (_c = p.options) === null || _c === void 0 ? void 0 : _c.deprecated) !== null && _d !== void 0 ? _d : false,
        parent: desc,
        name,
        localName: safeObjectProperty(sharedPrefix == void 0 ? name : name.substring(sharedPrefix.length)),
        number: p.number,
        toString() {
          return `enum value ${desc.typeName}.${name}`;
        }
      }
    );
  }
  ((_e = parent === null || parent === void 0 ? void 0 : parent.nestedEnums) !== null && _e !== void 0 ? _e : file.enums).push(desc);
}
function addMessage(proto, file, parent, reg, mapEntries) {
  var _a, _b, _c, _d;
  const desc = {
    kind: "message",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    file,
    parent,
    name: proto.name,
    typeName: makeTypeName(proto, parent, file),
    fields: [],
    field: {},
    oneofs: [],
    members: [],
    nestedEnums: [],
    nestedMessages: [],
    nestedExtensions: [],
    toString() {
      return `message ${this.typeName}`;
    }
  };
  if (((_c = proto.options) === null || _c === void 0 ? void 0 : _c.mapEntry) === true) {
    mapEntries.add(desc);
  } else {
    ((_d = parent === null || parent === void 0 ? void 0 : parent.nestedMessages) !== null && _d !== void 0 ? _d : file.messages).push(desc);
    reg.add(desc);
  }
  for (const enumProto of proto.enumType) {
    addEnum(enumProto, file, desc, reg);
  }
  for (const messageProto of proto.nestedType) {
    addMessage(messageProto, file, desc, reg, mapEntries);
  }
}
function addService(proto, file, reg) {
  var _a, _b;
  const desc = {
    kind: "service",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    file,
    name: proto.name,
    typeName: makeTypeName(proto, void 0, file),
    methods: [],
    method: {},
    toString() {
      return `service ${this.typeName}`;
    }
  };
  file.services.push(desc);
  reg.add(desc);
  for (const methodProto of proto.method) {
    const method = newMethod(methodProto, desc, reg);
    desc.methods.push(method);
    desc.method[method.localName] = method;
  }
}
function newMethod(proto, parent, reg) {
  var _a, _b, _c, _d;
  let methodKind;
  if (proto.clientStreaming && proto.serverStreaming) {
    methodKind = "bidi_streaming";
  } else if (proto.clientStreaming) {
    methodKind = "client_streaming";
  } else if (proto.serverStreaming) {
    methodKind = "server_streaming";
  } else {
    methodKind = "unary";
  }
  const input = reg.getMessage(trimLeadingDot(proto.inputType));
  const output = reg.getMessage(trimLeadingDot(proto.outputType));
  assert(input, `invalid MethodDescriptorProto: input_type ${proto.inputType} not found`);
  assert(output, `invalid MethodDescriptorProto: output_type ${proto.inputType} not found`);
  const name = proto.name;
  return {
    kind: "rpc",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    parent,
    name,
    localName: safeObjectProperty(name.length ? safeObjectProperty(name[0].toLowerCase() + name.substring(1)) : name),
    methodKind,
    input,
    output,
    idempotency: (_d = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.idempotencyLevel) !== null && _d !== void 0 ? _d : IDEMPOTENCY_UNKNOWN,
    toString() {
      return `rpc ${parent.typeName}.${name}`;
    }
  };
}
function newOneof(proto, parent) {
  return {
    kind: "oneof",
    proto,
    deprecated: false,
    parent,
    fields: [],
    name: proto.name,
    localName: safeObjectProperty(protoCamelCase(proto.name)),
    toString() {
      return `oneof ${parent.typeName}.${this.name}`;
    }
  };
}
function newField(proto, parentOrFile, reg, oneof, mapEntries) {
  var _a, _b, _c;
  const isExtension = mapEntries === void 0;
  const field = {
    kind: "field",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
    name: proto.name,
    number: proto.number,
    scalar: void 0,
    message: void 0,
    enum: void 0,
    presence: getFieldPresence(proto, oneof, isExtension, parentOrFile),
    utf8Validation: isUtf8Validated(proto, parentOrFile),
    listKind: void 0,
    mapKind: void 0,
    mapKey: void 0,
    delimitedEncoding: void 0,
    packed: void 0,
    longAsString: false,
    getDefaultValue: void 0
  };
  let toStr;
  if (isExtension) {
    const file = parentOrFile.kind == "file" ? parentOrFile : parentOrFile.file;
    const parent = parentOrFile.kind == "file" ? void 0 : parentOrFile;
    const typeName = makeTypeName(proto, parent, file);
    field.kind = "extension";
    field.file = file;
    field.parent = parent;
    field.oneof = void 0;
    field.typeName = typeName;
    field.jsonName = `[${typeName}]`;
    toStr = () => `extension ${typeName}`;
    const extendee = reg.getMessage(trimLeadingDot(proto.extendee));
    assert(extendee, `invalid FieldDescriptorProto: extendee ${proto.extendee} not found`);
    field.extendee = extendee;
  } else {
    const parent = parentOrFile;
    assert(parent.kind == "message");
    field.parent = parent;
    field.oneof = oneof;
    field.localName = oneof ? protoCamelCase(proto.name) : safeObjectProperty(protoCamelCase(proto.name));
    field.jsonName = proto.jsonName;
    toStr = () => `field ${parent.typeName}.${proto.name}`;
  }
  Object.defineProperty(field, "toString", {
    value: toStr,
    writable: true,
    enumerable: true,
    configurable: true
  });
  const label = proto.label;
  const type = proto.type;
  const jstype = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.jstype;
  if (label === LABEL_REPEATED) {
    const mapEntry = type == TYPE_MESSAGE ? mapEntries === null || mapEntries === void 0 ? void 0 : mapEntries.get(trimLeadingDot(proto.typeName)) : void 0;
    if (mapEntry) {
      field.fieldKind = "map";
      const { key, value } = findMapEntryFields(mapEntry);
      field.mapKey = key.scalar;
      field.mapKind = value.fieldKind;
      field.message = value.message;
      field.delimitedEncoding = false;
      field.enum = value.enum;
      field.scalar = value.scalar;
      return field;
    }
    field.fieldKind = "list";
    switch (type) {
      case TYPE_MESSAGE:
      case TYPE_GROUP:
        field.listKind = "message";
        field.message = reg.getMessage(trimLeadingDot(proto.typeName));
        assert(field.message);
        field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile);
        break;
      case TYPE_ENUM:
        field.listKind = "enum";
        field.enum = reg.getEnum(trimLeadingDot(proto.typeName));
        assert(field.enum);
        break;
      default:
        field.listKind = "scalar";
        field.scalar = type;
        field.longAsString = jstype == JS_STRING;
        break;
    }
    field.packed = isPackedField(proto, parentOrFile);
    return field;
  }
  switch (type) {
    case TYPE_MESSAGE:
    case TYPE_GROUP:
      field.fieldKind = "message";
      field.message = reg.getMessage(trimLeadingDot(proto.typeName));
      assert(field.message, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`);
      field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile);
      field.getDefaultValue = () => void 0;
      break;
    case TYPE_ENUM: {
      const enumeration = reg.getEnum(trimLeadingDot(proto.typeName));
      assert(enumeration !== void 0, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`);
      field.fieldKind = "enum";
      field.enum = reg.getEnum(trimLeadingDot(proto.typeName));
      field.getDefaultValue = () => {
        return unsafeIsSetExplicit(proto, "defaultValue") ? parseTextFormatEnumValue(enumeration, proto.defaultValue) : void 0;
      };
      break;
    }
    default: {
      field.fieldKind = "scalar";
      field.scalar = type;
      field.longAsString = jstype == JS_STRING;
      field.getDefaultValue = () => {
        return unsafeIsSetExplicit(proto, "defaultValue") ? parseTextFormatScalarValue(type, proto.defaultValue) : void 0;
      };
      break;
    }
  }
  return field;
}
function getFileEdition(proto) {
  switch (proto.syntax) {
    case "":
    case "proto2":
      return EDITION_PROTO22;
    case "proto3":
      return EDITION_PROTO32;
    case "editions":
      if (proto.edition === EDITION_UNSTABLE) {
        return maximumEdition;
      }
      if (proto.edition in featureDefaults) {
        return proto.edition;
      }
      throw new Error(`${proto.name}: unsupported edition`);
    default:
      throw new Error(`${proto.name}: unsupported syntax "${proto.syntax}"`);
  }
}
function findFileDependencies(proto, reg) {
  return proto.dependency.map((wantName) => {
    const dep = reg.getFile(wantName);
    if (!dep) {
      throw new Error(`Cannot find ${wantName}, imported by ${proto.name}`);
    }
    return dep;
  });
}
function findEnumSharedPrefix(enumName, values) {
  const prefix = camelToSnakeCase(enumName) + "_";
  for (const value of values) {
    if (!value.name.toLowerCase().startsWith(prefix)) {
      return void 0;
    }
    const shortName = value.name.substring(prefix.length);
    if (shortName.length == 0) {
      return void 0;
    }
    if (/^\d/.test(shortName)) {
      return void 0;
    }
  }
  return prefix;
}
function camelToSnakeCase(camel) {
  return (camel.substring(0, 1) + camel.substring(1).replace(/[A-Z]/g, (c) => "_" + c)).toLowerCase();
}
function makeTypeName(proto, parent, file) {
  let typeName;
  if (parent) {
    typeName = `${parent.typeName}.${proto.name}`;
  } else if (file.proto.package.length > 0) {
    typeName = `${file.proto.package}.${proto.name}`;
  } else {
    typeName = `${proto.name}`;
  }
  return typeName;
}
function trimLeadingDot(typeName) {
  return typeName.startsWith(".") ? typeName.substring(1) : typeName;
}
function findOneof(proto, allOneofs) {
  if (!unsafeIsSetExplicit(proto, "oneofIndex")) {
    return void 0;
  }
  if (proto.proto3Optional) {
    return void 0;
  }
  const oneof = allOneofs[proto.oneofIndex];
  assert(oneof, `invalid FieldDescriptorProto: oneof #${proto.oneofIndex} for field #${proto.number} not found`);
  return oneof;
}
function getFieldPresence(proto, oneof, isExtension, parent) {
  if (proto.label == LABEL_REQUIRED) {
    return LEGACY_REQUIRED;
  }
  if (proto.label == LABEL_REPEATED) {
    return IMPLICIT3;
  }
  if (!!oneof || proto.proto3Optional) {
    return EXPLICIT;
  }
  if (isExtension) {
    return EXPLICIT;
  }
  const resolved = resolveFeature("fieldPresence", { proto, parent });
  if (resolved == IMPLICIT3 && (proto.type == TYPE_MESSAGE || proto.type == TYPE_GROUP)) {
    return EXPLICIT;
  }
  return resolved;
}
function isPackedField(proto, parent) {
  if (proto.label != LABEL_REPEATED) {
    return false;
  }
  switch (proto.type) {
    case TYPE_STRING:
    case TYPE_BYTES:
    case TYPE_GROUP:
    case TYPE_MESSAGE:
      return false;
  }
  const o = proto.options;
  if (o && unsafeIsSetExplicit(o, "packed")) {
    return o.packed;
  }
  return PACKED == resolveFeature("repeatedFieldEncoding", {
    proto,
    parent
  });
}
function findMapEntryFields(mapEntry) {
  const key = mapEntry.fields.find((f) => f.number === 1);
  const value = mapEntry.fields.find((f) => f.number === 2);
  assert(key && key.fieldKind == "scalar" && key.scalar != ScalarType.BYTES && key.scalar != ScalarType.FLOAT && key.scalar != ScalarType.DOUBLE && value && value.fieldKind != "list" && value.fieldKind != "map");
  return { key, value };
}
function isEnumOpen(desc) {
  var _a;
  return OPEN == resolveFeature("enumType", {
    proto: desc.proto,
    parent: (_a = desc.parent) !== null && _a !== void 0 ? _a : desc.file
  });
}
function isDelimitedEncoding(proto, parent) {
  if (proto.type == TYPE_GROUP) {
    return true;
  }
  return DELIMITED == resolveFeature("messageEncoding", {
    proto,
    parent
  });
}
function isUtf8Validated(proto, parent) {
  return VERIFY == resolveFeature("utf8Validation", {
    proto,
    parent
  });
}
function resolveFeature(name, ref) {
  var _a, _b;
  const featureSet = (_a = ref.proto.options) === null || _a === void 0 ? void 0 : _a.features;
  if (featureSet) {
    const val = featureSet[name];
    if (val != 0) {
      return val;
    }
  }
  if ("kind" in ref) {
    if (ref.kind == "message") {
      return resolveFeature(name, (_b = ref.parent) !== null && _b !== void 0 ? _b : ref.file);
    }
    const editionDefaults = featureDefaults[ref.edition];
    if (!editionDefaults) {
      throw new Error(`feature default for edition ${ref.edition} not found`);
    }
    return editionDefaults[name];
  }
  return resolveFeature(name, ref.parent);
}
function assert(condition, msg) {
  if (!condition) {
    throw new Error(msg);
  }
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/boot.js
function boot(boot2) {
  const root = bootFileDescriptorProto(boot2);
  root.messageType.forEach(restoreJsonNames);
  const reg = createFileRegistry(root, () => void 0);
  return reg.getFile(root.name);
}
function bootFileDescriptorProto(init) {
  const proto = /* @__PURE__ */ Object.create({
    syntax: "",
    edition: 0
  });
  return Object.assign(proto, Object.assign(Object.assign({ $typeName: "google.protobuf.FileDescriptorProto", dependency: [], publicDependency: [], weakDependency: [], optionDependency: [], service: [], extension: [] }, init), { messageType: init.messageType.map(bootDescriptorProto), enumType: init.enumType.map(bootEnumDescriptorProto) }));
}
function bootDescriptorProto(init) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const proto = /* @__PURE__ */ Object.create({
    visibility: 0
  });
  return Object.assign(proto, {
    $typeName: "google.protobuf.DescriptorProto",
    name: init.name,
    field: (_b = (_a = init.field) === null || _a === void 0 ? void 0 : _a.map(bootFieldDescriptorProto)) !== null && _b !== void 0 ? _b : [],
    extension: [],
    nestedType: (_d = (_c = init.nestedType) === null || _c === void 0 ? void 0 : _c.map(bootDescriptorProto)) !== null && _d !== void 0 ? _d : [],
    enumType: (_f = (_e = init.enumType) === null || _e === void 0 ? void 0 : _e.map(bootEnumDescriptorProto)) !== null && _f !== void 0 ? _f : [],
    extensionRange: (_h = (_g = init.extensionRange) === null || _g === void 0 ? void 0 : _g.map((e) => Object.assign({ $typeName: "google.protobuf.DescriptorProto.ExtensionRange" }, e))) !== null && _h !== void 0 ? _h : [],
    oneofDecl: [],
    reservedRange: [],
    reservedName: []
  });
}
function bootFieldDescriptorProto(init) {
  const proto = /* @__PURE__ */ Object.create({
    label: 1,
    typeName: "",
    extendee: "",
    defaultValue: "",
    oneofIndex: 0,
    jsonName: "",
    proto3Optional: false
  });
  return Object.assign(proto, Object.assign(Object.assign({ $typeName: "google.protobuf.FieldDescriptorProto" }, init), { options: init.options ? bootFieldOptions(init.options) : void 0 }));
}
function bootFieldOptions(init) {
  var _a, _b, _c;
  const proto = /* @__PURE__ */ Object.create({
    ctype: 0,
    packed: false,
    jstype: 0,
    lazy: false,
    unverifiedLazy: false,
    deprecated: false,
    weak: false,
    debugRedact: false,
    retention: 0
  });
  return Object.assign(proto, Object.assign(Object.assign({ $typeName: "google.protobuf.FieldOptions" }, init), { targets: (_a = init.targets) !== null && _a !== void 0 ? _a : [], editionDefaults: (_c = (_b = init.editionDefaults) === null || _b === void 0 ? void 0 : _b.map((e) => Object.assign({ $typeName: "google.protobuf.FieldOptions.EditionDefault" }, e))) !== null && _c !== void 0 ? _c : [], uninterpretedOption: [] }));
}
function bootEnumDescriptorProto(init) {
  const proto = /* @__PURE__ */ Object.create({
    visibility: 0
  });
  return Object.assign(proto, {
    $typeName: "google.protobuf.EnumDescriptorProto",
    name: init.name,
    reservedName: [],
    reservedRange: [],
    value: init.value.map((e) => Object.assign({ $typeName: "google.protobuf.EnumValueDescriptorProto" }, e))
  });
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/message.js
function messageDesc(file, path2, ...paths) {
  return paths.reduce((acc, cur) => acc.nestedMessages[cur], file.messages[path2]);
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/descriptor_pb.js
var file_google_protobuf_descriptor = /* @__PURE__ */ boot({ "name": "google/protobuf/descriptor.proto", "package": "google.protobuf", "messageType": [{ "name": "FileDescriptorSet", "field": [{ "name": "file", "number": 1, "type": 11, "label": 3, "typeName": ".google.protobuf.FileDescriptorProto" }], "extensionRange": [{ "start": 536e6, "end": 536000001 }] }, { "name": "FileDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "package", "number": 2, "type": 9, "label": 1 }, { "name": "dependency", "number": 3, "type": 9, "label": 3 }, { "name": "public_dependency", "number": 10, "type": 5, "label": 3 }, { "name": "weak_dependency", "number": 11, "type": 5, "label": 3 }, { "name": "option_dependency", "number": 15, "type": 9, "label": 3 }, { "name": "message_type", "number": 4, "type": 11, "label": 3, "typeName": ".google.protobuf.DescriptorProto" }, { "name": "enum_type", "number": 5, "type": 11, "label": 3, "typeName": ".google.protobuf.EnumDescriptorProto" }, { "name": "service", "number": 6, "type": 11, "label": 3, "typeName": ".google.protobuf.ServiceDescriptorProto" }, { "name": "extension", "number": 7, "type": 11, "label": 3, "typeName": ".google.protobuf.FieldDescriptorProto" }, { "name": "options", "number": 8, "type": 11, "label": 1, "typeName": ".google.protobuf.FileOptions" }, { "name": "source_code_info", "number": 9, "type": 11, "label": 1, "typeName": ".google.protobuf.SourceCodeInfo" }, { "name": "syntax", "number": 12, "type": 9, "label": 1 }, { "name": "edition", "number": 14, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }] }, { "name": "DescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "field", "number": 2, "type": 11, "label": 3, "typeName": ".google.protobuf.FieldDescriptorProto" }, { "name": "extension", "number": 6, "type": 11, "label": 3, "typeName": ".google.protobuf.FieldDescriptorProto" }, { "name": "nested_type", "number": 3, "type": 11, "label": 3, "typeName": ".google.protobuf.DescriptorProto" }, { "name": "enum_type", "number": 4, "type": 11, "label": 3, "typeName": ".google.protobuf.EnumDescriptorProto" }, { "name": "extension_range", "number": 5, "type": 11, "label": 3, "typeName": ".google.protobuf.DescriptorProto.ExtensionRange" }, { "name": "oneof_decl", "number": 8, "type": 11, "label": 3, "typeName": ".google.protobuf.OneofDescriptorProto" }, { "name": "options", "number": 7, "type": 11, "label": 1, "typeName": ".google.protobuf.MessageOptions" }, { "name": "reserved_range", "number": 9, "type": 11, "label": 3, "typeName": ".google.protobuf.DescriptorProto.ReservedRange" }, { "name": "reserved_name", "number": 10, "type": 9, "label": 3 }, { "name": "visibility", "number": 11, "type": 14, "label": 1, "typeName": ".google.protobuf.SymbolVisibility" }], "nestedType": [{ "name": "ExtensionRange", "field": [{ "name": "start", "number": 1, "type": 5, "label": 1 }, { "name": "end", "number": 2, "type": 5, "label": 1 }, { "name": "options", "number": 3, "type": 11, "label": 1, "typeName": ".google.protobuf.ExtensionRangeOptions" }] }, { "name": "ReservedRange", "field": [{ "name": "start", "number": 1, "type": 5, "label": 1 }, { "name": "end", "number": 2, "type": 5, "label": 1 }] }] }, { "name": "ExtensionRangeOptions", "field": [{ "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }, { "name": "declaration", "number": 2, "type": 11, "label": 3, "typeName": ".google.protobuf.ExtensionRangeOptions.Declaration", "options": { "retention": 2 } }, { "name": "features", "number": 50, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "verification", "number": 3, "type": 14, "label": 1, "typeName": ".google.protobuf.ExtensionRangeOptions.VerificationState", "defaultValue": "UNVERIFIED", "options": { "retention": 2 } }], "nestedType": [{ "name": "Declaration", "field": [{ "name": "number", "number": 1, "type": 5, "label": 1 }, { "name": "full_name", "number": 2, "type": 9, "label": 1 }, { "name": "type", "number": 3, "type": 9, "label": 1 }, { "name": "reserved", "number": 5, "type": 8, "label": 1 }, { "name": "repeated", "number": 6, "type": 8, "label": 1 }] }], "enumType": [{ "name": "VerificationState", "value": [{ "name": "DECLARATION", "number": 0 }, { "name": "UNVERIFIED", "number": 1 }] }], "extensionRange": [{ "start": 1e3, "end": 536870912 }] }, { "name": "FieldDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "number", "number": 3, "type": 5, "label": 1 }, { "name": "label", "number": 4, "type": 14, "label": 1, "typeName": ".google.protobuf.FieldDescriptorProto.Label" }, { "name": "type", "number": 5, "type": 14, "label": 1, "typeName": ".google.protobuf.FieldDescriptorProto.Type" }, { "name": "type_name", "number": 6, "type": 9, "label": 1 }, { "name": "extendee", "number": 2, "type": 9, "label": 1 }, { "name": "default_value", "number": 7, "type": 9, "label": 1 }, { "name": "oneof_index", "number": 9, "type": 5, "label": 1 }, { "name": "json_name", "number": 10, "type": 9, "label": 1 }, { "name": "options", "number": 8, "type": 11, "label": 1, "typeName": ".google.protobuf.FieldOptions" }, { "name": "proto3_optional", "number": 17, "type": 8, "label": 1 }], "enumType": [{ "name": "Type", "value": [{ "name": "TYPE_DOUBLE", "number": 1 }, { "name": "TYPE_FLOAT", "number": 2 }, { "name": "TYPE_INT64", "number": 3 }, { "name": "TYPE_UINT64", "number": 4 }, { "name": "TYPE_INT32", "number": 5 }, { "name": "TYPE_FIXED64", "number": 6 }, { "name": "TYPE_FIXED32", "number": 7 }, { "name": "TYPE_BOOL", "number": 8 }, { "name": "TYPE_STRING", "number": 9 }, { "name": "TYPE_GROUP", "number": 10 }, { "name": "TYPE_MESSAGE", "number": 11 }, { "name": "TYPE_BYTES", "number": 12 }, { "name": "TYPE_UINT32", "number": 13 }, { "name": "TYPE_ENUM", "number": 14 }, { "name": "TYPE_SFIXED32", "number": 15 }, { "name": "TYPE_SFIXED64", "number": 16 }, { "name": "TYPE_SINT32", "number": 17 }, { "name": "TYPE_SINT64", "number": 18 }] }, { "name": "Label", "value": [{ "name": "LABEL_OPTIONAL", "number": 1 }, { "name": "LABEL_REPEATED", "number": 3 }, { "name": "LABEL_REQUIRED", "number": 2 }] }] }, { "name": "OneofDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "options", "number": 2, "type": 11, "label": 1, "typeName": ".google.protobuf.OneofOptions" }] }, { "name": "EnumDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "value", "number": 2, "type": 11, "label": 3, "typeName": ".google.protobuf.EnumValueDescriptorProto" }, { "name": "options", "number": 3, "type": 11, "label": 1, "typeName": ".google.protobuf.EnumOptions" }, { "name": "reserved_range", "number": 4, "type": 11, "label": 3, "typeName": ".google.protobuf.EnumDescriptorProto.EnumReservedRange" }, { "name": "reserved_name", "number": 5, "type": 9, "label": 3 }, { "name": "visibility", "number": 6, "type": 14, "label": 1, "typeName": ".google.protobuf.SymbolVisibility" }], "nestedType": [{ "name": "EnumReservedRange", "field": [{ "name": "start", "number": 1, "type": 5, "label": 1 }, { "name": "end", "number": 2, "type": 5, "label": 1 }] }] }, { "name": "EnumValueDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "number", "number": 2, "type": 5, "label": 1 }, { "name": "options", "number": 3, "type": 11, "label": 1, "typeName": ".google.protobuf.EnumValueOptions" }] }, { "name": "ServiceDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "method", "number": 2, "type": 11, "label": 3, "typeName": ".google.protobuf.MethodDescriptorProto" }, { "name": "options", "number": 3, "type": 11, "label": 1, "typeName": ".google.protobuf.ServiceOptions" }] }, { "name": "MethodDescriptorProto", "field": [{ "name": "name", "number": 1, "type": 9, "label": 1 }, { "name": "input_type", "number": 2, "type": 9, "label": 1 }, { "name": "output_type", "number": 3, "type": 9, "label": 1 }, { "name": "options", "number": 4, "type": 11, "label": 1, "typeName": ".google.protobuf.MethodOptions" }, { "name": "client_streaming", "number": 5, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "server_streaming", "number": 6, "type": 8, "label": 1, "defaultValue": "false" }] }, { "name": "FileOptions", "field": [{ "name": "java_package", "number": 1, "type": 9, "label": 1 }, { "name": "java_outer_classname", "number": 8, "type": 9, "label": 1 }, { "name": "java_multiple_files", "number": 10, "type": 8, "label": 1, "defaultValue": "false", "options": {} }, { "name": "java_generate_equals_and_hash", "number": 20, "type": 8, "label": 1, "options": { "deprecated": true } }, { "name": "java_string_check_utf8", "number": 27, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "optimize_for", "number": 9, "type": 14, "label": 1, "typeName": ".google.protobuf.FileOptions.OptimizeMode", "defaultValue": "SPEED" }, { "name": "go_package", "number": 11, "type": 9, "label": 1 }, { "name": "cc_generic_services", "number": 16, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "java_generic_services", "number": 17, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "py_generic_services", "number": 18, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "deprecated", "number": 23, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "cc_enable_arenas", "number": 31, "type": 8, "label": 1, "defaultValue": "true" }, { "name": "objc_class_prefix", "number": 36, "type": 9, "label": 1 }, { "name": "csharp_namespace", "number": 37, "type": 9, "label": 1 }, { "name": "swift_prefix", "number": 39, "type": 9, "label": 1 }, { "name": "php_class_prefix", "number": 40, "type": 9, "label": 1 }, { "name": "php_namespace", "number": 41, "type": 9, "label": 1 }, { "name": "php_metadata_namespace", "number": 44, "type": 9, "label": 1 }, { "name": "ruby_package", "number": 45, "type": 9, "label": 1 }, { "name": "features", "number": 50, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "enumType": [{ "name": "OptimizeMode", "value": [{ "name": "SPEED", "number": 1 }, { "name": "CODE_SIZE", "number": 2 }, { "name": "LITE_RUNTIME", "number": 3 }] }], "extensionRange": [{ "start": 1e3, "end": 536870912 }] }, { "name": "MessageOptions", "field": [{ "name": "message_set_wire_format", "number": 1, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "no_standard_descriptor_accessor", "number": 2, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "deprecated", "number": 3, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "map_entry", "number": 7, "type": 8, "label": 1 }, { "name": "deprecated_legacy_json_field_conflicts", "number": 11, "type": 8, "label": 1, "options": { "deprecated": true } }, { "name": "features", "number": 12, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "extensionRange": [{ "start": 1e3, "end": 536870912 }] }, { "name": "FieldOptions", "field": [{ "name": "ctype", "number": 1, "type": 14, "label": 1, "typeName": ".google.protobuf.FieldOptions.CType", "defaultValue": "STRING" }, { "name": "packed", "number": 2, "type": 8, "label": 1 }, { "name": "jstype", "number": 6, "type": 14, "label": 1, "typeName": ".google.protobuf.FieldOptions.JSType", "defaultValue": "JS_NORMAL" }, { "name": "lazy", "number": 5, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "unverified_lazy", "number": 15, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "deprecated", "number": 3, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "weak", "number": 10, "type": 8, "label": 1, "defaultValue": "false", "options": { "deprecated": true } }, { "name": "debug_redact", "number": 16, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "retention", "number": 17, "type": 14, "label": 1, "typeName": ".google.protobuf.FieldOptions.OptionRetention" }, { "name": "targets", "number": 19, "type": 14, "label": 3, "typeName": ".google.protobuf.FieldOptions.OptionTargetType" }, { "name": "edition_defaults", "number": 20, "type": 11, "label": 3, "typeName": ".google.protobuf.FieldOptions.EditionDefault" }, { "name": "features", "number": 21, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "feature_support", "number": 22, "type": 11, "label": 1, "typeName": ".google.protobuf.FieldOptions.FeatureSupport" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "nestedType": [{ "name": "EditionDefault", "field": [{ "name": "edition", "number": 3, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "value", "number": 2, "type": 9, "label": 1 }] }, { "name": "FeatureSupport", "field": [{ "name": "edition_introduced", "number": 1, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "edition_deprecated", "number": 2, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "deprecation_warning", "number": 3, "type": 9, "label": 1 }, { "name": "edition_removed", "number": 4, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "removal_error", "number": 5, "type": 9, "label": 1 }] }], "enumType": [{ "name": "CType", "value": [{ "name": "STRING", "number": 0 }, { "name": "CORD", "number": 1 }, { "name": "STRING_PIECE", "number": 2 }] }, { "name": "JSType", "value": [{ "name": "JS_NORMAL", "number": 0 }, { "name": "JS_STRING", "number": 1 }, { "name": "JS_NUMBER", "number": 2 }] }, { "name": "OptionRetention", "value": [{ "name": "RETENTION_UNKNOWN", "number": 0 }, { "name": "RETENTION_RUNTIME", "number": 1 }, { "name": "RETENTION_SOURCE", "number": 2 }] }, { "name": "OptionTargetType", "value": [{ "name": "TARGET_TYPE_UNKNOWN", "number": 0 }, { "name": "TARGET_TYPE_FILE", "number": 1 }, { "name": "TARGET_TYPE_EXTENSION_RANGE", "number": 2 }, { "name": "TARGET_TYPE_MESSAGE", "number": 3 }, { "name": "TARGET_TYPE_FIELD", "number": 4 }, { "name": "TARGET_TYPE_ONEOF", "number": 5 }, { "name": "TARGET_TYPE_ENUM", "number": 6 }, { "name": "TARGET_TYPE_ENUM_ENTRY", "number": 7 }, { "name": "TARGET_TYPE_SERVICE", "number": 8 }, { "name": "TARGET_TYPE_METHOD", "number": 9 }] }], "extensionRange": [{ "start": 1e3, "end": 536870912 }] }, { "name": "OneofOptions", "field": [{ "name": "features", "number": 1, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "extensionRange": [{ "start": 1e3, "end": 536870912 }] }, { "name": "EnumOptions", "field": [{ "name": "allow_alias", "number": 2, "type": 8, "label": 1 }, { "name": "deprecated", "number": 3, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "deprecated_legacy_json_field_conflicts", "number": 6, "type": 8, "label": 1, "options": { "deprecated": true } }, { "name": "features", "number": 7, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "extensionRange": [{ "start": 1e3, "end": 536870912 }] }, { "name": "EnumValueOptions", "field": [{ "name": "deprecated", "number": 1, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "features", "number": 2, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "debug_redact", "number": 3, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "feature_support", "number": 4, "type": 11, "label": 1, "typeName": ".google.protobuf.FieldOptions.FeatureSupport" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "extensionRange": [{ "start": 1e3, "end": 536870912 }] }, { "name": "ServiceOptions", "field": [{ "name": "features", "number": 34, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "deprecated", "number": 33, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "extensionRange": [{ "start": 1e3, "end": 536870912 }] }, { "name": "MethodOptions", "field": [{ "name": "deprecated", "number": 33, "type": 8, "label": 1, "defaultValue": "false" }, { "name": "idempotency_level", "number": 34, "type": 14, "label": 1, "typeName": ".google.protobuf.MethodOptions.IdempotencyLevel", "defaultValue": "IDEMPOTENCY_UNKNOWN" }, { "name": "features", "number": 35, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "uninterpreted_option", "number": 999, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption" }], "enumType": [{ "name": "IdempotencyLevel", "value": [{ "name": "IDEMPOTENCY_UNKNOWN", "number": 0 }, { "name": "NO_SIDE_EFFECTS", "number": 1 }, { "name": "IDEMPOTENT", "number": 2 }] }], "extensionRange": [{ "start": 1e3, "end": 536870912 }] }, { "name": "UninterpretedOption", "field": [{ "name": "name", "number": 2, "type": 11, "label": 3, "typeName": ".google.protobuf.UninterpretedOption.NamePart" }, { "name": "identifier_value", "number": 3, "type": 9, "label": 1 }, { "name": "positive_int_value", "number": 4, "type": 4, "label": 1 }, { "name": "negative_int_value", "number": 5, "type": 3, "label": 1 }, { "name": "double_value", "number": 6, "type": 1, "label": 1 }, { "name": "string_value", "number": 7, "type": 12, "label": 1 }, { "name": "aggregate_value", "number": 8, "type": 9, "label": 1 }], "nestedType": [{ "name": "NamePart", "field": [{ "name": "name_part", "number": 1, "type": 9, "label": 2 }, { "name": "is_extension", "number": 2, "type": 8, "label": 2 }] }] }, { "name": "FeatureSet", "field": [{ "name": "field_presence", "number": 1, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.FieldPresence", "options": { "retention": 1, "targets": [4, 1], "editionDefaults": [{ "value": "EXPLICIT", "edition": 900 }, { "value": "IMPLICIT", "edition": 999 }, { "value": "EXPLICIT", "edition": 1e3 }] } }, { "name": "enum_type", "number": 2, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.EnumType", "options": { "retention": 1, "targets": [6, 1], "editionDefaults": [{ "value": "CLOSED", "edition": 900 }, { "value": "OPEN", "edition": 999 }] } }, { "name": "repeated_field_encoding", "number": 3, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.RepeatedFieldEncoding", "options": { "retention": 1, "targets": [4, 1], "editionDefaults": [{ "value": "EXPANDED", "edition": 900 }, { "value": "PACKED", "edition": 999 }] } }, { "name": "utf8_validation", "number": 4, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.Utf8Validation", "options": { "retention": 1, "targets": [4, 1], "editionDefaults": [{ "value": "NONE", "edition": 900 }, { "value": "VERIFY", "edition": 999 }] } }, { "name": "message_encoding", "number": 5, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.MessageEncoding", "options": { "retention": 1, "targets": [4, 1], "editionDefaults": [{ "value": "LENGTH_PREFIXED", "edition": 900 }] } }, { "name": "json_format", "number": 6, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.JsonFormat", "options": { "retention": 1, "targets": [3, 6, 1], "editionDefaults": [{ "value": "LEGACY_BEST_EFFORT", "edition": 900 }, { "value": "ALLOW", "edition": 999 }] } }, { "name": "enforce_naming_style", "number": 7, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.EnforceNamingStyle", "options": { "retention": 2, "targets": [1, 2, 3, 4, 5, 6, 7, 8, 9], "editionDefaults": [{ "value": "STYLE_LEGACY", "edition": 900 }, { "value": "STYLE2024", "edition": 1001 }] } }, { "name": "default_symbol_visibility", "number": 8, "type": 14, "label": 1, "typeName": ".google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility", "options": { "retention": 2, "targets": [1], "editionDefaults": [{ "value": "EXPORT_ALL", "edition": 900 }, { "value": "EXPORT_TOP_LEVEL", "edition": 1001 }] } }], "nestedType": [{ "name": "VisibilityFeature", "enumType": [{ "name": "DefaultSymbolVisibility", "value": [{ "name": "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN", "number": 0 }, { "name": "EXPORT_ALL", "number": 1 }, { "name": "EXPORT_TOP_LEVEL", "number": 2 }, { "name": "LOCAL_ALL", "number": 3 }, { "name": "STRICT", "number": 4 }] }] }], "enumType": [{ "name": "FieldPresence", "value": [{ "name": "FIELD_PRESENCE_UNKNOWN", "number": 0 }, { "name": "EXPLICIT", "number": 1 }, { "name": "IMPLICIT", "number": 2 }, { "name": "LEGACY_REQUIRED", "number": 3 }] }, { "name": "EnumType", "value": [{ "name": "ENUM_TYPE_UNKNOWN", "number": 0 }, { "name": "OPEN", "number": 1 }, { "name": "CLOSED", "number": 2 }] }, { "name": "RepeatedFieldEncoding", "value": [{ "name": "REPEATED_FIELD_ENCODING_UNKNOWN", "number": 0 }, { "name": "PACKED", "number": 1 }, { "name": "EXPANDED", "number": 2 }] }, { "name": "Utf8Validation", "value": [{ "name": "UTF8_VALIDATION_UNKNOWN", "number": 0 }, { "name": "VERIFY", "number": 2 }, { "name": "NONE", "number": 3 }] }, { "name": "MessageEncoding", "value": [{ "name": "MESSAGE_ENCODING_UNKNOWN", "number": 0 }, { "name": "LENGTH_PREFIXED", "number": 1 }, { "name": "DELIMITED", "number": 2 }] }, { "name": "JsonFormat", "value": [{ "name": "JSON_FORMAT_UNKNOWN", "number": 0 }, { "name": "ALLOW", "number": 1 }, { "name": "LEGACY_BEST_EFFORT", "number": 2 }] }, { "name": "EnforceNamingStyle", "value": [{ "name": "ENFORCE_NAMING_STYLE_UNKNOWN", "number": 0 }, { "name": "STYLE2024", "number": 1 }, { "name": "STYLE_LEGACY", "number": 2 }] }], "extensionRange": [{ "start": 1e3, "end": 9995 }, { "start": 9995, "end": 1e4 }, { "start": 1e4, "end": 10001 }] }, { "name": "FeatureSetDefaults", "field": [{ "name": "defaults", "number": 1, "type": 11, "label": 3, "typeName": ".google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault" }, { "name": "minimum_edition", "number": 4, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "maximum_edition", "number": 5, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }], "nestedType": [{ "name": "FeatureSetEditionDefault", "field": [{ "name": "edition", "number": 3, "type": 14, "label": 1, "typeName": ".google.protobuf.Edition" }, { "name": "overridable_features", "number": 4, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }, { "name": "fixed_features", "number": 5, "type": 11, "label": 1, "typeName": ".google.protobuf.FeatureSet" }] }] }, { "name": "SourceCodeInfo", "field": [{ "name": "location", "number": 1, "type": 11, "label": 3, "typeName": ".google.protobuf.SourceCodeInfo.Location" }], "nestedType": [{ "name": "Location", "field": [{ "name": "path", "number": 1, "type": 5, "label": 3, "options": { "packed": true } }, { "name": "span", "number": 2, "type": 5, "label": 3, "options": { "packed": true } }, { "name": "leading_comments", "number": 3, "type": 9, "label": 1 }, { "name": "trailing_comments", "number": 4, "type": 9, "label": 1 }, { "name": "leading_detached_comments", "number": 6, "type": 9, "label": 3 }] }], "extensionRange": [{ "start": 536e6, "end": 536000001 }] }, { "name": "GeneratedCodeInfo", "field": [{ "name": "annotation", "number": 1, "type": 11, "label": 3, "typeName": ".google.protobuf.GeneratedCodeInfo.Annotation" }], "nestedType": [{ "name": "Annotation", "field": [{ "name": "path", "number": 1, "type": 5, "label": 3, "options": { "packed": true } }, { "name": "source_file", "number": 2, "type": 9, "label": 1 }, { "name": "begin", "number": 3, "type": 5, "label": 1 }, { "name": "end", "number": 4, "type": 5, "label": 1 }, { "name": "semantic", "number": 5, "type": 14, "label": 1, "typeName": ".google.protobuf.GeneratedCodeInfo.Annotation.Semantic" }], "enumType": [{ "name": "Semantic", "value": [{ "name": "NONE", "number": 0 }, { "name": "SET", "number": 1 }, { "name": "ALIAS", "number": 2 }] }] }] }], "enumType": [{ "name": "Edition", "value": [{ "name": "EDITION_UNKNOWN", "number": 0 }, { "name": "EDITION_LEGACY", "number": 900 }, { "name": "EDITION_PROTO2", "number": 998 }, { "name": "EDITION_PROTO3", "number": 999 }, { "name": "EDITION_2023", "number": 1e3 }, { "name": "EDITION_2024", "number": 1001 }, { "name": "EDITION_UNSTABLE", "number": 9999 }, { "name": "EDITION_1_TEST_ONLY", "number": 1 }, { "name": "EDITION_2_TEST_ONLY", "number": 2 }, { "name": "EDITION_99997_TEST_ONLY", "number": 99997 }, { "name": "EDITION_99998_TEST_ONLY", "number": 99998 }, { "name": "EDITION_99999_TEST_ONLY", "number": 99999 }, { "name": "EDITION_MAX", "number": 2147483647 }] }, { "name": "SymbolVisibility", "value": [{ "name": "VISIBILITY_UNSET", "number": 0 }, { "name": "VISIBILITY_LOCAL", "number": 1 }, { "name": "VISIBILITY_EXPORT", "number": 2 }] }] });
var FileDescriptorProtoSchema = /* @__PURE__ */ messageDesc(file_google_protobuf_descriptor, 1);
var ExtensionRangeOptions_VerificationState;
(function(ExtensionRangeOptions_VerificationState2) {
  ExtensionRangeOptions_VerificationState2[ExtensionRangeOptions_VerificationState2["DECLARATION"] = 0] = "DECLARATION";
  ExtensionRangeOptions_VerificationState2[ExtensionRangeOptions_VerificationState2["UNVERIFIED"] = 1] = "UNVERIFIED";
})(ExtensionRangeOptions_VerificationState || (ExtensionRangeOptions_VerificationState = {}));
var FieldDescriptorProto_Type;
(function(FieldDescriptorProto_Type2) {
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["DOUBLE"] = 1] = "DOUBLE";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["FLOAT"] = 2] = "FLOAT";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["INT64"] = 3] = "INT64";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["UINT64"] = 4] = "UINT64";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["INT32"] = 5] = "INT32";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["FIXED64"] = 6] = "FIXED64";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["FIXED32"] = 7] = "FIXED32";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["BOOL"] = 8] = "BOOL";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["STRING"] = 9] = "STRING";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["GROUP"] = 10] = "GROUP";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["MESSAGE"] = 11] = "MESSAGE";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["BYTES"] = 12] = "BYTES";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["UINT32"] = 13] = "UINT32";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["ENUM"] = 14] = "ENUM";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["SFIXED32"] = 15] = "SFIXED32";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["SFIXED64"] = 16] = "SFIXED64";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["SINT32"] = 17] = "SINT32";
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2["SINT64"] = 18] = "SINT64";
})(FieldDescriptorProto_Type || (FieldDescriptorProto_Type = {}));
var FieldDescriptorProto_Label;
(function(FieldDescriptorProto_Label2) {
  FieldDescriptorProto_Label2[FieldDescriptorProto_Label2["OPTIONAL"] = 1] = "OPTIONAL";
  FieldDescriptorProto_Label2[FieldDescriptorProto_Label2["REPEATED"] = 3] = "REPEATED";
  FieldDescriptorProto_Label2[FieldDescriptorProto_Label2["REQUIRED"] = 2] = "REQUIRED";
})(FieldDescriptorProto_Label || (FieldDescriptorProto_Label = {}));
var FileOptions_OptimizeMode;
(function(FileOptions_OptimizeMode2) {
  FileOptions_OptimizeMode2[FileOptions_OptimizeMode2["SPEED"] = 1] = "SPEED";
  FileOptions_OptimizeMode2[FileOptions_OptimizeMode2["CODE_SIZE"] = 2] = "CODE_SIZE";
  FileOptions_OptimizeMode2[FileOptions_OptimizeMode2["LITE_RUNTIME"] = 3] = "LITE_RUNTIME";
})(FileOptions_OptimizeMode || (FileOptions_OptimizeMode = {}));
var FieldOptions_CType;
(function(FieldOptions_CType2) {
  FieldOptions_CType2[FieldOptions_CType2["STRING"] = 0] = "STRING";
  FieldOptions_CType2[FieldOptions_CType2["CORD"] = 1] = "CORD";
  FieldOptions_CType2[FieldOptions_CType2["STRING_PIECE"] = 2] = "STRING_PIECE";
})(FieldOptions_CType || (FieldOptions_CType = {}));
var FieldOptions_JSType;
(function(FieldOptions_JSType2) {
  FieldOptions_JSType2[FieldOptions_JSType2["JS_NORMAL"] = 0] = "JS_NORMAL";
  FieldOptions_JSType2[FieldOptions_JSType2["JS_STRING"] = 1] = "JS_STRING";
  FieldOptions_JSType2[FieldOptions_JSType2["JS_NUMBER"] = 2] = "JS_NUMBER";
})(FieldOptions_JSType || (FieldOptions_JSType = {}));
var FieldOptions_OptionRetention;
(function(FieldOptions_OptionRetention2) {
  FieldOptions_OptionRetention2[FieldOptions_OptionRetention2["RETENTION_UNKNOWN"] = 0] = "RETENTION_UNKNOWN";
  FieldOptions_OptionRetention2[FieldOptions_OptionRetention2["RETENTION_RUNTIME"] = 1] = "RETENTION_RUNTIME";
  FieldOptions_OptionRetention2[FieldOptions_OptionRetention2["RETENTION_SOURCE"] = 2] = "RETENTION_SOURCE";
})(FieldOptions_OptionRetention || (FieldOptions_OptionRetention = {}));
var FieldOptions_OptionTargetType;
(function(FieldOptions_OptionTargetType2) {
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_UNKNOWN"] = 0] = "TARGET_TYPE_UNKNOWN";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_FILE"] = 1] = "TARGET_TYPE_FILE";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_EXTENSION_RANGE"] = 2] = "TARGET_TYPE_EXTENSION_RANGE";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_MESSAGE"] = 3] = "TARGET_TYPE_MESSAGE";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_FIELD"] = 4] = "TARGET_TYPE_FIELD";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_ONEOF"] = 5] = "TARGET_TYPE_ONEOF";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_ENUM"] = 6] = "TARGET_TYPE_ENUM";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_ENUM_ENTRY"] = 7] = "TARGET_TYPE_ENUM_ENTRY";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_SERVICE"] = 8] = "TARGET_TYPE_SERVICE";
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2["TARGET_TYPE_METHOD"] = 9] = "TARGET_TYPE_METHOD";
})(FieldOptions_OptionTargetType || (FieldOptions_OptionTargetType = {}));
var MethodOptions_IdempotencyLevel;
(function(MethodOptions_IdempotencyLevel2) {
  MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2["IDEMPOTENCY_UNKNOWN"] = 0] = "IDEMPOTENCY_UNKNOWN";
  MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2["NO_SIDE_EFFECTS"] = 1] = "NO_SIDE_EFFECTS";
  MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2["IDEMPOTENT"] = 2] = "IDEMPOTENT";
})(MethodOptions_IdempotencyLevel || (MethodOptions_IdempotencyLevel = {}));
var FeatureSet_VisibilityFeature_DefaultSymbolVisibility;
(function(FeatureSet_VisibilityFeature_DefaultSymbolVisibility2) {
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2["DEFAULT_SYMBOL_VISIBILITY_UNKNOWN"] = 0] = "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN";
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2["EXPORT_ALL"] = 1] = "EXPORT_ALL";
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2["EXPORT_TOP_LEVEL"] = 2] = "EXPORT_TOP_LEVEL";
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2["LOCAL_ALL"] = 3] = "LOCAL_ALL";
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2["STRICT"] = 4] = "STRICT";
})(FeatureSet_VisibilityFeature_DefaultSymbolVisibility || (FeatureSet_VisibilityFeature_DefaultSymbolVisibility = {}));
var FeatureSet_FieldPresence;
(function(FeatureSet_FieldPresence2) {
  FeatureSet_FieldPresence2[FeatureSet_FieldPresence2["FIELD_PRESENCE_UNKNOWN"] = 0] = "FIELD_PRESENCE_UNKNOWN";
  FeatureSet_FieldPresence2[FeatureSet_FieldPresence2["EXPLICIT"] = 1] = "EXPLICIT";
  FeatureSet_FieldPresence2[FeatureSet_FieldPresence2["IMPLICIT"] = 2] = "IMPLICIT";
  FeatureSet_FieldPresence2[FeatureSet_FieldPresence2["LEGACY_REQUIRED"] = 3] = "LEGACY_REQUIRED";
})(FeatureSet_FieldPresence || (FeatureSet_FieldPresence = {}));
var FeatureSet_EnumType;
(function(FeatureSet_EnumType2) {
  FeatureSet_EnumType2[FeatureSet_EnumType2["ENUM_TYPE_UNKNOWN"] = 0] = "ENUM_TYPE_UNKNOWN";
  FeatureSet_EnumType2[FeatureSet_EnumType2["OPEN"] = 1] = "OPEN";
  FeatureSet_EnumType2[FeatureSet_EnumType2["CLOSED"] = 2] = "CLOSED";
})(FeatureSet_EnumType || (FeatureSet_EnumType = {}));
var FeatureSet_RepeatedFieldEncoding;
(function(FeatureSet_RepeatedFieldEncoding2) {
  FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2["REPEATED_FIELD_ENCODING_UNKNOWN"] = 0] = "REPEATED_FIELD_ENCODING_UNKNOWN";
  FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2["PACKED"] = 1] = "PACKED";
  FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2["EXPANDED"] = 2] = "EXPANDED";
})(FeatureSet_RepeatedFieldEncoding || (FeatureSet_RepeatedFieldEncoding = {}));
var FeatureSet_Utf8Validation;
(function(FeatureSet_Utf8Validation2) {
  FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2["UTF8_VALIDATION_UNKNOWN"] = 0] = "UTF8_VALIDATION_UNKNOWN";
  FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2["VERIFY"] = 2] = "VERIFY";
  FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2["NONE"] = 3] = "NONE";
})(FeatureSet_Utf8Validation || (FeatureSet_Utf8Validation = {}));
var FeatureSet_MessageEncoding;
(function(FeatureSet_MessageEncoding2) {
  FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2["MESSAGE_ENCODING_UNKNOWN"] = 0] = "MESSAGE_ENCODING_UNKNOWN";
  FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2["LENGTH_PREFIXED"] = 1] = "LENGTH_PREFIXED";
  FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2["DELIMITED"] = 2] = "DELIMITED";
})(FeatureSet_MessageEncoding || (FeatureSet_MessageEncoding = {}));
var FeatureSet_JsonFormat;
(function(FeatureSet_JsonFormat2) {
  FeatureSet_JsonFormat2[FeatureSet_JsonFormat2["JSON_FORMAT_UNKNOWN"] = 0] = "JSON_FORMAT_UNKNOWN";
  FeatureSet_JsonFormat2[FeatureSet_JsonFormat2["ALLOW"] = 1] = "ALLOW";
  FeatureSet_JsonFormat2[FeatureSet_JsonFormat2["LEGACY_BEST_EFFORT"] = 2] = "LEGACY_BEST_EFFORT";
})(FeatureSet_JsonFormat || (FeatureSet_JsonFormat = {}));
var FeatureSet_EnforceNamingStyle;
(function(FeatureSet_EnforceNamingStyle2) {
  FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2["ENFORCE_NAMING_STYLE_UNKNOWN"] = 0] = "ENFORCE_NAMING_STYLE_UNKNOWN";
  FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2["STYLE2024"] = 1] = "STYLE2024";
  FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2["STYLE_LEGACY"] = 2] = "STYLE_LEGACY";
})(FeatureSet_EnforceNamingStyle || (FeatureSet_EnforceNamingStyle = {}));
var GeneratedCodeInfo_Annotation_Semantic;
(function(GeneratedCodeInfo_Annotation_Semantic2) {
  GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2["NONE"] = 0] = "NONE";
  GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2["SET"] = 1] = "SET";
  GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2["ALIAS"] = 2] = "ALIAS";
})(GeneratedCodeInfo_Annotation_Semantic || (GeneratedCodeInfo_Annotation_Semantic = {}));
var Edition;
(function(Edition2) {
  Edition2[Edition2["EDITION_UNKNOWN"] = 0] = "EDITION_UNKNOWN";
  Edition2[Edition2["EDITION_LEGACY"] = 900] = "EDITION_LEGACY";
  Edition2[Edition2["EDITION_PROTO2"] = 998] = "EDITION_PROTO2";
  Edition2[Edition2["EDITION_PROTO3"] = 999] = "EDITION_PROTO3";
  Edition2[Edition2["EDITION_2023"] = 1e3] = "EDITION_2023";
  Edition2[Edition2["EDITION_2024"] = 1001] = "EDITION_2024";
  Edition2[Edition2["EDITION_UNSTABLE"] = 9999] = "EDITION_UNSTABLE";
  Edition2[Edition2["EDITION_1_TEST_ONLY"] = 1] = "EDITION_1_TEST_ONLY";
  Edition2[Edition2["EDITION_2_TEST_ONLY"] = 2] = "EDITION_2_TEST_ONLY";
  Edition2[Edition2["EDITION_99997_TEST_ONLY"] = 99997] = "EDITION_99997_TEST_ONLY";
  Edition2[Edition2["EDITION_99998_TEST_ONLY"] = 99998] = "EDITION_99998_TEST_ONLY";
  Edition2[Edition2["EDITION_99999_TEST_ONLY"] = 99999] = "EDITION_99999_TEST_ONLY";
  Edition2[Edition2["EDITION_MAX"] = 2147483647] = "EDITION_MAX";
})(Edition || (Edition = {}));
var SymbolVisibility;
(function(SymbolVisibility2) {
  SymbolVisibility2[SymbolVisibility2["VISIBILITY_UNSET"] = 0] = "VISIBILITY_UNSET";
  SymbolVisibility2[SymbolVisibility2["VISIBILITY_LOCAL"] = 1] = "VISIBILITY_LOCAL";
  SymbolVisibility2[SymbolVisibility2["VISIBILITY_EXPORT"] = 2] = "VISIBILITY_EXPORT";
})(SymbolVisibility || (SymbolVisibility = {}));

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/from-binary.js
function makeReadContext(options) {
  return Object.assign(Object.assign({ readUnknownFields: true, recursionLimit: 100 }, options), { depth: 0 });
}
function fromBinary(schema, bytes, options) {
  const message = create(schema);
  compiledReader(schema).read(message, new BinaryReader(bytes), makeReadContext(options), bytes.byteLength);
  return message;
}
var compiledReaders = /* @__PURE__ */ new WeakMap();
function compiledReader(desc) {
  let compiled = compiledReaders.get(desc);
  if (compiled === void 0) {
    compiled = compileMessage(desc);
  }
  return compiled;
}
function compileMessage(desc) {
  const descString = String(desc);
  const fieldReaders = /* @__PURE__ */ new Map();
  const compiled = {
    read: compileMessageReader(descString, fieldReaders),
    readGroup: compileGroupReader(descString, fieldReaders)
  };
  compiledReaders.set(desc, compiled);
  for (const field of desc.fields) {
    fieldReaders.set(field.number, compileFieldReader(field));
  }
  return compiled;
}
function compileMessageReader(descString, fieldReaders) {
  return (message, reader, ctx, length) => {
    var _a;
    if (++ctx.depth > ctx.recursionLimit) {
      throw new Error(`cannot decode ${descString} from binary: maximum recursion depth of ${ctx.recursionLimit} reached`);
    }
    const end = reader.pos + length;
    const unknownFields = (_a = message.$unknown) !== null && _a !== void 0 ? _a : [];
    while (reader.pos < end) {
      const [fieldNo, wireType] = reader.tag();
      const fieldReader = fieldReaders.get(fieldNo);
      if (fieldReader === void 0) {
        const data = reader.skip(wireType, fieldNo, ctx.recursionLimit - ctx.depth);
        if (ctx.readUnknownFields) {
          unknownFields.push({ no: fieldNo, wireType, data });
        }
        continue;
      }
      fieldReader(message, reader, ctx, wireType);
    }
    if (unknownFields.length > 0) {
      message.$unknown = unknownFields;
    }
    ctx.depth--;
  };
}
function compileGroupReader(descString, fieldReaders) {
  return (message, reader, ctx, fieldNo) => {
    var _a;
    if (++ctx.depth > ctx.recursionLimit) {
      throw new Error(`cannot decode ${descString} from binary: maximum recursion depth of ${ctx.recursionLimit} reached`);
    }
    let recordFieldNo;
    let wireType;
    const unknownFields = (_a = message.$unknown) !== null && _a !== void 0 ? _a : [];
    while (reader.pos < reader.len) {
      [recordFieldNo, wireType] = reader.tag();
      if (wireType == WireType.EndGroup) {
        break;
      }
      const fieldReader = fieldReaders.get(recordFieldNo);
      if (fieldReader === void 0) {
        const data = reader.skip(wireType, recordFieldNo, ctx.recursionLimit - ctx.depth);
        if (ctx.readUnknownFields) {
          unknownFields.push({ no: recordFieldNo, wireType, data });
        }
        continue;
      }
      fieldReader(message, reader, ctx, wireType);
    }
    if (wireType != WireType.EndGroup || recordFieldNo !== fieldNo) {
      throw new Error("invalid end group tag");
    }
    if (unknownFields.length > 0) {
      message.$unknown = unknownFields;
    }
    ctx.depth--;
  };
}
function readField(message, reader, field, wireType, ctx) {
  compileFieldReader(field)(message[unsafeLocal], reader, ctx, wireType);
}
function compileFieldReader(field) {
  switch (field.fieldKind) {
    case "scalar":
      return compileScalarFieldReader(field);
    case "enum":
      return compileEnumFieldReader(field);
    case "message":
      return compileMessageFieldReader(field);
    case "list":
      return compileListFieldReader(field);
    case "map":
      return compileMapFieldReader(field);
  }
}
function compileScalarFieldReader(field) {
  const readScalar = compileScalarReader(field.scalar, field.utf8Validation, field.longAsString);
  const localName = field.localName;
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    return (message, reader) => {
      message[oneofLocalName] = {
        case: localName,
        value: readScalar(reader)
      };
    };
  }
  return (message, reader) => {
    message[localName] = readScalar(reader);
  };
}
function compileEnumFieldReader(field) {
  var _a;
  const localName = field.localName;
  const oneofLocalName = (_a = field.oneof) === null || _a === void 0 ? void 0 : _a.localName;
  if (field.enum.open) {
    if (oneofLocalName !== void 0) {
      return (message, reader) => {
        message[oneofLocalName] = { case: localName, value: reader.int32() };
      };
    }
    return (message, reader) => {
      message[localName] = reader.int32();
    };
  }
  const values = field.enum.values;
  const fieldNo = field.number;
  return (message, reader, ctx, wireType) => {
    var _a2;
    const val = reader.int32();
    if (values.some((v) => v.number === val)) {
      if (oneofLocalName !== void 0) {
        message[oneofLocalName] = { case: localName, value: val };
      } else {
        message[localName] = val;
      }
    } else if (ctx.readUnknownFields) {
      const bytes = [];
      varint32write(val, bytes);
      const unknownFields = (_a2 = message.$unknown) !== null && _a2 !== void 0 ? _a2 : [];
      unknownFields.push({
        no: fieldNo,
        wireType,
        data: new Uint8Array(bytes)
      });
      message.$unknown = unknownFields;
    }
  };
}
function compileMessageFieldReader(field) {
  const localName = field.localName;
  const { toMessage, toLocal } = localMessageMapper(field);
  const readChild = compileChildReader(field);
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    return (message, reader, ctx) => {
      const oneof = message[oneofLocalName];
      const child = toMessage(oneof.case === localName ? oneof.value : void 0);
      readChild(child, reader, ctx);
      message[oneofLocalName] = { case: localName, value: toLocal(child) };
    };
  }
  return (message, reader, ctx) => {
    const child = toMessage(message[localName]);
    readChild(child, reader, ctx);
    message[localName] = toLocal(child);
  };
}
function compileChildReader(field) {
  const compiledChild = compiledReader(field.message);
  if (field.delimitedEncoding) {
    const fieldNo = field.number;
    return (child, reader, ctx) => compiledChild.readGroup(child, reader, ctx, fieldNo);
  }
  return (child, reader, ctx) => compiledChild.read(child, reader, ctx, reader.uint32());
}
function compileListFieldReader(field) {
  const localName = field.localName;
  if (field.listKind == "message") {
    const { toMessage, toLocal } = localMessageMapper(field);
    const readChild = compileChildReader(field);
    return (message, reader, ctx) => {
      const child = toMessage(void 0);
      readChild(child, reader, ctx);
      message[localName].push(toLocal(child));
    };
  }
  const scalarType = field.listKind == "enum" ? ScalarType.INT32 : field.scalar;
  const longAsString = field.listKind == "scalar" ? field.longAsString : false;
  const readScalar = compileScalarReader(scalarType, field.utf8Validation, longAsString);
  const packedPossible = scalarType != ScalarType.STRING && scalarType != ScalarType.BYTES;
  return (message, reader, ctx, wireType) => {
    const items = message[localName];
    if (wireType == WireType.LengthDelimited && packedPossible) {
      const end = reader.uint32() + reader.pos;
      while (reader.pos < end) {
        items.push(readScalar(reader));
      }
    } else {
      items.push(readScalar(reader));
    }
  };
}
function compileMapFieldReader(field) {
  const localName = field.localName;
  const readKey = compileScalarReader(field.mapKey, field.utf8Validation, false);
  const keyZero = scalarZeroValue(field.mapKey, false);
  let readValue;
  let valueDefault;
  switch (field.mapKind) {
    case "scalar": {
      const scalar = field.scalar;
      const readScalar = compileScalarReader(scalar, field.utf8Validation, false);
      readValue = (reader) => readScalar(reader);
      if (scalar == ScalarType.BYTES) {
        valueDefault = () => new Uint8Array(0);
      } else {
        const zero = scalarZeroValue(scalar, false);
        valueDefault = () => zero;
      }
      break;
    }
    case "enum": {
      const zero = field.enum.values[0].number;
      readValue = (reader) => reader.int32();
      valueDefault = () => zero;
      break;
    }
    case "message": {
      const { toMessage, toLocal } = localMessageMapper(field);
      const readChild = compiledReader(field.message).read;
      readValue = (reader, ctx) => {
        const child = toMessage(void 0);
        readChild(child, reader, ctx, reader.uint32());
        return toLocal(child);
      };
      valueDefault = () => toLocal(toMessage(void 0));
      break;
    }
  }
  return (message, reader, ctx) => {
    const record = message[localName];
    let key;
    let val;
    const len = reader.uint32();
    const end = reader.pos + len;
    while (reader.pos < end) {
      const [fieldNo] = reader.tag();
      switch (fieldNo) {
        case 1:
          key = readKey(reader);
          break;
        case 2:
          val = readValue(reader, ctx);
          break;
      }
    }
    if (key === void 0) {
      key = keyZero;
    }
    if (val === void 0) {
      val = valueDefault();
    }
    record[key] = val;
  };
}
function compileScalarReader(type, utf8Validation, longAsString) {
  switch (type) {
    case ScalarType.STRING:
      return (reader) => reader.string(utf8Validation);
    case ScalarType.BOOL:
      return (reader) => reader.bool();
    case ScalarType.DOUBLE:
      return (reader) => reader.double();
    case ScalarType.FLOAT:
      return (reader) => reader.float();
    case ScalarType.INT32:
      return (reader) => reader.int32();
    case ScalarType.INT64:
      if (longAsString) {
        return (reader) => String(reader.int64());
      }
      return (reader) => reader.int64();
    case ScalarType.UINT64:
      if (longAsString) {
        return (reader) => String(reader.uint64());
      }
      return (reader) => reader.uint64();
    case ScalarType.FIXED64:
      if (longAsString) {
        return (reader) => String(reader.fixed64());
      }
      return (reader) => reader.fixed64();
    case ScalarType.BYTES:
      return (reader) => reader.bytes();
    case ScalarType.FIXED32:
      return (reader) => reader.fixed32();
    case ScalarType.SFIXED32:
      return (reader) => reader.sfixed32();
    case ScalarType.SFIXED64:
      if (longAsString) {
        return (reader) => String(reader.sfixed64());
      }
      return (reader) => reader.sfixed64();
    case ScalarType.SINT64:
      if (longAsString) {
        return (reader) => String(reader.sint64());
      }
      return (reader) => reader.sint64();
    case ScalarType.UINT32:
      return (reader) => reader.uint32();
    case ScalarType.SINT32:
      return (reader) => reader.sint32();
  }
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/file.js
function fileDesc(b64, imports) {
  var _a;
  const root = fromBinary(FileDescriptorProtoSchema, base64Decode(b64));
  root.messageType.forEach(restoreJsonNames);
  root.dependency = (_a = imports === null || imports === void 0 ? void 0 : imports.map((f) => f.proto.name)) !== null && _a !== void 0 ? _a : [];
  const reg = createFileRegistry(root, (protoFileName) => imports === null || imports === void 0 ? void 0 : imports.find((f) => f.proto.name === protoFileName));
  return reg.getFile(root.name);
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/timestamp_pb.js
var file_google_protobuf_timestamp = /* @__PURE__ */ fileDesc("Ch9nb29nbGUvcHJvdG9idWYvdGltZXN0YW1wLnByb3RvEg9nb29nbGUucHJvdG9idWYiKwoJVGltZXN0YW1wEg8KB3NlY29uZHMYASABKAMSDQoFbmFub3MYAiABKAVChQEKE2NvbS5nb29nbGUucHJvdG9idWZCDlRpbWVzdGFtcFByb3RvUAFaMmdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL3RpbWVzdGFtcHBi+AEBogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");
var TimestampSchema = /* @__PURE__ */ messageDesc(file_google_protobuf_timestamp, 0);

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wkt/timestamp.js
function timestampFromDate(date) {
  return timestampFromMs(date.getTime());
}
function timestampFromMs(timestampMs) {
  const seconds = Math.floor(timestampMs / 1e3);
  return create(TimestampSchema, {
    seconds: protoInt64.parse(seconds),
    nanos: (timestampMs - seconds * 1e3) * 1e6
  });
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/duration_pb.js
var file_google_protobuf_duration = /* @__PURE__ */ fileDesc("Ch5nb29nbGUvcHJvdG9idWYvZHVyYXRpb24ucHJvdG8SD2dvb2dsZS5wcm90b2J1ZiIqCghEdXJhdGlvbhIPCgdzZWNvbmRzGAEgASgDEg0KBW5hbm9zGAIgASgFQoMBChNjb20uZ29vZ2xlLnByb3RvYnVmQg1EdXJhdGlvblByb3RvUAFaMWdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2R1cmF0aW9ucGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMw");
var DurationSchema = /* @__PURE__ */ messageDesc(file_google_protobuf_duration, 0);

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/any_pb.js
var file_google_protobuf_any = /* @__PURE__ */ fileDesc("Chlnb29nbGUvcHJvdG9idWYvYW55LnByb3RvEg9nb29nbGUucHJvdG9idWYiJgoDQW55EhAKCHR5cGVfdXJsGAEgASgJEg0KBXZhbHVlGAIgASgMQnYKE2NvbS5nb29nbGUucHJvdG9idWZCCEFueVByb3RvUAFaLGdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2FueXBiogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");
var AnySchema = /* @__PURE__ */ messageDesc(file_google_protobuf_any, 0);

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/to-binary.js
var IMPLICIT4 = 2;
var LEGACY_REQUIRED2 = 3;
var writeDefaults = {
  writeUnknownFields: true
};
function makeWriteOptions(options) {
  return options ? Object.assign(Object.assign({}, writeDefaults), options) : writeDefaults;
}
function toBinary(schema, message, options) {
  const writer = new BinaryWriter();
  compiledWriter(schema)(writer, makeWriteOptions(options), message);
  return writer.finish();
}
var compiledWriters = /* @__PURE__ */ new WeakMap();
function compiledWriter(desc) {
  let compiled = compiledWriters.get(desc);
  if (compiled === void 0) {
    compiled = compileMessage2(desc);
  }
  return compiled;
}
function compileMessage2(desc) {
  const typeName = desc.typeName;
  const sortedFields = desc.fields.concat().sort((a, b) => a.number - b.number);
  const foreignField = sortedFields[0];
  const fieldWriters = [];
  const compiled = (writer, opts, message) => {
    if (message.$typeName !== typeName && foreignField !== void 0) {
      throw new FieldError(foreignField, `cannot use ${foreignField} with message ${message.$typeName}`, "ForeignFieldError");
    }
    for (let i = 0; i < fieldWriters.length; i++) {
      fieldWriters[i](writer, opts, message);
    }
    const unknown = message.$unknown;
    if (unknown !== void 0 && opts.writeUnknownFields) {
      for (let i = 0; i < unknown.length; i++) {
        const { no, wireType, data } = unknown[i];
        writer.tag(no, wireType).raw(data);
      }
    }
  };
  compiledWriters.set(desc, compiled);
  for (const field of sortedFields) {
    fieldWriters.push(compileField(field));
  }
  return compiled;
}
function compileField(field) {
  switch (field.fieldKind) {
    case "message":
    case "scalar":
    case "enum":
      return compileSingularField(field);
    case "list":
      return compileListField(field);
    case "map":
      return compileMapField(field);
  }
}
function compileSingularField(field) {
  const writeValue = compileSingularValue(field);
  const localName = field.localName;
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    return (writer, opts, message) => {
      const oneof = message[oneofLocalName];
      if (oneof.case === localName) {
        writeValue(writer, opts, oneof.value);
      }
    };
  }
  if (field.presence != IMPLICIT4) {
    const requiredError = field.presence == LEGACY_REQUIRED2 ? `cannot encode ${field} to binary: required field not set` : void 0;
    return (writer, opts, message) => {
      const value = message[localName];
      if (value !== void 0 && Object.prototype.hasOwnProperty.call(message, localName)) {
        writeValue(writer, opts, value);
      } else if (requiredError !== void 0) {
        throw new Error(requiredError);
      }
    };
  }
  if (field.fieldKind == "enum") {
    const zero = field.enum.values[0].number;
    return (writer, opts, message) => {
      const value = message[localName];
      if (value !== zero) {
        writeValue(writer, opts, value);
      }
    };
  }
  switch (field.scalar) {
    case ScalarType.BOOL:
      return (writer, opts, message) => {
        const value = message[localName];
        if (value !== false) {
          writeValue(writer, opts, value);
        }
      };
    case ScalarType.STRING:
      return (writer, opts, message) => {
        const value = message[localName];
        if (value !== "") {
          writeValue(writer, opts, value);
        }
      };
    case ScalarType.BYTES:
      return (writer, opts, message) => {
        const value = message[localName];
        if (!(value instanceof Uint8Array) || value.byteLength > 0) {
          writeValue(writer, opts, value);
        }
      };
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return (writer, opts, message) => {
        const value = message[localName];
        if (!Object.is(value, 0)) {
          writeValue(writer, opts, value);
        }
      };
    default:
      return (writer, opts, message) => {
        const value = message[localName];
        if (value != 0) {
          writeValue(writer, opts, value);
        }
      };
  }
}
function compileSingularValue(field) {
  switch (field.fieldKind) {
    case "message": {
      const { toMessage } = localMessageMapper(field);
      const writeChild = compileChildWriter(field);
      return (writer, opts, value) => {
        writeChild(writer, opts, toMessage(value));
      };
    }
    case "scalar":
    case "enum": {
      const scalarType = field.fieldKind == "enum" ? ScalarType.INT32 : field.scalar;
      const fieldNo = field.number;
      const wireType = writeTypeOfScalar(scalarType);
      const writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
      return (writer, opts, value) => {
        writer.tag(fieldNo, wireType);
        writeScalar(writer, value);
      };
    }
  }
}
function compileListField(field) {
  const localName = field.localName;
  const fieldNo = field.number;
  switch (field.listKind) {
    case "message": {
      const { toMessage } = localMessageMapper(field);
      const writeChild = compileChildWriter(field);
      return (writer, opts, message) => {
        const items = message[localName];
        for (let i = 0; i < items.length; i++) {
          writeChild(writer, opts, toMessage(items[i]));
        }
      };
    }
    case "scalar":
    case "enum": {
      const scalarType = field.listKind == "enum" ? ScalarType.INT32 : field.scalar;
      const writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
      if (field.packed) {
        return (writer, opts, message) => {
          const items = message[localName];
          if (items.length == 0) {
            return;
          }
          writer.tag(fieldNo, WireType.LengthDelimited).fork();
          for (let i = 0; i < items.length; i++) {
            writeScalar(writer, items[i]);
          }
          writer.join();
        };
      }
      const wireType = writeTypeOfScalar(scalarType);
      return (writer, opts, message) => {
        const items = message[localName];
        for (let i = 0; i < items.length; i++) {
          writer.tag(fieldNo, wireType);
          writeScalar(writer, items[i]);
        }
      };
    }
  }
}
function compileMapField(field) {
  const localName = field.localName;
  const fieldNo = field.number;
  const writeKey = compileMapKey(field);
  if (field.mapKind == "message") {
    const { toMessage } = localMessageMapper(field);
    const writeMessage = compiledWriter(field.message);
    return (writer, opts, message) => {
      const record = message[localName];
      const keys = Object.keys(record);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        writer.tag(fieldNo, WireType.LengthDelimited).fork();
        writeKey(writer, key);
        writer.tag(2, WireType.LengthDelimited).fork();
        writeMessage(writer, opts, toMessage(record[key]));
        writer.join();
        writer.join();
      }
    };
  }
  const scalarType = field.mapKind == "enum" ? ScalarType.INT32 : field.scalar;
  const valueWireType = writeTypeOfScalar(scalarType);
  const writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
  return (writer, opts, message) => {
    const record = message[localName];
    const keys = Object.keys(record);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      writer.tag(fieldNo, WireType.LengthDelimited).fork();
      writeKey(writer, key);
      writer.tag(2, valueWireType);
      writeScalar(writer, record[key]);
      writer.join();
    }
  };
}
function compileMapKey(field) {
  const wireType = writeTypeOfScalar(field.mapKey);
  const writeScalar = compileScalarValue(field.mapKey, field.parent.typeName, field.name);
  const convertKey = compileMapKeyConverter(field.mapKey);
  return (writer, key) => {
    writer.tag(1, wireType);
    writeScalar(writer, convertKey(key));
  };
}
function compileMapKeyConverter(type) {
  switch (type) {
    case ScalarType.STRING:
      return (key) => key;
    case ScalarType.BOOL:
      return (key) => key === "true" ? true : key === "false" ? false : key;
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return (key) => {
        try {
          return protoInt64.uParse(key);
        } catch (_a) {
          return key;
        }
      };
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return (key) => {
        try {
          return protoInt64.parse(key);
        } catch (_a) {
          return key;
        }
      };
    default:
      return (key) => {
        const n = Number.parseInt(key);
        return Number.isFinite(n) ? n : key;
      };
  }
}
function compileScalarValue(type, messageName, fieldName) {
  const writeScalar = compileScalarWrite(type);
  return (writer, value) => {
    try {
      writeScalar(writer, value);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`cannot encode field ${messageName}.${fieldName} to binary: ${e.message}`);
      }
      throw e;
    }
  };
}
function compileScalarWrite(type) {
  switch (type) {
    case ScalarType.STRING:
      return (writer, value) => writer.string(value);
    case ScalarType.BOOL:
      return (writer, value) => writer.bool(value);
    case ScalarType.DOUBLE:
      return (writer, value) => writer.double(value);
    case ScalarType.FLOAT:
      return (writer, value) => writer.float(value);
    case ScalarType.INT32:
      return (writer, value) => writer.int32(value);
    case ScalarType.INT64:
      return (writer, value) => writer.int64(value);
    case ScalarType.UINT64:
      return (writer, value) => writer.uint64(value);
    case ScalarType.FIXED64:
      return (writer, value) => writer.fixed64(value);
    case ScalarType.BYTES:
      return (writer, value) => writer.bytes(value);
    case ScalarType.FIXED32:
      return (writer, value) => writer.fixed32(value);
    case ScalarType.SFIXED32:
      return (writer, value) => writer.sfixed32(value);
    case ScalarType.SFIXED64:
      return (writer, value) => writer.sfixed64(value);
    case ScalarType.SINT64:
      return (writer, value) => writer.sint64(value);
    case ScalarType.UINT32:
      return (writer, value) => writer.uint32(value);
    case ScalarType.SINT32:
      return (writer, value) => writer.sint32(value);
  }
}
function writeField(writer, opts, msg, field) {
  compileField(field)(writer, opts, msg[unsafeLocal]);
}
function compileChildWriter(field) {
  const fieldNo = field.number;
  const writeMessage = compiledWriter(field.message);
  if (field.delimitedEncoding) {
    return (writer, opts, child) => {
      writer.tag(fieldNo, WireType.StartGroup);
      writeMessage(writer, opts, child);
      writer.tag(fieldNo, WireType.EndGroup);
    };
  }
  return (writer, opts, child) => {
    writer.tag(fieldNo, WireType.LengthDelimited).fork();
    writeMessage(writer, opts, child);
    writer.join();
  };
}
function writeTypeOfScalar(type) {
  switch (type) {
    case ScalarType.BYTES:
    case ScalarType.STRING:
      return WireType.LengthDelimited;
    case ScalarType.DOUBLE:
    case ScalarType.FIXED64:
    case ScalarType.SFIXED64:
      return WireType.Bit64;
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
    case ScalarType.FLOAT:
      return WireType.Bit32;
    default:
      return WireType.Varint;
  }
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wkt/any.js
function anyPack(schema, message, into) {
  let ret = false;
  if (!into) {
    into = create(AnySchema);
    ret = true;
  }
  into.value = toBinary(schema, message);
  into.typeUrl = typeNameToUrl(message.$typeName);
  return ret ? into : void 0;
}
function anyIs(any, descOrTypeName) {
  if (any.typeUrl === "") {
    return false;
  }
  const want = typeof descOrTypeName == "string" ? descOrTypeName : descOrTypeName.typeName;
  const got = typeUrlToName(any.typeUrl);
  return want === got;
}
function anyUnpack(any, registryOrMessageDesc) {
  if (any.typeUrl === "") {
    return void 0;
  }
  const desc = registryOrMessageDesc.kind == "message" ? registryOrMessageDesc : registryOrMessageDesc.getMessage(typeUrlToName(any.typeUrl));
  if (!desc || !anyIs(any, desc)) {
    return void 0;
  }
  return fromBinary(desc, any.value);
}
function typeNameToUrl(name) {
  return `type.googleapis.com/${name}`;
}
function typeUrlToName(url) {
  const slash = url.lastIndexOf("/");
  const name = slash >= 0 ? url.substring(slash + 1) : url;
  if (!name.length) {
    throw new Error(`invalid type url: ${url}`);
  }
  return name;
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/empty_pb.js
var file_google_protobuf_empty = /* @__PURE__ */ fileDesc("Chtnb29nbGUvcHJvdG9idWYvZW1wdHkucHJvdG8SD2dvb2dsZS5wcm90b2J1ZiIHCgVFbXB0eUJ9ChNjb20uZ29vZ2xlLnByb3RvYnVmQgpFbXB0eVByb3RvUAFaLmdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2VtcHR5cGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMw");

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/struct_pb.js
var file_google_protobuf_struct = /* @__PURE__ */ fileDesc("Chxnb29nbGUvcHJvdG9idWYvc3RydWN0LnByb3RvEg9nb29nbGUucHJvdG9idWYihAEKBlN0cnVjdBIzCgZmaWVsZHMYASADKAsyIy5nb29nbGUucHJvdG9idWYuU3RydWN0LkZpZWxkc0VudHJ5GkUKC0ZpZWxkc0VudHJ5EgsKA2tleRgBIAEoCRIlCgV2YWx1ZRgCIAEoCzIWLmdvb2dsZS5wcm90b2J1Zi5WYWx1ZToCOAEi6gEKBVZhbHVlEjAKCm51bGxfdmFsdWUYASABKA4yGi5nb29nbGUucHJvdG9idWYuTnVsbFZhbHVlSAASFgoMbnVtYmVyX3ZhbHVlGAIgASgBSAASFgoMc3RyaW5nX3ZhbHVlGAMgASgJSAASFAoKYm9vbF92YWx1ZRgEIAEoCEgAEi8KDHN0cnVjdF92YWx1ZRgFIAEoCzIXLmdvb2dsZS5wcm90b2J1Zi5TdHJ1Y3RIABIwCgpsaXN0X3ZhbHVlGAYgASgLMhouZ29vZ2xlLnByb3RvYnVmLkxpc3RWYWx1ZUgAQgYKBGtpbmQiMwoJTGlzdFZhbHVlEiYKBnZhbHVlcxgBIAMoCzIWLmdvb2dsZS5wcm90b2J1Zi5WYWx1ZSobCglOdWxsVmFsdWUSDgoKTlVMTF9WQUxVRRAAQn8KE2NvbS5nb29nbGUucHJvdG9idWZCC1N0cnVjdFByb3RvUAFaL2dvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL3N0cnVjdHBi+AEBogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");
var StructSchema = /* @__PURE__ */ messageDesc(file_google_protobuf_struct, 0);
var ValueSchema = /* @__PURE__ */ messageDesc(file_google_protobuf_struct, 1);
var ListValueSchema = /* @__PURE__ */ messageDesc(file_google_protobuf_struct, 2);
var NullValue;
(function(NullValue2) {
  NullValue2[NullValue2["NULL_VALUE"] = 0] = "NULL_VALUE";
})(NullValue || (NullValue = {}));

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/extensions.js
function getExtension(message, extension, options) {
  assertExtendee(extension, message);
  const ufs = filterUnknownFields(message.$unknown, extension);
  const [container, field, get] = createExtensionContainer(extension);
  const ctx = makeReadContext(options);
  for (const uf of ufs) {
    readField(container, new BinaryReader(uf.data), field, uf.wireType, ctx);
  }
  return get();
}
function setExtension(message, extension, value) {
  var _a;
  assertExtendee(extension, message);
  const ufs = ((_a = message.$unknown) !== null && _a !== void 0 ? _a : []).filter((uf) => uf.no !== extension.number);
  const [container, field] = createExtensionContainer(extension, value);
  const writer = new BinaryWriter();
  writeField(writer, { writeUnknownFields: true }, container, field);
  const reader = new BinaryReader(writer.finish());
  while (reader.pos < reader.len) {
    const [no, wireType] = reader.tag();
    const data = reader.skip(wireType, no);
    ufs.push({ no, wireType, data });
  }
  message.$unknown = ufs;
}
function filterUnknownFields(unknownFields, extension) {
  if (unknownFields === void 0)
    return [];
  if (extension.fieldKind === "enum" || extension.fieldKind === "scalar") {
    for (let i = unknownFields.length - 1; i >= 0; --i) {
      if (unknownFields[i].no == extension.number) {
        return [unknownFields[i]];
      }
    }
    return [];
  }
  return unknownFields.filter((uf) => uf.no === extension.number);
}
function createExtensionContainer(extension, value) {
  const localName = extension.typeName;
  const field = Object.assign(Object.assign({}, extension), { kind: "field", parent: extension.extendee, localName });
  const desc = Object.assign(Object.assign({}, extension.extendee), { fields: [field], members: [field], oneofs: [] });
  const container = create(desc, value !== void 0 ? { [localName]: value } : void 0);
  return [
    reflect(desc, container),
    field,
    () => {
      const value2 = container[localName];
      if (value2 === void 0) {
        const desc2 = extension.message;
        if (isWrapperDesc(desc2)) {
          return scalarZeroValue(desc2.fields[0].scalar, desc2.fields[0].longAsString);
        }
        return create(desc2);
      }
      return value2;
    }
  ];
}
function assertExtendee(extension, message) {
  if (extension.extendee.typeName != message.$typeName) {
    throw new Error(`extension ${extension.typeName} can only be applied to message ${extension.extendee.typeName}`);
  }
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/wkt/json.js
var timestampMsMin = /* @__PURE__ */ Date.parse("0001-01-01T00:00:00Z");
var timestampMsMax = /* @__PURE__ */ Date.parse("9999-12-31T23:59:59Z");
var durationSecondsMin = -315576e6;
var durationSecondsMax = 315576e6;

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/to-json.js
var LEGACY_REQUIRED3 = 3;
var IMPLICIT5 = 2;
var jsonWriteDefaults = {
  alwaysEmitImplicit: false,
  enumAsInteger: false,
  useProtoFieldName: false
};
function makeWriteOptions2(options) {
  return options ? Object.assign(Object.assign({}, jsonWriteDefaults), options) : jsonWriteDefaults;
}
function toJson(schema, message, options) {
  return compiledWriter2(schema)(makeWriteOptions2(options), message);
}
function toJsonString(schema, message, options) {
  var _a;
  const jsonValue = toJson(schema, message, options);
  return JSON.stringify(jsonValue, null, (_a = options === null || options === void 0 ? void 0 : options.prettySpaces) !== null && _a !== void 0 ? _a : 0);
}
var compiledWriters2 = /* @__PURE__ */ new WeakMap();
function compiledWriter2(desc) {
  let compiled = compiledWriters2.get(desc);
  if (compiled === void 0) {
    compiled = compileMessage3(desc);
  }
  return compiled;
}
function compileMessage3(desc) {
  const typeName = desc.typeName;
  const writeWkt = compileWkt(desc);
  if (writeWkt !== void 0) {
    const foreignField2 = desc.fields[0];
    const compiledWriter4 = (opts, message) => {
      if (message.$typeName !== typeName && foreignField2 !== void 0) {
        throw new FieldError(foreignField2, `cannot use ${foreignField2} with message ${message.$typeName}`, "ForeignFieldError");
      }
      return writeWkt(opts, message);
    };
    compiledWriters2.set(desc, compiledWriter4);
    return compiledWriter4;
  }
  const sortedFields = desc.fields.concat().sort((a, b) => a.number - b.number);
  const foreignField = sortedFields[0];
  const fieldWriters = [];
  const compiledWriter3 = (opts, message) => {
    if (message.$typeName !== typeName && foreignField !== void 0) {
      throw new FieldError(foreignField, `cannot use ${foreignField} with message ${message.$typeName}`, "ForeignFieldError");
    }
    const json = {};
    for (let i = 0; i < fieldWriters.length; i++) {
      fieldWriters[i](opts, message, json);
    }
    if (opts.registry) {
      writeExtensions(json, opts, opts.registry, message, desc);
    }
    return json;
  };
  compiledWriters2.set(desc, compiledWriter3);
  for (const field of sortedFields) {
    fieldWriters.push(compileField2(field));
  }
  return compiledWriter3;
}
function compileWkt(desc) {
  if (!desc.typeName.startsWith("google.protobuf.")) {
    return void 0;
  }
  switch (desc.typeName) {
    case "google.protobuf.Any":
      return (opts, message) => anyToJson(message, opts);
    case "google.protobuf.Timestamp":
      return (opts, message) => timestampToJson(message);
    case "google.protobuf.Duration":
      return (opts, message) => durationToJson(message);
    case "google.protobuf.FieldMask":
      return (opts, message) => fieldMaskToJson(message);
    case "google.protobuf.Struct":
      return (opts, message) => structToJson(message);
    case "google.protobuf.Value":
      return (opts, message) => valueToJson(message);
    case "google.protobuf.ListValue":
      return (opts, message) => listValueToJson(message);
    default:
      if (isWrapperDesc(desc)) {
        const valueField = desc.fields[0];
        const localName = valueField.localName;
        const zero = scalarZeroValue(valueField.scalar, false);
        const writeScalar = compileScalarValue2(valueField);
        return (opts, message) => {
          const value = message[localName];
          return writeScalar(opts, value === void 0 ? zero : value);
        };
      }
      return void 0;
  }
}
function compileField2(field) {
  switch (field.fieldKind) {
    case "scalar":
    case "enum":
    case "message":
      return compileSingularField2(field);
    case "list":
    case "map": {
      const writeValue = field.fieldKind == "list" ? compileListValue(field) : compileMapValue(field);
      const protoName = field.name;
      const jsonKey = field.jsonName;
      const localName = field.localName;
      return (opts, message, json) => {
        const value = writeValue(opts, message[localName]);
        if (value !== void 0) {
          json[opts.useProtoFieldName ? protoName : jsonKey] = value;
        }
      };
    }
  }
}
function compileSingularField2(field) {
  const writeValue = compileSingularValue2(field);
  const protoName = field.name;
  const jsonKey = field.jsonName;
  const localName = field.localName;
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    return (opts, message, json) => {
      const oneof = message[oneofLocalName];
      if (oneof.case === localName) {
        json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, oneof.value);
      }
    };
  }
  if (field.presence != IMPLICIT5) {
    const requiredError = field.presence == LEGACY_REQUIRED3 ? `cannot encode ${field} to JSON: required field not set` : void 0;
    return (opts, message, json) => {
      const value = message[localName];
      if (value !== void 0 && Object.prototype.hasOwnProperty.call(message, localName)) {
        json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value);
      } else if (requiredError !== void 0) {
        throw new Error(requiredError);
      }
    };
  }
  if (field.fieldKind == "enum") {
    const zero = field.enum.values[0].number;
    return (opts, message, json) => {
      const value = message[localName];
      if (value !== zero || opts.alwaysEmitImplicit) {
        json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value);
      }
    };
  }
  switch (field.scalar) {
    case ScalarType.BOOL:
      return (opts, message, json) => {
        const value = message[localName];
        if (value !== false || opts.alwaysEmitImplicit) {
          json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value);
        }
      };
    case ScalarType.STRING:
      return (opts, message, json) => {
        const value = message[localName];
        if (value !== "" || opts.alwaysEmitImplicit) {
          json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value);
        }
      };
    case ScalarType.BYTES:
      return (opts, message, json) => {
        const value = message[localName];
        if (!(value instanceof Uint8Array) || value.byteLength > 0 || opts.alwaysEmitImplicit) {
          json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value);
        }
      };
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return (opts, message, json) => {
        const value = message[localName];
        if (!Object.is(value, 0) || opts.alwaysEmitImplicit) {
          json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value);
        }
      };
    default:
      return (opts, message, json) => {
        const value = message[localName];
        if (value != 0 || opts.alwaysEmitImplicit) {
          json[opts.useProtoFieldName ? protoName : jsonKey] = writeValue(opts, value);
        }
      };
  }
}
function compileFieldValue(field) {
  switch (field.fieldKind) {
    case "scalar":
    case "enum":
    case "message":
      return compileSingularValue2(field);
    case "list":
      return compileListValue(field);
    case "map":
      return compileMapValue(field);
  }
}
function compileSingularValue2(field) {
  switch (field.fieldKind) {
    case "scalar":
      return compileScalarValue2(field);
    case "enum":
      return compileEnumValue(field);
    case "message":
      return compileMessageValue(field);
  }
}
function compileMessageValue(field) {
  const { toMessage } = localMessageMapper(field);
  const writeMessage = compiledWriter2(field.message);
  return (opts, value) => writeMessage(opts, toMessage(value));
}
function compileListValue(field) {
  const writeItem = compileListItemValue(field);
  return (opts, value) => {
    const items = value;
    if (items.length == 0 && !opts.alwaysEmitImplicit) {
      return void 0;
    }
    const jsonArray = [];
    for (let i = 0; i < items.length; i++) {
      jsonArray.push(writeItem(opts, items[i]));
    }
    return jsonArray;
  };
}
function compileListItemValue(field) {
  switch (field.listKind) {
    case "scalar":
      return compileScalarValue2(field);
    case "enum":
      return compileEnumValue(field);
    case "message":
      return compileMessageValue(field);
  }
}
function compileMapValue(field) {
  const writeMapValue = compileMapEntryValue(field);
  return (opts, value) => {
    const record = value;
    const keys = Object.keys(record);
    if (keys.length == 0 && !opts.alwaysEmitImplicit) {
      return void 0;
    }
    const jsonObject = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      jsonObject[key] = writeMapValue(opts, record[key]);
    }
    return jsonObject;
  };
}
function compileMapEntryValue(field) {
  switch (field.mapKind) {
    case "scalar":
      return compileScalarValue2(field);
    case "enum":
      return compileEnumValue(field);
    case "message":
      return compileMessageValue(field);
  }
}
function compileEnumValue(field) {
  const desc = field.enum;
  if (desc.typeName == "google.protobuf.NullValue") {
    return (opts, value) => {
      if (typeof value != "number") {
        throw errorEnumValue(desc, value);
      }
      return null;
    };
  }
  return (opts, value) => {
    var _a, _b;
    if (typeof value != "number") {
      throw errorEnumValue(desc, value);
    }
    if (opts.enumAsInteger) {
      return value;
    }
    return (_b = (_a = desc.value[value]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : value;
  };
}
function errorEnumValue(desc, value) {
  return new Error(`cannot encode ${desc} to JSON: expected number, got ${formatVal(value)}`);
}
function compileScalarValue2(field) {
  switch (field.scalar) {
    // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
    case ScalarType.INT32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32:
    case ScalarType.FIXED32:
    case ScalarType.UINT32:
      return (opts, value) => {
        if (typeof value != "number") {
          throw errorScalarValue(field, value);
        }
        return value;
      };
    // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
    // Either numbers or strings are accepted. Exponent notation is also accepted.
    case ScalarType.FLOAT:
    case ScalarType.DOUBLE:
      return (opts, value) => {
        if (typeof value != "number") {
          throw errorScalarValue(field, value);
        }
        if (Number.isNaN(value))
          return "NaN";
        if (value === Number.POSITIVE_INFINITY)
          return "Infinity";
        if (value === Number.NEGATIVE_INFINITY)
          return "-Infinity";
        return value;
      };
    // string:
    case ScalarType.STRING:
      return (opts, value) => {
        if (typeof value != "string") {
          throw errorScalarValue(field, value);
        }
        return value;
      };
    // bool:
    case ScalarType.BOOL:
      return (opts, value) => {
        if (typeof value != "boolean") {
          throw errorScalarValue(field, value);
        }
        return value;
      };
    // JSON value will be a decimal string. Either numbers or strings are accepted.
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return (opts, value) => {
        if (typeof value == "bigint" || typeof value == "string" || typeof value == "number" && Number.isInteger(value)) {
          return value.toString();
        }
        throw errorScalarValue(field, value);
      };
    // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
    // Either standard or URL-safe base64 encoding with/without paddings are accepted.
    case ScalarType.BYTES:
      return (opts, value) => {
        if (value instanceof Uint8Array) {
          return base64Encode(value);
        }
        throw errorScalarValue(field, value);
      };
  }
}
function errorScalarValue(field, value) {
  var _a;
  return new Error(`cannot encode ${field} to JSON: ${(_a = checkField(field, value)) === null || _a === void 0 ? void 0 : _a.message}`);
}
function writeExtensions(json, opts, registry, message, desc) {
  const unknown = message.$unknown;
  if (unknown === void 0) {
    return;
  }
  const tagSeen = /* @__PURE__ */ new Set();
  for (let i = 0; i < unknown.length; i++) {
    const { no } = unknown[i];
    if (!tagSeen.has(no)) {
      tagSeen.add(no);
      const extension = registry.getExtensionFor(desc, no);
      if (!extension) {
        continue;
      }
      const value = getExtension(message, extension);
      const [container, field] = createExtensionContainer(extension, value);
      const local = container[unsafeLocal];
      const jsonValue = compileFieldValue(field)(opts, local[field.localName]);
      if (jsonValue !== void 0) {
        json[extension.jsonName] = jsonValue;
      }
    }
  }
}
function anyToJson(val, opts) {
  if (val.typeUrl === "") {
    return {};
  }
  const { registry } = opts;
  let message;
  let desc;
  if (registry) {
    message = anyUnpack(val, registry);
    if (message) {
      desc = registry.getMessage(message.$typeName);
    }
  }
  if (!desc || !message) {
    throw new Error(`cannot encode message ${val.$typeName} to JSON: "${val.typeUrl}" is not in the type registry`);
  }
  const json = hasCustomJsonRepresentation(desc) ? {
    value: compiledWriter2(desc)(opts, message)
  } : compiledWriter2(desc)(opts, message);
  json["@type"] = val.typeUrl;
  return json;
}
function durationToJson(val) {
  const seconds = Number(val.seconds);
  const nanos = val.nanos;
  if (seconds > durationSecondsMax || seconds < durationSecondsMin) {
    throw new Error(`cannot encode message ${val.$typeName} to JSON: value out of range`);
  }
  if (seconds > 0 && nanos < 0 || seconds < 0 && nanos > 0) {
    throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos sign must match seconds sign`);
  }
  let text = val.seconds.toString();
  if (nanos !== 0) {
    let nanosStr = Math.abs(nanos).toString();
    nanosStr = "0".repeat(9 - nanosStr.length) + nanosStr;
    if (nanosStr.substring(3) === "000000") {
      nanosStr = nanosStr.substring(0, 3);
    } else if (nanosStr.substring(6) === "000") {
      nanosStr = nanosStr.substring(0, 6);
    }
    text += "." + nanosStr;
    if (nanos < 0 && seconds == 0) {
      text = "-" + text;
    }
  }
  return text + "s";
}
function fieldMaskToJson(val) {
  return val.paths.map((p) => {
    if (protoSnakeCase(protoCamelCase(p)) !== p) {
      throw new Error(`cannot encode message ${val.$typeName} to JSON: lowerCamelCase of path name "${p}" is irreversible`);
    }
    return protoCamelCase(p);
  }).join(",");
}
function structToJson(val) {
  const json = {};
  const keys = Object.keys(val.fields);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    json[key] = valueToJson(val.fields[key]);
  }
  return json;
}
function valueToJson(val) {
  switch (val.kind.case) {
    case "nullValue":
      return null;
    case "numberValue":
      if (!Number.isFinite(val.kind.value)) {
        throw new Error(`${val.$typeName} cannot be NaN or Infinity`);
      }
      return val.kind.value;
    case "boolValue":
      return val.kind.value;
    case "stringValue":
      return val.kind.value;
    case "structValue":
      return structToJson(val.kind.value);
    case "listValue":
      return listValueToJson(val.kind.value);
    default:
      throw new Error(`${val.$typeName} must have a value`);
  }
}
function listValueToJson(val) {
  return val.values.map(valueToJson);
}
function timestampToJson(val) {
  const ms = Number(val.seconds) * 1e3;
  if (ms < timestampMsMin || ms > timestampMsMax) {
    throw new Error(`cannot encode message ${val.$typeName} to JSON: must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive`);
  }
  if (val.nanos < 0) {
    throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos must not be negative`);
  }
  if (val.nanos > 999999999) {
    throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos must not be greater than 99999999`);
  }
  let z = "Z";
  if (val.nanos > 0) {
    const nanosStr = (val.nanos + 1e9).toString().substring(1);
    if (nanosStr.substring(3) === "000000") {
      z = "." + nanosStr.substring(0, 3) + "Z";
    } else if (nanosStr.substring(6) === "000") {
      z = "." + nanosStr.substring(0, 6) + "Z";
    } else {
      z = "." + nanosStr + "Z";
    }
  }
  return new Date(ms).toISOString().replace(".000Z", z);
}

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/from-json.js
var IMPLICIT6 = 2;
function makeReadContext2(options) {
  return Object.assign(Object.assign({ ignoreUnknownFields: false, recursionLimit: 100 }, options), { depth: 0 });
}
function fromJsonString(schema, json, options) {
  return fromJson(schema, parseJsonString(json, schema.typeName), options);
}
function fromJson(schema, json, options) {
  const message = create(schema);
  readMessage(schema, message, json, options);
  return message;
}
function readMessage(schema, message, json, options) {
  try {
    compiledReader2(schema)(message, json, makeReadContext2(options));
  } catch (e) {
    if (isFieldError(e)) {
      throw new Error(`cannot decode ${e.field()} from JSON: ${e.message}`, {
        cause: e
      });
    }
    throw e;
  }
}
var compiledReaders2 = /* @__PURE__ */ new WeakMap();
function compiledReader2(desc) {
  let compiled = compiledReaders2.get(desc);
  if (compiled === void 0) {
    compiled = compileMessage4(desc);
  }
  return compiled;
}
function compileMessage4(desc) {
  const descString = String(desc);
  const readWkt = compileWkt2(desc);
  if (readWkt !== void 0) {
    const compiled2 = (message, json, ctx) => {
      if (++ctx.depth > ctx.recursionLimit) {
        throw new Error(`cannot decode ${descString} from JSON: maximum recursion depth of ${ctx.recursionLimit} reached`);
      }
      readWkt(message, json, ctx);
      ctx.depth--;
    };
    compiledReaders2.set(desc, compiled2);
    return compiled2;
  }
  const typeName = desc.typeName;
  const fieldsByJsonKey = /* @__PURE__ */ new Map();
  const compiled = (message, json, ctx) => {
    var _a;
    if (++ctx.depth > ctx.recursionLimit) {
      throw new Error(`cannot decode ${descString} from JSON: maximum recursion depth of ${ctx.recursionLimit} reached`);
    }
    if (json == null || Array.isArray(json) || typeof json != "object") {
      throw new Error(`cannot decode ${descString} from JSON: ${formatVal(json)}`);
    }
    const oneofSeen = /* @__PURE__ */ new Map();
    const fieldSeen = /* @__PURE__ */ new Set();
    const jsonKeys = Object.keys(json);
    for (let i = 0; i < jsonKeys.length; i++) {
      const jsonKey = jsonKeys[i];
      const jsonValue = json[jsonKey];
      const entry = fieldsByJsonKey.get(jsonKey);
      if (entry !== void 0) {
        const field = entry.field;
        if (fieldSeen.has(field)) {
          throw new FieldError(field, "set multiple times");
        }
        fieldSeen.add(field);
        if (entry.oneofScalarNullSkip && jsonValue === null) {
          continue;
        }
        if (entry.oneof) {
          const seen = oneofSeen.get(entry.oneof);
          if (seen !== void 0) {
            throw new FieldError(entry.oneof, `oneof set multiple times by ${seen.name} and ${field.name}`);
          }
          oneofSeen.set(entry.oneof, field);
        }
        entry.read(message, jsonValue, ctx);
      } else {
        const extension = jsonKey.startsWith("[") && jsonKey.endsWith("]") ? (_a = ctx.registry) === null || _a === void 0 ? void 0 : _a.getExtension(jsonKey.substring(1, jsonKey.length - 1)) : void 0;
        if ((extension === null || extension === void 0 ? void 0 : extension.extendee.typeName) == typeName) {
          const [container, field, get] = createExtensionContainer(extension);
          compileFieldReader2(field)(container[unsafeLocal], jsonValue, ctx);
          setExtension(message, extension, get());
        }
        if (extension === void 0 && !ctx.ignoreUnknownFields) {
          throw new Error(`cannot decode ${descString} from JSON: key "${jsonKey}" is unknown`);
        }
      }
    }
    ctx.depth--;
  };
  compiledReaders2.set(desc, compiled);
  for (const field of desc.fields) {
    const entry = {
      read: compileFieldReader2(field),
      field,
      oneof: field.oneof,
      oneofScalarNullSkip: field.oneof !== void 0 && field.fieldKind == "scalar"
    };
    fieldsByJsonKey.set(field.name, entry).set(field.jsonName, entry);
  }
  return compiled;
}
function compileWkt2(desc) {
  if (!desc.typeName.startsWith("google.protobuf.")) {
    return void 0;
  }
  switch (desc.typeName) {
    case "google.protobuf.Any":
      return (message, json, ctx) => anyFromJson(message, json, ctx);
    case "google.protobuf.Timestamp":
      return (message, json) => timestampFromJson(message, json);
    case "google.protobuf.Duration":
      return (message, json) => durationFromJson(message, json);
    case "google.protobuf.FieldMask":
      return (message, json) => fieldMaskFromJson(message, json);
    case "google.protobuf.Struct":
      return (message, json, ctx) => structFromJson(message, json, ctx);
    case "google.protobuf.Value":
      return (message, json, ctx) => valueFromJson(message, json, ctx);
    case "google.protobuf.ListValue":
      return (message, json, ctx) => listValueFromJson(message, json, ctx);
    default:
      if (isWrapperDesc(desc)) {
        const valueField = desc.fields[0];
        const localName = valueField.localName;
        const scalar = valueField.scalar;
        const longAsString = valueField.longAsString;
        const readScalar = compileScalarConverter(valueField);
        return (message, json) => {
          if (json === null) {
            message[localName] = scalarZeroValue(scalar, longAsString);
          } else {
            message[localName] = readScalar(json);
          }
        };
      }
      return void 0;
  }
}
function compileFieldReader2(field) {
  switch (field.fieldKind) {
    case "scalar":
      return compileScalarFieldReader2(field);
    case "enum":
      return compileEnumFieldReader2(field);
    case "message":
      return compileMessageFieldReader2(field);
    case "list":
      return compileListFieldReader2(field);
    case "map":
      return compileMapFieldReader2(field);
  }
}
function compileScalarFieldReader2(field) {
  const readScalar = compileScalarConverter(field);
  const localName = field.localName;
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    return (message, json) => {
      message[oneofLocalName] = {
        case: localName,
        value: readScalar(json)
      };
    };
  }
  const clear = compileClear(field);
  return (message, json) => {
    if (json === null) {
      clear(message);
    } else {
      message[localName] = readScalar(json);
    }
  };
}
function compileClear(field) {
  const localName = field.localName;
  if (field.presence != IMPLICIT6) {
    return (message) => {
      delete message[localName];
    };
  }
  if (field.fieldKind == "enum") {
    const zero = field.enum.values[0].number;
    return (message) => {
      message[localName] = zero;
    };
  }
  const scalar = field.scalar;
  const longAsString = field.longAsString;
  return (message) => {
    message[localName] = scalarZeroValue(scalar, longAsString);
  };
}
function compileEnumFieldReader2(field) {
  const readEnumValue = compileEnumConverter(field.enum);
  const checkEnum = compileEnumCheck(field.enum);
  const localName = field.localName;
  const nullResets = field.enum.typeName != "google.protobuf.NullValue";
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    return (message, json, ctx) => {
      if (json === null && nullResets) {
        const oneof = message[oneofLocalName];
        if (oneof.case === localName) {
          message[oneofLocalName] = { case: void 0 };
        }
        return;
      }
      const value = readEnumValue(json, ctx.ignoreUnknownFields);
      if (value === tokenIgnoredUnknownEnum) {
        return;
      }
      const check = checkEnum(value);
      if (check !== true) {
        throw new FieldError(field, reasonSingular(field, value, check));
      }
      message[oneofLocalName] = { case: localName, value };
    };
  }
  const clear = compileClear(field);
  return (message, json, ctx) => {
    if (json === null && nullResets) {
      clear(message);
      return;
    }
    const value = readEnumValue(json, ctx.ignoreUnknownFields);
    if (value === tokenIgnoredUnknownEnum) {
      return;
    }
    const check = checkEnum(value);
    if (check !== true) {
      throw new FieldError(field, reasonSingular(field, value, check));
    }
    message[localName] = value;
  };
}
function compileMessageFieldReader2(field) {
  const localName = field.localName;
  const { toMessage, toLocal } = localMessageMapper(field);
  const readChild = compiledReader2(field.message);
  const nullResets = field.message.typeName != "google.protobuf.Value";
  if (field.oneof) {
    const oneofLocalName = field.oneof.localName;
    return (message, json, ctx) => {
      const oneof = message[oneofLocalName];
      if (json === null && nullResets) {
        if (oneof.case === localName) {
          message[oneofLocalName] = { case: void 0 };
        }
        return;
      }
      const child = toMessage(oneof.case === localName ? oneof.value : void 0);
      readChild(child, json, ctx);
      message[oneofLocalName] = { case: localName, value: toLocal(child) };
    };
  }
  return (message, json, ctx) => {
    if (json === null && nullResets) {
      delete message[localName];
      return;
    }
    const child = toMessage(message[localName]);
    readChild(child, json, ctx);
    message[localName] = toLocal(child);
  };
}
function compileListFieldReader2(field) {
  const localName = field.localName;
  const readItem = compileListItemReader(field);
  return (message, json, ctx) => {
    if (json === null) {
      return;
    }
    if (!Array.isArray(json)) {
      throw new FieldError(field, "expected Array, got " + formatVal(json));
    }
    const items = message[localName];
    for (let i = 0; i < json.length; i++) {
      const value = readItem(json[i], ctx, items.length);
      if (value !== tokenIgnoredUnknownEnum) {
        items.push(value);
      }
    }
  };
}
function compileListItemReader(field) {
  switch (field.listKind) {
    case "scalar": {
      const parseScalar = compileScalarParse(field);
      const checkValue = checkScalarValue(field.scalar);
      const toLocal = compileScalarToLocal(field);
      return (json, ctx, index) => {
        if (json === null) {
          throw new FieldError(field, "list item must not be null");
        }
        const value = parseScalar(json);
        const check = checkValue(value);
        if (check !== true) {
          throw new FieldError(field, `list item #${index + 1}: ${reasonSingular(field, value, check)}`);
        }
        return toLocal(value);
      };
    }
    case "enum": {
      const readEnumValue = compileEnumConverter(field.enum);
      const checkEnum = compileEnumCheck(field.enum);
      const nullResets = field.enum.typeName != "google.protobuf.NullValue";
      return (json, ctx, index) => {
        if (json === null && nullResets) {
          throw new FieldError(field, "list item must not be null");
        }
        const value = readEnumValue(json, ctx.ignoreUnknownFields);
        if (value === tokenIgnoredUnknownEnum) {
          return value;
        }
        const check = checkEnum(value);
        if (check !== true) {
          throw new FieldError(field, `list item #${index + 1}: ${reasonSingular(field, value, check)}`);
        }
        return value;
      };
    }
    case "message": {
      const { toMessage, toLocal } = localMessageMapper(field);
      const readChild = compiledReader2(field.message);
      const nullResets = field.message.typeName != "google.protobuf.Value";
      return (json, ctx) => {
        if (json === null && nullResets) {
          throw new FieldError(field, "list item must not be null");
        }
        const child = toMessage(void 0);
        readChild(child, json, ctx);
        return toLocal(child);
      };
    }
  }
}
function compileMapFieldReader2(field) {
  const localName = field.localName;
  const mapKey = field.mapKey;
  const parseMapKey = compileMapKeyParse(mapKey);
  const checkMapKey = checkScalarValue(mapKey);
  let parseValue;
  let checkValue;
  let toLocalValue = (value) => value;
  let nullResets = true;
  switch (field.mapKind) {
    case "scalar": {
      parseValue = compileScalarParse(field);
      checkValue = checkScalarValue(field.scalar);
      toLocalValue = compileScalarToLocal(field);
      break;
    }
    case "enum": {
      const readEnumValue = compileEnumConverter(field.enum);
      parseValue = (json, ctx) => readEnumValue(json, ctx.ignoreUnknownFields);
      checkValue = compileEnumCheck(field.enum);
      nullResets = field.enum.typeName != "google.protobuf.NullValue";
      break;
    }
    case "message": {
      const { toMessage, toLocal } = localMessageMapper(field);
      const readChild = compiledReader2(field.message);
      nullResets = field.message.typeName != "google.protobuf.Value";
      parseValue = (json, ctx) => {
        const child = toMessage(void 0);
        readChild(child, json, ctx);
        return toLocal(child);
      };
      break;
    }
  }
  return (message, json, ctx) => {
    if (json === null) {
      return;
    }
    if (typeof json != "object" || Array.isArray(json)) {
      throw new FieldError(field, "expected object, got " + formatVal(json));
    }
    const record = message[localName];
    const seen = /* @__PURE__ */ new Set();
    const jsonMapKeys = Object.keys(json);
    for (let i = 0; i < jsonMapKeys.length; i++) {
      const jsonMapKey = jsonMapKeys[i];
      const jsonMapValue = json[jsonMapKey];
      const key = parseMapKey(jsonMapKey);
      if (seen.has(key)) {
        throw new FieldError(field, `duplicate map key "${jsonMapKey}"`);
      }
      seen.add(key);
      if (jsonMapValue === null && nullResets) {
        throw new FieldError(field, "map value must not be null");
      }
      const value = parseValue(jsonMapValue, ctx);
      if (value === tokenIgnoredUnknownEnum) {
        continue;
      }
      const checkKey = checkMapKey(key);
      if (checkKey !== true) {
        throw new FieldError(field, `invalid map key: ${reasonSingular({ scalar: mapKey }, key, checkKey)}`);
      }
      if (checkValue !== void 0) {
        const check = checkValue(value);
        if (check !== true) {
          throw new FieldError(field, `map entry ${formatVal(key)}: ${reasonSingular(field, value, check)}`);
        }
      }
      record[key] = toLocalValue(value);
    }
  };
}
var tokenIgnoredUnknownEnum = /* @__PURE__ */ Symbol();
function compileEnumConverter(desc) {
  const zero = desc.values[0].number;
  const values = desc.values;
  return (json, ignoreUnknownFields) => {
    if (json === null) {
      return zero;
    }
    switch (typeof json) {
      case "number":
        if (Number.isInteger(json)) {
          return json;
        }
        break;
      case "string": {
        const value = values.find((ev) => ev.name === json);
        if (value !== void 0) {
          return value.number;
        }
        if (ignoreUnknownFields) {
          return tokenIgnoredUnknownEnum;
        }
        break;
      }
    }
    throw new Error(`cannot decode ${desc} from JSON: ${formatVal(json)}`);
  };
}
function compileEnumCheck(desc) {
  if (desc.open) {
    return checkScalarValue(ScalarType.INT32);
  }
  const values = desc.values;
  return (value) => values.some((v) => v.number === value);
}
function compileScalarConverter(field) {
  const parseScalar = compileScalarParse(field);
  const checkValue = checkScalarValue(field.scalar);
  const toLocal = compileScalarToLocal(field);
  return (json) => {
    const value = parseScalar(json);
    const check = checkValue(value);
    if (check !== true) {
      throw new FieldError(field, reasonSingular(field, value, check));
    }
    return toLocal(value);
  };
}
function compileScalarParse(field) {
  switch (field.scalar) {
    // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
    // Either numbers or strings are accepted. Exponent notation is also accepted.
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return (json) => {
        if (json === "NaN")
          return NaN;
        if (json === "Infinity")
          return Number.POSITIVE_INFINITY;
        if (json === "-Infinity")
          return Number.NEGATIVE_INFINITY;
        if (typeof json == "number") {
          if (Number.isNaN(json)) {
            throw new FieldError(field, "unexpected NaN number");
          }
          if (!Number.isFinite(json)) {
            throw new FieldError(field, "unexpected infinite number");
          }
          return json;
        }
        if (typeof json == "string") {
          if (json === "") {
            return json;
          }
          if (json.trim().length !== json.length) {
            return json;
          }
          const float = Number(json);
          if (!Number.isFinite(float)) {
            return json;
          }
          return float;
        }
        return json;
      };
    // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
    case ScalarType.INT32:
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32:
    case ScalarType.UINT32:
      return int32FromJson;
    // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
    // Either standard or URL-safe base64 encoding with/without paddings are accepted.
    case ScalarType.BYTES:
      return (json) => {
        if (typeof json == "string") {
          if (json === "") {
            return new Uint8Array(0);
          }
          try {
            return base64Decode(json);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            throw new FieldError(field, message);
          }
        }
        return json;
      };
    // int64, sfixed64, sint64, fixed64, uint64: The validation step accepts
    // string and number. string, bool: no conversion.
    default:
      return (json) => json;
  }
}
function compileScalarToLocal(field) {
  const longAsString = field.fieldKind !== "map" && field.longAsString;
  switch (field.scalar) {
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      if (longAsString) {
        return (value) => String(value);
      }
      return (value) => typeof value == "string" || typeof value == "number" ? protoInt64.parse(value) : value;
    case ScalarType.FIXED64:
    case ScalarType.UINT64:
      if (longAsString) {
        return (value) => String(value);
      }
      return (value) => typeof value == "string" || typeof value == "number" ? protoInt64.uParse(value) : value;
    default:
      return (value) => value;
  }
}
function compileMapKeyParse(type) {
  switch (type) {
    case ScalarType.BOOL:
      return (jsonString) => {
        switch (jsonString) {
          case "true":
            return true;
          case "false":
            return false;
        }
        return jsonString;
      };
    case ScalarType.INT32:
    case ScalarType.FIXED32:
    case ScalarType.UINT32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32:
      return int32FromJson;
    case ScalarType.INT64:
    case ScalarType.SINT64:
    case ScalarType.SFIXED64:
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return (jsonString) => /^-?0+$/.test(jsonString) ? "0" : jsonString.replace(/^(-?)0+(?=\d)/, "$1");
    default:
      return (jsonString) => jsonString;
  }
}
function int32FromJson(json) {
  if (typeof json == "string") {
    if (json === "") {
      return json;
    }
    if (json.trim().length !== json.length) {
      return json;
    }
    const num = Number(json);
    if (Number.isNaN(num)) {
      return json;
    }
    return num;
  }
  return json;
}
function parseJsonString(jsonString, typeName) {
  let json;
  try {
    json = JSON.parse(jsonString);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `cannot decode message ${typeName} from JSON: ${message}`,
      // @ts-expect-error we use the ES2022 error CTOR option "cause" for better stack traces
      { cause: e }
    );
  }
  checkDuplicateKeys(jsonString, typeName);
  return json;
}
function checkDuplicateKeys(jsonString, typeName) {
  const stack = [];
  let expectKey = false;
  let i = 0;
  while (i < jsonString.length) {
    switch (jsonString[i]) {
      case "{":
        stack.push(/* @__PURE__ */ new Set());
        expectKey = true;
        i++;
        break;
      case "[":
        stack.push(null);
        expectKey = false;
        i++;
        break;
      case "}":
      case "]":
        stack.pop();
        expectKey = false;
        i++;
        break;
      case ",":
        expectKey = stack[stack.length - 1] != null;
        i++;
        break;
      case ":":
        expectKey = false;
        i++;
        break;
      case '"': {
        const open = i++;
        let escaped = false;
        while (i < jsonString.length) {
          if (jsonString[i] == "\\") {
            escaped = true;
            i += 2;
            continue;
          }
          if (jsonString[i] == '"') {
            break;
          }
          i++;
        }
        const close = i++;
        const seen = stack[stack.length - 1];
        if (expectKey && seen) {
          const name = escaped ? JSON.parse(jsonString.substring(open, close + 1)) : jsonString.substring(open + 1, close);
          if (seen.has(name)) {
            throw new Error(`cannot decode message ${typeName} from JSON: duplicate object key "${name}"`);
          }
          seen.add(name);
        }
        expectKey = false;
        break;
      }
      default:
        i++;
        break;
    }
  }
}
function anyFromJson(any, json, ctx) {
  var _a;
  if (json === null || Array.isArray(json) || typeof json != "object") {
    throw new Error(`cannot decode message ${any.$typeName} from JSON: expected object but got ${formatVal(json)}`);
  }
  if (Object.keys(json).length == 0) {
    return;
  }
  const typeUrl = json["@type"];
  if (typeof typeUrl != "string" || typeUrl == "") {
    throw new Error(`cannot decode message ${any.$typeName} from JSON: "@type" is empty`);
  }
  const typeName = typeUrl.includes("/") ? typeUrl.substring(typeUrl.lastIndexOf("/") + 1) : typeUrl;
  if (!typeName.length) {
    throw new Error(`cannot decode message ${any.$typeName} from JSON: "@type" is invalid`);
  }
  const desc = (_a = ctx.registry) === null || _a === void 0 ? void 0 : _a.getMessage(typeName);
  if (!desc) {
    throw new Error(`cannot decode message ${any.$typeName} from JSON: ${typeUrl} is not in the type registry`);
  }
  const message = create(desc);
  if (hasCustomJsonRepresentation(desc) && Object.prototype.hasOwnProperty.call(json, "value")) {
    compiledReader2(desc)(message, json.value, ctx);
  } else {
    const copy = Object.assign({}, json);
    delete copy["@type"];
    compiledReader2(desc)(message, copy, ctx);
  }
  anyPack(desc, message, any);
}
function timestampFromJson(timestamp, json) {
  if (typeof json !== "string") {
    throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: ${formatVal(json)}`);
  }
  const matches = json.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?(?:Z|([+-][0-9][0-9]:[0-9][0-9]))$/);
  if (!matches) {
    throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: invalid RFC 3339 string`);
  }
  const ms = Date.parse(
    // biome-ignore format: want this to read well
    matches[1] + "-" + matches[2] + "-" + matches[3] + "T" + matches[4] + ":" + matches[5] + ":" + matches[6] + (matches[8] ? matches[8] : "Z")
  );
  if (Number.isNaN(ms)) {
    throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: invalid RFC 3339 string`);
  }
  if (ms < timestampMsMin || ms > timestampMsMax) {
    throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive`);
  }
  timestamp.seconds = protoInt64.parse(ms / 1e3);
  timestamp.nanos = 0;
  if (matches[7]) {
    timestamp.nanos = parseInt("1" + matches[7] + "0".repeat(9 - matches[7].length)) - 1e9;
  }
}
function durationFromJson(duration, json) {
  if (typeof json !== "string") {
    throw new Error(`cannot decode message ${duration.$typeName} from JSON: ${formatVal(json)}`);
  }
  const match = json.match(/^(-?[0-9]+)(?:\.([0-9]+))?s/);
  if (match === null) {
    throw new Error(`cannot decode message ${duration.$typeName} from JSON: ${formatVal(json)}`);
  }
  const longSeconds = Number(match[1]);
  if (longSeconds > durationSecondsMax || longSeconds < durationSecondsMin) {
    throw new Error(`cannot decode message ${duration.$typeName} from JSON: ${formatVal(json)}`);
  }
  duration.seconds = protoInt64.parse(longSeconds);
  if (typeof match[2] !== "string") {
    return;
  }
  const nanosStr = match[2] + "0".repeat(9 - match[2].length);
  duration.nanos = parseInt(nanosStr);
  if (longSeconds < 0 || Object.is(longSeconds, -0)) {
    duration.nanos = -duration.nanos;
  }
}
function fieldMaskFromJson(fieldMask, json) {
  if (typeof json !== "string") {
    throw new Error(`cannot decode message ${fieldMask.$typeName} from JSON: ${formatVal(json)}`);
  }
  if (json === "") {
    return;
  }
  fieldMask.paths = json.split(",").map((path2) => {
    if (path2.includes("_")) {
      throw new Error(`cannot decode message ${fieldMask.$typeName} from JSON: path names must be lowerCamelCase`);
    }
    return protoSnakeCase(path2);
  });
}
function structFromJson(struct, json, ctx) {
  if (typeof json != "object" || json == null || Array.isArray(json)) {
    throw new Error(`cannot decode message ${struct.$typeName} from JSON ${formatVal(json)}`);
  }
  const keys = Object.keys(json);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const parsedValue = create(ValueSchema);
    valueFromJson(parsedValue, json[key], ctx);
    struct.fields[key] = parsedValue;
  }
}
function valueFromJson(value, json, ctx) {
  if (++ctx.depth > ctx.recursionLimit) {
    throw new Error(`cannot decode ${value.$typeName} from JSON: maximum recursion depth of ${ctx.recursionLimit} reached`);
  }
  switch (typeof json) {
    case "number":
      value.kind = { case: "numberValue", value: json };
      break;
    case "string":
      value.kind = { case: "stringValue", value: json };
      break;
    case "boolean":
      value.kind = { case: "boolValue", value: json };
      break;
    case "object":
      if (json === null) {
        value.kind = { case: "nullValue", value: NullValue.NULL_VALUE };
      } else if (Array.isArray(json)) {
        const listValue = create(ListValueSchema);
        listValueFromJson(listValue, json, ctx);
        value.kind = { case: "listValue", value: listValue };
      } else {
        const struct = create(StructSchema);
        structFromJson(struct, json, ctx);
        value.kind = { case: "structValue", value: struct };
      }
      break;
    default:
      throw new Error(`cannot decode message ${value.$typeName} from JSON ${formatVal(json)}`);
  }
  ctx.depth--;
  return value;
}
function listValueFromJson(listValue, json, ctx) {
  if (!Array.isArray(json)) {
    throw new Error(`cannot decode message ${listValue.$typeName} from JSON ${formatVal(json)}`);
  }
  for (let i = 0; i < json.length; i++) {
    const value = create(ValueSchema);
    valueFromJson(value, json[i], ctx);
    listValue.values.push(value);
  }
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/code-string.js
function codeToString(value) {
  const name = Code[value];
  if (typeof name != "string") {
    return value.toString();
  }
  return name[0].toLowerCase() + name.substring(1).replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}
var stringToCode;
function codeFromString(value) {
  if (!stringToCode) {
    stringToCode = {};
    for (const value2 of Object.values(Code)) {
      if (typeof value2 == "string") {
        continue;
      }
      stringToCode[codeToString(value2)] = value2;
    }
  }
  return stringToCode[value];
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/connect-error.js
var ConnectError = class _ConnectError extends Error {
  /**
   * Create a new ConnectError.
   * If no code is provided, code "unknown" is used.
   * Outgoing details are only relevant for the server side - a service may
   * raise an error with details, and it is up to the protocol implementation
   * to encode and send the details along with the error.
   */
  constructor(message, code = Code.Unknown, metadata, outgoingDetails, cause) {
    super(createMessage(message, code));
    this.name = "ConnectError";
    this.isWireError = false;
    Object.setPrototypeOf(this, new.target.prototype);
    this.rawMessage = message;
    this.code = code;
    this.metadata = new Headers(metadata !== null && metadata !== void 0 ? metadata : {});
    this.details = outgoingDetails !== null && outgoingDetails !== void 0 ? outgoingDetails : [];
    this.cause = cause;
  }
  /**
   * Convert any value - typically a caught error into a ConnectError,
   * following these rules:
   * - If the value is already a ConnectError, return it as is.
   * - If the value is an AbortError or TimeoutError from the fetch API, return
   *   the message of the error with code Canceled.
   * - For other Errors, return the error message with code Unknown by default.
   * - For other values, return the values String representation as a message,
   *   with the code Unknown by default.
   * The original value will be used for the "cause" property for the new
   * ConnectError.
   */
  static from(reason, code = Code.Unknown) {
    if (reason instanceof _ConnectError) {
      return reason;
    }
    if (reason instanceof Error) {
      if (reason.name == "AbortError" || reason.name == "TimeoutError") {
        return new _ConnectError(reason.message, Code.Canceled);
      }
      return new _ConnectError(reason.message, code, void 0, void 0, reason);
    }
    return new _ConnectError(String(reason), code, void 0, void 0, reason);
  }
  static [Symbol.hasInstance](v) {
    if (!(v instanceof Error)) {
      return false;
    }
    if (Object.getPrototypeOf(v) === _ConnectError.prototype) {
      return true;
    }
    return v.name === "ConnectError" && "code" in v && typeof v.code === "number" && "metadata" in v && "details" in v && Array.isArray(v.details) && "rawMessage" in v && typeof v.rawMessage == "string" && "cause" in v;
  }
  findDetails(typeOrRegistry) {
    const registry = typeOrRegistry.kind === "message" ? {
      getMessage: (typeName) => typeName === typeOrRegistry.typeName ? typeOrRegistry : void 0
    } : typeOrRegistry;
    const details = [];
    for (const data of this.details) {
      if ("desc" in data) {
        if (registry.getMessage(data.desc.typeName)) {
          details.push(create(data.desc, data.value));
        }
        continue;
      }
      const desc = registry.getMessage(data.type);
      if (desc) {
        try {
          details.push(fromBinary(desc, data.value));
        } catch (_) {
        }
      }
    }
    return details;
  }
};
function createMessage(message, code) {
  return message.length ? `[${codeToString(code)}] ${message}` : `[${codeToString(code)}]`;
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/http-headers.js
function appendHeaders(...headers) {
  const h = new Headers();
  for (const e of headers) {
    e.forEach((value, key) => {
      h.append(key, value);
    });
  }
  return h;
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/any-client.js
function makeAnyClient(service, createMethod) {
  const client = {};
  for (const desc of service.methods) {
    const method = createMethod(desc);
    if (method != null) {
      client[desc.localName] = method;
    }
  }
  return client;
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol/compression.js
var compressedFlag = 1;

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol/limit-io.js
var maxReadMaxBytes = 4294967295;
var maxWriteMaxBytes = maxReadMaxBytes;
var defaultCompressMinBytes = 1024;
function validateReadWriteMaxBytes(readMaxBytes, writeMaxBytes, compressMinBytes) {
  writeMaxBytes !== null && writeMaxBytes !== void 0 ? writeMaxBytes : writeMaxBytes = maxWriteMaxBytes;
  readMaxBytes !== null && readMaxBytes !== void 0 ? readMaxBytes : readMaxBytes = maxReadMaxBytes;
  compressMinBytes !== null && compressMinBytes !== void 0 ? compressMinBytes : compressMinBytes = defaultCompressMinBytes;
  if (writeMaxBytes < 1 || writeMaxBytes > maxWriteMaxBytes) {
    throw new ConnectError(`writeMaxBytes ${writeMaxBytes} must be >= 1 and <= ${maxWriteMaxBytes}`, Code.Internal);
  }
  if (readMaxBytes < 1 || readMaxBytes > maxReadMaxBytes) {
    throw new ConnectError(`readMaxBytes ${readMaxBytes} must be >= 1 and <= ${maxReadMaxBytes}`, Code.Internal);
  }
  return {
    readMaxBytes,
    writeMaxBytes,
    compressMinBytes
  };
}
function assertWriteMaxBytes(writeMaxBytes, bytesWritten) {
  if (bytesWritten > writeMaxBytes) {
    throw new ConnectError(`message size ${bytesWritten} is larger than configured writeMaxBytes ${writeMaxBytes}`, Code.ResourceExhausted);
  }
}
function assertReadMaxBytes(readMaxBytes, bytesRead, totalSizeKnown = false) {
  if (bytesRead > readMaxBytes) {
    let message = `message size is larger than configured readMaxBytes ${readMaxBytes}`;
    if (totalSizeKnown) {
      message = `message size ${bytesRead} is larger than configured readMaxBytes ${readMaxBytes}`;
    }
    throw new ConnectError(message, Code.ResourceExhausted);
  }
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol/envelope.js
function createEnvelopeDecoder(readMaxBytes) {
  return new EnvelopeDecoderImpl(readMaxBytes);
}
var EnvelopeDecoderImpl = class {
  constructor(readMaxBytes) {
    this.readMaxBytes = readMaxBytes;
    this.header = new Uint8Array(5);
    this.headerView = new DataView(this.header.buffer);
    this.buf = [];
  }
  get byteLength() {
    return this.buf.reduce((a, b) => a + b.byteLength, 0);
  }
  decode(chunk) {
    this.buf.push(chunk);
    const envs = [];
    for (; ; ) {
      let env = this.pop();
      if (!env) {
        break;
      }
      envs.push(env);
    }
    return envs;
  }
  // consume an enveloped message
  pop() {
    if (!this.env) {
      this.env = this.head();
      if (!this.env) {
        return void 0;
      }
    }
    if (this.cons(this.env.data)) {
      const env = this.env;
      this.env = void 0;
      return env;
    }
    return void 0;
  }
  // consume header
  head() {
    if (!this.cons(this.header)) {
      return void 0;
    }
    const flags = this.headerView.getUint8(0);
    const length = this.headerView.getUint32(1);
    assertReadMaxBytes(this.readMaxBytes, length, true);
    return {
      flags,
      data: new Uint8Array(length)
    };
  }
  // consume from buffer, fill target
  cons(target) {
    const wantLength = target.byteLength;
    if (this.byteLength < wantLength) {
      return false;
    }
    let offset = 0;
    while (offset < wantLength) {
      const chunk = this.buf.shift();
      if (chunk.byteLength > wantLength - offset) {
        target.set(chunk.subarray(0, wantLength - offset), offset);
        this.buf.unshift(chunk.subarray(wantLength - offset));
        offset += wantLength - offset;
      } else {
        target.set(chunk, offset);
        offset += chunk.byteLength;
      }
    }
    return true;
  }
};
async function envelopeCompress(envelope, compression, compressMinBytes) {
  let { flags, data } = envelope;
  if ((flags & compressedFlag) === compressedFlag) {
    throw new ConnectError("invalid envelope, already compressed", Code.Internal);
  }
  if (compression && data.byteLength >= compressMinBytes) {
    data = await compression.compress(data);
    flags = flags | compressedFlag;
  }
  return { data, flags };
}
async function envelopeDecompress(envelope, compression, readMaxBytes) {
  let { flags, data } = envelope;
  if ((flags & compressedFlag) === compressedFlag) {
    if (!compression) {
      throw new ConnectError("received compressed envelope, but do not know how to decompress", Code.Internal);
    }
    data = await compression.decompress(data, readMaxBytes);
    flags = flags ^ compressedFlag;
  }
  return { data, flags };
}
function encodeEnvelope(flags, data) {
  const bytes = new Uint8Array(data.length + 5);
  bytes.set(data, 5);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  v.setUint8(0, flags);
  v.setUint32(1, data.length);
  return bytes;
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol/async-iterable.js
var __asyncValues = function(o) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
};
var __await = function(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
};
var __asyncGenerator = function(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f) i[n] = f(i[n]);
    }
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
};
var __asyncDelegator = function(o) {
  var i, p;
  return i = {}, verb("next"), verb("throw", function(e) {
    throw e;
  }), verb("return"), i[Symbol.iterator] = function() {
    return this;
  }, i;
  function verb(n, f) {
    i[n] = o[n] ? function(v) {
      return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
    } : f;
  }
};
function pipeTo(source, ...rest) {
  const [transforms, sink, opt] = pickTransformsAndSink(rest);
  let iterable = source;
  let abortable;
  if ((opt === null || opt === void 0 ? void 0 : opt.propagateDownStreamError) === true) {
    iterable = abortable = makeIterableAbortable(iterable);
  }
  iterable = pipe(iterable, ...transforms, { propagateDownStreamError: false });
  return sink(iterable).catch((reason) => {
    if (abortable) {
      return abortable.abort(reason).then(() => Promise.reject(reason));
    }
    return Promise.reject(reason);
  });
}
function pickTransformsAndSink(rest) {
  let opt;
  if (typeof rest[rest.length - 1] != "function") {
    opt = rest.pop();
  }
  const sink = rest.pop();
  return [rest, sink, opt];
}
function sinkAllBytes(readMaxBytes, lengthHint) {
  return async (iterable) => await readAllBytes(iterable, readMaxBytes, lengthHint);
}
function pipe(source, ...rest) {
  return __asyncGenerator(this, arguments, function* pipe_1() {
    var _a;
    const [transforms, opt] = pickTransforms(rest);
    let abortable;
    const sourceIt = source[Symbol.asyncIterator]();
    const cachedSource = {
      [Symbol.asyncIterator]() {
        return sourceIt;
      }
    };
    let iterable = cachedSource;
    if ((opt === null || opt === void 0 ? void 0 : opt.propagateDownStreamError) === true) {
      iterable = abortable = makeIterableAbortable(iterable);
    }
    for (const t of transforms) {
      iterable = t(iterable);
    }
    const it = iterable[Symbol.asyncIterator]();
    try {
      for (; ; ) {
        const r = yield __await(it.next());
        if (r.done === true) {
          break;
        }
        if (!abortable) {
          yield yield __await(r.value);
          continue;
        }
        try {
          yield yield __await(r.value);
        } catch (e) {
          yield __await(abortable.abort(e));
          throw e;
        }
      }
    } finally {
      if ((opt === null || opt === void 0 ? void 0 : opt.propagateDownStreamError) === true) {
        (_a = sourceIt.return) === null || _a === void 0 ? void 0 : _a.call(sourceIt).catch(() => {
        });
      }
    }
  });
}
function pickTransforms(rest) {
  let opt;
  if (typeof rest[rest.length - 1] != "function") {
    opt = rest.pop();
  }
  return [rest, opt];
}
function transformSerializeEnvelope(serialization, endStreamFlag2, endSerialization) {
  if (endStreamFlag2 === void 0 || endSerialization === void 0) {
    return function(iterable) {
      return __asyncGenerator(this, arguments, function* () {
        var _a, e_4, _b, _c;
        try {
          for (var _d = true, iterable_4 = __asyncValues(iterable), iterable_4_1; iterable_4_1 = yield __await(iterable_4.next()), _a = iterable_4_1.done, !_a; _d = true) {
            _c = iterable_4_1.value;
            _d = false;
            const chunk = _c;
            const data = serialization.serialize(chunk);
            yield yield __await({ flags: 0, data });
          }
        } catch (e_4_1) {
          e_4 = { error: e_4_1 };
        } finally {
          try {
            if (!_d && !_a && (_b = iterable_4.return)) yield __await(_b.call(iterable_4));
          } finally {
            if (e_4) throw e_4.error;
          }
        }
      });
    };
  }
  return function(iterable) {
    return __asyncGenerator(this, arguments, function* () {
      var _a, e_5, _b, _c;
      try {
        for (var _d = true, iterable_5 = __asyncValues(iterable), iterable_5_1; iterable_5_1 = yield __await(iterable_5.next()), _a = iterable_5_1.done, !_a; _d = true) {
          _c = iterable_5_1.value;
          _d = false;
          const chunk = _c;
          let data;
          let flags = 0;
          if (chunk.end) {
            flags = flags | endStreamFlag2;
            data = endSerialization.serialize(chunk.value);
          } else {
            data = serialization.serialize(chunk.value);
          }
          yield yield __await({ flags, data });
        }
      } catch (e_5_1) {
        e_5 = { error: e_5_1 };
      } finally {
        try {
          if (!_d && !_a && (_b = iterable_5.return)) yield __await(_b.call(iterable_5));
        } finally {
          if (e_5) throw e_5.error;
        }
      }
    });
  };
}
function transformParseEnvelope(serialization, endStreamFlag2, endSerialization) {
  if (endSerialization && endStreamFlag2 !== void 0) {
    return function(iterable) {
      return __asyncGenerator(this, arguments, function* () {
        var _a, e_6, _b, _c;
        try {
          for (var _d = true, iterable_6 = __asyncValues(iterable), iterable_6_1; iterable_6_1 = yield __await(iterable_6.next()), _a = iterable_6_1.done, !_a; _d = true) {
            _c = iterable_6_1.value;
            _d = false;
            const { flags, data } = _c;
            if ((flags & endStreamFlag2) === endStreamFlag2) {
              yield yield __await({ value: endSerialization.parse(data), end: true });
            } else {
              yield yield __await({ value: serialization.parse(data), end: false });
            }
          }
        } catch (e_6_1) {
          e_6 = { error: e_6_1 };
        } finally {
          try {
            if (!_d && !_a && (_b = iterable_6.return)) yield __await(_b.call(iterable_6));
          } finally {
            if (e_6) throw e_6.error;
          }
        }
      });
    };
  }
  return function(iterable) {
    return __asyncGenerator(this, arguments, function* () {
      var _a, e_7, _b, _c;
      try {
        for (var _d = true, iterable_7 = __asyncValues(iterable), iterable_7_1; iterable_7_1 = yield __await(iterable_7.next()), _a = iterable_7_1.done, !_a; _d = true) {
          _c = iterable_7_1.value;
          _d = false;
          const { flags, data } = _c;
          if (endStreamFlag2 !== void 0 && (flags & endStreamFlag2) === endStreamFlag2) {
            if (endSerialization === null) {
              throw new ConnectError("unexpected end flag", Code.InvalidArgument);
            }
            continue;
          }
          yield yield __await(serialization.parse(data));
        }
      } catch (e_7_1) {
        e_7 = { error: e_7_1 };
      } finally {
        try {
          if (!_d && !_a && (_b = iterable_7.return)) yield __await(_b.call(iterable_7));
        } finally {
          if (e_7) throw e_7.error;
        }
      }
    });
  };
}
function transformCompressEnvelope(compression, compressMinBytes) {
  return function(iterable) {
    return __asyncGenerator(this, arguments, function* () {
      var _a, e_8, _b, _c;
      try {
        for (var _d = true, iterable_8 = __asyncValues(iterable), iterable_8_1; iterable_8_1 = yield __await(iterable_8.next()), _a = iterable_8_1.done, !_a; _d = true) {
          _c = iterable_8_1.value;
          _d = false;
          const env = _c;
          yield yield __await(yield __await(envelopeCompress(env, compression, compressMinBytes)));
        }
      } catch (e_8_1) {
        e_8 = { error: e_8_1 };
      } finally {
        try {
          if (!_d && !_a && (_b = iterable_8.return)) yield __await(_b.call(iterable_8));
        } finally {
          if (e_8) throw e_8.error;
        }
      }
    });
  };
}
function transformDecompressEnvelope(compression, readMaxBytes) {
  return function(iterable) {
    return __asyncGenerator(this, arguments, function* () {
      var _a, e_9, _b, _c;
      try {
        for (var _d = true, iterable_9 = __asyncValues(iterable), iterable_9_1; iterable_9_1 = yield __await(iterable_9.next()), _a = iterable_9_1.done, !_a; _d = true) {
          _c = iterable_9_1.value;
          _d = false;
          const env = _c;
          yield yield __await(yield __await(envelopeDecompress(env, compression, readMaxBytes)));
        }
      } catch (e_9_1) {
        e_9 = { error: e_9_1 };
      } finally {
        try {
          if (!_d && !_a && (_b = iterable_9.return)) yield __await(_b.call(iterable_9));
        } finally {
          if (e_9) throw e_9.error;
        }
      }
    });
  };
}
function transformJoinEnvelopes() {
  return function(iterable) {
    return __asyncGenerator(this, arguments, function* () {
      var _a, e_10, _b, _c;
      try {
        for (var _d = true, iterable_10 = __asyncValues(iterable), iterable_10_1; iterable_10_1 = yield __await(iterable_10.next()), _a = iterable_10_1.done, !_a; _d = true) {
          _c = iterable_10_1.value;
          _d = false;
          const { flags, data } = _c;
          yield yield __await(encodeEnvelope(flags, data));
        }
      } catch (e_10_1) {
        e_10 = { error: e_10_1 };
      } finally {
        try {
          if (!_d && !_a && (_b = iterable_10.return)) yield __await(_b.call(iterable_10));
        } finally {
          if (e_10) throw e_10.error;
        }
      }
    });
  };
}
function transformSplitEnvelope(readMaxBytes) {
  return function(iterable) {
    return __asyncGenerator(this, arguments, function* () {
      var _a, e_11, _b, _c;
      const buffer = createEnvelopeDecoder(readMaxBytes);
      try {
        for (var _d = true, iterable_11 = __asyncValues(iterable), iterable_11_1; iterable_11_1 = yield __await(iterable_11.next()), _a = iterable_11_1.done, !_a; _d = true) {
          _c = iterable_11_1.value;
          _d = false;
          const chunk = _c;
          for (const env of buffer.decode(chunk)) {
            yield yield __await(env);
          }
        }
      } catch (e_11_1) {
        e_11 = { error: e_11_1 };
      } finally {
        try {
          if (!_d && !_a && (_b = iterable_11.return)) yield __await(_b.call(iterable_11));
        } finally {
          if (e_11) throw e_11.error;
        }
      }
      if (buffer.byteLength > 0) {
        throw new ConnectError("protocol error: incomplete envelope", Code.InvalidArgument);
      }
    });
  };
}
async function readAllBytes(iterable, readMaxBytes, lengthHint) {
  var _a, e_12, _b, _c, _d, e_13, _e, _f;
  const [ok, hint] = parseLengthHint(lengthHint);
  if (ok) {
    if (hint > readMaxBytes) {
      assertReadMaxBytes(readMaxBytes, hint, true);
    }
    const buffer = new Uint8Array(hint);
    let offset2 = 0;
    try {
      for (var _g = true, iterable_12 = __asyncValues(iterable), iterable_12_1; iterable_12_1 = await iterable_12.next(), _a = iterable_12_1.done, !_a; _g = true) {
        _c = iterable_12_1.value;
        _g = false;
        const chunk = _c;
        if (offset2 + chunk.byteLength > hint) {
          throw new ConnectError(`protocol error: promised ${hint} bytes, received ${offset2 + chunk.byteLength}`, Code.InvalidArgument);
        }
        buffer.set(chunk, offset2);
        offset2 += chunk.byteLength;
      }
    } catch (e_12_1) {
      e_12 = { error: e_12_1 };
    } finally {
      try {
        if (!_g && !_a && (_b = iterable_12.return)) await _b.call(iterable_12);
      } finally {
        if (e_12) throw e_12.error;
      }
    }
    if (offset2 < hint) {
      throw new ConnectError(`protocol error: promised ${hint} bytes, received ${offset2}`, Code.InvalidArgument);
    }
    return buffer;
  }
  const chunks = [];
  let count = 0;
  try {
    for (var _h = true, iterable_13 = __asyncValues(iterable), iterable_13_1; iterable_13_1 = await iterable_13.next(), _d = iterable_13_1.done, !_d; _h = true) {
      _f = iterable_13_1.value;
      _h = false;
      const chunk = _f;
      count += chunk.byteLength;
      assertReadMaxBytes(readMaxBytes, count);
      chunks.push(chunk);
    }
  } catch (e_13_1) {
    e_13 = { error: e_13_1 };
  } finally {
    try {
      if (!_h && !_d && (_e = iterable_13.return)) await _e.call(iterable_13);
    } finally {
      if (e_13) throw e_13.error;
    }
  }
  const all = new Uint8Array(count);
  let offset = 0;
  for (let chunk = chunks.shift(); chunk; chunk = chunks.shift()) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return all;
}
function parseLengthHint(lengthHint) {
  if (lengthHint === void 0 || lengthHint === null) {
    return [false, 0];
  }
  const n = typeof lengthHint == "string" ? parseInt(lengthHint, 10) : lengthHint;
  if (!Number.isSafeInteger(n) || n < 0) {
    return [false, n];
  }
  return [true, n];
}
function makeIterableAbortable(iterable) {
  const innerCandidate = iterable[Symbol.asyncIterator]();
  if (innerCandidate.throw === void 0) {
    throw new Error("AsyncIterable does not implement throw");
  }
  const inner = innerCandidate;
  let aborted;
  let resultPromise;
  let it = {
    next() {
      resultPromise = inner.next().finally(() => {
        resultPromise = void 0;
      });
      return resultPromise;
    },
    throw(e) {
      return inner.throw(e);
    }
  };
  if (innerCandidate.return !== void 0) {
    it = Object.assign(Object.assign({}, it), { return(value) {
      return inner.return(value);
    } });
  }
  let used = false;
  return {
    abort(reason) {
      if (aborted) {
        return aborted.state;
      }
      const f = () => {
        return inner.throw(reason).then((r) => r.done === true ? "completed" : "caught", () => "rethrown");
      };
      if (resultPromise) {
        aborted = { reason, state: resultPromise.then(f, f) };
        return aborted.state;
      }
      aborted = { reason, state: f() };
      return aborted.state;
    },
    [Symbol.asyncIterator]() {
      if (used) {
        throw new Error("AsyncIterable cannot be re-used");
      }
      used = true;
      return it;
    }
  };
}
function createAsyncIterable(items) {
  return __asyncGenerator(this, arguments, function* createAsyncIterable_1() {
    yield __await(yield* __asyncDelegator(__asyncValues(items)));
  });
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/promise-client.js
var __asyncValues2 = function(o) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
};
var __await2 = function(v) {
  return this instanceof __await2 ? (this.v = v, this) : new __await2(v);
};
var __asyncDelegator2 = function(o) {
  var i, p;
  return i = {}, verb("next"), verb("throw", function(e) {
    throw e;
  }), verb("return"), i[Symbol.iterator] = function() {
    return this;
  }, i;
  function verb(n, f) {
    i[n] = o[n] ? function(v) {
      return (p = !p) ? { value: __await2(o[n](v)), done: false } : f ? f(v) : v;
    } : f;
  }
};
var __asyncGenerator2 = function(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f) i[n] = f(i[n]);
    }
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await2 ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
};
function createClient(service, transport) {
  return makeAnyClient(service, (method) => {
    switch (method.methodKind) {
      case "unary":
        return createUnaryFn(transport, method);
      case "server_streaming":
        return createServerStreamingFn(transport, method);
      case "client_streaming":
        return createClientStreamingFn(transport, method);
      case "bidi_streaming":
        return createBiDiStreamingFn(transport, method);
      default:
        return null;
    }
  });
}
function createUnaryFn(transport, method) {
  return async (input, options) => {
    var _a, _b;
    const response = await transport.unary(method, options === null || options === void 0 ? void 0 : options.signal, options === null || options === void 0 ? void 0 : options.timeoutMs, options === null || options === void 0 ? void 0 : options.headers, input, options === null || options === void 0 ? void 0 : options.contextValues);
    (_a = options === null || options === void 0 ? void 0 : options.onHeader) === null || _a === void 0 ? void 0 : _a.call(options, response.header);
    (_b = options === null || options === void 0 ? void 0 : options.onTrailer) === null || _b === void 0 ? void 0 : _b.call(options, response.trailer);
    return response.message;
  };
}
function createServerStreamingFn(transport, method) {
  return (input, options) => handleStreamResponse(transport.stream(method, options === null || options === void 0 ? void 0 : options.signal, options === null || options === void 0 ? void 0 : options.timeoutMs, options === null || options === void 0 ? void 0 : options.headers, createAsyncIterable([input]), options === null || options === void 0 ? void 0 : options.contextValues), options);
}
function createClientStreamingFn(transport, method) {
  return async (request3, options) => {
    var _a, e_1, _b, _c;
    var _d, _e;
    const response = await transport.stream(method, options === null || options === void 0 ? void 0 : options.signal, options === null || options === void 0 ? void 0 : options.timeoutMs, options === null || options === void 0 ? void 0 : options.headers, request3, options === null || options === void 0 ? void 0 : options.contextValues);
    (_d = options === null || options === void 0 ? void 0 : options.onHeader) === null || _d === void 0 ? void 0 : _d.call(options, response.header);
    let singleMessage;
    let count = 0;
    try {
      for (var _f = true, _g = __asyncValues2(response.message), _h; _h = await _g.next(), _a = _h.done, !_a; _f = true) {
        _c = _h.value;
        _f = false;
        const message = _c;
        singleMessage = message;
        count++;
      }
    } catch (e_1_1) {
      e_1 = { error: e_1_1 };
    } finally {
      try {
        if (!_f && !_a && (_b = _g.return)) await _b.call(_g);
      } finally {
        if (e_1) throw e_1.error;
      }
    }
    if (!singleMessage) {
      throw new ConnectError("protocol error: missing response message", Code.Unimplemented);
    }
    if (count > 1) {
      throw new ConnectError("protocol error: received extra messages for client streaming method", Code.Unimplemented);
    }
    (_e = options === null || options === void 0 ? void 0 : options.onTrailer) === null || _e === void 0 ? void 0 : _e.call(options, response.trailer);
    return singleMessage;
  };
}
function createBiDiStreamingFn(transport, method) {
  return (request3, options) => handleStreamResponse(transport.stream(method, options === null || options === void 0 ? void 0 : options.signal, options === null || options === void 0 ? void 0 : options.timeoutMs, options === null || options === void 0 ? void 0 : options.headers, request3, options === null || options === void 0 ? void 0 : options.contextValues), options);
}
function handleStreamResponse(stream, options) {
  const it = (function() {
    return __asyncGenerator2(this, arguments, function* () {
      var _a, _b;
      const response = yield __await2(stream);
      (_a = options === null || options === void 0 ? void 0 : options.onHeader) === null || _a === void 0 ? void 0 : _a.call(options, response.header);
      yield __await2(yield* __asyncDelegator2(__asyncValues2(response.message)));
      (_b = options === null || options === void 0 ? void 0 : options.onTrailer) === null || _b === void 0 ? void 0 : _b.call(options, response.trailer);
    });
  })()[Symbol.asyncIterator]();
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => it.next()
    })
  };
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol/signals.js
function createLinkedAbortController(...signals) {
  const controller = new AbortController();
  const sa = signals.filter((s) => s !== void 0).concat(controller.signal);
  for (const signal of sa) {
    if (signal.aborted) {
      onAbort.apply(signal);
      break;
    }
    signal.addEventListener("abort", onAbort);
  }
  function onAbort() {
    if (!controller.signal.aborted) {
      controller.abort(getAbortSignalReason(this));
    }
    for (const signal of sa) {
      signal.removeEventListener("abort", onAbort);
    }
  }
  return controller;
}
function createDeadlineSignal(timeoutMs) {
  const controller = new AbortController();
  const listener = () => {
    controller.abort(new ConnectError("the operation timed out", Code.DeadlineExceeded));
  };
  let timeoutId;
  if (timeoutMs !== void 0) {
    if (timeoutMs <= 0)
      listener();
    else
      timeoutId = setTimeout(listener, timeoutMs);
  }
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId)
  };
}
function getAbortSignalReason(signal) {
  if (!signal.aborted) {
    return void 0;
  }
  if (signal.reason !== void 0) {
    return signal.reason;
  }
  const e = new Error("This operation was aborted");
  e.name = "AbortError";
  return e;
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/context-values.js
function createContextValues() {
  return {
    get(key) {
      return key.id in this ? this[key.id] : key.defaultValue;
    },
    set(key, value) {
      this[key.id] = value;
      return this;
    },
    delete(key) {
      delete this[key.id];
      return this;
    }
  };
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-grpc/headers.js
var headerEncoding = "Grpc-Encoding";
var headerAcceptEncoding = "Grpc-Accept-Encoding";
var headerTimeout = "Grpc-Timeout";
var headerGrpcStatus = "Grpc-Status";
var headerGrpcMessage = "Grpc-Message";
var headerGrpcDetails = "Grpc-Status-Details-Bin";

// node_modules/.pnpm/@bufbuild+protobuf@2.14.1/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/service.js
function serviceDesc(file, path2, ...paths) {
  if (paths.length > 0) {
    throw new Error();
  }
  return file.services[path2];
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/headers.js
var headerContentType = "Content-Type";
var headerUnaryContentLength = "Content-Length";
var headerUnaryEncoding = "Content-Encoding";
var headerStreamEncoding = "Connect-Content-Encoding";
var headerUnaryAcceptEncoding = "Accept-Encoding";
var headerStreamAcceptEncoding = "Connect-Accept-Encoding";
var headerTimeout2 = "Connect-Timeout-Ms";
var headerProtocolVersion = "Connect-Protocol-Version";
var headerDate = "Date";
var headerHost = "Host";
var headerTrailer = "Trailer";
var headerUserAgent = "User-Agent";
var headerUnaryTrailerPrefix = "Trailer-";

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol/protocol-headers.js
var protocolHeaders = new Set([
  // HTTP headers.
  headerContentType,
  headerUnaryContentLength,
  headerUnaryEncoding,
  headerHost,
  headerUserAgent,
  headerTrailer,
  headerDate,
  // Connect headers.
  headerUnaryAcceptEncoding,
  headerUnaryTrailerPrefix,
  headerStreamEncoding,
  headerStreamAcceptEncoding,
  headerTimeout2,
  headerProtocolVersion,
  // gRPC headers.
  headerEncoding,
  headerAcceptEncoding,
  headerTimeout,
  headerGrpcStatus,
  headerGrpcMessage,
  headerGrpcDetails
].map((name) => name.toLowerCase()));
function mergeNonProtocolHeaders(into, from) {
  from.forEach((value, key) => {
    if (!protocolHeaders.has(key.toLowerCase())) {
      into.append(key, value);
    }
  });
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol/create-method-url.js
function createMethodUrl(baseUrl, method) {
  return baseUrl.toString().replace(/\/?$/, `/${method.parent.typeName}/${method.name}`);
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol/normalize.js
function normalize(desc, message) {
  return create(desc, message);
}
function normalizeIterable(desc, input) {
  function transform(result) {
    if (result.done === true) {
      return result;
    }
    return {
      done: result.done,
      value: normalize(desc, result.value)
    };
  }
  return {
    [Symbol.asyncIterator]() {
      const it = input[Symbol.asyncIterator]();
      const res = {
        next: () => it.next().then(transform)
      };
      if (it.throw !== void 0) {
        res.throw = (e) => it.throw(e).then(transform);
      }
      if (it.return !== void 0) {
        res.return = (v) => it.return(v).then(transform);
      }
      return res;
    }
  };
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/interceptor.js
function applyInterceptors(next, interceptors) {
  if (!interceptors) {
    return next;
  }
  for (const i of interceptors.concat().reverse()) {
    next = i(next);
  }
  return next;
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol/serialization.js
function getJsonOptions(options) {
  var _a;
  const o = Object.assign({}, options);
  (_a = o.ignoreUnknownFields) !== null && _a !== void 0 ? _a : o.ignoreUnknownFields = true;
  return o;
}
function createMethodSerializationLookup(method, binaryOptions, jsonOptions, limitOptions) {
  const inputBinary = limitSerialization(createBinarySerialization(method.input, binaryOptions), limitOptions);
  const inputJson = limitSerialization(createJsonSerialization(method.input, jsonOptions), limitOptions);
  const outputBinary = limitSerialization(createBinarySerialization(method.output, binaryOptions), limitOptions);
  const outputJson = limitSerialization(createJsonSerialization(method.output, jsonOptions), limitOptions);
  return {
    getI(useBinaryFormat) {
      return useBinaryFormat ? inputBinary : inputJson;
    },
    getO(useBinaryFormat) {
      return useBinaryFormat ? outputBinary : outputJson;
    }
  };
}
function limitSerialization(serialization, limitOptions) {
  return {
    serialize(data) {
      const bytes = serialization.serialize(data);
      assertWriteMaxBytes(limitOptions.writeMaxBytes, bytes.byteLength);
      return bytes;
    },
    parse(data) {
      assertReadMaxBytes(limitOptions.readMaxBytes, data.byteLength, true);
      return serialization.parse(data);
    }
  };
}
function createBinarySerialization(desc, options) {
  return {
    parse(data) {
      try {
        return fromBinary(desc, data, options);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        throw new ConnectError(`parse binary: ${m}`, Code.Internal);
      }
    },
    serialize(data) {
      try {
        return toBinary(desc, data, options);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        throw new ConnectError(`serialize binary: ${m}`, Code.Internal);
      }
    }
  };
}
function createJsonSerialization(desc, options) {
  var _a, _b;
  const textEncoder = (_a = options === null || options === void 0 ? void 0 : options.textEncoder) !== null && _a !== void 0 ? _a : new TextEncoder();
  const textDecoder = (_b = options === null || options === void 0 ? void 0 : options.textDecoder) !== null && _b !== void 0 ? _b : new TextDecoder();
  const o = getJsonOptions(options);
  return {
    parse(data) {
      try {
        const json = textDecoder.decode(data);
        return fromJsonString(desc, json, o);
      } catch (e) {
        throw ConnectError.from(e, Code.InvalidArgument);
      }
    },
    serialize(data) {
      try {
        const json = toJsonString(desc, data, o);
        return textEncoder.encode(json);
      } catch (e) {
        throw ConnectError.from(e, Code.Internal);
      }
    }
  };
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/content-type.js
var contentTypeRegExp = /^application\/(connect\+)?(?:(json)(?:; ?charset=utf-?8)?|(proto))$/i;
var contentTypeUnaryProto = "application/proto";
var contentTypeUnaryJson = "application/json";
var contentTypeStreamProto = "application/connect+proto";
var contentTypeStreamJson = "application/connect+json";
function parseContentType(contentType) {
  const match = contentType === null || contentType === void 0 ? void 0 : contentType.match(contentTypeRegExp);
  if (!match) {
    return void 0;
  }
  const stream = !!match[1];
  const binary = !!match[3];
  return { stream, binary };
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/error-json.js
var __rest = function(s, e) {
  var t = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]];
    }
  return t;
};
function errorFromJson(jsonValue, metadata, fallback) {
  var _a;
  if (metadata) {
    new Headers(metadata).forEach((value, key) => fallback.metadata.append(key, value));
  }
  if (typeof jsonValue !== "object" || jsonValue == null || Array.isArray(jsonValue)) {
    throw fallback;
  }
  let code = fallback.code;
  if ("code" in jsonValue && typeof jsonValue.code === "string") {
    code = (_a = codeFromString(jsonValue.code)) !== null && _a !== void 0 ? _a : code;
  }
  const message = jsonValue.message;
  if (message != null && typeof message !== "string") {
    throw fallback;
  }
  const error2 = new ConnectError(message !== null && message !== void 0 ? message : "", code, metadata);
  error2.isWireError = true;
  if ("details" in jsonValue && Array.isArray(jsonValue.details)) {
    for (const detail of jsonValue.details) {
      if (detail === null || typeof detail != "object" || Array.isArray(detail) || typeof detail.type != "string" || typeof detail.value != "string") {
        throw fallback;
      }
      try {
        error2.details.push({
          type: detail.type,
          value: base64Decode(detail.value),
          debug: detail.debug
        });
      } catch (e) {
        throw fallback;
      }
    }
  }
  return error2;
}
function errorFromJsonBytes(bytes, metadata, fallback) {
  let jsonValue;
  try {
    jsonValue = JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    throw fallback;
  }
  return errorFromJson(jsonValue, metadata, fallback);
}
function errorToJson(error2, jsonWriteOptions) {
  const o = {
    code: codeToString(error2.code)
  };
  if (error2.rawMessage.length > 0) {
    o.message = error2.rawMessage;
  }
  if (error2.details.length > 0) {
    o.details = error2.details.map((detail) => {
      if ("desc" in detail) {
        const msg = create(detail.desc, detail.value);
        const i = {
          type: detail.desc.typeName,
          value: toBinary(detail.desc, msg)
        };
        try {
          i.debug = toJson(detail.desc, msg, jsonWriteOptions);
        } catch (e) {
        }
        return i;
      }
      return detail;
    }).map((_a) => {
      var { value } = _a, rest = __rest(_a, ["value"]);
      return Object.assign(Object.assign({}, rest), { value: base64Encode(value, "std_raw") });
    });
  }
  return o;
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/end-stream.js
var endStreamFlag = 2;
function endStreamFromJson(data) {
  const parseErr = new ConnectError("invalid end stream", Code.Unknown);
  let jsonValue;
  try {
    jsonValue = JSON.parse(typeof data == "string" ? data : new TextDecoder().decode(data));
  } catch (e) {
    throw parseErr;
  }
  if (typeof jsonValue != "object" || jsonValue == null || Array.isArray(jsonValue)) {
    throw parseErr;
  }
  const metadata = new Headers();
  if ("metadata" in jsonValue) {
    if (typeof jsonValue.metadata != "object" || jsonValue.metadata == null || Array.isArray(jsonValue.metadata)) {
      throw parseErr;
    }
    for (const [key, values] of Object.entries(jsonValue.metadata)) {
      if (!Array.isArray(values) || values.some((value) => typeof value != "string")) {
        throw parseErr;
      }
      for (const value of values) {
        metadata.append(key, value);
      }
    }
  }
  const error2 = "error" in jsonValue && jsonValue.error != null ? errorFromJson(jsonValue.error, metadata, parseErr) : void 0;
  return { metadata, error: error2 };
}
function endStreamToJson(metadata, error2, jsonWriteOptions) {
  const es = {};
  if (error2 !== void 0) {
    es.error = errorToJson(error2, jsonWriteOptions);
    if (!error2.isWireError) {
      mergeNonProtocolHeaders(metadata, error2.metadata);
    }
  }
  let hasMetadata = false;
  const md = {};
  metadata.forEach((value, key) => {
    hasMetadata = true;
    md[key] = [value];
  });
  if (hasMetadata) {
    es.metadata = md;
  }
  return es;
}
function createEndStreamSerialization(options) {
  const textEncoder = new TextEncoder();
  return {
    serialize(data) {
      try {
        const jsonObject = endStreamToJson(data.metadata, data.error, options);
        const jsonString = JSON.stringify(jsonObject);
        return textEncoder.encode(jsonString);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        throw new ConnectError(`failed to serialize EndStreamResponse: ${m}`, Code.Internal);
      }
    },
    parse(data) {
      try {
        return endStreamFromJson(data);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        throw new ConnectError(`failed to parse EndStreamResponse: ${m}`, Code.InvalidArgument);
      }
    }
  };
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/http-status.js
function codeFromHttpStatus(httpStatus) {
  switch (httpStatus) {
    case 400:
      return Code.Internal;
    case 401:
      return Code.Unauthenticated;
    case 403:
      return Code.PermissionDenied;
    case 404:
      return Code.Unimplemented;
    case 429:
      return Code.Unavailable;
    case 502:
      return Code.Unavailable;
    case 503:
      return Code.Unavailable;
    case 504:
      return Code.Unavailable;
    default:
      return Code.Unknown;
  }
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/trailer-mux.js
function trailerDemux(header) {
  const h = new Headers(), t = new Headers();
  header.forEach((value, key) => {
    if (key.toLowerCase().startsWith("trailer-")) {
      t.append(key.substring(8), value);
    } else {
      h.append(key, value);
    }
  });
  return [h, t];
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/version.js
var protocolVersion = "1";

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/request-header.js
function requestHeader(methodKind, useBinaryFormat, timeoutMs, userProvidedHeaders, setUserAgent) {
  const result = new Headers(userProvidedHeaders !== null && userProvidedHeaders !== void 0 ? userProvidedHeaders : {});
  if (timeoutMs !== void 0) {
    result.set(headerTimeout2, `${timeoutMs}`);
  }
  result.set(headerContentType, methodKind == "unary" ? useBinaryFormat ? contentTypeUnaryProto : contentTypeUnaryJson : useBinaryFormat ? contentTypeStreamProto : contentTypeStreamJson);
  result.set(headerProtocolVersion, protocolVersion);
  if (!result.has(headerUserAgent) && setUserAgent) {
    result.set(headerUserAgent, "connect-es/2.2.0");
  }
  return result;
}
function requestHeaderWithCompression(methodKind, useBinaryFormat, timeoutMs, userProvidedHeaders, acceptCompression, sendCompression, setUserAgent) {
  const result = requestHeader(methodKind, useBinaryFormat, timeoutMs, userProvidedHeaders, setUserAgent);
  if (sendCompression != null) {
    const name = methodKind == "unary" ? headerUnaryEncoding : headerStreamEncoding;
    result.set(name, sendCompression.name);
  }
  if (acceptCompression.length > 0) {
    const name = methodKind == "unary" ? headerUnaryAcceptEncoding : headerStreamAcceptEncoding;
    result.set(name, acceptCompression.map((c) => c.name).join(","));
  }
  return result;
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/validate-response.js
function validateResponse(methodKind, useBinaryFormat, status, headers) {
  const mimeType = headers.get(headerContentType);
  const parsedType = parseContentType(mimeType);
  if (status !== 200) {
    const errorFromStatus = new ConnectError(`HTTP ${status}`, codeFromHttpStatus(status), headers);
    if (methodKind == "unary" && parsedType && !parsedType.binary) {
      return { isUnaryError: true, unaryError: errorFromStatus };
    }
    throw errorFromStatus;
  }
  const allowedContentType = {
    binary: useBinaryFormat,
    stream: methodKind !== "unary"
  };
  if ((parsedType === null || parsedType === void 0 ? void 0 : parsedType.binary) !== allowedContentType.binary || parsedType.stream !== allowedContentType.stream) {
    throw new ConnectError(`unsupported content type ${mimeType}`, parsedType === void 0 ? Code.Unknown : Code.Internal, headers);
  }
  return { isUnaryError: false };
}
function validateResponseWithCompression(methodKind, acceptCompression, useBinaryFormat, status, headers) {
  let compression;
  const encoding = headers.get(methodKind == "unary" ? headerUnaryEncoding : headerStreamEncoding);
  if (encoding != null && encoding.toLowerCase() !== "identity") {
    compression = acceptCompression.find((c) => c.name === encoding);
    if (!compression) {
      throw new ConnectError(`unsupported response encoding "${encoding}"`, Code.Internal, headers);
    }
  }
  return Object.assign({ compression }, validateResponse(methodKind, useBinaryFormat, status, headers));
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/get-request.js
var contentTypePrefix = "application/";
function encodeMessageForUrl(message, useBase64) {
  if (useBase64) {
    return base64Encode(message, "url");
  }
  return encodeURIComponent(new TextDecoder().decode(message));
}
function transformConnectPostToGetRequest(request3, message, useBase64) {
  let query = `?connect=v${protocolVersion}`;
  let compressionQuery = "";
  const compression = request3.header.get(headerUnaryEncoding);
  if (compression !== null && compression !== "identity") {
    compressionQuery = "&compression=" + encodeURIComponent(compression);
    useBase64 = true;
  }
  if (useBase64) {
    query += "&base64=1";
  }
  query += compressionQuery;
  const contentType = request3.header.get(headerContentType);
  if ((contentType === null || contentType === void 0 ? void 0 : contentType.indexOf(contentTypePrefix)) === 0) {
    query += "&encoding=" + encodeURIComponent(contentType.slice(contentTypePrefix.length));
  }
  query += "&message=" + encodeMessageForUrl(message, useBase64);
  const url = request3.url + query;
  const header = new Headers(request3.header);
  for (const h of [
    headerProtocolVersion,
    headerContentType,
    headerUnaryContentLength,
    headerUnaryEncoding,
    headerUnaryAcceptEncoding
  ]) {
    header.delete(h);
  }
  return Object.assign(Object.assign({}, request3), {
    requestMethod: "GET",
    url,
    header
  });
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol/run-call.js
function runUnaryCall(opt) {
  const next = applyInterceptors(opt.next, opt.interceptors);
  const [signal, abort, done] = setupSignal(opt);
  const req = Object.assign(Object.assign({}, opt.req), { message: normalize(opt.req.method.input, opt.req.message), signal });
  return next(req).then((res) => {
    done();
    return res;
  }, abort);
}
function runStreamingCall(opt) {
  const next = applyInterceptors(opt.next, opt.interceptors);
  const [signal, abort, done] = setupSignal(opt);
  const req = Object.assign(Object.assign({}, opt.req), { message: normalizeIterable(opt.req.method.input, opt.req.message), signal });
  let doneCalled = false;
  signal.addEventListener("abort", function() {
    var _a, _b;
    const it = opt.req.message[Symbol.asyncIterator]();
    if (!doneCalled) {
      (_a = it.throw) === null || _a === void 0 ? void 0 : _a.call(it, this.reason).catch(() => {
      });
    }
    (_b = it.return) === null || _b === void 0 ? void 0 : _b.call(it).catch(() => {
    });
  });
  return next(req).then((res) => {
    return Object.assign(Object.assign({}, res), { message: {
      [Symbol.asyncIterator]() {
        const it = res.message[Symbol.asyncIterator]();
        return {
          next() {
            if (!doneCalled && signal.aborted) {
              return abort(getAbortSignalReason(signal));
            }
            return it.next().then((r) => {
              if (r.done == true) {
                doneCalled = true;
                done();
              }
              return r;
            }, abort);
          }
          // We deliberately omit throw/return.
        };
      }
    } });
  }, abort);
}
function setupSignal(opt) {
  const { signal, cleanup } = createDeadlineSignal(opt.timeoutMs);
  const controller = createLinkedAbortController(opt.signal, signal);
  return [
    controller.signal,
    function abort(reason) {
      const e = controller.signal.aborted ? ConnectError.from(getAbortSignalReason(controller.signal), Code.Canceled) : ConnectError.from(reason);
      controller.abort(e);
      cleanup();
      return Promise.reject(e);
    },
    function done() {
      cleanup();
      controller.abort();
    }
  ];
}

// node_modules/.pnpm/@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1/node_modules/@connectrpc/connect/dist/esm/protocol-connect/transport.js
var __asyncValues3 = function(o) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
};
var __await3 = function(v) {
  return this instanceof __await3 ? (this.v = v, this) : new __await3(v);
};
var __asyncGenerator3 = function(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f) i[n] = f(i[n]);
    }
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await3 ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
};
function createTransport(opt) {
  return {
    async unary(method, signal, timeoutMs, header, message, contextValues) {
      const serialization = createMethodSerializationLookup(method, opt.binaryOptions, opt.jsonOptions, opt);
      timeoutMs = timeoutMs === void 0 ? opt.defaultTimeoutMs : timeoutMs <= 0 ? void 0 : timeoutMs;
      return await runUnaryCall({
        interceptors: opt.interceptors,
        signal,
        timeoutMs,
        req: {
          stream: false,
          service: method.parent,
          method,
          requestMethod: "POST",
          url: createMethodUrl(opt.baseUrl, method),
          header: requestHeaderWithCompression(method.methodKind, opt.useBinaryFormat, timeoutMs, header, opt.acceptCompression, opt.sendCompression, true),
          contextValues: contextValues !== null && contextValues !== void 0 ? contextValues : createContextValues(),
          message
        },
        next: async (req) => {
          let requestBody = serialization.getI(opt.useBinaryFormat).serialize(req.message);
          if (opt.sendCompression && requestBody.byteLength > opt.compressMinBytes) {
            requestBody = await opt.sendCompression.compress(requestBody);
            req.header.set(headerUnaryEncoding, opt.sendCompression.name);
          } else {
            req.header.delete(headerUnaryEncoding);
          }
          const useGet = opt.useHttpGet === true && method.idempotency === MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS;
          let body;
          if (useGet) {
            req = transformConnectPostToGetRequest(req, requestBody, opt.useBinaryFormat);
          } else {
            body = createAsyncIterable([requestBody]);
          }
          const universalResponse = await opt.httpClient({
            url: req.url,
            method: req.requestMethod,
            header: req.header,
            signal: req.signal,
            body
          });
          const { compression, isUnaryError, unaryError } = validateResponseWithCompression(method.methodKind, opt.acceptCompression, opt.useBinaryFormat, universalResponse.status, universalResponse.header);
          const [header2, trailer] = trailerDemux(universalResponse.header);
          let responseBody = await pipeTo(universalResponse.body, sinkAllBytes(opt.readMaxBytes, universalResponse.header.get(headerUnaryContentLength)), { propagateDownStreamError: false });
          if (compression) {
            responseBody = await compression.decompress(responseBody, opt.readMaxBytes);
          }
          if (isUnaryError) {
            throw errorFromJsonBytes(responseBody, appendHeaders(header2, trailer), unaryError);
          }
          return {
            stream: false,
            service: method.parent,
            method,
            header: header2,
            message: serialization.getO(opt.useBinaryFormat).parse(responseBody),
            trailer
          };
        }
      });
    },
    async stream(method, signal, timeoutMs, header, input, contextValues) {
      const serialization = createMethodSerializationLookup(method, opt.binaryOptions, opt.jsonOptions, opt);
      const endStreamSerialization = createEndStreamSerialization(opt.jsonOptions);
      timeoutMs = timeoutMs === void 0 ? opt.defaultTimeoutMs : timeoutMs <= 0 ? void 0 : timeoutMs;
      return runStreamingCall({
        interceptors: opt.interceptors,
        signal,
        timeoutMs,
        req: {
          stream: true,
          service: method.parent,
          method,
          requestMethod: "POST",
          url: createMethodUrl(opt.baseUrl, method),
          header: requestHeaderWithCompression(method.methodKind, opt.useBinaryFormat, timeoutMs, header, opt.acceptCompression, opt.sendCompression, true),
          contextValues: contextValues !== null && contextValues !== void 0 ? contextValues : createContextValues(),
          message: input
        },
        next: async (req) => {
          const uRes = await opt.httpClient({
            url: req.url,
            method: "POST",
            header: req.header,
            signal: req.signal,
            body: pipe(req.message, transformSerializeEnvelope(serialization.getI(opt.useBinaryFormat)), transformCompressEnvelope(opt.sendCompression, opt.compressMinBytes), transformJoinEnvelopes(), { propagateDownStreamError: true })
          });
          const { compression } = validateResponseWithCompression(method.methodKind, opt.acceptCompression, opt.useBinaryFormat, uRes.status, uRes.header);
          const res = Object.assign(Object.assign({}, req), { header: uRes.header, trailer: new Headers(), message: pipe(uRes.body, transformSplitEnvelope(opt.readMaxBytes), transformDecompressEnvelope(compression !== null && compression !== void 0 ? compression : null, opt.readMaxBytes), transformParseEnvelope(serialization.getO(opt.useBinaryFormat), endStreamFlag, endStreamSerialization), function(iterable) {
            return __asyncGenerator3(this, arguments, function* () {
              var _a, e_1, _b, _c;
              let endStreamReceived = false;
              try {
                for (var _d = true, iterable_1 = __asyncValues3(iterable), iterable_1_1; iterable_1_1 = yield __await3(iterable_1.next()), _a = iterable_1_1.done, !_a; _d = true) {
                  _c = iterable_1_1.value;
                  _d = false;
                  const chunk = _c;
                  if (chunk.end) {
                    if (endStreamReceived) {
                      throw new ConnectError("protocol error: received extra EndStreamResponse", Code.InvalidArgument);
                    }
                    endStreamReceived = true;
                    if (chunk.value.error) {
                      const error2 = chunk.value.error;
                      uRes.header.forEach((value, key) => {
                        error2.metadata.append(key, value);
                      });
                      throw error2;
                    }
                    chunk.value.metadata.forEach((value, key) => res.trailer.set(key, value));
                    continue;
                  }
                  if (endStreamReceived) {
                    throw new ConnectError("protocol error: received extra message after EndStreamResponse", Code.InvalidArgument);
                  }
                  yield yield __await3(chunk.value);
                }
              } catch (e_1_1) {
                e_1 = { error: e_1_1 };
              } finally {
                try {
                  if (!_d && !_a && (_b = iterable_1.return)) yield __await3(_b.call(iterable_1));
                } finally {
                  if (e_1) throw e_1.error;
                }
              }
              if (!endStreamReceived) {
                throw new ConnectError("protocol error: missing EndStreamResponse", Code.InvalidArgument);
              }
            });
          }, { propagateDownStreamError: true }) });
          return res;
        }
      });
    }
  };
}

// node_modules/.pnpm/@connectrpc+connect-node@2.2.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1_/node_modules/@connectrpc/connect-node/dist/esm/compression.js
import * as zlib from "node:zlib";
import { promisify } from "node:util";

// node_modules/.pnpm/@connectrpc+connect-node@2.2.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1_/node_modules/@connectrpc/connect-node/dist/esm/node-error.js
function connectErrorFromNodeReason(reason) {
  let code = Code.Internal;
  const chain = unwrapNodeErrorChain(reason).map(getNodeErrorProps);
  if (chain.some((p) => p.code == "ERR_STREAM_WRITE_AFTER_END")) {
    code = Code.Aborted;
  } else if (chain.some((p) => p.code == "ERR_STREAM_DESTROYED" || p.code == "ERR_HTTP2_INVALID_STREAM" || p.code == "ECONNRESET")) {
    code = Code.Aborted;
  } else if (chain.some((p) => p.code == "ETIMEDOUT" || p.code == "ENOTFOUND" || p.code == "EAI_AGAIN" || p.code == "ECONNREFUSED")) {
    code = Code.Unavailable;
  }
  const ce = ConnectError.from(reason, code);
  if (ce !== reason) {
    ce.cause = reason;
  }
  return ce;
}
function unwrapNodeErrorChain(reason) {
  const chain = [];
  for (; ; ) {
    if (!(reason instanceof Error)) {
      break;
    }
    if (chain.includes(reason)) {
      break;
    }
    chain.push(reason);
    if (!("cause" in reason)) {
      break;
    }
    reason = reason.cause;
  }
  return chain;
}
function getNodeErrorProps(reason) {
  const props = {};
  if (reason instanceof Error) {
    if ("code" in reason && typeof reason.code == "string") {
      props.code = reason.code;
    }
    if ("syscall" in reason && typeof reason.syscall == "string") {
      props.syscall = reason.syscall;
    }
  }
  return props;
}
function connectErrorFromH2ResetCode(rstCode) {
  switch (rstCode) {
    case H2Code.PROTOCOL_ERROR:
    case H2Code.INTERNAL_ERROR:
    case H2Code.FLOW_CONTROL_ERROR:
    case H2Code.SETTINGS_TIMEOUT:
    case H2Code.FRAME_SIZE_ERROR:
    case H2Code.COMPRESSION_ERROR:
    case H2Code.CONNECT_ERROR:
      return new ConnectError(`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, Code.Internal);
    case H2Code.REFUSED_STREAM:
      return new ConnectError(`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, Code.Unavailable);
    case H2Code.CANCEL:
      return new ConnectError(`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, Code.Canceled);
    case H2Code.ENHANCE_YOUR_CALM:
      return new ConnectError(`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, Code.ResourceExhausted);
    case H2Code.INADEQUATE_SECURITY:
      return new ConnectError(`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, Code.PermissionDenied);
    case H2Code.HTTP_1_1_REQUIRED:
      return new ConnectError(`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, Code.PermissionDenied);
    default:
      break;
  }
  return void 0;
}
var H2Code;
(function(H2Code2) {
  H2Code2[H2Code2["PROTOCOL_ERROR"] = 1] = "PROTOCOL_ERROR";
  H2Code2[H2Code2["INTERNAL_ERROR"] = 2] = "INTERNAL_ERROR";
  H2Code2[H2Code2["FLOW_CONTROL_ERROR"] = 3] = "FLOW_CONTROL_ERROR";
  H2Code2[H2Code2["SETTINGS_TIMEOUT"] = 4] = "SETTINGS_TIMEOUT";
  H2Code2[H2Code2["STREAM_CLOSED"] = 5] = "STREAM_CLOSED";
  H2Code2[H2Code2["FRAME_SIZE_ERROR"] = 6] = "FRAME_SIZE_ERROR";
  H2Code2[H2Code2["REFUSED_STREAM"] = 7] = "REFUSED_STREAM";
  H2Code2[H2Code2["CANCEL"] = 8] = "CANCEL";
  H2Code2[H2Code2["COMPRESSION_ERROR"] = 9] = "COMPRESSION_ERROR";
  H2Code2[H2Code2["CONNECT_ERROR"] = 10] = "CONNECT_ERROR";
  H2Code2[H2Code2["ENHANCE_YOUR_CALM"] = 11] = "ENHANCE_YOUR_CALM";
  H2Code2[H2Code2["INADEQUATE_SECURITY"] = 12] = "INADEQUATE_SECURITY";
  H2Code2[H2Code2["HTTP_1_1_REQUIRED"] = 13] = "HTTP_1_1_REQUIRED";
})(H2Code || (H2Code = {}));

// node_modules/.pnpm/@connectrpc+connect-node@2.2.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1_/node_modules/@connectrpc/connect-node/dist/esm/compression.js
var gzip2 = promisify(zlib.gzip);
var gunzip2 = promisify(zlib.gunzip);
var brotliCompress2 = promisify(zlib.brotliCompress);
var brotliDecompress2 = promisify(zlib.brotliDecompress);
var compressionGzip = {
  name: "gzip",
  compress(bytes) {
    return asUint8ArrayArrayBuffer(gzip2(bytes, {}));
  },
  decompress(bytes, readMaxBytes) {
    if (bytes.length == 0) {
      return Promise.resolve(new Uint8Array(0));
    }
    return asUint8ArrayArrayBuffer(wrapZLibErrors(gunzip2(bytes, {
      maxOutputLength: readMaxBytes
    }), readMaxBytes));
  }
};
var compressionBrotli = {
  name: "br",
  compress(bytes) {
    return asUint8ArrayArrayBuffer(brotliCompress2(bytes, {}));
  },
  decompress(bytes, readMaxBytes) {
    if (bytes.length == 0) {
      return Promise.resolve(new Uint8Array(0));
    }
    return asUint8ArrayArrayBuffer(wrapZLibErrors(brotliDecompress2(bytes, {
      maxOutputLength: readMaxBytes
    }), readMaxBytes));
  }
};
function asUint8ArrayArrayBuffer(bytes) {
  return bytes.then((b) => {
    if (b.buffer instanceof ArrayBuffer) {
      return b;
    }
    return new Uint8Array(b);
  });
}
function wrapZLibErrors(promise, readMaxBytes) {
  return promise.catch((e) => {
    var _a;
    const props = getNodeErrorProps(e);
    let code = Code.Internal;
    let message = "decompression failed";
    switch (props.code) {
      case "ERR_BUFFER_TOO_LARGE":
        code = Code.ResourceExhausted;
        message = `message is larger than configured readMaxBytes ${readMaxBytes} after decompression`;
        break;
      case "Z_DATA_ERROR":
      case "ERR_PADDING_2":
        code = Code.InvalidArgument;
        break;
      default:
        if ((_a = props.code) === null || _a === void 0 ? void 0 : _a.startsWith("ERR__ERROR_FORMAT_")) {
          code = Code.InvalidArgument;
        }
        break;
    }
    return Promise.reject(new ConnectError(message, code, void 0, void 0, e));
  });
}

// node_modules/.pnpm/@connectrpc+connect-node@2.2.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1_/node_modules/@connectrpc/connect-node/dist/esm/node-universal-client.js
import * as http from "node:http";
import * as https from "node:https";

// node_modules/.pnpm/@connectrpc+connect-node@2.2.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1_/node_modules/@connectrpc/connect-node/dist/esm/node-universal-header.js
function nodeHeaderToWebHeader(nodeHeaders) {
  const header = new Headers();
  for (const [k, v] of Object.entries(nodeHeaders)) {
    if (k.startsWith(":")) {
      continue;
    }
    if (v === void 0) {
      continue;
    }
    if (typeof v == "string") {
      header.append(k, v);
    } else if (typeof v == "number") {
      header.append(k, String(v));
    } else {
      for (const e of v) {
        header.append(k, e);
      }
    }
  }
  return header;
}
function webHeaderToNodeHeaders(headersInit, defaultNodeHeaders) {
  if (headersInit === void 0 && defaultNodeHeaders === void 0) {
    return void 0;
  }
  const o = /* @__PURE__ */ Object.create(null);
  if (defaultNodeHeaders !== void 0) {
    if (Array.isArray(defaultNodeHeaders)) {
      for (let i = 0; i + 1 < defaultNodeHeaders.length; i += 2) {
        const key = defaultNodeHeaders[i];
        const value = defaultNodeHeaders[i + 1];
        if (Array.isArray(o[key])) {
          o[key].push(value);
        } else if (typeof o[key] == "string") {
          o[key] = [o[key], value];
        } else {
          o[key] = value;
        }
      }
    } else {
      for (const [key, value] of Object.entries(defaultNodeHeaders)) {
        if (Array.isArray(value)) {
          o[key] = value.concat();
        } else if (value !== void 0) {
          o[key] = value;
        }
      }
    }
  }
  if (headersInit !== void 0) {
    if (Array.isArray(headersInit)) {
      for (const [key, value] of headersInit) {
        appendWebHeader(o, key, value);
      }
    } else if ("forEach" in headersInit) {
      if (typeof headersInit.forEach == "function") {
        headersInit.forEach((value, key) => {
          appendWebHeader(o, key, value);
        });
      }
    } else {
      for (const [key, value] of Object.entries(headersInit)) {
        appendWebHeader(o, key, value);
      }
    }
  }
  return o;
}
function appendWebHeader(o, key, value) {
  key = key.toLowerCase();
  const existing = o[key];
  if (Array.isArray(existing)) {
    existing.push(value);
  } else if (existing === void 0) {
    o[key] = value;
  } else {
    o[key] = [existing.toString(), value];
  }
}

// node_modules/.pnpm/@connectrpc+connect-node@2.2.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1_/node_modules/@connectrpc/connect-node/dist/esm/http2-session-manager.js
import * as http2 from "node:http2";
var Http2SessionManager = class {
  /**
   * The current state of the connection:
   *
   * - "closed"
   *   The connection is closed, or no connection has been opened yet.
   * - connecting
   *   Currently establishing a connection.
   *
   * - "open"
   *   A connection is open and has open streams. PING frames are sent every
   *   pingIntervalMs, unless a stream received data.
   *   If a PING frame is not responded to within pingTimeoutMs, the connection
   *   and all open streams close.
   *
   * - "idle"
   *   A connection is open, but it does not have any open streams.
   *   If pingIdleConnection is enabled, PING frames are used to keep the
   *   connection alive, similar to an "open" connection.
   *   If a connection is idle for longer than idleConnectionTimeoutMs, it closes.
   *   If a request is made on an idle connection that has not been used for
   *   longer than pingIntervalMs, the connection is verified.
   *
   * - "verifying"
   *   Verifying a connection after a long period of inactivity before issuing a
   *   request. A PING frame is sent, and if it times out within pingTimeoutMs, a
   *   new connection is opened.
   *
   * - "error"
   *   The connection is closed because of a transient error. A connection
   *   may have failed to reach the host, or the connection may have died,
   *   or it may have been aborted.
   */
  state() {
    if (this.s.t == "ready") {
      if (this.verifying !== void 0) {
        return "verifying";
      }
      return this.s.streamCount() > 0 ? "open" : "idle";
    }
    return this.s.t;
  }
  /**
   * Returns the error object if the connection is in the "error" state,
   * `undefined` otherwise.
   */
  error() {
    if (this.s.t == "error") {
      return this.s.reason;
    }
    return void 0;
  }
  constructor(url, pingOptions, http2SessionOptions) {
    var _a, _b, _c, _d;
    this.s = closed();
    this.shuttingDown = [];
    this.authority = new URL(url).origin;
    this.http2SessionOptions = http2SessionOptions;
    this.options = {
      pingIntervalMs: (_a = pingOptions === null || pingOptions === void 0 ? void 0 : pingOptions.pingIntervalMs) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY,
      pingTimeoutMs: (_b = pingOptions === null || pingOptions === void 0 ? void 0 : pingOptions.pingTimeoutMs) !== null && _b !== void 0 ? _b : 1e3 * 15,
      pingIdleConnection: (_c = pingOptions === null || pingOptions === void 0 ? void 0 : pingOptions.pingIdleConnection) !== null && _c !== void 0 ? _c : false,
      idleConnectionTimeoutMs: (_d = pingOptions === null || pingOptions === void 0 ? void 0 : pingOptions.idleConnectionTimeoutMs) !== null && _d !== void 0 ? _d : 1e3 * 60 * 15
    };
  }
  /**
   * Open a connection if none exists, verify an existing connection if
   * necessary.
   */
  async connect() {
    try {
      const ready2 = await this.gotoReady();
      return ready2.streamCount() > 0 ? "open" : "idle";
    } catch (e) {
      return "error";
    }
  }
  /**
   * Issue a request.
   *
   * This method automatically opens a connection if none exists, and verifies
   * an existing connection if necessary. It calls http2.ClientHttp2Session.request(),
   * and keeps track of all open http2.ClientHttp2Stream.
   *
   * Clients must call notifyResponseByteRead() whenever they successfully read
   * data from the http2.ClientHttp2Stream.
   */
  async request(method, path2, headers, options) {
    for (; ; ) {
      const ready2 = await this.gotoReady();
      try {
        const stream = ready2.conn.request(Object.assign(Object.assign({}, headers), { ":method": method, ":path": path2 }), options);
        ready2.registerRequest(stream);
        return stream;
      } catch (e) {
        if (ready2.conn.closed || ready2.conn.destroyed) {
          continue;
        }
        throw e;
      }
    }
  }
  /**
   * Notify the manager of a successful read from a http2.ClientHttp2Stream.
   *
   * Clients must call this function whenever they successfully read data from
   * a http2.ClientHttp2Stream obtained from request(). This informs the
   * keep-alive logic that the connection is alive, and prevents it from sending
   * unnecessary PING frames.
   */
  notifyResponseByteRead(stream) {
    if (this.s.t == "ready") {
      this.s.responseByteRead(stream);
    }
    for (const s of this.shuttingDown) {
      s.responseByteRead(stream);
    }
  }
  /**
   * If there is an open connection, close it. This also closes any open streams.
   */
  abort(reason) {
    var _a, _b, _c;
    const err = reason !== null && reason !== void 0 ? reason : new ConnectError("connection aborted", Code.Canceled);
    (_b = (_a = this.s).abort) === null || _b === void 0 ? void 0 : _b.call(_a, err);
    for (const s of this.shuttingDown) {
      (_c = s.abort) === null || _c === void 0 ? void 0 : _c.call(s, err);
    }
    this.setState(closedOrError(err));
  }
  async gotoReady() {
    if (this.s.t == "ready") {
      if (this.s.isShuttingDown() || this.s.conn.closed || this.s.conn.destroyed) {
        this.setState(connect2(this.authority, this.http2SessionOptions));
      } else if (this.s.requiresVerify()) {
        await this.verify(this.s);
      }
    } else if (this.s.t == "closed" || this.s.t == "error") {
      this.setState(connect2(this.authority, this.http2SessionOptions));
    }
    while (this.s.t !== "ready") {
      if (this.s.t === "error") {
        throw this.s.reason;
      }
      if (this.s.t === "connecting") {
        await this.s.conn;
      }
    }
    return this.s;
  }
  setState(state) {
    var _a, _b;
    (_b = (_a = this.s).onExitState) === null || _b === void 0 ? void 0 : _b.call(_a);
    if (this.s.t == "ready" && this.s.isShuttingDown()) {
      const sd = this.s;
      this.shuttingDown.push(sd);
      sd.onClose = sd.onError = () => {
        const i = this.shuttingDown.indexOf(sd);
        if (i !== -1) {
          this.shuttingDown.splice(i, 1);
        }
      };
    }
    switch (state.t) {
      case "connecting":
        state.conn.then((value) => {
          this.setState(ready(value, this.options));
        }, (reason) => {
          this.setState(closedOrError(reason));
        });
        break;
      case "ready":
        state.onClose = () => this.setState(closed());
        state.onError = (err) => this.setState(closedOrError(err));
        break;
      case "closed":
        break;
      case "error":
        break;
    }
    this.s = state;
  }
  verify(stateReady) {
    if (this.verifying !== void 0) {
      return this.verifying;
    }
    this.verifying = stateReady.verify().then((success) => {
      if (success) {
        return;
      }
      this.setState(connect2(this.authority, this.http2SessionOptions));
    }, (reason) => {
      this.setState(closedOrError(reason));
    }).finally(() => {
      this.verifying = void 0;
    });
    return this.verifying;
  }
};
function closed() {
  return {
    t: "closed"
  };
}
function error(reason) {
  return {
    t: "error",
    reason
  };
}
function closedOrError(reason) {
  const isCancel = reason instanceof ConnectError && ConnectError.from(reason).code == Code.Canceled;
  return isCancel ? closed() : error(reason);
}
function connect2(authority, http2SessionOptions) {
  let resolve;
  let reject;
  const conn = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const newConn = http2.connect(authority, http2SessionOptions);
  newConn.on("connect", onConnect);
  newConn.on("error", onError);
  function onConnect() {
    resolve === null || resolve === void 0 ? void 0 : resolve(newConn);
    cleanup();
  }
  function onError(err) {
    reject === null || reject === void 0 ? void 0 : reject(connectErrorFromNodeReason(err));
    cleanup();
  }
  function cleanup() {
    newConn.off("connect", onConnect);
    newConn.off("error", onError);
  }
  return {
    t: "connecting",
    conn,
    abort(reason) {
      if (!newConn.destroyed) {
        newConn.destroy(void 0, http2.constants.NGHTTP2_CANCEL);
      }
      reject === null || reject === void 0 ? void 0 : reject(reason);
    },
    onExitState() {
      cleanup();
    }
  };
}
function ready(conn, options) {
  assertSessionOpen(conn);
  conn.unref();
  let lastAliveAt = Date.now();
  let streamCount = 0;
  let pingIntervalId;
  let pingTimeoutId;
  let receivedGoAway = false;
  let receivedGoAwayEnhanceYourCalmTooManyPings = false;
  let idleTimeoutId;
  resetIdleTimeout();
  const state = {
    t: "ready",
    conn,
    streamCount() {
      return streamCount;
    },
    requiresVerify() {
      const elapsedMs = Date.now() - lastAliveAt;
      return elapsedMs > options.pingIntervalMs;
    },
    isShuttingDown() {
      return receivedGoAway;
    },
    onClose: void 0,
    onError: void 0,
    registerRequest(stream) {
      streamCount++;
      if (streamCount == 1) {
        conn.ref();
        resetPingInterval();
        stopIdleTimeout();
      }
      stream.once("response", () => {
        lastAliveAt = Date.now();
        resetPingInterval();
      });
      stream.once("close", () => {
        streamCount--;
        if (streamCount == 0) {
          conn.unref();
          resetPingInterval();
          resetIdleTimeout();
        }
      });
    },
    responseByteRead(stream) {
      if (stream.session !== conn) {
        return;
      }
      if (conn.closed || conn.destroyed) {
        return;
      }
      if (streamCount <= 0) {
        return;
      }
      lastAliveAt = Date.now();
      resetPingInterval();
    },
    verify() {
      conn.ref();
      return new Promise((resolve) => {
        const onFailure = () => {
          resolve(false);
        };
        commonPing(() => {
          if (streamCount == 0)
            conn.unref();
          conn.off("error", onFailure);
          conn.off("close", onFailure);
          resolve(true);
        });
        conn.once("error", onFailure);
        conn.once("close", onFailure);
      });
    },
    abort(reason) {
      if (!conn.destroyed) {
        conn.once("error", () => {
        });
        conn.destroy(reason, http2.constants.NGHTTP2_CANCEL);
      }
    },
    onExitState() {
      if (state.isShuttingDown()) {
        return;
      }
      cleanup();
      this.onError = void 0;
      this.onClose = void 0;
    }
  };
  function resetPingInterval() {
    stopPingInterval();
    if (streamCount > 0 || options.pingIdleConnection) {
      pingIntervalId = safeSetTimeout(onPingInterval, options.pingIntervalMs);
    }
  }
  function stopPingInterval() {
    clearTimeout(pingIntervalId);
    clearTimeout(pingTimeoutId);
  }
  function onPingInterval() {
    commonPing(resetPingInterval);
  }
  function commonPing(onSuccess) {
    clearTimeout(pingTimeoutId);
    pingTimeoutId = safeSetTimeout(() => {
      conn.destroy(new ConnectError("PING timed out", Code.Unavailable), http2.constants.NGHTTP2_CANCEL);
    }, options.pingTimeoutMs);
    conn.ping((err, duration) => {
      clearTimeout(pingTimeoutId);
      if (err !== null) {
        return;
      }
      if (duration > options.pingTimeoutMs) {
        conn.destroy(new ConnectError("PING timed out", Code.Unavailable), http2.constants.NGHTTP2_CANCEL);
        return;
      }
      lastAliveAt = Date.now();
      onSuccess();
    });
  }
  function stopIdleTimeout() {
    clearTimeout(idleTimeoutId);
  }
  function resetIdleTimeout() {
    idleTimeoutId = safeSetTimeout(onIdleTimeout, options.idleConnectionTimeoutMs);
  }
  function onIdleTimeout() {
    conn.close();
    onClose();
  }
  function onGoaway(errorCode, lastStreamID, opaqueData) {
    if (errorCode === http2.constants.NGHTTP2_NO_ERROR && streamCount === 0) {
      conn.destroy(new ConnectError("received GOAWAY without any open streams", Code.Canceled), http2.constants.NGHTTP2_NO_ERROR);
      return;
    }
    receivedGoAway = true;
    const tooManyPingsAscii = Buffer.from("too_many_pings", "ascii");
    if (opaqueData === null || opaqueData === void 0 ? void 0 : opaqueData.equals(tooManyPingsAscii)) {
      options.pingIntervalMs = options.pingIntervalMs * 2;
      receivedGoAwayEnhanceYourCalmTooManyPings = true;
    }
  }
  function onClose() {
    var _a;
    cleanup();
    (_a = state.onClose) === null || _a === void 0 ? void 0 : _a.call(state);
  }
  function onError(err) {
    var _a, _b;
    cleanup();
    if (receivedGoAwayEnhanceYourCalmTooManyPings) {
      const ce = new ConnectError(`http/2 connection closed with error code ENHANCE_YOUR_CALM (0x${http2.constants.NGHTTP2_ENHANCE_YOUR_CALM.toString(16)}), too_many_pings, doubled the interval`, Code.ResourceExhausted);
      (_a = state.onError) === null || _a === void 0 ? void 0 : _a.call(state, ce);
    } else {
      (_b = state.onError) === null || _b === void 0 ? void 0 : _b.call(state, connectErrorFromNodeReason(err));
    }
  }
  function cleanup() {
    stopPingInterval();
    stopIdleTimeout();
    conn.off("error", onError);
    conn.off("close", onClose);
    conn.off("goaway", onGoaway);
  }
  conn.on("error", onError);
  conn.on("close", onClose);
  conn.on("goaway", onGoaway);
  return state;
}
function safeSetTimeout(callback, ms) {
  if (ms > 2147483647) {
    return;
  }
  return setTimeout(callback, ms).unref();
}
function assertSessionOpen(conn) {
  if (conn.connecting) {
    throw new ConnectError("expected open session, but it is connecting", Code.Internal);
  }
  if (conn.destroyed) {
    throw new ConnectError("expected open session, but it is destroyed", Code.Internal);
  }
  if (conn.closed) {
    throw new ConnectError("expected open session, but it is closed", Code.Internal);
  }
}

// node_modules/.pnpm/@connectrpc+connect-node@2.2.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1_/node_modules/@connectrpc/connect-node/dist/esm/node-universal-client.js
function createNodeHttpClient(options) {
  var _a;
  if (options.httpVersion == "1.1") {
    return createNodeHttp1Client(options.nodeOptions);
  }
  const sessionProvider = (_a = options.sessionProvider) !== null && _a !== void 0 ? _a : ((url) => new Http2SessionManager(url));
  return createNodeHttp2Client(sessionProvider);
}
function createNodeHttp1Client(httpOptions) {
  return async function request3(req) {
    const sentinel = createSentinel(req.signal);
    return new Promise((resolve, reject) => {
      sentinel.onError((e) => {
        reject(e);
      });
      h1Request(sentinel, req.url, Object.assign(Object.assign({}, httpOptions), { headers: webHeaderToNodeHeaders(req.header, httpOptions === null || httpOptions === void 0 ? void 0 : httpOptions.headers), method: req.method }), (request4) => {
        void sinkRequest(req, request4, sentinel);
        request4.on("response", (response) => {
          var _a;
          response.on("error", sentinel.error);
          sentinel.onError((reason) => response.destroy(reason));
          const trailer = new Headers();
          resolve({
            status: (_a = response.statusCode) !== null && _a !== void 0 ? _a : 0,
            header: nodeHeaderToWebHeader(response.headers),
            body: h1ResponseIterable(sentinel, response, trailer),
            trailer
          });
        });
      });
    });
  };
}
function createNodeHttp2Client(sessionProvider) {
  return function request3(req) {
    const sentinel = createSentinel(req.signal);
    const sessionManager = sessionProvider(req.url);
    return new Promise((resolve, reject) => {
      sentinel.onError((e) => {
        reject(e);
      });
      h2Request(sentinel, sessionManager, req.url, req.method, webHeaderToNodeHeaders(req.header), {}, (stream) => {
        void sinkRequest(req, stream, sentinel);
        stream.on("response", (headers) => {
          var _a;
          const response = {
            status: (_a = headers[":status"]) !== null && _a !== void 0 ? _a : 0,
            header: nodeHeaderToWebHeader(headers),
            body: h2ResponseIterable(sentinel, stream, sessionManager),
            trailer: h2ResponseTrailer(stream)
          };
          resolve(response);
        });
      });
    });
  };
}
function h1Request(sentinel, url, options, onRequest) {
  let request3;
  if (new URL(url).protocol.startsWith("https")) {
    request3 = https.request(url, options);
  } else {
    request3 = http.request(url, options);
  }
  sentinel.onError((reason) => request3.destroy(reason));
  request3.flushHeaders();
  request3.on("error", sentinel.error);
  request3.on("socket", function onRequestSocket(socket) {
    function onSocketConnect() {
      socket.off("connect", onSocketConnect);
      onRequest(request3);
    }
    if (socket.readyState === "open") {
      onRequest(request3);
    } else {
      socket.on("connect", onSocketConnect);
    }
  });
}
function h1ResponseIterable(sentinel, response, trailer) {
  const inner = response[Symbol.asyncIterator]();
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          const r = await sentinel.race(inner.next());
          if (r.done === true) {
            nodeHeaderToWebHeader(response.trailers).forEach((value, key) => {
              trailer.set(key, value);
            });
            sentinel.close();
          }
          return r;
        },
        throw(e) {
          sentinel.error(e);
          throw e;
        }
      };
    }
  };
}
function h2Request(sentinel, sm, url, method, headers, options, onStream) {
  const requestUrl = new URL(url);
  if (requestUrl.origin !== sm.authority) {
    const message = `cannot make a request to ${requestUrl.origin}: the http2 session is connected to ${sm.authority}`;
    sentinel.error(new ConnectError(message, Code.Internal));
    return;
  }
  sm.request(method, requestUrl.pathname + requestUrl.search, headers, {}).then((stream) => {
    sentinel.onError((reason) => {
      if (stream.closed) {
        return;
      }
      const rstCode = reason.code == Code.Canceled ? H2Code.CANCEL : H2Code.INTERNAL_ERROR;
      return new Promise((resolve) => stream.close(rstCode, resolve));
    });
    stream.on("error", function h2StreamError(e) {
      if (stream.writableEnded && unwrapNodeErrorChain(e).map(getNodeErrorProps).some((p) => p.code == "ERR_STREAM_WRITE_AFTER_END")) {
        return;
      }
      sentinel.error(e);
    });
    stream.on("close", function h2StreamClose() {
      const err = connectErrorFromH2ResetCode(stream.rstCode);
      if (err) {
        sentinel.error(err);
      }
    });
    onStream(stream);
  }, (reason) => {
    sentinel.error(reason);
  });
}
function h2ResponseTrailer(response) {
  const trailer = new Headers();
  response.on("trailers", (args2) => {
    nodeHeaderToWebHeader(args2).forEach((value, key) => {
      trailer.set(key, value);
    });
  });
  return trailer;
}
function h2ResponseIterable(sentinel, response, sm) {
  const inner = response[Symbol.asyncIterator]();
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          const r = await sentinel.race(inner.next());
          if (r.done === true) {
            sentinel.close();
          }
          sm === null || sm === void 0 ? void 0 : sm.notifyResponseByteRead(response);
          return r;
        },
        throw(e) {
          sentinel.error(e);
          throw e;
        }
      };
    }
  };
}
async function sinkRequest(request3, nodeRequest, sentinel) {
  if (request3.body === void 0) {
    await new Promise((resolve) => nodeRequest.end(resolve));
    return;
  }
  const it = request3.body[Symbol.asyncIterator]();
  return new Promise((resolve) => {
    writeNext();
    function writeNext() {
      if (sentinel.isClosed()) {
        return;
      }
      it.next().then((r) => {
        if (r.done === true) {
          nodeRequest.end(resolve);
          return;
        }
        nodeRequest.write(r.value, "binary", (e) => {
          if (e === null || e === void 0) {
            writeNext();
            return;
          }
          if (it.throw !== void 0) {
            it.throw(connectErrorFromNodeReason(e)).catch(() => {
            });
          }
          if (nodeRequest.writableEnded && unwrapNodeErrorChain(e).map(getNodeErrorProps).some((p) => p.code == "ERR_STREAM_WRITE_AFTER_END")) {
            return;
          }
          sentinel.error(e);
        });
      }, (e) => {
        sentinel.error(e);
      });
    }
  });
}
function createSentinel(signal) {
  let rejectRace;
  let closed2 = false;
  let closedError = void 0;
  let onErrorListeners = [];
  const sentinel = {
    error(error2) {
      if (closed2) {
        return;
      }
      closed2 = true;
      closedError = error2 instanceof ConnectError ? error2 : connectErrorFromNodeReason(error2);
      rejectRace === null || rejectRace === void 0 ? void 0 : rejectRace(closedError);
      for (const onRejected of onErrorListeners) {
        onRejected(closedError);
      }
      cleanup();
    },
    close() {
      if (closed2) {
        return;
      }
      closed2 = true;
      if (rejectRace) {
        rejectRace(new ConnectError("sentinel completed early", Code.Internal));
      }
      cleanup();
    },
    isClosed() {
      return closed2;
    },
    onError(onError) {
      if (closed2) {
        if (closedError !== void 0) {
          onError(closedError);
        }
      } else {
        onErrorListeners.push(onError);
      }
    },
    race(promise) {
      let resolveRace;
      const race = new Promise((resolve, reject) => {
        resolveRace = resolve;
        rejectRace = reject;
      });
      promise.then((value) => {
        resolveRace === null || resolveRace === void 0 ? void 0 : resolveRace(value);
      }, (reason) => {
        rejectRace === null || rejectRace === void 0 ? void 0 : rejectRace(reason);
      });
      if (closed2) {
        rejectRace === null || rejectRace === void 0 ? void 0 : rejectRace(closedError !== null && closedError !== void 0 ? closedError : new ConnectError("sentinel completed early", Code.Internal));
      }
      return race;
    }
  };
  function cleanup() {
    if (signal) {
      signal.removeEventListener("abort", onSignalAbort);
    }
    onErrorListeners = [];
    rejectRace = void 0;
  }
  function onSignalAbort() {
    sentinel.error(getAbortSignalReason(this));
  }
  if (signal) {
    signal.addEventListener("abort", onSignalAbort);
    if (signal.aborted) {
      sentinel.error(getAbortSignalReason(signal));
    }
  }
  return sentinel;
}

// node_modules/.pnpm/@connectrpc+connect-node@2.2.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1_/node_modules/@connectrpc/connect-node/dist/esm/node-transport-options.js
function validateNodeTransportOptions(options) {
  var _a, _b, _c, _d;
  let httpClient;
  if (options.httpVersion == "2") {
    let sessionManager;
    if (options.sessionManager) {
      sessionManager = options.sessionManager;
    } else {
      sessionManager = new Http2SessionManager(options.baseUrl, {
        pingIntervalMs: options.pingIntervalMs,
        pingIdleConnection: options.pingIdleConnection,
        pingTimeoutMs: options.pingTimeoutMs,
        idleConnectionTimeoutMs: options.idleConnectionTimeoutMs
      }, options.nodeOptions);
    }
    httpClient = createNodeHttpClient({
      httpVersion: "2",
      sessionProvider: () => sessionManager
    });
  } else {
    httpClient = createNodeHttpClient({
      httpVersion: "1.1",
      nodeOptions: options.nodeOptions
    });
  }
  return Object.assign(Object.assign(Object.assign({}, options), { httpClient, useBinaryFormat: (_a = options.useBinaryFormat) !== null && _a !== void 0 ? _a : true, interceptors: (_b = options.interceptors) !== null && _b !== void 0 ? _b : [], sendCompression: (_c = options.sendCompression) !== null && _c !== void 0 ? _c : null, acceptCompression: (_d = options.acceptCompression) !== null && _d !== void 0 ? _d : [
    compressionGzip,
    compressionBrotli
  ] }), validateReadWriteMaxBytes(options.readMaxBytes, options.writeMaxBytes, options.compressMinBytes));
}

// node_modules/.pnpm/@connectrpc+connect-node@2.2.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect@2.2.0_@bufbuild+protobuf@2.14.1_/node_modules/@connectrpc/connect-node/dist/esm/connect-transport.js
function createConnectTransport(options) {
  return createTransport(validateNodeTransportOptions(options));
}

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/api/interceptors.js
function bearerAuthInterceptor(source, minDuration = 5 * 60 * 1e3) {
  return (next) => async (req) => {
    const token = await source.issueToken(minDuration);
    req.header.set("Authorization", `Bearer ${token}`);
    return await next(req);
  };
}

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/api/clients.js
function createGlobalTransport(opts) {
  const baseUrl = opts.baseUrl || "https://global.namespaceapis.com";
  return createConnectTransport({
    httpVersion: "1.1",
    baseUrl,
    useBinaryFormat: false,
    interceptors: [bearerAuthInterceptor(opts.tokenSource)]
  });
}

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/proto/namespace/stdlib/labels_pb.js
var file_proto_namespace_stdlib_labels = /* @__PURE__ */ fileDesc("CiNwcm90by9uYW1lc3BhY2Uvc3RkbGliL2xhYmVscy5wcm90bxIQbmFtZXNwYWNlLnN0ZGxpYiIkCgVMYWJlbBIMCgRuYW1lGAEgASgJEg0KBXZhbHVlGAIgASgJIrABChBMYWJlbEZpbHRlckVudHJ5EgwKBG5hbWUYASABKAkSDQoFdmFsdWUYAiABKAkSPAoCb3AYAyABKA4yMC5uYW1lc3BhY2Uuc3RkbGliLkxhYmVsRmlsdGVyRW50cnkuTGFiZWxGaWx0ZXJPcCJBCg1MYWJlbEZpbHRlck9wEgsKB1VOS05PV04QABIJCgVFUVVBTBABEg0KCU5PVF9FUVVBTBACEgkKBUVYSVNUEANCPlo8bmFtZXNwYWNlbGFicy5kZXYvaW50ZXJuYWwvcHVibGljL2dlbi9wcm90by9uYW1lc3BhY2Uvc3RkbGliYgZwcm90bzM");
var LabelFilterEntry_LabelFilterOp;
(function(LabelFilterEntry_LabelFilterOp2) {
  LabelFilterEntry_LabelFilterOp2[LabelFilterEntry_LabelFilterOp2["UNKNOWN"] = 0] = "UNKNOWN";
  LabelFilterEntry_LabelFilterOp2[LabelFilterEntry_LabelFilterOp2["EQUAL"] = 1] = "EQUAL";
  LabelFilterEntry_LabelFilterOp2[LabelFilterEntry_LabelFilterOp2["NOT_EQUAL"] = 2] = "NOT_EQUAL";
  LabelFilterEntry_LabelFilterOp2[LabelFilterEntry_LabelFilterOp2["EXIST"] = 3] = "EXIST";
})(LabelFilterEntry_LabelFilterOp || (LabelFilterEntry_LabelFilterOp = {}));

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/proto/namespace/cloud/iam/v1beta/authz_pb.js
var file_proto_namespace_cloud_iam_v1beta_authz = /* @__PURE__ */ fileDesc("Cixwcm90by9uYW1lc3BhY2UvY2xvdWQvaWFtL3YxYmV0YS9hdXRoei5wcm90bxIabmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEiSQoKUGVybWlzc2lvbhIVCg1yZXNvdXJjZV90eXBlGAEgASgJEhMKC3Jlc291cmNlX2lkGAIgASgJEg8KB2FjdGlvbnMYAyADKAkiRAoGQWNjZXNzEhUKDXJlc291cmNlX3R5cGUYASABKAkSEwoLcmVzb3VyY2VfaWQYAiABKAkSDgoGYWN0aW9uGAMgASgJIl8KFVBlcm1pc3Npb25EZW5pZWRFcnJvchJGChptaXNzaW5nX2FjY2Vzc19wZXJtaXNzaW9ucxgBIAMoCzIiLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLkFjY2Vzc0JIWkZuYW1lc3BhY2VsYWJzLmRldi9pbnRlcm5hbC9wdWJsaWMvZ2VuL3Byb3RvL25hbWVzcGFjZS9jbG91ZC9pYW0vdjFiZXRhYgZwcm90bzM");

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/proto/namespace/cloud/iam/v1beta/tokens_pb.js
var file_proto_namespace_cloud_iam_v1beta_tokens = /* @__PURE__ */ fileDesc("Ci1wcm90by9uYW1lc3BhY2UvY2xvdWQvaWFtL3YxYmV0YS90b2tlbnMucHJvdG8SGm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhIicKE0lzc3VlSWRUb2tlblJlcXVlc3QSEAoIYXVkaWVuY2UYASABKAkiKAoUSXNzdWVJZFRva2VuUmVzcG9uc2USEAoIaWRfdG9rZW4YASABKAki0AEKF0lzc3VlVGVuYW50VG9rZW5SZXF1ZXN0EhEKCXRlbmFudF9pZBgBIAEoCRIQCghhY3Rvcl9pZBgCIAEoCRIVCg1kdXJhdGlvbl9zZWNzGAMgASgDEj8KCHBvbGljaWVzGAQgAygLMi0ubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuVGVuYW50VG9rZW5Qb2xpY3kSOAoGYWNjZXNzGAUgASgLMigubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuQWNjZXNzUG9saWN5IkYKDEFjY2Vzc1BvbGljeRI2CgZncmFudHMYASADKAsyJi5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5QZXJtaXNzaW9uIjAKGElzc3VlVGVuYW50VG9rZW5SZXNwb25zZRIUCgxiZWFyZXJfdG9rZW4YASABKAkiNwoRVGVuYW50VG9rZW5Qb2xpY3kSEwoLcG9saWN5X3R5cGUYASABKAkSDQoFdmFsdWUYAiABKAkirAIKG0NyZWF0ZVJldm9rYWJsZVRva2VuUmVxdWVzdBIMCgRuYW1lGAEgASgJEhMKC2Rlc2NyaXB0aW9uGAIgASgJEi4KCmV4cGlyZXNfYXQYAyABKAsyGi5nb29nbGUucHJvdG9idWYuVGltZXN0YW1wEj8KCHBvbGljaWVzGAQgAygLMi0ubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuVGVuYW50VG9rZW5Qb2xpY3kSOAoGYWNjZXNzGAUgASgLMigubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuQWNjZXNzUG9saWN5Ej8KBXNjb3BlGAYgASgOMjAubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuUmV2b2thYmxlVG9rZW4uU2NvcGUibwocQ3JlYXRlUmV2b2thYmxlVG9rZW5SZXNwb25zZRIUCgxiZWFyZXJfdG9rZW4YASABKAkSOQoFdG9rZW4YAiABKAsyKi5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5SZXZva2FibGVUb2tlbiJlChxSZWZyZXNoUmV2b2thYmxlVG9rZW5SZXF1ZXN0EhAKCHRva2VuX2lkGAEgASgJEjMKEG1pbmltdW1fZHVyYXRpb24YAiABKAsyGS5nb29nbGUucHJvdG9idWYuRHVyYXRpb24iWgodUmVmcmVzaFJldm9rYWJsZVRva2VuUmVzcG9uc2USOQoFdG9rZW4YASABKAsyKi5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5SZXZva2FibGVUb2tlbiIvChtSZXZva2VSZXZva2FibGVUb2tlblJlcXVlc3QSEAoIdG9rZW5faWQYASABKAkiZQoaTGlzdFJldm9rYWJsZVRva2Vuc1JlcXVlc3QSGQoRcGFnaW5hdGlvbl9jdXJzb3IYASABKAwSEwoLbWF4X2VudHJpZXMYAiABKAMSFwoPaW5jbHVkZV9yZXZva2VkGAMgASgIInQKG0xpc3RSZXZva2FibGVUb2tlbnNSZXNwb25zZRI6CgZ0b2tlbnMYASADKAsyKi5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5SZXZva2FibGVUb2tlbhIZChFwYWdpbmF0aW9uX2N1cnNvchgCIAEoDCLrBAoOUmV2b2thYmxlVG9rZW4SEAoIdG9rZW5faWQYASABKAkSEQoJdGVuYW50X2lkGAIgASgJEgwKBG5hbWUYAyABKAkSEwoLZGVzY3JpcHRpb24YBCABKAkSLgoKY3JlYXRlZF9hdBgFIAEoCzIaLmdvb2dsZS5wcm90b2J1Zi5UaW1lc3RhbXASLgoKZXhwaXJlc19hdBgGIAEoCzIaLmdvb2dsZS5wcm90b2J1Zi5UaW1lc3RhbXASLgoKcmV2b2tlZF9hdBgHIAEoCzIaLmdvb2dsZS5wcm90b2J1Zi5UaW1lc3RhbXASGwoTcmV2b2tlZF9ieV9hY3Rvcl9pZBgIIAEoCRIYChBjcmVhdG9yX2FjdG9yX2lkGAkgASgJEj8KBXNjb3BlGAogASgOMjAubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuUmV2b2thYmxlVG9rZW4uU2NvcGUSOwoLcGVybWlzc2lvbnMYCyADKAsyJi5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5QZXJtaXNzaW9uEj8KBXN0YXRlGAwgASgOMjAubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuUmV2b2thYmxlVG9rZW4uU3RhdGUiSQoFU2NvcGUSEQoNU0NPUEVfVU5LTk9XThAAEhAKDFRFTkFOVF9TQ09QRRABEhsKF1RFTkFOVF9NRU1CRVJTSElQX1NDT1BFEAIiQAoFU3RhdGUSEQoNU1RBVEVfVU5LTk9XThAAEgoKBkFDVElWRRABEgsKB1JFVk9LRUQQAhILCgdFWFBJUkVEEAMirAEKIEJhdGNoUmV2b2tlUmV2b2thYmxlVG9rZW5SZXF1ZXN0EioKBmJlZm9yZRgBIAEoCzIaLmdvb2dsZS5wcm90b2J1Zi5UaW1lc3RhbXASGwoTY3JlYXRlZF9ieV9hY3Rvcl9pZBgCIAEoCRI/CgVzY29wZRgDIAEoDjIwLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLlJldm9rYWJsZVRva2VuLlNjb3BlIj4KIUJhdGNoUmV2b2tlUmV2b2thYmxlVG9rZW5SZXNwb25zZRIZChFyZXZva2VkX3Rva2VuX2lkcxgBIAMoCTKoBwoMVG9rZW5TZXJ2aWNlEnEKDElzc3VlSWRUb2tlbhIvLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLklzc3VlSWRUb2tlblJlcXVlc3QaMC5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5Jc3N1ZUlkVG9rZW5SZXNwb25zZRJ9ChBJc3N1ZVRlbmFudFRva2VuEjMubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuSXNzdWVUZW5hbnRUb2tlblJlcXVlc3QaNC5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5Jc3N1ZVRlbmFudFRva2VuUmVzcG9uc2USiQEKFENyZWF0ZVJldm9rYWJsZVRva2VuEjcubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuQ3JlYXRlUmV2b2thYmxlVG9rZW5SZXF1ZXN0GjgubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuQ3JlYXRlUmV2b2thYmxlVG9rZW5SZXNwb25zZRKMAQoVUmVmcmVzaFJldm9rYWJsZVRva2VuEjgubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuUmVmcmVzaFJldm9rYWJsZVRva2VuUmVxdWVzdBo5Lm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLlJlZnJlc2hSZXZva2FibGVUb2tlblJlc3BvbnNlEmcKFFJldm9rZVJldm9rYWJsZVRva2VuEjcubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuUmV2b2tlUmV2b2thYmxlVG9rZW5SZXF1ZXN0GhYuZ29vZ2xlLnByb3RvYnVmLkVtcHR5EoYBChNMaXN0UmV2b2thYmxlVG9rZW5zEjYubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuTGlzdFJldm9rYWJsZVRva2Vuc1JlcXVlc3QaNy5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5MaXN0UmV2b2thYmxlVG9rZW5zUmVzcG9uc2USmAEKGUJhdGNoUmV2b2tlUmV2b2thYmxlVG9rZW4SPC5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5CYXRjaFJldm9rZVJldm9rYWJsZVRva2VuUmVxdWVzdBo9Lm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLkJhdGNoUmV2b2tlUmV2b2thYmxlVG9rZW5SZXNwb25zZWIGcHJvdG8z", [file_google_protobuf_duration, file_google_protobuf_empty, file_google_protobuf_timestamp, file_proto_namespace_cloud_iam_v1beta_authz]);
var RevokableToken_Scope;
(function(RevokableToken_Scope2) {
  RevokableToken_Scope2[RevokableToken_Scope2["SCOPE_UNKNOWN"] = 0] = "SCOPE_UNKNOWN";
  RevokableToken_Scope2[RevokableToken_Scope2["TENANT_SCOPE"] = 1] = "TENANT_SCOPE";
  RevokableToken_Scope2[RevokableToken_Scope2["TENANT_MEMBERSHIP_SCOPE"] = 2] = "TENANT_MEMBERSHIP_SCOPE";
})(RevokableToken_Scope || (RevokableToken_Scope = {}));
var RevokableToken_State;
(function(RevokableToken_State2) {
  RevokableToken_State2[RevokableToken_State2["STATE_UNKNOWN"] = 0] = "STATE_UNKNOWN";
  RevokableToken_State2[RevokableToken_State2["ACTIVE"] = 1] = "ACTIVE";
  RevokableToken_State2[RevokableToken_State2["REVOKED"] = 2] = "REVOKED";
  RevokableToken_State2[RevokableToken_State2["EXPIRED"] = 3] = "EXPIRED";
})(RevokableToken_State || (RevokableToken_State = {}));
var TokenService = /* @__PURE__ */ serviceDesc(file_proto_namespace_cloud_iam_v1beta_tokens, 0);

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/proto/namespace/cloud/iam/v1beta/tenants_pb.js
var file_proto_namespace_cloud_iam_v1beta_tenants = /* @__PURE__ */ fileDesc("Ci5wcm90by9uYW1lc3BhY2UvY2xvdWQvaWFtL3YxYmV0YS90ZW5hbnRzLnByb3RvEhpuYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YSLFAQoTQ3JlYXRlVGVuYW50UmVxdWVzdBIWCgpjcmVhdG9yX2lkGAEgASgJQgIYARIUCgx2aXNpYmxlX25hbWUYAiABKAkSOgoIcG9saWNpZXMYAyADKAsyKC5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5UZW5hbnRQb2xpY3kSGwoTZXh0ZXJuYWxfYWNjb3VudF9pZBgEIAEoCRInCgZsYWJlbHMYBSADKAsyFy5uYW1lc3BhY2Uuc3RkbGliLkxhYmVsIqMBChNVcGRhdGVUZW5hbnRSZXF1ZXN0EhEKCXRlbmFudF9pZBgBIAEoCRIUCgx2aXNpYmxlX25hbWUYAiABKAkSOgoIcG9saWNpZXMYAyADKAsyKC5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5UZW5hbnRQb2xpY3kSJwoGbGFiZWxzGAQgAygLMhcubmFtZXNwYWNlLnN0ZGxpYi5MYWJlbCJ4ChVVcGRhdGVQb2xpY2llc1JlcXVlc3QSEQoJdGVuYW50X2lkGAEgASgJEjoKCHBvbGljaWVzGAIgAygLMigubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuVGVuYW50UG9saWN5EhAKCHJldmlzaW9uGAMgASgDItgBCiVFbnN1cmVUZW5hbnRGb3JFeHRlcm5hbEFjY291bnRSZXF1ZXN0EhQKDHZpc2libGVfbmFtZRgCIAEoCRI6Cghwb2xpY2llcxgDIAMoCzIoLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLlRlbmFudFBvbGljeRIbChNleHRlcm5hbF9hY2NvdW50X2lkGAEgASgJEicKBmxhYmVscxgEIAMoCzIXLm5hbWVzcGFjZS5zdGRsaWIuTGFiZWwSFwoPZW5yb2xsZWRfZ3JvdXBzGAUgAygJIhkKF0Rlc2NyaWJlUG9saWNpZXNSZXF1ZXN0ImgKGERlc2NyaWJlUG9saWNpZXNSZXNwb25zZRI6Cghwb2xpY2llcxgBIAMoCzIoLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLlRlbmFudFBvbGljeRIQCghyZXZpc2lvbhgCIAEoAyLTAQoMVGVuYW50UG9saWN5EgoKAmlkGAEgASgJEg4KBnBvbGljeRgCIAEoCRINCgV2YWx1ZRgDIAEoCRJUChFleHBpcmF0aW9uX3BvbGljeRgEIAEoCzI5Lm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLlRlbmFudFBvbGljeS5FeHBpcmF0aW9uUG9saWN5GkIKEEV4cGlyYXRpb25Qb2xpY3kSLgoKZXhwaXJlc19hdBgBIAEoCzIaLmdvb2dsZS5wcm90b2J1Zi5UaW1lc3RhbXAiRAoOVGVuYW50UmVzcG9uc2USMgoGdGVuYW50GAEgASgLMiIubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuVGVuYW50IrgBCgZUZW5hbnQSCgoCaWQYASABKAkSFgoKY3JlYXRvcl9pZBgCIAEoCUICGAESGwoTZXh0ZXJuYWxfYWNjb3VudF9pZBgFIAEoCRIuCgpjcmVhdGVkX2F0GAMgASgLMhouZ29vZ2xlLnByb3RvYnVmLlRpbWVzdGFtcBIUCgx2aXNpYmxlX25hbWUYBCABKAkSJwoGbGFiZWxzGAYgAygLMhcubmFtZXNwYWNlLnN0ZGxpYi5MYWJlbCIkCg9UZW5hbnRSZWZlcmVuY2USEQoJdGVuYW50X2lkGAEgASgJImQKEkxpc3RUZW5hbnRzUmVxdWVzdBINCgVsaW1pdBgBIAEoBRIOCgZjdXJzb3IYAiABKAkSEgoKY3JlYXRvcl9pZBgDIAEoCRIbChNleHRlcm5hbF9hY2NvdW50X2lkGAQgASgJIloKE0xpc3RUZW5hbnRzUmVzcG9uc2USMwoHdGVuYW50cxgBIAMoCzIiLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLlRlbmFudBIOCgZjdXJzb3IYAiABKAki9AEKI0lzc3VlVGVuYW50Q2xpZW50Q2VydGlmaWNhdGVSZXF1ZXN0EhEKCXRlbmFudF9pZBgBIAEoCRIQCghhY3Rvcl9pZBgCIAEoCRIVCg1kdXJhdGlvbl9zZWNzGAMgASgDEj8KCHBvbGljaWVzGAQgAygLMi0ubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuVGVuYW50VG9rZW5Qb2xpY3kSOAoGYWNjZXNzGAYgASgLMigubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuQWNjZXNzUG9saWN5EhYKDnB1YmxpY19rZXlfcGVtGAUgASgJImUKJElzc3VlVGVuYW50Q2xpZW50Q2VydGlmaWNhdGVSZXNwb25zZRIeChZjbGllbnRfY2VydGlmaWNhdGVfcGVtGAEgASgJEhcKD3ByaXZhdGVfa2V5X3BlbRgCIAEoCUoECAMQBCJpChhFbnN1cmVUZW5hbnRHcm91cFJlcXVlc3QSDAoEbmFtZRgBIAEoCRI/Cghwb2xpY2llcxgCIAMoCzItLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLlRlbmFudEdyb3VwUG9saWN5IiMKE1RlbmFudEdyb3VwUmVzcG9uc2USDAoEbmFtZRgBIAEoCSIyChFUZW5hbnRHcm91cFBvbGljeRIOCgZwb2xpY3kYASABKAkSDQoFdmFsdWUYAiABKAkiGQoXTGlzdFRlbmFudEdyb3Vwc1JlcXVlc3Qi0QEKGExpc3RUZW5hbnRHcm91cHNSZXNwb25zZRJXCg10ZW5hbnRfZ3JvdXBzGAEgAygLMkAubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuTGlzdFRlbmFudEdyb3Vwc1Jlc3BvbnNlLlRlbmFudEdyb3VwGlwKC1RlbmFudEdyb3VwEgwKBG5hbWUYASABKAkSPwoIcG9saWNpZXMYAiADKAsyLS5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5UZW5hbnRHcm91cFBvbGljeSIkChRUZW5hbnRHcm91cFJlZmVyZW5jZRIMCgRuYW1lGAEgASgJIokBChtEZXNjcmliZVRlbmFudEdyb3VwUmVzcG9uc2USDAoEbmFtZRgBIAEoCRI/Cghwb2xpY2llcxgCIAMoCzItLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLlRlbmFudEdyb3VwUG9saWN5EhsKE2Vucm9sbGVkX3RlbmFudF9pZHMYAyADKAky6AwKDVRlbmFudFNlcnZpY2USawoMQ3JlYXRlVGVuYW50Ei8ubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuQ3JlYXRlVGVuYW50UmVxdWVzdBoqLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLlRlbmFudFJlc3BvbnNlEmsKDFVwZGF0ZVRlbmFudBIvLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLlVwZGF0ZVRlbmFudFJlcXVlc3QaKi5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5UZW5hbnRSZXNwb25zZRJ9ChBEZXNjcmliZVBvbGljaWVzEjMubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuRGVzY3JpYmVQb2xpY2llc1JlcXVlc3QaNC5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5EZXNjcmliZVBvbGljaWVzUmVzcG9uc2USWwoOVXBkYXRlUG9saWNpZXMSMS5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5VcGRhdGVQb2xpY2llc1JlcXVlc3QaFi5nb29nbGUucHJvdG9idWYuRW1wdHkSjwEKHkVuc3VyZVRlbmFudEZvckV4dGVybmFsQWNjb3VudBJBLm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLkVuc3VyZVRlbmFudEZvckV4dGVybmFsQWNjb3VudFJlcXVlc3QaKi5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5UZW5hbnRSZXNwb25zZRJTCgxSZW1vdmVUZW5hbnQSKy5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5UZW5hbnRSZWZlcmVuY2UaFi5nb29nbGUucHJvdG9idWYuRW1wdHkSbgoLTGlzdFRlbmFudHMSLi5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5MaXN0VGVuYW50c1JlcXVlc3QaLy5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5MaXN0VGVuYW50c1Jlc3BvbnNlEn0KEElzc3VlVGVuYW50VG9rZW4SMy5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5Jc3N1ZVRlbmFudFRva2VuUmVxdWVzdBo0Lm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLklzc3VlVGVuYW50VG9rZW5SZXNwb25zZRKhAQocSXNzdWVUZW5hbnRDbGllbnRDZXJ0aWZpY2F0ZRI/Lm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLklzc3VlVGVuYW50Q2xpZW50Q2VydGlmaWNhdGVSZXF1ZXN0GkAubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuSXNzdWVUZW5hbnRDbGllbnRDZXJ0aWZpY2F0ZVJlc3BvbnNlElQKDVN1c3BlbmRUZW5hbnQSKy5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5UZW5hbnRSZWZlcmVuY2UaFi5nb29nbGUucHJvdG9idWYuRW1wdHkSUwoMUmVzdW1lVGVuYW50EisubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuVGVuYW50UmVmZXJlbmNlGhYuZ29vZ2xlLnByb3RvYnVmLkVtcHR5EnoKEUVuc3VyZVRlbmFudEdyb3VwEjQubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuRW5zdXJlVGVuYW50R3JvdXBSZXF1ZXN0Gi8ubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuVGVuYW50R3JvdXBSZXNwb25zZRJ9ChBMaXN0VGVuYW50R3JvdXBzEjMubmFtZXNwYWNlLmNsb3VkLmlhbS52MWJldGEuTGlzdFRlbmFudEdyb3Vwc1JlcXVlc3QaNC5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5MaXN0VGVuYW50R3JvdXBzUmVzcG9uc2USgAEKE0Rlc2NyaWJlVGVuYW50R3JvdXASMC5uYW1lc3BhY2UuY2xvdWQuaWFtLnYxYmV0YS5UZW5hbnRHcm91cFJlZmVyZW5jZRo3Lm5hbWVzcGFjZS5jbG91ZC5pYW0udjFiZXRhLkRlc2NyaWJlVGVuYW50R3JvdXBSZXNwb25zZWIGcHJvdG8z", [file_google_protobuf_empty, file_google_protobuf_timestamp, file_proto_namespace_stdlib_labels, file_proto_namespace_cloud_iam_v1beta_authz, file_proto_namespace_cloud_iam_v1beta_tokens]);
var TenantService = /* @__PURE__ */ serviceDesc(file_proto_namespace_cloud_iam_v1beta_tenants, 0);

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/api/iam/client.js
function createIAMClient(opts) {
  const transport = opts.transport || createGlobalTransport({
    tokenSource: opts.tokenSource
  });
  return {
    tenants: createClient(TenantService, transport),
    tokens: createClient(TokenService, transport)
  };
}

// src/credentials.ts
import { existsSync } from "node:fs";

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/auth/claims.js
function extractClaims(token) {
  try {
    const cleanToken = stripTokenPrefix(token);
    const parts = cleanToken.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const claims = JSON.parse(decoded);
    return claims;
  } catch (error2) {
    return null;
  }
}
function stripTokenPrefix(token) {
  const prefixes = ["st_", "nsct_", "nscw_", "oidc_", "cognito_"];
  for (const prefix of prefixes) {
    if (token.startsWith(prefix)) {
      return token.substring(prefix.length);
    }
  }
  return token;
}

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/auth/token.js
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/proto/namespace/private/sessions/session_pb.js
var file_proto_namespace_private_sessions_session = /* @__PURE__ */ fileDesc("Ci5wcm90by9uYW1lc3BhY2UvcHJpdmF0ZS9zZXNzaW9ucy9zZXNzaW9uLnByb3RvEiFuYW1lc3BhY2UucHJpdmF0ZS5zZXNzaW9ucy52MWJldGEi3gMKD1JlcXVlc3RNZXRhZGF0YRISCgpyZXF1ZXN0X2lkGAEgASgJEhIKCnVzZXJfYWdlbnQYAiABKAkSDwoHdWFfbmFtZRgEIAEoCRISCgp1YV92ZXJzaW9uGAUgASgJEg0KBXVhX29zGAYgASgJEhUKDXVhX29zX3ZlcnNpb24YByABKAkSEQoJdWFfZGV2aWNlGAggASgJElcKDnVhX2RldmljZV9raW5kGAkgASgOMj8ubmFtZXNwYWNlLnByaXZhdGUuc2Vzc2lvbnMudjFiZXRhLlJlcXVlc3RNZXRhZGF0YS5VYURldmljZUtpbmQSEgoKaXBfYWRkcmVzcxgDIAEoCRISCgppcF9jaXR5X2lkGAogASgDEhIKCmlwX2NpdHlfZW4YCyABKAkSFgoOaXBfY291bnRyeV9pc28YDCABKAkSFQoNaXBfY291bnRyeV9lbhgNIAEoCSKAAQoMVWFEZXZpY2VLaW5kEhoKFlVBX0RFVklDRV9LSU5EX1VOS05PV04QABIUChBVQV9ERVZJQ0VfTU9CSUxFEAESFAoQVUFfREVWSUNFX1RBQkxFVBACEhUKEVVBX0RFVklDRV9ERVNLVE9QEAMSEQoNVUFfREVWSUNFX0JPVBAEIqIDCgdTZXNzaW9uEgoKAmlkGAEgASgJEhAKCG93bmVyX2lkGAIgASgJEhEKCXRlbmFudF9pZBgDIAEoCRIuCgpjcmVhdGVkX2F0GAQgASgLMhouZ29vZ2xlLnByb3RvYnVmLlRpbWVzdGFtcBIuCgpleHBpcmVzX2F0GAUgASgLMhouZ29vZ2xlLnByb3RvYnVmLlRpbWVzdGFtcBIyCg5pbnZhbGlkYXRlZF9hdBgGIAEoCzIaLmdvb2dsZS5wcm90b2J1Zi5UaW1lc3RhbXASMAoMbGFzdF91c2VkX2F0GAkgASgLMhouZ29vZ2xlLnByb3RvYnVmLlRpbWVzdGFtcBJNChFjcmVhdGlvbl9tZXRhZGF0YRgHIAEoCzIyLm5hbWVzcGFjZS5wcml2YXRlLnNlc3Npb25zLnYxYmV0YS5SZXF1ZXN0TWV0YWRhdGESUQoVaW52YWxpZGF0aW9uX21ldGFkYXRhGAggASgLMjIubmFtZXNwYWNlLnByaXZhdGUuc2Vzc2lvbnMudjFiZXRhLlJlcXVlc3RNZXRhZGF0YUJIWkZuYW1lc3BhY2VsYWJzLmRldi9pbnRlcm5hbC9wdWJsaWMvZ2VuL3Byb3RvL25hbWVzcGFjZS9wcml2YXRlL3Nlc3Npb25zYgZwcm90bzM", [file_google_protobuf_timestamp]);
var RequestMetadata_UaDeviceKind;
(function(RequestMetadata_UaDeviceKind2) {
  RequestMetadata_UaDeviceKind2[RequestMetadata_UaDeviceKind2["UA_DEVICE_KIND_UNKNOWN"] = 0] = "UA_DEVICE_KIND_UNKNOWN";
  RequestMetadata_UaDeviceKind2[RequestMetadata_UaDeviceKind2["UA_DEVICE_MOBILE"] = 1] = "UA_DEVICE_MOBILE";
  RequestMetadata_UaDeviceKind2[RequestMetadata_UaDeviceKind2["UA_DEVICE_TABLET"] = 2] = "UA_DEVICE_TABLET";
  RequestMetadata_UaDeviceKind2[RequestMetadata_UaDeviceKind2["UA_DEVICE_DESKTOP"] = 3] = "UA_DEVICE_DESKTOP";
  RequestMetadata_UaDeviceKind2[RequestMetadata_UaDeviceKind2["UA_DEVICE_BOT"] = 4] = "UA_DEVICE_BOT";
})(RequestMetadata_UaDeviceKind || (RequestMetadata_UaDeviceKind = {}));

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/proto/namespace/private/sessions/users_pb.js
var file_proto_namespace_private_sessions_users = /* @__PURE__ */ fileDesc("Cixwcm90by9uYW1lc3BhY2UvcHJpdmF0ZS9zZXNzaW9ucy91c2Vycy5wcm90bxIhbmFtZXNwYWNlLnByaXZhdGUuc2Vzc2lvbnMudjFiZXRhIlMKFExpc3RTZXNzaW9uc1Jlc3BvbnNlEjsKB3Nlc3Npb24YASADKAsyKi5uYW1lc3BhY2UucHJpdmF0ZS5zZXNzaW9ucy52MWJldGEuU2Vzc2lvbiIuChhJbnZhbGlkYXRlU2Vzc2lvblJlcXVlc3QSEgoKc2Vzc2lvbl9pZBgBIAEoCSIzCh1JbnZhbGlkYXRlQWxsU2Vzc2lvbnNSZXNwb25zZRISCgpzZXNzaW9uX2lkGAEgAygJIlcKIklzc3VlVGVuYW50VG9rZW5Gcm9tU2Vzc2lvblJlcXVlc3QSMQoOdG9rZW5fZHVyYXRpb24YASABKAsyGS5nb29nbGUucHJvdG9idWYuRHVyYXRpb24iOwojSXNzdWVUZW5hbnRUb2tlbkZyb21TZXNzaW9uUmVzcG9uc2USFAoMdGVuYW50X3Rva2VuGAEgASgJMoIEChNVc2VyU2Vzc2lvbnNTZXJ2aWNlEl8KDExpc3RTZXNzaW9ucxIWLmdvb2dsZS5wcm90b2J1Zi5FbXB0eRo3Lm5hbWVzcGFjZS5wcml2YXRlLnNlc3Npb25zLnYxYmV0YS5MaXN0U2Vzc2lvbnNSZXNwb25zZRJoChFJbnZhbGlkYXRlU2Vzc2lvbhI7Lm5hbWVzcGFjZS5wcml2YXRlLnNlc3Npb25zLnYxYmV0YS5JbnZhbGlkYXRlU2Vzc2lvblJlcXVlc3QaFi5nb29nbGUucHJvdG9idWYuRW1wdHkScQoVSW52YWxpZGF0ZUFsbFNlc3Npb25zEhYuZ29vZ2xlLnByb3RvYnVmLkVtcHR5GkAubmFtZXNwYWNlLnByaXZhdGUuc2Vzc2lvbnMudjFiZXRhLkludmFsaWRhdGVBbGxTZXNzaW9uc1Jlc3BvbnNlEqwBChtJc3N1ZVRlbmFudFRva2VuRnJvbVNlc3Npb24SRS5uYW1lc3BhY2UucHJpdmF0ZS5zZXNzaW9ucy52MWJldGEuSXNzdWVUZW5hbnRUb2tlbkZyb21TZXNzaW9uUmVxdWVzdBpGLm5hbWVzcGFjZS5wcml2YXRlLnNlc3Npb25zLnYxYmV0YS5Jc3N1ZVRlbmFudFRva2VuRnJvbVNlc3Npb25SZXNwb25zZWIGcHJvdG8z", [file_google_protobuf_empty, file_google_protobuf_duration, file_proto_namespace_private_sessions_session]);
var UserSessionsService = /* @__PURE__ */ serviceDesc(file_proto_namespace_private_sessions_users, 0);

// node_modules/.pnpm/@namespacelabs+sdk@1.0.0_@bufbuild+protobuf@2.14.1_@connectrpc+connect-node@2.2.0_@bufb_1ec7bcd980dad313539c930aec7d1df4/node_modules/@namespacelabs/sdk/dist/esm/auth/token.js
function getIAMEndpoint() {
  return process.env.NSC_IAM_ENDPOINT || process.env.NSC_GLOBAL_ENDPOINT || "https://private-api.global.namespaceapis.com";
}
function getDebugFlags() {
  const val = process.env.NSC_DEBUG;
  if (!val)
    return /* @__PURE__ */ new Set();
  return new Set(val.split(",").map((s) => s.trim().toLowerCase()));
}
function isAuthDebugEnabled() {
  return getDebugFlags().has("auth");
}
function isForceAuthRefreshEnabled() {
  return getDebugFlags().has("force-auth-refresh");
}
function debug(message) {
  if (isAuthDebugEnabled()) {
    console.error(`[nsc:auth] ${message}`);
  }
}
var NotLoggedInError = class extends Error {
  constructor() {
    super("you are not logged in to Namespace; try running `nsc login`");
    this.name = "NotLoggedInError";
  }
};
function getUserConfigDir() {
  const platform2 = os.platform();
  if (platform2 === "darwin") {
    return path.join(os.homedir(), "Library/Application Support");
  } else if (platform2 === "win32") {
    return process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming");
  } else {
    return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  }
}
async function loadFromFile(tokenPath) {
  try {
    const content = await fs.readFile(tokenPath, "utf8");
    const tokenJson = JSON.parse(content);
    const dir = path.dirname(tokenPath);
    debug(`Loaded token from ${tokenPath}`);
    if (tokenJson.session_token) {
      debug("Token type: session token (will refresh bearer tokens)");
    } else if (tokenJson.bearer_token) {
      const claims = extractClaims(tokenJson.bearer_token);
      if (claims?.exp) {
        const expiresAt = new Date(claims.exp * 1e3);
        const now = /* @__PURE__ */ new Date();
        if (expiresAt > now) {
          const remainingMs = expiresAt.getTime() - now.getTime();
          const remainingMins = Math.floor(remainingMs / 6e4);
          debug(`Token type: bearer token (valid for ${remainingMins} minutes)`);
        } else {
          debug("Token type: bearer token (expired)");
        }
      } else {
        debug("Token type: bearer token (no expiration)");
      }
    }
    return new LoadedToken(tokenJson.bearer_token, tokenJson.session_token, dir);
  } catch (error2) {
    if (error2.code === "ENOENT") {
      throw new NotLoggedInError();
    }
    throw error2;
  }
}
async function loadDefaults() {
  if (process.env.NSC_TOKEN_FILE) {
    return await loadFromFile(process.env.NSC_TOKEN_FILE);
  }
  const workloadPath = "/var/run/nsc/token.json";
  try {
    await fs.access(workloadPath);
    return await loadFromFile(workloadPath);
  } catch {
  }
  return await loadUserToken();
}
async function loadUserToken() {
  const configDir = getUserConfigDir();
  const tokenPath = path.join(configDir, "ns/token.json");
  return await loadFromFile(tokenPath);
}
async function loadWorkloadToken() {
  const tokenPath = process.env.NSC_TOKEN_FILE || "/var/run/nsc/token.json";
  const loaded = await loadFromFile(tokenPath);
  if (!loaded.bearerToken) {
    throw new Error("Workload token file does not contain a bearer token");
  }
  return new LoadedToken(loaded.bearerToken, void 0, void 0);
}
function fromBearerToken(token) {
  return new LoadedToken(token, void 0, void 0);
}
var LoadedToken = class {
  constructor(bearerToken, sessionToken, cacheDir) {
    this.bearerToken = bearerToken;
    this.sessionToken = sessionToken;
    this.cacheDir = cacheDir;
  }
  getSessionsClient() {
    if (!this.sessionsClient) {
      const transport = createConnectTransport({
        httpVersion: "1.1",
        baseUrl: getIAMEndpoint(),
        useBinaryFormat: false,
        interceptors: [
          (next) => async (req) => {
            if (this.sessionToken) {
              req.header.set("Authorization", `Bearer ${this.sessionToken}`);
            }
            return await next(req);
          }
        ]
      });
      this.sessionsClient = createClient(UserSessionsService, transport);
    }
    return this.sessionsClient;
  }
  async issueToken(minDuration, force = false) {
    if (this.sessionToken) {
      return await this.issueFromSession(minDuration, force);
    }
    if (this.bearerToken) {
      return this.bearerToken;
    }
    throw new Error("No bearer token or session token available");
  }
  async issueFromSession(minDuration, force) {
    if (!this.sessionToken) {
      throw new Error("No session token available");
    }
    const issueNewToken = async (durationMs) => {
      const client = this.getSessionsClient();
      const durationSeconds = BigInt(Math.floor(durationMs / 1e3));
      const res = await client.issueTenantTokenFromSession({
        tokenDuration: create(DurationSchema, { seconds: durationSeconds })
      });
      return res.tenantToken;
    };
    const forceRefresh = force || isForceAuthRefreshEnabled();
    if (forceRefresh) {
      debug("Forcing new token issue");
      const start2 = Date.now();
      const token = await issueNewToken(minDuration);
      debug(`Issued new bearer token from session (took ${Date.now() - start2}ms)`);
      return token;
    }
    const sessionClaims = extractClaims(this.sessionToken);
    if (!sessionClaims) {
      throw new Error("Failed to extract claims from session token");
    }
    if (this.cacheDir) {
      const cachePath = path.join(this.cacheDir, "token.cache");
      try {
        const cacheContents = await fs.readFile(cachePath, "utf8");
        const cacheClaims = extractClaims(cacheContents);
        if (cacheClaims && cacheClaims.tenant_id === sessionClaims.tenant_id) {
          const nowMs = Date.now();
          const expiresAtMs = (cacheClaims.exp || 0) * 1e3;
          if (expiresAtMs > nowMs + minDuration) {
            const remainingMins = Math.floor((expiresAtMs - nowMs) / 6e4);
            debug(`Using cached bearer token (valid for ${remainingMins} minutes)`);
            return cacheContents;
          }
        }
      } catch {
      }
    }
    let requestDuration = minDuration * 2;
    const oneHourMs = 60 * 60 * 1e3;
    if (requestDuration > oneHourMs) {
      requestDuration = oneHourMs;
    }
    debug("Issuing new bearer token from session");
    const start = Date.now();
    const newToken = await issueNewToken(requestDuration);
    const elapsed = Date.now() - start;
    if (this.cacheDir) {
      const cachePath = path.join(this.cacheDir, "token.cache");
      try {
        await fs.writeFile(cachePath, newToken, { mode: 384 });
      } catch {
      }
    }
    const newClaims = extractClaims(newToken);
    if (newClaims?.exp) {
      const remainingMins = Math.floor((newClaims.exp * 1e3 - Date.now()) / 6e4);
      debug(`Issued new bearer token (valid for ${remainingMins} minutes, took ${elapsed}ms)`);
    } else {
      debug(`Issued new bearer token (took ${elapsed}ms)`);
    }
    return newToken;
  }
};

// src/credentials.ts
var WORKLOAD_TOKEN_FILE = "/var/run/nsc/token.json";
async function credentials() {
  if (process.env.NX_NAMESPACE_TOKEN) {
    return fromBearerToken(process.env.NX_NAMESPACE_TOKEN);
  }
  if (existsSync(WORKLOAD_TOKEN_FILE)) {
    return {
      async issueToken(duration) {
        return (await loadWorkloadToken()).issueToken(duration);
      }
    };
  }
  return loadDefaults();
}

// src/lease.ts
import { randomUUID } from "node:crypto";
var BUILD_TOKEN_LIFETIME_MS = HOUR_MS;
var IAM_REQUEST_TIMEOUT_MS = 15 * SECOND_MS;
function artifactGrant(access3) {
  if (access3 !== CacheAccess.ReadOnly && access3 !== CacheAccess.ReadWrite) {
    throw new Error("Expected read-only or read-write");
  }
  return {
    resourceType: "artifact",
    resourceId: "",
    actions: access3 === CacheAccess.ReadOnly ? ["resolve"] : ["resolve", "create"]
  };
}
async function leaseArtifactToken(access3) {
  const grant = artifactGrant(access3);
  const iam = createIAMClient({ tokenSource: await credentials() });
  const result = await iam.tokens.createRevokableToken(
    {
      name: `nx-build-${process.env.GITHUB_RUN_ID ?? "local"}-${randomUUID()}`,
      description: "Build-only Artifact cache access",
      expiresAt: timestampFromDate(new Date(Date.now() + BUILD_TOKEN_LIFETIME_MS)),
      access: { grants: [grant] }
    },
    { timeoutMs: IAM_REQUEST_TIMEOUT_MS }
  );
  const tokenId = result.token?.tokenId;
  if (!tokenId || !result.bearerToken) {
    if (tokenId) {
      await iam.tokens.revokeRevokableToken({ tokenId }, { timeoutMs: IAM_REQUEST_TIMEOUT_MS });
    }
    throw new Error("Missing build credential");
  }
  return {
    bearerToken: result.bearerToken,
    revoke: () => iam.tokens.revokeRevokableToken({ tokenId }, { timeoutMs: IAM_REQUEST_TIMEOUT_MS })
  };
}

// src/execute.ts
import { spawn } from "node:child_process";
import { constants as constants3 } from "node:os";
var TERMINATION_GRACE_MS = 3 * SECOND_MS;
var DESCENDANT_POLL_INTERVAL_MS = SECOND_MS / 10;
var DESCENDANT_POLL_ATTEMPTS = TERMINATION_GRACE_MS / DESCENDANT_POLL_INTERVAL_MS;
async function execute(command2, args2, env) {
  const grouped = process.platform !== "win32";
  const child = spawn(command2, args2, { env, stdio: "inherit", detached: grouped });
  let escalation;
  function signal(signal2) {
    if (!child.pid) {
      return;
    }
    try {
      if (grouped) {
        process.kill(-child.pid, signal2);
      } else {
        child.kill(signal2);
      }
    } catch (error2) {
      if (!(error2 instanceof Error && "code" in error2 && error2.code === "ESRCH")) {
        throw error2;
      }
    }
  }
  function terminate(signalName) {
    signal(signalName);
    escalation ??= setTimeout(() => signal(ProcessSignal.Kill), TERMINATION_GRACE_MS);
  }
  const interrupt = () => terminate(ProcessSignal.Interrupt);
  const stop = () => terminate(ProcessSignal.Terminate);
  process.on(ProcessSignal.Interrupt, interrupt);
  process.on(ProcessSignal.Terminate, stop);
  try {
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once(
        "exit",
        (code2, signal2) => resolve(
          code2 ?? (signal2 ? SIGNAL_EXIT_CODE_BASE + constants3.signals[signal2] : ExitCode.Failure)
        )
      );
    });
    signal(ProcessSignal.Terminate);
    if (grouped && child.pid) {
      const pid = child.pid;
      for (let i = 0; i < DESCENDANT_POLL_ATTEMPTS; i++) {
        try {
          process.kill(-pid, PROCESS_EXISTENCE_PROBE);
        } catch {
          return code;
        }
        await new Promise((resolve) => setTimeout(resolve, DESCENDANT_POLL_INTERVAL_MS));
      }
      signal(ProcessSignal.Kill);
    }
    return code;
  } finally {
    if (escalation) {
      clearTimeout(escalation);
    }
    process.off(ProcessSignal.Interrupt, interrupt);
    process.off(ProcessSignal.Terminate, stop);
  }
}

// src/leased-command.ts
async function runLeasedCommand(access3, command2, args2, env, issue = leaseArtifactToken, run = execute) {
  artifactGrant(access3);
  const strict = env.NX_CACHE_FAILURE_MODE === CacheFailureMode.Strict;
  let lease;
  try {
    lease = await issue(access3);
  } catch {
    process.stderr.write("Artifact token issuance failed\n");
    if (strict) {
      return ExitCode.Failure;
    }
    return run(command2, args2, { ...env, NX_NAMESPACE_TOKEN: "" });
  }
  if (env.GITHUB_ACTIONS === "true") {
    process.stderr.write(`::add-mask::${lease.bearerToken}
`);
  }
  let code = ExitCode.Success;
  try {
    code = await run(command2, args2, { ...env, NX_NAMESPACE_TOKEN: lease.bearerToken });
  } finally {
    try {
      await lease.revoke();
    } catch {
      process.stderr.write("Artifact token revocation failed; token expires within one hour\n");
      if (strict) {
        code ||= ExitCode.Failure;
      }
    }
  }
  return code;
}

// src/token-command.ts
var [access2, command, ...args] = process.argv.slice(NODE_USER_ARGUMENT_OFFSET);
if (!access2 || !command) {
  throw new Error("Expected access mode followed by command");
}
process.exitCode = await runLeasedCommand(access2, command, args, process.env);
