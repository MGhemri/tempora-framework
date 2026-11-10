# TVRW J10 — Chronos et incertitude temporelle

## Défaut scientifique corrigé

Le rendu précédent réduisait les événements à des années et, lorsque
end_date était inconnu, utilisait start_date.latest comme fin de la barre.
Cette imputation visuelle n'était pas autorisée par les données.

## Nouvelle règle de présentation

- Le tracé utilise les bornes explicites YYYY-MM-DD du calendrier grégorien.
- Début incertain et fin incertaine restent deux bandes distinctes en pointillés.
- Le segment plein représente seulement l'intervalle assuré par les bornes.
- Une fin inconnue est signalée par ? et ne reçoit aucun point final ni prolongement.
  Une fin inconnue ne signifie pas non plus que l'événement se poursuit aujourd'hui.
- Dates incompatibles, début inconnu, intervalles inversés ou années non prises en
  charge restent visibles dans le tableau mais ne créent aucun tracé artificiel.
- Tri déterministe par date de début et référence qualifiée ; au plus 50 lignes
  de la page courante ; aucun calcul ne prétend couvrir le corpus complet.
- Le tableau brut reste accessible. Aucune écriture, géocodage, modification
  de l'IPC ou de la version du modèle canonique.

## Vérification

Sept tests de non-imputation, certitude, chevauchement, calendrier grégorien,
robustesse, limite de page et immutabilité dans la suite test:visualization.
La CI Desktop doit valider la compilation TypeScript et la suite sur Linux/Windows.

## Limites

Le tracé est une interprétation visuelle des bornes déclarées, non une
certification historique ni une nouvelle preuve. Les P0 de persistance
SEC-WIN-01/02, SCI-01, REC-01 et DUR-01 ne sont pas concernés.
