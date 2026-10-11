/**
 * Read-only CGWB/NWIC Madhya Pradesh manual-quarterly adapter.
 *
 * This module parses and validates a bounded CSV preview only. It does not
 * connect to Supabase or write source records. Administrative mappings must be
 * supplied by an approved LGD crosswalk; names are never guessed.
 */

export const CGWB_MP_MANUAL_QUARTERLY_URL =
  'https://nwdp.nwic.gov.in/dataset/956add67-cba9-41a5-9d5c-96d73db44aef/resource/6a47df3a-8c42-419c-b577-b9c6ded71112/download/gwl_manual_quarterly_cgwb_mp_2021_2025.csv';

export const CGWB_MP_SOURCE_ID = 'src_cgwb_wells';

export interface CgwbCrosswalkEntry {
  districtLgdCode: string;
  sourceBlock: string;
  applicationUnitId: string;
}

export interface CgwbStationRecord {
  sourceRowNumber: number;
  stationId: string;
  stationName: string;
  agency: string;
  districtLgdCode: string;
  districtName: string;
  blockName: string;
  applicationUnitId: string;
  latitude: number;
  longitude: number;
  observationDate: string;
  waterLevelMbgl: number | null;
  sourceQualityFlag: string | null;
  sourceId: typeof CGWB_MP_SOURCE_ID;
  sourceResourceUrl: string;
}

export interface CgwbImportPreview {
  sourceId: typeof CGWB_MP_SOURCE_ID;
  sourceResourceUrl: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  accepted: CgwbStationRecord[];
  rejectionReasons: Record<string, number>;
  districtCounts: Record<string, number>;
  earliestObservationDate: string | null;
  latestObservationDate: string | null;
}

const REQUIRED_COLUMNS = [
  'Station',
  'Agency',
  'District LGD Code',
  'District',
  'Block',
  'Latitude',
  'Longitude',
  'Data Acquisition Time',
  'Groundwater Level Quarterly Manual (meter)'
] as const;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseDate(value: string): string | null {
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+\d{2}:\d{2}$/);
  if (!m) return null;
  const candidate = `${m[3]}-${m[2]}-${m[1]}`;
  const date = new Date(`${candidate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== candidate ? null : candidate;
}

function finiteCoordinate(value: string, min: number, max: number): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function reason(reasons: Record<string, number>, key: string): void {
  reasons[key] = (reasons[key] ?? 0) + 1;
}

export function buildCgwbImportPreview(
  csv: string,
  crosswalk: readonly CgwbCrosswalkEntry[],
  sourceResourceUrl: string = CGWB_MP_MANUAL_QUARTERLY_URL
): CgwbImportPreview {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim().length > 0);
  const headers = lines.length > 0 ? parseCsvLine(lines[0]) : [];
  const index = new Map(headers.map((h, i) => [h, i]));
  const reasons: Record<string, number> = {};
  for (const column of REQUIRED_COLUMNS) {
    if (!index.has(column)) reason(reasons, `missing_column:${column}`);
  }
  if (Object.keys(reasons).length > 0) {
    return { sourceId: CGWB_MP_SOURCE_ID, sourceResourceUrl, totalRows: Math.max(0, lines.length - 1), acceptedRows: 0, rejectedRows: Math.max(0, lines.length - 1), accepted: [], rejectionReasons: reasons, districtCounts: {}, earliestObservationDate: null, latestObservationDate: null };
  }

  const accepted: CgwbStationRecord[] = [];
  const seen = new Set<string>();
  const districtCounts: Record<string, number> = {};
  const dates: string[] = [];
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const cells = parseCsvLine(lines[rowIndex]);
    const get = (column: string) => cells[index.get(column) ?? -1] ?? '';
    const stationId = get('Station');
    const districtLgdCode = get('District LGD Code');
    const districtName = get('District');
    const blockName = get('Block');
    const date = parseDate(get('Data Acquisition Time'));
    const lat = finiteCoordinate(get('Latitude'), -90, 90);
    const lng = finiteCoordinate(get('Longitude'), -180, 180);
    const levelRaw = get('Groundwater Level Quarterly Manual (meter)');
    const level = levelRaw === '' ? null : Number(levelRaw);
    const mapping = crosswalk.find(entry => entry.districtLgdCode === districtLgdCode && entry.sourceBlock === blockName);
    if (!stationId || !districtLgdCode || !districtName || !blockName || blockName === '-' || !date) reason(reasons, !date ? 'invalid_date' : 'missing_identity');
    else if (lat === null || lng === null) reason(reasons, 'invalid_coordinates');
    else if (levelRaw !== '' && (!Number.isFinite(level) || (level as number) < -2 || (level as number) > 300)) reason(reasons, 'invalid_water_level');
    else if (!mapping) reason(reasons, 'missing_approved_crosswalk');
    else {
      const key = `${stationId}::${date}`;
      if (seen.has(key)) reason(reasons, 'duplicate_station_date');
      else {
        seen.add(key);
        const record: CgwbStationRecord = {
          sourceRowNumber: rowIndex + 1,
          stationId,
          stationName: stationId,
          agency: get('Agency'),
          districtLgdCode,
          districtName,
          blockName,
          applicationUnitId: mapping.applicationUnitId,
          latitude: lat,
          longitude: lng,
          observationDate: date,
          waterLevelMbgl: levelRaw === '' ? null : level as number,
          sourceQualityFlag: null,
          sourceId: CGWB_MP_SOURCE_ID,
          sourceResourceUrl
        };
        accepted.push(record);
        districtCounts[districtName] = (districtCounts[districtName] ?? 0) + 1;
        dates.push(date);
      }
    }
  }
  dates.sort();
  return { sourceId: CGWB_MP_SOURCE_ID, sourceResourceUrl, totalRows: lines.length - 1, acceptedRows: accepted.length, rejectedRows: lines.length - 1 - accepted.length, accepted, rejectionReasons: reasons, districtCounts, earliestObservationDate: dates[0] ?? null, latestObservationDate: dates.at(-1) ?? null };
}
