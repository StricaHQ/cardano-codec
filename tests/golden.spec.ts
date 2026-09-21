import { execFileSync } from "child_process";
import path from "path";
import { describe, it, expect } from "vitest";
import {
  blockFixtures,
  txFixtures,
  syntheticFixtures,
  parseBlockFixture,
  parseEbBlockFixture,
  parseTxFixture,
  parseTxWitnessFixture,
  parseTxAuxiliaryDataFixture,
} from "./helpers/fixtures";
import { normalize } from "./helpers/normalize";

// The complete parser output for every fixture, mirroring the fixture layout:
// blocks/x.hex → fixtures/golden/blocks/x.json. `yarn test -u` accepts a change.
const goldenFile = (fixtureFile: string) =>
  `fixtures/golden/${fixtureFile.replace(/\.hex$/, ".json")}`;

const toJson = (output: unknown) => `${JSON.stringify(normalize(output), null, 2)}\n`;

const parseTx = (fx: { file: string; parser: string }) => ({
  body: parseTxFixture(fx),
  witnesses: parseTxWitnessFixture(fx),
  auxiliaryData: parseTxAuxiliaryDataFixture(fx),
});

describe("golden parser output", () => {
  it.each(blockFixtures)("$era block ($name)", async (fx) => {
    await expect(toJson(parseBlockFixture(fx))).toMatchFileSnapshot(goldenFile(fx.file));
  });

  it.each(txFixtures)("$era tx ($name)", async (fx) => {
    await expect(toJson(parseTx(fx))).toMatchFileSnapshot(goldenFile(fx.file));
  });

  it.each(syntheticFixtures)("synthetic $era $kind ($name)", async (fx) => {
    const output =
      fx.kind === "tx"
        ? parseTx(fx)
        : fx.kind === "block"
          ? parseBlockFixture(fx)
          : parseEbBlockFixture(fx);
    await expect(toJson(output)).toMatchFileSnapshot(goldenFile(fx.file));
  });

  it("has synthetic fixtures that match what their build script writes", () => {
    const build = path.join(process.cwd(), "tests", "fixtures", "synthetic", "build.mjs");
    expect(() =>
      execFileSync(process.execPath, [build, "--check"], { stdio: "pipe" })
    ).not.toThrow();
  });
});
