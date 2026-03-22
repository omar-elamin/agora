# PRS Use-Case Weight Profiles

The Production Readiness Score (PRS) combines four dimensions into a single 0–100 score. **Weight profiles** let you shift the emphasis of each dimension to match your deployment context.

## Profiles

| Profile | `trust` | `drift` | `cii` | `auroc` | Best for |
|---|---|---|---|---|---|
| `default` | 0.30 | 0.25 | 0.25 | 0.20 | General-purpose deployments |
| `high_stakes` | 0.40 | 0.25 | 0.25 | 0.10 | Medical, legal, financial — calibration quality matters most |
| `commodity` | 0.25 | 0.30 | 0.20 | 0.25 | High-throughput classification at scale |
| `multi_domain` | 0.25 | 0.35 | 0.20 | 0.20 | Multilingual, cross-domain, international deployments |

### default — General (Default)

Balanced weighting across all four dimensions. Use when no single dimension dominates your risk model.

### high_stakes — High-Stakes

Prioritizes baseline calibration quality (`trust: 0.40`) and confidence integrity. OOD detection AUROC is down-weighted because in high-stakes settings you rely on calibration rather than automated OOD rejection.

### commodity — Commodity & Volume

Emphasizes drift stability (`drift: 0.30`) and OOD detection (`auroc: 0.25`). When processing high volumes, catching distribution shift early is more valuable than marginal calibration gains.

### multi_domain — Multi-Domain & Global

Heaviest weighting on drift stability (`drift: 0.35`). Cross-domain and multilingual deployments see the most distribution shift, so stability under shift is the primary concern.

## Usage

Pass `use_case_profile` in the eval API request body. If omitted, `default` is used.

### Example requests

**Default (omitted):**

```json
{
  "audio_url": "https://example.com/audio.wav",
  "ground_truth": "hello world",
  "vendors": ["deepgram", "whisper-large-v3"]
}
```

**High-Stakes:**

```json
{
  "audio_url": "https://example.com/audio.wav",
  "ground_truth": "hello world",
  "vendors": ["deepgram"],
  "use_case_profile": "high_stakes"
}
```

**Commodity:**

```json
{
  "audio_url": "https://example.com/audio.wav",
  "ground_truth": "hello world",
  "vendors": ["deepgram", "whisper-large-v3"],
  "use_case_profile": "commodity"
}
```

**Multi-Domain:**

```json
{
  "audio_url": "https://example.com/audio.wav",
  "ground_truth": "hello world",
  "vendors": ["deepgram"],
  "use_case_profile": "multi_domain"
}
```

## Response

The PRS result now includes:

- `use_case_profile` — the profile that was applied
- `weights_applied` — the exact `{ trust, drift, cii, auroc }` weights used
- `buyer_display.profile_label` — human-readable profile name for the frontend

## Trust floor

The soft cap at PRS 70 when `trust_score_id < 0.60` applies in **all profiles** regardless of weight configuration. This is a safety invariant — no weight profile can override it.
