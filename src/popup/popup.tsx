import React, { FunctionComponent } from "react";
import ReactDOM from "react-dom";

import "./styles/global.scss";

import { HashRouter, Route } from "react-router-dom";

import { RegisterPage } from "./pages/register";
import { MainPage } from "./pages/main";
import { LockPage } from "./pages/lock";
import { SendPage } from "./pages/send";

import { configure } from "mobx";
import { observer } from "mobx-react";

import { StoreProvider, useStore } from "./stores";
import { KeyRingStatus } from "./stores/keyring";

configure({
  enforceActions: "always" // Make mobx to strict mode.
});

const StateRenderer: FunctionComponent = observer(() => {
  const { keyRingStore } = useStore();

  if (keyRingStore.status === KeyRingStatus.EMPTY) {
    return <RegisterPage />;
  } else if (keyRingStore.status === KeyRingStatus.UNLOCKED) {
    return <MainPage />;
  } else if (keyRingStore.status === KeyRingStatus.LOCKED) {
    return <LockPage />;
  } else if (keyRingStore.status === KeyRingStatus.NOTLOADED) {
    return <div>Not yet loaded</div>;
  } else {
    return <div>Unknown status</div>;
  }
});

ReactDOM.render(
  <StoreProvider>
    <HashRouter>
      <Route exact path="/" component={StateRenderer} />
      <Route path="/send" component={SendPage} />
    </HashRouter>
  </StoreProvider>,
  document.getElementById("app")
);