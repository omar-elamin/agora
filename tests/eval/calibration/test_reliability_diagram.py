import os
import tempfile
import xml.etree.ElementTree as ET

import pytest

from agora.eval.calibration.reliability_diagram import (
    generate_reliability_diagram,
    reliability_diagram_path,
    _point_size_for_count,
    _color_for_gap,
)
from agora.eval.calibration.types import BinStats, CalibrationResult


def _make_calibration_result(n_bins=10) -> CalibrationResult:
    bins = []
    for i in range(n_bins):
        lower = i / n_bins
        upper = (i + 1) / n_bins
        count = (i + 1) * 5
        mean_conf = (lower + upper) / 2
        # Simulate slight overconfidence
        accuracy = max(0.0, mean_conf - 0.05 * (i / n_bins))
        gap = abs(accuracy - mean_conf)
        bins.append(BinStats(
            bin_index=i, lower=lower, upper=upper,
            count=count, mean_conf=mean_conf, accuracy=accuracy, gap=gap,
        ))
    return CalibrationResult(
        vendor_id="test_vendor",
        task_category="classification",
        eval_date="2026-03-19",
        n_total=sum(b.count for b in bins),
        n_bins=n_bins,
        bins=bins,
        ece=0.042,
        mce=0.098,
        label="Well-calibrated",
        label_color="green",
    )


class TestGenerateReliabilityDiagram:
    def test_generates_valid_svg(self):
        """Output file is parseable SVG XML."""
        cal = _make_calibration_result()
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "test.svg")
            result = generate_reliability_diagram(cal, path)
            assert result == path
            assert os.path.exists(path)
            # Should be valid XML
            tree = ET.parse(path)
            root = tree.getroot()
            assert root.tag.endswith("svg")

    def test_mini_mode_no_labels(self):
        """mini=True -> no axis label elements like 'Confidence' or 'Accuracy'."""
        cal = _make_calibration_result()
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "mini.svg")
            generate_reliability_diagram(cal, path, mini=True)
            with open(path) as f:
                content = f.read()
            assert "Confidence" not in content
            assert "Accuracy" not in content
            assert "Reliability Diagram" not in content

    def test_full_mode_has_labels(self):
        cal = _make_calibration_result()
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "full.svg")
            generate_reliability_diagram(cal, path, mini=False)
            with open(path) as f:
                content = f.read()
            assert "Confidence" in content
            assert "Accuracy" in content
            assert "Reliability Diagram" in content

    def test_ece_annotation(self):
        cal = _make_calibration_result()
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "ece.svg")
            generate_reliability_diagram(cal, path, embed_ece=True)
            with open(path) as f:
                content = f.read()
            assert "ECE: 0.042" in content

    def test_no_ece_annotation(self):
        cal = _make_calibration_result()
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "no_ece.svg")
            generate_reliability_diagram(cal, path, embed_ece=False)
            with open(path) as f:
                content = f.read()
            assert "ECE:" not in content

    def test_invalid_directory_raises(self):
        cal = _make_calibration_result()
        with pytest.raises(IOError):
            generate_reliability_diagram(cal, "/nonexistent/dir/test.svg")


class TestPointSizes:
    def test_point_sizes_scale_with_count(self):
        """Larger bins get larger circles."""
        small = _point_size_for_count(1, 100)
        large = _point_size_for_count(100, 100)
        assert small < large
        assert small >= 3.0
        assert large <= 12.0

    def test_max_count_zero(self):
        assert _point_size_for_count(0, 0) == 3.0


class TestColorForGap:
    def test_overconfident_bins_red(self):
        """Bins where mean_conf > accuracy get red fill."""
        color = _color_for_gap(0.3, overconfident=True)
        assert "220,50,50" in color

    def test_underconfident_bins_blue(self):
        color = _color_for_gap(0.3, overconfident=False)
        assert "50,100,220" in color

    def test_opacity_clamped(self):
        color = _color_for_gap(0.01, overconfident=True)
        assert "0.10" in color
        color = _color_for_gap(0.9, overconfident=True)
        assert "0.60" in color


class TestReliabilityDiagramPath:
    def test_default_path(self):
        path = reliability_diagram_path("assemblyai", "language_id", "2026-03-19")
        assert path == "agora-data/vendors/assemblyai/calibration/language_id/reliability-2026-03-19.svg"
