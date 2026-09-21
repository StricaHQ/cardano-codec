import { describe, it, expect } from "vitest";
import { CborTag } from "@stricahq/cbors";
import { common, conway } from "../src/index";
import { decodeCbor, fromHex, txBody } from "./helpers/build";
import { txFixtures, parseTxFixture, inputKeys, tokenKeys } from "./helpers/fixtures";

type Output = {
  amount: string;
  tokens?: Array<unknown>;
  plutusDataHash?: string;
  plutusData?: string;
};

describe.each(txFixtures)("$era tx ($name)", (fx) => {
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
    // an inline datum is hashed here and by the chain, so the hashes agree only if
    // the datum bytes were sliced out correctly
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

describe("metadata", () => {
  it("copies byte strings out of the input", () => {
    // {1: h'bbbbbbbb'}
    const [{ data }] = common.parseMetadata(decodeCbor(fromHex("a10144bbbbbbbb")));
    expect(data).toStrictEqual(fromHex("bbbbbbbb"));
    // four bytes of memory of its own: a result neither pins nor aliases the caller's buffer
    expect((data as Uint8Array).buffer.byteLength).toBe(4);
  });

  it("reads strings written in chunks as one string", () => {
    // the ledger accepts indefinite-length text and byte strings in metadata:
    // {1: [(_ "ab", "c"), (_ h'01', h'0203')]}
    const [{ data }] = common.parseMetadata(
      decodeCbor(fromHex("a101827f6261626163ff5f4101420203ff"))
    );
    expect(data).toStrictEqual(["abc", fromHex("010203")]);
  });
});

describe("malformed CBOR", () => {
  it("throws naming what the parser found and where", () => {
    // the inputs as a byte string: {0: h'0000', 1: [], 2: 200000}
    expect(() => conway.parseTransaction(txBody([[0, new Uint8Array(2)]]))).toThrow(
      "Expected array at bytes [2, 5), got bytes"
    );
    // the inputs in tag 259: only the set tag 258 is looked through
    const input = [new Uint8Array(32), 0];
    expect(() => conway.parseTransaction(txBody([[0, new CborTag([input], 259)]]))).toThrow(
      "Expected array at bytes [2, 42), got tag 259"
    );
    // an input without its index
    expect(() => conway.parseTransaction(txBody([[0, [[new Uint8Array(32)]]]]))).toThrow(
      "Expected integer, got nothing"
    );
    // auxiliary data in tag 258 rather than 259
    expect(() => conway.parseAuxiliaryData(decodeCbor(fromHex("d90102a0")))).toThrow(
      "Expected tag 259 at bytes [0, 4), got tag 258"
    );
  });
});
