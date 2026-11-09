"use client";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { WalletBar } from "./WalletBar";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
export function AppShell({children,showNav=true}:{children:React.ReactNode;showNav?:boolean}){
 return <div className="min-h-dvh bg-void"><a href="#workspace" className="skip-link">Skip to content</a><div className="flex min-h-dvh"><div className="hidden md:block"><Sidebar/></div><div className="min-w-0 flex-1"><WalletBar/><main id="workspace" tabIndex={-1} className={showNav?"mx-auto max-w-[1500px] pb-24 md:pb-8":"mx-auto max-w-[1500px]"}><ActionFeedback/>{children}</main></div></div>{showNav && <BottomNav/>}</div>;
}
