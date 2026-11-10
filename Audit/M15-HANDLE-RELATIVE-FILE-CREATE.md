# M1.5 SEC-WIN-01/02 — fichiers créés depuis des handles NTFS

**Statut :** lot expérimental Windows **dans la sonde native seulement**, pas un writer scientifique prêt pour production.

## Changement effectif

La création des fichiers de verrou et de staging par \`std::fs::OpenOptions\` et chemin
absolu est remplacée par une primitive séparée \`relative_io.rs\` :
\`NtCreateFile\` avec \`OBJECT_ATTRIBUTES.RootDirectory\` pointant sur un handle
de répertoire vérifié et conservé ouvert.

- \`FILE_CREATE\` exige une nouvelle entrée, sans écraser un nom déjà existant.
- \`FILE_ADD_FILE\` n'est demandé que pour les répertoires verrou et staging,
  non pour les racines plus générales.
- Le nom doit être un **seul composant** ASCII sûr, sans traversée,
  séparateur, flux alternatif NTFS, périphérique DOS, suffixe suspect.
- Le même handle de fichier reçoit les octets et le flush \`sync_all\`.
  L'écriture ne réinterprète pas un chemin absolu entre create et sync.
- Les tests historiques de relecture, altération, concurrence, crash
  et inventaire native-probe doivent continuer à réussir.

## Contrats de validation

1. Tests Rust Windows : noms sûrs/malveillants, création réellement
   relative à un handle, contenu exact, refus d'écrasement.
2. CI Windows Desktop : commandes \`--synthetic-commit\` et
   \`--synthetic-transport-commit\` avec les fixtures synthétiques, refus
   sans opt-in, symlinks/jonctions, crash points et packaging Chromium
   NSIS + AppX. Le test de transport doit rester sans écriture scientifique.
3. CI Framework et Documentation sur le **HEAD exact** de PR.

## Limites P0

Le répertoire de staging est encore créé par \`fs::create_dir\` avec un
chemin, bien que les ancêtres soient épinglés. Le point de visibilité
utilise toujours un **renommage à cible absolue** avec
\`SetFileInformationByHandle(FileRenameInfo)\` : les races restantes
ne sont pas supprimées par ce lot. \`NtCreateFile\` devra être qualifié
sur machines Windows 10/11 réelles, notamment volume/ACL/antivirus.

\`SEC-WIN-01/02\`, \`SCI-01\`, \`REC-01\` et \`DUR-01\` demeurent ouverts.
\`sdk_validated\` dans une enveloppe n'est pas une signature du chercheur ;
aucun test de crash du processus ne prouve la durabilité après coupure.

**Jamais de publication Store, release, écriture canonique réelle ni
activation du writer packagé par cette modification.**
