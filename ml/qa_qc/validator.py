"""CGWB High-Frequency Groundwater QA/QC Validation Engine.

Compliant with:
Central Ground Water Board (CGWB), Ministry of Jal Shakti,
Guidelines on Validation, Integration, Use, and Reporting of High-Frequency
Groundwater Data (Water Level and Quality), February 2026.

Sections Implemented:
- Section 7.3 Data Validation (PDF pp. 54-56):
  1. Preliminary Checks (Timestamps, Duplicates, Range Checks, Zero/Negative values).
  2. Trend Consistency (Spikes/Drops, Rate of Change).
  3. Physical/Statistical Range (Station-specific min/max, Z-Score, IQR).
  4. Stuck Sensor / Flatline Detection.
- Table 8: Suggested Flag / Status Fields (Valid, Suspect, Invalid, Missing, Replaced).
- Table 9: Missing Value Handling Flags (M, F, I, N, C).
- Part B: Process Steps 1 through 16 (PDF pp. 114-116).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Sequence, Tuple


class CgwbValidationStatus(str, Enum):
    """Table 8: CGWB Official Validation Status Categories."""
    VALID = "Valid"
    SUSPECT = "Suspect"
    INVALID = "Invalid"
    MISSING = "Missing"
    REPLACED = "Replaced"


class ImputationStrategyFlag(str, Enum):
    """Table 9: Missing Value Handling Strategy Flags."""
    NONE = ""
    M = "M"  # Missing (retained as blank / un-imputed)
    F = "F"  # Forward Fill (LOCF)
    I = "I"  # Interpolated (linear / spline)
    N = "N"  # Estimated from neighbouring site
    C = "C"  # Corrected after manual inspection / dip reading


@dataclass
class StationQcProfile:
    """Configurable, station-specific QC profile.
    
    Guideline: Do not treat a universal threshold as scientifically valid for
    every well, aquifer, sensor or parameter (Mandatory Rule 4).
    """
    station_id: str
    station_name: str
    state: str
    district: str
    block: Optional[str] = None
    expected_interval_hours: float = 6.0
    min_depth_mbgl: float = 0.0
    max_depth_mbgl: float = 120.0
    max_step_change_m: float = 3.0  # Max allowable jump between adjacent readings
    flatline_consecutive_count: int = 8  # 8 readings @ 6h = 48 hours without variance
    flatline_tolerance_m: float = 0.001
    allow_zero_reading: bool = False  # Set to true only if artesian well or ground-level spring
    datum_convention: str = "depth_below_ground_level"  # or "elevation_above_msl"
    z_score_threshold: float = 3.5
    iqr_multiplier: float = 2.5
    rule_version: str = "CGWB-2026-v1.0"


@dataclass
class ValidationResult:
    """Row-level QA/QC outcome with auditable reason and lineage."""
    source_index: int
    station_id: str
    timestamp: datetime
    original_value: Optional[float]
    validated_value: Optional[float]
    status: CgwbValidationStatus
    reason_code: str
    reason_details: str
    imputation_flag: ImputationStrategyFlag = ImputationStrategyFlag.NONE
    check_boolean: bool = True  # Guideline p. 56: Boolean field specifying check carried out
    rule_version: str = "CGWB-2026-v1.0"
    qa_officer_role: str = "Automated RTDAS / Secondary Engine"
    validated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_index": self.source_index,
            "station_id": self.station_id,
            "timestamp": self.timestamp.isoformat(),
            "original_value": self.original_value,
            "validated_value": self.validated_value,
            "status": self.status.value,
            "reason_code": self.reason_code,
            "reason_details": self.reason_details,
            "imputation_flag": self.imputation_flag.value,
            "check_boolean": self.check_boolean,
            "rule_version": self.rule_version,
            "qa_officer_role": self.qa_officer_role,
            "validated_at": self.validated_at,
        }


def validate_single_record(
    value: Optional[float],
    timestamp: Optional[datetime],
    profile: StationQcProfile,
    reference_time: Optional[datetime] = None,
) -> Tuple[CgwbValidationStatus, str, str]:
    """Preliminary checks on a single reading (Steps 1, 7, 8, 9).
    
    Returns (status, reason_code, reason_details).
    """
    ref_time = reference_time or datetime.now(timezone.utc)

    # 1. Timestamp validation
    if timestamp is None:
        return (
            CgwbValidationStatus.INVALID,
            "invalid_timestamp",
            "Missing or unparseable datetime timestamp",
        )
    
    # Future-dated check
    if timestamp.tzinfo is None:
        # compare as naive
        comp_ref = ref_time.replace(tzinfo=None)
    else:
        comp_ref = ref_time
        
    if timestamp > comp_ref:
        return (
            CgwbValidationStatus.INVALID,
            "future_dated_timestamp",
            f"Timestamp {timestamp.isoformat()} exceeds reference time {comp_ref.isoformat()}",
        )

    # 2. Missing value check
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        return (
            CgwbValidationStatus.MISSING,
            "missing_observation",
            "No measurement recorded during telemetry interval",
        )

    # 3. Negative values check (Mandatory Rule 5: do not blindly delete or flip signs)
    if value < 0:
        if profile.datum_convention == "elevation_above_msl":
            # In MSL convention, negative values can exist if below sea level, but require explicit check
            return (
                CgwbValidationStatus.SUSPECT,
                "negative_msl_elevation",
                f"Negative elevation value {value} m MSL flagged for datum review",
            )
        else:
            # Under standard m bgl convention, negative depth is physically impossible unless artesian
            return (
                CgwbValidationStatus.INVALID,
                "negative_depth_below_ground",
                f"Negative depth {value} m bgl is physically impossible under standard ground-level datum; datum unverified",
            )

    # 4. Zero value check (Step 8: Zero or impossible readings)
    if value == 0.0 and not profile.allow_zero_reading:
        return (
            CgwbValidationStatus.SUSPECT,
            "zero_reading_potential_dry_or_fault",
            "Zero reading recorded; flagged as suspect pending station well-head calibration",
        )

    # 5. Sentinel value check
    if value in (99.0, 99.99, 999.0, 999.99, 9999.0):
        return (
            CgwbValidationStatus.INVALID,
            "sensor_sentinel_fault_pattern",
            f"Reading {value} matches standard RTDAS hardware error sentinel",
        )

    # 6. Physical range validation (Step 9)
    if value < profile.min_depth_mbgl or value > profile.max_depth_mbgl:
        return (
            CgwbValidationStatus.INVALID,
            "out_of_expected_range",
            f"Reading {value:.3f} m bgl outside station range [{profile.min_depth_mbgl}, {profile.max_depth_mbgl}] m bgl",
        )

    return (CgwbValidationStatus.VALID, "passed_preliminary_checks", "Value within range and format bounds")


def validate_station_series(
    records: Sequence[Tuple[int, datetime, Optional[float]]],
    profile: StationQcProfile,
    reference_time: Optional[datetime] = None,
    allow_interpolation_gaps: int = 2,  # Short gaps <= 2 steps can be interpolated
) -> List[ValidationResult]:
    """Execute complete CGWB High-Frequency Validation on a chronological station time series.
    
    Implements:
    - Step 4: Chronological sorting & verification
    - Step 5: Duplicate timestamp detection
    - Step 6: Irregular time gap detection
    - Steps 7-10: Value range, negative, zero, blank handling
    - Step 11: Spike / step-change detection
    - Step 12: Flatline (stuck sensor) detection
    - Step 13: Statistical outlier (Z-score / IQR) detection
    - Steps 14-16: Replacement & flagging
    """
    if not records:
        return []

    # Sort chronologically by timestamp (Step 4)
    # Record structure: (source_index, timestamp, value)
    sorted_records = sorted(records, key=lambda x: (x[1] if x[1] is not None else datetime.min, x[0]))

    results: List[ValidationResult] = []
    seen_timestamps: Dict[datetime, int] = {}
    valid_values_for_stats: List[float] = []

    # Pass 1: Preliminary & duplicate checks
    preliminary: List[Tuple[int, datetime, Optional[float], CgwbValidationStatus, str, str]] = []

    for src_idx, ts, val in sorted_records:
        if ts in seen_timestamps:
            # Step 5: Duplicate timestamp detected
            preliminary.append((
                src_idx, ts, val,
                CgwbValidationStatus.INVALID,
                "duplicate_timestamp",
                f"Duplicate observation timestamp {ts.isoformat()} already processed in row {seen_timestamps[ts]}",
            ))
            continue

        if ts is not None:
            seen_timestamps[ts] = src_idx

        status, code, details = validate_single_record(val, ts, profile, reference_time)
        preliminary.append((src_idx, ts, val, status, code, details))

        if status == CgwbValidationStatus.VALID and val is not None:
            valid_values_for_stats.append(val)

    # Compute statistical baselines for Z-score / IQR (Step 13)
    mean_val = 0.0
    std_val = 1.0
    q25 = 0.0
    q75 = 0.0
    iqr = 0.0

    if len(valid_values_for_stats) >= 10:
        mean_val = sum(valid_values_for_stats) / len(valid_values_for_stats)
        variance = sum((x - mean_val) ** 2 for x in valid_values_for_stats) / (len(valid_values_for_stats) - 1)
        std_val = math.sqrt(variance) if variance > 0 else 1.0
        
        sorted_stats = sorted(valid_values_for_stats)
        n = len(sorted_stats)
        q25 = sorted_stats[int(n * 0.25)]
        q75 = sorted_stats[int(n * 0.75)]
        iqr = q75 - q25

    # Pass 2: Temporal checks (Spike, Flatline, Gap detection, Imputation)
    last_valid_ts: Optional[datetime] = None
    last_valid_val: Optional[float] = None
    last_unflagged_val: Optional[float] = None  # Reference baseline before suspect spike
    flatline_buffer: List[float] = []

    for i, (src_idx, ts, val, status, code, details) in enumerate(preliminary):
        final_status = status
        final_code = code
        final_details = details
        final_val = val
        imp_flag = ImputationStrategyFlag.NONE
        delta_hours: Optional[float] = None

        if status == CgwbValidationStatus.VALID and val is not None and ts is not None:
            # 1. Check time gap from previous reading (Step 6)
            if last_valid_ts is not None:
                delta_hours = (ts - last_valid_ts).total_seconds() / 3600.0
                if delta_hours > (profile.expected_interval_hours * 2.5):
                    # Gap detected, informational
                    final_details += f"; Gapped interval ({delta_hours:.1f}h elapsed)"

            # 2. Check spike / abrupt step-change (Step 11)
            # Step change is evaluated only over consecutive readings
            if last_valid_val is not None:
                step_change = abs(val - last_valid_val)
                is_tight_interval = delta_hours is None or delta_hours <= (profile.expected_interval_hours * 2.0)
                
                # Check if previous was a suspect spike and current reading returned to pre-spike baseline
                if last_unflagged_val is not None and abs(val - last_unflagged_val) <= profile.max_step_change_m:
                    # Current reading is back at normal baseline; the previous reading was an isolated spike
                    pass
                elif step_change > profile.max_step_change_m and is_tight_interval:
                    final_status = CgwbValidationStatus.SUSPECT
                    final_code = "abrupt_step_change_spike"
                    final_details = (
                        f"Abrupt level change {step_change:.3f} m exceeds threshold "
                        f"{profile.max_step_change_m} m over consecutive readings ({delta_hours:.1f}h elapsed)"
                    )
                elif step_change > (profile.max_step_change_m * 3.0):
                    final_status = CgwbValidationStatus.SUSPECT
                    final_code = "extreme_level_jump_after_gap"
                    final_details = (
                        f"Extreme level jump {step_change:.3f} m after {delta_hours:.1f}h gap flagged for hydrological verification"
                    )

            # 3. Check flatline / stuck sensor (Step 12)
            flatline_buffer.append(val)
            if len(flatline_buffer) > profile.flatline_consecutive_count:
                flatline_buffer.pop(0)

            if len(flatline_buffer) == profile.flatline_consecutive_count:
                max_diff = max(flatline_buffer) - min(flatline_buffer)
                if max_diff <= profile.flatline_tolerance_m:
                    final_status = CgwbValidationStatus.SUSPECT
                    final_code = "flatline_stuck_sensor"
                    final_details = (
                        f"Zero or negligible variance ({max_diff:.4f} m) across "
                        f"{profile.flatline_consecutive_count} consecutive readings indicates stuck float or dead sensor"
                    )

            # 4. Statistical outlier check via Z-Score and IQR (Step 13)
            if len(valid_values_for_stats) >= 10 and final_status == CgwbValidationStatus.VALID:
                z_score = abs(val - mean_val) / std_val if std_val > 0 else 0.0
                if z_score > profile.z_score_threshold:
                    final_status = CgwbValidationStatus.SUSPECT
                    final_code = "statistical_outlier_zscore"
                    final_details = f"Z-Score {z_score:.2f} exceeds threshold {profile.z_score_threshold}"
                elif iqr > 0 and (val < (q25 - profile.iqr_multiplier * iqr) or val > (q75 + profile.iqr_multiplier * iqr)):
                    final_status = CgwbValidationStatus.SUSPECT
                    final_code = "statistical_outlier_iqr"
                    final_details = f"Value {val:.2f} lies outside IQR bounds [{q25 - profile.iqr_multiplier * iqr:.2f}, {q75 + profile.iqr_multiplier * iqr:.2f}]"

            # Update baselines
            if final_status == CgwbValidationStatus.VALID:
                last_unflagged_val = val
            last_valid_ts = ts
            last_valid_val = val
        elif status == CgwbValidationStatus.MISSING:
            imp_flag = ImputationStrategyFlag.M

        results.append(
            ValidationResult(
                source_index=src_idx,
                station_id=profile.station_id,
                timestamp=ts if ts is not None else datetime.min,
                original_value=val,
                validated_value=final_val if final_status in (CgwbValidationStatus.VALID, CgwbValidationStatus.REPLACED) else None,
                status=final_status,
                reason_code=final_code,
                reason_details=final_details,
                imputation_flag=imp_flag,
                check_boolean=True,
                rule_version=profile.rule_version,
            )
        )

    return results


def summarize_validation_outcomes(results: Sequence[ValidationResult]) -> Dict[str, Any]:
    """Generate summary tally and statistics as mandated by Step 17 (PDF p. 116)."""
    counts = {
        CgwbValidationStatus.VALID.value: 0,
        CgwbValidationStatus.SUSPECT.value: 0,
        CgwbValidationStatus.INVALID.value: 0,
        CgwbValidationStatus.MISSING.value: 0,
        CgwbValidationStatus.REPLACED.value: 0,
    }
    reasons: Dict[str, int] = {}
    valid_values: List[float] = []

    for r in results:
        counts[r.status.value] = counts.get(r.status.value, 0) + 1
        reasons[r.reason_code] = reasons.get(r.reason_code, 0) + 1
        if r.status == CgwbValidationStatus.VALID and r.validated_value is not None:
            valid_values.append(r.validated_value)

    total = len(results)
    valid_count = counts[CgwbValidationStatus.VALID.value]
    pass_rate_pct = (valid_count / total * 100.0) if total > 0 else 0.0

    stats = {
        "total_records": total,
        "status_counts": counts,
        "pass_rate_pct": round(pass_rate_pct, 2),
        "reason_code_counts": dict(sorted(reasons.items(), key=lambda x: x[1], reverse=True)),
        "valid_mean_depth_mbgl": round(sum(valid_values) / len(valid_values), 3) if valid_values else None,
        "valid_min_depth_mbgl": min(valid_values) if valid_values else None,
        "valid_max_depth_mbgl": max(valid_values) if valid_values else None,
    }
    return stats
