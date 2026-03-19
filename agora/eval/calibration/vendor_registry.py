"""
Vendor configuration registry for the calibration pipeline.

Loads per-vendor confidence format metadata from vendor_configs.yaml so that
normalize_predictions() can skip fragile auto-detection for known vendors.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

from agora.eval.calibration.normalize import ConfidenceFormat


@dataclass
class VendorConfig:
    """Configuration for a single vendor's confidence output."""
    vendor_id: str
    confidence_format: ConfidenceFormat
    confidence_key_path: Optional[str] = None
    score_range: Optional[list[float]] = None
    quirks: dict[str, str] = field(default_factory=dict)


_DEFAULT_CONFIG_PATH = Path(__file__).parent / "vendor_configs.yaml"

# Module-level cache so we only read the file once per process.
_registry_cache: Optional[dict[str, VendorConfig]] = None


def load_vendor_registry(
    config_path: Optional[Path] = None,
) -> dict[str, VendorConfig]:
    """
    Read vendor_configs.yaml and return a dict mapping vendor_id -> VendorConfig.
    """
    path = config_path or _DEFAULT_CONFIG_PATH
    with open(path) as f:
        raw = yaml.safe_load(f)

    registry: dict[str, VendorConfig] = {}
    for vendor_id, cfg in raw.items():
        registry[vendor_id] = VendorConfig(
            vendor_id=vendor_id,
            confidence_format=ConfidenceFormat(cfg["confidence_format"]),
            confidence_key_path=cfg.get("confidence_key_path"),
            score_range=cfg.get("score_range"),
            quirks=cfg.get("quirks", {}),
        )
    return registry


def get_vendor_config(
    vendor_id: str,
    config_path: Optional[Path] = None,
) -> Optional[VendorConfig]:
    """
    Look up a vendor in the registry. Returns None if the vendor_id is unknown.
    """
    global _registry_cache

    if _registry_cache is None or config_path is not None:
        registry = load_vendor_registry(config_path)
        if config_path is None:
            _registry_cache = registry
    else:
        registry = _registry_cache

    return registry.get(vendor_id)


def reset_registry_cache() -> None:
    """Clear the module-level cache (useful for tests)."""
    global _registry_cache
    _registry_cache = None
