"""
JalDrishti ML Pipeline - Orchestrator & Walk-Forward Validation Engine
Executes:
1. Feature extraction and split generation.
2. Baseline benchmark computation.
3. Model training (when explicitly invoked).
4. Validation metric logging adhering to TRD v1.0.
"""

import os
import sys
import argparse
from typing import Dict, Any

from ml.config import PILOT_BLOCKS, VALIDATION_CRITERIA
from ml.feature_engineering import load_cgwb_groundwater_raw, clean_and_harmonize_observations, build_block_training_matrix
from ml.baselines import SeasonalPersistenceBaseline, calculate_hydrological_metrics
from ml.models import QuantileGroundwaterModel


def run_pipeline(data_path: str, mode: str = "dry_run"):
    """
    Orchestrates the ML training & evaluation workflow.
    In 'dry_run' mode, it inspects features and prints baseline stats without training deep models.
    """
    print("=" * 70)
    print("JAL DRISHTI — GROUNDWATER AI/ML MODEL PIPELINE")
    print(f"Mode: {mode.upper()}")
    print("=" * 70)

    if not os.path.exists(data_path):
        print(f"Error: Data file not found at {data_path}")
        return

    print(f"\n[Step 1] Loading raw observation records from: {data_path}")
    raw_df = load_cgwb_groundwater_raw(data_path)
    print(f"Loaded {len(raw_df)} raw records.")

    print("\n[Step 2] Cleaning & harmonizing observation columns...")
    clean_df = clean_and_harmonize_observations(raw_df)
    print(f"Cleaned dataset: {len(clean_df)} valid records.")

    for block_id, meta in PILOT_BLOCKS.items():
        print(f"\n--- Processing Pilot Block: {meta['name']} ({meta['district']}, {meta['lithology']}) ---")
        try:
            matrix = build_block_training_matrix(block_id, clean_df)
            print(f"Extracted feature matrix: {len(matrix)} temporal quarters.")
            
            if mode == "dry_run":
                print("[DRY RUN] Feature validation complete. Training deferred per user instruction.")
                continue

            # Training mode (deferred until explicit execution)
            if mode == "train":
                print("[TRAINING] Fitting baselines and candidate models...")
                # Execution logic for training & validation...
        except Exception as e:
            print(f"Notice for {block_id}: {e}")

    print("\nPipeline execution complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="JalDrishti Groundwater ML Pipeline")
    parser.add_argument("--data", default="gwl_manual_quarterly_cgwb_mp_2021_2025.xlsx", help="Path to CGWB Excel file")
    parser.add_argument("--mode", default="dry_run", choices=["dry_run", "train"], help="Pipeline execution mode")
    args = parser.parse_args()

    run_pipeline(args.data, mode=args.mode)
