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
    { key: 'nav.monitoring', label: t('nav.monitoring', 'Monitoring'), href: '/monitoring', publicAllowed: true },
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

  const [isLiveConnected, setIsLiveConnected] = React.useState<boolean>(false);

  React.useEffect(() => {
    fetch('/api/geospatial/blocks')
      .then((res) => res.json())
      .then((data) => {
        if (data.source === 'live_database') {
          setIsLiveConnected(true);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50 shadow-xs">
      {/* Top Banner: Scientific Safeguard & Language Switcher */}
      <div className="bg-[#0d5c63] text-white text-xs px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] sm:text-xs min-w-0 flex-1">
          <ShieldCheckIcon className="w-3.5 h-3.5 text-teal-200 shrink-0" />
          <span className="truncate leading-tight font-medium">
            {t('header.pilot')}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] shrink-0">
          {/* Hindi / English Switch */}
          <div className="flex items-center bg-teal-900/80 rounded border border-teal-600 p-0.5">
            <button
              onClick={() => setLanguage('hi')}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-colors ${
                language === 'hi' ? 'bg-amber-400 text-teal-950' : 'text-teal-100 hover:text-white'
              }`}
            >
              हिन्दी
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-colors ${
                language === 'en' ? 'bg-amber-400 text-teal-950' : 'text-teal-100 hover:text-white'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 sm:py-0 sm:h-16 gap-2 sm:gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-[#0d5c63] text-white flex items-center justify-center shadow-sm shrink-0">
              <WaterDropletIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-teal-200" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href="/" className="text-base sm:text-lg font-bold text-text-main tracking-tight hover:text-[#0d5c63] transition-colors">
                  JalDrishti
                </Link>
                <span className="text-[10px] sm:text-xs font-normal text-text-muted whitespace-nowrap">
                  जलदृष्टि v1.0
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-text-muted leading-tight truncate">
                Satellite-Assisted Groundwater Governance
              </p>
            </div>
          </div>

          {/* User Role Context Selector */}
          <div className="flex items-center justify-between sm:justify-start gap-2 bg-subtle border border-border px-2.5 py-1.5 rounded-md shadow-xs text-xs w-full sm:w-auto">
            <div className="flex items-center gap-1.5 min-w-0">
              <UserRoleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0d5c63] shrink-0" />
              <span className="text-xs text-text-muted font-medium shrink-0">{t('header.demoRole', 'Role:')}</span>
            </div>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as UserRole)}
              className="bg-transparent text-xs font-semibold text-text-main border-none focus:outline-none cursor-pointer truncate max-w-[200px] sm:max-w-none text-right sm:text-left"
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
        <nav className="flex flex-wrap sm:flex-nowrap sm:space-x-1 gap-1 border-t border-border/40 pt-1.5 pb-2 sm:pb-0">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-medium rounded-md sm:rounded-b-none sm:rounded-t-md transition-colors text-center ${
                  isActive
                    ? 'bg-[#0d5c63] text-white sm:bg-subtle sm:text-[#0d5c63] sm:border-b-2 sm:border-[#0d5c63] font-semibold shadow-xs'
                    : 'bg-subtle/70 text-text-main hover:bg-subtle sm:bg-transparent sm:text-text-muted sm:hover:text-text-main'
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
