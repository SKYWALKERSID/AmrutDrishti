'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import { useLanguage } from '@/lib/context/LanguageContext';
import { WaterDropletIcon, ShieldCheckIcon, UserRoleIcon, MapPinIcon } from './ui/Icons';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const { activeRole, setActiveRole } = useRole();
  const { language, setLanguage, t } = useLanguage();

  const roleLabels: Record<UserRole, string> = {
    general_public: t('role.general_public'),
    district_collector: t('role.district_collector'),
    bdo: t('role.bdo'),
    gram_pradhan: t('role.gram_pradhan'),
    jal_samiti: t('role.jal_samiti'),
    environmental_analyst: t('role.environmental_analyst'),
    admin: t('role.admin'),
  };

  // Role-based navigation tab visibility for prototype demonstration
  const allNavItems = [
    { key: 'nav.overview', label: t('nav.overview', 'Overview'), href: '/', publicAllowed: true },
    { key: 'nav.explorer', label: t('nav.explorer', 'Map Explorer'), href: '/explorer', publicAllowed: true },
    { key: 'nav.monitoring', label: t('nav.monitoring', 'Monitoring'), href: '/monitoring', publicAllowed: false },
    { key: 'nav.risk', label: t('nav.risk', 'Risk & Scoring'), href: '/risk-assessment', publicAllowed: true },
    { key: 'nav.interventions', label: t('nav.interventions', 'Interventions'), href: '/interventions', publicAllowed: false },
    { key: 'nav.alerts', label: t('nav.alerts', 'Alerts & SMS'), href: '/alerts', publicAllowed: false, advisoryOnly: true },
    { key: 'nav.datasources', label: t('nav.datasources', 'Data Sources'), href: '/data-sources', publicAllowed: true },
    { key: 'nav.admin', label: t('nav.admin', 'Administration'), href: '/admin', publicAllowed: false, adminOnly: true },
  ];

  const filteredNavItems = allNavItems.filter((item) => {
    if (activeRole === 'admin') return true;
    if (activeRole === 'general_public') return item.publicAllowed;
    if (activeRole === 'gram_pradhan' || activeRole === 'jal_samiti') {
      return item.publicAllowed || item.advisoryOnly;
    }
    if (item.adminOnly) return false;
    return true;
  });

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50">
      {/* Top Banner: Scientific Safeguard & Language Switcher */}
      <div className="bg-[#0d5c63] text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-4 h-4 text-teal-200 shrink-0" />
          <span>
            {t('header.pilot')}
          </span>
          <span className="hidden md:inline bg-teal-800/80 px-2 py-0.5 rounded text-[11px] font-medium text-teal-100 border border-teal-600/40">
            {t('header.demoMode')}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          {/* Hindi / English Switch */}
          <div className="flex items-center bg-teal-900/80 rounded border border-teal-600 p-0.5">
            <button
              onClick={() => setLanguage('hi')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                language === 'hi' ? 'bg-amber-400 text-teal-950' : 'text-teal-100 hover:text-white'
              }`}
            >
              हिन्दी
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                language === 'en' ? 'bg-amber-400 text-teal-950' : 'text-teal-100 hover:text-white'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#0d5c63] text-white flex items-center justify-center shadow-sm shrink-0">
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
            <UserRoleIcon className="w-4 h-4 text-[#0d5c63] shrink-0" />
            <span className="text-xs text-text-muted hidden sm:inline font-medium">{t('header.demoRole')}</span>
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
