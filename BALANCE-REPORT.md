# Tidewater Phase 7 — Strategy Balance Probe

Rule-level tournament over **960 simulated matches** (320 per mode) using four simple strategic agents.
Each agent usually submits **one action plus Hold**, not a full two-order competitive strategy. This is deliberately a **rough diagnostic**, not human balance testing.

| Mode | Trade wins | Expansion wins | Navy wins | Hybrid wins | Mean finish |
|---|---:|---:|---:|---:|---:|
| Quick | 30.6% | 19.1% | 18% | 32.3% | Round 8 |
| Standard | 11.3% | 34.7% | 16.3% | 37.8% | Round 12 |
| Advanced | 14.5% | 31.9% | 24.1% | 29.5% | Round 12 |

## Mean Renown at the end

| Mode | Trade | Expansion | Navy | Hybrid |
|---|---:|---:|---:|---:|
| Quick | 2.17 | 2.22 | 2.08 | 2.55 |
| Standard | 2.19 | 3.15 | 2.72 | 3.34 |
| Advanced | 0.48 | 1.59 | 1.37 | 1.39 |

## Interpretation and risks

- **Navy-only tactics did not systematically dominate** these matches; expansion and mixed strategies usually performed well.
- **Low average Renown merits attention.** In these limited scripted matches, most voyages reach the final-round limit rather than the stated 10/15-Renown charter threshold. Contracts are rarely achieved by simple bots.
- **Quick and Standard have different incentive patterns.** Trading gained more wins in Quick while economic expansion gained more in Standard.
- **Advanced has extra scoring pressure** because uncompleted contracts deduct Renown. Its particularly low synthetic average does not prove human matches behave the same.
- This tournament does not model player negotiation, contract targeting, changing tactics, or intelligent use of both action slots; it cannot establish human fairness or relative captain power.
- For those reasons Phase 7 **does not change the published costs, victory thresholds or other game-bible rules**. Human multiplayer playtests should collect duration, action mix, contract completions, battle frequency and leader advantage before any rebalance.

## How to reproduce

Run `npm run balance` for a fresh stochastic sample; or `node tools/balance_tournament.js 320` for a 960-match sample.
The source data is in `BALANCE-REPORT.json`. Because boards, dice and Weather are random, output varies between runs.
