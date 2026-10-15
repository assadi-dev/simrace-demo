#!/bin/sh
# Construit agent/dist/simrace-agent.app (macOS), la meme fenetre que build_exe.ps1 sous Windows.
# A lancer depuis agent/ : ./build_app.sh
# PyInstaller ne cross-compile pas: ce script tourne sur un Mac, build_exe.ps1 sur Windows.
# --onedir: un .app est un dossier, --onefile est refuse par PyInstaller 7 sous macOS.
# Le .app, build/ et le .spec sont ignores par git. Un .env pose a cote du .app est lu au
# demarrage (SIMRACE_SERVER_URL, SIMRACE_STATION_ID). Sans ACC, la fenetre ne montre que le rejeu.
set -e
uvx --with httpx pyinstaller --noconfirm --onedir --windowed --name simrace-agent --paths src src/simrace_agent/gui.py
