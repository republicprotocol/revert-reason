import * as React from "react";
import * as ReactDOM from "react-dom";

import Web3 from "web3";

import App from "./components/App";
import registerServiceWorker from "./registerServiceWorker";

import "./styles/index.css";

declare global {
  interface Window {
    web3: Web3 | undefined;
  }
}

ReactDOM.render(
  <App />,
  document.getElementById("root") as HTMLElement
);
registerServiceWorker();
