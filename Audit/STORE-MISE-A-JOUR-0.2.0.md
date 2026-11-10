# TEMPORA Desktop — Dossier de préparation Microsoft Store, version 0.2.0

> **Statut : CANDIDAT, non soumis et non publié.** La PR #114 ne doit être fusionnée qu'après succès des trois workflows pour son HEAD final et validation du package AppX. Les P0 M1.5 demeurent non résolus : cette livraison **n'active pas le writer scientifique expérimental**.

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
- **Nouvelle CI du package Store 0.2.0 : à inscrire ici avec SHA/runs/résultats.**
- **SHA de fusion et CI sur `main` : à inscrire après action.**
- **Store : candidat seulement ; aucune soumission ni publication effectuée.**

## 6. Instructions pour un nouveau chat

Commencer par `Audit/REPRISE-TRAVAUX.md` puis ce dossier et `Audit/TEMPORA-ETAT-AVANCEMENT.md`. Vérifier le HEAD `main`, l'état PR #114, le package AppX et les CI associés. Poursuivre la suite P0 sur une **nouvelle branche** ; ne jamais reprendre les expérimentations directement sur `main` ou créer un nouveau Store upload sans contrôle.

