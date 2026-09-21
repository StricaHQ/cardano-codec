import { CborNode } from "@stricahq/cbors";
import { CertificateType } from "../../constants";
import {
  Relay,
  Token,
  TransactionCertificate,
  InstantaneousReward,
  Proposal,
  Transaction,
  TransactionInput,
  TransactionOutput,
  HashType,
  StakeCredential,
  Withdrawal,
  CostMdls,
} from "../../types/alonzoTypes";
import {
  coin,
  encoded,
  entries,
  hex,
  int,
  isNil,
  items,
  num,
  ratio,
  tagged,
  text,
} from "../../utils/node";
import * as utils from "../../utils/utils";

const getMultiAsset = function (ma: CborNode | undefined) {
  const tokens: Array<Token> = [];
  if (isNil(ma)) {
    return tokens;
  }
  for (const { key: policyId, value: assets } of entries(ma)) {
    for (const { key: assetName, value } of entries(assets)) {
      tokens.push({
        policyId: hex(policyId),
        assetName: hex(assetName),
        amount: coin(value),
      });
    }
  }
  return tokens;
};

const getStakeCredentialType = (key: number) => {
  if (key === 0) {
    return HashType.ADDRESS;
  }
  // key == 1 is script
  return HashType.SCRIPT;
};

const parseStakeCredential = (credential: CborNode | undefined): StakeCredential => {
  const [type, key] = items(credential);
  return {
    key: hex(key),
    type: getStakeCredentialType(num(type)),
  };
};

// a tag 30 rational as [numerator, denominator]
const parseRational = (rational: CborNode | undefined): [number, number] => {
  const [numerator, denominator] = items(tagged(rational, 30));
  return [num(numerator), num(denominator)];
};

const parseInputs = (inputs: CborNode): Array<TransactionInput> => {
  const txIns: Array<TransactionInput> = [];
  for (const input of items(inputs)) {
    const [txId, index] = items(input);
    txIns.push({
      txId: hex(txId),
      index: num(index),
    });
  }
  return txIns;
};

const parseWithdrawals = (withdrawals: CborNode): Array<Withdrawal> => {
  const withdrawal: Array<Withdrawal> = [];
  for (const { key: ra, value: val } of entries(withdrawals)) {
    withdrawal.push({
      rewardAccount: hex(ra),
      amount: coin(val),
    });
  }
  return withdrawal;
};

const parseCostMdls = (costMdls: CborNode) => {
  // the Map dedupes a repeated language: first position, last value
  const models = new Map<number, CborNode>();
  for (const { key, value } of entries(costMdls)) {
    models.set(num(key), value);
  }
  const parsedCostMdls: Array<CostMdls> = [];
  for (const [language, costModel] of models) {
    parsedCostMdls.push({
      language,
      costModel: items(costModel).map(num),
    });
  }
  return parsedCostMdls;
};

const parsePoolMetadata = (poolMetadata: CborNode | undefined) => {
  if (isNil(poolMetadata)) {
    return null;
  }
  const [url, metadataHash] = items(poolMetadata);
  return {
    url: text(url),
    metadataHash: hex(metadataHash),
  };
};

const parseRelays = function (relays: CborNode): Array<Relay> {
  const relaysFinal: Array<Relay> = [];
  for (const relayNode of items(relays)) {
    const relay = items(relayNode);
    switch (num(relay[0])) {
      case 0: {
        relaysFinal.push({
          port: isNil(relay[1]) ? null : num(relay[1]),
          ipv4: isNil(relay[2]) ? null : hex(relay[2]),
          ipv6: isNil(relay[3]) ? null : hex(relay[3]),
        });
        break;
      }
      case 1: {
        relaysFinal.push({
          port: isNil(relay[1]) ? null : num(relay[1]),
          dnsName: text(relay[2]),
        });
        break;
      }
      case 2: {
        relaysFinal.push({
          srvName: text(relay[1]),
        });
        break;
      }
      default: {
        throw new Error("Unknown type of pool relay");
      }
    }
  }
  return relaysFinal;
};

const parseCertificates = function (certificates: CborNode) {
  const certs: Array<TransactionCertificate> = [];
  for (const certificateNode of items(certificates)) {
    const certificate = items(certificateNode);
    let cert: TransactionCertificate;
    switch (num(certificate[0])) {
      case 0:
        cert = {
          type: CertificateType.STAKE_KEY_REG,
          cert: {
            stakeCredential: parseStakeCredential(certificate[1]),
          },
        };
        certs.push(cert);
        break;
      case 1:
        cert = {
          type: CertificateType.STAKE_KEY_DE_REG,
          cert: {
            stakeCredential: parseStakeCredential(certificate[1]),
          },
        };
        certs.push(cert);
        break;
      case 2:
        cert = {
          type: CertificateType.STAKE_DELEGATION,
          cert: {
            stakeCredential: parseStakeCredential(certificate[1]),
            poolKeyHash: hex(certificate[2]),
          },
        };
        certs.push(cert);
        break;
      case 3:
        cert = {
          type: CertificateType.POOL_REG,
          cert: {
            operator: hex(certificate[1]),
            vrfKeyHash: hex(certificate[2]),
            pledge: coin(certificate[3]),
            cost: coin(certificate[4]),
            margin: parseRational(certificate[5]),
            rewardAccount: hex(certificate[6]),
            poolOwners: items(certificate[7]).map(hex),
            relays: parseRelays(certificate[8]),
            poolMetadata: parsePoolMetadata(certificate[9]),
          },
        };
        certs.push(cert);
        break;
      case 4:
        cert = {
          type: CertificateType.POOL_DE_REG,
          cert: {
            poolKeyHash: hex(certificate[1]),
            epoch: num(certificate[2]),
          },
        };
        certs.push(cert);
        break;
      case 5:
        cert = {
          type: CertificateType.GENESIS_DELEGATION,
          cert: {
            genesisHash: hex(certificate[1]),
            genesisDelegateHash: hex(certificate[2]),
            vrfKeyHash: hex(certificate[3]),
          },
        };
        certs.push(cert);
        break;
      case 6: {
        const rewards = [];
        // [pot, { * stake_credential => delta_coin } / coin]
        const [pot, target] = items(certificate[1]);
        cert = {
          type: CertificateType.INSTANT_REWARD,
          cert: {
            // the ledger knows only 0 (reserves) and 1 (treasury)
            pot: num(pot) as 0 | 1,
          },
        };
        if (target?.kind === "map") {
          for (const { key, value } of entries(target)) {
            const reward: InstantaneousReward = {
              amount: coin(value),
              stakeCredential: parseStakeCredential(key),
            };
            rewards.push(reward);
          }
          cert.cert.rewards = rewards;
        } else {
          cert.cert.amount = coin(target);
        }
        certs.push(cert);
        break;
      }
      default:
        throw new Error("unknown transaction certificate");
    }
  }
  return certs;
};

const parseProtocolParamUpdates = function (updates: CborNode) {
  const [proposals, epoch] = items(updates);

  const proposalsFormatted: Array<Proposal> = [];
  for (const { key: gHash, value: update } of entries(proposals)) {
    const proposal: Proposal = {
      genesisHash: hex(gHash),
      parameter: {},
    };
    for (const { key: variable, value } of entries(update)) {
      switch (num(variable)) {
        case 0:
          proposal.parameter.minFeeA = coin(value);
          break;
        case 1:
          proposal.parameter.minFeeB = coin(value);
          break;
        case 2:
          proposal.parameter.maxBlockBodySize = num(value);
          break;
        case 3:
          proposal.parameter.maxTransactionSize = num(value);
          break;
        case 4:
          proposal.parameter.maxBlockHeaderSize = num(value);
          break;
        case 5:
          proposal.parameter.keyDeposit = coin(value);
          break;
        case 6:
          proposal.parameter.poolDeposit = coin(value);
          break;
        case 7:
          proposal.parameter.maxEpoch = num(value);
          break;
        case 8:
          proposal.parameter.n = num(value);
          break;
        case 9:
          proposal.parameter.pledgeInfluence = ratio(value);
          break;
        case 10:
          proposal.parameter.expansionRate = ratio(value);
          break;
        case 11:
          proposal.parameter.treasuryGrowthRate = ratio(value);
          break;
        case 12:
          proposal.parameter.d = ratio(value);
          break;
        case 13: {
          // [0] (neutral nonce) / [1, bytes]
          const [type, nonce] = items(value);
          proposal.parameter.entropy = [int(type).toString(), isNil(nonce) ? "" : hex(nonce)];
          break;
        }
        case 14: {
          const [major, minor] = items(value);
          proposal.parameter.protocolVersion = [num(major), num(minor)];
          break;
        }
        case 15:
          // minUtxoValue, a shelley era parameter
          break;
        case 16:
          proposal.parameter.minPoolCost = coin(value);
          break;
        case 17:
          proposal.parameter.adaPerUtxoByte = coin(value);
          break;
        case 18:
          proposal.parameter.costMdls = parseCostMdls(value);
          break;
        case 19: {
          const [mem, step] = items(value);
          proposal.parameter.exUnitPrices = {
            mem: parseRational(mem),
            step: parseRational(step),
          };
          break;
        }
        case 20: {
          const [mem, steps] = items(value);
          proposal.parameter.maxTxExUnits = {
            mem: num(mem),
            steps: num(steps),
          };
          break;
        }
        case 21: {
          const [mem, steps] = items(value);
          proposal.parameter.maxBlockExUnits = {
            mem: num(mem),
            steps: num(steps),
          };
          break;
        }
        case 22:
          proposal.parameter.maxValueSize = num(value);
          break;
        case 23:
          proposal.parameter.collateralPercent = num(value);
          break;
        case 24:
          proposal.parameter.maxCollateralInputs = num(value);
          break;
        default:
          throw new Error("Unknown protocol parameter update");
      }
    }
    proposalsFormatted.push(proposal);
  }

  return {
    proposals: proposalsFormatted,
    epoch: num(epoch),
  };
};

const parseOutput = (outputNode: CborNode): TransactionOutput => {
  const output = items(outputNode);
  const address = hex(output[0]);
  let outValue: string;
  let tokens: Array<Token> | undefined;
  let plutusDataHash: string | undefined;
  // coin, or [coin, multiasset]
  if (output[1]?.kind === "array") {
    const [amount, multiAsset] = items(output[1]);
    outValue = coin(amount);
    tokens = getMultiAsset(multiAsset);
  } else {
    outValue = coin(output[1]);
  }
  if (!isNil(output[2])) {
    plutusDataHash = hex(output[2]);
  }
  const out: TransactionOutput = {
    address,
    amount: outValue,
    plutusDataHash,
    tokens,
  };
  return out;
};

export const parseTransaction = (trx: CborNode): Transaction => {
  const hash = utils.createHash32(encoded(trx));
  const transaction: Transaction = {
    hash,
    inputs: [],
    outputs: [],
    fee: "",
  };
  for (const { key, value } of entries(trx)) {
    switch (num(key)) {
      case 0: {
        transaction.inputs = parseInputs(value);
        break;
      }
      case 1: {
        transaction.outputs = [];
        for (const output of items(value)) {
          transaction.outputs.push(parseOutput(output));
        }
        break;
      }
      case 2: {
        transaction.fee = coin(value);
        break;
      }
      case 3: {
        transaction.ttl = num(value);
        break;
      }
      case 4: {
        const certificates = parseCertificates(value);
        transaction.certificates = certificates;
        break;
      }
      case 5: {
        transaction.withdrawals = parseWithdrawals(value);
        break;
      }
      case 6: {
        const parameters = parseProtocolParamUpdates(value);
        transaction.update = parameters;
        break;
      }
      case 7: {
        transaction.auxiliaryDataHash = hex(value);
        break;
      }
      case 8: {
        transaction.validityIntervalStart = num(value);
        break;
      }
      case 9: {
        transaction.mint = getMultiAsset(value);
        break;
      }
      case 11: {
        transaction.scriptDataHash = hex(value);
        break;
      }
      case 13: {
        transaction.collaterals = parseInputs(value);
        break;
      }
      case 14: {
        transaction.requiredSigners = items(value).map(hex);
        break;
      }
      case 15: {
        transaction.networkId = num(value);
        break;
      }
      default: {
        throw new Error("Unknown transaction field");
      }
    }
  }

  return transaction;
};

export default parseTransaction;
