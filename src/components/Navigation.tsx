'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import { WaterDropletIcon, ShieldCheckIcon, UserRoleIcon, MapPinIcon } from './ui/Icons';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const { activeRole, setActiveRole } = useRole();

  const roleLabels: Record<UserRole, string> = {
    general_public: 'General Public (Read-Only)',
    district_collector: 'District Collector',
    bdo: 'Block Development Officer (BDO)',
    gram_pradhan: 'Gram Pradhan (Advisory View)',
    jal_samiti: 'Jal Samiti Member (Advisory View)',
    environmental_analyst: 'Environmental Analyst',
    admin: 'System Administrator (Full Access)',
  };

  // Role-based navigation tab visibility for prototype demonstration
  const allNavItems = [
    { label: 'Overview', href: '/', publicAllowed: true },
    { label: 'Map Explorer', href: '/explorer', publicAllowed: true },
    { label: 'Monitoring', href: '/monitoring', publicAllowed: false },
    { label: 'Risk & Scoring', href: '/risk-assessment', publicAllowed: true },
    { label: 'Interventions', href: '/interventions', publicAllowed: false },
    { label: 'Alerts & SMS', href: '/alerts', publicAllowed: false, advisoryOnly: true },
    { label: 'Data Sources', href: '/data-sources', publicAllowed: true },
    { label: 'Administration', href: '/admin', publicAllowed: false, adminOnly: true },
  ];

  const filteredNavItems = allNavItems.filter((item) => {
    if (activeRole === 'admin') return true; // System Administrator sees everything
    if (activeRole === 'general_public') return item.publicAllowed;
    if (activeRole === 'gram_pradhan' || activeRole === 'jal_samiti') {
      // Village notifications context focus
      return item.publicAllowed || item.advisoryOnly;
    }
    // District Collector, BDO, Environmental Analyst see official operational tabs
    if (item.adminOnly) return false;
    return true;
  });

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50">
      {/* Top Banner: Scientific Safeguard & Prototype Disclaimer */}
      <div className="bg-[#0d5c63] text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-4 h-4 text-teal-200" />
          <span>
            <strong>JalDrishti (जलदृष्टि) Pilot:</strong> Bundelkhand Region — Evidence-Backed Decision Support.
          </span>
          <span className="hidden md:inline bg-teal-800/80 px-2 py-0.5 rounded text-[11px] font-medium text-teal-100 border border-teal-600/40">
            Prototype Demonstration Mode — Simulated Role Context
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-teal-100">
          <span className="flex items-center gap-1">
            <MapPinIcon className="w-3.5 h-3.5 text-teal-300" /> Pilot Area: Tikamgarh & Chhatarpur
          </span>
          <span>•</span>
          <span>Last Data Refresh: 2026-10-08</span>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#0d5c63] text-white flex items-center justify-center shadow-sm">
              <WaterDropletIcon className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <Link href="/" className="text-lg font-bold text-text-main flex items-center gap-2 tracking-tight">
                JalDrishti <span className="text-xs font-normal text-text-muted bg-subtle px-1.5 py-0.5 rounded border border-border whitespace-nowrap">जलदृष्टि v1.0</span>
              </Link>
              <p className="text-[11px] text-text-muted leading-none">Satellite-Assisted Groundwater Governance</p>
            </div>
          </div>

          {/* User Role Context Selector */}
          <div className="flex items-center gap-2 bg-subtle border border-border px-3 py-1.5 rounded-md shadow-xs">
            <UserRoleIcon className="w-4 h-4 text-[#0d5c63]" />
            <span className="text-xs text-text-muted hidden sm:inline font-medium">Demo Role:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as UserRole)}
              className="bg-transparent text-xs font-semibold text-text-main border-none focus:outline-none cursor-pointer"
            >
              {Object.entries(roleLabels).map(([roleKey, roleName]) => (
                <option key={roleKey} value={roleKey}>
                  {roleName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto pb-2 sm:pb-0 scrollbar-none border-t border-border/40 pt-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-xs font-medium rounded-t-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-subtle text-[#0d5c63] border-b-2 border-[#0d5c63] font-semibold'
                    : 'text-text-muted hover:text-text-main hover:bg-subtle/50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

