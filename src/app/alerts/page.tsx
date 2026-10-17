'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const { activeRole } = useRole();

  const [notifications, setNotifications] = useState<NotificationRecord[]>(INITIAL_NOTIFICATIONS);
  const [blocksData, setBlocksData] = useState<any[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedChannel, setSelectedChannel] = useState<'SMS' | 'WhatsApp'>('WhatsApp');
  const [recipientRole, setRecipientRole] = useState<UserRole>('bdo');
  const [recipientName, setRecipientName] = useState('BDO Tikamgarh');
  const [recipientPhone, setRecipientPhone] = useState('+91 98263 *****');
  const [dispatchSuccess, setDispatchSuccess] = useState<boolean>(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Client-side demonstration restriction only; not server-side authorization.
  const canDispatch = canMutateDemoWorkflows(activeRole);
  const restrictionNotice = demoRestrictionNotice(activeRole, t);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // 1. Client-side Hydration from localStorage & blocks API
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const res = await fetch('/api/geospatial/blocks');
        if (res.ok && active) {
          const json = await res.json();
          if (Array.isArray(json.blocks) && json.blocks.length > 0) {
            setBlocksData(json.blocks);
            if (urlBlockParam && json.blocks.some((b: any) => b.id === urlBlockParam)) {
              setSelectedBlockId(urlBlockParam);
            } else {
              setSelectedBlockId(json.blocks[0].id);
            }
          }
        }
      } catch (err) {
        console.warn('JalDrishti: Failed to load blocks for alerts:', err);
      } finally {
        if (active) setIsLoading(false);
      }

      try {
        const saved = localStorage.getItem(STORAGE_KEY_ALERTS);
        if (saved && active) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const fixtureById = new Map(INITIAL_NOTIFICATIONS.map(n => [n.id, n]));
            setNotifications(parsed.map((n: NotificationRecord) => fixtureById.get(n.id) ?? n));
          }
        }
      } catch (err) {
        console.warn('JalDrishti: Failed to load stored alert logs:', err);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [urlBlockParam]);

  // 2. Query Context Pre-selection from Map Explorer Link
  useEffect(() => {
    if (urlBlockParam && blocksData.length > 0) {
      const validBlock = blocksData.find(b => b.id === urlBlockParam);
      if (validBlock) {
        setSelectedBlockId(validBlock.id);
        setRecipientName(`BDO ${validBlock.name}`);
      }
    }
  }, [urlBlockParam, blocksData]);

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

  const selectedBlock = blocksData.find(b => b.id === selectedBlockId) || blocksData[0] || null;

  const { hindi: generatedHindiText, english: generatedEnglishText } = selectedBlock
    ? buildAdvisoryMessages(selectedBlock)
    : { hindi: 'डेटा लोड हो रहा है...', english: 'Loading verified block indicators...' };
  const dispatchDecision = selectedBlock ? canDispatchAdvisory(selectedBlock, t) : { allowed: false, reason: 'Block data unavailable' };

  const handleDispatchNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDispatch) {
      setDispatchError(t('demo.cannotMutate', 'This demo role cannot create simulated advisories.'));
      return;
    }
    if (!dispatchDecision.allowed) {
      setDispatchError(dispatchDecision.reason);
      return;
    }
    setDispatchError(null);

    let finalStatus: 'delivered' | 'simulated' | 'pending' | 'failed' = 'simulated';

    // Dispatch via DLT Gateway endpoint
    try {
      const res = await fetch('/api/alerts/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-jaldrishti-role': activeRole,
          'x-jaldrishti-district': selectedBlock.districtName,
        },
        body: JSON.stringify({
          recipientPhone,
          recipientName,
          recipientRole,
          messageText: generatedHindiText,
          language: 'hi',
          blockName: selectedBlock.name,
          districtName: selectedBlock.districtName,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.deliveryStatus) finalStatus = d.deliveryStatus;
      }
    } catch {
      // Fallback to simulated
    }

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
      deliveryStatus: finalStatus,
      confidenceScore: null,
      dataFreshnessDate: selectedBlock.indicators.lastUpdatedDate
    };

    const updatedList = [newNotif, ...notifications];
    setNotifications(updatedList);
    saveNotificationsToStorage(updatedList);

    // Audit log dispatch
    try {
      fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-jaldrishti-role': activeRole,
          'x-jaldrishti-district': selectedBlock.districtName,
        },
        body: JSON.stringify({
          actorRole: activeRole,
          action: 'dispatch_advisory_alert',
          resourceTarget: `alert:${newNotif.id}`,
          outcome: 'success',
          details: {
            recipientRole,
            blockName: selectedBlock.name,
            districtName: selectedBlock.districtName,
            channel: selectedChannel,
            status: finalStatus,
          },
        }),
      }).catch(() => {});
    } catch {}

    setDispatchSuccess(true);
    setTimeout(() => setDispatchSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {storageError && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded text-xs font-semibold flex items-center justify-between">
          <span>{storageError}</span>
          <button onClick={() => setStorageError(null)} className="text-amber-700 hover:text-amber-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* Header - Open Editorial Layout */}
      <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted mb-2">
            <span className="font-semibold text-text-main">
              Advisory Dispatch Gateway*
            </span>
            <span aria-hidden="true">•</span>
            <span>Simulated Advisory Delivery Protocol</span>
            <span aria-hidden="true">•</span>
            <span>DLT Template Compliance (Demonstration)</span>
          </div>
          <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap">
            <AlertTriangleIcon className="w-6 h-6 text-primary" /> {t('alerts.title')}*
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1.5 leading-relaxed">
            {t('alerts.subtitle')} No real SMS or WhatsApp message is sent.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <ShieldCheckIcon className="w-4 h-4 text-primary" />
          <span>Dispatch Protocols Configured</span>
        </div>
      </div>

      {/* Safe Wording Safeguard Banner */}
      <div className="bg-amber-50/80 border-l-4 border-l-amber-600 border border-amber-200 p-4 text-xs text-amber-900 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <ShieldCheckIcon className="w-4 h-4 text-amber-700" /> {t('alerts.simulationOnlyHeader', 'Simulation only — no real message is sent')}
        </div>
        <p className="leading-relaxed">
          {t('alerts.safeguardBannerText', 'Every simulated advisory generated here includes explicit disclaimer wording. Values quoted are demonstration fixture values, not verified groundwater measurements. Demo dispatch is blocked for Normal-severity blocks.')}
        </p>
      </div>

      {restrictionNotice && (
        <div className="bg-subtle border border-border p-3 text-xs text-text-muted">
          {restrictionNotice}
        </div>
      )}

      {/* Main Grid: Alert Dispatch Simulator + History Log (Open Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Dispatch Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-text-main flex items-center gap-2 pb-2 border-b border-border">
              <SendIcon className="w-4 h-4 text-primary" /> {t('alerts.dispatchSimulator', 'Advisory Dispatch Simulator')}
            </h2>

            {dispatchSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{t('alerts.simulatedSuccess', 'Simulated advisory added to the local demo log (this browser only). No message was sent.')}</span>
              </div>
            )}

            {dispatchError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs" role="alert">
                {dispatchError}
              </div>
            )}

            {!canDispatch && (
              <p className="text-xs text-text-muted">{t('alerts.roleDisabled', 'Simulated dispatch controls are not available for this demo role.')}</p>
            )}

            {canDispatch && (
            <form onSubmit={handleDispatchNotification} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-text-main">{t('alerts.targetGeography', 'Target Block Geography')}:</label>
                {isLoading ? (
                  <div className="h-8 bg-subtle animate-pulse"></div>
                ) : (
                  <select
                    value={selectedBlockId}
                    onChange={(e) => setSelectedBlockId(e.target.value)}
                    className="w-full bg-subtle border border-border p-2 text-text-main focus:outline-none"
                  >
                    {blocksData.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.districtName}) — {t(`severity.${b.riskSeverity}`, b.riskSeverity).toUpperCase()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-text-main">{t('alerts.recipientRole', 'Recipient Role:')}</label>
                  <select
                    value={recipientRole}
                    onChange={(e) => setRecipientRole(e.target.value as UserRole)}
                    className="w-full bg-subtle border border-border p-2 text-text-main focus:outline-none"
                  >
                    <option value="district_collector">{t('role.district_collector', 'District Collector')}</option>
                    <option value="bdo">{t('role.bdo', 'BDO')}</option>
                    <option value="gram_pradhan">{t('role.gram_pradhan', 'Gram Pradhan')}</option>
                    <option value="jal_samiti">{t('role.jal_samiti', 'Jal Samiti')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-main">{t('alerts.selectChannel', 'Advisory Channel:')}</label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value as 'SMS' | 'WhatsApp')}
                    className="w-full bg-subtle border border-border p-2 text-text-main focus:outline-none"
                  >
                    <option value="WhatsApp">{t('alerts.whatsappGatewayLabel', 'WhatsApp Gateway')}</option>
                    <option value="SMS">{t('alerts.smsGateway', 'NIC SMS Gateway')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-text-main">{t('alerts.recipientName', 'Recipient Officer Name:')}</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full bg-subtle border border-border p-2 text-text-main focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-main">{t('alerts.recipientPhone', 'Recipient Phone Number:')}</label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full bg-subtle border border-border p-2 text-text-main focus:outline-none"
                  />
                </div>
              </div>

              {/* Generated Message Preview */}
              <div className="space-y-1.5 pt-2">
                <label className="font-semibold text-text-main">{t('alerts.hindiPreview', 'Hindi Advisory Message Preview:')}</label>
                <div className="p-3 bg-subtle/50 border border-border text-xs text-text-main leading-relaxed font-sans">
                  {generatedHindiText}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-text-main">{t('alerts.englishPreview', 'English Advisory Message Preview:')}</label>
                <div className="p-3 bg-subtle/50 border border-border text-[11px] text-text-muted leading-relaxed">
                  {generatedEnglishText}
                </div>
              </div>

              {!dispatchDecision.allowed && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 p-2">{dispatchDecision.reason}</p>
              )}

              <button
                type="submit"
                disabled={!dispatchDecision.allowed}
                className="w-full bg-primary hover:bg-primary-hover text-text-inverted font-semibold py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {t('alerts.createRecordBtn', 'Create Simulated Advisory Record')} ({selectedChannel === 'SMS' ? t('alerts.smsGateway', 'NIC SMS Gateway') : t('alerts.whatsappGatewayLabel', 'WhatsApp Gateway')}) — {t('alerts.nothingSent', 'nothing is sent')}
              </button>
            </form>
            )}
          </div>
        </div>

        {/* Right Column: Dispatch History & Audit Trail (Divided List, Unboxed) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-text-main flex items-center gap-2 pb-2 border-b border-border">
              <UserRoleIcon className="w-4 h-4 text-primary" /> {t('alerts.dispatchLogTitle', 'Dispatch History & Delivery Audit Log')} ({notifications.length})
            </h2>

            <div className="divide-y divide-border border-y border-border">
              {notifications.map((notif) => (
                <div key={notif.id} className="py-3.5 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text-main">
                        {t(`alerts.recipient.${notif.id === 'notif_001' ? 'collector' : notif.id === 'notif_002' ? 'bdo' : 'jalsamiti'}`, notif.recipientName)}
                      </span>
                      <span className="text-[11px] text-text-muted">({t(`role.${notif.recipientRole}`, notif.recipientRole.toUpperCase())})</span>
                      <span className="text-[11px] font-mono font-medium text-primary">
                        • {notif.channel}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">
                      {notif.sentTimestamp.replace('(simulated log entry)', t('alerts.simulatedLogNotice', '(simulated log entry)'))}
                    </span>
                  </div>

                  <p className="text-text-main leading-snug p-2.5 bg-subtle/40 border border-border text-xs">
                    {language === 'hi' ? notif.messageHindi : notif.messageEnglish}
                  </p>

                  <div className="flex justify-between items-center text-[11px] text-text-muted pt-0.5">
                    <span>{t('alerts.targetLabel', 'Target')}: {notif.blockName} ({notif.districtName})</span>
                    <span className="text-amber-800 font-semibold">{t('alerts.statusLabel', 'Status')}: {t(`status.${notif.deliveryStatus}`, 'SIMULATED')} ({t('alerts.noRealSent', 'no real message sent')})</span>
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
