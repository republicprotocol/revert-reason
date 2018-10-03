import * as qs from "query-string";
import * as React from "react";

import Select from "react-select";

import history from "./History";

// WithRouter
import { History, Location } from "history";
import { match, withRouter } from "react-router-dom";

interface SearchState {
    txHash: string;
    network: { value: string, label: string };
}

interface SearchProps {
    onSubmit: (txHash: string, network: string) => Promise<void>;


    // withRouter props
    history: History;
    location: Location;
    match: match<SearchProps>;
    staticContext: undefined;
}

const options = [
    { value: "mainnet", label: "Mainnet" },
    // { value: "ropsten", label: "Ropsten" },
    // { value: "kovan", label: "Kovan" },
    // { value: "rinkeby", label: "Rinkeby" },
];
const optionMap = {};
for (const option of options) {
    optionMap[option.value] = option;
}

export const customStyles = {
    option: (base: React.CSSProperties, state: any) => ({
        ...base,
        borderBottom: "1px dotted pink",
        color: "white",
        backgroundColor: "#001c3a",
    }),
    control: (base: any) => ({
        ...base,
        paddingTop: 33,
        paddingBottom: 33,
        height: 38,
        borderRadius: 0,
        background: "white",
        border: 0,
        color: "#001c3a",
    }),
    singleValue: (base: any, state: any) => {
        const opacity = state.isDisabled ? 0.5 : 1;
        const transition = "opacity 300ms";

        return {
            ...base,
            opacity,
            transition,
            color: "#001c3a",
        };
    }
};

class Search extends React.Component<SearchProps, SearchState> {

    constructor(props: SearchProps, context: object) {
        super(props, context);
        this.state = {
            txHash: "",
            network: options[0],
        };
    }

    public componentDidMount() {
        const txHash = qs.parse(this.props.location.search).txHash;
        const network = qs.parse(this.props.location.search).network;
        if (txHash) {
            this.setState({ txHash, network: optionMap[network] || options[0] });
            this.props.onSubmit(txHash, network);
        }
    }

    public render() {
        const { txHash, network } = this.state;

        return <div className="Reason-form block">
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

        history.push(`/?txHash=${txHash}&network=${network}`);

        this.props.onSubmit(txHash, network);
    }
}

export default withRouter(Search);
