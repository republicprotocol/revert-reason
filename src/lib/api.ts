import axios from "axios";
import Web3 from "web3";

import { Client, Network } from "../components/Search";

// import { JsonRPCResponse, Transaction } from "web3/types";
type JsonRPCResponse = any;
type Transaction = any;

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
        case Network.Mainnet:
            // return new Web3(new Web3.providers.HttpProvider("https://rpc.slock.it/mainnet/parity-archived"));
            return new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io:443/remix"));
        case Network.Ropsten:
            return new Web3(new Web3.providers.HttpProvider("https://api.myetherapi.com/rop"));
        case Network.Kovan:
            return new Web3(new Web3.providers.HttpProvider("https://rpc.slock.it/kovan/archive"));
        case Network.Rinkeby:
            return new Web3(new Web3.providers.HttpProvider("https://rinkeby.infura.io:443/remix"));
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
    UNKNOWN = "UNKNOWN",
}

export interface Response {
    status: ResponseStatus;
    reason: string;
}

export const strip0x = (hex: string) => hex.substring(0, 2) === "0x" ? hex.slice(2) : hex;

export const getReturnValue = async (web3: Web3, tx: Transaction, client: Client): Promise<Response> => {
    // TODO: Generate Infura API key

    if (tx.hash.slice(0, 2) !== "0x") {
        tx.hash = "0x" + tx.hash;
    }

    if (!txHashRegExp.test(tx.hash)) {
        throw new Error("Invalid transaction hash.");
    }

    let method = "debug_traceTransaction";
    let params = [tx.hash, {}];
    if (client === Client.Parity) {
        method = "trace_replayTransaction";
        params = [tx.hash, ["debug"]];
    }

    // Get trace from Infura
    // TODO: traceTransaction is very heavy. Look into retrieving the memory and
    // stack at the last execution step instead.
    const response: Trace = await (web3.currentProvider as any).send(method, params);

    if (response.error) {
        const error: TraceError = response.error as any;
        if (typeof error === "string") {
            throw new Error(error);
        }
        throw new Error(error.message);
    }

    // console.log(response);

    const result = response.result || response;

    const returnValue = result.returnValue ? strip0x(result.returnValue) : result ? strip0x((result as any).output) : "";

    if (client === Client.Parity) {
        const reason = returnValue.slice(0, 8) === "08c379a0" ? web3.eth.abi.decodeParameter("string", `0x${returnValue.slice(8)}`) as any as string : `0x${returnValue}`;
        return {
            status: ResponseStatus.UNKNOWN,
            reason
        };
    }

    if (!result.failed) {
        return {
            status: ResponseStatus.SUCCESS,
            reason: `0x${returnValue}`,
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
        let reason = returnValue;
        if (!reason) {
            throw new Error("No revert reason found");
        }

        // The error message may be prefixed with the error's type signature

        // 0x08c379a0 is the 4-byte signature of `Error(string)`
        if (returnValue.slice(0, 8) === "08c379a0") {
            reason = web3.eth.abi.decodeParameter("string", `0x${returnValue.slice(8)}`) as any as string;
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

    const result = (await axios.get(URL, { timeout: 500000 })).data.result[0];

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
