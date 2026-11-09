"use client";
import { Loader2 } from "lucide-react";
import { Modal } from "./Modal";
interface Props {open:boolean;estSeconds?:number;message?:string;fullScreen?:boolean;className?:string;}
export function ProofLoadingOverlay({open,message,fullScreen,className}:Props){
 const content=<div role="status" aria-live="polite" className={className}><Loader2 aria-hidden="true" className="mb-4 h-6 w-6 animate-spin text-accent"/><p className="text-sm leading-relaxed text-text-secondary">{message || "Generating a proof locally in your browser. Duration depends on your device. Keep this tab open; no transaction is confirmed yet."}</p></div>;
 return fullScreen ? <Modal open={open} busy onClose={()=>{}} title="Preparing your proof">{content}</Modal> : open ? content : null;
}
