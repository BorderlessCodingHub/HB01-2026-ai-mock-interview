# Summary: Practice maxTurns +1

**What:** Increased `MAX_TURNS_BY_LEVEL` so bootstrap ready message does not steal a user turn.

**Values:** entry 6, mid 8, senior 9 (was 5 / 7 / 8).

**Note:** Only new sessions pick up the new `maxTurns`. Frontend level labels remain 5/7/8 (user answer promise).
