# Hussong's Cantina (Atari 2600)

A Tapper-style homebrew game for the Atari 2600 (NTSC, 4K ROM), set at
Hussong's Cantina in Ensenada, Baja California — open since 1892 and home
of the claim that bartender Don Carlos Orozco invented the margarita there
in October 1941 for Margarita Henkel.

## How to play

You are the bartender, working three bar tops. Thirsty patrons walk in
from the left; slide margaritas down the bar before they reach you.

- **Joystick up/down** — move between the three bars
- **Fire** — slide a margarita down your current bar (one per bar at a time)
- Serve a patron: +1 point (top gauge fills; 16 serves = next level, faster patrons)
- A patron reaching your end of the bar: **lose a life**
- A margarita sliding off an empty bar: broken glass, **lose a life**
- 3 lives. Walls flash red when you lose one. Game over returns to the title.

The title screen is a stylized pixel homage to Hussong's classic
black/red/cream cantina branding, with a salt-rimmed margarita front and
center. The title auto-starts into attract mode after ~4 seconds; press
fire to start playing.

## Files

- `hussongs.bin` — the 4K ROM. Play it in Stella or on real hardware via a
  Harmony cartridge.
- `hussongs.asm` — 6502 assembly source (dasm syntax)
- `genart.py` — generates `data.asm` (playfield logo bitmap, sprite art,
  score-gauge tables)
- `data.asm` — generated graphics data

## Building

```sh
python3 genart.py
dasm hussongs.asm -f3 -ohussongs.bin
```

Requires [dasm](https://dasm-assembler.github.io/) (`apt install dasm`).

## Technical notes

- Standard 262-line NTSC frame: 3 VSYNC / 37 VBLANK / 192 visible / 30 overscan
- Title logo uses a 40-bit asymmetric playfield (PF0/PF1/PF2 rewritten
  mid-scanline, cycle-timed) with per-row color changes
- Gameplay kernel multiplexes one player sprite (P1) and one missile (M0)
  across three vertical bands, repositioned between bands, so each bar has
  its own patron and in-flight margarita
- The bartender's white head/lime apron and the lime margarita share P0's
  color via a per-scanline COLUP0 table
