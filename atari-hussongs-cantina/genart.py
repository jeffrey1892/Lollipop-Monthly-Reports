#!/usr/bin/env python3
"""Generate data.asm: TIA playfield/sprite tables for Hussong's Cantina Tapper game."""

# ---------- 4x5 pixel font ----------
FONT = {
    'H': ["X..X","X..X","XXXX","X..X","X..X"],
    'U': ["X..X","X..X","X..X","X..X","XXXX"],
    'S': ["XXXX","X...","XXXX","...X","XXXX"],
    'O': ["XXXX","X..X","X..X","X..X","XXXX"],
    'N': ["X..X","XX.X","X.XX","X..X","X..X"],
    'G': ["XXXX","X...","X.XX","X..X","XXXX"],
    'C': ["XXXX","X...","X...","X...","XXXX"],
    'A': [".XX.","X..X","XXXX","X..X","X..X"],
    'T': ["XXXX",".XX.",".XX.",".XX.",".XX."],
    'I': ["XXXX",".XX.",".XX.",".XX.","XXXX"],
    ' ': ["....","....","....","....","...."],
}

def text_rows(word, width=40):
    rows = []
    for r in range(5):
        line = ""
        for ch in word:
            line += FONT[ch][r] + "."
        line = line[:-1]  # drop trailing gap
        pad = width - len(line)
        left = pad // 2
        rows.append("." * left + line + "." * (pad - left))
    return rows

BLANK = "." * 40
AWN1 = ("XX.." * 10)
AWN2 = ("..XX" * 10)
RULE = ".." + "X" * 36 + ".."

GLASS = [
    "....XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX....",
    "....XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX....",
    ".....XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.....",
    ".......XXXXXXXXXXXXXXXXXXXXXXXXXX.......",
    ".........XXXXXXXXXXXXXXXXXXXXXX.........",
    "............XXXXXXXXXXXXXXXX............",
    "................XXXXXXXX................",
    "..................XXXX..................",
    "...................XX...................",
    "...................XX...................",
    "...............XXXXXXXXXX...............",
    "............XXXXXXXXXXXXXXXX............",
]
GLASS = [g[:40] for g in GLASS]

title = []
colors = []
C_RED, C_CREAM, C_LIME, C_BLK = 0x44, 0x0E, 0xC8, 0x00

def add(rows, col):
    for r in rows:
        assert len(r) == 40, (len(r), r)
        title.append(r)
        colors.append(col)

add([AWN1, AWN2], C_RED)
add([BLANK, BLANK], C_BLK)
add(text_rows("HUSSONGS"), C_CREAM)
add([BLANK], C_BLK)
add(text_rows("CANTINA"), C_RED)
add([BLANK], C_BLK)
add([RULE], C_RED)
add([BLANK], C_BLK)
add(GLASS[0:2], C_CREAM)   # salt rim
add(GLASS[2:6], C_LIME)    # margarita
add(GLASS[6:12], C_CREAM)  # stem + base
add([BLANK], C_BLK)
add([AWN2, AWN1], C_RED)
while len(title) < 40:
    add([BLANK], C_BLK)
assert len(title) == 40, len(title)

def pf_bytes(row):
    """row: 40-char string -> (PF0L,PF1L,PF2L,PF0R,PF1R,PF2R)"""
    b = [1 if c == 'X' else 0 for c in row]
    def pf0(bits):   # screen cols -> bits 4,5,6,7
        v = 0
        for i, bit in enumerate(bits):
            if bit: v |= 1 << (4 + i)
        return v
    def pf1(bits):   # bits 7..0
        v = 0
        for i, bit in enumerate(bits):
            if bit: v |= 1 << (7 - i)
        return v
    def pf2(bits):   # bits 0..7
        v = 0
        for i, bit in enumerate(bits):
            if bit: v |= 1 << i
        return v
    return (pf0(b[0:4]), pf1(b[4:12]), pf2(b[12:20]),
            pf0(b[20:24]), pf1(b[24:32]), pf2(b[32:40]))

tables = {k: [] for k in ("TPF0L","TPF1L","TPF2L","TPF0R","TPF1R","TPF2R")}
for row in title:
    v = pf_bytes(row)
    for k, val in zip(("TPF0L","TPF1L","TPF2L","TPF0R","TPF1R","TPF2R"), v):
        tables[k].append(val)

# ---------- sprites ----------
def sprite_bytes(rows):
    out = []
    for r in rows:
        v = 0
        for i, c in enumerate(r):
            if c == 'X': v |= 1 << (7 - i)
        out.append(v)
    return out

PATRON = [
    "...XXX..",
    "..XXXXX.",
    "..XXXX..",
    "..XXXX..",
    "...XX...",
    "..XXXX..",
    ".XXXXXX.",
    "XXXXXXXX",
    "X.XXXX.X",
    "X.XXXX.X",
    "X.XXXX.X",
    "..XXXX..",
    "..XXXX..",
    "..XXXX..",
    "..X..X..",
    "..X..X..",
    "..X..X..",
    "..X..X..",
    ".XX..XX.",
    ".XX..XX.",
]
BARTENDER = [
    "..XXXX..",
    ".XXXXXX.",
    ".XXXXXX.",
    "..XXXX..",
    "...XX...",
    ".XXXXXX.",
    "XXXXXXXX",
    "XX.XX.XX",
    "..XXXX..",
    "..XXXX..",
    "..XXXX..",
    ".XXXXXX.",
    ".XXXXXX.",
    "XXXXXXXX",
]

DRAW_H = 50
def band_table(art, start):
    t = [0] * DRAW_H
    for i, v in enumerate(art):
        t[start + i] = v
    return t

patron_band = band_table(sprite_bytes(PATRON), 18)       # rows 18-37
bart_band   = band_table(sprite_bytes(BARTENDER), 24)    # rows 24-37
blank_band  = [0] * DRAW_H
m0en_band   = band_table([2] * 6, 32)                    # drink rows 32-37
pf_band     = band_table([0xFF] * 12, 38)                # counter rows 38-49
colp0_band  = [0x0E] * 32 + [0xC8] * 6 + [0x0E] * 12     # white head, lime apron/drink

# ---------- score gauge ----------
g1, g2 = [], []
for n in range(17):
    p1b = min(n, 8)
    v1 = (0xFF << (8 - p1b)) & 0xFF if p1b else 0
    m = max(n - 8, 0)
    v2 = (1 << m) - 1
    g1.append(v1); g2.append(v2)

lives_tbl = [0x00, 0x10, 0x30, 0x70]

def emit(name, data):
    lines = [f"{name}:"]
    for i in range(0, len(data), 10):
        chunk = ",".join(f"${v:02X}" for v in data[i:i+10])
        lines.append(f"    .byte {chunk}")
    return "\n".join(lines)

out = ["; generated by genart.py -- do not edit", "", "    align 256"]
for k in ("TPF0L","TPF1L","TPF2L","TPF0R","TPF1R","TPF2R"):
    out.append(emit(k, tables[k])); out.append("")
out.append(emit("TitleCol", colors)); out.append("")
out.append("    align 256")
out.append(emit("PatronBand", patron_band)); out.append("")
out.append(emit("BartBand", bart_band)); out.append("")
out.append(emit("BlankBand", blank_band)); out.append("")
out.append(emit("M0EnBand", m0en_band)); out.append("")
out.append(emit("PFBand", pf_band)); out.append("")
out.append(emit("ColP0Band", colp0_band)); out.append("")
out.append(emit("Gauge1", g1)); out.append("")
out.append(emit("Gauge2", g2)); out.append("")
out.append(emit("LivesTbl", lives_tbl)); out.append("")

with open("data.asm", "w") as f:
    f.write("\n".join(out) + "\n")
print("data.asm written:", sum(len(t) for t in tables.values()) , "title bytes")
