"use client";
import { createContext,useContext,useRef,useState,type ReactNode } from "react";
export type ActionState={key:string;stage:"working"|"proving"|"submitting"|"confirmed"|"failed"|"uncertain"};
const Context=createContext<{state:ActionState|null;setState:(s:ActionState|null)=>void;lock:React.MutableRefObject<boolean>}|null>(null);
export function ActionProvider({children}:{children:ReactNode}){const[state,setState]=useState<ActionState|null>(null);const lock=useRef(false);return <Context.Provider value={{state,setState,lock}}>{children}</Context.Provider>;}
export function useActionContext(){const c=useContext(Context);if(!c)throw new Error("Missing ActionProvider");return c;}
