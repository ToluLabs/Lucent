import React from "react";
import { createRoot } from "react-dom/client";
import Auditor from "../../app/auditor/page";
import Escrow from "../../app/escrow/page";
import { HomeClient } from "../../app/home/home-client";
import Landing from "../../app/page";
import Payroll from "../../app/payroll/page";
import Profile from "../../app/profile/page";
import Send from "../../app/send/page";
import Funding from "../../app/shield/page";
import Verify from "../../app/verify/page";
import { ActionProvider } from "../../lib/action-context";
import { WalletProvider } from "./wallet";
const routes: Record<string, React.ComponentType> = {
  "/send": Send,
  "/shield": Funding,
  "/payroll": Payroll,
  "/escrow": Escrow,
  "/profile": Profile,
  "/home": HomeClient,
  "/": Landing,
  "/verify": Verify,
  "/auditor": Auditor,
};
const Page = routes[location.pathname] ?? HomeClient;
createRoot(document.getElementById("root")!).render(
  <WalletProvider>
    <ActionProvider>
      <Page />
    </ActionProvider>
  </WalletProvider>,
);

import { connectFreighter } from "../../lib/freighter";
(window as any).__testFreighter = async (changeNetwork = false) => {
  const signer = await connectFreighter();
  if (changeNetwork) (window as any).__wrongNetwork = true;
  return signer.sign("fixture-xdr");
};
