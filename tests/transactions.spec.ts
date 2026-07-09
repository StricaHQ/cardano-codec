import { describe, it, expect } from "vitest";
import { txFixtures, parseTxFixture, inputKeys, tokenKeys } from "./helpers/fixtures";

type Output = {
  amount: string;
  tokens?: Array<unknown>;
  plutusDataHash?: string;
  plutusData?: string;
};

describe.each(txFixtures)("$era tx from $network ($name)", (fx) => {
  const tx = parseTxFixture(fx);
  const { expected } = fx;

  it("derives the transaction hash from the body bytes", () => {
    expect(tx.hash).toBe(expected.hash);
  });

  it("reads the fee", () => {
    expect(tx.fee).toBe(expected.fee);
  });

  it("reads every input", () => {
    expect(inputKeys(tx.inputs)).toEqual(expected.inputs);
  });

  it("reads outputs in on-chain order, with their lovelace values", () => {
    expect(tx.outputs.map((o: Output) => o.amount)).toEqual(expected.outputs.map((o) => o.amount));
  });

  it("reads the multiasset bundle on each output", () => {
    expect(tx.outputs.map((o: Output) => tokenKeys(o.tokens))).toEqual(
      expected.outputs.map((o) => o.tokens)
    );
  });

  it("reads the datum on each output", () => {
    // for an inline datum the parser hashes the datum itself; the chain reports
    // that same hash, so this checks the datum bytes were sliced out correctly
    expect(tx.outputs.map((o: Output) => o.plutusDataHash ?? null)).toEqual(
      expected.outputs.map((o) => o.plutusDataHash)
    );
    expect(tx.outputs.map((o: Output) => o.plutusData != null)).toEqual(
      expected.outputs.map((o) => o.hasInlineDatum)
    );
  });

  it("reads the mint field", () => {
    expect(tokenKeys(tx.mint)).toEqual(expected.mint);
  });

  it("reads withdrawals", () => {
    const amounts = (tx.withdrawals ?? []).map((w: { amount: string }) => w.amount).sort();
    expect(amounts).toEqual(expected.withdrawalAmounts);
  });

  it("reads the validity interval", () => {
    expect(tx.ttl ?? null).toBe(expected.ttl);
    expect(tx.validityIntervalStart ?? null).toBe(expected.validityIntervalStart);
  });

  it("reads certificates, reference inputs and collateral", () => {
    expect(tx.certificates ?? []).toHaveLength(expected.certificateCount);
    expect(tx.referenceInputs ?? []).toHaveLength(expected.referenceInputCount);
    expect(tx.collaterals ?? []).toHaveLength(expected.collateralCount);
    expect(tx.collateralOutput?.amount ?? null).toBe(expected.collateralOutputAmount);
  });

  it("reads governance votes and proposals", () => {
    const votes = (tx.votingProcedures ?? []).reduce(
      (n: number, vp: { votes: Array<unknown> }) => n + vp.votes.length,
      0
    );
    expect(votes).toBe(expected.voteCount);
    expect(tx.proposalProcedures ?? []).toHaveLength(expected.proposalCount);
  });

  if (fx.expected.hasMetadata) {
    it("commits to the auxiliary data it carries", () => {
      expect(tx.auxiliaryDataHash).toMatch(/^[0-9a-f]{64}$/);
    });
  }
});
