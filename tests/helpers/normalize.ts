/**
 * Parser output as the JSON the golden files hold:
 *
 * - `Uint8Array` → `{ $bytes: hex }`
 * - `bigint` → `{ $int: decimal }`
 * - `Map` → `{ $map: [[key, value], …] }`
 * - object keys holding `undefined` are dropped, as `JSON.stringify` does
 * - `undefined` elsewhere and non-finite numbers, which JSON would turn into
 *   `null` → `{ $undefined: true }` / `{ $float: "NaN" }`
 *
 * Object keys and map entries keep their order. Any other class throws rather
 * than being written out field by field.
 */

export type Json = null | boolean | number | string | Array<Json> | { [key: string]: Json };

const isPlainObject = (v: object) => {
  const proto = Object.getPrototypeOf(v);
  return proto === null || proto === Object.prototype;
};

const className = (v: object): string => Object.getPrototypeOf(v)?.constructor?.name ?? "object";

const toHex = (b: Uint8Array) => Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString("hex");

export const normalize = (value: unknown, path = "$"): Json => {
  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : { $float: String(value) };
    case "bigint":
      return { $int: value.toString() };
    case "undefined":
      return { $undefined: true };
    case "object":
      break;
    default:
      throw new TypeError(`normalize: unsupported ${typeof value} at ${path}`);
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return Array.from(value, (v, i) => normalize(v, `${path}[${i}]`));
  }
  if (value instanceof Uint8Array) {
    return { $bytes: toHex(value) };
  }
  if (value instanceof Map) {
    return {
      $map: Array.from(value, ([k, v], i) => [
        normalize(k, `${path}<key ${i}>`),
        normalize(v, `${path}<value ${i}>`),
      ]),
    };
  }
  if (isPlainObject(value)) {
    const out: { [key: string]: Json } = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        out[k] = normalize(v, `${path}.${k}`);
      }
    }
    return out;
  }
  throw new TypeError(`normalize: unsupported ${className(value)} at ${path}`);
};
