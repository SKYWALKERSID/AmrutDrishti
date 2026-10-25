'use client';

import { useEffect, useState } from 'react';
import { fetchHistoricalObservations, type HistoricalObservation } from '@/lib/services/historicalObservationService';
import { useLanguage } from '@/lib/context/LanguageContext';

interface HistoricalObservationsPanelProps {
  enabled?: boolean;
  district?: string;
  block?: string;
}

/** Opt-in historical UI. It is intentionally not mounted by production pages yet. */
export default function HistoricalObservationsPanel({ enabled = false, district, block }: HistoricalObservationsPanelProps) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<HistoricalObservation[]>([]);
  const [state, setState] = useState<'disabled' | 'loading' | 'ready' | 'empty' | 'error'>(enabled ? 'loading' : 'disabled');

  useEffect(() => {
    if (!enabled) { setState('disabled'); return; }
    let active = true;
    setState('loading');
    fetchHistoricalObservations({ district, block, limit: 50 })
      .then(result => { if (active) { setRows(result.observations); setState(result.observations.length ? 'ready' : 'empty'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [enabled, district, block]);

  if (state === 'disabled') return null;
  if (state === 'loading') return <p className="text-sm text-text-muted">{t('historical.loading', 'Loading historical observations…')}</p>;
  if (state === 'error') return <p className="text-sm text-red-700">{t('historical.unavailable', 'Historical observations are unavailable.')}</p>;
  if (state === 'empty') return <p className="text-sm text-text-muted">{t('historical.empty', 'No approved historical observations are available.')}</p>;

  return (
    <section aria-label="Historical groundwater observations" className="space-y-3">
      <div className="text-xs text-text-muted">{t('historical.banner', 'CGWB/NWIC historical observations. Dates are original observation dates; values are not live readings.')}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">{t('historical.station', 'Station')}</th>
              <th className="text-left">{t('historical.date', 'Date')}</th>
              <th className="text-left">{t('historical.level', 'Level')}</th>
              <th className="text-left">{t('historical.source', 'Source')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={`${row.station_id}-${row.observation_date}`}>
                <td>{row.station_name}</td>
                <td>{row.observation_date}</td>
                <td>{row.water_level_mbgl === null ? t('historical.noMeasurement', 'No measurement') : `${row.water_level_mbgl} ${row.unit}`}</td>
                <td>{row.source_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
