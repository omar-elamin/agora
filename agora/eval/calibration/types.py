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
    ece: Optional[float]
    mce: Optional[float]
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
class TrustScoreIDResult:
    """New trust_score_id result on [0, 1] scale."""
    trust_score_id: float
    trust_label: str
    ece_norm: float
    mce_norm: float
    brier_norm: float
    fds_norm: float
    flags: list[str] = field(default_factory=list)


@dataclass
class BrierDecomposition:
    """Murphy (1973) decomposition of the Brier Score."""
    uncertainty: float
    resolution: float
    reliability: float
    brier_score: float


@dataclass
class ReliabilityBin:
    """Single bin entry for reliability diagram data."""
    bin: int
    conf_range: list[float]
    mean_conf: float
    accuracy: float
    count: int


@dataclass
class MetricsNormalized:
    """Normalized metric components for trust_score_id."""
    ece_norm: float
    mce_norm: float
    brier_norm: float
    fds_norm: float


@dataclass
class CalibrationReportV2:
    """V2 calibration report matching the new JSON schema."""
    vendor_id: str
    task_category: str
    eval_date: str
    n_examples: int
    n_correct: int
    accuracy: float
    ece: Optional[float]
    ece_adaptive: Optional[float]
    mce: Optional[float]
    mce_bin_index: Optional[int]
    brier: Optional[float]
    fds: Optional[float]
    metrics_normalized: Optional[MetricsNormalized]
    trust_score_id: Optional[float]
    trust_label: str
    brier_decomposition: Optional[BrierDecomposition] = None
    flags: list[str] = field(default_factory=list)
    reliability_diagram: list[ReliabilityBin] = field(default_factory=list)


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
