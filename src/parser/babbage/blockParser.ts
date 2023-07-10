import { parseTransaction } from "./transactionBodyParser";
import parseHeader from "./headerParser";
import {
  BabbageBlock,
  AuxiliaryData,
  InvalidTransaction,
  Transaction,
  Witnesses,
} from "../../types/babbageTypes";
import parseWitnessMap from "./witnessesParser";
import { parseAuxiliaryData } from "./auxiliaryDataParser";

export const parseBlock = (block: any, blockCbor: Buffer): BabbageBlock => {
  const header = parseHeader(block[0], blockCbor);

  const transactions: Array<Transaction> = [];
  for (const trx of block[1]) {
    transactions.push(parseTransaction(trx, blockCbor));
  }
  const invalidTransactions: Array<InvalidTransaction> = block[4] ? block[4] : [];
  const witnesses: Array<Witnesses> = [];
  for (const witness of block[2]) {
    witnesses.push(parseWitnessMap(witness, blockCbor));
  }

  const auxiliaryDataMap: Map<number, AuxiliaryData> = new Map();

  for (const [txIndex, auxData] of block[3].entries()) {
    auxiliaryDataMap.set(txIndex, parseAuxiliaryData(auxData));
  }

  return {
    header,
    transactions,
    witnesses,
    auxiliaryDataMap,
    invalidTransactions,
  };
};

export default parseBlock;
