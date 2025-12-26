<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

WWith Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

{
    "Prompt avec contexte IA (env local/prod)": {
    "prefix": "ia",
    "body": [
      "# CONTEXTE :",
      "# Tu es une IA qui doit répondre dans un cadre prédéfini.",
      "# Règles :",
      "# - Le code doit être STRICTEMENT identique entre env local et env prod.",
      "# - Toute nouvelle fonctionnalité doit prendre en compte l'intégralité du projet :",
      "#   * Impact backend (API, logique métier, persistance)",
      "#   * Impact frontend (UI, intégration, cohérence UX) GlideApp like avec utilsation/création de composants",
      "#   * Tests unitaires et end-to-end (e2e) obligatoires",
      "#   * Fourniture et documentation des variables d'environnement (local et prod)",
      "# - Les réponses doivent proposer un plan complet et cohérent, sans oublier les dépendances croisées.",
      "",
      "$0"
    ],
    "description": "Insère un cadre prédéfini pour Codex avec contraintes env local/prod et couverture projet complète"
  },
  "Contexte Basique": {
    "prefix": "iabase",
    "body": [
      "# CONTEXTE : Basique",
      "# Règles :",
      "# - Le code doit être STRICTEMENT identique entre env local et env prod.",
      "$0"
    ],
    "description": "Cadre simple pour prompts rapides"
  },
  "Contexte Checklist": {
    "prefix": "iacheck",
    "body": [
      "# CONTEXTE : Checklist technique",
      "# Règles :",
      "# - Le code doit être STRICTEMENT identique entre env local et env prod.",
      "# - Toute nouvelle fonctionnalité doit prendre en compte l'intégralité du projet.",
      "# - Les réponses doivent toujours inclure une CHECKLIST technique :",
      "- [ ] Backend",
      "- [ ] Frontend",
      "- [ ] Tests unitaires",
      "- [ ] Tests e2e",
      "- [ ] Variables d'environnement (local/prod)",
      "- [ ] Dépendances croisées",
      "$0"
    ],
    "description": "Cadre avec checklist technique"
  },
  "Contexte Roadmap": {
    "prefix": "iaroadmap",
    "body": [
      "# CONTEXTE : Checklist + Roadmap",
      "# Règles :",
      "# - Le code doit être STRICTEMENT identique entre env local et env prod.",
      "# - Toute nouvelle fonctionnalité doit prendre en compte l'intégralité du projet.",
      "# - Les réponses doivent toujours inclure une CHECKLIST et un PLAN DE LIVRAISON.",
      "",
      "Checklist technique attendue :",
      "- [ ] Backend",
      "- [ ] Frontend",
      "- [ ] Tests unitaires",
      "- [ ] Tests e2e",
      "- [ ] Variables d'environnement (local/prod)",
      "- [ ] Dépendances croisées",
      "",
      "Roadmap de livraison attendue :",
      "Étape 1 : Analyse d'impact global",
      "Étape 2 : Implémentation backend",
      "Étape 3 : Implémentation frontend",
      "Étape 4 : Configuration des variables d'environnement",
      "Étape 5 : Tests unitaires",
      "Étape 6 : Tests e2e",
      "Étape 7 : Documentation et validation finale",
      "$0"
    ],
    "description": "Cadre avec checklist + roadmap"
  },
  "Contexte Diagramme": {
    "prefix": "iaarchi",
    "body": [
      "# CONTEXTE : Checklist + Roadmap + Diagramme",
      "# Règles :",
      "# - Le code doit être STRICTEMENT identique entre env local et env prod.",
      "# - Toute nouvelle fonctionnalité doit prendre en compte l'intégralité du projet.",
      "# - Les réponses doivent inclure une CHECKLIST, une ROADMAP et un DIAGRAMME d’architecture.",
      "",
      "Checklist technique attendue :",
      "- [ ] Backend",
      "- [ ] Frontend",
      "- [ ] Tests unitaires",
      "- [ ] Tests e2e",
      "- [ ] Variables d'environnement (local/prod)",
      "- [ ] Dépendances croisées",
      "",
      "Roadmap de livraison attendue :",
      "Étape 1 : Analyse d'impact global",
      "Étape 2 : Implémentation backend",
      "Étape 3 : Implémentation frontend",
      "Étape 4 : Configuration des variables d'environnement",
      "Étape 5 : Tests unitaires",
      "Étape 6 : Tests e2e",
      "Étape 7 : Documentation et validation finale",
      "",
      "Diagramme d’architecture attendu (mermaid) :",
      "```mermaid",
      "flowchart TD",
      "    subgraph Backend",
      "        API --> Persistence",
      "    end",
      "    subgraph Frontend",
      "        UI --> Integration",
      "    end",
      "    subgraph Environments",
      "        Local --> Prod",
      "    end",
      "    API --> UI",
      "    Persistence --> Environments",
      "    TestsUnit --> API",
      "    TestsE2E --> UI",
      "```",
      "$0"
    ],
    "description": "Cadre avec checklist + roadmap + diagramme d’architecture"
  }
}


Trigger staging deploy
