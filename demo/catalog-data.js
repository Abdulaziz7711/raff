// Demo build only: the fixed catalog the demo uses instead of RAWG / TMDB.
// [title, year, by, genres]
const GAMES = [
  ['Castlevania: Aria of Sorrow', 2003, 'Konami', ['أكشن', 'مغامرة']], ['Ace Attorney: Trials and Tribulations', 2004, 'Capcom', ['مغامرة', 'ألغاز']],
  ['Persona 5 Royal', 2019, 'Atlus', ['آر بي جي']], ['Gears of War: E-Day', 2026, 'The Coalition', ['أكشن', 'تصويب']],
  ['Anger Foot', 2024, 'Free Lives', ['أكشن', 'تصويب', 'مستقلة']], ['Operation: Tango', 2021, 'Clever Plays', ['مغامرة', 'ألغاز']],
  ['Elden Ring', 2022, 'FromSoftware', ['آر بي جي', 'أكشن']], ['Hollow Knight: Silksong', 2025, 'Team Cherry', ['منصات', 'مستقلة']],
  ['Hollow Knight', 2017, 'Team Cherry', ['منصات', 'مستقلة']], ['Hades', 2020, 'Supergiant Games', ['أكشن', 'مستقلة']],
  ['Hades II', 2025, 'Supergiant Games', ['أكشن', 'مستقلة']], ['Celeste', 2018, 'Maddy Makes Games', ['منصات', 'مستقلة']],
  ['The Legend of Zelda: Breath of the Wild', 2017, 'Nintendo', ['مغامرة', 'أكشن']], ['The Legend of Zelda: Tears of the Kingdom', 2023, 'Nintendo', ['مغامرة', 'أكشن']],
  ['God of War Ragnarök', 2022, 'Santa Monica Studio', ['أكشن', 'مغامرة']], ['Red Dead Redemption 2', 2018, 'Rockstar Games', ['أكشن', 'مغامرة']],
  ['The Witcher 3: Wild Hunt', 2015, 'CD Projekt Red', ['آر بي جي']], ['Cyberpunk 2077', 2020, 'CD Projekt Red', ['آر بي جي', 'تصويب']],
  ["Baldur's Gate 3", 2023, 'Larian Studios', ['آر بي جي', 'استراتيجية']], ['Sekiro: Shadows Die Twice', 2019, 'FromSoftware', ['أكشن', 'مغامرة']],
  ['Bloodborne', 2015, 'FromSoftware', ['آر بي جي', 'أكشن']], ['Dark Souls III', 2016, 'FromSoftware', ['آر بي جي', 'أكشن']],
  ['Persona 4 Golden', 2012, 'Atlus', ['آر بي جي']], ['Persona 3 Reload', 2024, 'Atlus', ['آر بي جي']],
  ['Metaphor: ReFantazio', 2024, 'Atlus', ['آر بي جي']], ['Final Fantasy VII Rebirth', 2024, 'Square Enix', ['آر بي جي', 'أكشن']],
  ['Final Fantasy XVI', 2023, 'Square Enix', ['آر بي جي', 'أكشن']], ['Resident Evil 4', 2023, 'Capcom', ['أكشن', 'رعب']],
  ['Resident Evil Village', 2021, 'Capcom', ['أكشن', 'رعب']], ['Silent Hill 2', 2024, 'Bloober Team', ['رعب', 'مغامرة']],
  ['Astro Bot', 2024, 'Team Asobi', ['منصات']], ['Super Mario Odyssey', 2017, 'Nintendo', ['منصات']],
  ['Metroid Dread', 2021, 'MercurySteam', ['أكشن', 'منصات']], ['Ori and the Will of the Wisps', 2020, 'Moon Studios', ['منصات', 'مستقلة']],
  ['Disco Elysium', 2019, 'ZA/UM', ['آر بي جي', 'مستقلة']], ['Outer Wilds', 2019, 'Mobius Digital', ['مغامرة', 'ألغاز']],
  ['Balatro', 2024, 'LocalThunk', ['بطاقات', 'مستقلة']], ['Stardew Valley', 2016, 'ConcernedApe', ['محاكاة', 'مستقلة']],
  ['Black Myth: Wukong', 2024, 'Game Science', ['أكشن', 'آر بي جي']], ['Clair Obscur: Expedition 33', 2025, 'Sandfall Interactive', ['آر بي جي']],
  ['Death Stranding 2: On the Beach', 2025, 'Kojima Productions', ['أكشن', 'مغامرة']], ['Ghost of Yōtei', 2025, 'Sucker Punch', ['أكشن', 'مغامرة']],
  ['Ghost of Tsushima', 2020, 'Sucker Punch', ['أكشن', 'مغامرة']], ["Marvel's Spider-Man 2", 2023, 'Insomniac Games', ['أكشن']],
  ['The Last of Us Part II', 2020, 'Naughty Dog', ['أكشن', 'مغامرة']], ['Street Fighter 6', 2023, 'Capcom', ['قتال']],
  ['Tekken 8', 2024, 'Bandai Namco', ['قتال']], ['EA Sports FC 25', 2024, 'EA Vancouver', ['رياضة']],
  ['Minecraft', 2011, 'Mojang', ['محاكاة']], ['Portal 2', 2011, 'Valve', ['ألغاز']]
];
const MOVIES = [
  ['Dune: Part Two', 2024, 'Denis Villeneuve', ['خيال علمي', 'مغامرة']], ['Dune', 2021, 'Denis Villeneuve', ['خيال علمي', 'مغامرة']],
  ['Oppenheimer', 2023, 'Christopher Nolan', ['دراما', 'تاريخ']], ['Interstellar', 2014, 'Christopher Nolan', ['خيال علمي', 'دراما']],
  ['Inception', 2010, 'Christopher Nolan', ['خيال علمي', 'أكشن']], ['The Dark Knight', 2008, 'Christopher Nolan', ['أكشن', 'جريمة']],
  ['Perfect Days', 2023, 'Wim Wenders', ['دراما']], ['Parasite', 2019, 'Bong Joon-ho', ['إثارة', 'دراما']],
  ['Spirited Away', 2001, 'Hayao Miyazaki', ['رسوم متحركة', 'فانتازيا']], ['The Boy and the Heron', 2023, 'Hayao Miyazaki', ['رسوم متحركة', 'فانتازيا']],
  ['Your Name.', 2016, 'Makoto Shinkai', ['رسوم متحركة', 'رومانسي']], ['Spider-Man: Across the Spider-Verse', 2023, 'Joaquim Dos Santos', ['رسوم متحركة', 'أكشن']],
  ['Everything Everywhere All at Once', 2022, 'Daniels', ['أكشن', 'كوميديا']], ['Whiplash', 2014, 'Damien Chazelle', ['دراما', 'موسيقى']],
  ['La La Land', 2016, 'Damien Chazelle', ['رومانسي', 'موسيقى']], ['Blade Runner 2049', 2017, 'Denis Villeneuve', ['خيال علمي']],
  ['Mad Max: Fury Road', 2015, 'George Miller', ['أكشن', 'مغامرة']], ['Top Gun: Maverick', 2022, 'Joseph Kosinski', ['أكشن', 'دراما']],
  ['The Godfather', 1972, 'Francis Ford Coppola', ['جريمة', 'دراما']], ['Pulp Fiction', 1994, 'Quentin Tarantino', ['جريمة', 'إثارة']],
  ['Fight Club', 1999, 'David Fincher', ['دراما']], ['Se7en', 1995, 'David Fincher', ['جريمة', 'غموض']],
  ['Joker', 2019, 'Todd Phillips', ['جريمة', 'إثارة']], ['Past Lives', 2023, 'Celine Song', ['دراما', 'رومانسي']],
  ['Poor Things', 2023, 'Yorgos Lanthimos', ['كوميديا', 'خيال علمي']], ['Killers of the Flower Moon', 2023, 'Martin Scorsese', ['جريمة', 'تاريخ']],
  ['Barbie', 2023, 'Greta Gerwig', ['كوميديا']], ['Sinners', 2025, 'Ryan Coogler', ['رعب', 'إثارة']],
  ['The Batman', 2022, 'Matt Reeves', ['جريمة', 'غموض']], ['Wadjda', 2012, 'Haifaa al-Mansour', ['دراما']]
];
// [title, year, by, genres, anime?]
const SHOWS = [
  ['Frieren: Beyond Journey\'s End', 2023, 'Madhouse', ['رسوم متحركة', 'مغامرة'], 1], ['Severance', 2022, 'Apple TV+', ['دراما', 'غموض']],
  ['Chainsaw Man', 2022, 'MAPPA', ['رسوم متحركة', 'أكشن'], 1], ['Dark', 2017, 'Netflix', ['خيال علمي وفانتازيا', 'غموض']],
  ['Attack on Titan', 2013, 'Wit Studio / MAPPA', ['رسوم متحركة', 'أكشن'], 1], ['Jujutsu Kaisen', 2020, 'MAPPA', ['رسوم متحركة', 'أكشن'], 1],
  ['Demon Slayer: Kimetsu no Yaiba', 2019, 'ufotable', ['رسوم متحركة', 'أكشن'], 1], ['One Piece', 1999, 'Toei Animation', ['رسوم متحركة', 'مغامرة'], 1],
  ['Fullmetal Alchemist: Brotherhood', 2009, 'Bones', ['رسوم متحركة', 'مغامرة'], 1], ['Steins;Gate', 2011, 'White Fox', ['رسوم متحركة', 'خيال علمي وفانتازيا'], 1],
  ['Vinland Saga', 2019, 'Wit Studio / MAPPA', ['رسوم متحركة', 'دراما'], 1], ['Spy x Family', 2022, 'Wit Studio / CloverWorks', ['رسوم متحركة', 'كوميديا'], 1],
  ['Solo Leveling', 2024, 'A-1 Pictures', ['رسوم متحركة', 'أكشن'], 1], ['Dandadan', 2024, 'Science SARU', ['رسوم متحركة', 'كوميديا'], 1],
  ['Cowboy Bebop', 1998, 'Sunrise', ['رسوم متحركة', 'خيال علمي وفانتازيا'], 1], ['Neon Genesis Evangelion', 1995, 'Gainax', ['رسوم متحركة', 'دراما'], 1],
  ['Breaking Bad', 2008, 'AMC', ['دراما', 'جريمة']], ['Better Call Saul', 2015, 'AMC', ['دراما', 'جريمة']],
  ['The Bear', 2022, 'FX', ['دراما', 'كوميديا']], ['Shōgun', 2024, 'FX', ['دراما', 'حرب وسياسة']],
  ['The Last of Us', 2023, 'HBO', ['دراما', 'خيال علمي وفانتازيا']], ['Succession', 2018, 'HBO', ['دراما']],
  ['Chernobyl', 2019, 'HBO', ['دراما', 'تاريخ']], ['True Detective', 2014, 'HBO', ['جريمة', 'غموض']],
  ['Arcane', 2021, 'Fortiche / Netflix', ['رسوم متحركة', 'أكشن ومغامرة']], ['Stranger Things', 2016, 'Netflix', ['خيال علمي وفانتازيا', 'غموض']],
  ['The Office', 2005, 'NBC', ['كوميديا']], ['Game of Thrones', 2011, 'HBO', ['خيال علمي وفانتازيا', 'دراما']],
  ['Andor', 2022, 'Disney+', ['خيال علمي وفانتازيا', 'دراما']], ['Squid Game', 2021, 'Netflix', ['دراما', 'إثارة']],
  ['Pluribus', 2025, 'Apple TV+', ['دراما', 'خيال علمي وفانتازيا']], ['Shabab Al Bomb', 2012, 'Rotana', ['كوميديا']]
];
const PLAT = ['PlayStation 5', 'Xbox Series X|S', 'PC', 'Nintendo Switch'];

export const ALL = [
  ...GAMES.map(([title, year, by, genres], i) => ({ id: 'g' + (101 + i), kind: 'games', title, year, by, genres, platforms: i % 4 === 3 ? ['Nintendo Switch'] : PLAT.slice(0, 2 + (i % 2)) })),
  ...MOVIES.map(([title, year, by, genres], i) => ({ id: 'm' + (201 + i), kind: 'movies', title, year, by, genres })),
  ...SHOWS.map(([title, year, by, genres, anime], i) => ({ id: 's' + (301 + i), kind: 'shows', title, year, by, genres, sub: anime ? 'أنمي' : 'مسلسل' }))
];
