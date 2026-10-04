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
  serverName: '<:ticket:1552741225092882525> Source',
  color: 0xe11d2e, // rouge
  description: '★ ★ ★ ★ ★  •  `Legit Shop` !\n« Simple, rapide, efficace. ».',
  footer: 'Source · Shop',

  // Lien direct vers ton image (voir README pour l'obtenir)
  bannerUrl: process.env.BANNER_URL || null,

  // Moyens de paiement (emoji : unicode OU "<:nom:ID>" pour un emoji perso)
  payments: {
    pp_balance: { label: 'PayPal Balance', description: 'Depuis le solde PayPal', emoji: '💙' },
    pp_card: { label: 'PayPal Card', description: 'Par carte bancaire via PayPal', emoji: '💳' },
    crypto: { label: 'Crypto (LTC)', description: 'Paiement Litecoin', emoji: '🪙' },
  },

  // Produits. "options" = menu quantité/prix. Vide = pas de menu, prix "à définir".
  // Remplace les emojis par les tiens : '<:nitro:123456789012345678>'
  products: {
    nitro: {
      label: 'Nitro',
      description: 'Discord Nitro',
      emoji: '<:nitro:1549913256301301780>',
      options: [{ label: '1 mois', price: 3.5 }],
    },
    boost: {
      label: 'Server Boost',
      description: 'Boosts de serveur',
      emoji: '💎',
      options: boostOptions,
    },
    decoration: {
      label: 'Decoration',
      description: 'Décorations de profil',
      emoji: '🎨',
      options: [{ label: 'Décoration', price: 1.5 }],
    },
    giveaway: { label: 'Giveaway', description: 'Giveaway', emoji: '🎁', options: [] },
    snap: {
      label: 'Snap +',
      description: 'Snapchat Plus',
      emoji: '👻',
      options: [
        { label: '3 mois', price: 6 },
        { label: '6 mois', price: 12 },
        { label: '12 mois', price: 24 },
      ],
    },
    discord_account: { label: 'Discord compte', description: 'Comptes Discord', emoji: '👤', options: [] },
    account: { label: 'Account', description: 'Autres comptes', emoji: '🔑', options: [] },
    fournisseur: {
      label: 'Fournisseur',
      description: 'Accès fournisseur',
      emoji: '📦',
      options: [
        { label: 'Comptes (Netflix & +)', price: 5 },
        { label: 'Boosts & +', price: 10 },
      ],
    },
    other: { label: 'Other', description: 'Autre demande', emoji: '❓', options: [] },
  },
};
