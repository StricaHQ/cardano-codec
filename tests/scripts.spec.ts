import { describe, it, expect } from "vitest";
import { txFixtures, parseTxFixture, parseTxWitnessFixture } from "./helpers/fixtures";

type ScriptRef = { type: string; hash: string; script: unknown };

const withRefScripts = txFixtures.filter((fx) => fx.expected.outputs.some((o) => o.scriptRef));

describe.each(withRefScripts)("reference scripts: $name ($era, $network)", (fx) => {
  const tx = parseTxFixture(fx);

  it("reads the script type and reproduces the hash the chain reports", () => {
    const actual = tx.outputs.map((o: { scriptRef?: ScriptRef }) =>
      o.scriptRef ? { type: o.scriptRef.type, hash: o.scriptRef.hash } : null
    );
    expect(actual).toEqual(fx.expected.outputs.map((o) => o.scriptRef));
  });
});

describe("reference scripts cover every script type", () => {
  it("exercises native, plutus v2 and plutus v3 reference scripts", () => {
    const types = new Set(
      withRefScripts.flatMap((fx) =>
        fx.expected.outputs.filter((o) => o.scriptRef).map((o) => o.scriptRef!.type)
      )
    );
    expect(types).toEqual(new Set(["NATIVE_SCRIPT", "PLUTUS_V2", "PLUTUS_V3"]));
  });
});

describe("native script structure", () => {
  it("parses a native reference script into its nested form", () => {
    const fx = txFixtures.find((f) => f.name === "conway-refscript-native")!;
    const tx = parseTxFixture(fx);
    const ref: ScriptRef = tx.outputs.find((o: { scriptRef?: ScriptRef }) => o.scriptRef).scriptRef;

    expect(ref.type).toBe("NATIVE_SCRIPT");
    expect(ref.script).toEqual({
      all: [{ pubKeyHash: "31c2e33d938a83aa457bc30f65f395e29695d4eb658d884ecb6d6b25" }],
    });
  });

  it("parses a timelock script out of a witness set and keys it by script hash", () => {
    const fx = txFixtures.find((f) => f.name === "mary-mint-native-script")!;
    const tx = parseTxFixture(fx);
    const witnesses = parseTxWitnessFixture(fx);

    // the minting policy id is the hash of the native script that authorises it
    const policyId = "00000002df633853f6a47465c9496721d2d5b1291b8398016c0e87ae";
    expect(tx.mint).toEqual([
      { policyId, assetName: "6e7574636f696e", amount: "1" },
    ]);

    expect(Object.keys(witnesses.nativeScripts)).toEqual([policyId]);
    expect(witnesses.nativeScripts[policyId]).toEqual({
      all: [
        { invalidAfter: 24285375 },
        { pubKeyHash: "e97316c52c85eab276fd40feacf78bc5eff74e225e744567140070c3" },
      ],
    });
  });
});
