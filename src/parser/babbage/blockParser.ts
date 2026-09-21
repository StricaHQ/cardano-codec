import { CborNode } from "@stricahq/cbors";
import { parseTransaction } from "./transactionBodyParser";
import parseHeader from "./headerParser";
import {
  BabbageBlock,
  AuxiliaryData,
  InvalidTransaction,
  Transaction,
  Witnesses,
} from "../../types/babbageTypes";
import { entries, isNil, items, num } from "../../utils/node";
import parseWitnessMap from "./witnessesParser";
import { parseAuxiliaryData } from "./auxiliaryDataParser";

export const parseBlock = (input: CborNode): BabbageBlock => {
  // [header, tx bodies, witness sets, auxiliary data, invalid transactions]
  const block = items(input);
  const header = parseHeader(block[0]);

  const transactions: Array<Transaction> = [];
  for (const trx of items(block[1])) {
    transactions.push(parseTransaction(trx));
  }
  const invalidTransactions: Array<InvalidTransaction> = isNil(block[4])
    ? []
    : items(block[4]).map(num);
  const witnesses: Array<Witnesses> = [];
  for (const witness of items(block[2])) {
    witnesses.push(parseWitnessMap(witness));
  }

  const auxiliaryDataMap: Map<number, AuxiliaryData> = new Map();

  for (const { key: txIndex, value: auxData } of entries(block[3])) {
    auxiliaryDataMap.set(num(txIndex), parseAuxiliaryData(auxData));
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
