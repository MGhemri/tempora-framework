# Contribuer à TEMPORA et à ses profils

## Contribuer au framework TEMPORA

Pour modifier les contrats, le chargeur ou les validateurs communs, proposer une Issue ou une Pull Request décrivant le comportement attendu et les vérifications de compatibilité. Le noyau doit rester indépendant des périodes, territoires et vocabulaires d’un profil. Les exemples synthétiques restent séparés des corpus publiés.

## Contribuer au profil ALNOP / المساهمة في ALNOP

Le formulaire de l’application concerne le corpus ALNOP. Il ne sert pas à enregistrer un nouveau profil TEMPORA.

Le corpus est incomplet et en enrichissement. Ne jamais compléter un fait historique par supposition.

## Proposer

Depuis `contribute.html`, remplir les champs adaptés au type de proposition, vérifier le récapitulatif, puis cliquer sur « Envoyer la proposition au mainteneur ». Le site transmet automatiquement le contenu par courriel, avec des copies Markdown et JSON jointes et une référence de suivi. Aucun compte ni nom n'est requis ; une adresse de réponse peut être fournie facultativement.

La confirmation signifie que le serveur SMTP a accepté le message pour le mainteneur. Elle ne constitue pas une validation historique ni une publication. En cas d'erreur, la proposition reste affichée et peut être réessayée ou téléchargée. Ne pas fermer la page avant de l'avoir envoyée ou sauvegardée.

Sur GitHub Pages, les Issues restent une alternative publique : le pseudonyme et l'historique peuvent être visibles. Le téléchargement seul n'est pas un envoi. Le parcours Vercel reste sur le site, sans lien de dépôt.

Donner les IDs concernés, les valeurs proposées et divergentes, les incertitudes et une référence précise (titre, auteur, date, page ou cote et URL éventuelle). Sans source, justifier son absence ; cela ne permet pas une publication directe. Ne pas téléverser un document protégé sans autorisation.

## Passer d’une proposition à une publication

1. Un mainteneur examine la proposition et demande les informations manquantes.
2. Une PR distincte présente les changements canoniques et leurs preuves, sans écraser les assertions contradictoires.
3. Exécuter `npm ci`, `npm test` et `npm run check:canonical`. Pour l'interface : `npx playwright install chromium` puis `npm run test:browser`.
4. Un mainteneur habilité documente sa décision et valide avant fusion. Les modifications historiques substantielles doivent demander une seconde lecture lorsque possible ; la règle finale reste à décider.
5. Vérifier la génération des exports et le déploiement après fusion. Le canon est désormais relié aux exports publics. La publication exige une revue documentée puis les validations du déploiement.

Les brouillons et Issues non validées n'entrent pas dans les données publiques. Aucun script ne modifie le corpus depuis une Issue.

## العربية

المتن غير شامل وقيد الإثراء. لا تُكمل الوقائع بالافتراض. استخدم صفحة المساهمة أو نماذج GitHub، مع ذكر معرّفات البطاقات والمراجع الدقيقة ومواضع عدم اليقين. بعد مراجعة الملخص، اضغط إرسال المقترح ليرسل الموقع المحتوى بالبريد إلى المشرف. لا يلزم اسم أو حساب؛ عنوان الرد اختياري. يظهر التأكيد فقط بعد قبول خادم البريد للرسالة. عند الخطأ، أعد المحاولة أو نزّل الملف؛ التنزيل وحده ليس إرسالاً. غياب المصدر يوقف النشر. تخضع التغييرات لمراجعة بشرية موثقة قبل الدمج، ولا تُضاف المقترحات غير المعتمدة إلى البيانات المنشورة.

## Champs selon le type de proposition

- Nouvelle opération : aucun identifiant à créer ; le mainteneur l'attribue après validation. Date/période et lieux facultatifs si inconnus ; conserver les incertitudes.
- Correction : sélectionner une fiche existante, indiquer le champ, la valeur actuelle et la correction justifiée.
- Source : sélectionner une fiche existante et fournir obligatoirement une référence.
- Doublon : sélectionner deux fiches différentes et expliquer les points communs et différences.
- Contradiction : sélectionner la fiche et détailler les affirmations divergentes et leurs références.
- Toponyme : indiquer le nom et sa variante ; association à une fiche existante facultative.

La liste défilante affiche un compteur et permet une recherche par nom FR/AR, identifiant, année ou lieu. Effacer la recherche réaffiche toutes les fiches ; l’intitulé complet de la sélection reste visible.

Le formulaire charge les fiches du corpus : il ne permet pas de saisir un nouvel ID dans le sélecteur. Les modèles GitHub demandent de copier les IDs existants ; la revue vérifie leur existence. Aucune proposition ne crée automatiquement de fiche ou d'identifiant.

## Exploitation de la messagerie (mainteneur)

Configurer `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `CONTACT_DEST` dans les variables serveur Vercel. `CONTRIBUTION_DEST` est facultatif et remplace le destinataire pour les propositions. Aucun secret ne doit être commité. Les variables ajoutées nécessitent un nouveau déploiement.

`POST /api/contributions` valide les champs et les identifiants, n'accepte aucun destinataire fourni par le visiteur et n'écrit pas dans le corpus. Les limites anti-abus et la déduplication sont en mémoire par instance ; elles ne constituent pas une protection distribuée ni une garantie d'envoi exactement une fois. Une même tentative conserve sa référence et son Message-ID. La réception dans la boîte finale n'est pas vérifiée par le site.

## Préparer et publier une contribution acceptée (mainteneur)

1. Enregistrer la pièce jointe JSON reçue dans un emplacement de travail privé. Pour une nouvelle opération : `node scripts/prepare-contribution.js --input chemin/proposition.json --id IDENTIFIANT_ATTRIBUE_PAR_LE_MAINTENEUR`. L’outil produit un brouillon dans work/prepared ; aucun ID n’est choisi par le visiteur.
2. Vérifier les sources et leurs passages, structurer la notice bibliographique, compléter le type dans le vocabulaire contrôlé, documenter dates et territoires sans supposer les valeurs manquantes. La citation brute reçue reste une note de travail tant qu’elle n’est pas structurée.
3. Préparer une PR avec la fiche sous data/operations et ses sources sous data/sources. Pour une correction, garder l’objet legacy initial intact et modifier les champs canoniques du profil human_review.
4. Documenter la décision de revue avec reviewer, decision, reference, reason et reviewed_at ; mettre à jour updated_at. Seule une fiche avec sources, dernière décision approved et human_review_recorded=true peut passer à published. Un enregistrement de revue ne remplace pas la revue humaine réelle.
5. Exécuter `npm run validate:canonical`, `npm run build`, `npm test`, `npm run test:browser`, `npm run check:canonical` et `npm run check:documentation`. Inclure les exports générés dans la PR. Le build refuse les fixtures synthétiques dans le corpus réel.
6. Après revue et fusion, les déploiements publient les sorties validées. Vérifier ensuite les données et l’API en ligne. Aucune fiche fictive ne doit être utilisée pour cette étape réelle.

Le dictionnaire DATA_DICTIONARY.md précise les profils et limites. Le snapshot des 263 fiches initiales reste protégé ; les futurs ajouts ne doivent pas nécessiter de réécrire ce snapshot ni les contrats de référence.
## Enregistrer une assertion ou une contradiction après réception

Le formulaire « Signaler une contradiction » transmet une proposition aux mainteneurs. Sa réception par courriel n’ajoute aucune assertion publique.

Le mainteneur relève séparément chaque version dans `data/claims/<id>.json`, selon `schemas/claim.schema.json`. Il renseigne la fiche concernée, la propriété, la valeur, les sources et leurs passages précis. Pour une divergence, il conserve les deux assertions et renseigne `contradicts` après examen ; aucune fusion n’est automatique.

La publication nécessite la revue documentée de chaque assertion et des liens cohérents entre les deux versions. Le guide complet figure dans [Assertions, sources et contradictions](PROVENANCE_POLICY.md). Les exemples fictifs des tests ne doivent jamais être copiés dans les données de production.
## Livrables et autorisation de publication

Les spécifications de travail, audits et bilans de corrections sont conservés hors du dépôt et des répertoires déployés. Seules les documentations d'utilisation, de méthode et de contrats effectivement implémentés sont destinées à la publication. Les schémas, fixtures de référence et indicateurs documentaires du corpus restent des éléments techniques du projet.

Préparer les modifications et leurs vérifications dans l'arbre de travail. Un commit, push, tag, déploiement ou release nécessite une instruction explicite du mainteneur. Utiliser uniquement l'identité Git déjà configurée, sans la modifier et sans ajouter de signature d'outil ou d'attribution automatique. Conserver les attributions et notices de tiers exigées par leurs licences. Ne pas réécrire l'historique sans autorisation explicite.

Exécuter `npm run check:publication-files` pour vérifier l'absence de spécifications et de rapports internes dans les fichiers destinés à la publication.

## Vérifier les référentiels et les doublons candidats

Le mainteneur peut lancer `npm run quality:duplicates` avant de publier une nouvelle fiche. Les correspondances proposées doivent être examinées ; aucune fusion n’est automatique. Toute modification publique requiert une nouvelle revue liée à l’empreinte du contenu. Les référentiels et les commandes sont décrits dans [le guide de revue](ENTITY_REVIEW_GUIDE.md).
