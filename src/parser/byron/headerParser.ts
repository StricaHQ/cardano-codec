import * as utils from "../../utils/utils";

export const parseHeader = (header: any, blockCbor: Buffer) => {
  const headerBuf = utils.getCborSpanBuffer(blockCbor, header);
  // byron block header is hashed with an array with first item 1
  const headerHash = utils.createHash32(Buffer.from(`8201${headerBuf.toString("hex")}`, "hex"));

  return {
    hash: headerHash,
    blockHeight: header[3][2][0],
    slot: header[3][0][1],
    epoch: header[3][0][0],
    prevHash: header[1].toString("hex"),
  };
};

export default parseHeader;
