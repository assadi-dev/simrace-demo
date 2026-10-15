# Construit agent\dist\simrace-agent.exe (fenetre: envoyer, enregistrer un replay, tout arreter).
# A lancer depuis agent\ : .\build_exe.ps1
# PyInstaller tourne dans un environnement isole (uvx) : il n'entre pas dans les dependances de
# l'agent et ne touche pas a .venv. L'exe, build\ et le .spec sont ignores par git.
# Un .env pose a cote de l'exe est lu au demarrage (SIMRACE_SERVER_URL, SIMRACE_STATION_ID).
uvx --with httpx pyinstaller --noconfirm --onefile --windowed --name simrace-agent --paths src src\simrace_agent\gui.py
