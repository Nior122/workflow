"use client";

import type { ComponentType } from "react";
import {
  AlertOctagon,
  ArrowUpDown,
  Binary,
  BookOpen,
  Bot,
  Braces,
  Calculator,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckSquare,
  CircleDot,
  Clock,
  Cloud,
  Code2,
  Columns2,
  CopyCheck,
  CreditCard,
  Database,
  DatabaseZap,
  FileCheck2,
  FileCode,
  FileInput,
  FileJson2,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderOpen,
  GitBranch,
  GitFork,
  GitMerge,
  Globe,
  HardDrive,
  HelpCircle,
  History,
  ImagePlus,
  Inbox,
  Kanban,
  KeyRound,
  Layers,
  ListChecks,
  Mail,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  Mic,
  Network,
  OctagonX,
  Play,
  Repeat,
  Reply,
  Rss,
  ScanText,
  Scissors,
  ScissorsLineDashed,
  Send,
  Share2,
  Sheet,
  ShoppingBag,
  ShoppingCart,
  Shuffle,
  SmilePlus,
  Sparkles,
  Split,
  StickyNote,
  Table,
  Tags,
  Terminal,
  Timer,
  Type,
  UserCheck,
  Users,
  Video,
  Volume2,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type NodeIconComponent = ComponentType<{
  className?: string;
  strokeWidth?: number;
}>;

/** Recognizable brand SVG icons with Lucide-compatible props. */
function createBrandSvg(pathD: string, viewBox = "0 0 24 24"): NodeIconComponent {
  function BrandSvgIcon({ className }: { className?: string }) {
    return (
      <svg
        viewBox={viewBox}
        fill="currentColor"
        aria-hidden="true"
        className={className}
      >
        <path d={pathD} />
      </svg>
    );
  }
  return BrandSvgIcon;
}

const BRAND_SVGS: Record<string, NodeIconComponent> = {
  "brand:whatsapp": createBrandSvg(
    "M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.4 1.3-1.95 1.38-.5.08-1.14.11-1.85-.11-.43-.14-.98-.32-1.69-.63-2.98-1.29-4.93-4.3-5.08-4.5-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.6-.37.8-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.59.82 2.01.89 2.16.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.77 1.27 1.65 2.06 1.13 1.01 2.09 1.32 2.39 1.47.3.15.47.13.65-.08.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.72.81 2.01.96.3.15.5.22.57.35.07.12.07.72-.17 1.4z",
  ),
  "brand:telegram": createBrandSvg(
    "M11.94 2C6.45 2 2 6.45 2 11.94s4.45 9.94 9.94 9.94 9.94-4.45 9.94-9.94S17.43 2 11.94 2zm4.88 6.81l-1.64 7.73c-.12.55-.45.68-.91.42l-2.52-1.86-1.22 1.17c-.13.13-.25.25-.51.25l.18-2.57 4.68-4.23c.2-.18-.04-.28-.32-.1l-5.78 3.64-2.49-.78c-.54-.17-.55-.54.11-.8l9.73-3.75c.45-.17.85.1.69.88z",
  ),
  "brand:x": createBrandSvg(
    "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  ),
  "brand:github": createBrandSvg(
    "M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z",
  ),
  "brand:openai": createBrandSvg(
    "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494z",
  ),
  "brand:stripe": createBrandSvg(
    "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z",
  ),
};

const LUCIDE_MAP: Record<string, LucideIcon> = {
  // Brand fallbacks with distinct, clean Lucide icons
  "brand:gmail": Mail,
  "brand:outlook": Inbox,
  "brand:slack": MessageSquare,
  "brand:discord": MessagesSquare,
  "brand:facebook": Share2,
  "brand:instagram": ImagePlus,
  "brand:youtube": Video,
  "brand:linkedin": Users,
  "brand:paystack": CreditCard,
  "brand:flutterwave": CreditCard,
  "brand:shopify": ShoppingBag,
  "brand:woocommerce": ShoppingCart,
  "brand:googlesheets": Sheet,
  "brand:airtable": Table,
  "brand:notion": FileText,
  "brand:googledrive": FolderOpen,
  "brand:dropbox": Cloud,
  "brand:aws": HardDrive,
  "brand:pinecone": DatabaseZap,
  "brand:googlecalendar": Calendar,
  "brand:calendly": CalendarCheck,
  "brand:postgres": Database,
  "brand:mysql": Database,
  "brand:mongodb": Database,
  "brand:supabase": Zap,
  "brand:firebase": Zap,
  "brand:redis": Layers,
  "brand:twilio": MessageCircle,
  "brand:microsoft": Users,
  "brand:mailchimp": Send,
  "brand:hubspot": Users,
  "brand:salesforce": Cloud,
  "brand:trello": Kanban,
  "brand:asana": CheckSquare,
  "brand:jira": ListChecks,
  "brand:clickup": CheckSquare,
  "brand:zoom": Video,
  "brand:googledocs": FileCheck2,
  "brand:typeform": FileInput,
  "brand:anthropic": Sparkles,
  "brand:google": Sparkles,
  "brand:groq": Zap,
  "brand:ollama": Terminal,

  // Direct Lucide keys (`lucide:<Name>`)
  "lucide:Play": Play,
  "lucide:Webhook": Webhook,
  "lucide:CalendarClock": CalendarClock,
  "lucide:MessageSquare": MessageSquare,
  "lucide:FileCheck2": FileCheck2,
  "lucide:Rss": Rss,
  "lucide:AlertOctagon": AlertOctagon,
  "lucide:GitBranch": GitBranch,
  "lucide:GitFork": GitFork,
  "lucide:GitMerge": GitMerge,
  "lucide:Repeat": Repeat,
  "lucide:Split": Split,
  "lucide:Layers": Layers,
  "lucide:Filter": Filter,
  "lucide:ArrowUpDown": ArrowUpDown,
  "lucide:Scissors": Scissors,
  "lucide:CopyCheck": CopyCheck,
  "lucide:Timer": Timer,
  "lucide:UserCheck": UserCheck,
  "lucide:Shuffle": Shuffle,
  "lucide:Code2": Code2,
  "lucide:Globe": Globe,
  "lucide:Type": Type,
  "lucide:Clock": Clock,
  "lucide:Braces": Braces,
  "lucide:FileCode": FileCode,
  "lucide:FileText": FileText,
  "lucide:KeyRound": KeyRound,
  "lucide:Columns2": Columns2,
  "lucide:Reply": Reply,
  "lucide:Workflow": Workflow,
  "lucide:OctagonX": OctagonX,
  "lucide:CircleDot": CircleDot,
  "lucide:StickyNote": StickyNote,
  "lucide:Sparkles": Sparkles,
  "lucide:Bot": Bot,
  "lucide:Tags": Tags,
  "lucide:SmilePlus": SmilePlus,
  "lucide:ScanText": ScanText,
  "lucide:FileSpreadsheet": FileSpreadsheet,
  "lucide:HelpCircle": HelpCircle,
  "lucide:Binary": Binary,
  "lucide:FileInput": FileInput,
  "lucide:ScissorsLineDashed": ScissorsLineDashed,
  "lucide:DatabaseZap": DatabaseZap,
  "lucide:ImagePlus": ImagePlus,
  "lucide:Mic": Mic,
  "lucide:Volume2": Volume2,
  "lucide:FileJson2": FileJson2,
  "lucide:Network": Network,
  "lucide:History": History,
  "lucide:Calculator": Calculator,
  "lucide:BookOpen": BookOpen,
  "lucide:Terminal": Terminal,
  "lucide:Users": Users,
};

export function resolveNodeIcon(iconKey: string): LucideIcon {
  if (iconKey in BRAND_SVGS) {
    return BRAND_SVGS[iconKey] as unknown as LucideIcon;
  }
  return LUCIDE_MAP[iconKey] ?? Terminal;
}
