import numpy as np

class VibrationWindow:
    def __init__(self, signal: np.ndarray, sample_rate: float,
                 label: int, source: str, metadata: dict = None):
        """
        A common intermediate representation for vibration signals.
        
        Args:
            signal: 1D magnitude array
            sample_rate: Rate in Hz
            label: Integer label for the classification class
            source: "wav" or "json_sensor"
            metadata: Additional info
        """
        self.signal = signal
        self.sample_rate = sample_rate
        self.label = label
        self.source = source
        self.metadata = metadata or {}
