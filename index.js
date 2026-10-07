require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const config = require('./config');

const PREFIX = '+';
const { TOKEN, TICKET_CATEGORY_ID, STAFF_ROLE_ID, VERIFIED_ROLE_ID, REVIEWS_CHANNEL_ID } = process.env;
const EPHEMERAL = MessageFlags.Ephemeral;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const fmt = (n) => `${String(n).replace('.', ',')}€`;
const emo = config.titleEmoji ? `${config.titleEmoji} ` : '';

// ---------- Stockage (data.json) : règlement accepté + vouchs ----------
const DATA_FILE = path.join(__dirname, 'data.json');
function loadData() {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { accepted: d.accepted || [], vouches: d.vouches || {}, reviews: d.reviews || [] };
  } catch {
    return { accepted: [], vouches: {}, reviews: [] };
  }
}
let data = loadData();
const saveData = () => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

client.once('clientReady', () => console.log(`Connecté en tant que ${client.user.tag}`));

// ---------- Panel "Nous sommes fiables" ----------
function legitEmbed() {
  return new EmbedBuilder()
    .setColor(config.legitColor)
    .setTitle('✅ Nous sommes fiables')
    .setDescription(
      [
        '*Communauté de confiance & contrôlée*',
        '',
        "Bienvenue ! Avant d'aller plus loin, certifie que tu as pris connaissance du **règlement** et que tu n'es pas là pour **nuire** à la communauté.",
        '',
        "✅ **Oui** — j'ai pris connaissance du règlement et je l'accepte.",
        '❌ **Non** — je refuse (*tu seras exclu du serveur*).',
      ].join('\n')
    )
    .setFooter({ text: `✅ ${data.accepted.length} membres ont validé le règlement.` });
}

const legitRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('legit_yes').setLabel("Oui, j'accepte").setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('legit_no').setLabel('Non, je refuse').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );

// ---------- Boutons du ticket ----------
function ticketRow({ claimed = false, done = false } = {}) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim')
      .setLabel('Prise en charge')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(claimed),
    new ButtonBuilder().setCustomId('done').setLabel("L'Achat est finis").setStyle(ButtonStyle.Success).setDisabled(done),
    new ButtonBuilder().setCustomId('close').setLabel('Fermer').setStyle(ButtonStyle.Danger)
  );
}
const btnState = (msg, id) => msg.components[0]?.components.find((c) => c.customId === id)?.disabled ?? false;

// ---------- Avis ----------
const REVIEW_PAGE_SIZE = 5;
const REVIEW_COOLDOWN = 60 * 60 * 1000; // 1 avis par heure et par personne
const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(5 - n);

function reviewsPage(page = 0) {
  const all = [...data.reviews].reverse(); // plus récents d'abord
  const pages = Math.max(1, Math.ceil(all.length / REVIEW_PAGE_SIZE));
  page = Math.min(Math.max(page, 0), pages - 1);

  const embed = new EmbedBuilder().setColor(config.color).setTitle(`⭐ Avis ${config.serverName}`);
  if (!all.length) {
    embed.setDescription('Aucun avis pour le moment.');
    return { embeds: [embed], components: [] };
  }

  const avg = (all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1).replace('.', ',');
  const lines = all
    .slice(page * REVIEW_PAGE_SIZE, (page + 1) * REVIEW_PAGE_SIZE)
    .map(
      (r) =>
        `${stars(r.rating)} — **${r.username}** · <t:${Math.floor(r.date / 1000)}:R>\n> ${r.comment.replace(/\n/g, '\n> ')}`
    );
  embed
    .setDescription(`**${avg}/5** · ${all.length} avis\n\n${lines.join('\n\n')}`)
    .setFooter({ text: `Page ${page + 1}/${pages}` });

  const components = [];
  if (pages > 1) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`avis:${page - 1}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId(`avis:${page + 1}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1)
      )
    );
  }
  return { embeds: [embed], components };
}

async function onModal(i) {
  if (i.customId !== 'review_modal') return;

  const rating = Number(i.fields.getTextInputValue('rating').trim());
  const comment = i.fields.getTextInputValue('comment').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return i.reply({ content: 'La note doit être un nombre entier entre 1 et 5.', flags: EPHEMERAL });
  }

  const last = [...data.reviews].reverse().find((r) => r.user === i.user.id);
  if (last && Date.now() - last.date < REVIEW_COOLDOWN) {
    return i.reply({ content: 'Tu as déjà laissé un avis il y a peu. Réessaie un peu plus tard.', flags: EPHEMERAL });
  }

  data.reviews.push({ user: i.user.id, username: i.user.username, rating, comment, date: Date.now() });
  saveData();

  // Poste l'avis dans un salon (optionnel)
  if (REVIEWS_CHANNEL_ID) {
    const ch = await client.channels.fetch(REVIEWS_CHANNEL_ID).catch(() => null);
    if (ch) {
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(stars(rating))
        .setDescription(comment)
        .setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })
        .setFooter({ text: config.footer });
      await ch.send({ embeds: [embed] }).catch(console.error);
    }
  }

  return i.reply({ content: 'Merci pour ton avis ! ⭐', flags: EPHEMERAL });
}

// ---------- Commandes à préfixe ----------
client.on('messageCreate', async (m) => {
  if (m.author.bot || !m.guild || !m.content.startsWith(PREFIX)) return;

  const body = m.content.slice(PREFIX.length).trim();
  const cmd = body.split(/\s+/)[0].toLowerCase();
  const args = body.slice(cmd.length).trim();
  const isAdmin = m.member.permissions.has(PermissionFlagsBits.Administrator);

  try {
    // +panel : panel de tickets
    if (cmd === 'panel' && isAdmin) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('cat')
        .setPlaceholder('Choisir une catégorie...')
        .addOptions(
          Object.entries(config.products).map(([key, p]) => ({
            label: p.label,
            value: key,
            description: p.description || undefined,
            emoji: p.emoji || undefined,
          }))
        );

      // Panel en "container" : l'image est tout en haut
      const container = new ContainerBuilder().setAccentColor(config.color);
      if (config.bannerUrl) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.bannerUrl))
        );
      }
      container
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${emo}${config.serverName} Tickets\n${config.description}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${config.footer}`));

      await m.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
      return m.delete().catch(() => {});
    }

    // +legit : panel règlement
    if (cmd === 'legit' && isAdmin) {
      await m.channel.send({ embeds: [legitEmbed()], components: [legitRow()] });
      return m.delete().catch(() => {});
    }

    // +avispanel : panel pour laisser un avis (admin)
    if (cmd === 'avispanel' && isAdmin) {
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle('⭐ Votre avis compte')
        .setDescription(
          `*Partagez votre expérience avec ${config.serverName}*\n\nCliquez ci-dessous pour laisser une **note** et un **commentaire**.`
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('review_open').setLabel('Laisser un avis').setEmoji('⭐').setStyle(ButtonStyle.Success)
      );
      await m.channel.send({ embeds: [embed], components: [row] });
      return m.delete().catch(() => {});
    }

    // +avis : tous les avis
    if (cmd === 'avis') {
      return m.reply({ ...reviewsPage(0), allowedMentions: { parse: [] } });
    }

    // +paypal : infos de paiement PayPal
    if (cmd === 'paypal') {
      await m.channel.send('`burpy9x@gmail.com` Family And Friend Only And Proof (No Respect=Order Cancelled)');
      return m.delete().catch(() => {});
    }

    // +itc (ou +ltc) : adresse Litecoin
    if (cmd === 'itc' || cmd === 'ltc') {
      await m.channel.send('`ltc1qtgy0cunl36cpujyr06ny3n9yhhk0gyfpd026f3`');
      return m.delete().catch(() => {});
    }

    // +vouch <id> | produit | prix | paiement
    if (cmd === 'vouch') {
      const [rawTarget, product, price = 'N/A', payment = 'N/A'] = args.split('|').map((s) => s.trim());
      const targetId = (rawTarget || '').replace(/\D/g, '');
      if (!targetId || !product) {
        return m.reply({ content: 'Format : `+vouch <id> | produit | prix | paiement`', allowedMentions: { parse: [] } });
      }
      if (targetId === m.author.id) return m.reply('Tu ne peux pas te vouch toi-même.');

      const member = await m.guild.members.fetch(targetId).catch(() => null);
      if (!member) return m.reply('Membre introuvable sur ce serveur.');

      const list = (data.vouches[targetId] ||= []);
      const dup = list.find(
        (v) =>
          v.from === m.author.id &&
          v.product === product &&
          v.price === price &&
          v.payment === payment &&
          Date.now() - v.date < 10 * 60 * 1000
      );
      if (dup) return m.reply('Ce vouch a déjà été enregistré.');

      list.push({ from: m.author.id, product, price, payment, date: Date.now() });
      saveData();

      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle('✅ Vouch enregistré')
        .setDescription(
          `Merci <@${m.author.id}> !\n<@${targetId}> a maintenant **${list.length}** vouch(s).\n\n**${product}** · ${price} · ${payment}`
        )
        .setFooter({ text: `${config.footer} · +deal @membre pour voir tous les vouch` });
      return m.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    }

    // +deal @username : tous les vouch reçus
    if (cmd === 'deal') {
      let user = m.mentions.users.first();
      if (!user) {
        const id = args.replace(/\D/g, '');
        user = id ? await client.users.fetch(id).catch(() => null) : m.author;
      }
      if (!user) return m.reply('Membre introuvable.');

      const list = data.vouches[user.id] || [];
      const recent = list.slice(-10).reverse();
      const lines = recent.map(
        (v) =>
          `• <@${v.from}> — **${v.product}** · ${v.price} · ${v.payment} · <t:${Math.floor(v.date / 1000)}:R>`
      );

      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`Deals de ${user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .setDescription(`**${list.length}** vouch(s)\n\n${lines.join('\n') || 'Aucun vouch pour le moment.'}`);
      if (list.length > 10) embed.setFooter({ text: `+ ${list.length - 10} vouch plus anciens` });
      return m.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
  } catch (e) {
    console.error(e);
  }
});

// ---------- Interactions ----------
client.on('interactionCreate', async (i) => {
  try {
    if (i.isStringSelectMenu()) return await onSelect(i);
    if (i.isButton()) return await onButton(i);
    if (i.isModalSubmit()) return await onModal(i);
  } catch (e) {
    console.error(e);
    const msg = { content: 'Une erreur est survenue.', flags: EPHEMERAL };
    if (i.replied || i.deferred) i.followUp(msg).catch(() => {});
    else i.reply(msg).catch(() => {});
  }
});

async function onSelect(i) {
  // 1) Catégorie choisie -> menu paiement (éphémère)
  if (i.customId === 'cat') {
    const key = i.values[0];
    const p = config.products[key];
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`pay:${key}`)
      .setPlaceholder('Sélectionne...')
      .addOptions(
        Object.entries(config.payments).map(([k, pay]) => ({
          label: pay.label,
          value: k,
          description: pay.description || undefined,
          emoji: pay.emoji || undefined,
        }))
      );
    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`${p.label} — Paiement`)
      .setDescription('Choisis comment tu payes');
    return i.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: EPHEMERAL,
    });
  }

  // 2) Paiement choisi -> menu quantité (ou ticket direct)
  if (i.customId.startsWith('pay:')) {
    const key = i.customId.split(':')[1];
    const payKey = i.values[0];
    const p = config.products[key];

    if (!p.options.length) return openTicket(i, key, payKey, null);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`qty:${key}:${payKey}`)
      .setPlaceholder('Sélectionne...')
      .addOptions(
        p.options.map((o, idx) => ({
          label: `${o.label} — ${fmt(o.price)}`,
          value: String(idx),
        }))
      );
    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`${p.label} — ${config.payments[payKey].label}`)
      .setDescription('Choisis la quantité');
    return i.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
  }

  // 3) Quantité choisie -> ticket
  if (i.customId.startsWith('qty:')) {
    const [, key, payKey] = i.customId.split(':');
    return openTicket(i, key, payKey, Number(i.values[0]));
  }
}

async function openTicket(i, key, payKey, optIdx) {
  const p = config.products[key];
  const pay = config.payments[payKey];
  const opt = optIdx === null ? null : p.options[optIdx];
  const guild = i.guild;

  // Vérifie la config avant de créer le ticket
  if (!STAFF_ROLE_ID || !guild.roles.cache.has(STAFF_ROLE_ID)) {
    console.error(`STAFF_ROLE_ID invalide ("${STAFF_ROLE_ID}") : ce n'est pas un rôle de ce serveur.`);
    return i.update({
      content: 'Configuration incomplète (rôle staff introuvable). Préviens un administrateur.',
      embeds: [],
      components: [],
    });
  }

  // Catégorie des tickets : si l'ID est invalide, on crée le ticket sans catégorie
  const category = TICKET_CATEGORY_ID ? guild.channels.cache.get(TICKET_CATEGORY_ID) : null;
  const ticketParent = category && category.type === ChannelType.GuildCategory ? category.id : null;
  if (TICKET_CATEGORY_ID && !ticketParent) {
    console.error(`TICKET_CATEGORY_ID invalide ("${TICKET_CATEGORY_ID}") : ce n'est pas une catégorie de ce serveur.`);
  }

  // 1 ticket ouvert max par personne
  const existing = guild.channels.cache.find((c) => c.topic && c.topic.startsWith(`${i.user.id}|`));
  if (existing) {
    return i.update({
      content: `Tu as déjà un ticket ouvert : ${existing}`,
      embeds: [],
      components: [],
    });
  }

  const channel = await guild.channels.create({
    name: `ticket-${i.user.username}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: ticketParent,
    // buyerId | produit | option | paiement | staff qui a pris en charge
    topic: [i.user.id, key, optIdx ?? '', payKey, ''].join('|'),
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: i.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: STAFF_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageChannels,
        ],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(`${emo}${p.label}${opt ? ` — ${opt.label}` : ''}`)
    .setDescription(`Bienvenue ${i.user}, un membre du staff arrive pour s'occuper de toi.`)
    .addFields(
      { name: 'Produit', value: `${p.emoji} ${p.label}${opt ? ` ${opt.label}` : ''}`, inline: true },
      { name: 'Paiement', value: `${pay.emoji} ${pay.label}`, inline: true },
      { name: 'Prix', value: opt ? fmt(opt.price) : 'À définir', inline: true }
    )
    .setFooter({ text: config.footer });

  await channel.send({ content: `${i.user} <@&${STAFF_ROLE_ID}>`, embeds: [embed], components: [ticketRow()] });
  return i.update({ content: `Ton ticket est prêt : ${channel}`, embeds: [], components: [] });
}

async function onButton(i) {
  // ----- Avis : ouvrir le formulaire -----
  if (i.customId === 'review_open') {
    const modal = new ModalBuilder()
      .setCustomId('review_modal')
      .setTitle('Laisser un avis')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('rating')
            .setLabel('Note sur 5 (1 à 5)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('5')
            .setMinLength(1)
            .setMaxLength(1)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('comment')
            .setLabel('Votre commentaire')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Rapide, sérieux, au top...')
            .setMinLength(3)
            .setMaxLength(500)
            .setRequired(true)
        )
      );
    return i.showModal(modal);
  }

  // ----- Avis : changer de page (+avis) -----
  if (i.customId.startsWith('avis:')) {
    return i.update(reviewsPage(Number(i.customId.split(':')[1])));
  }

  // ----- Panel règlement -----
  if (i.customId === 'legit_yes') {
    if (!data.accepted.includes(i.user.id)) {
      data.accepted.push(i.user.id);
      saveData();
    }
    if (VERIFIED_ROLE_ID) await i.member.roles.add(VERIFIED_ROLE_ID).catch(console.error);
    await i.update({ embeds: [legitEmbed()] });
    return i.followUp({ content: 'Merci, règlement validé ✅', flags: EPHEMERAL });
  }

  if (i.customId === 'legit_no') {
    if (!i.member.kickable) {
      return i.reply({ content: "Refus noté, mais je ne peux pas t'exclure du serveur.", flags: EPHEMERAL });
    }
    await i.reply({ content: 'Tu as refusé le règlement : tu vas être exclu du serveur.', flags: EPHEMERAL });
    return setTimeout(() => i.member.kick('A refusé le règlement').catch(console.error), 2000);
  }

  // ----- Copier le vouch (accessible à tous) -----
  if (i.customId === 'copy') {
    const raw = i.message.embeds[0]?.fields?.[0]?.value || '';
    const text = raw.replace(/```/g, '').trim();
    return i.reply({ content: text, flags: EPHEMERAL });
  }

  // ----- Boutons du ticket (staff) -----
  const isStaff = i.member.roles.cache.has(STAFF_ROLE_ID);

  // Prise en charge
  if (i.customId === 'claim') {
    if (!isStaff) return i.reply({ content: 'Réservé au staff.', flags: EPHEMERAL });

    const parts = (i.channel.topic || '').split('|');
    if (parts[4]) {
      return i.reply({ content: `Déjà pris en charge par <@${parts[4]}>.`, flags: EPHEMERAL });
    }

    await i.update({ components: [ticketRow({ claimed: true, done: btnState(i.message, 'done') })] });

    parts[4] = i.user.id;
    await i.channel.setTopic(parts.join('|')).catch(console.error);

    const embed = new EmbedBuilder().setColor(config.color).setDescription(`${i.user} vous a pris en charge !`);
    return i.channel.send({ content: `<@${parts[0]}>`, embeds: [embed] });
  }

  // Fermer le ticket + MP au client
  if (i.customId === 'close') {
    if (!isStaff) return i.reply({ content: 'Réservé au staff.', flags: EPHEMERAL });
    await i.reply('Ticket fermé, suppression dans 5 secondes...');

    try {
      const [buyerId, key, optIdx, payKey, claimer] = (i.channel.topic || '').split('|');
      const p = config.products[key];
      const pay = config.payments[payKey];
      const opt = p && optIdx !== '' ? p.options[Number(optIdx)] : null;

      const buyer = await client.users.fetch(buyerId).catch(() => null);
      const staff = claimer ? await client.users.fetch(claimer).catch(() => null) : null;

      // Durée du ticket
      const mins = Math.max(1, Math.round((Date.now() - i.channel.createdTimestamp) / 60000));
      const duration = mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1).replace('.', ',')} h`;

      const lines = [`Ton ticket sur **${config.serverName}** a été fermé.`];
      if (claimer) lines.push(`Il a été pris en charge par **${staff?.username ?? 'un membre du staff'}**.`);
      lines.push('Merci pour ta confiance !');

      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle('🔒 Ticket fermé')
        .setDescription(lines.join('\n'))
        .setFooter({ text: config.footer });

      if (p) {
        embed.addFields(
          { name: 'Produit', value: `${p.emoji} ${p.label}${opt ? ` ${opt.label}` : ''}`, inline: true },
          { name: 'Prix', value: opt ? fmt(opt.price) : 'N/A', inline: true },
          { name: 'Paiement', value: pay ? `${pay.emoji} ${pay.label}` : 'N/A', inline: true },
          { name: 'Durée', value: duration, inline: true }
        );
      }

      if (buyer) await buyer.send({ embeds: [embed] }).catch(() => {}); // MP fermés : on ignore
    } catch (e) {
      console.error(e);
    }

    return setTimeout(() => i.channel.delete().catch(() => {}), 5000);
  }

  // Achat fini -> message de vouch
  if (i.customId === 'done') {
    if (!isStaff) return i.reply({ content: "Seul le staff peut valider la fin de l'achat.", flags: EPHEMERAL });

    const [buyerId, key, optIdx, payKey, claimer] = (i.channel.topic || '').split('|');
    const p = config.products[key];
    const pay = config.payments[payKey];
    if (!p || !pay) return i.reply({ content: 'Infos du ticket introuvables.', flags: EPHEMERAL });
    const opt = optIdx !== '' ? p.options[Number(optIdx)] : null;

    // Le vouch va au staff qui a pris en charge (sinon celui qui clique)
    const sellerId = claimer || i.user.id;
    const product = `${p.label}${opt ? ` ${opt.label}` : ''}`;
    const price = opt ? fmt(opt.price) : 'N/A';
    const vouch = `+vouch ${sellerId} | ${product} | ${price} | ${pay.label}`;

    await i.update({ components: [ticketRow({ claimed: btnState(i.message, 'claim'), done: true })] });

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`Vouch · ${p.label}`)
      .setDescription(
        `Merci pour ton deal <@${buyerId}> !\nPour vouch <@${sellerId}>, clique 📋 **Copier** puis colle le texte ici.`
      )
      .addFields({ name: 'Vouch à copier :', value: '```\n' + vouch + '\n```' })
      .setFooter({ text: `Sur mobile : appuie longuement sur la zone grise · ${config.footer}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('copy').setLabel('Copier').setEmoji('📋').setStyle(ButtonStyle.Success)
    );
    return i.channel.send({ content: `<@${buyerId}>`, embeds: [embed], components: [row] });
  }
}

client.login(TOKEN);
