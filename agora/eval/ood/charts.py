"""Chart generation for Agora OOD eval reports."""
from __future__ import annotations
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


COLORS = {
    "blue": "#3182ce",
    "orange": "#dd6b20",
    "red": "#e53e3e",
    "green": "#38a169",
    "yellow": "#d69e2e",
    "gray": "#a0aec0",
}

_STYLE = "seaborn-v0_8-whitegrid"


def _apply_style():
    try:
        plt.style.use(_STYLE)
    except OSError:
        plt.style.use("ggplot")


def generate_eval_charts(
    result,
    output_dir,
    model_a_name: str = "Baseline",
    model_b_name: str = "Best Model",
    per_category_data=None,
) -> dict:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    drift_path = _generate_drift_curve(result, output_dir, model_b_name)
    category_path = _generate_category_breakdown(per_category_data, output_dir)

    return {
        "drift_curve": drift_path,
        "category_breakdown": category_path,
    }


def _generate_drift_curve(result, output_dir: Path, model_name: str) -> Path:
    _apply_style()
    fig, ax = plt.subplots(figsize=(10, 5), dpi=150)

    sets = result.per_set_results
    if not sets:
        ax.text(0.5, 0.5, "No temporal data available",
                ha="center", va="center", transform=ax.transAxes,
                fontsize=14, color=COLORS["gray"])
        ax.set_title("Model Accuracy Over Time (Post-Cutoff)", fontsize=14, fontweight="bold")
    else:
        x_labels = [s.set_name for s in sets]
        y_vals = [s.ood_accuracy * 100 for s in sets]

        ax.plot(x_labels, y_vals, color=COLORS["blue"], marker="o", linewidth=2.5,
                markersize=7, label=model_name)

        # Annotate big drops
        for i in range(1, len(y_vals)):
            drop = y_vals[i] - y_vals[i - 1]
            if drop < -10:
                ax.annotate(f"\u2212{abs(drop):.1f} pp",
                            xy=(x_labels[i], y_vals[i]),
                            xytext=(0, -20), textcoords="offset points",
                            ha="center", fontsize=9, color=COLORS["red"])

        ax.set_xlabel("Time Period (Post-Cutoff)", fontsize=11)
        ax.set_ylabel("Accuracy (%)", fontsize=11)
        ax.set_title("Model Accuracy Over Time (Post-Cutoff)", fontsize=14, fontweight="bold")
        ax.set_ylim(0, 105)
        ax.legend(loc="lower left")
        ax.tick_params(axis="x", rotation=30)

    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)

    plt.tight_layout()
    out_path = output_dir / "drift-curve.png"
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def _generate_category_breakdown(per_category_data, output_dir: Path) -> Path:
    _apply_style()
    fig, ax = plt.subplots(figsize=(10, 6), dpi=150)

    sample = False
    if not per_category_data:
        sample = True
        per_category_data = [
            {"category": "POLITICS (sample)", "train_acc": 0.85, "ood_acc": 0.68, "delta": -0.17},
            {"category": "TECH (sample)", "train_acc": 0.78, "ood_acc": 0.71, "delta": -0.07},
            {"category": "SPORTS (sample)", "train_acc": 0.90, "ood_acc": 0.88, "delta": -0.02},
            {"category": "ARTS (sample)", "train_acc": 0.76, "ood_acc": 0.75, "delta": -0.01},
        ]

    sorted_data = sorted(per_category_data, key=lambda x: x["delta"])
    categories = [d["category"] for d in sorted_data]
    deltas = [d["delta"] * 100 for d in sorted_data]

    bar_colors = []
    for d in deltas:
        if d < -10:
            bar_colors.append(COLORS["red"])
        elif d < -5:
            bar_colors.append(COLORS["orange"])
        elif d < 0:
            bar_colors.append(COLORS["yellow"])
        else:
            bar_colors.append(COLORS["green"])

    y_pos = range(len(categories))
    ax.barh(list(y_pos), deltas, color=bar_colors, height=0.6, edgecolor="white", linewidth=0.5)

    for i, (d, cat) in enumerate(zip(deltas, categories)):
        label = f"{d:+.1f} pp"
        x_offset = -0.5 if d < 0 else 0.5
        ax.text(d + x_offset, i, label, va="center", ha="right" if d < 0 else "left",
                fontsize=9, fontweight="bold")

    ax.set_yticks(list(y_pos))
    ax.set_yticklabels(categories, fontsize=10)
    ax.set_xlabel("Accuracy Delta (OOD vs. Train, pp)", fontsize=11)
    ax.set_title("Accuracy Drop by Category (OOD vs. Train)", fontsize=14, fontweight="bold")
    ax.axvline(x=0, color="black", linewidth=0.8, linestyle="--", alpha=0.5)

    legend_patches = [
        mpatches.Patch(color=COLORS["red"], label="> \u221210 pp (high drift)"),
        mpatches.Patch(color=COLORS["orange"], label="\u22125 to \u221210 pp (medium drift)"),
        mpatches.Patch(color=COLORS["yellow"], label="\u22121 to \u22125 pp (low drift)"),
        mpatches.Patch(color=COLORS["green"], label="\u2248 0 (stable)"),
    ]
    ax.legend(handles=legend_patches, loc="lower right", fontsize=9)

    if sample:
        ax.text(0.5, 0.5, "No per-category data available\n(sample data shown)",
                ha="center", va="center", transform=ax.transAxes,
                fontsize=11, color=COLORS["gray"], alpha=0.6)

    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)

    plt.tight_layout()
    out_path = output_dir / "category-breakdown.png"
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def generate_chart_captions(result, per_category_data=None) -> dict:
    sets = result.per_set_results

    # Drift curve caption
    if sets:
        first_acc = sets[0].ood_accuracy * 100
        last_acc = sets[-1].ood_accuracy * 100
        drop = last_acc - first_acc
        worst = min(sets, key=lambda s: s.ood_accuracy)
        drift_caption = (
            f"Accuracy drops from {first_acc:.1f}% ({sets[0].set_name}) to "
            f"{last_acc:.1f}% ({sets[-1].set_name}), a {abs(drop):.1f} pp decline. "
            f"Worst period: {worst.set_name} ({worst.ood_accuracy * 100:.1f}%)."
        )
    else:
        drift_caption = "No temporal data available for this eval run."

    # Category caption
    if per_category_data:
        worst_cat = min(per_category_data, key=lambda d: d["delta"])
        significant_drift = sum(1 for d in per_category_data if d["delta"] < -0.05)
        category_caption = (
            f"Worst category: {worst_cat['category']} "
            f"(\u2212{abs(worst_cat['delta']) * 100:.1f} pp). "
            f"{significant_drift} of {len(per_category_data)} categories show "
            f"significant drift (>5 pp)."
        )
    else:
        category_caption = "Per-category breakdown not available. Run eval with labeled category data."

    return {
        "drift_curve": drift_caption,
        "category_breakdown": category_caption,
    }
