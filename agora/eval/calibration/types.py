from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PredictionRecord:
    """
    Single prediction from a vendor on one eval example.
    The atomic unit flowing through the entire calibration pipeline.
    """
    example_id: str
    vendor_id: str
    predicted_label: str
    ground_truth_label: str
    confidence: float
    full_probs: Optional[dict[str, float]]
    task_category: str
    eval_date: str
    model_version: Optional[str] = None
    confidence_available: bool = True


@dataclass
class BinStats:
    """Stats for one confidence bin."""
    bin_index: int
    lower: float
    upper: float
    count: int
    mean_conf: float
    accuracy: float
    gap: float


@dataclass
class CalibrationResult:
    """Full calibration result for one vendor on one task category."""
    vendor_id: str
    task_category: str
    eval_date: str
    n_total: int
    n_bins: int
    bins: list[BinStats]
    ece: float
    mce: float
    brier_score: Optional[float] = None
    label: str = ""
    label_color: str = ""


@dataclass
class FDSResult:
    """Failure Detectability Score result for one vendor."""
    vendor_id: str
    task_category: str
    eval_date: str
    n_errors: int
    n_detectable: int
    n_high_conf_errors: int
    n_invisible: int
    fds_overall: float
    fds_high_confidence: float
    invisible_failure_rate: float
    probe_details: dict[str, int]
    vendors_in_comparison: list[str]
    high_conf_threshold: float = 0.85
    fds_by_category: dict[str, float] = field(default_factory=dict)


@dataclass
class TrustScoreResult:
    """Composite Trust Score (0-100) for one vendor."""
    vendor_id: str
    task_category: str
    eval_date: str
    accuracy: float
    ece: float
    fds_overall: float
    invisible_failure_rate: float
    trust_score: float
    component_breakdown: dict[str, float]
    label: str = ""


@dataclass
class VendorCalibrationReport:
    """Complete calibration report for one vendor. Written to storage."""
    vendor_id: str
    task_category: str
    eval_date: str
    calibration: CalibrationResult
    fds: Optional[FDSResult]
    trust_score: Optional[TrustScoreResult]
    reliability_diagram_path: Optional[str]
    metadata: dict = field(default_factory=dict)
