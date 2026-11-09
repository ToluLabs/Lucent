import { cn } from "@/lib/cn";
export function SectionLabel({children,className}:{children:React.ReactNode;className?:string}){return <h2 className={cn("text-sm font-semibold text-text-secondary",className)}>{children}</h2>;}
