"use client";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { WalletBar } from "./WalletBar";
export function AppShell({
  children,
  showNav = true,
}: {
  children: React.ReactNode;
  showNav?: boolean;
}) {
  return (
    <div className="lucent-workspace min-h-dvh">
      <a href="#workspace" className="skip-link">
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div className="min-w-0 flex-1">
          <WalletBar />
          <main
            id="workspace"
            tabIndex={-1}
            className={
              showNav
                ? "workspace-entry mx-auto max-w-[1500px] pb-24 md:pb-8"
                : "workspace-entry mx-auto max-w-[1500px]"
            }
          >
            <ActionFeedback />
            {children}
          </main>
        </div>
      </div>
      {showNav && <BottomNav />}
    </div>
  );
}
