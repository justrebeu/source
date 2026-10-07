// ============================================================
//  CONFIG DU SHOP "SOURCE"
//  Modifie ici les produits, prix, emojis et textes.
// ============================================================

// Génère les paliers de Server Boost : x14, x28, x42... (3.3€ par 14)
const boostOptions = [];
for (let n = 1; n <= 5; n++) {
  boostOptions.push({
    label: `x${14 * n}`,
    price: Math.round(3.3 * n * 100) / 100,
  });
}

module.exports = {
  serverName: 'Source',
  // Emoji perso affiché devant le titre du panel et des embeds de tickets ('' = aucun)
  titleEmoji: '<:tic:1552741225092882525>',
  color: 0xe11d2e, // rouge
  legitColor: 0xe11d2e, // bleu (panel "Nous sommes fiables")
  description: '★ ★ ★ ★ ★  •  `Legit Shop` !\n-# « Simple, rapide, efficace. ».',
  footer: 'Source · Shop',

  // Lien direct vers ton image (voir README pour l'obtenir)
  bannerUrl: process.env.BANNER_URL || null,

  // Moyens de paiement (emoji : unicode OU "<:nom:ID>" pour un emoji perso)
  payments: {
    pp_balance: { label: 'PayPal Balance', description: '', emoji: '<a:ppl:1556723779546124449>' },
    pp_card: { label: 'PayPal Card', description: '', emoji: '💳' },
    crypto: { label: 'Crypto (LTC)', description: '', emoji: '<:ltc:1556724010639827089>' },
  },

  // Produits. "options" = menu quantité/prix. Vide = pas de menu, prix "à définir".
  // Remplace les emojis par les tiens : '<:nitro:123456789012345678>'
  products: {
    nitro: {
      label: 'Nitro',
      description: '',
      emoji: '<:nitro:1549913256301301780>',
      options: [{ label: '1 mois', price: 3.5 }],
    },
    boost: {
      label: 'Server Boost',
      description: '',
      emoji: '<:boost:1549915329772130385>',
      options: boostOptions,
    },
    decoration: {
      label: 'Decoration',
      description: '',
      emoji: '<:hashtag:1549917504749703338>',
      options: [{ label: 'Décoration', price: 1.5 }],
    },
    giveaway: { label: 'Giveaway', description: '', emoji: '🎁', options: [] },
    cc: {
      label: 'CC',
      description: '',
      emoji: '💳',
      options: [
        { label: 'CC Basic', price: 10 },
        { label: 'CC Platinium', price: 21.40 },
        { label: 'CC Buisness', price: 72.80 },
        { label: 'CC Entreprise', price: 142.80 },
      ],
    },
    snap: {
      label: 'Snap +',
      description: '',
      emoji: '<:snapchat:1549917398939992124>',
      options: [
        { label: '3 mois', price: 6 },
        { label: '6 mois', price: 12 },
        { label: '12 mois', price: 24 },
      ],
    }, 
    discord_account: { label: 'Discord compte', description: '', emoji: '<:account:1552760568006447114>', options: [] },
    account: { label: 'Account', description: '', emoji: '<:account:1552760568006447114>', options: [] },
    fournisseur: {
      label: 'Fournisseur',
      description: '',
      emoji: '<:chariot:1549918971409727608>',
      options: [
        { label: 'Comptes (Netflix & +)', price: 5 },
        { label: 'Boosts & +', price: 10 },
      ],
    },
    other: { label: 'Other', description: '', emoji: '<:punaise:1549926731115135107>', options: [] },
  },
};
