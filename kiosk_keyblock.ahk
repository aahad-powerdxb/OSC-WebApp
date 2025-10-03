#Requires AutoHotkey v2.0
#Warn
; Kiosk keyguard (AutoHotkey v2)
; Unlock: Ctrl+Alt+Shift+O  (temporary unlock)
; Manual lock: Ctrl+Alt+Shift+L
; Exit script: Ctrl+Alt+Shift+X

; --------------------
; Globals
; --------------------
global Toggle := false                    ; when true, shortcuts are ALLOWED
global UNLOCK_DURATION_MS := 10000        ; unlock duration in ms (10s)
global _autoLockTimerActive := false

; create a reusable function object for the timer callback
global _autoLockTimerObj := () => AutoLockTimer()

; initial tray tip
TrayTip("Kiosk", "Kiosk keyguard running. Unlock with Ctrl+Alt+Shift+O", 3)

; --------------------
; HotIf block: when Toggle is FALSE, these hotkeys are active (they return/do nothing)
; --------------------
#HotIf !Toggle

; Block left/right Win keys
LWin::Return
RWin::Return

; Block Win+D (Show Desktop)
#d::Return

; Block Win+Down (minimize/snap)
#Down::Return

; Block Alt+F4
!F4::Return

; Block Alt keys entirely (prevents Alt+Tab)
LAlt::Return
RAlt::Return

; Block typical browser / system combos
F5::Return              ; refresh
^r::Return              ; Ctrl+R
^+r::Return             ; Ctrl+Shift+R
^w::Return              ; Ctrl+W
^q::Return              ; Ctrl+Q
^p::Return              ; Ctrl+P
F11::Return             ; fullscreen toggle

#HotIf  ; end conditional block

; --------------------
; Unlock toggle: Ctrl + Alt + Shift + O
; --------------------
^!+o:: {
    global Toggle, _autoLockTimerActive, _autoLockTimerObj, UNLOCK_DURATION_MS

    Toggle := true
    TrayTip("Kiosk", "Shortcuts UNLOCKED (10s)", 2)

    ; start/restart single-shot auto-lock timer (negative period = single-shot)
    SetTimer(_autoLockTimerObj, -UNLOCK_DURATION_MS)
    _autoLockTimerActive := true
    Return
}

; Manual re-lock: Ctrl+Alt+Shift+L
^!+l:: {
    global Toggle, _autoLockTimerActive, _autoLockTimerObj
    Toggle := false
    _autoLockTimerActive := false
    SetTimer(_autoLockTimerObj, "Off")
    TrayTip("Kiosk", "Shortcuts LOCKED", 1)
    Return
}

; Exit script (maintenance): Ctrl+Alt+Shift+X
^!+x:: {
    TrayTip("Kiosk", "Exiting kiosk keyguard", 1)
    Sleep 400
    ExitApp
}

; --------------------
; AutoLockTimer function (called once by SetTimer above)
; --------------------
AutoLockTimer() {
    global Toggle, _autoLockTimerActive
    Toggle := false
    _autoLockTimerActive := false
    TrayTip("Kiosk", "Shortcuts LOCKED", 1)
}

; Launch in kiosk mode (adjust URL / flags as needed)
chromePath := "C:\Program Files\Google\Chrome\Application\chrome.exe"
chromeArgs := '--kiosk "http://localhost:3000" --disable-pinch --no-first-run'


; Start Edge and continue running the AHK script (so hotkeys remain active)
Run('"' chromePath '" ' chromeArgs)

; Optional: wait a moment and then show tray confirmation
Sleep 600
TrayTip("Kiosk", "Edge kiosk launched — keyguard active", 2)