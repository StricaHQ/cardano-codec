import { describe, it, expect } from "vitest";
import { EncodedCbor, encode } from "@stricahq/cbors";
import { decodeCbor } from "./helpers/build";
import {
  blockFixtures,
  deepFixtures,
  headerOf,
  loadCbor,
  parseBlockFixture,
  parseBlockNode,
} from "./helpers/fixtures";

describe.each(blockFixtures)("$era block ($name)", (fx) => {
  const block = parseBlockFixture(fx);
  const header = headerOf(block);
  const { expected } = fx;

  it("computes the header hash the chain identifies this block by", () => {
    expect(header.hash).toBe(expected.hash);
  });

  it("reads the block height and slot", () => {
    expect(header.blockHeight).toBe(expected.blockHeight);
    expect(header.slot).toBe(expected.slot);
  });

  it("parses every transaction, preserving on-chain order", () => {
    expect(block.transactions).toHaveLength(expected.txCount);
    expect(block.transactions.map((tx: { hash: string }) => tx.hash)).toEqual(expected.txHashes);
  });

  if (fx.era === "Byron") {
    // the byron header carries an epoch and a slot relative to it, not an absolute slot
    it("reads the epoch", () => {
      expect(header.epoch).toBe(expected.epoch);
    });
    return;
  }

  it("reads the operational certificate", () => {
    expect(header.operationalCert.hotVKey).toBe(expected.operationalCert!.hotVKey);
    expect(header.operationalCert.sequenceNumber).toBe(expected.operationalCert!.sequenceNumber);
  });

  it("reads the protocol version", () => {
    expect(header.protocolVersion).toEqual(expected.protocolVersion);
  });

  it("carries one witness set per transaction", () => {
    expect(block.witnesses).toHaveLength(expected.txCount);
  });

  it("indexes auxiliary data by transaction index", () => {
    const indexes = [...block.auxiliaryDataMap.keys()].sort((a: number, b: number) => a - b);
    expect(indexes).toEqual(expected.metadataTxIndexes);
  });
});

// Over node-to-node a block comes as [era, block], with eras numbered in this order, and the
// inner node goes straight to the parser.
const ERAS = ["Byron EBB", "Byron", "Shelley", "Allegra", "Mary", "Alonzo", "Babbage", "Conway"];

describe("a block inside [era, block]", () => {
  it("parses the same as on its own", () => {
    for (const fx of blockFixtures) {
      const block = new EncodedCbor(loadCbor(fx.file));
      const message = decodeCbor(encode([ERAS.indexOf(fx.era), block]));
      expect(parseBlockNode(fx, message.at(1)!), fx.name).toEqual(parseBlockFixture(fx));
    }
  });
});

// Blocks that nest deeper than recursion reaches, so their items are walked with a loop. Their
// parsed output is too deep to compare whole, so they are checked here instead of by a golden.
describe.each(deepFixtures)("$era block ($name)", (fx) => {
  const { expected } = fx;

  it("parses the header and every transaction", () => {
    const block = parseBlockFixture(fx);
    const header = headerOf(block);
    expect(header.hash).toBe(expected.hash);
    expect(header.blockHeight).toBe(expected.blockHeight);
    expect(header.slot).toBe(expected.slot);
    expect(block.transactions.map((tx: { hash: string }) => tx.hash)).toEqual(expected.txHashes);
  });
});
