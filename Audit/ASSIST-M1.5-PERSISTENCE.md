# ASSIST-M1.5 — Persistance scientifique locale transactionnelle

**Statut :** contrat d'implémentation proposé, non livré. **Date :** 2026-11-09.
**Périmètre :** TEMPORA Desktop Windows Electron/Chromium, SDK TEMPORA 3.0.0, modèle canonique v3.
**Dépendances :** PR #110 (revue + staging en mémoire), PR #112 (Chromium officiel), issues #108 et #113.

## 1. Constat vérifié dans `main`

- `apps/desktop/bridge/worker.cjs` expose `ingestion.preview` et `ingestion.stage-review`.
- `assistantStage` revalide le SHA-256 de l'entrée, relance `ingestion.preview`, compare `batch_id` et `base_sha256`, refuse les IDs absents du groupe `create`, puis appelle `ingestion.accept` **en mémoire**.
- Le reçu actuel porte `scope: in_memory_staging_only`, `saved_to_disk: false`, `published: false`, `scientific_approval: false`.
- Le moteur worker ne doit pas recevoir de chemin arbitraire du renderer. La sauvegarde est une opération **distincte**, exigeant une deuxième confirmation humaine après affichage du reçu de simulation.
- Le module `src/framework/publication-store.js` dispose d'une logique de publication et de verrou distincte : ne pas la réutiliser implicitement ni qualifier une importation locale de publication.

## 2. Invariants non négociables

1. Original et corpus cible jamais modifiés sur place ; pas de troncature, append ou écrasement d'une source.
2. Aucun commit automatique après prévisualisation, staging, fermeture de fenêtre ou réouverture.
3. Deux décisions humaines distinctes : (A) sélection/revue des créations pour la simulation ; (B) confirmation de l'enregistrement du résultat simulé.
4. L'identité déclarée du chercheur n'est pas une signature cryptographique ni une authentification (AUD-04 reste ouverte).
5. L'acceptation canonique et ses statuts émanent exclusivement du moteur TEMPORA 3.0.0. Aucune nouvelle classification métier dans l'interface.
6. Une transaction validée fournit toujours **ensemble** un corpus canonique, le journal d'acceptation et un manifeste d'intégrité. Jamais un corpus déclaré enregistré sans journal vérifiable.
7. Collision, source changée, mapping changé, corpus changé, jeton rejoué, entrées non éligibles ou autre session : **refus fermé** sans mutation.
8. `published:false` et `scientific_approval:false` même après une sauvegarde réussie ; la sauvegarde n'est ni publication scientifique ni validation historique.

## 3. API et frontières de confiance

- Créer une opération hôte explicite (nom candidat : `assistant.persistReview`) avec contrat/version propres, non ajoutée silencieusement à `ingestion.stage-review`.
- Le renderer ne transmet **ni chemin libre, ni corpus réécrit, ni journal édité, ni shell/commande**, seulement une référence opaque de simulation et une confirmation explicite.
- Seul le processus Electron principal gère la sélection native d'un dossier de sortie, l'inspection du chemin réel, les permissions, les verrous et les écritures.
- Chaque session de simulation est liée à `source_sha256`, `base_sha256`, `mapping_sha256`, `batch_id`, sélection des IDs, empreinte du journal, empreinte de sortie et version du moteur. Jeton aléatoire à usage unique, court TTL, non réutilisable après échec terminal.
- Avant toute création : rouvrir/re-lire source et corpus par leurs descripteurs sûrs ; revalider les empreintes ; recalculer preview+accept dans le worker fiable, puis comparer **toutes** les empreintes au staging affiché. Refuser si divergence. Ne pas sérialiser/transférer des corpus complets au renderer.
- Faire évoluer le protocole worker par version ou nouvelle opération allowlistée, avec limites de taille et timeout explicites ; les opérations historiques doivent conserver leurs réponses exactes.
- Pour tout flux sensible : codes d'erreur stables, sans contenu source, secret, pile ni chemin absolu dans IPC/logs.

## 4. Transaction sur disque : publication d'un ensemble indivisible

**Important :** deux `rename` indépendants sur `corpus.json` et `journal.json` ne forment PAS une transaction atomique. Choisir un format de transaction immuable vérifiable, avec un unique point de visibilité.

Structure candidate sous un dossier explicitement choisi :

```text
TEMPORA-imports/
  transactions/
    <transaction-id>/
      corpus.json
      journal.json
      manifest.json
  .pending/
    <random-transaction-id>/
  HEAD.json                 # pointeur optionnel vers dernière transaction validée
```

1. Écrire **exclusivement** dans un répertoire temporaire unique sous le même volume que `transactions/`, créé avec permissions restrictives, sans suivre de liens symboliques/reparse points non fiables.
2. Générer un corpus canonique validé, le journal moteur intact et un manifeste versionné contenant au minimum : `transaction_id`, `batch_id`, `source_sha256`, `base_sha256`, `mapping_sha256`, `output_sha256`, hash du journal, version moteur, versions du contrat et décision humaine. Pas d'horodatage non déterministe dans les empreintes du corpus.
3. Écrire les trois fichiers en mode exclusif, flush/fsync approprié, puis relire et vérifier hashes, schémas et relation du journal au corpus. Bloquer en cas de dépassement des budgets.
4. Renommer **le répertoire complet** vers un ID de transaction immuable non existant sous `transactions/` sur le même volume. C'est le point de visibilité logique de la transaction; ne pas promettre une durabilité système absolue sans tests de crash/power-loss sur les volumes ciblés.
5. Ne rendre `HEAD.json` actif qu'après vérification du dossier final, en écrivant un nouveau pointeur temporaire et en le remplaçant atomiquement *lorsque l'API/FS le garantit*. Si le remplacement atomique ou les garanties de flush ne peuvent être prouvés sur Windows, conserver seulement la transaction immuable et reconstruire l'index à partir des manifestes validés.
6. Aucun remplacement silencieux d'une transaction existante ; rejet de collisions et refus d'écriture dans les répertoires sources.
7. Reprendre après crash par **inspection en lecture seule** des transactions finalisées et des `.pending` orphelins ; ne supprimer aucun dossier orphelin automatiquement. Fournir une action de récupération/abandon manuelle, journalisée, sans heuristique fondée uniquement sur PID.

La visibilité logique et la durabilité après coupure électrique sont deux propriétés distinctes ; les qualifier séparément dans les tests.

## 5. Sécurité Windows et concurrence

- Vérifier chemins, symlinks, jonctions, racines réseau, volumes différents, fichiers verrouillés, ACL et changement du répertoire entre contrôle et écriture (TOCTOU).
- Un seul writer par cible, avec réservation exclusive; ne jamais détruire un verrou sans preuve de propriété. Étudier le protocole AUD-03 plutôt que le contourner.
- Bloquer toute écriture dans le répertoire du package Electron, les ressources `app.asar`, ou le dossier de corpus source.
- Annulation avant commit : aucune transaction visible. Annulation après commit : conserver le reçu et informer du succès, jamais annoncer à tort un rollback.
- Redémarrage : réconcilier le journal et le manifeste uniquement par comparaison cryptographique et validation canonique, pas par noms de fichiers.

## 6. Contrat de reçu (proposition, non implémentée)

```json
{
  "schema_version": "1.0.0",
  "scope": "local_canonical_import",
  "saved_to_disk": true,
  "published": false,
  "scientific_approval": false,
  "transaction_id": "<opaque-id>",
  "batch_id": "<sha256>",
  "source_sha256": "<sha256>",
  "base_sha256": "<sha256>",
  "output_sha256": "<sha256>",
  "journal_sha256": "<sha256>",
  "integrity_verified": true
}
```

Le chemin de sortie ne doit pas être exposé dans une erreur IPC ; si affiché à l'humain, le faire par le processus principal avec une politique de divulgation explicite. Ne pas afficher `saved_to_disk:true` avant preuve effective de commit.

## 7. Qualification et critères de fusion

| Test | Attendu |
|---|---|
| Simulation puis fermeture | 0 corpus/journal persisté |
| Confirmation de stockage sur source stable | 1 transaction canonique complète, manifestes et hashes vérifiés |
| Source/corpus/mapping changés après simulation | refus; 0 transaction |
| Sélection conflit, inchangé ou quarantaine | refus |
| Jeton rejoué ou session croisée | refus |
| Crash avant renommage final | aucune transaction visible; `.pending` récupérable |
| Crash après renommage | transaction complète vérifiable; aucune seconde écriture |
| Concurrence de deux processus | au plus 1 commit pour une même réservation; refus explicite |
| Disque plein, ACL interdites, symlinks et jonctions | refus sans corruption de corpus existant |
| Fichier de manifeste/journal altéré | détection à la réouverture |
| Windows 10/11 vierges, mode hors ligne | fonctionnement avec le runtime Chromium/worker embarqué |
| Compatibilité worker historique | `preview`/`stage-review` inchangés |

Tests unitaires (commit/rollback/reprise), adversariaux, Electron IPC, Windows NSIS + AppX et SDK Linux. Benchmarks avec budgets de mémoire, taille disque, durée de relecture; aucune nouvelle release ou soumission Store dans cette PR.

## 8. Ordre d'implémentation

1. Contrat et fixtures : inventaire des schémas exacts de `outcome.corpus` et `outcome.journal`, vecteurs golden; threat model.
2. Module `transaction-store` pur Node, testé indépendamment de l'interface ; stratégie de sécurité Windows et de fsync prouvée.
3. Adaptateur worker autorisé avec remise en cause du staging et zéro chemin arbitraire transmis par l'UI.
4. Hôte Electron : références opaques, boîte de dialogue native et confirmation distincte.
5. UX FR/EN accessible ; reçu et erreurs bornés.
6. Qualification complète ; seulement ensuite PR fusionnable vers `main`. Mise à jour du registre Audit dans chaque lot.

**Interdit pendant ce chantier :** publication Store automatique, changement d'identité MSIX, nouvelle release npm, import automatique ALNOP, mise à niveau silencieuse du schéma canonique ou suppression des sources Tauri archivées.


## 9. Qualification incrémentale — verrou hôte (2026-11-09)

Le module `review-persistence-coordinator.cjs` contient désormais un indicateur
`committing` acquis de façon synchrone avant tout `await` et libéré dans un
`finally`. Il refuse une nouvelle simulation et un second commit pendant
l'exécution de la relecture, du recalcul SDK et de la persistance, y compris
si un callback lance une exception. Les tests reproduisent une relecture native
suspendue et un échec de lecture, pour vérifier l'absence d'écriture concurrente
et la réutilisabilité ultérieure du coordinateur.

**Limitation essentielle :** ce garde ne concerne qu'**une instance d'un seul
processus Node**. Il n'interdit pas une écriture dans une autre instance de
TEMPORA Desktop, ni un autre processus ou une copie de l'application, ni
l'altération malveillante du répertoire de destination. La sécurité
interprocessus du point 5 et le verrou de cible restent **bloquants** pour le
raccordement Electron ; aucune promesse de transaction globalement sérialisée
n'est faite. De plus, un second enregistrement d'un lot inchangé après la fin
d'un premier commit doit être traité par une politique de déduplication/index
explicite avant disponibilité GUI.

La CI doit prouver ce lot sur Ubuntu et Windows. Les tests ne constituent pas
des essais de crash physique, de systèmes de fichiers réseau ou de reparse
points Windows. Aucun nouveau point d'entrée IPC n'est autorisé à ce stade.

### Annulation de session pendant relecture asynchrone

La fermeture de session (`revoke(handle)`) et l'arrêt hôte (`clear()`)
marquent désormais l'opération active comme annulée. Après la résolution de
la relecture asynchrone, le coordinateur refuse toute écriture si l'opération
est annulée. Deux tests simulent une lecture suspendue pendant la fermeture ou
l'arrêt, puis vérifient qu'aucune transaction n'est produite.

**Frontière d'atomicité :** une annulation reçue une fois que `persist()` a
commencé ne peut pas promettre de rollback. Le code appelant devra communiquer
le reçu réel de l'écriture, qu'elle ait réussi ou échoué. La fermeture de
l'interface ne doit jamais effacer une transaction déjà validée.


### Réservation exclusive entre processus (prototype)

La création d'une transaction acquiert désormais, via `mkdir` exclusif,
un dossier `.writer-lock/` dans la racine de destination. Un marqueur
`owner.json` aléatoire appartient à l'instance ayant acquis la réservation.
Une nouvelle instance refuse l'écriture si le dossier existe ; **aucun PID ni
horodatage n'est utilisé pour prétendre qu'un verrou est périmé**. En sortie
normale, le marqueur est relu, comparé et libéré seulement si l'identité
attendue est inchangée. En cas de crash, l'orphelin reste en place pour
inspection et récupération humaine explicite.

**Cette protection n'est pas encore une preuve de sûreté Windows complète** :
la substitution du répertoire entre deux contrôles, les reparse points et
jonctions, les ACL, les volumes partagés et la durabilité du marqueur au crash
nécessitent une qualification spécifique. La restauration manuelle d'un
verrou doit commencer par une inspection contradictoire et un arrêt attesté
de tous les writers, jamais par une suppression automatique. La déduplication
des lots déjà enregistrés est un sujet séparé, encore ouvert.

La fonction `inspectWriterReservation(root)` permet désormais de constater, **en lecture seule**, une réservation absente, conforme ou suspecte (`absent`, `reserved`, `unsafe`). Elle ne renvoie ni propriétaire prétendument actif ni recommandation de suppression automatique. Les tests vérifient aussi l'absence de mutation et la conservation d'un verrou malformé.
