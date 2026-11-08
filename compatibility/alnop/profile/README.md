# Profil ALNOP

ALNOP est le profil historique de référence du framework TEMPORA. Le manifeste déclare ses langues, sa période et ses règles documentaires. Les mappings d’import sont regroupés dans `imports/`.

Les synonymes d'en-têtes propres aux opérations ALNOP sont désormais déclarés séparément dans `assistant-aliases.json` (schéma Assistant `1.0.0`, profil `alnop@1.0.0`). Ils alimentent uniquement les **suggestions** lorsque cette configuration est fournie explicitement à `suggestColumnMappings(headers, profile, aliasBundle)`. Ils ne modifient pas `profile.json`, les mappings d'import `1.0.0`, les données sources ni l'acceptation humaine.

Les données et les adaptateurs de compatibilité permettent de vérifier la migration vers le modèle canonique v3 et la stabilité des formats ALNOP. [Guide du profil](../README.md) · [Modèle canonique](../../../CANONICAL_MODEL.md) · [Atlas ALNOP](https://alnop.vercel.app/)
