// Builds the synthetic fixtures in this directory: shapes the parsers handle that no real
// transaction carries, and blocks assembled from the real fixtures. Hashes and keys are
// filler bytes. The output is deterministic. After a change, run this script and review
// the golden diffs; `--check` only compares. No dependencies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.dirname(DIR);

// --- a minimal CBOR encoder (definite lengths) -------------------------------------------

class Tag {
  constructor(tag, value) {
    this.tag = tag;
    this.value = value;
  }
}

// already encoded CBOR, spliced in as is
class Raw {
  constructor(bytes) {
    this.bytes = typeof bytes === "string" ? Buffer.from(bytes, "hex") : bytes;
  }
}

const head = (major, n) => {
  const v = BigInt(n);
  if (v < 24n) return [(major << 5) | Number(v)];
  const size = v < 0x100n ? 1 : v < 0x10000n ? 2 : v < 0x100000000n ? 4 : 8;
  const out = [(major << 5) | { 1: 24, 2: 25, 4: 26, 8: 27 }[size]];
  for (let i = size - 1; i >= 0; i -= 1) out.push(Number((v >> BigInt(8 * i)) & 0xffn));
  return out;
};

const encodeInto = (value, out) => {
  if (value === null) out.push(Buffer.of(0xf6));
  else if (value === true || value === false) out.push(Buffer.of(value ? 0xf5 : 0xf4));
  else if (typeof value === "number" || typeof value === "bigint") {
    const v = BigInt(value);
    out.push(Buffer.from(v >= 0n ? head(0, v) : head(1, -1n - v)));
  } else if (typeof value === "string") {
    const b = Buffer.from(value, "utf8");
    out.push(Buffer.from(head(3, b.length)), b);
  } else if (value instanceof Uint8Array) {
    out.push(Buffer.from(head(2, value.length)), Buffer.from(value));
  } else if (value instanceof Raw) out.push(value.bytes);
  else if (value instanceof Tag) {
    out.push(Buffer.from(head(6, value.tag)));
    encodeInto(value.value, out);
  } else if (Array.isArray(value)) {
    out.push(Buffer.from(head(4, value.length)));
    for (const v of value) encodeInto(v, out);
  } else if (value instanceof Map) {
    out.push(Buffer.from(head(5, value.size)));
    for (const [k, v] of value) {
      encodeInto(k, out);
      encodeInto(v, out);
    }
  } else throw new TypeError(`cannot encode ${value}`);
  return out;
};
const encode = (value) => Buffer.concat(encodeInto(value, []));

// --- reading items out of the real fixtures ----------------------------------------------

const readHead = (b, o) => {
  const ai = b[o] & 0x1f;
  if (ai < 24 || ai === 31) return { n: ai, p: o + 1 };
  const size = 1 << (ai - 24);
  let n = 0;
  for (let i = 0; i < size; i += 1) n = n * 256 + b[o + 1 + i];
  return { n, p: o + 1 + size };
};

// offset just past the CBOR item that starts at `o`
const itemEnd = (b, o) => {
  const major = b[o] >> 5;
  const indefinite = (b[o] & 0x1f) === 31;
  let { n, p } = readHead(b, o);
  if (major === 6) return itemEnd(b, p);
  if (major === 2 || major === 3) {
    if (!indefinite) return p + n;
  } else if (major !== 4 && major !== 5) return p;
  if (indefinite) {
    while (b[p] !== 0xff) p = itemEnd(b, p);
    return p + 1;
  }
  for (let i = 0; i < (major === 5 ? 2 * n : n); i += 1) p = itemEnd(b, p);
  return p;
};

// the items of the array that starts at `o`, as raw CBOR
const arrayItems = (b, o) => {
  const indefinite = (b[o] & 0x1f) === 31;
  let { n, p } = readHead(b, o);
  const out = [];
  while (indefinite ? b[p] !== 0xff : out.length < n) {
    const end = itemEnd(b, p);
    out.push(new Raw(b.subarray(p, end)));
    p = end;
  }
  return out;
};

const load = (file) =>
  Buffer.from(fs.readFileSync(path.join(FIXTURES, file), "utf8").trim(), "hex");

// a header with prev_hash null, as in the first block of a chain; Shelley to Conway
// header bodies all have it third
const firstBlockHeader = (header) => {
  const [body, signature] = arrayItems(header.bytes, 0);
  const fields = arrayItems(body.bytes, 0);
  fields[2] = null;
  return new Raw(encode([fields, signature]));
};

// a block with the header of a real block fixture (prev_hash set to null) and the
// transactions of real tx fixtures: auxiliary data under the indexes of the
// transactions that carry it, `invalid` as given
const assembleBlock = (blockFile, txFiles, invalid) => {
  const header = firstBlockHeader(arrayItems(load(blockFile), 0)[0]);
  const txs = txFiles.map((f) => arrayItems(load(f), 0));
  const auxiliaryData = new Map();
  txs.forEach((tx, i) => {
    const aux = tx[tx.length - 1];
    if (aux.bytes[0] !== 0xf6) auxiliaryData.set(i, aux);
  });
  return encode([header, txs.map((t) => t[0]), txs.map((t) => t[1]), auxiliaryData, invalid]);
};

// --- building blocks ---------------------------------------------------------------------

const fill = (byte, length) => Buffer.alloc(length, byte);
const ratio = (n, d) => new Tag(30, [n, d]);
const baseAddress = (byte) => Buffer.concat([Buffer.of(0x01), fill(byte, 56)]);
const rewardAccount = (byte) => Buffer.concat([Buffer.of(0xe1), fill(byte, 28)]);
const keyCredential = (byte) => [0, fill(byte, 28)];
const scriptCredential = (byte) => [1, fill(byte, 28)];
const anchor = (byte) => [`https://example.com/${byte.toString(16)}.jsonld`, fill(byte, 32)];

// script bytes are never evaluated here, they only need to differ per language
const plutusV1 = Buffer.from("4d01000033222220051200120011", "hex");
const plutusV2 = Buffer.from("4d01000033222220051200120022", "hex");
const plutusV3 = Buffer.from("4d01000033222220051200120033", "hex");

// one of each native script kind
const nativeScript = [
  1,
  [
    [0, fill(0x31, 28)],
    [
      2,
      [
        [0, fill(0x32, 28)],
        [4, 1000],
      ],
    ],
    [
      3,
      1,
      [
        [0, fill(0x33, 28)],
        [5, 99000000],
      ],
    ],
  ],
];

// metadata with the values that reach the output as they were decoded
const metadata = new Map([
  [674, new Map([["msg", ["synthetic fixture"]]])],
  [
    1,
    new Map([
      ["bytes", fill(0xbb, 4)],
      ["big", 18446744073709551615n],
      ["negative", -18446744073709551615n],
      ["list", [1, [2, new Map([[3, "x"]])]]],
    ]),
  ],
]);

const plutusData = new Tag(121, [42, fill(0xdd, 4)]);
// 23 encoded in two bytes: a valid but non-minimal datum
const nonMinimalInt = new Raw("1817");

const redeemers = [0, 1, 2, 3].map((tag) => [
  tag,
  0,
  tag === 1 ? nonMinimalInt : plutusData,
  [1000, 20000],
]);

// a transaction around the fields under test; its second output has an empty
// multiasset map, `outputs` come after it
const tx = (
  seed,
  fields,
  { outputs = [], witnesses = new Map([[0, [[fill(0x71, 32), fill(0x72, 64)]]]]), aux = null } = {}
) =>
  encode([
    new Map([
      [0, [[fill(seed, 32), 0]]],
      [1, [[baseAddress(0x20), 5000000], [baseAddress(0x21), [1500000, new Map()]], ...outputs]],
      [2, 200000],
      ...fields,
    ]),
    witnesses,
    true,
    aux,
  ]);

// protocol parameter values by key, for pre-Conway update proposals
// (Babbage dropped 12, 13 and 15)
const updateParams = (keys) =>
  new Map(
    [
      [0, 44],
      [1, 155381],
      [2, 90112],
      [3, 16384],
      [4, 1100],
      [5, 2000000],
      [6, 500000000],
      [7, 18],
      [8, 500],
      [9, ratio(3, 10)],
      [10, ratio(3, 1000)],
      [11, ratio(1, 5)],
      [12, ratio(1, 2)],
      [13, [1, fill(0x13, 32)]],
      [14, [7, 0]],
      [15, 1000000],
      [16, 340000000],
      [17, 4310],
      // a cost beyond 2^53 and a negative one
      [18, new Map([[0, [205665, 812, -1, 9007199254740993n]]])],
      // mainnet prices: 577/10000 per memory unit, 721/10000000 per step
      [19, [ratio(577, 10000), ratio(721, 10000000)]],
      [20, [14000000, 10000000000]],
      [21, [62000000, 40000000000]],
      [22, 5000],
      [23, 150],
      [24, 3],
    ].filter(([k]) => keys.includes(k))
  );

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// genesis key delegation, MIR certificates that move coin to the other pot, a script
// stake credential, and a pool with an IPv6-only relay and an IPv4 relay without a port
// (DNS name relays without one are on chain)
const preConwayCerts = [
  [5, fill(0x51, 28), fill(0x52, 28), fill(0x53, 32)],
  [6, [0, 1000000000]],
  [6, [1, 2000000000]],
  [0, scriptCredential(0x54)],
  [
    3,
    fill(0x55, 28),
    fill(0x56, 32),
    500000000,
    340000000,
    ratio(1, 100),
    rewardAccount(0x57),
    [fill(0x58, 28)],
    [
      [0, 3001, null, fill(0x59, 16)],
      [0, null, fill(0x5d, 4), null],
    ],
    null,
  ],
];

// outputs carrying reference scripts, as tag-24 wrapped [kind, script]
const scriptRefOutput = (kind, script) =>
  new Map([
    [0, baseAddress(0x24)],
    [1, 2000000],
    [3, new Tag(24, encode([kind, script]))],
  ]);

// a native script reference whose script [0, keyhash] has a two-byte array head, 9802
// instead of 82
const nonCanonicalNativeRef = new Map([
  [0, baseAddress(0x25)],
  [1, 2000000],
  [
    3,
    new Tag(
      24,
      encode([0, new Raw(Buffer.concat([Buffer.from("980200", "hex"), encode(fill(0x34, 28))]))])
    ),
  ],
]);

const scriptWitnesses = (scriptKey, script) =>
  new Map([
    [0, [[fill(0x71, 32), fill(0x72, 64)]]],
    [scriptKey, [script]],
    [4, [plutusData, nonMinimalInt]],
    [5, redeemers],
  ]);

// --- the fixtures ------------------------------------------------------------------------

const fixtures = {
  "alonzo-update-all-params": tx(0x01, [
    [3, 26000000],
    [6, [new Map([[fill(0x61, 28), updateParams(range(0, 24))]]), 280]],
  ]),
  "alonzo-certificates": tx(0x02, [[4, preConwayCerts]]),
  // an empty mint is valid before Conway
  "alonzo-scripts": tx(0x03, [[9, new Map()]], {
    witnesses: scriptWitnesses(3, plutusV1),
    aux: new Tag(
      259,
      new Map([
        [0, metadata],
        [1, [nativeScript]],
        [2, [plutusV1]],
      ])
    ),
  }),
  "alonzo-aux-allegra-scripts": tx(0x04, [], { aux: [metadata, [nativeScript]] }),

  "babbage-update-all-params": tx(0x11, [
    [3, 80000000],
    [6, [new Map([[fill(0x62, 28), updateParams([...range(0, 11), 14, ...range(16, 24)])]]), 400]],
  ]),
  "babbage-certificates": tx(0x12, [[4, preConwayCerts]]),
  "babbage-scripts": tx(0x13, [[9, new Map()]], {
    outputs: [scriptRefOutput(0, nativeScript), scriptRefOutput(1, plutusV1)],
    witnesses: scriptWitnesses(6, plutusV2),
    aux: new Tag(
      259,
      new Map([
        [0, metadata],
        [1, [nativeScript]],
        [2, [plutusV1]],
        [3, [plutusV2]],
      ])
    ),
  }),
  "babbage-aux-allegra-scripts": tx(0x14, [], { aux: [metadata, [nativeScript]] }),

  "conway-certificates-rare": tx(0x21, [
    [
      4,
      new Tag(258, [
        [10, keyCredential(0x41), fill(0x42, 28), [1, fill(0x43, 28)]],
        [13, scriptCredential(0x44), fill(0x45, 28), [2], 2000000],
        [15, keyCredential(0x46), null],
        [15, scriptCredential(0x47), anchor(0x48)],
        [
          3,
          fill(0x49, 28),
          fill(0x4a, 32),
          500000000,
          340000000,
          ratio(1, 100),
          rewardAccount(0x4b),
          new Tag(258, [fill(0x4c, 28)]),
          [[0, null, fill(0x4d, 4), null]],
          null,
        ],
      ]),
    ],
  ]),
  "conway-governance": tx(0x22, [
    [
      20,
      new Tag(258, [
        [
          100000000000,
          rewardAccount(0x51),
          [
            0,
            null,
            new Map([
              [5, 2000000],
              [16, 170000000],
            ]),
            null,
          ],
          anchor(0x52),
        ],
        [
          100000000000,
          rewardAccount(0x53),
          [2, new Map([[rewardAccount(0x54), 1000000]]), null],
          anchor(0x55),
        ],
      ]),
    ],
    [21, 1500000000000000],
    [22, 25000000],
  ]),
  "conway-scripts": tx(0x23, [], {
    outputs: [scriptRefOutput(1, plutusV1), nonCanonicalNativeRef],
    witnesses: scriptWitnesses(7, plutusV3),
    aux: new Tag(
      259,
      new Map([
        [0, metadata],
        [1, [nativeScript]],
        [2, [plutusV1]],
        [3, [plutusV2]],
        [4, [plutusV3]],
      ])
    ),
  }),
  "conway-aux-allegra-scripts": tx(0x24, [], { aux: [metadata, [nativeScript]] }),

  // an epoch boundary block: [header, slot leaders, extra]
  "byron-ebb": encode([
    [764824073, fill(0xeb, 32), fill(0xb0, 32), [150, [3239841]], [new Map()]],
    [fill(0x5a, 28), fill(0x5b, 28), fill(0x5c, 28)],
    [new Map()],
  ]),

  "alonzo-block-assembled": assembleBlock(
    "blocks/alonzo.hex",
    ["txs/alonzo-plutus-v1.hex", "txs/alonzo-network-id.hex", "txs/alonzo-mir.hex"],
    [0]
  ),
  "babbage-block-assembled": assembleBlock(
    "blocks/babbage.hex",
    [
      "txs/babbage-script-withdrawal.hex",
      "txs/babbage-aux-allegra-form.hex",
      "txs/babbage-output-datum-hash.hex",
    ],
    [0]
  ),
  "conway-block-assembled": assembleBlock(
    "blocks/conway.hex",
    [
      "txs/conway-plutus-withdrawal.hex",
      "txs/conway-plutus-v1-witness-datums.hex",
      "txs/conway-aux-allegra-form.hex",
      "txs/conway-drep-vote.hex",
    ],
    [1]
  ),
};

// --check: exit 1 if a fixture file differs from what this script builds
const check = process.argv.includes("--check");
const stale = [];
for (const [name, bytes] of Object.entries(fixtures)) {
  const file = path.join(DIR, `${name}.hex`);
  const content = `${bytes.toString("hex")}\n`;
  if (!check) fs.writeFileSync(file, content);
  else if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) stale.push(name);
}
if (stale.length) {
  console.error(
    `out of date, run node ${path.relative(process.cwd(), fileURLToPath(import.meta.url))}: ${stale.join(", ")}`
  );
  process.exit(1);
}
console.log(`${check ? "checked" : "wrote"} ${Object.keys(fixtures).length} fixtures`);
