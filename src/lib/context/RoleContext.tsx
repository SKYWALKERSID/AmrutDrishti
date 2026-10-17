'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '@/lib/types';

interface RoleContextType {
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
}

const STORAGE_KEY_ROLE = 'jaldrishti_demo_role_v1';

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRoleState] = useState<UserRole>('district_collector');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROLE);
      if (saved && ['general_public', 'district_collector', 'bdo', 'gram_pradhan', 'jal_samiti', 'environmental_analyst', 'admin'].includes(saved)) {
        setActiveRoleState(saved as UserRole);
      }
    } catch {
      // Ignore localStorage read errors in SSR or restricted environments
    }
  }, []);

  const setActiveRole = (role: UserRole) => {
    setActiveRoleState(role);
    try {
      localStorage.setItem(STORAGE_KEY_ROLE, role);
    } catch {
      // Ignore write errors
    }

    // Persist role change to audit trail
    try {
      fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-jaldrishti-role': role,
        },
        body: JSON.stringify({
          actorRole: role,
          action: 'switch_active_role',
          resourceTarget: `role:${role}`,
          outcome: 'success',
          details: { previousRole: activeRole, newRole: role },
        }),
      }).catch(() => {});
    } catch {
      // Non-blocking
    }
  };

  return (
    <RoleContext.Provider value={{ activeRole, setActiveRole }}>
      {children}
    </RoleContext.Provider>
  );
};

export function useRole(): RoleContextType {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
