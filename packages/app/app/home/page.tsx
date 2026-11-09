import type { Metadata } from "next";
import { HomeClient } from "./home-client";

export const metadata: Metadata = { title: "Overview — Lucent" };

export default function HomePage() {
  return <HomeClient />;
}
