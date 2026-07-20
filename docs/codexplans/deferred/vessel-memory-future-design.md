# Future Design: Storage Vessel Memory

Status: Deferred future design. No vessel-memory gameplay is implemented; the design remains intentionally outside the current gameplay scope.

## Idea

Porous vessels can retain a small imprint of previous contents. A later fill may receive a diminishing influence from that imprint. This models the real-world carryover associated with seasoned wine, port, sherry, or spirit casks without copying a previous batch into the new wine.

The mechanic should be treated as a vessel imprint, not a fixed universal 10% transfer. Absorption and release vary with material, vessel size, contact time, temperature, alcohol, cleaning, and the compounds involved. Oak is the strongest candidate; steel should have almost no material memory.

## Proposed state

Store a compact, persistent imprint rather than a reference to a historical `WineBatch`:

- anchor influence;
- taste-family influence;
- structure influence;
- memory strength;
- optional source style or grape identity.

The imprint must survive bottling, selling, and deletion of the original batch.

## Proposed behavior

```text
previous wine profile
  -> vessel imprint
  -> partial release into the next fill
  -> imprint weakens through fills, cleaning, and time
```

The next wine should receive a small blended influence, not a replacement profile. The initial gameplay target should be a restrained effect (roughly 1–5% effective influence), tuned by material and vessel condition rather than a literal 10% volume transfer.

## Material tendencies

- Oak: strongest memory and extraction; new or recently seasoned barrels are most expressive.
- Chestnut: strong, more tannic, and potentially less predictable.
- Ceramic: moderate memory when porous or unglazed; low when heavily glazed.
- Concrete: low-to-moderate surface memory, with greater emphasis on oxygen exchange and texture.
- Stainless steel: almost no material memory; contamination is primarily a cleanliness/condition problem.
- Plastic: possible odor and taint retention, but not a desirable flavor-memory source.

## Interaction with current vessel state

- `qualityScore` describes how well-made and capable the vessel is.
- `condition` describes physical state and should influence whether memory release is controlled or risky.
- `cleanliness` describes sanitation and should remain separate from useful memory.
- `age` and `fillHistory` should reduce oak extraction over time and repeated use.
- Cleaning should reduce surface residue and contamination risk but should not instantly erase compounds absorbed into wood.

Temperature should accelerate diffusion and extraction. Humidity should primarily affect wood moisture, leakage, and physical condition rather than directly increasing flavor transfer.

## Gameplay risks to model later

- A compatible previous fill can provide a small stylistic benefit.
- An incompatible fill can create unwanted flavor, anchor drift, or structural imbalance.
- Poor condition or prolonged dirty storage can turn memory into contamination risk.
- Memory should decay and be bounded so one historic fill cannot dominate a vessel forever.

## Prerequisites

Before implementation, the game needs:

1. Material-specific wine effects on anchors, taste, or structure.
2. A condition-degradation and maintenance loop.
3. Fill-history updates on completed fills.
4. A compact persisted vessel-imprint shape and migration.
5. Tests covering fill, emptying, bottling, selling, cleaning, and repeated reuse.
