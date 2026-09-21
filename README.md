<p align="center">
  <a href="https://strica.io/" target="_blank">
    <img src="https://docs.strica.io/images/logo.png" width="200">
  </a>
</p>

# @stricahq/cardano-codec

[![npm](https://img.shields.io/npm/v/@stricahq/cardano-codec.svg)](https://www.npmjs.com/package/@stricahq/cardano-codec)
[![downloads](https://img.shields.io/npm/dm/@stricahq/cardano-codec.svg)](https://www.npmjs.com/package/@stricahq/cardano-codec)
[![node](https://img.shields.io/node/v/@stricahq/cardano-codec.svg)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-2-brightgreen.svg)](https://github.com/StricaHQ/cardano-codec/blob/master/package.json)
[![license](https://img.shields.io/npm/l/@stricahq/cardano-codec.svg)](./LICENSE)

Cardano block and transaction parser for JavaScript. It turns the CBOR of blocks, transactions, witness sets and metadata into plain JavaScript data, with parsers for every era from Byron to Conway.

Every hash it computes, from block hashes and transaction ids to script and datum hashes, covers the item's bytes as they were written on chain, never a re-encoding, so it matches the ledger's even for an item encoded in a non-canonical way. The bytes come from the annotation tree of [@stricahq/cbors](https://github.com/StricaHQ/cbors): you decode with cbors, and the parsers read its tree.

- Blocks and transactions of Byron, Shelley, Allegra, Mary, Alonzo, Babbage and Conway, Conway governance included
- Amounts as decimal strings and integers beyond 2^53 as `bigint`, so neither loses precision
- Native scripts and metadata of any depth, parsed without recursion
- TypeScript types for every result
- No Node.js builtins: runs in Node.js and in browsers, without polyfills

## v3 is a breaking change

v3 is not a drop-in upgrade. It is ESM-only and needs Node >= 22.12, the parsers take a node from cbors v2's `decodeAnnotated()` instead of a decoded value and the block bytes, and results hold `bigint` and `Uint8Array` where 2.x had `BigNumber` and `Buffer`. [Migrating from 2.x](#migrating-from-2x) lists every change and its replacement.

Moving to v3 is the recommended path: it parses real blocks about 1.5x faster than v2.x, computes every hash over the bytes as written, and its browser bundle is a fifth of the size.

### Staying on 2.x

2.x remains on npm and keeps working. Pin the major version to stay there:

```sh
yarn add @stricahq/cardano-codec@2
```

```html
<script src="https://cdn.jsdelivr.net/npm/@stricahq/cardano-codec@2/dist/index.min.js"></script>
```

2.x is a CJS + ESM dual package, runs on Node >= 18, and uses `Buffer` and `BigNumber`. Everything below documents v3.

## Installation

### yarn/npm

```sh
yarn add @stricahq/cardano-codec @stricahq/cbors
```

The parsers take nodes from cbors' `decodeAnnotated()`, so cbors goes into your own dependencies, next to the codec.

The package is ESM-only. CommonJS code can `require()` it on Node >= 22.12:

```js
const { conway } = require("@stricahq/cardano-codec");
```

A TypeScript project that compiles to CommonJS needs TypeScript >= 5.8 with `module: nodenext` for that.

The only dependencies are `@stricahq/cbors` and `blakejs`. Neither uses Node.js builtins, so bundlers need no polyfills or aliases.

### Browser

```html
<script src="https://cdn.jsdelivr.net/npm/@stricahq/cardano-codec/dist/index.min.js"></script>

<script>
  // the cardanoCodec global carries a copy of cbors to decode with
  const { cbors, conway } = cardanoCodec;
  const toBytes = (hex) => Uint8Array.from(hex.match(/../g), (b) => parseInt(b, 16));

  const block = conway.parseBlock(cbors.decodeAnnotated(toBytes(blockHex), { maxDepth: Infinity }));
  block.header.body.hash;
</script>
```

## Quick start

```js
import { decodeAnnotated } from "@stricahq/cbors";
import { conway } from "@stricahq/cardano-codec";

const block = conway.parseBlock(decodeAnnotated(blockBytes, { maxDepth: Infinity }));

block.header.body.hash;        // block hash
block.header.body.slot;        // slot
block.transactions[0].hash;    // id of the first transaction
block.witnesses[0];            // its witness set
block.auxiliaryDataMap.get(0); // its auxiliary data (metadata and scripts), if it has any
```

`blockBytes` is the block's CBOR, as a `Uint8Array` or a Node.js `Buffer`.

Decode chain data with `{ maxDepth: Infinity }`. cbors rejects items nested deeper than 1024 levels by default, and a valid transaction can nest deeper than that. cbors decodes any depth without recursion, and so do the parsers.

## Parsing

A parser takes the `CborNode` of the item it parses. That can be the root of a tree or any node inside one, so a message decoded once is parsed piece by piece.

### Transactions

A standalone transaction is `[body, witnessSet, isValid, auxiliaryData]`:

```js
const tx = decodeAnnotated(txBytes, { maxDepth: Infinity });

const transaction = conway.parseTransaction(tx.at(0)); // body, with the transaction id as `hash`
const witnesses = conway.parseWitnessMap(tx.at(1));    // witness set

const auxNode = tx.at(3); // CBOR null when the transaction has none
const auxiliaryData = auxNode.kind === "null" ? null : conway.parseAuxiliaryData(auxNode);
```

Shelley to Mary transactions have no `isValid` flag, so their auxiliary data is `tx.at(2)`.

APIs and wallets usually hand transactions out as hex. cbors ships no hex helper: `Buffer.from(hex, "hex")` converts it on Node.js, and `Uint8Array.fromHex(hex)` on runtimes that have it.

### Blocks from a node

In block-fetch, and in node-to-client chain-sync, a node sends each block as `[era, block]`. The inner node goes straight to a parser, and the era number says which one:

```js
import { byron, alonzo, babbage, conway } from "@stricahq/cardano-codec";

const parsers = [
  byron.parseEbBlock, // 0: Byron epoch boundary block
  byron.parseBlock,   // 1: Byron
  alonzo.parseBlock,  // 2: Shelley
  alonzo.parseBlock,  // 3: Allegra
  alonzo.parseBlock,  // 4: Mary
  alonzo.parseBlock,  // 5: Alonzo
  babbage.parseBlock, // 6: Babbage
  conway.parseBlock,  // 7: Conway
];

const message = decodeAnnotated(payload, { maxDepth: Infinity }); // [era, block]
const block = parsers[message.at(0).value](message.at(1));
```

### Which parser for which era

| Era | Block | Transaction |
|---|---|---|
| Byron epoch boundary | `byron.parseEbBlock` | — |
| Byron | `byron.parseBlock` | `byron.parseTransaction`, on the transaction payload of the block body |
| Shelley, Allegra, Mary, Alonzo | `alonzo.parseBlock` | `alonzo.parseTransaction` |
| Babbage | `babbage.parseBlock` | `babbage.parseTransaction` |
| Conway | `conway.parseBlock` | `conway.parseTransaction` |

Each era also exports `parseHeader`, and Shelley onwards `parseWitnessMap` and `parseAuxiliaryData`, for parsing those items on their own. `common` has the metadata and native script parsers the Shelley-based eras share: `parseMetadata`, `parseNativeScript` and `parseNativeScripts`.

Block parsers are not interchangeable: `babbage.parseBlock` and `conway.parseBlock` read the Babbage header format, and throw on a Shelley to Alonzo block.

Transaction parsers read the transactions of earlier eras too, except for what a later era removed. The babbage parser throws on an update proposal that sets a parameter Babbage dropped (`d`, `entropy`, `minUTxOValue`). The conway parser throws on any update proposal, and on genesis delegation and MIR certificates, all of which Conway removed. The parser of a transaction's own era always reads it.

## What you get back

- Hashes, keys, signatures, asset names, scripts and Plutus data: lowercase hex strings.
- Addresses and reward accounts: the address bytes in hex, not bech32 or base58.
- Lovelace and token amounts: decimal strings. That covers `fee`, output, token and MIR `amount`s, withdrawals, certificate and governance proposal `deposit`s, a pool's `pledge` and `cost`, `totalCollateral`, `treasuryAmount`, `donation`, and the lovelace-valued protocol parameters (`minFeeA`, `minFeeB`, `stakeKeyDeposit`, `poolDeposit`, `minPoolCost`, `adaPerUtxoByte`, `govActionDeposit`, `dRepDeposit`).
- Every other integer, such as slots, `ttl`, epochs, execution units and the remaining protocol parameters: a `number`, or a `bigint` beyond ±2^53.
- Rationals: a `number` for protocol parameters and voting thresholds, a `[numerator, denominator]` pair for a pool's `margin` and for `exUnitPrices`.
- Metadata values: `Map`, `Array`, `number`, `bigint`, `Uint8Array` or `string` (`types.*.MetaDatum`). Byte strings are copies, so a result never pins or aliases the buffer you decoded.
- Native scripts and metadata: nested as deep as they were written, which can be thousands of levels.

A Conway stake registration and delegation, as `conway.parseTransaction()` returns it:

```js
{
  hash: "ac67ea37e6ad9fbadfe9210d49f8b778d35426227dada6dbc1a453e2dee40d0d",
  inputs: [{ txId: "c6270586133ca06ceacacb66de8bd21afa934ca6e51700a20f15c069e5d57a9f", index: 0 }],
  outputs: [
    {
      address: "010a05f7cc825c9a0c036db891b4597b7adcf0c454caf1f207ca7a00419ef5a37441acfbe92fffbafab7c6b30ef56abd24f450296d7b4aeb8c",
      amount: "452825303",
      // tokens, plutusDataHash, plutusData and scriptRef: undefined unless the output has them
    },
  ],
  fee: "174697",
  ttl: 192034209,
  certificates: [
    {
      type: 7, // CertificateType.STAKE_REG, a registration with a deposit
      cert: {
        stakeCredential: { key: "9ef5a37441acfbe92fffbafab7c6b30ef56abd24f450296d7b4aeb8c", type: 0 },
        deposit: "2000000",
      },
    },
    {
      type: 2, // CertificateType.STAKE_DELEGATION
      cert: {
        stakeCredential: { key: "9ef5a37441acfbe92fffbafab7c6b30ef56abd24f450296d7b4aeb8c", type: 0 },
        poolKeyHash: "153806dbcd134ddee69a8c5204e38ac80448f62342f8c23cfe4b7edf",
      },
    },
  ],
}
```

Every field that says what kind of thing something is comes back as the number the ledger's CDDL gives it, never a name: a certificate's `type` (`7` and `2` above), a credential's `type` (`0` a key hash, `1` a script), a script's `type` (`0` native, `1` to `3` Plutus V1 to V3), a redeemer's `tag`, and Conway's governance actions, voters, votes and DRep delegations. The matching `types.*` enum turns one back into a name to print: `types.ConwayTypes.HashType[0]` is `"ADDRESS"`.

### Hashes

The parsers compute these hashes, over the bytes as written:

- the block hash: `header.body.hash`, or `header.hash` for Byron
- the transaction id: a transaction's `hash`
- the keys of a witness set's records: `vKeyWitnesses` and `bootstrapWitness` are keyed by the hash of the public key, `nativeScripts`, `plutusScripts`, `plutusScriptsV2` and `plutusScriptsV3` by script hash, and `plutusData` by datum hash
- an output's `scriptRef.hash`, and the `plutusDataHash` of an output with an inline datum

The transaction above is signed with the payment and the stake key of its output's address, so its vkey witnesses are keyed by the two key hashes in that address:

```js
conway.parseWitnessMap(tx.at(1)).vKeyWitnesses;
// {
//   "0a05f7cc825c9a0c036db891b4597b7adcf0c454caf1f207ca7a0041": { vKey: "08e9c80e…", signature: "3cb2fa51…" },
//   "9ef5a37441acfbe92fffbafab7c6b30ef56abd24f450296d7b4aeb8c": { vKey: "e401ab0c…", signature: "4194bdbd…" },
// }
```

Every other hash, such as `auxiliaryDataHash`, `scriptDataHash` or a datum hash an output carries, is read from the transaction.

### Serializing results

`JSON.stringify` throws on a `bigint`, and writes a `Map` (`auxiliaryDataMap`, metadata maps) as `{}` and a `Uint8Array` as an object of indexes. Give it a replacer:

```js
const replacer = (_key, value) => {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Map) return [...value]; // [key, value] pairs: metadata keys need not be strings
  if (value instanceof Uint8Array) {
    return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return value;
};

JSON.stringify(block, replacer);
```

`JSON.stringify` recurses, so a native script or metadata nested thousands of levels deep makes it throw a `RangeError`.

### Types

Types for every parser result ship with the package:

```ts
import type { CborNode } from "@stricahq/cbors";
import { conway, types } from "@stricahq/cardano-codec";

// types.ByronTypes, types.AlonzoTypes, types.BabbageTypes, types.ConwayTypes, types.OuroborosTypes
const parse = (block: CborNode): types.ConwayTypes.ConwayBlock => conway.parseBlock(block);
```

Enums such as `types.ConwayTypes.CertificateType`, `GovActionType` and `ScriptType` are runtime values too, to compare results against and, indexed by number, to name them. `CertificateType` is shared: `types.AlonzoTypes.CertificateType` is the same enum.

## Errors

A parser throws when the CBOR does not have the shape its era gives the item, rather than guess. An item of the wrong kind is named by its byte range in the buffer you decoded:

```
Error: Expected array at bytes [416, 450), got bytes
```

A missing item throws `Expected …, got nothing`. Anything else the parser does not know, such as a transaction field or certificate type from a later era, throws as well, and so does metadata holding anything but maps, arrays, integers, and byte or text strings.

## Migrating from 2.x

| 2.x | 3.x |
|---|---|
| `cbors.Decoder.decode(bytes).value` before a parser | `decodeAnnotated(bytes, { maxDepth: Infinity })`, from your own `@stricahq/cbors` dependency |
| `parseBlock(decoded, blockCbor)` | `parseBlock(block)`, the node |
| `parseTransaction(decoded[0], blockCbor)` | `parseTransaction(tx.at(0))` |
| `common.parsePlutusData(datum, blockCbor)` | gone: `datumNode.bytes` is the datum as written |
| `common.parseMetadata` / `parseNativeScript(s)` on decoded values | the same, on a `CborNode` |
| `import codec from "@stricahq/cardano-codec"` | `import * as codec from "@stricahq/cardano-codec"`, or named imports |
| CJS + ESM dual package, Node >= 18 | ESM only, Node >= 22.12 (`require(esm)`) |
| `Buffer`: metadata byte strings, `RollForward.block`, `LocalTxMonitorResponse.nextTx` | `Uint8Array` |
| `BigNumber` for integers beyond ±2^53 | `bigint` |
| `cardanoCodec.Buffer` in the browser bundle | gone; `cardanoCodec.cbors` stays |
| PlutusV3 witness scripts in `witnesses.plutusScriptsV2` | `witnesses.plutusScriptsV3` |
| protocol parameter 33 (`minFeeRefScriptCostPerByte`) in `govActionValidity` | `refScriptCostByte` |
| Credential `type`, script `type` and redeemer `tag` as names, such as `"ADDRESS"`, `"PLUTUS_V2"` and `"SPEND"` | their CDDL numbers, the way certificate `type` and the conway parser's enums already read |
| `LocalTransactionSubmissionResponse.rejectionMessage: any` | `unknown`: narrow it before reading from it |

Also check:

- **`JSON.stringify` throws on a `bigint`.** A value 2.x returned as a `BigNumber`, which serialized as a string, is a `bigint` now. [Serializing results](#serializing-results) has a replacer.
- **No `Buffer`.** The codec no longer installs the `buffer` package. An app that imports `buffer` without depending on it has to add it.
- **Malformed CBOR throws.** A field of the wrong kind throws where 2.x returned `undefined` or a wrong value; see [Errors](#errors).
- **Lovelace-valued protocol parameters and `ProposalProcedure.deposit` are strings now.** 2.x declared them `string` but returned a `number`; they are decimal strings, like every other amount. `ProtocolParamUpdate.govActionDeposit` and `dRepDeposit`, declared `number` in 2.x, are strings as well.
- **Some fields are typed `number` now.** Fields declared `string` that hold a count or a size, such as `maxValueSize` and `NativeScript.n`, `invalidBefore` and `invalidAfter`, are declared `number`. Their values did not change.

## Tests

```sh
yarn test
```

The specs parse real blocks and transactions of every era and check them against the values the ledger records for them and against snapshots of the full output. Synthetic CBOR covers the shapes no real fixture has.

## API Doc

Find the API documentation [here](https://docs.strica.io/lib/cardano-codec).

# License
Copyright 2023 Strica

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
