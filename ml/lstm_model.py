"""
JalDrishti ML Pipeline - Sequence Model Architecture (LSTM / GRU)
PyTorch definitions for sequence-to-sequence groundwater depth forecasting.
Ready for training when invoked; does not execute upon import.
"""

from typing import Tuple, Optional

try:
    import torch
    import torch.nn as nn
except ImportError:
    # Fallback dummy class if PyTorch is not yet installed in local environment
    class nn:
        Module = object

class GroundwaterLSTM(nn.Module):
    """
    Multi-layer Recurrent Neural Network with Dropout and Bidirectional options.
    Models multi-year aquifer recharge inertia and seasonal drawdowns.
    """
    def __init__(
        self,
        input_dim: int = 8,
        hidden_dim: int = 64,
        num_layers: int = 2,
        output_dim: int = 3, # Outputs 3 horizons (h=1, h=2, h=4)
        dropout: float = 0.2
    ):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, output_dim)
        )

    def forward(self, x):
        # x shape: (batch_size, sequence_length, input_dim)
        lstm_out, _ = self.lstm(x)
        # Take the output of the final time step
        last_step_out = lstm_out[:, -1, :]
        out = self.fc(last_step_out)
        return out
