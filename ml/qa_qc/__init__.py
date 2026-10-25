"""CGWB High-Frequency Groundwater QA/QC Validation Package.

Adheres to:
Central Ground Water Board (CGWB), Ministry of Jal Shakti,
Guidelines on Validation, Integration, Use, and Reporting of High-Frequency
Groundwater Data (Water Level and Quality), February 2026.
"""

from .validator import (
    CgwbValidationStatus,
    ImputationStrategyFlag,
    ValidationResult,
    StationQcProfile,
    validate_station_series,
    validate_single_record,
)

__all__ = [
    "CgwbValidationStatus",
    "ImputationStrategyFlag",
    "ValidationResult",
    "StationQcProfile",
    "validate_station_series",
    "validate_single_record",
]
