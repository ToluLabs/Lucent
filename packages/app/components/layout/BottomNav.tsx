"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { primaryNavigation,supportingNavigation,resourceNavigation } from "./navigation";
import { Modal } from "@/components/ui/Modal";
export function BottomNav(){const path=usePathname();const[open,setOpen]=useState(false);return <><nav aria-label="Mobile workspace" className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface pt-2 md:hidden">{primaryNavigation.map(({href,label,icon:Icon})=><Link key={href} href={href} aria-current={path===href?"page":undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] ${path===href?"text-accent":"text-text-secondary"}`}><Icon className="h-5 w-5" aria-hidden="true"/>{label}</Link>)}<button type="button" aria-haspopup="dialog" onClick={()=>setOpen(true)} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] text-text-secondary"><MoreHorizontal className="h-5 w-5"/>More</button></nav><Modal open={open} onClose={()=>setOpen(false)} title="Workspace tools">{[...supportingNavigation,...resourceNavigation].map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-card"><Icon className="h-5 w-5 text-text-muted"/>{label}</Link>)}</Modal></>;}
