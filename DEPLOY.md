# Pasos pendientes para publicar este sitio

Contexto: este es un sitio estático (HTML/CSS/JS, sin build) sobre criptomonedas
para profesionales de economía. El objetivo es subirlo a GitHub y publicarlo en
Render (o GitHub Pages) para obtener una URL compartible.

## Estado

- [ ] Verificar que Git esté instalado (`git --version`). Si no: instalar desde https://git-scm.com/download/win o con `winget install Git.Git`.
- [ ] Inicializar el repositorio (`git init`) y hacer el primer commit.
- [ ] Autenticar con GitHub (idealmente con GitHub CLI: `winget install GitHub.cli` y luego `gh auth login`).
- [ ] Crear el repositorio remoto `cripto-economia` en la cuenta del usuario y hacer push.
- [ ] Publicar:
  - **Opción Render**: dashboard de Render → New → Static Site → conectar GitHub → repo `cripto-economia` → publish directory `.` → sin build command.
  - **Opción GitHub Pages**: Settings del repo → Pages → Deploy from branch `main` / root.

## Notas

- No hay build ni dependencias: se publica la carpeta tal cual.
- El sitio consume APIs públicas (CoinGecko y alternative.me) desde el navegador del visitante; no necesita backend ni claves.
