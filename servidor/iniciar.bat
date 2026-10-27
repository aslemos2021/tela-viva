@echo off
rem Tela Viva - inicia o servidor do professor (pede permissao de administrador)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" %*
if errorlevel 1 pause
