# @riddle/suite-credits

Shared economy constants, client ledger, tier helpers, and React hooks for the Riddle suite credit pool.

## Economy truth

**100 credits = $1 USD** (1 cr = $0.01). `USD_PER_CREDIT = 0.01`.

## Usage

```ts
import { USD_PER_CREDIT, productCredits, resolveFeeBps } from '@riddle/suite-credits';
import { getBalance, spend, grant, setPlan } from '@riddle/suite-credits';
import { useSuiteCredits, useSuiteTier } from '@riddle/suite-credits';

const cost = productCredits('image'); // 100 cr = $1
const fee = resolveFeeBps({ tier: 'gold', product: 'swap' }); // 10 bps

function Widget() {
  const { balance, spend, grant } = useSuiteCredits();
  const { tier } = useSuiteTier();
  return <button onClick={() => spend(100)}>Generate ({balance} cr)</button>;
}
```

## SSR safety

All `window`/`document`/`localStorage` access is guarded. Hooks and ledger functions return safe defaults during server rendering.
