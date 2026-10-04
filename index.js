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
} = require('discord.js');
const config = require('./config');

const PREFIX = '+';
const { TOKEN, TICKET_CATEGORY_ID, STAFF_ROLE_ID, VERIFIED_ROLE_ID } = process.env;
const EPHEMERAL = MessageFlags.Ephemeral;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const fmt = (n) => `${String(n).replace('.', ',')}€`;

// ---------- Stockage (data.json) : règlement accepté + vouchs ----------
const DATA_FILE = path.join(__dirname, 'data.json');
function loadData() {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { accepted: d.accepted || [], vouches: d.vouches || {} };
  } catch {
    return { accepted: [], vouches: {} };
  }
}
let data = loadData();
const saveData = () => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

client.once('clientReady', () => console.log(`Connecté en tant que ${client.user.tag}`));

// ---------- Panel "Nous sommes fiables" ----------
function legitEmbed() {
  return new EmbedBuilder()
    .setColor(config.color)
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
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`${config.serverName} Tickets`)
        .setDescription(config.description)
        .setFooter({ text: config.footer });
      if (config.bannerUrl) embed.setImage(config.bannerUrl);

      const menu = new StringSelectMenuBuilder()
        .setCustomId('cat')
        .setPlaceholder('Choisir une catégorie...')
        .addOptions(
          Object.entries(config.products).map(([key, p]) => ({
            label: p.label,
            value: key,
            description: p.description,
            emoji: p.emoji,
          }))
        );

      await m.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
      return m.delete().catch(() => {});
    }

    // +legit : panel règlement
    if (cmd === 'legit' && isAdmin) {
      await m.channel.send({ embeds: [legitEmbed()], components: [legitRow()] });
      return m.delete().catch(() => {});
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
          description: pay.description,
          emoji: pay.emoji,
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
    parent: TICKET_CATEGORY_ID || null,
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
    .setTitle(`${p.label}${opt ? ` — ${opt.label}` : ''}`)
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
