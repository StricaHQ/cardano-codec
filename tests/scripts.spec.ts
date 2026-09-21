import { describe, it, expect } from "vitest";
import { CborNode, CborTag, EncodedCbor, encode } from "@stricahq/cbors";
import { babbage, conway } from "../src/index";
import { ScriptType } from "../src/types/conwayTypes";
import { decodeCbor, fromHex, txBody } from "./helpers/build";
import {
  deepFixtures,
  loadCbor,
  txFixtures,
  parseBlockFixture,
  parseTxFixture,
  parseTxWitnessFixture,
} from "./helpers/fixtures";

type ScriptRef = { type: number; hash: string; script: unknown };

const withRefScripts = txFixtures.filter((fx) => fx.expected.outputs.some((o) => o.scriptRef));

// Conway may wrap a list in tag 258
const listItems = (n: CborNode) => (n.kind === "tag" ? n.child! : n).items!;

// The largest native script in a block's witness sets, as written, with the hash the witness
// parser keys it by. In a block that nests past the recursion limit, that is the nested one.
const largestNativeScript = (fx: { file: string; parser: string }) => {
  const block = parseBlockFixture(fx);
  const witnessSets = decodeCbor(loadCbor(fx.file)).items![2].items!;
  const scripts = witnessSets.flatMap((witnessSet, tx) => {
    const written = witnessSet.at(1);
    if (!written) return [];
    const hashes = Object.keys(block.witnesses[tx].nativeScripts);
    return listItems(written).map((script, i) => ({ script: script.bytes, hash: hashes[i] }));
  });
  return scripts.reduce((a, b) => (b.script.length > a.script.length ? b : a));
};

// a body whose one output carries script_ref = #6.24(bytes .cbor [0, script])
const bodyWithNativeScriptRef = (script: Uint8Array) =>
  txBody([
    [
      1,
      [
        new Map<number, unknown>([
          [0, fromHex(`61${"ab".repeat(28)}`)],
          [1, 2000000],
          [3, new CborTag(encode([0, new EncodedCbor(script)]), 24)],
        ]),
      ],
    ],
  ]);

describe.each(withRefScripts)("reference scripts: $name ($era)", (fx) => {
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
    expect(types).toEqual(
      new Set([ScriptType.NATIVE_SCRIPT, ScriptType.PLUTUS_V2, ScriptType.PLUTUS_V3])
    );
  });
});

describe("native script structure", () => {
  it("parses a native reference script into its nested form", () => {
    const fx = txFixtures.find((f) => f.name === "conway-refscript-native")!;
    const tx = parseTxFixture(fx);
    const ref: ScriptRef = tx.outputs.find((o: { scriptRef?: ScriptRef }) => o.scriptRef).scriptRef;

    expect(ref.type).toBe(ScriptType.NATIVE_SCRIPT);
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

describe("a native reference script", () => {
  it.each([
    ["babbage", babbage],
    ["conway", conway],
  ])("is hashed as written, at any depth, by %s", (_, era) => {
    const hashOf = (script: Uint8Array) =>
      era.parseTransaction(bodyWithNativeScriptRef(script)).outputs[0].scriptRef?.hash;

    // a native script with its array head written in two bytes (9802 for 82): valid CBOR,
    // and a hash of its own
    const longHead =
      "9802018282051a017290bf8200581ce97316c52c85eab276fd40feacf78bc5eff74e225e744567140070c3";
    expect(hashOf(fromHex(longHead))).toBe(
      "329d116525b274a598e7afad7cc1526507fcdea6417d16276ab2147a"
    );

    // a script nested deeper than cbors decodes by default: read as a reference script it must
    // hash to what the witness set it comes from is keyed by
    const nested = largestNativeScript(deepFixtures[0]);
    expect(hashOf(nested.script)).toBe(nested.hash);
  });
});

describe("witness scripts", () => {
  it("keeps the V2 and V3 scripts of one witness set", () => {
    const refScriptTx = txFixtures.find((f) => f.name === "conway-refscript-plutus-v2")!;
    const refScript = decodeCbor(loadCbor(refScriptTx.file)).at(0)!.at(1)!.items![0];
    const v2Script = decodeCbor(refScript.at(3)!.child!.toJS()).at(1)!.bytes;
    const proposalTx = txFixtures.find((f) => f.name === "conway-treasury-proposal")!;
    const [v3Script] = listItems(decodeCbor(loadCbor(proposalTx.file)).at(1)!.at(7)!);
    const witnesses = conway.parseWitnessMap(
      decodeCbor(
        encode(
          new Map([
            [6, [new EncodedCbor(v2Script)]],
            [7, [new EncodedCbor(v3Script.bytes)]],
          ])
        )
      )
    );
    expect(Object.keys(witnesses.plutusScriptsV2 ?? {})).toEqual([
      refScriptTx.expected.outputs[0].scriptRef!.hash,
    ]);
    expect(Object.keys(witnesses.plutusScriptsV3 ?? {})).toEqual([
      "fa24fb305126805cf2164c161d852a0e7330cf988f1fe558cf7d4a64",
    ]);
  });
});
