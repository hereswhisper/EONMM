@echo off
:loop
    echo Starting Node.js...
    start /B node .
    timeout /T 300
    echo Stopping Node.js...
    for /f "tokens=2" %%i in ('tasklist ^| find "node.exe"') do taskkill /PID %%i /F
    goto loop
