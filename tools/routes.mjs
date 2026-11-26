/* The routes tools/build_route.mjs builds. way: [lat, lon] points the road must pass through, in riding order.
   loop: the road returns to its start. treeline: height in metres above which no trees grow.
   trees: how much of the lower ground is wooded, 0 to 1. keep: reuse the road already in public/routes (a GPX route). */
export const ROUTES = [
  { id: 'dunlap-roddy-lando', keep: true, note: 'South Carolina, USA', trees: 0.6, margin: 900 },
  { id: 'cauberg-loop', name: 'Cauberg Loop', note: 'Valkenburg, Netherlands', loop: true, trees: 0.3, way: [[50.8655, 5.8300], [50.8615, 5.7850], [50.8690, 5.7800], [50.8715, 5.8050]] },
  { id: 'sa-calobra', name: 'Sa Calobra', note: 'Mallorca, Spain', trees: 0.25, treeline: 900, trim: true, way: [[39.8512, 2.8000], [39.8226, 2.8117]] },
  { id: 'alpe-dhuez', name: "Alpe d'Huez", note: 'Isère, France', trees: 0.5, treeline: 2000, way: [[45.0645, 6.0385], [45.0925, 6.0700]] },
  { id: 'ronde-hoep', name: 'Ronde Hoep', note: 'Ouderkerk aan de Amstel, Netherlands', loop: true, trees: 0.05, smooth: 500, water: false, way: [[52.2940, 4.9110], [52.2788, 4.8793], [52.2570, 4.8735], [52.2526, 4.8898], [52.2726, 4.9263], [52.2832, 4.9208]] },
  { id: 'coll-de-sa-batalla', name: 'Coll de sa Batalla', note: 'Mallorca, Spain', trees: 0.5, treeline: 1100, way: [[39.7700, 2.9030], [39.8170, 2.8870]] },
  { id: 'els-angels', name: 'Els Àngels', note: 'Girona, Spain', trees: 0.75, way: [[41.9783, 2.8457], [41.9756, 2.9106]] },
  { id: 'col-deze', name: "Col d'Èze", note: 'Nice, France', trees: 0.35, way: [[43.7050, 7.2900], [43.7230, 7.3050], [43.7370, 7.3600]] },
  { id: 'ghisallo', name: 'Madonna del Ghisallo', note: 'Lake Como, Italy', trees: 0.7, way: [[45.9800, 9.2570], [45.9500, 9.2600], [45.9370, 9.2720], [45.9230, 9.2690]] },
  { id: 'trollstigen', name: 'Trollstigen', note: 'Møre og Romsdal, Norway', trees: 0.5, treeline: 650, trim: true, way: [[62.4900, 7.7150], [62.4530, 7.6640]] },
  { id: 'furkapass', name: 'Furkapass from Realp', note: 'Uri, Switzerland', trees: 0.15, treeline: 1900, trim: true, way: [[46.5980, 8.5020], [46.5725, 8.4150]] },
  { id: 'tremola', name: 'Gotthard Tremola', note: 'Ticino, Switzerland', trees: 0.3, treeline: 1900, trim: true, way: [[46.5290, 8.6080], [46.5480, 8.5700], [46.5555, 8.5675]] },
  { id: 'lake-annecy', name: 'Lake Annecy', note: 'Haute-Savoie, France', loop: true, trees: 0.5, treeline: 1900, way: [[45.8990, 6.1290], [45.8640, 6.1400], [45.8280, 6.2030], [45.7750, 6.2220], [45.8400, 6.2140], [45.8830, 6.1700]] },
  { id: 'cap-formentor', name: 'Cap de Formentor', note: 'Mallorca, Spain', trees: 0.3, way: [[39.9060, 3.0830], [39.9610, 3.2130]] },
  { id: 'galibier', name: 'Col du Galibier from Valloire', note: 'Savoie, France', trees: 0.1, treeline: 2100, trim: true, way: [[45.1650, 6.4290], [45.0641, 6.4078]] },
  { id: 'ventoux', name: 'Mont Ventoux from Bédoin', note: 'Vaucluse, France', trees: 0.75, treeline: 1500, trim: true, way: [[44.1240, 5.1800], [44.1500, 5.3180], [44.1740, 5.2787]] },
  { id: 'stelvio', name: 'Passo dello Stelvio from Prato', note: 'South Tyrol, Italy', trees: 0.55, treeline: 2100, trim: true, way: [[46.6190, 10.5920], [46.5285, 10.4530]] },
];
