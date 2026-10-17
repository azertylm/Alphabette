import React from 'react';
import {
  SunMedium,
  Zap,
  HeartHandshake,
  Scale,
  Newspaper,
  Hammer,
  ShieldCheck,
  Building,
  Leaf,
  FileText,
  Receipt,
  Users,
  Shield,
  CloudSun,
  Bookmark,
  Crown,
  Sparkles,
  Rocket,
  Bot,
  Gamepad2,
  Trophy,
  Camera,
  PenTool,
  HeartPulse,
  Landmark,
  FileX,
  ShieldAlert,
  FileCheck,
  Globe,
  Cpu,
  Database,
  Lock,
  Star,
  Compass,
  Wrench,
  Boxes,
  type LucideIcon,
} from 'lucide-react';

/**
 * @file RegistryIcon.tsx
 * Résolution des icônes du registre : un nom (ex: "Crown") devient un composant lucide-react.
 * Permet d'ajouter une application depuis /admin sans toucher au code.
 */

const ICONS: Record<string, LucideIcon> = {
  SunMedium,
  Zap,
  HeartHandshake,
  Scale,
  Newspaper,
  Hammer,
  ShieldCheck,
  Building,
  Leaf,
  FileText,
  Receipt,
  Users,
  Shield,
  CloudSun,
  Bookmark,
  Crown,
  Sparkles,
  Rocket,
  Bot,
  Gamepad2,
  Trophy,
  Camera,
  PenTool,
  HeartPulse,
  Landmark,
  FileX,
  ShieldAlert,
  FileCheck,
  Globe,
  Cpu,
  Database,
  Lock,
  Star,
  Compass,
  Wrench,
  Boxes,
};

/** Noms d'icônes proposés dans le formulaire d'administration. */
export const REGISTRY_ICON_NAMES: string[] = Object.keys(ICONS).sort();

export const resolveRegistryIcon = (name: string): LucideIcon => ICONS[name] || Sparkles;

interface RegistryIconProps {
  name: string;
  className?: string;
}

export const RegistryIcon: React.FC<RegistryIconProps> = ({ name, className = 'w-5 h-5' }) => {
  const Icon = resolveRegistryIcon(name);
  return <Icon className={className} />;
};
