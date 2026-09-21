import { CborNode } from "@stricahq/cbors";
import { ByronEbBlock } from "../../types/byronTypes";
import { encoded, hex, items, num } from "../../utils/node";
import * as utils from "../../utils/utils";

export const parseEbBlock = (block: CborNode): ByronEbBlock => {
  const headerNode = items(block)[0];
  // [protocolMagic, prevBlock, bodyProof, [epoch, [difficulty]], extraData]
  const [, prevBlock, , consensusData] = items(headerNode);
  const [epoch, difficulty] = items(consensusData);
  // byron eb block header is hashed with an array with first item 0
  const headerHash = utils.createHash32(
    utils.concatBytes(Uint8Array.of(0x82, 0x00), encoded(headerNode))
  );

  const header = {
    hash: headerHash,
    blockHeight: num(items(difficulty)[0]),
    epoch: num(epoch),
    prevHash: hex(prevBlock),
    bodySize: encoded(block).length,
  };

  return {
    header,
  };
};

export default parseEbBlock;
