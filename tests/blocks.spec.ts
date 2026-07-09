import { describe, it, expect } from "vitest";
import { blockFixtures, headerOf, parseBlockFixture } from "./helpers/fixtures";

describe.each(blockFixtures)("$era block from $network ($name)", (fx) => {
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
