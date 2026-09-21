import { CborNode } from "@stricahq/cbors";
import { Header } from "../../types/byronTypes";
import { encoded, hex, items, num } from "../../utils/node";
import * as utils from "../../utils/utils";

export const parseHeader = (header: CborNode): Omit<Header, "bodySize"> => {
  // [protocolMagic, prevBlock, bodyProof, consensusData, extraData]
  const [, prevBlock, , consensusData] = items(header);
  // [[epoch, slot], issuer, [difficulty], signature]
  const [slotId, , difficulty] = items(consensusData);
  const [epoch, slot] = items(slotId);
  // byron block header is hashed with an array with first item 1
  const headerHash = utils.createHash32(
    utils.concatBytes(Uint8Array.of(0x82, 0x01), encoded(header))
  );

  return {
    hash: headerHash,
    blockHeight: num(items(difficulty)[0]),
    slot: num(slot),
    epoch: num(epoch),
    prevHash: hex(prevBlock),
  };
};

export default parseHeader;
