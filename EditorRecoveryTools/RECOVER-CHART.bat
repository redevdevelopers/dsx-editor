@echo off
cls
echo ========================================
echo DSX Chart Recovery Tool
echo ========================================
echo.
echo This tool will recover your chart from
echo the LevelDB auto-save database.
echo.
echo Make sure DSX Editor is closed!
echo.
pause

node recover-chart.js

echo.
pause
