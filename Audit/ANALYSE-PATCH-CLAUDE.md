# Revue du patch externe — tempora-audit-fixes.patch

**Origine :** patch transmis le 2026-11-08 dans l'échange d'audit Claude. Les fragments ci-dessous ont été confrontés au code `main` à cette date. Le patch externe brut n'est pas appliqué en bloc : chaque changement doit disposer de sa propre PR et de tests ciblés.

## A5 — Alias de taxonomie

Patch : la taxonomie cible est déduite de la règle de vocabulaire portant sur le champ `event_type`, plutôt que d'une constante `event_types` ; modification des chemins ingestion et couverture. **Retenu.** Correction et test fusionnés dans [#76](https://github.com/MGhemri/tempora-framework/pull/76).

## A8 — Catalogue publié et copie profonde

Patch : congeler récursivement `manifest` et `snapshot` une fois et retourner `entry` directement depuis `resolve` au lieu de `structuredClone(entry)`.

**Non fusionné.** Aujourd'hui `resolve` rend une copie que l'appelant peut manipuler sans modifier le catalogue. Le résultat gelé change le comportement de mutation côté consommateurs, même si le snapshot de publication est déjà validé. Le gain annoncé (0,060 ms → 0,016 ms sur petit corpus) est à mesurer sur davantage de volumes. Envisager une API de projection/pagination ou une version contractuelle d'entrées gelées, pas une substitution implicite.

## A3 — Verrou de publication

Patch : écrit `{pid,at}` dans `.promotion-lock`; en cas de conflit `EEXIST`, teste `process.kill(pid,0)`, retire le fichier si PID absent, puis réacquiert.

**Non fusionné pour raisons de concurrence.** PID peut être réutilisé ; l'absence de PID ne prouve pas qu'un processus ne tient plus la section critique ; une suppression et recréation non atomiques peuvent retirer le verrou d'un autre processus (race ABA) ; le nettoyage par `rmSync(lock,{force:true})` ne vérifie pas qu'il appartient au détenteur. Fichiers sur réseau, Windows et crash à l'écriture du contenu requièrent une politique explicite. Première correction envisageable : **diagnostics stables `STORE_LOCKED`** sur `EEXIST` sans récupération automatique, puis mécanisme de récupération distinct et vérifiable au niveau natif.

## A2 — Revue liée au lot, hors patch

`acceptImport` recalcule le bundle, la base et le `batch_id` mais exige seulement `review.ids`, `review.reviewer`, `review.reason` et `review.reviewed_at`. Cela ne lie pas explicitement l'approbation humaine au lot examiné.

**P0 — prochaine PR fonctionnelle :** ajouter une identité de lot obligatoire à la décision `review` ; un lot différent doit échouer explicitement avant toute acceptation, même avec le même ID sélectionné. Faire apparaître `batch_id` et les empreintes entrée/mapping/base dans l'écran de validation TEMPORA Assistant. Adapter le CLI sans accepter silencieusement des approbations anciennes.

## A4 — Authenticité des publications, hors patch

Les vérifications d'intégrité actuelles sont nécessaires mais insuffisantes pour prouver une signature humaine authentique. Une évolution de signature demande version du manifeste, format de signature, stockage de la clé publique de confiance, gestion des révocations et processus d'approbation indépendant. Ne jamais inventer de signature ou transformer une chaîne de reviewer en identité vérifiée.
