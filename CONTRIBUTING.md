# Contribuer à TEMPORA Framework

Décrire dans une Issue ou une Pull Request le comportement attendu, les profils concernés et les cas de vérification. Les modifications des contrats publics doivent préciser leur compatibilité et leur versionnement.

## Développement

Node.js 20 ou supérieur et npm suffisent pour le framework.

```sh
npm ci
npm test
npm run test:standalone
npx playwright install chromium
npm run test:browser
```

Le noyau, le SDK, la CLI et les scripts génériques ne doivent pas importer de module historique ou charger implicitement un corpus. Les exemples utilisent des données fictives identifiées comme telles. Une proposition techniquement valide reste soumise à une revue scientifique avant publication.

## Documentation et site

Modifier les sources Markdown sous `docs/reference/` et `docs/site-src/`, puis exécuter `npm run build:site` et `npm run check:site`. Le workflow Pages publie uniquement `work/pages`. Les rapports privés, cahiers des charges, journaux de revue et données non approuvées restent hors du dépôt et des artefacts publics.

## Compatibilité facultative

Le guide [ALNOP](compatibility/alnop/README.md) décrit les tests minimaux et complets. Une modification des références ou empreintes nécessite une revue explicite ; ne jamais les régénérer pour masquer une régression.

Les commandes historiques `build:legacy`, `test:legacy` et `test:browser:legacy` ont été retirées. Les vérifications du corpus et des API historiques utilisent la suite complète avec une copie ALNOP extérieure épinglée.

## Contributions aux corpus

Les corrections des notices ALNOP suivent le parcours de contribution de [l’application ALNOP](https://alnop.vercel.app/contribute.html) et les règles de son [dépôt historique](https://github.com/MGhemri/aln-historical-operations-dataset). Chaque autre profil définit ses propres règles de provenance, droits et revue. Aucun fait historique ne doit être complété par supposition.

## Sécurité

Signaler confidentiellement les vulnérabilités à contact@connect-gm.com. Ne pas publier de secrets ou d’informations personnelles dans une Issue. Consulter [SECURITY.md](SECURITY.md).
