import * as React from "react";

import Select from "react-select";

import { Transaction } from "web3/types";

import Loading from "./Loading";

import { abiOutputMapping, getReturnValue, getSource, getWeb3 } from "../lib/web3";
import Source from "./Source";

interface WhyState {
    txHash: string;
    reason: string | null;
    returnRaw: string | null;
    returnValues: any[] | null;
    error: Error | null;
    loading: boolean;
    network: { value: string, label: string };
    source: string | null;
}

interface WhyProps {
}

const options = [
    { value: "mainnet", label: "Mainnet" },
    // { value: "ropsten", label: "Ropsten" },
    // { value: "kovan", label: "Kovan" },
    // { value: "rinkeby", label: "Rinkeby" },
];

export const customStyles = {
    option: (base: React.CSSProperties, state: any) => ({
        ...base,
        borderBottom: "1px dotted pink",
        color: state.isFullscreen ? "red" : "blue",
    }),
    control: (base: any) => ({
        ...base,
        paddingTop: 33,
        paddingBottom: 33,
        width: 300,
        height: 38,
        borderRadius: 0,
        background: "white",
        border: 0,

    }),
    singleValue: (base: any, state: any) => {
        const opacity = state.isDisabled ? 0.5 : 1;
        const transition = "opacity 300ms";

        return {
            ...base,
            opacity,
            transition,
        };
    }
};

class Why extends React.Component<WhyProps, WhyState> {

    constructor(props: WhyProps, context: object) {
        super(props, context);
        this.state = {
            error: null,
            loading: false,
            reason: null,
            returnRaw: null,
            returnValues: null,
            txHash: "",
            network: options[0],
            source: null,
        };
    }

    public render() {
        const { error, reason, txHash, loading, returnRaw, returnValues, network, source } = this.state;

        const returnRender = returnRaw || returnValues ? <p className="returnRaw"><span className="green">Return value: </span>
            {returnValues ? returnValues.map(x => x.toString()).join(", ") : returnRaw}
        </p> : null;

        return <div className="Reason">
            <div className="Reason-form">
                <form onSubmit={this.handleSubmit}>
                    <input
                        placeholder="Transaction Hash"
                        type="text"
                        onChange={this.handleInput}
                        value={txHash}
                        name="txHash"
                        className="txHash-input"
                    />
                </form>
                <Select
                    className="select-network"
                    value={network}
                    onChange={this.handleChangeNetwork}
                    options={options}
                    styles={customStyles}
                />
            </div>
            {loading ? <Loading /> : null}
            {error ? <p className="error red">{error.message}</p> : null}
            {reason ? <p className="reason"><span className="red">Revert reason: </span>{reason}</p> : null}
            {returnRender}
            {source ? <Source search={reason} source={source} /> : null}
        </div>;
    }

    private handleChangeNetwork = (network: any) => {
        this.setState({ network });
    }

    private handleInput = (event: React.FormEvent<HTMLInputElement>): void => {
        const element = (event.target as HTMLInputElement);
        this.setState((state) => ({ ...state, [element.name]: element.value }));
    }

    private handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const { txHash } = this.state;
        const network = this.state.network.value;

        this.setState({ loading: true, error: null, reason: null, returnRaw: null, returnValues: null, source: null });

        const web3 = getWeb3(network);

        let returnRaw;
        let reason;
        try {
            [returnRaw, reason] = await getReturnValue(web3, txHash);
            this.setState({ loading: false, reason, returnRaw });
        } catch (error) {
            this.setState({ loading: false, error });
            return;
        }

        const tx = await new Promise((resolve: (val: Transaction) => void, reject) =>
            web3.eth.getTransaction(txHash, (e, val) => {
                if (e) { reject(e); return; }
                resolve(val);
            }));

        const [abi, source] = await getSource(tx.to, network);

        if (returnRaw && abi) {
            const outputMapping = abiOutputMapping(web3, abi);
            const signature = tx.input.slice(0, 10);
            const outputs = outputMapping.get(signature);

            if (outputs) {
                const returnValuesObj = web3.eth.abi.decodeParameters(outputs.map(output => output.type), returnRaw);
                const returnValues: any[] = [];
                for (const returnValue in returnValuesObj) {
                    if (returnValuesObj.hasOwnProperty(returnValue) && !isNaN(parseInt(returnValue, 10))) {
                        returnValues.push(returnValuesObj[returnValue]);
                    }
                }
                this.setState({ returnValues });
            }
        } else if (reason && source) {
            this.setState({ source });
        }
    }
}

export default Why;
