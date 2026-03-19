import os

from agora.eval.calibration.types import BinStats, CalibrationResult


def generate_reliability_diagram(
    calibration_result: CalibrationResult,
    output_path: str,
    width_px: int = 400,
    height_px: int = 400,
    embed_ece: bool = True,
    mini: bool = False,
) -> str:
    """
    Generate SVG reliability diagram for one vendor.

    Returns:
        output_path (for chaining)

    Raises:
        IOError: if output_path directory does not exist
    """
    parent_dir = os.path.dirname(output_path)
    if parent_dir and not os.path.isdir(parent_dir):
        raise IOError(f"Directory does not exist: {parent_dir}")

    elements = _build_svg_elements(
        bins=calibration_result.bins,
        canvas_width=width_px,
        canvas_height=height_px,
        embed_ece=embed_ece,
        ece_value=calibration_result.ece,
        mini=mini,
        vendor_id=calibration_result.vendor_id,
    )

    svg = (
        f'<svg viewBox="0 0 {width_px} {height_px}" '
        f'xmlns="http://www.w3.org/2000/svg">\n'
    )
    svg += "\n".join(elements)
    svg += "\n</svg>\n"

    with open(output_path, "w") as f:
        f.write(svg)

    return output_path


def _build_svg_elements(
    bins: list[BinStats],
    canvas_width: int,
    canvas_height: int,
    embed_ece: bool,
    ece_value: float,
    mini: bool,
    vendor_id: str = "",
) -> list[str]:
    """Build list of SVG element strings."""
    pad = 20 if mini else 40
    elements: list[str] = []

    # Background
    elements.append(
        f'  <rect x="0" y="0" width="{canvas_width}" height="{canvas_height}" '
        f'fill="white"/>'
    )

    # Perfect calibration diagonal
    x1 = _conf_to_x(0.0, pad, canvas_width)
    y1 = _acc_to_y(0.0, pad, canvas_height)
    x2 = _conf_to_x(1.0, pad, canvas_width)
    y2 = _acc_to_y(1.0, pad, canvas_height)
    elements.append(
        f'  <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
        f'stroke="#999" stroke-dasharray="4,4"/>'
    )

    # Collect non-empty bins for data points
    non_empty = [b for b in bins if b.count > 0]
    max_count = max((b.count for b in non_empty), default=1)

    # Gap shading rectangles
    for b in non_empty:
        cx = _conf_to_x(b.mean_conf, pad, canvas_width)
        acc_y = _acc_to_y(b.accuracy, pad, canvas_height)
        conf_y = _acc_to_y(b.mean_conf, pad, canvas_height)

        if abs(b.gap) < 1e-9:
            continue

        overconfident = b.mean_conf > b.accuracy
        color = _color_for_gap(b.gap, overconfident)

        top_y = min(acc_y, conf_y)
        rect_height = abs(acc_y - conf_y)
        bar_width = (canvas_width - 2 * pad) / len(bins)

        elements.append(
            f'  <rect x="{cx - bar_width / 2:.1f}" y="{top_y:.1f}" '
            f'width="{bar_width:.1f}" height="{rect_height:.1f}" '
            f'fill="{color}"/>'
        )

    # Data points and polyline
    points: list[str] = []
    for b in non_empty:
        cx = _conf_to_x(b.mean_conf, pad, canvas_width)
        cy = _acc_to_y(b.accuracy, pad, canvas_height)
        points.append(f"{cx:.1f},{cy:.1f}")
        r = _point_size_for_count(b.count, max_count)
        elements.append(
            f'  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" '
            f'fill="#1a1a2e" stroke="white" stroke-width="1.5"/>'
        )

    if len(points) >= 2:
        elements.append(
            f'  <polyline points="{" ".join(points)}" '
            f'fill="none" stroke="#1a1a2e" stroke-width="2"/>'
        )

    # Axes
    ax_x1 = _conf_to_x(0.0, pad, canvas_width)
    ax_x2 = _conf_to_x(1.0, pad, canvas_width)
    ax_y_bottom = _acc_to_y(0.0, pad, canvas_height)
    ax_y_top = _acc_to_y(1.0, pad, canvas_height)

    elements.append(
        f'  <line x1="{ax_x1:.1f}" y1="{ax_y_bottom:.1f}" '
        f'x2="{ax_x2:.1f}" y2="{ax_y_bottom:.1f}" stroke="black" stroke-width="1"/>'
    )
    elements.append(
        f'  <line x1="{ax_x1:.1f}" y1="{ax_y_bottom:.1f}" '
        f'x2="{ax_x1:.1f}" y2="{ax_y_top:.1f}" stroke="black" stroke-width="1"/>'
    )

    # Tick labels
    if not mini:
        for tick in [0.0, 0.25, 0.5, 0.75, 1.0]:
            tx = _conf_to_x(tick, pad, canvas_width)
            ty = _acc_to_y(tick, pad, canvas_height)
            # X-axis ticks
            elements.append(
                f'  <text x="{tx:.1f}" y="{ax_y_bottom + 15:.1f}" '
                f'text-anchor="middle" font-size="10">{tick:.2f}</text>'
            )
            # Y-axis ticks
            elements.append(
                f'  <text x="{ax_x1 - 5:.1f}" y="{ty + 3:.1f}" '
                f'text-anchor="end" font-size="10">{tick:.2f}</text>'
            )

    # ECE annotation
    if embed_ece:
        elements.append(
            f'  <text x="{canvas_width - 10}" y="{canvas_height - 10}" '
            f'text-anchor="end" font-size="11">ECE: {ece_value:.3f}</text>'
        )

    # Title
    if not mini:
        elements.append(
            f'  <text x="{canvas_width / 2}" y="16" '
            f'text-anchor="middle" font-size="13">'
            f'{vendor_id} — Reliability Diagram</text>'
        )

    # Axis labels
    if not mini:
        elements.append(
            f'  <text x="{canvas_width / 2}" y="{canvas_height - 5}" '
            f'text-anchor="middle" font-size="11">Confidence</text>'
        )
        elements.append(
            f'  <text x="12" y="{canvas_height / 2}" '
            f'text-anchor="middle" font-size="11" '
            f'transform="rotate(-90, 12, {canvas_height / 2})">Accuracy</text>'
        )

    return elements


def _point_size_for_count(count: int, max_count: int) -> float:
    """Scale point radius proportional to bin population. min=3, max=12."""
    if max_count <= 0:
        return 3.0
    ratio = count / max_count
    return 3.0 + ratio * 9.0


def _color_for_gap(gap: float, overconfident: bool) -> str:
    """
    Return fill color for calibration gap shading.
    overconfident → red, underconfident → blue.
    Opacity scales with gap magnitude: min 0.1, max 0.6.
    """
    opacity = min(0.6, max(0.1, gap))
    if overconfident:
        return f"rgba(220,50,50,{opacity:.2f})"
    else:
        return f"rgba(50,100,220,{opacity:.2f})"


def _conf_to_x(conf: float, pad: int, width: int) -> float:
    """Map confidence [0,1] to SVG x coordinate within padded canvas."""
    return pad + conf * (width - 2 * pad)


def _acc_to_y(acc: float, pad: int, height: int) -> float:
    """Map accuracy [0,1] to SVG y coordinate (SVG y-axis is inverted)."""
    return (height - pad) - acc * (height - 2 * pad)


def reliability_diagram_path(
    vendor_id: str,
    task_category: str,
    eval_date: str,
    base_dir: str = "agora-data/vendors",
) -> str:
    """
    Returns: agora-data/vendors/{vendor_id}/calibration/{task_category}/reliability-{eval_date}.svg
    """
    return f"{base_dir}/{vendor_id}/calibration/{task_category}/reliability-{eval_date}.svg"
