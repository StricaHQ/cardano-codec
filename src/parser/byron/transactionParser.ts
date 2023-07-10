import * as cbor from "@stricahq/cbors";
import * as utils from "../../utils/utils";
import { Transaction, TransactionInput, TransactionOutput } from "../../types/byronTypes";

const processInputs = (inputs: Array<any>): Array<TransactionInput> => {
  const txIns = [];
  for (const txIn of inputs) {
    if (txIn[0] === 0) {
      const [txId, index] = cbor.Decoder.decode(txIn[1].value).value as [Buffer, number];
      txIns.push({
        txId: txId.toString("hex"),
        index,
      });
    } else {
      throw new Error("txin non 0 type found");
    }
  }
  return txIns;
};

const processOutputs = (outputs: Array<any>, blockCbor: Buffer): Array<TransactionOutput> => {
  const txOuts = [];
  for (const out of outputs) {
    txOuts.push({
      address: utils.getCborSpanBuffer(blockCbor, out[0]).toString("hex"),
      amount: out[1].toString(),
    });
  }
  return txOuts;
};

export const parseTransaction = (
  transactions: Array<any>,
  blockCbor: Buffer
): Array<Transaction> => {
  const result = [];
  for (const [trx] of transactions) {
    const trxBuf = utils.getCborSpanBuffer(blockCbor, trx);
    const hash = utils.createHash32(trxBuf);

    result.push({
      hash,
      inputs: processInputs(trx[0]),
      outputs: processOutputs(trx[1], blockCbor),
    });
  }

  return result;
};

export default parseTransaction;
