import { blake2b } from "blakejs";

// ASCII codes of the two hex digits of every byte value
const HEX_HI = new Uint8Array(256);
const HEX_LO = new Uint8Array(256);
for (let i = 0; i < 256; i += 1) {
  const digits = i.toString(16).padStart(2, "0");
  HEX_HI[i] = digits.charCodeAt(0);
  HEX_LO[i] = digits.charCodeAt(1);
}
const ascii = new TextDecoder();

// Lowercase hex of any Uint8Array, Node buffers included.
export const toHex = (bytes: Uint8Array): string => {
  const length = bytes.length;
  const digits = new Uint8Array(length * 2);
  for (let i = 0; i < length; i += 1) {
    const byte = bytes[i];
    digits[2 * i] = HEX_HI[byte];
    digits[2 * i + 1] = HEX_LO[byte];
  }
  return ascii.decode(digits);
};

export const concatBytes = (...parts: Array<Uint8Array>): Uint8Array => {
  let length = 0;
  for (const part of parts) length += part.length;
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const hash = (bytes: Uint8Array, size: number) => toHex(blake2b(bytes, undefined, size));

export const createHash32 = (bytes: Uint8Array) => hash(bytes, 32);

export const createHash28 = (bytes: Uint8Array) => hash(bytes, 28);

// A script hash covers a language prefix (0 native, 1 to 3 Plutus V1 to V3) and the script:
// a native script as encoded, a Plutus script as the content of its byte string.
export const createScriptHash = (prefix: number, script: Uint8Array) =>
  createHash28(concatBytes(Uint8Array.of(prefix), script));
