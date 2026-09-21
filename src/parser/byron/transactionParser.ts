import { CborNode } from "@stricahq/cbors";
import { Transaction, TransactionInput, TransactionOutput } from "../../types/byronTypes";
import { coin, embedded, encoded, hex, items, num } from "../../utils/node";
import * as utils from "../../utils/utils";

const processInputs = (inputs: CborNode): Array<TransactionInput> => {
  const txIns = [];
  for (const txIn of items(inputs)) {
    const [type, outPoint] = items(txIn);
    if (num(type) === 0) {
      // [0, #6.24(bytes .cbor [txId, index])]
      const [txId, index] = items(embedded(outPoint));
      txIns.push({
        txId: hex(txId),
        index: num(index),
      });
    } else {
      throw new Error("txin non 0 type found");
    }
  }
  return txIns;
};

const processOutputs = (outputs: CborNode): Array<TransactionOutput> => {
  const txOuts = [];
  for (const out of items(outputs)) {
    const [address, amount] = items(out);
    txOuts.push({
      address: utils.toHex(encoded(address)),
      amount: coin(amount),
    });
  }
  return txOuts;
};

// the transaction payload of a block body: [* [tx, [* witness]]]
export const parseTransaction = (txPayload: CborNode): Array<Transaction> => {
  const result = [];
  for (const txAux of items(txPayload)) {
    // [[+ input], [+ output], attributes]
    const trx = items(txAux)[0];
    const [inputs, outputs] = items(trx);
    const hash = utils.createHash32(encoded(trx));

    result.push({
      hash,
      inputs: processInputs(inputs),
      outputs: processOutputs(outputs),
    });
  }

  return result;
};

export default parseTransaction;
