import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Builder",
  description: "Drag nodes onto the canvas, connect them, and run the flow.",
};

export default function BuilderPage() {
  return <AppShell />;
}
