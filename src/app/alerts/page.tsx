'use client';

import React, { useState } from 'react';
import { ALL_BLOCKS } from '@/lib/data/bundelkhand';
import { INITIAL_NOTIFICATIONS } from '@/lib/data/alerts';
import { NotificationRecord, UserRole } from '@/lib/types';
import { AlertTriangleIcon, SendIcon, ShieldCheckIcon, CheckCircleIcon, UserRoleIcon } from '@/components/ui/Icons';

export default function AlertsPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>(INITIAL_NOTIFICATIONS);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(ALL_BLOCKS[0].id);
  const [selectedChannel, setSelectedChannel] = useState<'SMS' | 'WhatsApp'>('WhatsApp');
  const [recipientRole, setRecipientRole] = useState<UserRole>('bdo');
  const [recipientName, setRecipientName] = useState('BDO Tikamgarh');
  const [recipientPhone, setRecipientPhone] = useState('+91 98263 *****');
  const [dispatchSuccess, setDispatchSuccess] = useState<boolean>(false);

  const selectedBlock = ALL_BLOCKS.find(b => b.id === selectedBlockId) || ALL_BLOCKS[0];

  const generatedHindiText = `जलदृष्टि सतर्कता: ${selectedBlock.name} (${selectedBlock.districtName}) में भूजल स्तर ${selectedBlock.indicators.cgwbWellDepthMbgl}m bgl तक गिर गया है। वर्षा घाटा ${selectedBlock.indicators.rainfallAnomalyMm}mm दर्ज हुआ है। जल समिति एवं ग्राम पंचायत जल प्रबंधन समीक्षा करें। (सूचना स्रोत: CGWB / IMD / NASA GRACE | निर्णय-सहायता चेतावनी: भौतिक सत्यापन आवश्यक)`;

  const generatedEnglishText = `JalDrishti Advisory: High groundwater stress in ${selectedBlock.name} block (${selectedBlock.districtName}). Well depth reached ${selectedBlock.indicators.cgwbWellDepthMbgl}m bgl with ${selectedBlock.indicators.rainfallAnomalyMm}mm rainfall deficit. Ground verification recommended. (Source: CGWB/IMD/GRACE)`;

  const handleDispatchNotification = (e: React.FormEvent) => {
    e.preventDefault();
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

    setNotifications([newNotif, ...notifications]);
    setDispatchSuccess(true);
    setTimeout(() => setDispatchSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5 text-amber-600" /> Hindi-First Advisory & Alert Engine
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Bilingual decision-support alerts for District Collectors, BDOs, and Gram Samitis with deduplication & safe wording.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-subtle px-3 py-1.5 rounded border border-border">
          <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" />
          <span className="font-semibold text-text-main">Integration Mode:</span>
          <span className="text-text-muted">Simulated Adapter (Credentials Pending)</span>
        </div>
      </div>

      {/* Safe Wording Safeguard Banner */}
      <div className="bg-subtle/80 border border-border rounded-lg p-4 text-xs text-text-muted space-y-1">
        <div className="font-bold text-text-main flex items-center gap-1.5">
          <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" /> Mandatory Safe Wording Policy (FR-056)
        </div>
        <p className="leading-relaxed">
          Every alert dispatched by JalDrishti explicitly states its observational source timestamp and includes the mandatory suffix:
          <em> &ldquo;Decisional Advisory: Requires Local Field Verification. Not an Automated Financial Sanction.&rdquo;</em>
        </p>
      </div>

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
                <span>Advisory successfully simulated & appended to audit log.</span>
              </div>
            )}

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

              <button
                type="submit"
                className="w-full bg-[#0d5c63] hover:bg-[#094348] text-white font-semibold py-2.5 rounded-md transition-colors shadow-sm"
              >
                Dispatch Test Advisory ({selectedChannel})
              </button>
            </form>
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
                    <span className="text-emerald-700 font-semibold">Status: {notif.deliveryStatus.toUpperCase()}</span>
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
