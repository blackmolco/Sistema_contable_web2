@echo off
rem Respaldo diario de todas las empresas (lo ejecuta el Programador de tareas de Windows).
rem Deja el detalle en backups\respaldo-diario.log
cd /d "%~dp0.."
echo ===== %date% %time% ===== >> backups\respaldo-diario.log
node scripts\respaldo-completo.js >> backups\respaldo-diario.log 2>&1
echo codigo de salida: %errorlevel% >> backups\respaldo-diario.log
exit /b %errorlevel%
