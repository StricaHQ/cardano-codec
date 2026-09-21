import { CborNode, decodeAnnotated, encode } from "@stricahq/cbors";

/** Plain Uint8Array from hex. */
export const fromHex = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));

/** Decoded as a parser takes it: a node, with the depth limit lifted. */
export const decodeCbor = (bytes: Uint8Array): CborNode =>
  decodeAnnotated(bytes, { maxDepth: Infinity });

/**
 * A transaction body built with cbors and decoded for the parsers: one input, no outputs and
 * a fee, then `fields`. A field with one of those keys replaces it in place.
 */
export const txBody = (fields: Array<[number, unknown]> = []) =>
  decodeCbor(
    encode(
      new Map<number, unknown>([[0, [[new Uint8Array(32), 0]]], [1, []], [2, 200000], ...fields])
    )
  );
