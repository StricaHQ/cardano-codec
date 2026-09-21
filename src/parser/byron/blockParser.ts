import { CborNode } from "@stricahq/cbors";
import parseTransaction from "./transactionParser";
import parseHeader from "./headerParser";
import { ByronBlock, Header } from "../../types/byronTypes";
import { encoded, items } from "../../utils/node";

export const parseBlock = (block: CborNode): ByronBlock => {
  // [header, [txPayload, sscPayload, dlgPayload, updPayload], extra]
  const [headerNode, body] = items(block);
  const header = parseHeader(headerNode);
  const transactions = parseTransaction(items(body)[0]);

  const blockHeader: Header = {
    ...header,
    bodySize: encoded(block).length,
  };
  return {
    header: blockHeader,
    transactions,
  };
};

export default parseBlock;
