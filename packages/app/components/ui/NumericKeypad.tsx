"use client";
import { Input } from "./Input";
import { sanitizeAmount, toBaseUnits } from "@/lib/amount";
interface Props {value:string;onChange:(value:string)=>void;maxDecimals?:number;className?:string;unit?:string;maxValue?:string;onMax?:()=>void;error?:string;disabled?:boolean;}
/** Compatibility name for existing callers; uses a native financial input. */
export function NumericKeypad({value,onChange,className,unit="USDC",maxValue,onMax,error,disabled}:Props){
 const exceeds=maxValue!==undefined && toBaseUnits(value)>toBaseUnits(maxValue);
 return <div className={className}><Input label={`Amount (${unit})`} inputMode="decimal" autoComplete="off" placeholder="0.00" value={value} onChange={e=>onChange(sanitizeAmount(e.target.value))} disabled={disabled} error={error || (exceeds?"Amount exceeds the available balance.":undefined)} className="py-5 font-mono text-3xl tabular-nums"/>
 {maxValue!==undefined && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary"><span>Available: {maxValue} {unit}</span>{onMax && <button type="button" disabled={disabled} onClick={onMax} className="min-h-10 px-2 font-medium text-accent">Use maximum</button>}</div>}</div>;
}
