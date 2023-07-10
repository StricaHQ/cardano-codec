import { ByronEbBlock } from "../../types/byronTypes";
import * as utils from "../../utils/utils";

export const parseEbBlock = (block: any, blockCbor: Buffer): ByronEbBlock => {
  const blockBuf = utils.getCborSpanBuffer(blockCbor, block);
  const headerBuf = utils.getCborSpanBuffer(blockCbor, block[0]);
  // byron eb block header is hashed with an array with first item 0
  const headerHash = utils.createHash32(Buffer.from(`8200${headerBuf.toString("hex")}`, "hex"));

  const header = {
    hash: headerHash,
    blockHeight: block[0][3][1][0],
    epoch: block[0][3][0],
    prevHash: block[0][1].toString("hex"),
    bodySize: blockBuf.length,
  };

  return {
    header,
  };
};

export default parseEbBlock;
