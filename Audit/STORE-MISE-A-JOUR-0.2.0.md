> **Mise à jour historique (10 novembre 2026) :** le propriétaire a déclaré avoir **publié Desktop 0.2.0** via Partner Center. Les anciennes sections « non soumis/non publié » ci-dessous sont des instantanés d'audit **avant cette déclaration**, pas l'état courant. Une future stable Desktop **1.0.0** est désormais construite depuis main (`7efbc9f0`, workflow #42902639887) en candidats **non signés, non soumis** ; voir [dossier stable 1.0.0](RELEASE-DESKTOP-STABLE-1.0.0.md). Aucune nouvelle publication Store n'est effectuée.

# TEMPORA Desktop — Dossier de préparation Microsoft Store, version 0.2.0

> **Statut actuel : voir [POINT-DE-REPRISE.md](POINT-DE-REPRISE.md) ; PR #114, #116 et #117 fusionnées ; AppX 0.2.0 candidat non soumis et non publié.** Fusion du 2026-11-10 après succès des trois workflows du HEAD final. Les P0 M1.5 demeurent non résolus : cette livraison **n'active pas le writer scientifique expérimental**.

## 1. Motif, périmètre et identité officielle

Une version précédente a été **certifiée dans Partner Center**, le package fourni par le propriétaire étant `TEMPORA-Desktop-0.1.1-beta.2-x64.appx`. La certification d'une version antérieure **ne vaut pas certification** de cette mise à jour. L'interface Chromium/Electron est maintenant candidate pour une mise à jour Store sous `0.2.0` ; **ne pas cliquer Publish now** pour la version précédente et ne pas déposer automatiquement le nouveau package.

Données Partner Center communiquées par le propriétaire :

| Champ | Valeur exacte |
|---|---|
| Product | TEMPORA Desktop |
| Store Product ID | `9P4MN0S3823T` |
| Identity/Name | `GhemriM.TEMPORADesktop` |
| Identity/Publisher | `CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455` |
| PublisherDisplayName | `Ghemri M` |
| Candidate | `0.2.0` — AppX x64 Chromium |
| Target | `AppX` pour Store ; `NSIS EXE` uniquement pour installation classique |
| Soumission | **manuelle dans Partner Center, jamais automatique depuis CI** |

Partner Center : https://partner.microsoft.com/fr-fr/dashboard/products/9P4MN0S3823T/overview

## 2. Ce qui est codé

- `apps/desktop/electron/package.json` : version candidate `0.2.0`, `build.appx.identityName/publisher/publisherDisplayName/applicationId` officiels ; script `npm run dist:store` : `electron-builder --win appx --x64 --publish never`. La construction NSIS est préservée.
- `.github/workflows/desktop-foundation.yml` : **après les tests desktop et le packaging NSIS**, la CI Windows construit un **AppX sans publication**, vérifie que l'archive contient `AppxManifest.xml`, puis vérifie `Identity.Name`, `Publisher`, version `0.2.0.*` et architecture x64. Un artefact temporaire GitHub Actions contient le candidat Store.
- `apps/desktop/electron/local-save-access.cjs` refuse **toujours** le write M1.5 pour `isPackaged===true`, même lorsque `TEMPORA_EXPERIMENTAL_M15_SAVE=1`. Les commandes Rust de sonde sont exclues de l'IPC et ne sont pas un accès Store.
- Le corpus fictif et les exemples ALNOP inclus dans le NSIS continuent d'être testés par le workflow existant ; contrôler leur présence et leur fonctionnalité dans le package Store avant tout dépôt définitif.

## 3. Vérifications obligatoires avant fusion

1. Fixer un SHA exact de la PR #114 et vérifier que les **trois workflows** Framework, Documentation UI, Desktop Foundation sont `completed/success` **sur ce SHA**.
2. Vérifier que le job Windows a bien **fabriqué l'AppX**, contrôlé le manifeste et déposé un artefact `TEMPORA-Desktop-0.2.0-x64-STORE-CANDIDATE-NOT-PUBLISHED`.
3. Vérifier que les tests scientifiques/Rust/IPC et les ressources d'installation passent et que **l'écriture expérimentale packagée est désactivée**.
4. Fusionner la PR #114 seulement lorsque les contrôles requis sont verts ; noter le **SHA du merge** et les nouveaux workflows de `main`. Ne pas confondre CI PR et CI de merge.
5. **Conserver les P0 ouverts** : `SEC-WIN-01/02`, `SCI-01`, `DUR-01`, `REC-01`. La fusion du code **expérimental mais désactivé** ne certifie ni la durabilité NTFS ni une sauvegarde scientifique distribuable.

## 4. Vérifications avant soumission Store (manual gate)

Télécharger l'AppX directement depuis les artefacts **du workflow du SHA fusionné de `main`**, pas depuis une ancienne CI. Contrôler localement SHA-256, identité de `AppxManifest.xml`, version, éditeur et architecture. Tester sur une machine Windows 10/11 propre, hors ligne, y compris le lancement, les exemples, les permissions, l'annulation de revue, la fermeture et le redémarrage. Faire un test de mise à niveau depuis le package `0.1.1-beta.2` déjà certifié et s'assurer de la continuité de la **Package Family Name** (Publisher + Identity), et de l'absence de perte de données.

**Aucun certificat ni secret Microsoft ne doit être committé.** La signature finale et l'acceptation de la mise à jour relèvent de Partner Center et des conditions applicables. Les supports **Arm64** et les essais de compatibilité Windows on Arm restent à traiter dans un jalon ultérieur ; seul x64 est candidat ici.

Une fois le fichier validé, procéder **manuellement** au dépôt dans la nouvelle soumission de TEMPORA Desktop sur Partner Center, contrôler les retours de validation du service, les métadonnées et captures, puis décider séparément **Submit for certification** et **Publish**. **Ne pas utiliser la fiche Ready to publish du package ancien comme preuve que la version 0.2.0 est prête.**

Références publiques :
- https://www.electron.build/docs/appx/
- https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/device-families

## 5. Journal des décisions / reprise

- 2026-11-10 : le propriétaire autorise **la fusion et la préparation** de la mise à jour Store ; cela **n'autorise pas une soumission ni une publication automatique**.
- Dernière base M15-20 pré-Store : `6f5ca82029e8b01717d5c38b9734251095a7c9a7` ; Framework `42846503555`, Documentation `42846503519`, Desktop `42846503497` **success**.
- **Qualification finale Store 0.2.0 :** HEAD `5aca622e5a9346eccbca4d435e109704c8d09005`; Framework `42853241876`, Documentation UI `42853242221`, Desktop Foundation/Windows AppX `42853241862` : **completed/success** sur chaque workflow. [CI et artefact](https://github.com/MGhemri/tempora-framework/actions/runs/42853241862).
- **Fusion effective :** PR #114 fusionnée le 2026-11-10T16:23:57Z ; merge SHA `3c2b7bb752538a8990dad88b1527b0a422c56ca5`, [commit](https://github.com/MGhemri/tempora-framework/commit/3c2b7bb752538a8990dad88b1527b0a422c56ca5). **CI sur `main` à vérifier séparément**, ne pas confondre avec CI PR.
- **Store : candidat seulement ; aucune soumission ni publication effectuée.**

## 6. Instructions pour un nouveau chat

Commencer par `Audit/REPRISE-TRAVAUX.md` puis ce dossier et `Audit/TEMPORA-ETAT-AVANCEMENT.md`. Vérifier le HEAD `main`, l'état PR #114, le package AppX et les CI associés. Poursuivre la suite P0 sur une **nouvelle branche** ; ne jamais reprendre les expérimentations directement sur `main` ou créer un nouveau Store upload sans contrôle.



## 7. Résultat réel de la fusion et de la construction Store (2026-11-10)

**FUSION CONFIRMÉE** par GitHub : PR #114 → `main`, merge SHA `3c2b7bb752538a8990dad88b1527b0a422c56ca5` à 16:23:57 UTC.

**Qualification préalable complète :** branche de développement au SHA `5aca622e5a9346eccbca4d435e109704c8d09005` ; 3 workflows **SUCCESS** : Framework `42853241876`, Documentation UI `42853242221`, Desktop Foundation `42853241862`. Les contrôles Windows ont réussi, y compris les tests natifs, le NSIS, la génération **AppX** et la vérification du manifeste (éditeur, identité, version et x64).

**Artefact téléchargeable dans GitHub Actions :**
- Nom : `TEMPORA-Desktop-0.2.0-x64-STORE-CANDIDATE-NOT-PUBLISHED`.
- [Workflow 42853241862](https://github.com/MGhemri/tempora-framework/actions/runs/42853241862) ; artefact ID GitHub `13781238941`.
- Taille de **l'archive GitHub** : 196468070 octets ; empreinte **de cette archive** : `sha256:8df67e83b204b3e7998466afe9a8ba7cedfc613190c27918a3fc8c14c16ac5f2`. Cela **n'est pas** l'empreinte de l'AppX qu'elle contient.
- Rétention configurée à 14 jours ; télécharger le fichier de référence avant expiration pour inspection et sauvegarde hors ligne.

**Incidents détectés puis corrigés avant fusion :** syntaxe PowerShell de la vérification du manifeste, GUI/preload avec ancienne version `0.1.2-beta.3` et `electron/package-lock.json` incohérent. Le HEAD final a tous les contrôles verts.

**Étapes manuelles non exécutées :** tester l'AppX sur poste Windows propre et la migration depuis la version Store certifiée antérieure ; vérifier le SHA-256 du fichier AppX lui-même ; contrôler toute validation de l'interface Partner Center ; décider de la soumission à la certification puis, **séparément**, de la publication. Il n'y a eu **aucun upload Store ni release GitHub**.

**Retour après fusion :** règles du dépôt imposent une PR pour toute modification de `main`. Ce compte rendu post-fusion a donc été soumis dans la PR documentaire `docs/store-0-2-0-merge-audit`, sans contourner la protection. Ne pas prétendre que ces dernières notes sont intégrées à `main` avant fusion effective de cette PR documentaire.

**Risques conservés :** `SEC-WIN-01/02`, `SCI-01`, `REC-01`, `DUR-01` bloquent la persistance scientifique native distribuée, même si la base est fusionnée. `local-save-access.cjs` empêche toujours l'écriture packagée.

## 8. Après intégration PR #116/#117 — règle de provenance (2026-11-10)

Le code actuel de `main` est au moins le merge `ed709c4e4ff291fc66bca57437a12172b6a5ac9e` (TVRW J9). Les artefacts précédents liés au HEAD `5aca622` ou au merge `3c2b7bb` **ne contiennent pas la dernière interface GeoLab**. Ne pas confondre « version déclarée 0.2.0 » et identité octet pour octet d'un candidat qualifié.

La PR #117 a produit un nouveau package candidat AppX **sans publication** sur le SHA de développement `e63db25273239018bbb0f170972399c41631d457` : run Windows `42866738978`, artefact `13788106637`, expiration 24/11/2026. Les trois workflows de cette PR ont réussi, mais la construction `main` résultant de la fusion dispose de ses **propres** exécutions à vérifier ; un binaire de PR n'est pas une preuve de qualification du merge. Faire une nouvelle vérification SHA-256 **du fichier AppX lui-même** avant l'éventuelle préparation Partner Center.

**Toujours aucun upload ni clic de soumission/publication Store.**
