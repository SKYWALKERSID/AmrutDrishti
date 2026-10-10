'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ALL_BLOCKS } from '@/lib/data/bundelkhand';
import { INITIAL_NOTIFICATIONS } from '@/lib/data/alerts';
import { NotificationRecord, UserRole } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import {
  canMutateDemoWorkflows,
  demoRestrictionNotice,
  canDispatchAdvisory,
  buildAdvisoryMessages,
  displayDeliveryStatus,
  ADVISORY_DISCLAIMER_EN,
  NO_REAL_MESSAGE_NOTICE,
} from '@/lib/demo/demoPolicy';
import { AlertTriangleIcon, SendIcon, ShieldCheckIcon, CheckCircleIcon, UserRoleIcon } from '@/components/ui/Icons';

const STORAGE_KEY_ALERTS = 'jaldrishti_alerts_v1';

import { useLanguage } from '@/lib/context/LanguageContext';

function AlertsContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const { activeRole } = useRole();

  const [notifications, setNotifications] = useState<NotificationRecord[]>(INITIAL_NOTIFICATIONS);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(ALL_BLOCKS[0].id);
  const [selectedChannel, setSelectedChannel] = useState<'SMS' | 'WhatsApp'>('WhatsApp');
  const [recipientRole, setRecipientRole] = useState<UserRole>('bdo');
  const [recipientName, setRecipientName] = useState('BDO Tikamgarh');
  const [recipientPhone, setRecipientPhone] = useState('+91 98263 *****');
  const [dispatchSuccess, setDispatchSuccess] = useState<boolean>(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Client-side demonstration restriction only; not server-side authorization.
  const canDispatch = canMutateDemoWorkflows(activeRole);
  const restrictionNotice = demoRestrictionNotice(activeRole);
  const [dispatchError, setDispatchError] = useState<string | null>(null);


  // 1. Client-side Hydration from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ALERTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Replace any previously stored copies of the built-in fixture records with the
          // corrected simulated versions (older copies were labelled 'delivered').
          const fixtureById = new Map(INITIAL_NOTIFICATIONS.map(n => [n.id, n]));
          setNotifications(parsed.map((n: NotificationRecord) => fixtureById.get(n.id) ?? n));
        }
      }
    } catch (err) {
      console.warn('JalDrishti: Failed to load stored alert logs:', err);
    }
  }, []);

  // 2. Query Context Pre-selection from Map Explorer Link
  useEffect(() => {
    if (urlBlockParam) {
      const validBlock = ALL_BLOCKS.find(b => b.id === urlBlockParam);
      if (validBlock) {
        setSelectedBlockId(validBlock.id);
        setRecipientName(`BDO ${validBlock.name}`);
      }
    }
  }, [urlBlockParam]);

  // Safe localStorage saver helper
  const saveNotificationsToStorage = (updatedList: NotificationRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(updatedList));
      setStorageError(null);
    } catch (err) {
      console.error('JalDrishti: Browser storage error:', err);
      setStorageError('Warning: Browser storage quota exceeded or unavailable. Dispatch logged in UI but may not persist across reload.');
    }
  };

  const selectedBlock = ALL_BLOCKS.find(b => b.id === selectedBlockId) || ALL_BLOCKS[0];

  const { hindi: generatedHindiText, english: generatedEnglishText } = buildAdvisoryMessages(selectedBlock);
  const dispatchDecision = canDispatchAdvisory(selectedBlock);

  const handleDispatchNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDispatch) {
      setDispatchError('This demo role cannot create simulated advisories.');
      return;
    }
    if (!dispatchDecision.allowed) {
      setDispatchError(dispatchDecision.reason);
      return;
    }
    setDispatchError(null);
    const newNotif: NotificationRecord = {
      id: `notif_${Date.now()}`,
      recipientName: recipientName,
      recipientRole: recipientRole,
      recipientPhone: recipientPhone,
      districtName: selectedBlock.districtName,
      blockName: selectedBlock.name,
      severity: selectedBlock.riskSeverity,
      channel: selectedChannel,
      messageHindi: generatedHindiText,
      messageEnglish: generatedEnglishText,
      sentTimestamp: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString()} IST`,
      deliveryStatus: 'simulated',
      confidenceScore: 0.89,
      dataFreshnessDate: selectedBlock.indicators.lastUpdatedDate
    };

    const updatedList = [newNotif, ...notifications];
    setNotifications(updatedList);
    saveNotificationsToStorage(updatedList);
    setDispatchSuccess(true);
    setTimeout(() => setDispatchSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {storageError && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold flex items-center justify-between">
          <span>{storageError}</span>
          <button onClick={() => setStorageError(null)} className="text-amber-700 hover:text-amber-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* Header */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5 text-amber-600" /> {t('alerts.title')}
          </h1>
          <p className="text-xs text-text-muted mt-1">
            {t('alerts.subtitle')} No real SMS or WhatsApp message is sent. {NO_REAL_MESSAGE_NOTICE}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-subtle px-3 py-1.5 rounded border border-border">
          <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" />
          <span className="font-semibold text-text-main">Integration Mode:</span>
          <span className="text-text-muted">Simulated Adapter (Credentials Pending)</span>
        </div>
      </div>

      {/* Safe Wording Safeguard Banner */}
      <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-4 text-xs text-amber-900 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <ShieldCheckIcon className="w-4 h-4 text-amber-700" /> Simulation only — no real message is sent
        </div>
        <p className="leading-relaxed">
          {NO_REAL_MESSAGE_NOTICE} Every simulated advisory generated here includes this wording:
          <em> &ldquo;{ADVISORY_DISCLAIMER_EN}&rdquo;</em> Values quoted are demonstration fixture values, not verified groundwater measurements. The Hindi text has not been reviewed by a native Hindi reviewer. Demo dispatch is blocked for Normal-severity blocks.
        </p>
      </div>

      {restrictionNotice && (
        <div className="bg-subtle border border-border rounded-lg p-3 text-xs text-text-muted">
          {restrictionNotice}
        </div>
      )}

      {/* Main Grid: Alert Dispatch Simulator + History Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dispatch Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface border border-border rounded-lg p-5 shadow-card space-y-4">
            <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
              <SendIcon className="w-4 h-4 text-[#0d5c63]" /> Advisory Dispatch Simulator
            </h2>

            {dispatchSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-xs flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Simulated advisory added to the local demo log (this browser only). No message was sent.</span>
              </div>
            )}

            {dispatchError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded text-xs" role="alert">
                {dispatchError}
              </div>
            )}

            {!canDispatch && (
              <p className="text-xs text-text-muted">Simulated dispatch controls are not available for this demo role.</p>
            )}

            {canDispatch && (
            <form onSubmit={handleDispatchNotification} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-text-main">Target Block Geography:</label>
                <select
                  value={selectedBlockId}
                  onChange={(e) => setSelectedBlockId(e.target.value)}
                  className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                >
                  {ALL_BLOCKS.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.districtName}) — {b.riskSeverity.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-text-main">Recipient Role:</label>
                  <select
                    value={recipientRole}
                    onChange={(e) => setRecipientRole(e.target.value as UserRole)}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  >
                    <option value="district_collector">District Collector</option>
                    <option value="bdo">BDO</option>
                    <option value="gram_pradhan">Gram Pradhan</option>
                    <option value="jal_samiti">Jal Samiti</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-main">Channel:</label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value as 'SMS' | 'WhatsApp')}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  >
                    <option value="WhatsApp">WhatsApp Gateway</option>
                    <option value="SMS">NIC SMS Gateway</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-text-main">Recipient Name:</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-main">Phone Number:</label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  />
                </div>
              </div>

              {/* Generated Message Preview */}
              <div className="space-y-1.5 pt-2">
                <label className="font-semibold text-text-main">Hindi Advisory Message Preview:</label>
                <div className="p-3 bg-subtle/80 rounded border border-border text-xs text-text-main leading-relaxed font-sans">
                  {generatedHindiText}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-text-main">English Advisory Message Preview:</label>
                <div className="p-3 bg-subtle/80 rounded border border-border text-[11px] text-text-muted leading-relaxed">
                  {generatedEnglishText}
                </div>
              </div>

              {!dispatchDecision.allowed && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2">{dispatchDecision.reason}</p>
              )}

              <button
                type="submit"
                disabled={!dispatchDecision.allowed}
                className="w-full bg-[#0d5c63] hover:bg-[#094348] text-white font-semibold py-2.5 rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Simulated Advisory Record ({selectedChannel}) — nothing is sent
              </button>
            </form>
            )}
          </div>
        </div>

        {/* Right Column: Dispatch History & Audit Trail (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-surface border border-border rounded-lg p-5 shadow-card space-y-4">
            <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
              <UserRoleIcon className="w-4 h-4 text-[#0d5c63]" /> Dispatch History & Delivery Audit Log ({notifications.length})
            </h2>

            <div className="space-y-3">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-3.5 bg-subtle/40 rounded-lg border border-border space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text-main">{notif.recipientName}</span>
                      <span className="text-[11px] text-text-muted">({notif.recipientRole.toUpperCase()})</span>
                      <span className="bg-surface px-2 py-0.5 rounded border border-border text-[10px] font-mono text-[#0d5c63]">
                        {notif.channel}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted">{notif.sentTimestamp}</span>
                  </div>

                  <p className="text-text-main leading-snug bg-surface p-2 rounded border border-border text-[11px]">
                    {notif.messageHindi}
                  </p>

                  <div className="flex justify-between items-center text-[10px] text-text-muted pt-1">
                    <span>Target: {notif.blockName} ({notif.districtName})</span>
                    <span className="text-amber-800 font-semibold">Status: {displayDeliveryStatus()} (no real message sent)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-text-muted">Loading Advisory Engine...</div>}>
      <AlertsContent />
    </Suspense>
  );
}
