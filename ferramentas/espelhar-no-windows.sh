#!/usr/bin/env bash
# Espelha esta pasta (o clone do repositório no WSL) numa pasta do Windows.
#
# Copia tudo o que mudou e apaga, no destino, o que foi apagado aqui. Nunca
# copia o .git (o Dropbox e o Git não convivem bem) e nunca mexe nos arquivos
# que só existem no computador do professor: a chave da API, a tela coletiva
# e o registro.
#
# Uso, de dentro do WSL:
#   ferramentas/espelhar-no-windows.sh            copia para o destino padrão
#   ferramentas/espelhar-no-windows.sh -n         só mostra o que faria, sem copiar
#   ferramentas/espelhar-no-windows.sh 'C:\outra\pasta'   copia para outro lugar
#
# O destino padrão pode ser mudado na linha DESTINO_PADRAO, abaixo.

set -euo pipefail

DESTINO_PADRAO='C:\Users\aslem\Dropbox\Meu material\Introdução ao Desenvolvimento de Sistemas\5 - IA\tela-viva'

# arquivos e pastas que o espelho nunca copia nem apaga no destino
PROTEGIDOS=(
  '.git'
  'servidor/chave.txt'
  'servidor/coletivo.json'
  'servidor/registro.jsonl'
)

ensaio=''
destino=''
for arg in "$@"; do
  case "$arg" in
    -n|--ensaio) ensaio='--dry-run' ;;
    -h|--ajuda) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) destino="$arg" ;;
  esac
done
destino="${destino:-$DESTINO_PADRAO}"

# origem: a raiz do repositório (a pasta acima de ferramentas/)
origem="$(cd "$(dirname "$0")/.." && pwd)"

# um caminho do Windows (C:\...) vira /mnt/c/...
if [[ "$destino" =~ ^[A-Za-z]:[\\/] ]]; then
  destino="$(wslpath -u "$destino")"
fi

if ! command -v rsync >/dev/null; then
  echo "Falta o rsync. Instale com: sudo apt install rsync" >&2
  exit 1
fi
if [[ ! -f "$origem/index.html" || ! -d "$origem/motor" ]]; then
  echo "A origem não parece ser a pasta da Tela Viva: $origem" >&2
  exit 1
fi
if [[ "$destino" == "$origem" ]]; then
  echo "A origem e o destino são a mesma pasta." >&2
  exit 1
fi
mkdir -p "$destino"

exclusoes=()
for p in "${PROTEGIDOS[@]}"; do exclusoes+=(--exclude "/$p"); done

echo "De:   $origem"
echo "Para: $destino"
[[ -n "$ensaio" ]] && echo "(ensaio: nada será alterado)"
echo

# -r recursivo, -t preserva datas, --delete apaga no destino o que sumiu aqui
# (os protegidos ficam de fora do --delete), --itemize-changes mostra cada mudança.
# Sem -p/-o/-g: as permissões do Linux não fazem sentido na pasta do Windows.
rsync -rt --delete --modify-window=2 --itemize-changes $ensaio "${exclusoes[@]}" "$origem/" "$destino/" \
  | sed -e 's/^>f+++++++++ /  novo      /' -e 's/^>f[^ ]* /  alterado  /' -e 's/^\*deleting */  apagado   /' -e '/^cd/d' -e '/^\.d/d'

echo
echo "Pronto."
