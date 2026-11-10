# ASSIST M1.5 — SCI-01, liaison des cinq SHA au consentement

## Défaut de liaison

Le reçu de staging et le jeton de la deuxième décision hôte conservaient
quatre empreintes (batch, source, base, snapshot). L'empreinte du mapping
était calculée par le SDK, mais pas explicitement présente dans cette
autorisation. Le consentement ne documentait donc pas son identité complète.

## Correction

- Le worker renvoie mapping_sha256 depuis le rapport réel SDK de staging.
- L'hôte Electron exige son égalité avec le mapping du preview antérieur.
- Autorité interne, jeton à usage unique, coordinateur et workflow natif
  lient les **cinq** SHA-256 : batch, source, base, mapping et sortie.
- La relecture SDK avant commit vérifie explicitement la conformité
  mapping_sha256, faute de quoi PERSIST_MAPPING_CHANGED bloque l'opération.
- Tests adversariaux : mapping absent ou modifié, faux reçu worker,
  divergence après seconde décision et absence de transaction sur refus.

## Sécurité et qualification

Le correctif doit passer les trois workflows Framework / Documentation /
Desktop Windows au HEAD exact. La liaison cryptographique des identités
n'est pas la preuve qu'un chercheur a été authentifié : **SCI-01 reste ouvert**.

Ne ferme pas SEC-WIN-01/02, REC-01 ou DUR-01 ; pas de sécurité Win32
handle-relative intégrale, reprise opérateur approuvée ou preuve de durabilité
après perte d'alimentation. L'écriture M1.5 reste interdite dans toute
application Electron packagée ; aucun Store, npm ou release n'est modifié.
