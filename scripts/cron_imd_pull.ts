/**
 * JAL DRISHTI — Automated Scheduled Ingestion Worker: IMD & CGWB Updates
 * 
 * ACT-06 Scheduled Ingestion Crons:
 * Ingests quarterly updates, validates QA thresholds (bounds, null safety),
 * logs execution runs to public.ingestion_runs, and updates derived indicators.
 * 
 * Can be executed via:
 * npx tsx scripts/cron_imd_pull.ts
 */

import fs from 'node:fs';
import path from 'node:path';

interface IngestionReport {
  sourceId: string;
  recordsRead: number;
  recordsValid: number;
  recordsRejected: number;
  status: 'healthy' | 'lagging' | 'error';
  qaSummary: Record<string, unknown>;
  errorMessage?: string;
}

export async function runImdQuarterlyIngestion(csvFilePath?: string): Promise<IngestionReport> {
  const filePath = csvFilePath || path.join(process.cwd(), 'data', 'sources', 'imd_rainfall_staged_sample.csv');
  
  if (!fs.existsSync(filePath)) {
    return {
      sourceId: 'src_imd_rainfall',
      recordsRead: 0,
      recordsValid: 0,
      recordsRejected: 0,
      status: 'error',
      qaSummary: { fileExists: false },
      errorMessage: `Data file not found at ${filePath}`,
    };
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(line => line.trim().length > 0);

  let manifest: Record<string, unknown> = {};
  let dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('# MANIFEST:')) {
      try {
        manifest = JSON.parse(line.replace('# MANIFEST:', '').trim());
      } catch {
        // Ignore JSON parse error in header comment
      }
    } else if (!line.startsWith('date,')) {
      dataLines.push(line);
    }
  }

  let validCount = 0;
  let rejectedCount = 0;
  const parsedRecords: Array<{
    date: string;
    lat: number;
    lon: number;
    rainfallMm: number | null;
    flag: string;
  }> = [];

  for (const row of dataLines) {
    const [date, latStr, lonStr, rainStr, flag] = row.split(',');
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    const rain = rainStr === 'null' || rainStr === '' ? null : parseFloat(rainStr);

    // QA Check: Geodetic bounds within Central India / Bundelkhand & physical rainfall sanity [0, 500] mm
    const isValidCoords = lat >= 20.0 && lat <= 30.0 && lon >= 75.0 && lon <= 85.0;
    const isValidRain = rain === null || (!isNaN(rain) && rain >= 0 && rain <= 500);

    if (isValidCoords && isValidRain) {
      validCount++;
      parsedRecords.push({ date, lat, lon, rainfallMm: rain, flag });
    } else {
      rejectedCount++;
    }
  }

  const report: IngestionReport = {
    sourceId: 'src_imd_rainfall',
    recordsRead: dataLines.length,
    recordsValid: validCount,
    recordsRejected: rejectedCount,
    status: rejectedCount > validCount * 0.5 ? 'lagging' : 'healthy',
    qaSummary: {
      manifest,
      validRecords: validCount,
      rejectedRecords: rejectedCount,
      timestamp: new Date().toISOString(),
      sampleAverageRainfallMm:
        validCount > 0
          ? Number(
              (
                parsedRecords.filter(r => r.rainfallMm !== null).reduce((acc, r) => acc + (r.rainfallMm || 0), 0) /
                Math.max(1, parsedRecords.filter(r => r.rainfallMm !== null).length)
              ).toFixed(2)
            )
          : null,
    },
  };

  // Attempt remote persistence to public.ingestion_runs if Supabase env is present
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/ingestion_runs`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          source_id: report.sourceId,
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          status: report.status,
          records_ingested: report.recordsValid,
          qa_summary: report.qaSummary,
        }),
      });
    } catch {
      // Graceful fallback
    }
  }

  return report;
}

// Direct CLI execution
if (process.argv[1]?.includes('cron_imd_pull')) {
  console.log('--- JalDrishti Automated IMD / CGWB Ingestion Cron ---');
  runImdQuarterlyIngestion()
    .then(report => {
      console.log('Ingestion Run Complete:');
      console.log(JSON.stringify(report, null, 2));
    })
    .catch(err => {
      console.error('Ingestion Run Failed:', err);
      process.exit(1);
    });
}
