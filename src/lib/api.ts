import axios from "axios";

import Web3 from "web3";
import { JsonRPCResponse, Transaction } from "web3/types";

// Matches a 32-byte transaction ID (starting with 0x)
const txHashRegExp = new RegExp(/^0x([A-Fa-f0-9]{64})$/);

interface TraceLog {
    pc: number;
    op: string;
    gas: number;
    gasCost: number;
    depth: number;
    stack: string[];
    memory: string[];
    storage: any;
}

type TraceError = string | { message: string, code: number };

interface Trace extends JsonRPCResponse {
    result?: {
        failed: true;
        gas: 39643;
        returnValue: string;
        structLogs: TraceLog[];
    };
}

export const getWeb3 = (network: string) => {
    switch (network) {
        case "main":
        case "mainnet":
            return new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io:443/remix"));
            break;
        case "ropsten":
            return new Web3(new Web3.providers.HttpProvider("https://ropsten.infura.io:443/remix"));
            break;
        case "kovan":
            return new Web3(new Web3.providers.HttpProvider("https://kovan.infura.io:443/remix"));
            break;
        case "rinkeby":
            return new Web3(new Web3.providers.HttpProvider("https://rinkeby.infura.io:443/remix"));
            break;
        default:
            throw new Error("Unknown network");
    }
};

export enum ResponseStatus {
    SUCCESS = "SUCCESS",
    REVERTED = "REVERTED",
    OUT_OF_GAS = "OUT_OF_GAS",
    BAD_INSTRUCTION = "BAD_INSTRUCTION",
    BAD_JUMP = "BAD_JUMP",
}

export interface Response {
    status: ResponseStatus;
    reason: string;
}

export const getReturnValue = async (web3: Web3, tx: Transaction): Promise<Response> => {
    // TODO: Generate Infura API key

    if (tx.hash.slice(0, 2) !== "0x") {
        tx.hash = "0x" + tx.hash;
    }

    if (!txHashRegExp.test(tx.hash)) {
        throw new Error("Invalid transaction hash.");
    }

    // Get trace from Infura
    // TODO: traceTransaction is very heavy. Look into retrieving the memory and
    // stack at the last execution step instead.
    const response: Trace = await new Promise((resolve: (val: Trace) => void, reject) => web3.currentProvider.send({
        method: "debug_traceTransaction",
        params: [tx.hash, {}],
        jsonrpc: "2.0",
        id: 2
    }, (e, val) => {
        if (e) { reject(e); return; }
        resolve(val);
    }));

    if (response.error) {
        const error: TraceError = response.error as any;
        if (typeof error === "string") {
            throw new Error(error);
        }
        throw new Error(error.message);
    }

    if (!response.result) {
        throw new Error("No response from Ethereum node");
    }

    const result = response.result;

    if (!result.failed) {
        return {
            status: ResponseStatus.SUCCESS,
            reason: `0x${result.returnValue}`,
        };
    }

    const lastStruct = result.structLogs[result.structLogs.length - 1];
    lastStruct.op = lastStruct.op.toUpperCase();

    // Check if transaction ran out of gas:
    if (lastStruct.gasCost > lastStruct.gas) {
        return {
            status: ResponseStatus.OUT_OF_GAS,
            reason: `Out of gas (used ${result.gas - lastStruct.gas} of ${result.gas} gas)`,
        };
    }

    // Check if last instruction was JUMP or JUMPI
    if (lastStruct.op === "JUMP" || lastStruct.op === "JUMPI") {
        return {
            status: ResponseStatus.BAD_JUMP,
            reason: "Bad jump destination"
        };
    }

    // Check if last instruction was REVERT
    if (lastStruct.op === "REVERT") {
        let reason = result.returnValue;
        if (!reason) {
            throw new Error("No revert reason found");
        }
        if (result.returnValue.slice(0, 8) === "08c379a0") {
            reason = web3.eth.abi.decodeParameter("string", result.returnValue.slice(8));
        }
        return {
            status: ResponseStatus.REVERTED,
            reason,
        };
    }

    // Return Bad Instruction
    return {
        status: ResponseStatus.BAD_INSTRUCTION,
        reason: `Bad instruction`,
    };
};

export const decodeHex = (hex: string) => {
    let str = "";
    for (let i = 0; (i < hex.length); i += 2) {
        const byte = hex.substr(i, 2);
        if (byte === "00") {
            str += " ";
        } else {
            str += String.fromCharCode(parseInt(byte, 16));
        }
    }
    return str;
};

export const getSource = async (address: string, network: string): Promise<[any[], string]> => {
    // const address = qs.parse(this.props.location.search).address;

    // TODO: Use network param
    const URL = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}`;

    const result = (await axios.get(URL)).data.result[0];

    const source = result.SourceCode ? result.SourceCode
        .replace(/([^\n\s]+)\t/g, "$1\n\t")
        .replace(/([^\n\s]+)    /g, "$1\n    ")
        .replace(/\*\/([^\n])/g, "*/\n$1")
        .replace(/;([^\n])/g, ";\n\n$1")
        .replace(/{([^\n])/g, "{\n$1")
        .replace(/}([^\n])/g, "}\n\n$1")
        : null;

    const abi = result.ABI && result.ABI !== "Contract source code not verified" ? JSON.parse(result.ABI) : null;

    return [abi, source];
};

export const abiOutputMapping = (web3: Web3, abi: any[]): Map<string, any[]> => {
    const map = new Map<string, any[]>();

    for (const entry of abi) {
        if (entry.type === "function") {
            const signature = web3.eth.abi.encodeFunctionSignature(entry);
            map.set(signature, entry.outputs);
        }
    }

    return map;
};
