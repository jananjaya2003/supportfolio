import {
  Activity,
  Battery,
  Bluetooth,
  BriefcaseBusiness,
  Bug,
  Cable,
  Camera,
  Cloud,
  Command,
  Cpu,
  Database,
  FileQuestion,
  Globe,
  HardDrive,
  Headphones,
  KeyRound,
  Keyboard,
  Laptop,
  LockKeyhole,
  Mail,
  Mic,
  Monitor,
  MonitorSmartphone,
  Mouse,
  Network,
  Printer,
  Router,
  Server,
  Settings,
  ShieldCheck,
  Smartphone,
  Tag,
  Usb,
  Wifi,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { TroubleshootingCase } from "./data/cases";

/** Icons offered in the case editor. Keys are stored in cases.json as `iconName`. */
export const caseIconOptions: Record<string, LucideIcon> = {
  Wrench, HardDrive, Activity, Laptop, Monitor, MonitorSmartphone, Smartphone, Cpu, Battery,
  Mail, Command, Cloud, Globe, Wifi, Network, Router, Server, Database,
  Printer, Usb, Cable, Bluetooth, Keyboard, Mouse, Headphones, Mic, Camera,
  LockKeyhole, KeyRound, ShieldCheck, Bug, Settings, BriefcaseBusiness,
};

export const caseIconFor = (item: Pick<TroubleshootingCase, "iconName">): LucideIcon => caseIconOptions[item.iconName] ?? FileQuestion;

const categoryIcons: Record<string, LucideIcon> = {
  Windows: Monitor,
  "Microsoft 365": Cloud,
  Networking: Network,
  Printers: Printer,
  "Identity & Access": LockKeyhole,
  "Hardware & Devices": Laptop,
  "Software & Apps": BriefcaseBusiness,
};

export const categoryIconFor = (category: string): LucideIcon => categoryIcons[category] ?? Tag;
