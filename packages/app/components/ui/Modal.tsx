"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; busy?: boolean; }
export function Modal({open,onClose,title,children,busy=false}:ModalProps) {
 const ref=useRef<HTMLDialogElement>(null); const id=useId();
 useEffect(()=>{ const d=ref.current; if(!d)return; if(open && !d.open){d.showModal();} else if(!open && d.open)d.close(); },[open]);
 useEffect(()=>{if(!open)return; const before=document.body.style.overflow; document.body.style.overflow="hidden"; return()=>{document.body.style.overflow=before;};},[open]);
 return <dialog ref={ref} aria-labelledby={id} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} className="m-auto w-[calc(100%-32px)] max-w-2xl max-h-[90dvh] overflow-y-auto rounded-xl border border-border bg-surface p-0 shadow-2xl">
 <div className="flex flex-col gap-5 p-5 sm:p-7">
 <header className="flex items-center justify-between gap-3"><h2 id={id} className="text-xl font-semibold">{title}</h2><button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-card"><X className="h-5 w-5"/></button></header>
 {open && children}</div></dialog>;
}
