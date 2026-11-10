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


## Validation de la sauvegarde expérimentale depuis l'Assistant

Cette option est **exclusivement réservée aux développeurs** utilisant des
corpus fictifs et des dossiers temporaires sur un disque local. Elle n'est
pas activable dans le package Windows NSIS/MSIX, même en fournissant la
variable d'environnement. Ce n'est pas une instruction de reprise après
incident ni une recommandation de l'utiliser pour des données historiques.

Dans PowerShell, depuis une copie de travail du dépôt et après installation
des dépendances :

```powershell
cd apps/desktop
npm run build
cd electron
$env:TEMPORA_EXPERIMENTAL_M15_SAVE = "1"
npx electron .
```

Dans l'interface Electron, ouvrir un fichier fictif, confirmer son mapping,
prévisualiser un corpus canonique fictif et sélectionner les entrées à
accepter. Le bouton de sauvegarde de développement apparaît seulement
lorsqu'un staging réel a préparé une intention côté hôte. Après activation,
une seconde boîte native demande confirmation puis un sélecteur natif permet
de choisir **un répertoire dédié, déjà existant et local**. La sauvegarde
ne modifie pas le corpus d'origine ; elle crée une transaction dans un dossier
distinct. Annulation, erreur ou succès consomment la décision à usage unique.

Le reçu de simulation ne doit pas être confondu avec celui de la nouvelle
copie locale. Les deux indiquent **aucune publication scientifique**.

Ne jamais désactiver les garde-fous pour contourner les essais Windows :
reparse points, chemins substituables, lecteurs réseau, ACL et durabilité
électrique restent des gates de qualification de production.


## Rapprochement des transactions après un résultat de sauvegarde incertain

Si la confirmation a été interrompue ou que le verrou a été remplacé,
**ne jamais répéter l'écriture**. Conserver le dossier et effectuer d'abord
l'inventaire read-only ci-dessus.

Quand l'opérateur possède les **cinq SHA-256 exacts** de l'intention
d'enregistrement (lot, source, base, mapping, sortie), l'outil peut
rechercher dans les transactions finalisées et intégralement vérifiées
une identité correspondante. Les empreintes sont passées en arguments
**dans cet ordre** :

```powershell
node electron/scripts/assess-recovery.cjs "C:\\Dossier\\TEMPORA-imports" --match <SHA_BATCH> <SHA_SOURCE> <SHA_BASE> <SHA_MAPPING> <SHA_SORTIE>
```

La commande n'écrit rien : elle expose `identity_matching.matching_transaction_ids`
et `operator_review_required`. Le code **0** signifie qu'une seule
transaction finalisée et structurellement vérifiée correspond aux cinq
empreintes, sans anomalie constatée dans l'inventaire courant ; **2**
signifie une correspondance absente, multiple ou un autre élément demandant
un examen humain ; **3** signifie un refus du diagnostic.
Un code 0 **ne certifie pas** la durabilité après coupure de courant,
l'authenticité scientifique, une preuve de publication ni la levée d'un
risque TOCTOU. Aucune réception officielle n'est réémise.

Les empreintes doivent être récupérées des informations de confiance
existantes, sans modifier ni reconstituer artificiellement un journal.
En particulier, un `.writer-lock` encore présent impose toujours
`operator_review_required: true`, même si une transaction correspond.
Ne pas enlever le verrou à la main sans procédure de reprise qualifiée.
