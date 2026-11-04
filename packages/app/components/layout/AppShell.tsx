"use client";

import { createContext, useContext } from "react";
import { motion } from "framer-motion";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { cn } from "@/lib/cn";

const WideContext = createContext(false);
/** True when the surrounding AppShell is in dashboard (wide) mode. */
export const useShellWide = () => useContext(WideContext);

interface AppShellProps {
  children: React.ReactNode;
  showNav?: boolean;
  /** Dashboard layout: lets the page use the full desktop width. */
  wide?: boolean;
}

export function AppShell({ children, showNav = true, wide = false }: AppShellProps) {
  return (
    <WideContext.Provider value={wide}>
      <div className="min-h-dvh bg-void md:flex">
        <div className="hidden md:block md:w-64 md:shrink-0">
          <Sidebar />
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <TopBar />
          <motion.main
            className={cn("flex-1", showNav && "pb-28 md:pb-12")}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className={cn("mx-auto w-full", wide ? "max-w-[480px] md:max-w-[1040px]" : "max-w-[480px] md:max-w-[760px]")}>
              {children}
            </div>
          </motion.main>
        </div>
      </div>

      {showNav && <BottomNav />}
    </WideContext.Provider>
  );
}
