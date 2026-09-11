import type { CategoryPools } from "./demo-samples";

/**
 * French sample copy -- Quebec French, for businesses on the island of
 * Montreal. See `demo-samples.ts` for the rules every line obeys.
 *
 * PARALLEL WITH `demo-samples-en.ts`: entry i here says what entry i there
 * says. Not a word-for-word translation -- each line is written to read
 * naturally in French -- but the same message, so a business's French and
 * English pages never promise different things.
 *
 * Three habits specific to this file:
 *
 *   - `{city}` always follows "à" ("à Montréal", "à Dollard-Des Ormeaux").
 *     Never "de {city}" or "de {name}": French elides "de" before a vowel,
 *     and a template cannot know whether the next word is "Anjou". The test
 *     refuses those shapes.
 *   - Quebec usage where it differs from France: "déjeuner" is breakfast,
 *     "dîner" lunch; "jasette", "magasiner", "l'auto".
 *   - French typography: a non-breaking space before "?" and ":".
 */

const HAIR_SALON: CategoryPools = {
  label: "Salon de coiffure",
  eyebrow: ["Salon de coiffure à {city}", "Coupe et couleur à {city}"],
  headline: [
    "Votre prochaine belle coupe commence ici",
    "Des cheveux qui vous ressemblent",
    "Des cheveux qui donnent le sourire",
    "Coupe, couleur et soins, sans se presser",
  ],
  subheading: [
    "Coupes, couleur et soins pour tous les types de cheveux, dans un salon détendu à {city}.",
    "Un salon à {city} pour la coupe, la couleur et les soins, où l’on vous écoute avant de couper quoi que ce soit.",
    "Tous les types de cheveux, toutes les longueurs, et on vous consulte avant de sortir les ciseaux.",
  ],
  servicesHeading: ["Nos services", "Ce qu’on offre", "Au salon"],
  servicesIntro: [
    "Un service complet, de la simple coupe au grand changement.",
    "D’une petite coupe à un tout nouveau look.",
  ],
  services: [
    {
      title: "Coupe et coiffage",
      body: "Des coupes précises pour tous les types de cheveux, pensées pour la façon dont vous vous coiffez au quotidien.",
    },
    {
      title: "Couleur",
      body: "Des nuances subtiles et des retouches de racines jusqu’au changement complet, en prenant soin de la santé de vos cheveux.",
    },
    {
      title: "Soins",
      body: "Des soins nourrissants et réparateurs pour garder une couleur éclatante et des cheveux en santé entre deux visites.",
    },
    {
      title: "Événements",
      body: "Des coiffures pour les mariages, les soirées et tous les jours où vous voulez être à votre meilleur.",
    },
    {
      title: "Mèches et balayage",
      body: "Des mèches posées à la main, pour un résultat lumineux qui repousse en douceur.",
    },
    {
      title: "Mise en plis",
      body: "Shampooing et brushing pour un fini lisse et plein de volume, avant un grand jour ou juste pour le plaisir.",
    },
  ],
  aboutHeading: ["À propos du salon", "Le salon", "Qui nous sommes"],
  aboutBody: [
    "{name} est un salon de coiffure à {city}. On prend le temps de discuter de ce que vous voulez avant de commencer, et l’ambiance reste calme et détendue du début à la fin.",
    "Chez {name}, une coupe commence par une conversation. On vous écoute, on vous conseille, et on ne prend les ciseaux qu’une fois d’accord sur le résultat.",
    "{name}, c’est un salon à {city} pour qui veut de beaux cheveux sans chichi : des conseils honnêtes, un travail soigné et une heure qu’on ne voit pas passer.",
  ],
  aboutPoints: [
    "Avec ou sans rendez-vous",
    "À l’aise avec tous les types de cheveux",
    "Du temps pour vous, pas une chaîne de montage",
    "Des conseils à refaire à la maison",
    "Une couleur entretenue avec soin",
  ],
  galleryHeading: ["Nos réalisations", "Au salon"],
  galleryBody: ["Un aperçu du salon et de quelques coiffures réalisées."],
  galleryLabels: ["Le salon", "Coupe et couleur", "Coiffage en cours", "Le résultat"],
  contactBody: [
    "Appelez pour réserver le moment qui vous convient, ou passez nous dire bonjour.",
    "Appelez pour fixer un moment, ou passez nous voir et on verra ce qu’on peut faire.",
  ],
  ctaHeading: ["Réservez votre prochain rendez-vous", "Envie de changement ?", "Votre fauteuil vous attend"],
  ctaBody: [
    "Appelez-nous et on trouvera un moment qui vous convient.",
    "Appelez-nous, dites-nous ce que vous avez en tête, et on vous trouvera une place.",
  ],
  ctaBodyVisit: [
    "Passez au salon et on trouvera un moment qui vous convient.",
    "Passez nous voir et on vous trouvera une place.",
  ],
  footerNote: ["Salon de coiffure à {city}."],
};

const BARBER: CategoryPools = {
  label: "Barbier",
  eyebrow: ["Barbier à {city}", "Salon de barbier à {city}"],
  headline: [
    "Une vraie coupe, un vrai rasage",
    "Des coupes nettes, sans chichi",
    "Coupe fraîche, lignes nettes",
    "Le fauteuil, la tondeuse, la coupe",
  ],
  subheading: [
    "Du barbier traditionnel à {city}, sans chichi et sans rendez-vous.",
    "Dégradés, coupes classiques et barbe à {city}, faits comme il faut et avec soin.",
    "Un barbier à {city} pour une coupe nette, une barbe soignée et quelques minutes de pause.",
  ],
  servicesHeading: ["Nos services", "Ce qu’on fait", "Au menu"],
  servicesIntro: ["Du barbier classique, fait comme il faut.", "Coupes, barbes et rasages."],
  services: [
    {
      title: "Coupes",
      body: "Coupes aux ciseaux et à la tondeuse, du simple rafraîchissement au changement complet, finies comme vous les aimez.",
    },
    {
      title: "Taille de barbe",
      body: "Mise en forme, entretien et contours, pour une barbe qui suit la forme de votre visage.",
    },
    {
      title: "Rasage à la serviette chaude",
      body: "Un rasage traditionnel à la serviette chaude, de près et tout en confort.",
    },
    {
      title: "Coupes enfants",
      body: "Des coupes rapides et patientes pour les plus jeunes, sans drame.",
    },
    {
      title: "Dégradés",
      body: "Dégradés à blanc, bas ou hauts, bien fondus et finis selon la ligne que vous voulez.",
    },
    {
      title: "Contours",
      body: "Des contours nets à la ligne des cheveux et de la barbe, pour garder une coupe fraîche entre deux visites.",
    },
  ],
  aboutHeading: ["À propos", "Le salon"],
  aboutBody: [
    "{name} est un barbier à {city}. Du travail de barbier simple et bien fait, un bon fauteuil et une jasette si le cœur vous en dit.",
    "Chez {name}, la coupe passe en premier. Dites-nous ce que vous voulez, installez-vous, et repartez avec votre meilleure tête.",
    "Chez {name}, on garde ça simple : de bonnes tondeuses, des ciseaux affûtés, des serviettes chaudes et du temps pour chaque coupe.",
  ],
  aboutPoints: [
    "Sans rendez-vous, toujours",
    "Chaque coupe bien finie",
    "Un fauteuil et une jasette, si vous voulez",
    "Dégradés, classiques et tout le reste",
    "Des barbes taillées pour votre visage",
  ],
  galleryHeading: ["Le salon", "Coupes fraîches"],
  galleryBody: ["Un coup d’œil aux fauteuils, au salon et à quelques coupes récentes."],
  galleryLabels: ["La devanture", "Les fauteuils", "Coupe récente", "Travail de barbe"],
  contactBody: ["Passez sans rendez-vous, ou appelez si vous préférez un moment fixe."],
  ctaHeading: ["Envie d’une coupe ?", "C’est l’heure d’une coupe fraîche", "Votre fauteuil est prêt"],
  ctaBody: [
    "Pas besoin de rendez-vous. Appelez si vous préférez un moment fixe.",
    "Appelez-nous et on vous dira le meilleur moment.",
  ],
  ctaBodyVisit: [
    "Pas besoin de rendez-vous. Entrez et installez-vous.",
    "Passez, prenez place, et on s’occupe de vous.",
  ],
  footerNote: ["Barbier à {city}."],
};

const BEAUTY_SALON: CategoryPools = {
  label: "Salon d’esthétique",
  eyebrow: ["Salon d’esthétique à {city}", "Soins et beauté à {city}"],
  headline: [
    "Prenez le temps de prendre soin de vous",
    "Une heure de calme, rien que pour vous",
    "La peau, les sourcils et un peu de calme",
    "Des soins qui s’adaptent à votre semaine",
  ],
  subheading: [
    "Des soins du visage, de la peau et du corps dans un salon paisible à {city}.",
    "Soins du visage, épilation, sourcils et cils à {city}, dans une pièce tranquille et sans se presser.",
    "Un salon d’esthétique à {city} où les soins sont choisis pour votre peau, pas selon un script.",
  ],
  servicesHeading: ["Nos soins", "Ce qu’on offre"],
  servicesIntro: ["Une gamme de soins, selon votre horaire.", "Visage, corps, sourcils et cils."],
  services: [
    {
      title: "Soins du visage",
      body: "Des soins nettoyants et hydratants choisis pour votre peau plutôt qu’une routine unique pour tout le monde.",
    },
    {
      title: "Épilation",
      body: "Épilation à la cire du visage et du corps, avec une attention constante à votre confort.",
    },
    {
      title: "Sourcils et cils",
      body: "Restructuration, teinture et soins des cils pour encadrer le visage et ouvrir le regard.",
    },
    {
      title: "Massage",
      body: "Des soins relaxants pour décrocher, que vous ayez une demi-heure ou tout un après-midi.",
    },
    {
      title: "Maquillage",
      body: "Un maquillage pour un événement ou une soirée, adapté à votre style et à votre peau.",
    },
    {
      title: "Soins du corps",
      body: "Gommages et enveloppements pour une peau douce et bien hydratée.",
    },
  ],
  aboutHeading: ["À propos du salon", "Le salon"],
  aboutBody: [
    "{name} est un salon d’esthétique à {city}. Une pièce tranquille, des rendez-vous sans hâte et des soins choisis pour vous.",
    "Chez {name}, chaque soin commence par quelques questions sur votre peau, pour que le soin vous convienne à vous, pas à une routine.",
    "{name}, c’est un coin de calme à {city} : un endroit pour décrocher une heure et repartir le cœur léger.",
  ],
  aboutPoints: [
    "Des rendez-vous selon votre horaire",
    "Un espace calme et intime",
    "Des soins adaptés à vous",
    "Du temps pour vous, jamais pressé",
    "Des conseils pour votre routine à la maison",
  ],
  galleryHeading: ["Le salon", "Au salon"],
  galleryBody: ["Un aperçu des salles de soins et de l’espace."],
  galleryLabels: ["L’accueil", "La salle de soins", "L’espace", "Les détails"],
  contactBody: ["Appelez pour réserver un soin ou demander ce qui vous conviendrait le mieux."],
  ctaHeading: ["Réservez un soin", "Prenez une heure pour vous", "Votre moment de calme"],
  ctaBody: [
    "Appelez-nous et on trouvera un rendez-vous qui convient à votre semaine.",
    "Appelez-nous et on vous aidera à choisir un soin.",
  ],
  ctaBodyVisit: [
    "Passez nous voir et on trouvera un rendez-vous qui convient à votre semaine.",
    "Passez au salon et on vous aidera à choisir un soin.",
  ],
  footerNote: ["Salon d’esthétique à {city}."],
};

const NAIL_SALON: CategoryPools = {
  label: "Salon d’ongles",
  eyebrow: ["Salon d’ongles à {city}", "Ongles à {city}"],
  headline: [
    "Des ongles qu’on ne se lasse pas de regarder",
    "Des mains qui ont envie de se montrer",
    "Une nouvelle pose, faite avec soin",
    "La couleur au bout des doigts",
  ],
  subheading: [
    "Manucures, pédicures et nail art à {city}, faits avec soin et sans se presser.",
    "Un salon d’ongles à {city} pour tout, d’une simple retouche à une pose complète sur mesure.",
    "Gel, rallonges et nail art à {city}, chaque design pensé avec vous avant de commencer.",
  ],
  servicesHeading: ["Ce qu’on fait", "Nos services"],
  servicesIntro: ["D’une simple retouche à une pose complète.", "Les mains, les pieds et tout le reste."],
  services: [
    {
      title: "Manucure",
      body: "Mise en forme, soin des cuticules et le fini de votre choix, du naturel poli à la couleur complète.",
    },
    {
      title: "Pédicure",
      body: "Un soin complet des pieds et des ongles, fini avec la couleur de votre choix et le temps de bien sécher.",
    },
    {
      title: "Gel et rallonges",
      body: "Une couleur gel qui dure et des rallonges posées et retirées en respectant l’ongle naturel.",
    },
    {
      title: "Nail art",
      body: "D’un simple accent à un design complet, pensé avec vous avant de commencer.",
    },
    {
      title: "Soins et réparation",
      body: "Des soins fortifiants pour les ongles qui cassent ou se dédoublent, et des réparations pour les petits accidents.",
    },
    {
      title: "French et classiques",
      body: "Des French nettes et des teintes intemporelles, posées avec précision.",
    },
  ],
  aboutHeading: ["À propos", "Le salon"],
  aboutBody: [
    "{name} est un salon d’ongles à {city}. On prend notre temps, tout est gardé propre, et on préfère faire une pose comme il faut que trois à la course.",
    "Chez {name}, chaque pose commence par une discussion sur la forme, la longueur et la couleur, pour que le résultat vous ressemble.",
    "{name}, c’est un salon d’ongles attentionné à {city}, pour des mains et des pieds qui méritent un peu d’attention.",
  ],
  aboutPoints: [
    "Du temps pour chaque pose",
    "Une pratique soignée et hygiénique",
    "Des designs pensés avec vous",
    "Des couleurs pour chaque saison",
    "Respectueux de vos ongles naturels",
  ],
  galleryHeading: ["Nos réalisations", "Poses récentes"],
  galleryBody: ["Quelques poses récentes et un aperçu du salon."],
  galleryLabels: ["Pose récente", "Nail art", "Le salon", "Le choix de couleurs"],
  contactBody: ["Appelez pour réserver, ou passez et on vous prendra si on peut."],
  ctaHeading: ["Réservez votre rendez-vous", "Envie d’une nouvelle pose ?", "Gâtez vos mains"],
  ctaBody: [
    "Appelez-nous et dites-nous ce que vous avez en tête.",
    "Appelez-nous et on vous trouvera un moment.",
  ],
  ctaBodyVisit: [
    "Passez nous voir et dites-nous ce que vous avez en tête.",
    "Passez au salon et on vous trouvera un moment.",
  ],
  footerNote: ["Salon d’ongles à {city}."],
};

const TATTOO: CategoryPools = {
  label: "Tatouage et perçage",
  eyebrow: ["Studio de tatouage à {city}", "Tatouage et perçage à {city}"],
  headline: [
    "Votre idée, bien dessinée",
    "De l’encre qu’on garde",
    "Pensé avec vous, fait pour durer",
    "Du croquis à la peau",
  ],
  subheading: [
    "Tatouages sur mesure et perçage à {city}, dessinés avec vous avant que l’aiguille n’approche.",
    "Un studio de tatouage à {city} pour du sur-mesure, du flash et des conseils honnêtes.",
    "Pièces sur mesure, flash et recouvrements à {city}, chaque dessin travaillé ensemble.",
  ],
  servicesHeading: ["Ce qu’on fait", "Le travail"],
  servicesIntro: ["D’un premier petit tatouage à une manche complète.", "Sur mesure, flash, recouvrements et perçage."],
  services: [
    {
      title: "Tatouage sur mesure",
      body: "Des dessins tirés de votre idée et retravaillés ensemble jusqu’à ce qu’ils soient justes, avant de réserver la séance.",
    },
    {
      title: "Flash",
      body: "Des dessins prêts à tatouer à choisir au mur, pour quand on sait ce qu’on aime au premier coup d’œil.",
    },
    {
      title: "Recouvrement et retouche",
      body: "Des conseils francs sur un vieux tatouage, et un plan pour le retravailler ou le recouvrir qui vous plaît.",
    },
    {
      title: "Perçage",
      body: "Du perçage fait avec soin, des bijoux choisis ensemble et les soins expliqués avant de partir.",
    },
    {
      title: "Consultations",
      body: "Une rencontre avant toute réservation, pour discuter de l’emplacement, de la taille et du style.",
    },
  ],
  aboutHeading: ["À propos du studio", "Le studio"],
  aboutBody: [
    "{name} est un studio de tatouage à {city}. On prend le temps de bien faire un dessin, on garde le studio propre, et on vous dira honnêtement si une idée risque de mal vieillir.",
    "Chez {name}, le dessin compte autant que l’aiguille. Apportez une idée, une référence ou juste une envie, et on en fera quelque chose qui vous ressemble.",
    "{name}, c’est un studio à {city} pour qui veut un tatouage qu’on aimera encore dans des années.",
  ],
  aboutPoints: [
    "Des dessins pensés avec vous",
    "Une pratique propre et soignée",
    "Des conseils honnêtes avant toute réservation",
    "Des soins après-tatouage bien expliqués",
    "Premiers tatouages bienvenus",
  ],
  galleryHeading: ["Nos réalisations", "Pièces récentes"],
  galleryBody: ["Quelques pièces récentes et un tour du studio."],
  galleryLabels: ["Pièce récente", "Trait fin", "Le studio", "Le mur de flash"],
  contactBody: ["Parlez-nous de votre idée, et on en discutera avant toute réservation."],
  ctaHeading: ["Une idée en tête ?", "Dessinons votre idée", "Votre prochaine pièce commence ici"],
  ctaBody: [
    "Appelez-nous et parlez-nous-en. On en discutera avant toute réservation.",
    "Appelez le studio et racontez-nous ce que vous imaginez.",
  ],
  ctaBodyVisit: [
    "Passez au studio avec votre idée et on en discutera.",
    "Passez avec une référence et on l’esquissera ensemble.",
  ],
  footerNote: ["Studio de tatouage à {city}."],
};

const RESTAURANT: CategoryPools = {
  label: "Restaurant",
  eyebrow: ["Restaurant à {city}"],
  headline: ["Une cuisine qui donne envie de s’attabler"],
  subheading: ["Une cuisine à {city} qui mérite qu’on prenne le temps de s’asseoir."],
  servicesHeading: ["La cuisine"],
  servicesIntro: ["Ce qu’on cuisine et comment on le sert."],
  services: [
    {
      title: "Notre menu",
      body: "Un menu qui change selon ce qui est bon et de saison, avec quelque chose pour la plupart des appétits.",
    },
    {
      title: "Sur place",
      body: "Une salle où s’asseoir pour de vrai, pour un repas rapide ou une longue soirée.",
    },
    {
      title: "Groupes et occasions",
      body: "De la place pour les grandes tablées et les soirées qui demandent un peu d’organisation. Prévenez-nous à l’avance et on s’occupe du reste.",
    },
    {
      title: "Pour emporter",
      body: "Une bonne partie du menu voyage bien, si vous préférez manger à la maison.",
    },
  ],
  aboutHeading: ["À propos"],
  aboutBody: [
    "{name} est un restaurant à {city}. On cuisine ce qu’on aimerait manger, on le sert sans cérémonie, et on est contents quand les gens restent un moment.",
  ],
  aboutPoints: ["Avec ou sans réservation", "De la place pour les grandes tablées", "Restrictions alimentaires prises en compte"],
  galleryHeading: ["L’endroit"],
  galleryBody: ["Un aperçu de la salle, de la cuisine et de quelques plats."],
  galleryLabels: ["La salle", "De la cuisine", "Un plat", "Le bar"],
  contactBody: ["Appelez pour réserver une table, ou passez voir s’il reste de la place."],
  ctaHeading: ["Réservez une table"],
  ctaBody: ["Appelez-nous et dites-nous quand vous aimeriez manger avec nous."],
  ctaBodyVisit: ["Passez nous voir. On vous trouvera une table si on peut."],
  footerNote: ["Restaurant à {city}."],
};

const CAFE: CategoryPools = {
  label: "Café",
  eyebrow: ["Café à {city}"],
  headline: ["Du bon café, une place où s’asseoir"],
  subheading: ["Un café à {city} pour un espresso rapide, un déjeuner tranquille ou un après-midi avec son portable."],
  servicesHeading: ["Ce qu’on sert"],
  servicesIntro: ["Du café, de quoi manger et une place où s’asseoir."],
  services: [
    {
      title: "Café",
      body: "Espresso, filtre et tout ce qu’il y a entre les deux, bien fait et sans chichi.",
    },
    {
      title: "Déjeuner et dîner",
      body: "De la nourriture préparée fraîche toute la journée, des viennoiseries le matin à quelque chose de plus consistant le midi.",
    },
    {
      title: "Une place pour travailler",
      body: "Des tables où rester un moment, si vous avez des choses à faire.",
    },
    {
      title: "Pour emporter",
      body: "Tout le menu pour emporter, si vous êtes en chemin.",
    },
  ],
  aboutHeading: ["À propos du café"],
  aboutBody: [
    "{name} est un café à {city}. Un endroit pour commencer la matinée, couper l’après-midi, ou s’asseoir tranquille avec un café, sans plan particulier.",
  ],
  aboutPoints: ["Du café bien fait", "De la nourriture fraîche toute la journée", "Une place à garder un moment"],
  galleryHeading: ["Le café"],
  galleryBody: ["Un aperçu de la salle, du comptoir et de ce qui sort de la cuisine."],
  galleryLabels: ["La salle", "Le comptoir", "Le café", "Dans l’assiette"],
  contactBody: ["Passez quand on est ouverts, ou appelez pour une grosse commande."],
  ctaHeading: ["À bientôt"],
  ctaBody: ["On est ouverts presque toute la journée. Appelez d’avance pour une grosse commande."],
  ctaBodyVisit: ["On est ouverts presque toute la journée. Passez quand ça vous arrange."],
  footerNote: ["Café à {city}."],
};

const DENTIST: CategoryPools = {
  label: "Clinique dentaire",
  eyebrow: ["Clinique dentaire à {city}"],
  headline: ["Des soins dentaires sans appréhension"],
  subheading: ["Une clinique dentaire à {city} où l’on explique avant d’agir."],
  servicesHeading: ["Nos soins"],
  servicesIntro: ["Soins courants et traitements, expliqués clairement."],
  services: [
    {
      title: "Examens",
      body: "Des examens réguliers pour régler les petits problèmes pendant qu’ils sont encore petits.",
    },
    {
      title: "Hygiène",
      body: "Nettoyages et rendez-vous d’hygiène, avec des conseils pratiques pour l’entretien à la maison.",
    },
    {
      title: "Traitements",
      body: "Obturations, couronnes et travaux de restauration, avec les options expliquées avant que vous décidiez.",
    },
    {
      title: "Esthétique",
      body: "Blanchiment et soins esthétiques pour qui veut changer l’apparence de son sourire.",
    },
  ],
  aboutHeading: ["À propos de la clinique"],
  aboutBody: [
    "{name} est une clinique dentaire à {city}. On explique ce qu’on fait et pourquoi, on vous dit ce que ça coûtera avant de commencer, et on ne presse pas les rendez-vous.",
  ],
  aboutPoints: ["Patients anxieux bienvenus", "Coûts expliqués avant le traitement", "Des rendez-vous sans précipitation"],
  galleryHeading: ["La clinique"],
  galleryBody: ["Un aperçu de la clinique et de la salle de soins."],
  galleryLabels: ["L’accueil", "La salle de soins", "La salle d’attente", "L’équipement"],
  contactBody: ["Appelez pour prendre rendez-vous ou pour vous inscrire comme patient."],
  ctaHeading: ["Prenez rendez-vous"],
  ctaBody: ["Appelez la clinique et on vous trouvera un moment."],
  ctaBodyVisit: ["Passez à la clinique et on vous trouvera un moment."],
  footerNote: ["Clinique dentaire à {city}."],
};

const PHARMACY: CategoryPools = {
  label: "Pharmacie",
  eyebrow: ["Pharmacie à {city}"],
  headline: ["Votre pharmacie de quartier"],
  subheading: ["Ordonnances, conseils et santé au quotidien à {city}."],
  servicesHeading: ["Ce qu’on offre"],
  servicesIntro: ["Ordonnances et conseils, sans rendez-vous."],
  services: [
    {
      title: "Ordonnances",
      body: "Des ordonnances préparées rapidement, et des renouvellements gérés pour que vous n’ayez pas à y penser.",
    },
    {
      title: "Conseils",
      body: "Posez vos questions au pharmacien sur un petit bobo ou un médicament. Pas besoin de rendez-vous.",
    },
    {
      title: "Santé au quotidien",
      body: "Tout ce qu’il faut au quotidien, des analgésiques et premiers soins aux soins de la peau et pour bébé.",
    },
    {
      title: "Services de santé",
      body: "Divers services de santé disponibles en pharmacie. Informez-vous au comptoir.",
    },
  ],
  aboutHeading: ["À propos de la pharmacie"],
  aboutBody: [
    "{name} est une pharmacie à {city}. Un endroit pour récupérer une ordonnance, poser une question franche et obtenir une réponse franche.",
  ],
  aboutPoints: ["Un pharmacien disponible pour discuter", "Renouvellements gérés pour vous", "Pas besoin de rendez-vous"],
  galleryHeading: ["La pharmacie"],
  galleryBody: ["Un aperçu de la pharmacie."],
  galleryLabels: ["Le comptoir", "À l’intérieur", "Salle de consultation", "Les rayons"],
  contactBody: ["Appelez pour une question, ou passez parler au pharmacien."],
  ctaHeading: ["On est là pour vous aider"],
  ctaBody: ["Appelez la pharmacie et on vous aidera si on peut."],
  ctaBodyVisit: ["Passez pendant les heures d’ouverture pour parler au pharmacien."],
  footerNote: ["Pharmacie à {city}."],
};

const BAKERY: CategoryPools = {
  label: "Boulangerie",
  eyebrow: ["Boulangerie à {city}"],
  headline: ["Cuit frais, chaque matin"],
  subheading: ["Une boulangerie à {city} où la journée commence tôt pour que la vôtre commence mieux."],
  servicesHeading: ["Sorti du four"],
  servicesIntro: ["Ce qui sort du four chaque jour."],
  services: [
    {
      title: "Pain",
      body: "Des pains cuits tout au long de la matinée, alors il y a souvent quelque chose d’encore chaud sur les tablettes.",
    },
    {
      title: "Viennoiseries",
      body: "Viennoiseries sucrées et salées faites sur place, meilleures le jour même et rarement là le lendemain.",
    },
    {
      title: "Gâteaux",
      body: "Gâteaux et parts à l’unité, et gâteaux entiers sur commande pour les occasions qui en demandent un.",
    },
    {
      title: "Commandes",
      body: "De grosses commandes pour les événements et les rassemblements. Donnez-nous un peu de préavis et ce sera prêt.",
    },
  ],
  aboutHeading: ["À propos de la boulangerie"],
  aboutBody: [
    "{name} est une boulangerie à {city}. On cuit en petites fournées toute la journée plutôt que tout à l’aube, c’est pour ça que les choses partent vite et qu’elles goûtent meilleur.",
  ],
  aboutPoints: ["Cuit sur place chaque jour", "Gâteaux entiers sur commande", "Le meilleur choix, tôt le matin"],
  galleryHeading: ["La boulangerie"],
  galleryBody: ["Un aperçu du comptoir et de ce qui est sorti du four aujourd’hui."],
  galleryLabels: ["Le comptoir", "Pain frais", "Viennoiseries", "Dans la boulangerie"],
  contactBody: ["Passez, ou appelez d’avance pour une grosse commande."],
  ctaHeading: ["Tout droit du four"],
  ctaBody: ["Appelez-nous pour une grosse commande et elle sera prête."],
  ctaBodyVisit: ["Passez voir ce qui est sorti. Informez-vous en boutique pour les grosses commandes."],
  footerNote: ["Boulangerie à {city}."],
};

const GYM: CategoryPools = {
  label: "Centre d’entraînement",
  eyebrow: ["Centre d’entraînement à {city}"],
  headline: ["Commencez là où vous êtes"],
  subheading: ["Un centre d’entraînement à {city} pour qui veut s’entraîner, peu importe son niveau de départ."],
  servicesHeading: ["Entraînement"],
  servicesIntro: ["Différentes façons de s’entraîner, en groupe ou au calme."],
  services: [
    {
      title: "Abonnement",
      body: "Accès complet à la salle et à l’équipement, sans vous engager pour des années.",
    },
    {
      title: "Cours",
      body: "Des séances de groupe dans la semaine pour ceux qui s’entraînent mieux entourés.",
    },
    {
      title: "Entraînement personnel",
      body: "Des séances individuelles avec un plan bâti autour de vos vrais objectifs.",
    },
    {
      title: "Pour commencer",
      body: "Une introduction à l’équipement et un plan de départ, pour que la première visite ne soit pas un casse-tête.",
    },
  ],
  aboutHeading: ["À propos du centre"],
  aboutBody: [
    "{name} est un centre d’entraînement à {city}. De l’équipement qui fonctionne, du personnel qui vous montre comment l’utiliser, et aucun jugement sur votre point de départ.",
  ],
  aboutPoints: ["Débutants vraiment bienvenus", "Du personnel sur le plancher", "Abonnements flexibles"],
  galleryHeading: ["Le centre"],
  galleryBody: ["Un aperçu de la salle, de l’équipement et du studio."],
  galleryLabels: ["La salle", "Poids libres", "Le studio", "Les vestiaires"],
  contactBody: ["Appelez pour vous renseigner sur l’abonnement ou pour organiser une visite."],
  ctaHeading: ["Découvrez les lieux"],
  ctaBody: ["Appelez-nous et on vous fera visiter, sans pression de vente."],
  ctaBodyVisit: ["Passez et on vous fera visiter, sans pression de vente."],
  footerNote: ["Centre d’entraînement à {city}."],
};

const FLORIST: CategoryPools = {
  label: "Fleuriste",
  eyebrow: ["Fleuriste à {city}"],
  headline: ["Des fleurs pour les jours qui comptent"],
  subheading: ["Un fleuriste à {city} qui compose des bouquets pour les grandes occasions, les petites et les jours ordinaires."],
  servicesHeading: ["Ce qu’on fait"],
  servicesIntro: ["Des arrangements pour toutes les occasions."],
  services: [
    {
      title: "Bouquets",
      body: "Des bouquets montés à la main sur commande, de quelques tiges à quelque chose de bien plus grand.",
    },
    {
      title: "Mariages",
      body: "Les fleurs de toute la journée, prévues avec vous bien à l’avance et livrées à temps.",
    },
    {
      title: "Condoléances",
      body: "Hommages et arrangements préparés avec soin et discrétion quand on en a besoin.",
    },
    {
      title: "Livraison",
      body: "Une livraison locale pour que les fleurs arrivent fraîches, le jour voulu.",
    },
  ],
  aboutHeading: ["À propos de la boutique"],
  aboutBody: [
    "{name} est un fleuriste à {city}. On achète frais, on compose sur commande, et on vous dira volontiers ce qui est beau cette semaine.",
  ],
  aboutPoints: ["Composé frais sur commande", "Livraison locale disponible", "Conseils sur ce qui est de saison"],
  galleryHeading: ["Nos arrangements"],
  galleryBody: ["Quelques arrangements récents et un aperçu de la boutique."],
  galleryLabels: ["La boutique", "Un bouquet", "Fleurs de mariage", "Les tiges de la semaine"],
  contactBody: ["Appelez pour commander, organiser une livraison ou parler d’une occasion."],
  ctaHeading: ["Commandez des fleurs"],
  ctaBody: ["Appelez-nous et parlez-nous de l’occasion."],
  ctaBodyVisit: ["Passez à la boutique et parlez-nous de l’occasion."],
  footerNote: ["Fleuriste à {city}."],
};

const CAR_REPAIR: CategoryPools = {
  label: "Garage",
  eyebrow: ["Garage à {city}"],
  headline: ["Des réparations expliquées avant d’être faites"],
  subheading: ["Un garage à {city} qui vous dit ce qui ne va pas, ce que ça coûte et ce qui peut attendre."],
  servicesHeading: ["Ce qu’on fait"],
  servicesIntro: ["Entretien et réparations pour la plupart des marques."],
  services: [
    {
      title: "Entretien",
      body: "Un entretien régulier pour que l’auto roule bien et pour attraper tôt les problèmes coûteux.",
    },
    {
      title: "Réparations",
      body: "Diagnostic et réparation pour la plupart des marques et modèles, avec le problème expliqué simplement.",
    },
    {
      title: "Inspections",
      body: "Inspections et travaux nécessaires pour tout remettre en ordre, au même endroit.",
    },
    {
      title: "Pneus et freins",
      body: "Les pièces d’usure qui comptent le plus, vérifiées et remplacées quand il le faut, pas avant.",
    },
  ],
  aboutHeading: ["À propos du garage"],
  aboutBody: [
    "{name} est un garage à {city}. On vous dit ce qui ne va pas, ce que ça coûtera et ce qui peut attendre sans risque à la prochaine fois.",
  ],
  aboutPoints: ["Estimation avant les travaux", "Des explications claires, sans jargon", "La plupart des marques et modèles"],
  galleryHeading: ["L’atelier"],
  galleryBody: ["Un aperçu de l’atelier et des baies."],
  galleryLabels: ["L’atelier", "Dans la baie", "Diagnostic", "La cour"],
  contactBody: ["Appelez pour prendre rendez-vous ou décrire un problème et avoir une idée du coût."],
  ctaHeading: ["Prenez rendez-vous pour votre auto"],
  ctaBody: ["Appelez-nous, décrivez le problème, et on vous dira ce que ça implique."],
  ctaBodyVisit: ["Amenez l’auto, décrivez le problème, et on vous dira ce que ça implique."],
  footerNote: ["Garage à {city}."],
};

/** See `GENERIC_EN`. */
export const GENERIC_FR: CategoryPools = {
  label: null,
  eyebrow: ["{city}"],
  headline: ["Bienvenue chez {name}"],
  subheading: ["Au service de la clientèle à {city}."],
  servicesHeading: ["Ce qu’on fait"],
  servicesIntro: ["Les principales façons dont on peut vous aider."],
  services: [
    {
      title: "Nos services",
      body: "Une description des principaux services, écrite pour qu’un nouveau client sache à quoi s’attendre.",
    },
    {
      title: "Comment ça marche",
      body: "Ce qui se passe quand vous nous contactez, et à quoi vous attendre dès la première conversation.",
    },
    {
      title: "Nous joindre",
      body: "Les façons les plus simples de nous joindre et le délai habituel de réponse.",
    },
  ],
  aboutHeading: ["À propos"],
  aboutBody: ["{name} est établi à {city}. Une courte présentation de l’entreprise irait ici."],
  aboutPoints: ["Établi à {city}", "Simple et direct", "Heureux de répondre à vos questions"],
  galleryHeading: ["Galerie"],
  galleryBody: ["Quelques photos de l’entreprise."],
  galleryLabels: ["Photo", "Photo", "Photo", "Photo"],
  contactBody: ["Contactez-nous et on vous aidera avec plaisir."],
  ctaHeading: ["Nous joindre"],
  ctaBody: ["On sera heureux d’avoir de vos nouvelles."],
  ctaBodyVisit: ["Passez nous voir. On sera heureux de vous aider."],
  footerNote: ["Établi à {city}."],
};

export const POOLS_FR: Readonly<Record<string, CategoryPools>> = {
  "hair-salon": HAIR_SALON,
  barber: BARBER,
  "beauty-salon": BEAUTY_SALON,
  "nail-salon": NAIL_SALON,
  tattoo: TATTOO,
  restaurant: RESTAURANT,
  cafe: CAFE,
  dentist: DENTIST,
  pharmacy: PHARMACY,
  bakery: BAKERY,
  gym: GYM,
  florist: FLORIST,
  "car-repair": CAR_REPAIR,
};
