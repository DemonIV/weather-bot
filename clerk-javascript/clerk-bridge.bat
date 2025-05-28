@echo off
echo Clerk API Koprusu baslatiliyor...
cd /d %~dp0

if not exist node_modules (
  echo Node modullerini yuklememissiniz. Yuklemek ister misiniz? (E/H)
  set /p choice=Seciminiz: 
  if /i "%choice%"=="E" (
    echo Node modulleri yukleniyor...
    cmd /c "npm install express cors @clerk/clerk-sdk-node"
  ) else (
    echo Moduller yuklenmedi. Kopru calismayabilir.
  )
)

echo Clerk API Koprusu baslatiliyor...
cmd /c "node clerk-bridge.cjs"

pause 