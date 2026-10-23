"""Turn the existing sampled balance probe into a short readable QA report."""
import json
from pathlib import Path
p=Path(__file__).resolve().parents[1]
data=json.loads((p/'BALANCE-REPORT.json').read_text())
order=['trade','expand','navy','hybrid']
lines=['# Tidewater Phase 7 — Strategy Balance Probe','',
 'Rule-level tournament over **%s simulated matches** (%s per mode) using four simple strategic agents.'%(data['runsPerMode']*3,data['runsPerMode']),
 'Each agent usually submits **one action plus Hold**, not a full two-order competitive strategy. This is deliberately a **rough diagnostic**, not human balance testing.',
 '', '| Mode | Trade wins | Expansion wins | Navy wins | Hybrid wins | Mean finish |',
 '|---|---:|---:|---:|---:|---:|']
for mode,v in data['modes'].items():
    lines.append(f"| {mode.title()} | {v['winCredits']['trade']}% | {v['winCredits']['expand']}% | {v['winCredits']['navy']}% | {v['winCredits']['hybrid']}% | Round {v['meanRound']} |")
lines+=['','## Mean Renown at the end','', '| Mode | Trade | Expansion | Navy | Hybrid |', '|---|---:|---:|---:|---:|']
for mode,v in data['modes'].items():
    lines.append('| '+mode.title()+' | '+' | '.join(str(v['meanRenown'][s]) for s in order)+' |')
lines+=['','## Interpretation and risks','',
 '- **Navy-only tactics did not systematically dominate** these matches; expansion and mixed strategies usually performed well.',
 '- **Low average Renown merits attention.** In these limited scripted matches, most voyages reach the final-round limit rather than the stated 10/15-Renown charter threshold. Contracts are rarely achieved by simple bots.',
 '- **Quick and Standard have different incentive patterns.** Trading gained more wins in Quick while economic expansion gained more in Standard.',
 '- **Advanced has extra scoring pressure** because uncompleted contracts deduct Renown. Its particularly low synthetic average does not prove human matches behave the same.',
 '- This tournament does not model player negotiation, contract targeting, changing tactics, or intelligent use of both action slots; it cannot establish human fairness or relative captain power.',
 '- For those reasons Phase 7 **does not change the published costs, victory thresholds or other game-bible rules**. Human multiplayer playtests should collect duration, action mix, contract completions, battle frequency and leader advantage before any rebalance.',
 '', '## How to reproduce','', 'Run `npm run balance` for a fresh stochastic sample; or `node tools/balance_tournament.js 320` for a 960-match sample.',
 'The source data is in `BALANCE-REPORT.json`. Because boards, dice and Weather are random, output varies between runs.',
 '']
(p/'BALANCE-REPORT.md').write_text('\n'.join(lines))
print('Wrote balance report')
