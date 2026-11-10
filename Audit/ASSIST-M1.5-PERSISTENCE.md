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


### Déduplication exacte, intégrité du passé et test du propriétaire (lot suivant)

Sous réservation exclusive `.writer-lock`, `createTransaction` inspecte
l'inventaire canonique existant avant de créer un dossier `.pending`.
Il refuse tout rejeu ayant **les cinq mêmes empreintes d'identité**
(`batch_id`, `source_sha256`, `base_sha256`,
`mapping_sha256`, `output_sha256`) par
`TRANSACTION_ALREADY_COMMITTED`. Deux acceptations d'une même source et
d'une même base produisant des **sorties différentes** restent autorisées :
ne pas confondre un `batch_id` partagé avec une décision humaine identique.

Si une ancienne transaction est invalide, tout nouvel enregistrement est refusé
(`TRANSACTION_PREEXISTING_INVALID`) : la corruption ne doit pas être
masquée par une nouvelle création. Ce choix privilégie l'intégrité à la
disponibilité et exigera une procédure documentée de résolution manuelle.
Le marqueur du verrou a été corrigé pour produire une ligne JSON parseable,
et un test inspecte **le propriétaire réel pendant le commit**, avant la
libération du verrou.

Ces garanties sont locales au répertoire choisi, à l'état de son inventaire
et à la robustesse du verrou : elles ne constituent ni une preuve d'authenticité
du chercheur ni une durabilité en cas de panne électrique. Les tests CI et les
reparse points Windows restent des gates de qualification.


### Qualification des interruptions (simulation contrôlée, hors coupure électrique)

Deux tests instrumentent `fs.renameSync` pour provoquer un échec `EIO` au
moment précis de rendre visible une transaction. Ils contrôlent qu'aucune
transaction partiellement écrite n'apparaît dans `transactions/`, que les
trois fichiers restent présents dans `.pending/`, qu'une transaction
antérieure demeure intacte, et que la réservation appartenant au processus
est libérée en cas d'échec normal.

**Important :** simuler une exception Node n'est pas simuler un crash du
processus, un reset Windows ni une panne électrique. Le test valide le chemin
d'erreur avant renommage, pas la durabilité des écritures déjà validées.
Le moteur laisse les `.pending` pour inspection, sans promotion ni suppression
automatique. Une qualification de journalisation et des essais de reprise sur
NTFS/Windows restent nécessaires avant activation de l'interface.

Un test supplémentaire lance un **second vrai processus Node** pendant que le
premier conserve sa réservation exclusive. Le processus fils tente d'écrire
dans la même racine et doit recevoir `TRANSACTION_WRITER_BUSY`, sans
affecter la transaction du processus parent. L'essai doit passer dans les
jobs CI Windows et Ubuntu. Il ne prouve pas le comportement en présence
d'un partage SMB, d'une jonction NTFS malveillante ou d'un crash du système.


### Blocage après une interruption non résolue

Avant chaque nouveau commit, et pendant que la réservation exclusive est
détenue, le store inspecte maintenant aussi `.pending/`. La présence d'au
moins une entrée orpheline déclenche
`TRANSACTION_PENDING_RECOVERY_REQUIRED`, sans création d'une nouvelle
transaction ni suppression, déplacement ou promotion automatique de l'orphelin.
Une transaction finalisée antérieure doit rester byte-for-byte intacte.

Cette politique privilégie la conservation des preuves : une interruption
peut bloquer les sauvegardes suivantes jusqu'à une procédure de reprise
manuelle encore à implémenter et qualifier. Les deux tests ajoutés contrôlent
la présence d'un orphelin partiel et la protection d'une transaction déjà
validée. Le comportement sous crash complet et redémarrage Windows reste à
tester avec des processus réels et des essais sur le volume cible.


### Inventaire forensique sans mutation — récupération M1.5

`inspectPendingEvidence(root, canonical)` classe chaque dossier orphelin
`.pending/<id>` en trois ensembles : `verified_for_review` lorsque le
corpus, le journal, le manifeste et leurs relations cryptographiques satisfont
aux contrôles ; `incomplete` lorsque des fichiers attendus manquent ;
`unsafe` lorsque le nom, le type, les fichiers présents, le contenu JSON,
les empreintes ou le schéma canonique sont suspects.

Les résultats sont **en lecture seule** : l'inspection ne crée aucun dossier,
ne déplace jamais un candidat et n'efface aucun élément. La catégorie
`verified_for_review` **n'autorise ni promotion automatique ni publication
scientifique**, car la décision humaine, l'historique d'exécution et la
durabilité ne peuvent pas être inférés de ces seules empreintes.

Trois tests couvrent la racine vide, un dossier entièrement écrit mais dont
le `rename` final a échoué, et la séparation entre dossier incomplet et
dossier contenant un fichier inattendu. Les prochains gates comprennent les
essais de crash réels, une procédure de récupération manuelle explicite,
et la qualification Windows NTFS/reparse points.

 
## 10. Lot de qualification consolidé — diagnostic opérationnel et arrêt de processus

- `recovery-assessment.cjs` rassemble l'inventaire canonique des transactions,
  le statut du verrou exclusif et les candidats de `.pending`. Il refuse une
  photographie incohérente si les ensembles de candidats divergent.
- `electron/scripts/assess-recovery.cjs` expose un **diagnostic CLI hors ligne
  strictement en lecture seule**, avec codes de sortie 0 (sans blocage),
  2 (intervention nécessaire) et 3 (erreur). Aucun chemin ni document
  n'est envoyé au renderer, au réseau ou à un outil de publication.
- Des tests créent un véritable processus enfant, qui se termine
  volontairement immédiatement **avant** ou **après** `renameSync`.
  L'instance parente vérifie ensuite le verrou orphelin, le nombre de
  transactions visibles et les pièces conservées en `.pending`.
- Le manuel `ASSIST-M1.5-RECOVERY-RUNBOOK.md` documente la lecture des
  rapports et les interdictions de suppression/promotion automatique.
- Ces scénarios sont intégrés dans la CI Desktop existante sur Ubuntu et
  Windows, sans ajout de workflow GitHub.

**Gates non levés :** tests de panne électrique/OS, sémantique NTFS sur
arrêt brutal, symlink et reparse points avec concurrence malveillante,
reprise manuelle autorisée, seconde confirmation dans l'interface et
raccordement Electron/worker. La PR reste expérimentale.


## 11. Intégration Desktop limitée au diagnostic (lot Chromium)

L'interface Assistant Electron dispose désormais d'un bouton
**« Examiner des transactions interrompues (lecture seule) »**.
L'utilisateur sélectionne explicitement une racine de transactions avec la
boîte de dialogue **native** Windows ; le renderer ne peut passer aucun chemin
en argument. Le processus principal exécute `assessRecovery` avec le SDK
canonique chargé à partir des **ressources du worker embarqué** par
`createRequire(runtime.worker)`. En développement, le chemin du worker
local est utilisé. L'action retourne seulement un rapport borné (100 entrées
maximales par liste ; 32 Kio max) et supprime les chemins absolus des erreurs
IPC. Le rendu utilise `textContent` et ne transforme aucune donnée de
corpus en HTML.

Les deux modules nécessaires (`recovery-assessment.cjs` et
`transaction-store.cjs`) font désormais partie de l'archive Electron.
Un test de contrat `host.test.cjs` vérifie le canal allowlisté, le sélecteur
natif, l'absence de fonction de sauvegarde dans `preload.cjs` et les
ressources packagées.

**Limites** : le bouton ne fournit aucune récupération, suppression ou
publication. Il ne donne aucune autorisation d'écriture et ne représente pas
une validation scientifique. La protection filesystem Windows et le
raccordement de la **seconde décision humaine de sauvegarde** restent des
gates bloquants pour l'activation de M1.5. Le rapport est une photographie
potentiellement concurrente : la validation finale de toute écriture devra
toujours être répétée sous réservation exclusive.


## 12. Jalonnement accéléré — parcours de sauvegarde hôte isolé

Le lot contient désormais `native-persistence-workflow.cjs`, une composition
**strictement interne au processus hôte** du coordinateur de seconde décision,
du sélecteur natif de destination et du stockage canonique. Aucune opération
d'écriture n'est ajoutée au contrat `preload.cjs` ou aux canaux IPC :

- `offer` reçoit uniquement un staging d'origine worker et une fonction de
  relecture de source/corpus fournie par le processus de confiance.
- `confirmAndCommit` ne prend que le handle de session et le jeton. Il ouvre
  la **confirmation native**, puis le sélecteur de dossier **natif**. Une
  destination inventée par le renderer est ignorée.
- Après autorisation, le recalcul du SDK 3.0.0 est exécuté avec l'instance
  explicitement fournie par l'hôte ; les empreintes sont comparées et seule
  l'issue conforme est transmise au stockage.
- La révocation de session ou l'annulation d'une boîte de dialogue empêche
  toute écriture ; le jeton est consommé. Un seul parcours peut être actif.
- Le service et les modules d'autorisation sont inclus dans le packaging
  Electron, avec tests synthétiques en CI Windows et Linux.

**Qualification complémentaire Windows :** des tests adversariaux essaient
de remplacer les dossiers `.pending` et `transactions` par des jonctions
NTFS (ou liens symboliques Unix) et exigent un refus sans écriture dans le
répertoire cible. Les racines de volume et les destinations UNC/device Windows
sont désormais interdites pour l'écriture locale par le prototype. Ces
contrôles ne démontrent pas encore l'absence de race TOCTOU lors d'un
remplacement *pendant* l'écriture, ni l'impossibilité d'utiliser un lecteur
réseau mappé, ni la durabilité après coupure électrique.

**Critère restant pour la mise à disposition GUI :** raccorder le processus
principal aux callbacks de sélection, relecture et confirmation depuis des
sessions Electron vérifiées ; qualifier la résistance aux substitutions de
chemins et à la perte de puissance Windows ; tester les installations et la
récupération humaine. Jusqu'à cette qualification, le renderer n'a **aucune
méthode de sauvegarde M1.5** ; seule l'inspection reste disponible.
