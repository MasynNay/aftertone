@echo off
cd /d "%~dp0..\.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
if exist ".env" for /f "tokens=1,* delims==" %%A in (.env) do (
  if /I "%%A"=="JAMENDO_CLIENT_ID" set "JAMENDO_CLIENT_ID=%%B"
  if /I "%%A"=="AUDIUS_API_KEY" set "AUDIUS_API_KEY=%%B"
  if /I "%%A"=="YOUTUBE_API_KEY" set "YOUTUBE_API_KEY=%%B"
  if /I "%%A"=="JELLYFIN_URL" set "JELLYFIN_URL=%%B"
  if /I "%%A"=="JELLYFIN_API_KEY" set "JELLYFIN_API_KEY=%%B"
  if /I "%%A"=="JELLYFIN_USER_ID" set "JELLYFIN_USER_ID=%%B"
)
start "" "http://127.0.0.1:4173"
node app/server.mjs
pause
