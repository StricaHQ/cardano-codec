import * as utils from "../../utils/utils";
import parseTransaction from "./transactionParser";
import parseHeader from "./headerParser";
import { ByronBlock, Header } from "../../types/byronTypes";

export const parseBlock = (block: any, blockCbor: Buffer): ByronBlock => {
  const header = parseHeader(block[0], blockCbor);
  const transactions = parseTransaction(block[1][0], blockCbor);

  const blockBuf = utils.getCborSpanBuffer(blockCbor, block);
  const blockHeader: Header = {
    ...header,
    bodySize: blockBuf.length,
  };
  return {
    header: blockHeader,
    transactions,
  };
};

export default parseBlock;
