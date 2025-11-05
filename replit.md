# GTFS Bus Visualization Application

## Vue d'ensemble

Application web interactive de visualisation en temps réel des positions de bus basée sur des données GTFS et GeoJSON. L'application affiche une carte OpenStreetMap avec des bus animés qui se déplacent selon leurs horaires GTFS.

## Architecture du Projet

```
/
├── public/                     # Fichiers statiques servis au navigateur
│   ├── index.html             # Page HTML principale
│   ├── style.css              # Styles CSS
│   ├── data/                  # Données GTFS et GeoJSON (fournis par l'utilisateur)
│   │   ├── gtfs/              # Fichiers GTFS (routes.txt, trips.txt, etc.)
│   │   └── map.geojson        # Tracés des lignes de bus
│   └── js/                    # Modules JavaScript ES6
│       ├── main.js            # Point d'entrée et orchestration
│       ├── dataManager.js     # Chargement et parsing GTFS/GeoJSON
│       ├── timeManager.js     # Gestion du temps simulé
│       ├── tripScheduler.js   # Calcul des trajets actifs
│       ├── busPositionCalculator.js  # Interpolation des positions
│       └── mapRenderer.js     # Rendu Leaflet et marqueurs
└── replit.md                  # Cette documentation
```

## Technologies Utilisées

- **Frontend**: HTML5, CSS3, JavaScript ES6 Modules
- **Cartographie**: Leaflet.js + OpenStreetMap
- **Parsing CSV**: PapaParse
- **Serveur**: Python HTTP Server (pour servir les fichiers statiques)

## Fonctionnalités Principales

1. **Carte Interactive**
   - Zoom et déplacement fluides
   - Affichage des tracés de lignes (GeoJSON)
   - Marqueurs animés pour chaque bus actif

2. **Simulation Temporelle**
   - Horloge synchronisée avec les horaires GTFS
   - Contrôles Play/Pause/Reset
   - Vitesses de simulation: x1, x2, x4, x8
   - Configuration de l'heure de départ

3. **Informations en Temps Réel**
   - Popup sur clic de bus (ligne, destination, ETA)
   - Compteur de bus actifs
   - Indicateur de vitesse de simulation

4. **Animation Fluide**
   - Interpolation linéaire entre arrêts
   - Mise à jour en temps réel des positions
   - Transition douce des marqueurs

## Comment Utiliser

1. **Préparer les données**:
   - Placer les fichiers GTFS dans `/public/data/gtfs/`
   - Placer le fichier GeoJSON dans `/public/data/map.geojson`

2. **Démarrer l'application**:
   - Le serveur HTTP Python est configuré pour servir depuis `/public/`
   - Accéder à l'application via le navigateur Replit

3. **Contrôler la simulation**:
   - Ajuster l'heure de départ si nécessaire
   - Cliquer sur "Play" pour démarrer
   - Utiliser les boutons de vitesse pour accélérer
   - Cliquer sur les bus pour voir leurs détails

## Modules JavaScript

### main.js
Orchestre toute l'application, initialise les modules, configure les événements UI.

### dataManager.js
- Charge les fichiers GTFS (CSV) avec PapaParse
- Charge le fichier GeoJSON
- Crée des index pour accès rapide aux données
- Fournit des méthodes de requête pour routes, trips, stops

### timeManager.js
- Gère le temps simulé avec une horloge interne
- Contrôles: play, pause, reset, setSpeed
- Notifie les listeners à chaque mise à jour

### tripScheduler.js
- Calcule quels trips sont actifs à un instant T
- Détermine entre quels arrêts se trouve chaque bus
- Calcule la progression sur chaque segment

### busPositionCalculator.js
- Interpole les positions GPS le long des tracés GeoJSON
- Suit les routes réelles au lieu d'une ligne droite entre arrêts
- Fallback vers interpolation linéaire si pas de tracé disponible
- Utilise la progression pour un mouvement fluide
- Calcule l'orientation du bus (bearing)

### mapRenderer.js
- Initialise la carte Leaflet
- Affiche les routes GeoJSON
- Crée et met à jour les marqueurs de bus
- Gère les popups et interactions

## Format des Données GTFS

L'application attend les fichiers GTFS standards:
- `routes.txt` - Définition des lignes
- `trips.txt` - Courses individuelles
- `stop_times.txt` - Horaires aux arrêts
- `stops.txt` - Coordonnées des arrêts

## État Actuel

- ✅ Architecture modulaire complète
- ✅ Chargement GTFS et GeoJSON
- ✅ Simulation temporelle avec contrôles
- ✅ **Calcul des positions le long des tracés GeoJSON réels**
- ✅ **Les bus suivent les routes exactes au lieu de lignes droites**
- ✅ Rendu sur carte Leaflet
- ✅ Popups avec informations détaillées
- ✅ Interface utilisateur responsive

## Dernières Modifications (05/11/2025)

- ✨ **Amélioration majeure**: Les bus suivent maintenant les tracés GeoJSON des routes
- 🛣️ Interpolation intelligente le long des routes réelles
- 🔄 Fallback automatique vers interpolation linéaire si pas de tracé disponible
- ⚡ Performances optimisées pour flottes de taille moyenne
- 🎨 **Chaque ligne affiche sa propre couleur** au lieu du bleu par défaut
- 🏷️ Popups améliorés avec badge coloré de la ligne
- 🎯 Filtrage intelligent pour n'afficher que les tracés des routes (LineString)

## Prochaines Améliorations Possibles

- Support de calendar.txt pour filtrer par jour
- Affichage des arrêts sur la carte
- Filtrage des lignes visibles
- Mode replay avec timeline
- Optimisation pour grands réseaux (>100 bus)
- Export de captures d'état
