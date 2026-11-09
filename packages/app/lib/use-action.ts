"use client";
import { useCallback,useState } from "react";
import { trackEvent,trackedAction } from "./analytics";
import { useWallet } from "./wallet-context";
import { errMsg } from "./err";
import type { TxPhase } from "./wallet";
import { useActionContext } from "./action-context";
import { transactionError } from "./action-result";
export function useAction(){
 const{refresh,setError}=useWallet(); const{state,setState,lock}=useActionContext();
 const[phase,setPhase]=useState<TxPhase|null>(null);
 const busy=state && ["working","proving","submitting"].includes(state.stage)?state.key:null;
 const run=useCallback(async(key:string,fn:(setPhase:(p:TxPhase)=>void)=>Promise<void>,opts?:{refresh?:boolean}):Promise<boolean>=>{
  if(lock.current || state?.stage==="uncertain")return false;
  lock.current=true; const action=trackedAction(window.location.pathname,key);
  if(action)trackEvent("action_started",{action}); setError(null);setState({key,stage:"working"});setPhase(null);
  try{await fn(p=>{setPhase(p);setState({key,stage:p});});setState({key,stage:"confirmed"});if(opts?.refresh!==false)await refresh();return true;}
  catch(e){const message=errMsg(e);const info=transactionError(message);if(action)trackEvent("action_failed",{action});setError(message);setState({key,stage:info.uncertain?"uncertain":"failed"});return false;}
  finally{lock.current=false;setPhase(null);}
 },[refresh,setError,setState,lock,state]);
 return {run,busy,phase,uncertain:state?.stage==="uncertain"};
}
