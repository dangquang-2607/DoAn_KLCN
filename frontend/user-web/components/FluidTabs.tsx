"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
}

interface FluidTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: "cobalt" | "emerald" | "platinum" | "glassDark";
  size?: "sm" | "md" | "lg";
  layoutId?: string;
  className?: string;
}

export function FluidTabs({
  tabs,
  activeTab,
  onChange,
  variant = "cobalt",
  size = "md",
  layoutId = "fluid-tab-pill",
  className = "",
}: FluidTabsProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  // Variant Styles
  const variantStyles = {
    cobalt: {
      container: "bg-slate-900/85 border border-slate-800/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_10px_30px_-10px_rgba(0,0,0,0.5)]",
      pill: "bg-gradient-to-r from-indigo-500 via-blue-600 to-indigo-600 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.5),0_0_12px_rgba(99,102,241,0.35)] border-t border-white/30",
      activeText: "text-white font-semibold",
      inactiveText: "text-slate-400 hover:text-slate-200",
      ghostPill: "bg-white/[0.06]",
      badgeActive: "bg-white/20 text-white border-white/30",
      badgeInactive: "bg-slate-800 text-slate-400 border-slate-700",
    },
    emerald: {
      container: "bg-emerald-950/80 border border-emerald-900/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_10px_30px_-10px_rgba(6,78,59,0.4)]",
      pill: "bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 shadow-[0_4px_20px_-2px_rgba(16,185,129,0.5),0_0_12px_rgba(52,211,153,0.35)] border-t border-emerald-300/40",
      activeText: "text-white font-semibold",
      inactiveText: "text-emerald-300/60 hover:text-emerald-200",
      ghostPill: "bg-emerald-400/[0.08]",
      badgeActive: "bg-white/20 text-white border-emerald-200/40",
      badgeInactive: "bg-emerald-900/60 text-emerald-300 border-emerald-800",
    },
    platinum: {
      container: "bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]",
      pill: "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-[0_3px_12px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)] border border-black/5 dark:border-white/10",
      activeText: "text-slate-900 dark:text-white font-semibold",
      inactiveText: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
      ghostPill: "bg-black/[0.04] dark:bg-white/[0.04]",
      badgeActive: "bg-slate-900/10 dark:bg-white/20 text-slate-900 dark:text-white border-black/10 dark:border-white/20",
      badgeInactive: "bg-slate-300/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400",
    },
    glassDark: {
      container: "bg-slate-950/70 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
      pill: "bg-gradient-to-b from-white/20 to-white/5 backdrop-blur-md border-t border-white/40 border-b border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
      activeText: "text-white font-semibold drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)]",
      inactiveText: "text-slate-400 hover:text-slate-200",
      ghostPill: "bg-white/[0.04]",
      badgeActive: "bg-white/25 text-white border-white/40",
      badgeInactive: "bg-white/10 text-slate-400",
    },
  }[variant];

  const sizeStyles = {
    sm: "p-1 gap-1 text-xs",
    md: "p-1.5 gap-1.5 text-sm",
    lg: "p-2 gap-2 text-base",
  }[size];

  const buttonPadding = {
    sm: "px-2.5 py-1",
    md: "px-4 py-2",
    lg: "px-5 py-2.5",
  }[size];

  return (
    <div
      role="tablist"
      onMouseLeave={() => setHoveredTab(null)}
      className={`relative inline-flex items-center rounded-2xl backdrop-blur-lg select-none transition-all duration-300 ${variantStyles.container} ${sizeStyles} ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isHovered = hoveredTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            onMouseEnter={() => setHoveredTab(tab.id)}
            className={`relative z-10 flex items-center gap-2 rounded-xl font-medium outline-none transition-colors duration-200 ${buttonPadding} ${
              isActive ? variantStyles.activeText : variantStyles.inactiveText
            }`}
          >
            {/* Active Fluid Sliding Pill Indicator */}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className={`absolute inset-0 z-[-1] rounded-xl ${variantStyles.pill}`}
                transition={{
                  type: "spring",
                  stiffness: 460,
                  damping: 34,
                  mass: 0.8,
                }}
              />
            )}

            {/* Hover Ghost Pill Indicator */}
            {isHovered && !isActive && (
              <motion.div
                layoutId={`${layoutId}-hover`}
                className={`absolute inset-0 z-[-2] rounded-xl ${variantStyles.ghostPill}`}
                transition={{
                  type: "spring",
                  stiffness: 600,
                  damping: 35,
                }}
              />
            )}

            {/* Tab Icon with Micro-bounce */}
            {tab.icon && (
              <motion.span
                animate={isActive ? { scale: [1, 1.22, 1], rotate: [0, -4, 0] } : { scale: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex items-center justify-center shrink-0"
              >
                {tab.icon}
              </motion.span>
            )}

            {/* Tab Label */}
            <span className="tracking-tight whitespace-nowrap">{tab.label}</span>

            {/* Optional Badge */}
            {tab.badge !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.5 text-[11px] font-semibold rounded-full border transition-all duration-200 ${
                  isActive ? variantStyles.badgeActive : variantStyles.badgeInactive
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Directional View Transition Wrapper for Tab Panels
interface FluidTabPanelProps {
  tabKey: string;
  direction?: number;
  children: React.ReactNode;
  className?: string;
}

export function FluidTabPanel({ tabKey, direction = 1, children, className = "" }: FluidTabPanelProps) {
  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 30 : -30,
      opacity: 0,
      scale: 0.98,
      filter: "blur(4px)",
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.32,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -30 : 30,
      opacity: 0,
      scale: 0.98,
      filter: "blur(4px)",
      transition: {
        duration: 0.22,
        ease: [0.22, 1, 0.36, 1],
      },
    }),
  };

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={tabKey}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
