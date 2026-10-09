'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/lib/types';
import { WaterDropletIcon, ShieldCheckIcon, UserRoleIcon, MapPinIcon } from './ui/Icons';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const [activeRole, setActiveRole] = useState<UserRole>('district_collector');

  const navItems = [
    { label: 'Overview', href: '/' },
    { label: 'Map Explorer', href: '/explorer' },
    { label: 'Monitoring', href: '/monitoring' },
    { label: 'Risk & Scoring', href: '/risk-assessment' },
    { label: 'Interventions', href: '/interventions' },
    { label: 'Alerts & SMS', href: '/alerts' },
    { label: 'Data Sources', href: '/data-sources' },
    { label: 'Administration', href: '/admin' },
  ];

  const roleLabels: Record<UserRole, string> = {
    district_collector: 'District Collector',
    bdo: 'Block Development Officer (BDO)',
    gram_pradhan: 'Gram Pradhan',
    jal_samiti: 'Jal Samiti Member',
    environmental_analyst: 'Environmental Analyst',
    admin: 'System Administrator',
  };

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50">
      {/* Top Banner: Scientific Safeguard & Pilot Context */}
      <div className="bg-[#0d5c63] text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-4 h-4 text-teal-200" />
          <span>
            <strong>JalDrishti (à¤œà¤²à¤¦à¥ƒà¤·à¥à¤Ÿà¤¿) Pilot:</strong> Bundelkhand Region, MP â€” Evidence-Backed Decision Support.
          </span>
          <span className="hidden md:inline bg-teal-800/60 px-2 py-0.5 rounded text-[11px] text-teal-100">
            Demonstration Mode: Subject to Field Verification
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-teal-100">
          <span className="flex items-center gap-1">
            <MapPinIcon className="w-3.5 h-3.5 text-teal-300" /> Pilot Area: Tikamgarh & Chhatarpur
          </span>
          <span>â€¢</span>
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
                JalDrishti <span className="text-xs font-normal text-text-muted bg-subtle px-1.5 py-0.5 rounded border border-border whitespace-nowrap">à¤œà¤²à¤¦à¥ƒà¤·à¥à¤Ÿà¤¿ v1.0</span>
              </Link>
              <p className="text-[11px] text-text-muted leading-none">Satellite-Assisted Groundwater Governance</p>
            </div>
          </div>

          {/* User Role Context Selector */}
          <div className="flex items-center gap-2 bg-subtle border border-border px-3 py-1.5 rounded-md">
            <UserRoleIcon className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted hidden sm:inline">Role:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as UserRole)}
              className="bg-transparent text-xs font-medium text-text-main border-none focus:outline-none cursor-pointer"
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
          {navItems.map((item) => {
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
