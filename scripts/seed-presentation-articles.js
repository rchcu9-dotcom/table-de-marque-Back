// Seed one-shot : injecte le contenu de présentation fourni par Lionel (ancien tableau
// Google Sheet, désormais géré en base via la GUI admin) dans presentation_articles.
// Idempotent : vide la table puis réinsère, donc rejouable sans dupliquer.
//
// Usage : DATABASE_URL=... node scripts/seed-presentation-articles.js

const { PrismaClient } = require('@prisma/client');

function driveThumb(fileId, size = 600) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

const articles = [
  // ---- Présentation / Presentation ----
  {
    groupe: 'Présentation', groupeEn: 'Presentation',
    titre: 'Résumé', titreEn: 'Summary',
    description: `Le tournoi U11 2025 se déroulera à la patinoire du Blizz (http://www.leblizz.com/) - 8 Avenue des Gayeulles, 35000 Rennes du Samedi 24 mai de 9:00 à 21:00 au Dimanche 25 mai de 8:00 à 17:00.`,
    descriptionEn: `The U11 2025 tournament will take place at the Blizz ice rink (http://www.leblizz.com/) - 8 Avenue des Gayeulles, 35000 Rennes from Saturday 24 May from 9:00 am to 9:00 pm to Sunday 25 May from 8:00 am to 5:00 pm.`,
    driveId: '1fBgBRaLnMiagMthr6ibghOFLeyf03ZUa',
    lienUrl: 'Http://www.leblizz.com',
    lieu: '48.132705,-1.650878',
    mapsQuery: '48.1325548,-1.6508351',
  },
  {
    groupe: 'Présentation', groupeEn: 'Presentation',
    titre: 'Informations', titreEn: 'Informations',
    description: `Les équipes effectueront sur glace complète en 5v5 6 matchs minimum et jusqu'à 7 matchs maximum.
Note : dans l'éventualité où le nombre d'équipes inscrites est différent de 12, ce nombre de matchs peut être amené à évoluer. Le planning du tournoi sera communiqué par voie électronique aux contacts des équipes inscrites quelques semaines avant le début du tournoi.

De nombreux challenges d'adresse et de vitesse seront organisés sur la seconde glace tout au long du tournoi pendant les deux jours avec un classement final et des récompenses.

Pour les accompagnateurs, vous avez la possibilité de vous restaurer tout au long du tournoi à la patinoire, des buvettes et un barbecue seront en service. Il y aura également la possibilité de prendre des petits déjeuners à la cafétéria très tôt le matin.

Veuillez noter également qu'une bourse à l'occasion sera organisée.`,
    descriptionEn: `Teams will play 5v5 full ice a minimum of 6 matches and up to a maximum of 7 matches.
Note: in the event that the number of registered teams is different from 12, this number of matches may change. The tournament schedule will be communicated electronically to the contacts of the registered teams a few weeks before the start of the tournament.

Numerous skill and speed challenges will be organized on the second ice throughout the tournament during the two days with a final ranking and rewards.

For accompanying adults, you have the possibility to eat throughout the tournament at the ice rink, refreshments and a barbecue will be in service. There will also be the possibility of having breakfast in the cafeteria very early in the morning.

Please also note that a scholarship will be organized on occasion.`,
    driveId: '1YD7otLsm6O7aQ4F0eJLuKpOP_2lZx_U3',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Présentation', groupeEn: 'Presentation',
    titre: 'Inscription', titreEn: 'Registration',
    description: `L'inscription au tournoi U11 est fixée à 270€ et comprend:

l'inscription au tournoi,
une médaille par joueur,
un trophée par équipe,
et un souvenir du tournoi pour chaque participant.

Vous pouvez régler l'inscription
- par virement bancaire
- ou par chèque.

Le chèque d'inscription de 270€ est à envoyer et libeller au nom du Rennes Cormorans Hockey Club.

Un chèque de caution de 270€ est à joindre au règlement et vous sera restitué après l'état des lieux du vestiaire mis à votre disposition. L'état des lieux sera  fait à votre arrivée.

Les présents règlements doivent être accompagnés du virement ou du chèque pour les repas. Une facture peut vous être envoyée sur demande.

Les chèques sont à établir à l'ordre du Rennes Cormorans Hockey Club.
L'adresse d'envoi est la suivante :
Rennes Cormorans Hockey Club
Tournoi U11
8 Avenue des Gayeulles, 35000 Rennes.

Le lien vers l'inscription en ligne est donné ci-après.`,
    descriptionEn: `Registration for the U11 tournament is set at €270 and includes:

registration for the tournament,
one medal per player,
one trophy per team,
and a souvenir of the tournament for each participant.

You can set the registration
- by bank transfer
- or by cheque.

The registration cheque for €270 is to be sent and made payable to the Rennes Cormorans Hockey Club.

A deposit cheque for €270 is to be attached to the payment and will be returned to you after the inventory of fixtures of the cloakroom made available to you. The inventory of fixtures will be made on your arrival.

These rules must be accompanied by the transfer or cheque for meals. An invoice can be sent to you on request.

Cheques should be made out to the Rennes Cormorans Hockey Club.
The mailing address is as follows:
Rennes Cormorans Hockey Club
U11 Tournament
8 Avenue des Gayeulles, 35000 Rennes.

The link to the online registration is provided here below.`,
    driveId: '1C9IiIjMTweWmDoArbB4Zk4bd3Mtbs5Nu',
    lienUrl: 'https://successful-destruction-9531.glideapp.io/dl/17171d?full=t',
    lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Présentation', groupeEn: 'Presentation',
    titre: 'Repas', titreEn: 'Meals',
    description: `Les repas sont obligatoires pour chaque participant au tournoi. Ils sont facturés au prix de 13€ par enfant et responsable d'équipe (x2). Les deux  repas d'un coach sont offerts.
Les repas sont préparés par un traiteur et donnés dans l'espace restauration de la cafétéria de la patinoire du Blizz.
Merci de nous indiquer les particularités alimentaires de vos joueurs.`,
    descriptionEn: `Meals are mandatory for each participant in the tournament. They are charged at a price of €13 per child and team leader (x2). The two meals of a coach are offered.
Meals are prepared by a caterer and given in the catering area of the cafeteria of the Blizz ice rink.
Please let us know the dietary particularities of your players.`,
    driveId: '1SvL7nSDYoNJiCdnOqEMaweotVq_rQGb6',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Présentation', groupeEn: 'Presentation',
    titre: 'Récompenses', titreEn: 'Rewards',
    description: `Chaque équipe sera récompensée par un trophée, et chaque joueur par une médaille.`,
    descriptionEn: `Each team will be rewarded with a trophy, and each player with a medal.`,
    driveId: '1cEOa4FASmBlKJaeFPOxm-aypGop0e7T_',
    lienUrl: null, lieu: null, mapsQuery: null,
  },

  // ---- Règlement / Rules ----
  {
    groupe: 'Règlement', groupeEn: 'Rules',
    titre: 'Informations', titreEn: 'Informations',
    description: `Un site internet est mis en place pour retrouver toutes les informations (résultats, classements, planning des matchs et de la restauration ainsi que les résultats du challenge).

Le site sera mis à jour quand notre plateau 2025 sera connu. `,
    descriptionEn: `A website has been set up to find all the information (results, rankings, schedule of matches and catering as well as the results of the challenge).

The site will be updated when our 2025 line-up is known. `,
    driveId: '1AM8onyhK2JsjHa6wwncG57XLuhUaxj6a',
    lienUrl: 'http://tournoi.lescormorans.eu/',
    lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Rules',
    titre: "Année d'Age", titreEn: 'Birthdate',
    description: `Pour participer au tournoi, les joueurs doivent être nés en 2014, 2015  ou 2016 (justifiant d'un sur classement) ainsi que les joueuses de 2013. Les équipes doivent être composées de 15 joueurs et 2 Gb maximum et de 10 joueurs et 1 Gb minimum. Chaque équipe doit fournir en début de tournoi un flash licence et un bordereau de match à la table de marque. Chaque équipe doit présenter au minimum un coach licencié pour l'encadrement de son équipe.`,
    descriptionEn: `To participate in the tournament, players must be born in 2014, 2015 or 2016 (with an over-ranking) as well as players from 2013. Teams must consist of 15 players and a maximum of 2 Gb and a minimum of 10 players and 1 Gb. Each team must provide a flash license and a match slip at the scoring table at the beginning of the tournament. Each team must present at least one licensed coach to supervise his team.`,
    driveId: '1fq-QNAzZ1gqla-FcFFpvn0sYJ1KV-yXz',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Rules',
    titre: 'Temps de Jeu', titreEn: 'Time play',
    description: `Les matchs se dérouleront en 1 période de 20 minutes avec changement volant :
Sans arrêt chrono pendant les 18 premières minutes de jeu
Avec arrêt chrono pendant les 2 dernières minutes de jeu
=> Sauf en cas d'écart de 4 buts ou plus.

Note : les pénalités durent 1 minute de temps de jeu effectif avec arrêt du chrono.
Les responsables du tournoi s'autorisent à réduire le temps de jeu en cas de retard sur le planning.
Les matchs de la phase finale se jouent en 26 minutes, sauf la finale vainqueur qui se joue en 2 x 15.
Sans arrêt chrono pendant les 24 (respectivement 28 pour la finale vainqueur) premières minutes de jeu
Avec arrêt chrono pendant les 2 dernières minutes de jeu
=> Sauf en cas d'écart de 4 buts ou plus.
`,
    descriptionEn: `The matches will take place in 1 period of 20 minutes with a change of shuttlecock:
Without a stoppage during the first 18 minutes of the game
With stoppage time during the last 2 minutes of the game
=> Except in the case of a difference of 4 goals or more.

Note: penalties last for 1 minute of effective playing time with stoppage time.
The tournament officials allow themselves to reduce the playing time in the event of a delay in the schedule.
The matches of the final phase are played in 26 minutes, except for the final winner which is played in 2 x 15.
Without a stoppage during the first 24 minutes (respectively 28 for the winning final) of the game
With stoppage time during the last 2 minutes of the game
=> Except in the case of a difference of 4 goals or more.
`,
    driveId: '13SmJfHWziKtSIIDrQ9-LUYGbUr3pv1LJ',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Règlement',
    titre: 'Echauffement', titreEn: 'Echauffement',
    description: `Afin de respecter le planning, les équipes doivent être présentes en bord de piste 5 minutes avant le début de leur rencontre.
Dès que le match en cours se termine, la pause de 3 minutes avant le prochain match est déclenchée.
Les équipes disposent alors de 2 minutes d'échauffement sans palet.
Un Buzzer retentit au bout de 2 minutes.
Les équipes à ce signal doivent alors retourner au banc. Si elles le souhaitent, les équipes peuvent faire leur « cri de guerre », mais uniquement au banc. Les équipes ensuite se mettent en place. Tout cela se fait pendant la minute restante.
Un nouveau Buzzer lance alors le match.`,
    descriptionEn: `Afin de respecter le planning, les équipes doivent être présentes en bord de piste 5 minutes avant le début de leur rencontre.
Dès que le match en cours se termine, la pause de 3 minutes avant le prochain match est déclenchée.
Les équipes disposent alors de 2 minutes d'échauffement sans palet.
Un Buzzer retentit au bout de 2 minutes.
Les équipes à ce signal doivent alors retourner au banc. Si elles le souhaitent, les équipes peuvent faire leur « cri de guerre », mais uniquement au banc. Les équipes ensuite se mettent en place. Tout cela se fait pendant la minute restante.
Un nouveau Buzzer lance alors le match.`,
    driveId: '1eF1WLPT-2hTsb4OdabmfMchWfW8FFNYH',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Règlement',
    titre: 'Déroulement des Rencontres', titreEn: 'Déroulement des Rencontres',
    description: `12 équipes sont attendues cette saison au tournoi U11 du Rennes Cormorans Hockey Club.
Le tournoi se déroulera en deux phases :
Une phase de qualification
Une phase finale`,
    descriptionEn: `12 équipes sont attendues cette saison au tournoi U11 du Rennes Cormorans Hockey Club.
Le tournoi se déroulera en deux phases :
Une phase de qualification
Une phase finale`,
    driveId: '1175LaQTdMHKMWuZ30rb7dDPd2LavycXG',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Règlement',
    titre: 'Phase de qualification', titreEn: 'Phase de qualification',
    description: `Les 12 équipes sont réparties en deux poules de 6 équipes et se rencontrent toutes. Un classement par point est établi selon les règles suivantes :
Pour la constitution des classements, les points sont affectés comme suit,
Victoire 3 Pts
Nul 1 Pt
Défaite 0 Pt
Fair Play 1 Pt (obtenu par défaut, retiré sur avis des arbitres et notifié à la table de marque)

Si deux ou plusieurs équipes sont à égalité de points à l'issue des matchs, elles seront alors départagées selon les critères suivants, pris dans l'ordre :

Le goal-average général
Le résultat direct entre ces équipes
Ensuite la meilleure attaque
Puis le meilleur classement au Fair Play
Et enfin, l'équipe la moins pénalisée (en durée accumulée)

Si après tous ces points une ou plusieurs équipes sont toujours à égalité, l'équipe ayant aligné le joueur le plus jeune sera classée devant.`,
    descriptionEn: `Les 12 équipes sont réparties en deux poules de 6 équipes et se rencontrent toutes. Un classement par point est établi selon les règles suivantes :
Pour la constitution des classements, les points sont affectés comme suit,
Victoire 3 Pts
Nul 1 Pt
Défaite 0 Pt
Fair Play 1 Pt (obtenu par défaut, retiré sur avis des arbitres et notifié à la table de marque)

Si deux ou plusieurs équipes sont à égalité de points à l'issue des matchs, elles seront alors départagées selon les critères suivants, pris dans l'ordre :

Le goal-average général
Le résultat direct entre ces équipes
Ensuite la meilleure attaque
Puis le meilleur classement au Fair Play
Et enfin, l'équipe la moins pénalisée (en durée accumulée)

Si après tous ces points une ou plusieurs équipes sont toujours à égalité, l'équipe ayant aligné le joueur le plus jeune sera classée devant.`,
    driveId: '13Gn3e5akJFh-ZMImlxNtC_ZJx-oOX6jn',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Règlement',
    titre: 'Phase Finale', titreEn: 'Phase Finale',
    description: `Les 2 premières équipes de chaque poule selon le classement établi comme décrit dans la section précédente se rencontrent comme suit :
Le premier de la poule A rencontre le deuxième de la poule B.
Le deuxième de la poule A rencontre le premier de la poule B.
Les vainqueurs de ces 2 matchs se rencontrent lors de la grande finale et les vaincus se rencontrent lors de la petite finale.
Le vainqueur du tournoi est le vainqueur de la grande finale

Les matchs de classement voient les oppositions suivantes :
Les 3ème de chaque poule se rencontrent pour la 5ème place
Les 4ème de chaque poule se rencontrent pour la 7ème place
Les 5ème de chaque poule se rencontrent pour la 9ème place
Les 6ème de chaque poule se rencontrent pour la 11ème place

En cas d'égalité lors de la phase finale, les équipes seront départagées par une séance de 3 tirs de penaltys / shoot out / tir de pénalité, et ensuite au premier qui rate. `,
    descriptionEn: `Les 2 premières équipes de chaque poule selon le classement établi comme décrit dans la section précédente se rencontrent comme suit :
Le premier de la poule A rencontre le deuxième de la poule B.
Le deuxième de la poule A rencontre le premier de la poule B.
Les vainqueurs de ces 2 matchs se rencontrent lors de la grande finale et les vaincus se rencontrent lors de la petite finale.
Le vainqueur du tournoi est le vainqueur de la grande finale

Les matchs de classement voient les oppositions suivantes :
Les 3ème de chaque poule se rencontrent pour la 5ème place
Les 4ème de chaque poule se rencontrent pour la 7ème place
Les 5ème de chaque poule se rencontrent pour la 9ème place
Les 6ème de chaque poule se rencontrent pour la 11ème place

En cas d'égalité lors de la phase finale, les équipes seront départagées par une séance de 3 tirs de penaltys / shoot out / tir de pénalité, et ensuite au premier qui rate. `,
    driveId: '1-w9eqMunjZMu_7F-_QGKtACtmHusmMl2',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Rules',
    titre: 'Règlement', titreEn: 'Penalties',
    description: `Les règles du jeu appliquées sont celles de la fédération internationale de hockey sur glace (IIHF) sauf mention particulière décrite dans ce présent règlement.
Rappel : la pénalité de dernière minute est sanctionnable par un tir de pénalité suivant le règles de l'IHF.
Les mises en échec ne sont pas autorisées.
Les changements volants sont autorisés.
La sortie du gardien est autorisée.
Un temps mort par équipe et par rencontre est autorisé.
Les pénalités durent 1 minute de temps de jeu effectif avec arrêt du chrono.
Un joueur, un responsable ou un coach, en cas de comportement inadmissible sur la glace ou hors glace, pourra être sanctionné d'une pénalité de match, ou d'une expulsion définitive du tournoi, par l'organisateur du tournoi.

En cas de faute grave ou de manquement à la discipline concernant des spectateurs (violences verbales ou physiques, détériorations de matériel ...), la commission sportive du tournoi pourra leur interdire l'accès à la patinoire ou suivant l'importance des faits pourra disqualifier ou interdire une équipe si des parents / accompagnateurs devaient être impliqués.
Seuls les dirigeants, coachs et joueurs des matchs en cours sont autorisés à être sur le bord de la glace.`,
    descriptionEn: `The rules of the game applied are those of the International Ice Hockey Federation (IIHF) unless otherwise described in these rules.
Reminder: the last minute penalty is punishable by a penalty shot according to the IHF rules.
Bodychecking is not allowed.
Flying changes are allowed.
The exit of the guard is allowed.
One time-out per team and per match is allowed.
Penalties last for 1 minute of effective playing time with stoppage time.
A player, manager or coach, in the event of unacceptable behaviour on or off the ice, may be sanctioned with a match penalty, or permanent expulsion from the tournament, by the tournament organiser.

In the event of serious misconduct or breach of discipline concerning spectators (verbal or physical violence, damage to equipment, etc.), the tournament's sports commission may prohibit them from accessing the ice rink or, depending on the extent of the fault.`,
    driveId: '1WrsHcXXBqLETjkYuvix6UDSmd38SzHd4',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Règlement',
    titre: 'Arbitrages', titreEn: 'Arbitrages',
    description: `Les matchs seront arbitrés par 2 arbitres du club en formation.`,
    descriptionEn: `Les matchs seront arbitrés par 2 arbitres du club en formation.`,
    driveId: '1yE6OCAJsraCbAKX1IKsvd8T4TvNDtoBN',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Règlement',
    titre: 'Table de Marque', titreEn: 'Table de Marque',
    description: `La Table de marque est assurée par les bénévoles du RCHC. L'erreur est humaine alors soyez indulgent avec nos bénévoles ! Vous pouvez vous manifester de manière courtoise pour des erreurs (chronomètre ; pénalité...) mais en aucun cas manquer de respect à nos bénévoles. En cas de manquement à ce règlement, la commission sportive du tournoi se réunira pour décider d'une sanction.`,
    descriptionEn: `La Table de marque est assurée par les bénévoles du RCHC. L'erreur est humaine alors soyez indulgent avec nos bénévoles ! Vous pouvez vous manifester de manière courtoise pour des erreurs (chronomètre ; pénalité...) mais en aucun cas manquer de respect à nos bénévoles. En cas de manquement à ce règlement, la commission sportive du tournoi se réunira pour décider d'une sanction.`,
    driveId: '15-ifplyM4RH9t0_fRqhWC8utbqwO31KV',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Règlement',
    titre: 'Commission sportive', titreEn: 'Commission sportive',
    description: `Elle est constituée de 5 membres du club du RCHC (le responsable tournoi, les responsables table  de marque, et le responsable organisation) et prendra à la majorité absolue toute décision faisant l'objet d'un fait non couvert par le présent règlement.
`,
    descriptionEn: `Elle est constituée de 5 membres du club du RCHC (le responsable tournoi, les responsables table  de marque, et le responsable organisation) et prendra à la majorité absolue toute décision faisant l'objet d'un fait non couvert par le présent règlement.
`,
    driveId: '1TBbLozg2Xgt6SitS7YK50KXCmanffmOm',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Règlement', groupeEn: 'Règlement',
    titre: 'Mise à disposition de la patinoire', titreEn: 'Mise à disposition de la patinoire',
    description: `Il est demandé aux délégations présentes à notre tournoi de prendre soin des équipements mis à leur disposition (vestiaires et pourtours de glace). En particulier, il est interdit de jouer avec les crosses dans la patinoire hors de la glace. Les crosses des joueurs seront stockées à la table de marque dans un baril avec le logo du club.`,
    descriptionEn: `Il est demandé aux délégations présentes à notre tournoi de prendre soin des équipements mis à leur disposition (vestiaires et pourtours de glace). En particulier, il est interdit de jouer avec les crosses dans la patinoire hors de la glace. Les crosses des joueurs seront stockées à la table de marque dans un baril avec le logo du club.`,
    driveId: '17kUPV6V7-BRfT61L86HoECbDxSyTxaYe',
    lienUrl: null, lieu: null, mapsQuery: null,
  },

  // ---- Challenge ----
  {
    groupe: 'Challenge', groupeEn: 'Challenge',
    titre: 'Présentation', titreEn: 'Presentation',
    description: `En parallèle du tournoi par équipe, chaque joueur sera invité à mettre en valeur sa technique individuelle.

Le Challenge « Combiné » :
Le premier jour, chaque équipe viendra sur la seconde glace (glace dite « ludique ») participer à des défis :
 De précision : individuellement, chaque joueur devra atteindre des cibles placées dans un but (sans gardien).
 D'agilité: individuellement, chaque joueur (hors Gardiens) devra parcourir le plus vite possible un parcours d'obstacles.
 De vitesse : les enfants devront parcourir une boucle le plus vite possible.
Un système de bonus et de pénalités permettra de décerner aux meilleurs enchainements les récompenses de ce challenge.

Le Challenge « Vitesse » :
Le second jour les deux meilleurs de chaque équipe du défi de vitesse seront sélectionnés pour participer à des finales de vitesse.

Le Challenge « Gardien » :
Le second jour, une épreuve de tirs sera organisée. Les gardiens qui obtiendront les meilleurs résultats seront alors qualifiés pour atteindre la finale. En cas d'égalité dans l'exercice des « fusillades », ils seront départagés par leur résultat aux gammes (exercices du premier jour).`,
    descriptionEn: `In parallel with the team tournament, each player will be invited to highlight his individual technique.

The "Combined" Challenge:
On the first day, each team will come to the second ice (so-called "play" ice) to participate in challenges:
 Accuracy: Individually, each player will have to hit targets placed in a goal (without a goalkeeper).
 Agility: individually, each player (excluding Keepers) will have to go as fast as possible through an obstacle course.
 Speed: children will have to cover a loop as fast as possible.
A system of bonuses and penalties will allow the best sequences to be awarded the rewards of this challenge.

The "Speed" Challenge:
On the second day, the top two from each team in the Speed Challenge will be selected to compete in Speed Finals.

The "Keeper" Challenge:
On the second day, a shooting event will be organised. The goalkeepers who achieve the best results will then qualify for the finale. In case of a tie in the "shoot-out" exercise, they will be separated by their result in the previous day's drills.`,
    driveId: '1CAcm8Fpk6ws6P8TPDiLECS_avDv_F_sU',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Challenge', groupeEn: 'Challenge',
    titre: 'Règlement', titreEn: 'Rules',
    description: `Année d'âge :
Seuls les joueurs enregistrés dans le tournoi RCHC U11 sont autorisés à participer au challenge.

Temps de jeu :
Chaque joueur participe à chaque épreuve du challenge. Il n'y a donc pas de temps limite pour dérouler les exercices. L'organisateur, à son appréciation, se donne le droit de supprimer des passages de certains joueurs si le temps « convenable » accordé à l'équipe n'est pas respecté. Chaque équipe est accompagnée par son coach, qui veillera au bon  déroulement du challenge.

ATTENTION, CHAQUE EQUIPE DISPOSE DE 35 MINUTES POUR DEROULER L'ENSEMBLE DE SES EPREUVES. IL FAUDRA DONC ETRE DISCIPLINE POUR NE PAS DEPASSER LE TEMPS IMPARTI.

Présentation au challenge :
Afin de respecter le planning, les équipes doivent être présentes en bord de la petite glace au plus tard 5 minutes avant le début « planifié » de leur challenge (en particulier pour les équipes qui doivent enchainer avec le challenge à la fin de leur match précédent). Elles ne peuvent pénétrer sur la glace qu'à l'invitation de l'organisateur.`,
    descriptionEn: `Year of age:
Only players registered in the RCHC U11 tournament are allowed to participate in the challenge.

Playing time:
Each player participates in each challenge event. There is therefore no time limit to carry out the exercises. The organizer, at its discretion, gives itself the right to remove passages of certain players if the "suitable" time granted to the team is not respected. Each team is accompanied by its coach, who will ensure that the challenge runs smoothly.

PLEASE NOTE THAT EACH TEAM HAS 35 MINUTES TO COMPLETE ALL OF ITS EVENTS. IT WILL THEREFORE BE NECESSARY TO BE DISCIPLINED NOT TO EXCEED THE ALLOTTED TIME.

Presentation at the challenge:
In order to respect the schedule, teams must be present at the edge of the small ice at the latest 5 minutes before the "planned" start of their challenge (especially for teams who have to follow up with the challenge at the end of their previous match). They may only enter the ice at the invitation of the organizer.`,
    driveId: '1UNLEiHB2mmU3B0Fmu5sO9T2fl02fA4pR',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Challenge', groupeEn: 'Challenge',
    titre: 'Jour 1', titreEn: 'Jour 1',
    description: `Tous les challenges sont réalisés en tenue complète de hockeyeur, hormis la crosse pour le Challenge « Vitesse ».

Challenge « Tir » (Combiné) :

Le challenge « Tir » se déroule le premier jour, selon le planning challenge équipe.
Dans une cage de Hockey sur Glace, des cibles sont installées à différents endroits.
Chaque enfant de chaque équipe lance 3 palets à une distance définie, toujours la même.
L'enfant doit atteindre la cible de son choix.
Chaque cible rapporte un certain nombre de « secondes », soit en Bonus donc en négatif, soit en Pénalité donc en positif, plus ou moins en fonction de la difficulté.
 Un tir à l'extérieur de la cage est pénalisé.
 Un tir à l'intérieur de la cage hors cible est neutre.
 Un tir dans une cible basse est bonifié en secondes.
 Un tir dans une cible haute est encore plus bonifié, toujours en secondes.

Challenge « Agilité » (Combiné) :

Chaque enfant (hormis les gardiens) de chaque équipe doit parcourir un slalom de plots le plus vite possible. L'organisateur donne le départ et démarre son chronomètre. L'organisateur juge l'arrivée du slalom et arrête son chronomètre. Le temps de chaque enfant est enregistré. Si un plot est déplacé (marque de couleurs visible), ou une porte non franchie, alors l'enfant sera pénalisé de 5 secondes par erreur.

Challenge « Vitesse », qualifications (Combiné et Vitesse) :

Le challenge « vitesse » se déroule en deux phases :
 Une première phase de sélection le premier jour, dont les performances sont reportées dans le Challenge Combiné
 Une seconde phase finale le deuxième jour, dont les performances déterminent le classement du Challenge Vitesse phase de sélection.
Elle se déroule le premier jour selon le planning challenge équipe.
Chaque enfant de chaque équipe réalise le parcours délimité en le minimum de temps. Le départ est donné par l'organisateur qui déclenche le chronomètre. L'arrivée est jugée par l'organisateur qui arrête son chronomètre. Le temps réalisé par l'enfant est enregistré. Les 2 meilleurs temps identifient les deux joueurs de l'équipe pour la phase finale. 24 enfants sont ainsi qualifiés pour la phase finale. Le temps réalisé par chaque enfant est comptabilisé dans le calcul du Challenge Combiné.

Challenge « Gardien », évaluations (Gardien) :

Pour les gardiens, comme pour les joueurs, les évaluations du challenge  Gardien se déroulent le premier jour, selon le planning challenge équipe. Chaque gardien devra effectuer une gamme chronométrée qui sera décrite lors du challenge par le chronométreur. Les « erreurs » de gamme seront comptabilisées.`,
    descriptionEn: `Tous les challenges sont réalisés en tenue complète de hockeyeur, hormis la crosse pour le Challenge « Vitesse ».

Challenge « Tir » (Combiné) :

Le challenge « Tir » se déroule le premier jour, selon le planning challenge équipe.
Dans une cage de Hockey sur Glace, des cibles sont installées à différents endroits.
Chaque enfant de chaque équipe lance 3 palets à une distance définie, toujours la même.
L'enfant doit atteindre la cible de son choix.
Chaque cible rapporte un certain nombre de « secondes », soit en Bonus donc en négatif, soit en Pénalité donc en positif, plus ou moins en fonction de la difficulté.
 Un tir à l'extérieur de la cage est pénalisé.
 Un tir à l'intérieur de la cage hors cible est neutre.
 Un tir dans une cible basse est bonifié en secondes.
 Un tir dans une cible haute est encore plus bonifié, toujours en secondes.

Challenge « Agilité » (Combiné) :

Chaque enfant (hormis les gardiens) de chaque équipe doit parcourir un slalom de plots le plus vite possible. L'organisateur donne le départ et démarre son chronomètre. L'organisateur juge l'arrivée du slalom et arrête son chronomètre. Le temps de chaque enfant est enregistré. Si un plot est déplacé (marque de couleurs visible), ou une porte non franchie, alors l'enfant sera pénalisé de 5 secondes par erreur.

Challenge « Vitesse », qualifications (Combiné et Vitesse) :

Le challenge « vitesse » se déroule en deux phases :
 Une première phase de sélection le premier jour, dont les performances sont reportées dans le Challenge Combiné
 Une seconde phase finale le deuxième jour, dont les performances déterminent le classement du Challenge Vitesse phase de sélection.
Elle se déroule le premier jour selon le planning challenge équipe.
Chaque enfant de chaque équipe réalise le parcours délimité en le minimum de temps. Le départ est donné par l'organisateur qui déclenche le chronomètre. L'arrivée est jugée par l'organisateur qui arrête son chronomètre. Le temps réalisé par l'enfant est enregistré. Les 2 meilleurs temps identifient les deux joueurs de l'équipe pour la phase finale. 24 enfants sont ainsi qualifiés pour la phase finale. Le temps réalisé par chaque enfant est comptabilisé dans le calcul du Challenge Combiné.

Challenge « Gardien », évaluations (Gardien) :

Pour les gardiens, comme pour les joueurs, les évaluations du challenge  Gardien se déroulent le premier jour, selon le planning challenge équipe. Chaque gardien devra effectuer une gamme chronométrée qui sera décrite lors du challenge par le chronométreur. Les « erreurs » de gamme seront comptabilisées.`,
    driveId: '1UJ862fnoCJC_6v2mUMUZgnDVr4GmOdf2',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Challenge', groupeEn: 'Challenge',
    titre: 'Jour 2', titreEn: 'Jour 2',
    description: `Finales du Challenge « Vitesse » :

La phase finale du challenge « Vitesse » se déroule le deuxième jour. Elle se déroule pendant les 3 surfaçages de la grande glace. Les enfants qualifiés la veille (les deux meilleurs temps par équipe du challenge « Vitesse ») doivent se présenter 5 minutes au plus tard après la fin du dernier match qui a eu lieu sur la grande glace avant le surfaçage (pour donner le temps aux enfants qui joueraient juste avant d'arriver sur la petite glace).
6 courses (quart de finale) de 4 enfants permettent de sélectionner 12 enfants (les premiers de chaque course).
4 courses (demi-finales) de 3 enfants permettent de sélectionner 4 enfants (les premiers de chaque course).
1 course (finale) de 4 enfants permet d'identifier le vainqueur.
Lors de ces courses, tout contact provoqué par un joueur en vue délibérée de retarder un adversaire est éliminatoire.

Finales du Challenge « Gardien » :

Juste avant la finale du Challenge Vitesse, lors du Troisième surfaçage du deuxième jour au matin, vers 14:40, une fusillade sera organisée et le meilleur des trois gardiens sera déclaré grand vainqueur. En cas d'égalité, c'est le gardien qui aura réalisé la meilleure gamme la veille qui sera sélectionné.`,
    descriptionEn: `Finales du Challenge « Vitesse » :

La phase finale du challenge « Vitesse » se déroule le deuxième jour. Elle se déroule pendant les 3 surfaçages de la grande glace. Les enfants qualifiés la veille (les deux meilleurs temps par équipe du challenge « Vitesse ») doivent se présenter 5 minutes au plus tard après la fin du dernier match qui a eu lieu sur la grande glace avant le surfaçage (pour donner le temps aux enfants qui joueraient juste avant d'arriver sur la petite glace).
6 courses (quart de finale) de 4 enfants permettent de sélectionner 12 enfants (les premiers de chaque course).
4 courses (demi-finales) de 3 enfants permettent de sélectionner 4 enfants (les premiers de chaque course).
1 course (finale) de 4 enfants permet d'identifier le vainqueur.
Lors de ces courses, tout contact provoqué par un joueur en vue délibérée de retarder un adversaire est éliminatoire.

Finales du Challenge « Gardien » :

Juste avant la finale du Challenge Vitesse, lors du Troisième surfaçage du deuxième jour au matin, vers 14:40, une fusillade sera organisée et le meilleur des trois gardiens sera déclaré grand vainqueur. En cas d'égalité, c'est le gardien qui aura réalisé la meilleure gamme la veille qui sera sélectionné.`,
    driveId: '1fB2NaoepWQL13yzvbccQt-dSMFnrGR0N',
    lienUrl: null, lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Challenge', groupeEn: 'Challenge',
    titre: 'Esprit du jeu', titreEn: 'Esprit du jeu',
    description: `Le bon déroulement du challenge demande la collaboration de chaque équipe. Chaque coach de chaque équipe devra donc veiller à ce que son équipe
 Soit attentive au « briefing » par l'organisateur des enfants avant chaque challenge
 Respecte la mise en place logistique des challenges
 Respecte les ordres de départ des épreuves
 Respecte les entrées / sorties sur la petite glace dictées par l'organisateur
Toute contestation du jugement de l'organisateur du challenge par l'enfant ou le coach pourra conduire à l'exclusion de l'enfant du concours. Cette décision ne sera prise qu'en extrême dernier recours, fair play et bonne humeur devant être le moteur du challenge.`,
    descriptionEn: `Le bon déroulement du challenge demande la collaboration de chaque équipe. Chaque coach de chaque équipe devra donc veiller à ce que son équipe
 Soit attentive au « briefing » par l'organisateur des enfants avant chaque challenge
 Respecte la mise en place logistique des challenges
 Respecte les ordres de départ des épreuves
 Respecte les entrées / sorties sur la petite glace dictées par l'organisateur
Toute contestation du jugement de l'organisateur du challenge par l'enfant ou le coach pourra conduire à l'exclusion de l'enfant du concours. Cette décision ne sera prise qu'en extrême dernier recours, fair play et bonne humeur devant être le moteur du challenge.`,
    driveId: '1WvL3Qp3EknckdEXxz-eaO1AkW-gERmiK',
    lienUrl: null, lieu: null, mapsQuery: null,
  },

  // ---- Médias / Medias ----
  {
    groupe: 'Médias', groupeEn: 'Medias',
    titre: 'Instagram', titreEn: 'Instagram',
    description: `Retrouvez nous sur Instagram.`,
    descriptionEn: `Find us on Instagram.`,
    driveId: '1JTBNikeN98BwQasCOveflxsdeas3Wiom',
    lienUrl: 'https://www.instagram.com/tournoirennescormoranshockey?igsh=MTVxOWo4YmY2cDYyNQ==',
    lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Médias', groupeEn: 'Medias',
    titre: 'Facebook', titreEn: 'Facebook',
    description: `Vous pouvez suivre notre tournoi pas à pas et le commenter en vous rendant sur notre page Facebook dédiée à notre évènement. Ne tardez plus à Liker !`,
    descriptionEn: `You can follow our tournament step by step and comment on it by going to our Facebook page dedicated to our event. Don't wait any longer to like!`,
    driveId: '1fyIDsQHbF0b9uiQyfowtbzMscdWsXbJq',
    lienUrl: 'https://www.facebook.com/profile.php?id=61567163188148',
    lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Médias', groupeEn: 'Medias',
    titre: 'Le Live !', titreEn: 'The live!',
    description: `Cette Web application est géniale ! Elle vous permet de suivre l'évolution du score des rencontres en temps réel, d'avoir les classements mis à jour instantanément, de pouvoir surveiller le planning des matchs en fonction des aléas de l'avancement du tournoi, de savoir quand les heures de repas et les passages au challenge sont prévus. Mais encore, vous pourrez accéder à tout l'historique de nos tournois avec les classements et les résultats des éditions passées. Vous pourrez retrouver également la présentation de chacune des équipes. Bref, c'est un indispensable pour profiter au maximum de notre fête ! Bon surf :-)

Note : l'application sera mise à jour dès que le plateau 2025 sera connu. `,
    descriptionEn: `This web application is great! It allows you to follow the evolution of the score of matches in real time, to have the rankings updated instantly, to be able to monitor the schedule of matches according to the vagaries of the tournament's progress, to know when meal times and challenges are scheduled. But also, you will be able to access all the history of our tournaments with the rankings and results of past editions. You will also be able to find the presentation of each of the teams. In short, it's a must to make the most of our party! Happy surfing :-)

Note: the application will be updated as soon as the 2025 grid is known. `,
    driveId: '1bi_VWZMyefh48gISqNcB4IsMyFN0B-RB',
    lienUrl: 'http://tournoi.lescormorans.eu/',
    lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Médias', groupeEn: 'Medias',
    titre: 'Le Site Officiel du RCHC', titreEn: 'The RCHC official site',
    description: `Pour tout savoir sur notre club, le Rennes Cormorans Hockey Club.`,
    descriptionEn: `To find out everything about our club, the Rennes Cormorans Hockey Club.`,
    driveId: '1qvuqXCmN2hhWwyF7Z_MGcFtEIOAfB0or',
    lienUrl: 'http://www.lescormorans.eu/',
    lieu: null, mapsQuery: null,
  },
  {
    groupe: 'Médias', groupeEn: 'Medias',
    titre: 'La chaîne Youtube !', titreEn: 'The youtube channel',
    description: `Comme en 2024, nous allons retransmettre les matchs en direct...`,
    descriptionEn: `As in 2024, we will broadcast the matches live...`,
    driveId: '1gOLuN8tjkPwriDoUPtolGXkALtskH-PK',
    lienUrl: 'https://www.youtube.com/channel/UCle9i2j__WR100Jw7IrIAAQ',
    lieu: null, mapsQuery: null,
  },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.presentationArticle.deleteMany({});
    let ordre = 0;
    for (const a of articles) {
      await prisma.presentationArticle.create({
        data: {
          groupe: a.groupe,
          groupeEn: a.groupeEn,
          titre: a.titre,
          titreEn: a.titreEn,
          description: a.description,
          descriptionEn: a.descriptionEn,
          imageUrl: driveThumb(a.driveId),
          lienUrl: a.lienUrl,
          lieu: a.lieu,
          mapsQuery: a.mapsQuery,
          ordre: ordre++,
        },
      });
    }
    console.log(`Seeded ${articles.length} presentation articles.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
