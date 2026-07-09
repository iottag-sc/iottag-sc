@echo off
rem Wrapper for Windows Task Scheduler — runs the Figma design-drift check.
cd /d "%~dp0"
if not exist logs mkdir logs
node --use-system-ca --env-file=.env check.mjs >> logs\watch.log 2>&1
