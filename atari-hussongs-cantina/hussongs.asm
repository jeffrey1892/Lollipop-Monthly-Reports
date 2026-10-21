; ===========================================================
;  HUSSONG'S CANTINA  --  a Tapper-style margarita server
;  Atari 2600 (NTSC, 4K ROM)   build: dasm hussongs.asm -f3
;  Slide margaritas down three bar tops before the patrons
;  reach the end. Inspired by Hussong's Cantina, Ensenada
;  (est. 1892, birthplace-claim of the margarita, 1941).
; ===========================================================
    processor 6502

; ---- TIA write registers ----
VSYNC   = $00
VBLANK  = $01
WSYNC   = $02
NUSIZ0  = $04
NUSIZ1  = $05
COLUP0  = $06
COLUP1  = $07
COLUPF  = $08
COLUBK  = $09
CTRLPF  = $0A
REFP0   = $0B
REFP1   = $0C
PF0     = $0D
PF1     = $0E
PF2     = $0F
RESP0   = $10
RESP1   = $11
RESM0   = $12
RESM1   = $13
RESBL   = $14
AUDC0   = $15
AUDF0   = $17
AUDV0   = $19
GRP0    = $1B
GRP1    = $1C
ENAM0   = $1D
ENAM1   = $1E
ENABL   = $1F
HMP0    = $20
HMP1    = $21
HMM0    = $22
HMM1    = $23
HMBL    = $24
HMOVE   = $2A
HMCLR   = $2B
CXCLR   = $2C
; ---- TIA read / RIOT ----
INPT4   = $3C
SWCHA   = $0280
SWCHB   = $0282
INTIM   = $0284
TIM64T  = $0296

; ---- game constants ----
BART_X      = 118       ; bartender fixed X
DRINK_SPAWN = 112
PATRON_MIN  = 8
PATRON_GOAL = 108       ; patron reaching this = lost life
DRINK_SPEED = 2
DRAW_H      = 50        ; drawn lines per band

; ---- zero page ----
    seg.u vars
    org $80
frame       ds 1
state       ds 1        ; 0=title 1=play 2=gameover
barSel      ds 1
lives       ds 1
score       ds 1
scLv        ds 1        ; serves within level (0-15)
level       ds 1
period      ds 1        ; frames per patron step
moveTick    ds 1
patronX     ds 3
patronDly   ds 3        ; >0 : patron offscreen, counting down
drinkX      ds 3        ; 0 = no drink on that bar
stickLatch  ds 1
fireLatch   ds 1
rand        ds 1
sndTimer    ds 1
flashTimer  ds 1
goTimer     ds 1
titleTimer  ds 1
livesPF0    ds 1
scPF1       ds 1
scPF2       ds 1
statCol     ds 1
p1PtrLo     ds 1
p1PtrHi    ds 1
p0PtrLo     ds 1
p0PtrHi     ds 1
m0PtrLo     ds 1
m0PtrHi     ds 1
bandIdx     ds 1
tmp         ds 1

; ===========================================================
    seg code
    org $F000

Reset:
    sei
    cld
    ldx #$FF
    txs
    lda #0
.clr:
    sta $00,x
    dex
    bne .clr
    sta $00

    lda #$45
    sta rand
    jsr GoTitle

; ---------------- main loop ----------------
MainLoop:
    ; ---- VSYNC (3 lines) ----
    lda #2
    sta VBLANK
    sta VSYNC
    sta WSYNC
    sta WSYNC
    sta WSYNC
    lda #0
    sta VSYNC
    lda #44
    sta TIM64T

    inc frame
    jsr NextRand

    ; RESET console switch -> title
    lda SWCHB
    and #1
    bne .noReset
    jsr GoTitle
.noReset:

    lda state
    beq DoTitleLogic
    cmp #1
    beq DoPlayLogic
    jmp DoOverLogic

; ---------------- title logic ----------------
DoTitleLogic:
    lda INPT4
    bmi .noFire
    jsr StartGame
    jmp WaitVB
.noFire:
    dec titleTimer
    bne .stay
    jsr StartGame           ; attract mode auto-start
.stay:
    jmp WaitVB

; ---------------- game over logic ----------------
DoOverLogic:
    lda frame
    and #$10
    beq .red
    lda #2
    sta flashTimer          ; pulse the bar walls red
.red:
    dec goTimer
    bne .staygo
    jsr GoTitle
.staygo:
    jmp PlayFrameSetup      ; still draw the play screen

; ---------------- play logic ----------------
DoPlayLogic:
    ; ----- joystick up/down: change bar -----
    lda SWCHA
    and #$30                ; P0 up(bit4) / down(bit5), 0=pressed
    cmp #$30
    bne .held
    lda #0
    sta stickLatch
    jmp .stickDone
.held:
    ldx stickLatch
    bne .stickDone
    inx
    stx stickLatch
    and #$10                ; up?
    bne .down
    lda barSel
    beq .stickDone
    dec barSel
    jmp .stickDone
.down:
    lda barSel
    cmp #2
    bcs .stickDone
    inc barSel
.stickDone:

    ; ----- fire: serve a margarita -----
    lda INPT4
    bmi .fireUp
    lda fireLatch
    bne .fireDone
    lda #1
    sta fireLatch
    ldx barSel
    lda drinkX,x
    bne .fireDone           ; one drink per bar
    lda #DRINK_SPAWN
    sta drinkX,x
    lda #4                  ; serve blip
    sta AUDC0
    lda #6
    sta AUDF0
    lda #6
    sta AUDV0
    lda #6
    sta sndTimer
    jmp .fireDone
.fireUp:
    lda #0
    sta fireLatch
.fireDone:

    ; ----- patrons advance -----
    inc moveTick
    lda moveTick
    cmp period
    bcc .noStep
    lda #0
    sta moveTick
    ldx #2
.patLoop:
    lda patronDly,x
    beq .walk
    dec patronDly,x
    bne .patNext
    ; respawn
    lda rand
    and #$0F
    clc
    adc #PATRON_MIN
    sta patronX,x
    jsr NextRand
    jmp .patNext
.walk:
    inc patronX,x
    lda patronX,x
    cmp #PATRON_GOAL
    bcc .patNext
    ; patron reached the bartender: lose a life
    lda #70
    sta patronDly,x
    jsr LoseLife
.patNext:
    dex
    bpl .patLoop
.noStep:

    ; ----- drinks slide left + collisions -----
    ldx #2
.drLoop:
    lda drinkX,x
    beq .drNext
    sec
    sbc #DRINK_SPEED
    cmp #PATRON_MIN
    bcs .drMove
    ; fell off the end of the bar: broken glass
    lda #0
    sta drinkX,x
    jsr LoseLife
    jmp .drNext
.drMove:
    sta drinkX,x
    ; hit the patron on this bar?
    ldy patronDly,x
    bne .drNext             ; no patron -> keep sliding
    sec
    sbc patronX,x
    bcc .serve              ; drink at/left of patron
    cmp #8
    bcs .drNext             ; still right of patron
.serve:
    ; served!
    lda #0
    sta drinkX,x
    lda rand
    and #$3F
    clc
    adc #40
    sta patronDly,x
    jsr NextRand
    inc score
    inc scLv
    lda #12                 ; happy blip
    sta AUDC0
    lda #3
    sta AUDF0
    lda #8
    sta AUDV0
    lda #8
    sta sndTimer
    lda scLv
    cmp #16
    bcc .drNext
    ; level up
    lda #0
    sta scLv
    inc level
    lda period
    cmp #2
    bcc .drNext
    dec period
.drNext:
    dex
    bpl .drLoop

    ; fall through to frame setup
PlayFrameSetup:
    ; status gauge
    ldx lives
    lda LivesTbl,x
    sta livesPF0
    ldx scLv
    lda Gauge1,x
    sta scPF1
    lda Gauge2,x
    sta scPF2
    lda level
    and #$07
    tax
    lda LevelCol,x
    sta statCol

    ; position bartender (P0) once per frame
    lda #BART_X
    sta WSYNC
    sec
.p0div:
    sbc #15
    bcs .p0div
    eor #7
    asl
    asl
    asl
    asl
    sta HMP0
    sta RESP0
    sta WSYNC
    sta HMOVE
    sta WSYNC
    sta HMCLR

WaitVB:
    lda INTIM
    bne WaitVB
    sta WSYNC
    lda #0
    sta VBLANK              ; screen on

    lda state
    bne GameKernel
    jmp TitleKernel

; ===========================================================
;  GAME KERNEL : 16 status + 3 x 56 band + 8 pad = 192 lines
; ===========================================================
GameKernel:
    ; ---- status band: 16 lines ----
    sta WSYNC               ; line 1
    lda #1
    sta CTRLPF              ; mirrored playfield for gauge
    lda #0
    sta COLUBK
    lda statCol
    sta COLUPF
    lda #0
    sta PF0
    sta PF1
    sta PF2
    sta WSYNC               ; line 2
    sta WSYNC               ; line 3
    lda livesPF0
    sta PF0
    lda scPF1
    sta PF1
    lda scPF2
    sta PF2
    ldx #10
.statLoop:
    sta WSYNC               ; lines 4-13
    dex
    bne .statLoop
    sta WSYNC               ; line 14
    lda #0
    sta PF0
    sta PF1
    sta PF2
    sta WSYNC               ; line 15
    sta WSYNC               ; line 16

    ; ---- three bands ----
    lda #0
    sta bandIdx
BandLoop:
    ldx bandIdx

    ; -- setup line 1: position P1 (patron) --
    lda patronX,x
    sta WSYNC
    sec
.p1div:
    sbc #15
    bcs .p1div
    eor #7
    asl
    asl
    asl
    asl
    sta HMP1
    sta RESP1

    ; -- setup line 2: position M0 (drink) --
    lda drinkX,x
    sta WSYNC
    sec
.m0div:
    sbc #15
    bcs .m0div
    eor #7
    asl
    asl
    asl
    asl
    sta HMM0
    sta RESM0

    ; -- setup line 3: HMOVE + colors --
    sta WSYNC
    sta HMOVE
    lda PatronCol,x
    sta COLUP1
    ldy flashTimer
    beq .wallNorm
    lda #$44                ; life lost: walls flash red
    bne .setBk
.wallNorm:
    lda WallCol,x
.setBk:
    sta COLUBK
    lda #$F0
    sta COLUPF

    ; -- setup line 4: pointers --
    sta WSYNC
    sta HMCLR
    lda #>PatronBand        ; all bands share one page
    sta p1PtrHi
    sta p0PtrHi
    sta m0PtrHi
    lda patronDly,x
    beq .patOn
    lda #<BlankBand
    .byte $2C               ; BIT abs: skip next 2-byte load
.patOn:
    lda #<PatronBand
    sta p1PtrLo

    cpx barSel
    bne .noBart
    lda #<BartBand
    .byte $2C
.noBart:
    lda #<BlankBand
    sta p0PtrLo

    lda drinkX,x
    beq .noDrink
    lda #<M0EnBand
    .byte $2C
.noDrink:
    lda #<BlankBand
    sta m0PtrLo

    ; -- setup lines 5+6 --
    sta WSYNC
    ldy #0
    sta WSYNC

    ; -- draw loop: 50 lines --
.draw:
    sta WSYNC
    lda PFBand,y
    sta PF0
    sta PF1
    sta PF2
    lda (p1PtrLo),y
    sta GRP1
    lda (p0PtrLo),y
    sta GRP0
    lda ColP0Band,y
    sta COLUP0
    lda (m0PtrLo),y
    sta ENAM0
    iny
    cpy #DRAW_H
    bne .draw

    inc bandIdx
    lda bandIdx
    cmp #3
    bcs BandsDone
    jmp BandLoop
BandsDone:

    ; ---- 8 pad lines ----
    sta WSYNC
    lda #0
    sta GRP0
    sta GRP1
    sta ENAM0
    sta PF0
    sta PF1
    sta PF2
    sta COLUBK
    ldx #7
.padLoop:
    sta WSYNC
    dex
    bne .padLoop
    jmp Overscan

; ===========================================================
;  TITLE KERNEL : 16 + 160 + 16 = 192 lines
; ===========================================================
TitleKernel:
    sta WSYNC
    lda #0
    sta CTRLPF              ; duplicate mode: asymmetric rewrites
    sta COLUBK
    sta GRP0
    sta GRP1
    sta ENAM0
    sta ENAM1
    sta ENABL
    sta PF0
    sta PF1
    sta PF2
    lda #$0E
    sta COLUPF
    ldx #15
.padTop:
    sta WSYNC
    dex
    bne .padTop

    ldx #0                  ; scanline 0-159
.tloop:
    sta WSYNC
    txa
    lsr
    lsr
    tay                     ; row 0-39
    lda TPF0L,y
    sta PF0
    lda TPF1L,y
    sta PF1
    lda TPF2L,y
    sta PF2
    lda TPF0R,y
    sta PF0
    lda TPF1R,y
    sta PF1
    lda TPF2R,y
    sta PF2
    lda TitleCol,y
    sta COLUPF
    inx
    cpx #160
    bne .tloop

    sta WSYNC
    lda #0
    sta PF0
    sta PF1
    sta PF2
    ldx #15
.padBot:
    sta WSYNC
    dex
    bne .padBot

; ===========================================================
;  OVERSCAN : 30 lines
; ===========================================================
Overscan:
    lda #2
    sta VBLANK
    lda #35
    sta TIM64T

    lda sndTimer
    beq .sndOff
    dec sndTimer
    bne .sndOn
.sndOff:
    lda #0
    sta AUDV0
.sndOn:
    lda flashTimer
    beq .noFlash
    dec flashTimer
.noFlash:

.waitOS:
    lda INTIM
    bne .waitOS
    sta WSYNC
    jmp MainLoop

; ===========================================================
;  helpers
; ===========================================================
NextRand:
    lda rand
    lsr
    bcc .nr
    eor #$B4
.nr:
    sta rand
    rts

LoseLife:
    lda #8                  ; crash noise
    sta AUDC0
    lda #20
    sta AUDF0
    lda #10
    sta AUDV0
    lda #16
    sta sndTimer
    lda #12
    sta flashTimer
    dec lives
    bne .alive
    lda #2
    sta state
    lda #180
    sta goTimer
.alive:
    rts

GoTitle:
    lda #0
    sta state
    sta GRP0
    sta GRP1
    sta ENAM0
    lda #255
    sta titleTimer
    rts

StartGame:
    lda #1
    sta state
    lda #3
    sta lives
    lda #0
    sta score
    sta scLv
    sta level
    sta moveTick
    sta flashTimer
    sta drinkX
    sta drinkX+1
    sta drinkX+2
    lda #4
    sta period
    lda #1
    sta barSel
    lda #20
    sta patronX
    lda #40
    sta patronX+1
    lda #10
    sta patronX+2
    lda #1
    sta patronDly
    lda #60
    sta patronDly+1
    lda #120
    sta patronDly+2
    lda #1
    sta fireLatch           ; require a fresh press in-game
    lda #$20                ; missile 0: 4px wide
    sta NUSIZ0
    lda #0
    sta NUSIZ1
    sta REFP0
    sta REFP1
    rts

; ---- small color tables ----
PatronCol:
    .byte $42,$86,$C6
WallCol:
    .byte $24,$26,$28       ; warm adobe shades
LevelCol:
    .byte $0E,$1C,$C8,$44,$86,$5C,$2C,$9C

; ---- generated graphics data ----
    include "data.asm"

; ---- vectors ----
    org $FFFA
    .word Reset
    .word Reset
    .word Reset
