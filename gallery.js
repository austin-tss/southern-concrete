/* Simiron color and system photos, plus plain-language search.
   Images stay on simiron.com. Southern Concrete does not re-host them. */
var CHIP_PAGE = 'https://simiron.com/products/decorative-chip/';
var FLAKE_PAGE = 'https://simiron.com/systems/simflake-sb/';
var QUARTZ_PAGE = 'https://simiron.com/systems/simquartz-db/';
var SOLID_PAGE = 'https://simiron.com/wp-content/uploads/2026/05/U-TINT_COLOR-GUIDE_FLYER.pdf';
var SIMIRON = 'https://www.simiron.com/';

function gItem(o) {
  o.credit = 'Simiron';
  o.ours = false;
  return o;
}
function flakeBlend(slug, name, colors, tags) {
  return gItem({
    id: 'sim-' + slug,
    name: name,
    system: 'flake',
    colors: colors,
    tags: ['flake', 'chip', 'decorative chip', 'garage', 'blend', 'color'].concat(tags),
    src: 'https://simiron.com/wp-content/uploads/2026/10/simiron-chip-' + slug + '.webp',
    page: CHIP_PAGE
  });
}

var SCC_CATALOG = [
  flakeBlend('feather-gray', 'Feather Gray', 'gray white', ['gray', 'white', 'light']),
  flakeBlend('glacier', 'Glacier', 'gray black white', ['gray', 'black', 'white']),
  flakeBlend('gravel', 'Gravel', 'gray white', ['gray', 'white']),
  flakeBlend('nightfall', 'Nightfall', 'gray black dark', ['gray', 'black', 'dark']),
  flakeBlend('domino', 'Domino', 'black white gray', ['black', 'white', 'gray']),
  flakeBlend('stonewash', 'Stonewash', 'gray white tan', ['gray', 'white']),
  flakeBlend('wombat', 'Wombat', 'gray white black', ['gray', 'white', 'black']),
  flakeBlend('denali', 'Denali', 'gray white', ['gray', 'white']),
  flakeBlend('basalt', 'Basalt', 'gray marble', ['gray', 'marble']),
  flakeBlend('dolerite', 'Dolerite', 'gray white marble', ['gray', 'white', 'marble']),
  flakeBlend('carbon', 'Carbon', 'black gray marble', ['black', 'gray', 'marble', 'dark']),
  flakeBlend('creekbed', 'Creekbed', 'tan brown beige gray', ['tan', 'brown', 'beige', 'gray']),
  flakeBlend('shoreline', 'Shoreline', 'tan beige brown', ['tan', 'beige', 'brown']),
  flakeBlend('pumice', 'Pumice', 'tan white gray marble', ['tan', 'white', 'marble']),
  flakeBlend('limestone', 'Limestone', 'white tan', ['white', 'tan', 'light']),
  flakeBlend('autumn-brown', 'Autumn Brown', 'brown tan', ['brown', 'tan']),
  flakeBlend('cabin-fever', 'Cabin Fever', 'tan white cream', ['tan', 'white', 'cream']),
  flakeBlend('coyote', 'Coyote', 'tan beige white', ['tan', 'beige', 'white']),
  flakeBlend('outback', 'Outback', 'tan brown', ['tan', 'brown']),
  flakeBlend('safari', 'Safari', 'tan brown', ['tan', 'brown']),
  flakeBlend('tidal-wave', 'Tidal Wave', 'blue white gray black', ['blue', 'white', 'gray', 'black']),
  flakeBlend('orbit', 'Orbit', 'blue gray white black', ['blue', 'gray', 'white', 'black']),
  flakeBlend('stargazer', 'Stargazer', 'white gray', ['white', 'gray', 'light']),
  flakeBlend('syncopation', 'Syncopation', 'white', ['white', 'light']),
  gItem({
    id: 'sim-flake-floor',
    name: 'Gray flake floor',
    system: 'flake',
    colors: 'gray black',
    tags: ['flake', 'chip', 'gray', 'black', 'garage', 'floor', 'color'],
    src: 'https://simiron.com/wp-content/uploads/2026/10/home-f-flake.jpg',
    page: FLAKE_PAGE
  }),
  gItem({
    id: 'sim-garage-flake',
    name: 'Garage flake floor',
    system: 'flake',
    colors: 'gray white black',
    tags: ['flake', 'chip', 'gray', 'white', 'black', 'garage', 'color'],
    src: 'https://simiron.com/wp-content/uploads/2026/10/res-garages.jpg',
    page: FLAKE_PAGE
  }),
  gItem({
    id: 'sim-flakes-broadcast',
    name: 'Blue gray flake broadcast',
    system: 'flake',
    colors: 'blue gray white black',
    tags: ['flake', 'chip', 'blue', 'gray', 'white', 'black', 'garage', 'color'],
    src: 'https://simiron.com/wp-content/uploads/2021/02/HP-BR-Flakes_4625-scaled.jpg',
    page: FLAKE_PAGE
  }),
  gItem({
    id: 'sim-bench-chip',
    name: 'Full chip floor',
    system: 'flake',
    colors: 'gray tan white black',
    tags: ['flake', 'chip', 'gray', 'tan', 'garage', 'color'],
    src: 'https://simiron.com/wp-content/uploads/2021/02/Bench-full-chip-floor-scaled.jpg',
    page: CHIP_PAGE
  }),
  gItem({
    id: 'sim-quartz-floor',
    name: 'Quartz floor',
    system: 'quartz',
    colors: 'white tan beige',
    tags: ['quartz', 'white', 'tan', 'beige', 'garage', 'color'],
    src: 'https://simiron.com/wp-content/uploads/2026/10/home-f-quartz.jpg',
    page: QUARTZ_PAGE
  }),
  gItem({
    id: 'sim-solid-white',
    name: 'White solid',
    system: 'solid',
    colors: 'white',
    tags: ['solid', 'solid color', 'white', 'epoxy', 'color'],
    src: 'https://simiron.com/wp-content/uploads/2021/01/2LayerG.png',
    page: SOLID_PAGE
  }),
  gItem({
    id: 'sim-solid-red',
    name: 'Tile Red solid',
    system: 'solid',
    colors: 'red tile red',
    tags: ['solid', 'solid color', 'red', 'tile red', 'epoxy', 'color'],
    src: 'https://simiron.com/wp-content/uploads/2021/01/2LayerE.png',
    page: SOLID_PAGE
  })
];

var GALLERY_STOP = {
  show: 1, me: 1, a: 1, an: 1, the: 1, some: 1, please: 1, with: 1, and: 1, or: 1, of: 1, for: 1,
  floor: 1, floors: 1, photo: 1, photos: 1, picture: 1, pictures: 1, i: 1, want: 1, see: 1, to: 1,
  my: 1, look: 1, looking: 1, like: 1, something: 1
};
var GALLERY_WORD = { grey: 'gray', grays: 'gray', greys: 'gray', chips: 'chip', flakes: 'flake', garages: 'garage', blues: 'blue', colours: 'color', colors: 'color' };

function galleryTokens(q) {
  return String(q || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').map(function (w) {
    return GALLERY_WORD[w] || w;
  }).filter(function (w) { return w && !GALLERY_STOP[w]; });
}
function galleryHay(it) {
  return [it.name, it.system, it.colors, it.caption, (it.tags || []).join(' ')].join(' ').toLowerCase();
}
function galleryMatch(q, extras) {
  var items = SCC_CATALOG.concat(extras || []);
  var words = galleryTokens(q);
  if (!words.length) return items;
  return items.filter(function (it) {
    var hay = galleryHay(it);
    for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
    return true;
  });
}
function ownPhoto(g) {
  var tags = Array.isArray(g.tags) ? g.tags : String(g.tags || '').split(',');
  tags = tags.map(function (s) { return String(s || '').trim(); }).filter(Boolean);
  return {
    id: g.id,
    name: g.caption || 'Our photo',
    system: 'our photo',
    colors: tags.join(' '),
    tags: ['our photo', 'ours'].concat(tags),
    caption: g.caption || '',
    src: g.url,
    page: '',
    ours: true,
    credit: ''
  };
}

var SCCGallery = {
  catalog: SCC_CATALOG,
  simiron: SIMIRON,
  match: galleryMatch,
  tokens: galleryTokens,
  ownPhoto: ownPhoto
};
if (typeof module !== 'undefined' && module.exports) module.exports = SCCGallery;
