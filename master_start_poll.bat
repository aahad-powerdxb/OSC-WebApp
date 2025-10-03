@echo off
setlocal

set "TARGET_DIR=C:\Users\AHAD_PC\Documents\Git_repositories\OSC-WebApp"
set "AHK_EXE=C:\Program Files\AutoHotkey\AutoHotkey.exe"
set "AHK_SCRIPT=C:\Users\AHAD_PC\Documents\Git_repositories\OSC-WebApp\kiosk_keyblock.ahk"

echo Starting OSC WebApp...
start "OSC WebApp Server" /D "%TARGET_DIR%" cmd /k "npm start > server.log 2>&1"

echo Waiting for web server (http://localhost:3000) to become available...
powershell -NoProfile -Command ^
"for(;;){Try{Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 2; break} Catch { Start-Sleep -Seconds 1 }}"

echo Server up — launching kiosk keyguard...
start "Kiosk Keyguard" "%AHK_EXE%" "%AHK_SCRIPT%"

echo Done.
endlocal
exit /b 0