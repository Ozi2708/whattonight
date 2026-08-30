/**
 * Humeurs des films — la donnée la plus importante de Venn.
 *
 * Les genres viennent de TMDB. Les humeurs, non : c'est un jugement éditorial,
 * assumé comme tel. C'est aussi ce sur quoi repose tout le croisement, donc la
 * moindre approximation se paie cash à l'écran.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  LA RÈGLE : UNE HUMEUR DÉCRIT CE QUE ÇA FAIT AU SPECTATEUR,
 *             PAS LE RYTHME NI L'ESTHÉTIQUE DU FILM.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Cette distinction n'était pas écrite, et une erreur systématique s'y était
 * glissée : « chill » avait été posé sur des films lents et léchés — Drive,
 * Blade Runner 2049, Aftersun, Moonlight. Lents, oui. Reposants, non : Drive
 * contient un écrasement de crâne, Aftersun est décrit par la critique comme
 * un « soul-crusher ». Demander « on se pose » et recevoir ça, c'est trahir la
 * demande.
 *
 * Définitions, à appliquer littéralement :
 *
 *  😂 drole         On le met POUR RIRE. L'humour domine du début à la fin.
 *                   Un film qui bascule dans le drame ou l'horreur perd
 *                   l'étiquette, même si des scènes font rire.
 *  💥 intense       Enjeux élevés, ça ne relâche pas.
 *  😌 facile        Se regarde fatigué : simple à suivre, aucune tension
 *                   prolongée. INCOMPATIBLE avec intense / stressant / mindfuck.
 *  🤯 mindfuck      Demande de reconstruire. On en parle après.
 *  ❤️ emotion       Ça serre la gorge.
 *  😱 stressant     Angoisse, peur, malaise.
 *  🔥 spectaculaire Grand écran, images qui en mettent plein la vue.
 *  🧠 intelligent   Des idées, un propos, ça laisse à penser.
 *  🌙 chill         Apaisant. Rien ne vient nous secouer.
 *                   INCOMPATIBLE avec intense / stressant / mindfuck.
 *  🎲 surprenant    Prend à contre-pied.
 *
 * Les deux incompatibilités ne sont pas des conseils : `scripts/check-moods.mjs`
 * fait échouer le build si l'une d'elles est violée.
 *
 * Conséquence assumée : ce catalogue de « films à voir » penche vers le drame
 * et le thriller, donc peu de titres méritent « chill ». Une quinzaine, pas
 * quarante. Mieux vaut un choix restreint mais juste qu'un choix large qui
 * propose Drive un soir de canapé.
 */

export const MOOD_IDS = [
  'drole',
  'intense',
  'facile',
  'mindfuck',
  'emotion',
  'stressant',
  'spectaculaire',
  'intelligent',
  'chill',
  'surprenant',
]

export const MOODS = {
  /* ------------------------------------------------------------- 1990s */
  'The Shawshank Redemption': ['emotion', 'intelligent'],
  'Pulp Fiction': ['surprenant', 'intelligent', 'drole'],
  "Schindler's List": ['emotion', 'intense', 'stressant'],
  Goodfellas: ['intense', 'intelligent'],
  'The Silence of the Lambs (film)': ['stressant', 'intense', 'intelligent'],
  'The Matrix': ['spectaculaire', 'mindfuck', 'intense'],
  'Fight Club': ['mindfuck', 'intense', 'intelligent'],
  'Seven (1995 film)': ['stressant', 'intense'],
  // Retiré « facile » : les raptors dans la cuisine, la scène du T-Rex.
  // Un film de peur bien tenu n'est pas un film qu'on regarde fatigué.
  'Jurassic Park (film)': ['spectaculaire', 'intense', 'stressant'],
  'Terminator 2: Judgment Day': ['spectaculaire', 'intense'],
  'Forrest Gump': ['emotion', 'facile'],
  'Saving Private Ryan': ['intense', 'stressant', 'emotion'],
  'Heat (1995 film)': ['intense', 'intelligent'],
  'The Truman Show': ['intelligent', 'emotion', 'surprenant'],
  'The Lion King': ['emotion', 'facile'],
  'Toy Story': ['facile', 'drole', 'emotion'],
  'La Haine': ['intense', 'intelligent'],
  // Comédie noire au pince-sans-rire : on rit vraiment, sans être secoué.
  'Fargo (1996 film)': ['drole', 'surprenant', 'intelligent'],
  'Titanic (1997 film)': ['emotion', 'spectaculaire'],
  'Princess Mononoke': ['spectaculaire', 'emotion', 'intelligent'],
  // Retiré « drole » : la moitié du film se passe dans un camp
  // d'extermination. Le proposer un soir « on veut rire » serait une faute.
  'Life Is Beautiful': ['emotion', 'intelligent'],
  'Reservoir Dogs': ['intense', 'stressant'],
  'Unforgiven': ['intense', 'intelligent'],
  'Groundhog Day (film)': ['drole', 'facile', 'intelligent'],
  // Retiré « drole » : l'humour noir existe, mais le bébé mort et le sevrage
  // dominent l'expérience.
  'Trainspotting (film)': ['intense', 'stressant', 'surprenant'],

  /* ------------------------------------------------------------- 2000s */
  'Gladiator (2000 film)': ['spectaculaire', 'intense', 'emotion'],
  'Memento (film)': ['mindfuck', 'intelligent'],
  'Requiem for a Dream': ['intense', 'stressant', 'emotion'],
  'Crouching Tiger, Hidden Dragon': ['spectaculaire', 'emotion'],
  'The Lord of the Rings: The Fellowship of the Ring': ['spectaculaire', 'emotion'],
  // Conservé « chill » : les passages inquiétants restent du merveilleux, et
  // le film est massivement vécu comme un refuge.
  'Spirited Away': ['emotion', 'chill', 'spectaculaire'],
  'Mulholland Drive (film)': ['mindfuck', 'stressant'],
  Amélie: ['facile', 'chill', 'emotion'],
  'The Lord of the Rings: The Two Towers': ['spectaculaire', 'intense'],
  'City of God (2002 film)': ['intense', 'stressant'],
  'The Pianist (2002 film)': ['emotion', 'intense', 'stressant'],
  'The Lord of the Rings: The Return of the King': ['spectaculaire', 'emotion'],
  'Oldboy (2003 film)': ['mindfuck', 'intense', 'stressant'],
  'Kill Bill: Volume 1': ['spectaculaire', 'intense', 'surprenant'],
  'Eternal Sunshine of the Spotless Mind': ['emotion', 'mindfuck', 'intelligent'],
  'The Incredibles': ['drole', 'spectaculaire', 'facile'],
  // Retiré « chill » : violence homophobe et fin dévastatrice. Le film est
  // lent, il n'est pas apaisant.
  'Brokeback Mountain': ['emotion', 'intelligent'],
  "Pan's Labyrinth": ['emotion', 'stressant', 'surprenant'],
  'The Departed': ['intense', 'stressant'],
  'Children of Men': ['intense', 'stressant', 'intelligent'],
  'The Prestige (film)': ['mindfuck', 'intelligent', 'surprenant'],
  'No Country for Old Men': ['stressant', 'intense', 'intelligent'],
  'There Will Be Blood': ['intense', 'intelligent'],
  'The Dark Knight': ['spectaculaire', 'intense'],
  // Retiré « drole » : les dialogues sont drôles, mais la ferme et la taverne
  // sont deux des scènes les plus tendues du cinéma récent.
  'Inglourious Basterds': ['intense', 'stressant', 'surprenant'],

  /* ------------------------------------------------------------- 2010s */
  Inception: ['mindfuck', 'spectaculaire', 'intelligent'],
  'The Social Network': ['intelligent', 'intense'],
  'Black Swan (film)': ['stressant', 'intense', 'mindfuck'],
  // Retiré « chill ». C'est l'erreur qui a déclenché toute cette relecture :
  // la bande-son synthé et les plans léchés avaient été pris pour de la
  // douceur. Le film est d'une violence frontale.
  'Drive (2011 film)': ['intense', 'stressant'],
  'The Intouchables': ['drole', 'emotion', 'facile'],
  'A Separation': ['intense', 'intelligent', 'emotion'],
  // Retiré « drole », même raison qu'Inglourious Basterds.
  'Django Unchained': ['intense', 'spectaculaire'],
  'The Hunt (2012 film)': ['stressant', 'intense', 'emotion'],
  // Conservé « chill » : mélancolique, mais aucune violence, aucune tension.
  'Her (2013 film)': ['emotion', 'chill', 'intelligent'],
  'Prisoners (2013 film)': ['stressant', 'intense'],
  // Conservé « drole » : farce assumée de bout en bout.
  'The Wolf of Wall Street (2013 film)': ['drole', 'intense', 'spectaculaire'],
  '12 Years a Slave (film)': ['emotion', 'intense', 'stressant'],
  'Interstellar (film)': ['spectaculaire', 'emotion', 'mindfuck'],
  'Whiplash (2014 film)': ['intense', 'stressant'],
  'Gone Girl (film)': ['surprenant', 'stressant', 'intelligent'],
  'The Grand Budapest Hotel': ['drole', 'facile', 'chill'],
  'Mad Max: Fury Road': ['spectaculaire', 'intense'],
  'Inside Out (2015 film)': ['emotion', 'drole', 'facile'],
  'Spotlight (film)': ['intelligent', 'intense'],
  'Arrival (film)': ['intelligent', 'emotion', 'mindfuck'],
  'La La Land': ['emotion', 'chill', 'facile'],
  // Retiré « chill » : harcèlement, addiction, violences. Contemplatif mais
  // éprouvant.
  'Moonlight (2016 film)': ['emotion', 'intelligent'],
  // Retiré « chill » : la seconde moitié est une course contre une catastrophe.
  'Your Name': ['emotion', 'surprenant', 'spectaculaire'],
  'Get Out': ['stressant', 'surprenant', 'intelligent'],
  // Retiré « chill » : 2h44 d'un futur glacial et violent. Lent n'est pas doux.
  'Blade Runner 2049': ['spectaculaire', 'intelligent'],
  'Coco (2017 film)': ['emotion', 'facile', 'spectaculaire'],
  'Spider-Man: Into the Spider-Verse': ['spectaculaire', 'drole', 'emotion'],
  'Parasite (2019 film)': ['surprenant', 'stressant', 'intelligent'],
  'Joker (2019 film)': ['intense', 'stressant'],
  '1917 (2019 film)': ['intense', 'spectaculaire', 'stressant'],

  /* ------------------------------------------------------------- 2020s */
  'The Father (2020 film)': ['emotion', 'mindfuck', 'stressant'],
  'Another Round (film)': ['drole', 'emotion', 'intelligent'],
  'Soul (2020 film)': ['emotion', 'chill', 'intelligent'],
  // Retiré « chill » : menace permanente, violence, souffle épique.
  'Dune (2021 film)': ['spectaculaire', 'intelligent', 'intense'],
  'Everything Everywhere All at Once': ['mindfuck', 'drole', 'emotion'],
  // Retiré « facile » : les séquences de vol sont à couper le souffle.
  // Grand public ne veut pas dire reposant.
  'Top Gun: Maverick': ['spectaculaire', 'intense', 'emotion'],
  'The Batman (film)': ['intense', 'stressant', 'spectaculaire'],
  // Retiré « chill » : la critique parle d'un film « qui broie ».
  Aftersun: ['emotion', 'intelligent'],
  'All Quiet on the Western Front (2022 film)': ['intense', 'stressant', 'emotion'],
  'Oppenheimer (film)': ['intense', 'intelligent'],
  // Conservé « chill » : tendre, calme, aucune tension. Triste sans secouer.
  'Past Lives (film)': ['emotion', 'chill'],
  'Anatomy of a Fall': ['intelligent', 'stressant'],
  'The Holdovers': ['drole', 'emotion', 'chill'],
  'Spider-Man: Across the Spider-Verse': ['spectaculaire', 'mindfuck', 'emotion'],
  'Dune: Part Two': ['spectaculaire', 'intense'],
  'Anora': ['drole', 'intense', 'emotion'],
  'The Substance': ['stressant', 'mindfuck', 'surprenant'],
  'Sinners (2025 film)': ['stressant', 'spectaculaire', 'intense'],
  'One Battle After Another': ['drole', 'intense', 'surprenant'],
  'The Odyssey (2026 film)': ['spectaculaire', 'intense'],
}
