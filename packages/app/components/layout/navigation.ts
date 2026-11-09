import { LayoutDashboard, Send, Briefcase, Lock, ArrowDownUp, ScanLine, ScanEye, Settings, BookOpen, ShieldCheck } from "lucide-react";
export const primaryNavigation=[
 {href:"/home",label:"Overview",icon:LayoutDashboard}, {href:"/send",label:"Payments",icon:Send}, {href:"/payroll",label:"Payroll",icon:Briefcase}, {href:"/escrow",label:"Escrow",icon:Lock}
];
export const supportingNavigation=[
 {href:"/shield",label:"Add / withdraw funds",icon:ArrowDownUp}, {href:"/verify",label:"Verification",icon:ScanLine}, {href:"/auditor",label:"Auditor access",icon:ScanEye}, {href:"/profile",label:"Account settings",icon:Settings},
];
export const resourceNavigation=[{href:"/docs",label:"Documentation",icon:BookOpen},{href:"/privacy",label:"Privacy controls",icon:ShieldCheck}];
