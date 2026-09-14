import { describe, it, expect } from "vitest";
import { txFixtures, parseTxFixture } from "./helpers/fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Parsed = any;

const ratio = ([numerator, denominator]: [number, number]) => numerator / denominator;

/** Each field of a parsed update, under the name the ledger's JSON gives it. */
const LEDGER_FIELDS: Record<string, [string, (value: Parsed) => unknown]> = {
  minFeeA: ["txFeePerByte", (v) => v],
  minFeeB: ["txFeeFixed", (v) => v],
  maxBlockBodySize: ["maxBlockBodySize", (v) => v],
  maxTransactionSize: ["maxTxSize", (v) => v],
  maxBlockHeaderSize: ["maxBlockHeaderSize", (v) => v],
  stakeKeyDeposit: ["stakeAddressDeposit", (v) => v],
  poolDeposit: ["stakePoolDeposit", (v) => v],
  poolRetireMaxEpoch: ["poolRetireMaxEpoch", (v) => v],
  n: ["stakePoolTargetNum", (v) => v],
  pledgeInfluence: ["poolPledgeInfluence", (v) => v],
  expansionRate: ["monetaryExpansion", (v) => v],
  treasuryGrowthRate: ["treasuryCut", (v) => v],
  minPoolCost: ["minPoolCost", (v) => v],
  adaPerUtxoByte: ["utxoCostPerByte", (v) => v],
  exUnitPrices: [
    "executionUnitPrices",
    (v) => ({ priceMemory: ratio(v.mem), priceSteps: ratio(v.steps) }),
  ],
  maxTxExUnits: ["maxTxExecutionUnits", (v) => ({ memory: v.mem, steps: v.steps })],
  maxBlockExUnits: ["maxBlockExecutionUnits", (v) => ({ memory: v.mem, steps: v.steps })],
  maxValueSize: ["maxValueSize", (v) => v],
  collateralPercent: ["collateralPercentage", (v) => v],
  maxCollateralInputs: ["maxCollateralInputs", (v) => v],
  minCommitteeSize: ["committeeMinSize", (v) => v],
  committeeTermLimit: ["committeeMaxTermLength", (v) => v],
  govActionValidity: ["govActionLifetime", (v) => v],
  govActionDeposit: ["govActionDeposit", (v) => v],
  dRepDeposit: ["dRepDeposit", (v) => v],
  dRepInactivity: ["dRepActivity", (v) => v],
  refScriptCostByte: ["minFeeRefScriptCostPerByte", (v) => v],
};

const withParamChanges = txFixtures.filter((fx) => fx.expected.protocolParamUpdate);

describe.each(withParamChanges)("parameter change proposal: $name ($era, $network)", (fx) => {
  const tx = parseTxFixture(fx);
  const update = tx.proposalProcedures[0].govAction.action.protocolParamUpdate;

  it("reads every updated parameter into its own field", () => {
    expect(Object.keys(update).filter((field) => !LEDGER_FIELDS[field])).toEqual([]);
  });

  it("reads each parameter's value as the ledger records it", () => {
    const asLedgerJson = Object.fromEntries(
      Object.entries(update).map(([field, value]) => {
        const [ledgerName, convert] = LEDGER_FIELDS[field];
        return [ledgerName, convert(value)];
      })
    );
    expect(asLedgerJson).toEqual(fx.expected.protocolParamUpdate);
  });
});
