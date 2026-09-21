import { CborNode, decodeAnnotated } from "@stricahq/cbors";
import { toHex } from "./utils";

const fail = (n: CborNode | undefined, expected: string): never => {
  if (!n) throw new Error(`Expected ${expected}, got nothing`);
  const got = n.kind === "tag" ? `tag ${n.tag}` : n.kind;
  throw new Error(`Expected ${expected} at bytes [${n.span[0]}, ${n.span[1]}), got ${got}`);
};

type NilNode = CborNode & { kind: "null" | "undefined" };

/** The whole item as it was written, header included: what the ledger hashes. */
export const encoded = (n: CborNode | undefined): Uint8Array => (n ? n.bytes : fail(n, "an item"));

/** Absent, or CBOR null or undefined. An empty array or map is not nil. */
export const isNil = (n: CborNode | undefined): n is NilNode | undefined =>
  !n || n.kind === "null" || n.kind === "undefined";

/** Array items. Looks through tag 258, which Conway allows around every set. */
export const items = (n: CborNode | undefined): Array<CborNode> => {
  const array = n?.kind === "tag" && n.tag === 258 ? n.child : n;
  return array?.kind === "array" ? array.items! : fail(array, "array");
};

export const entries = (n: CborNode | undefined): Array<{ key: CborNode; value: CborNode }> =>
  n?.kind === "map" ? n.entries! : fail(n, "map");

/** A major type 0/1 integer or a bignum (tag 2/3); a bigint beyond ±2^53. */
export const int = (n: CborNode | undefined): number | bigint => {
  if (n?.kind === "uint" || n?.kind === "nint") return n.value as number | bigint;
  if (n?.kind === "tag" && (n.tag === 2 || n.tag === 3)) return n.toJS() as bigint;
  return fail(n, "integer");
};

/** An integer passed through to the output. Typed number, but a bigint beyond ±2^53. */
export const num = (n: CborNode | undefined): number => int(n) as number;

/** An amount as a decimal string. */
export const coin = (n: CborNode | undefined): string => int(n).toString();

/** Joins the chunks of an indefinite text string. */
export const text = (n: CborNode | undefined): string =>
  n?.kind === "text" ? (n.toJS() as string) : fail(n, "text");

/** Joins the chunks of an indefinite byte string; a definite one is a view of the input. */
export const bytes = (n: CborNode | undefined): Uint8Array =>
  n?.kind === "bytes" ? (n.toJS() as Uint8Array) : fail(n, "bytes");

export const hex = (n: CborNode | undefined): string => toHex(bytes(n));

/** Content of a tag with this number. */
export const tagged = (n: CborNode | undefined, tag: number): CborNode =>
  n?.kind === "tag" && n.tag === tag ? n.child! : fail(n, `tag ${tag}`);

// Chain data nests deeper than cbors' default limit of 1024, and nothing here recurses.
const DECODE_OPTIONS = { maxDepth: Infinity };

/**
 * The item inside tag 24 (an encoded CBOR data item), decoded on its own: its spans are
 * relative to the byte string, and its bytes are exactly the bytes written there.
 */
export const embedded = (n: CborNode | undefined): CborNode =>
  decodeAnnotated(bytes(tagged(n, 24)), DECODE_OPTIONS);

/** A rational, tag 30 [numerator, denominator], as a number. Either part may be a bigint. */
export const ratio = (n: CborNode | undefined): number => {
  const [numerator, denominator] = items(tagged(n, 30));
  return Number(int(numerator)) / Number(int(denominator));
};
