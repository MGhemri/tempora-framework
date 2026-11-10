# TEMPORA M1.5 — Mode opératoire de diagnostic après interruption

**Statut : qualification expérimentale, non activée dans Electron.**
Ce document s'adresse à un opérateur disposant d'une copie locale du
répertoire TEMPORA de transactions. Il ne constitue pas une autorisation
de publier ou d'approuver scientifiquement les données.

## Diagnostic sans mutation

Sur un poste avec Node.js et les dépendances de Desktop déjà installées :

```powershell
cd apps/desktop
node electron/scripts/assess-recovery.cjs "C:\\Dossier\\TEMPORA-imports"
```

La commande utilise le SDK canonique TEMPORA et ne crée, ne modifie,
ne renomme ni ne supprime aucun fichier. Le résultat est un JSON présentant
le nombre de transactions terminées, les transactions invalides,
les dossiers `.pending` classés et l'état de `.writer-lock`.
Le rapport ne révèle pas de contenu de corpus.

Codes de sortie : **0** = aucun blocage détecté ; **2** = examen manuel
nécessaire ; **3** = erreur de paramètres ou de lecture. Un code 0
n'affirme **ni** la validité historique des événements **ni** la durabilité
électrique du volume.

## Règles de conservation

1. Ne pas démarrer une nouvelle écriture quand le rapport indique
   `requires_manual_attention: true`.
2. Préserver une copie intégrale du dossier et les métadonnées du volume,
   idéalement hors ligne, avant toute décision de récupération.
3. Ne jamais déduire d'un simple PID ou horodatage que
   `.writer-lock` est libre. Son propriétaire doit être identifié
   et l'arrêt de tous les processus écrivains confirmé par l'opérateur.
4. Les candidats `pending_verified_for_review` sont **seulement**
   cohérents au contrôle cryptographique ; ils ne sont pas automatiquement
   promus. Les candidats `pending_incomplete` et `pending_unsafe`
   doivent rester intacts pour audit.
5. Ne pas écraser un corpus de base, ne pas réutiliser un jeton de revue,
   ne pas modifier le journal pour faire accepter un candidat.
6. En cas de doute sur NTFS, SMB, jonction, ACL ou coupure électrique,
   conserver l'ensemble et solliciter une analyse supplémentaire.

## Limites de qualification

Les tests automatisés arrêtent réellement un **processus enfant Node**
avant ou après le renommage final. Ils vérifient la visibilité logique,
la présence d'un verrou orphelin et la conservation des preuves. Ils ne
simulent pas une panne électrique du système entier et ne prouvent
pas la durabilité NTFS ou la protection contre une substitution de
répertoire (TOCTOU/reparse points). Les crash tests ne sont exécutés
qu'avec des corpus synthétiques temporaires.

**Interdit avant levée des gates :** promotion automatique de `.pending`,
suppression des verrous orphelins, branchement de cette fonction à une
commande de sauvegarde IPC du renderer, fusion dans `main` ou publication
du package Store.

Référence : [ASSIST-M1.5-PERSISTENCE.md](ASSIST-M1.5-PERSISTENCE.md).
