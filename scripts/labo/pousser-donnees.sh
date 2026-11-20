#!/usr/bin/env bash
# scripts/labo/pousser-donnees.sh <worktree> — pousse le commit du worktree sur la branche labo-donnees.
# Si un autre robot (avis, Chaos, Sentinelle…) a poussé entre-temps, on se recale sur sa version (rebase : nos
# fichiers sont dans leur propre dossier, aucun conflit possible) et on réessaie, 5 fois au plus.
set -u
cd "$1"
for essai in 1 2 3 4 5; do
  if git push -q origin HEAD:labo-donnees; then exit 0; fi
  sleep $((essai * 3))
  git fetch -q --depth=50 origin labo-donnees || continue
  git rebase -q FETCH_HEAD || { git rebase --abort; echo "::warning::recalage impossible sur labo-donnees"; exit 1; }
done
echo "::warning::labo-donnees : envoi impossible après 5 essais"
exit 1
