# Fighter — full NFT collection matrix

Every suite collection has **graphics** (`collectionLooks`) + **gameplay** (`collectionMatrix`).

| Taxon | Collection | Role | Look | Gameplay |
|------:|------------|------|------|----------|
| 0 | The Inquiry | fighter | inquiry (divine) | God · special/reach/meter |
| 2 | The Inquisition | fighter | inquisition (plate) | Human · ATK/DEF |
| 1003 | Inquisition Reborn | fighter | reborn (tech) | Human · crit/pen |
| 9 | Under the Bridge | fighter | bridge (PFP) | Agile · crit/lifesteal |
| 9001 | Basic Human | fighter | starter | Free recruit baseline |
| 1012 | Riddle Weapons | weapon equip | — | Equip +ATK/reach |
| 1015 | Riddle Ammo | ammo equip | — | Equip +special |
| 3 | Lost Emporium | gear equip | — | Soft weapon/item |
| 4 | DANTES AURUM | charm | — | Meter aura |
| 5 | RiddleTank | charm | — | Defense charm |
| 10 | Community | charm | — | Meter gain |
| 1010 | Lands | block | — | City only |
| 1016 | Land Buildings | block | — | City only |
| 1017 | Game Halls | block | — | City only |
| 1101 | Transport | charm | — | Soft speed |

**Rule:** fightable bodies use realistic collection renderer; gear multiplies combat via `withCombatPowers` + equip hooks.
