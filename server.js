import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors({
  origin: [
    'https://mama-pi-indol.vercel.app',
    'https://mama-kc0f.onrender.com',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: false
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const OWNER_USERNAME = (process.env.OWNER_USERNAME || 'olenatimachova').replace(/^@/, '').toLowerCase();
const DATA_FILE = path.join(__dirname, 'backend', 'data', 'orders.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const STATUSES = {
  new: 'Нове замовлення',
  production: 'Передано на виготовлення',
  awaiting_delivery: 'Очікує на доставку',
  shipping: 'Передано на доставку',
  pickup: 'Прибуло в пункт видачі',
  done: 'Виконано',
  cancelled: 'Скасовано'
};


function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { lastId: 1000, orders: [], adminChatId: null, lastUpdateId: 0 };
  }
}

function writeDb(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function statusLabel(status) {
  return STATUSES[status] || STATUSES.new;
}

function canCancel(status) {
  return ['new', 'production', 'awaiting_delivery'].includes(status);
}

function publicOrder(order) {
  return {
    publicId: order.publicId,
    status: order.status,
    statusLabel: statusLabel(order.status),
    total: order.total,
    itemsSummary: order.items.map((item) => `${item.name} × ${item.qty}`).join(', '),
    canCancel: canCancel(order.status)
  };
}

function sanitizeText(value = '') {
  return String(value).replace(/[<>]/g, '').trim();
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusEmoji(status) {
  return {
    new: '🆕',
    production: '🛠️',
    awaiting_delivery: '📦',
    shipping: '🚚',
    pickup: '📍',
    done: '✅',
    cancelled: '❌'
  }[status] || '🆕';
}

function formatOrderText(order) {
  const items = order.items.map((item, idx) => {
    return `${idx + 1}. <b>${escapeHtml(item.name)}</b>\n<blockquote>${escapeHtml(item.desc)}\nКількість: <b>${item.qty}</b> · Ціна: <b>${item.price} грн</b> · Разом: <b>${item.price * item.qty} грн</b></blockquote>`;
  }).join('\n\n');

  const commentLine = order.customer.comment ? `\n<b>Коментар:</b> ${escapeHtml(order.customer.comment)}` : '';

  return `${statusEmoji(order.status)} <b>Замовлення ${escapeHtml(order.publicId)}</b>\n` +
    `<i>${escapeHtml(statusLabel(order.status))}</i>\n\n` +
    `${items}\n\n` +
    `💳 <b>Загальна сума:</b> ${order.total} грн\n\n` +
    `👤 <b>Клієнт:</b> ${escapeHtml(order.customer.name)}\n` +
    `📱 <b>Телефон:</b> ${escapeHtml(order.customer.phone)}\n` +
    `🏙️ <b>Місто:</b> ${escapeHtml(order.customer.city)}\n` +
    `📦 <b>Адреса / відділення:</b> ${escapeHtml(order.customer.address)}${commentLine}\n` +
    `☎️ <b>Подзвонити:</b> ${order.customer.callMe ? 'Так' : 'Ні'}`;
}

async function telegramApi(method, payload = {}) {
  if (!BOT_TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function inlineKeyboard(orderId) {
  return {
    inline_keyboard: [
      [
        { text: '🛠️ Виготовлення', callback_data: `status:${orderId}:production` },
        { text: '📦 Очікує доставку', callback_data: `status:${orderId}:awaiting_delivery` }
      ],
      [
        { text: '🚚 Передано на доставку', callback_data: `status:${orderId}:shipping` },
        { text: '📍 Прибуло', callback_data: `status:${orderId}:pickup` }
      ],
      [
        { text: '✅ Виконано', callback_data: `status:${orderId}:done` },
        { text: '❌ Скасувати', callback_data: `status:${orderId}:cancelled` }
      ]
    ]
  };
}

async function notifyAdmin(order) {
  const db = readDb();
  if (!db.adminChatId) return;
  await telegramApi('sendMessage', {
    chat_id: db.adminChatId,
    text: formatOrderText(order),
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard(order.publicId),
    link_preview_options: { is_disabled: true }
  });
}

async function sendAdminMessage(text) {
  const db = readDb();
  if (!db.adminChatId) return;
  await telegramApi('sendMessage', { chat_id: db.adminChatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
}

function updateOrderStatus(publicId, status) {
  const db = readDb();
  const order = db.orders.find((item) => item.publicId === publicId);
  if (!order) return null;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  writeDb(db);
  return order;
}

async function processUpdate(update) {
  const db = readDb();

  if (update.message?.text) {
    const message = update.message;
    const username = (message.from?.username || '').toLowerCase();
    const text = message.text.trim();

    if (text.startsWith('/start')) {
      if (!OWNER_USERNAME || username === OWNER_USERNAME) {
        db.adminChatId = message.chat.id;
        writeDb(db);
        await telegramApi('sendMessage', {
          chat_id: message.chat.id,
          text: 'Бот підключено. Команди:\n/orders — активні замовлення\n/order LC-1001 — деталі\n/status LC-1001 shipping — змінити статус\n/cancel LC-1001 — скасувати'
        });
      }
      return;
    }

    if (db.adminChatId && message.chat.id !== db.adminChatId) return;

    if (text.startsWith('/orders')) {
      const active = db.orders.slice(-10).reverse();
      if (!active.length) {
        await telegramApi('sendMessage', { chat_id: message.chat.id, text: 'Замовлень поки немає.' });
        return;
      }
      const summary = active.map((order) => `${order.publicId} — ${statusLabel(order.status)} — ${order.total} грн`).join('\n');
      await telegramApi('sendMessage', { chat_id: message.chat.id, text: summary });
      return;
    }

    if (text.startsWith('/order ')) {
      const id = text.split(' ')[1]?.trim();
      const order = db.orders.find((item) => item.publicId === id);
      await telegramApi('sendMessage', {
        chat_id: message.chat.id,
        text: order ? formatOrderText(order) : 'Замовлення не знайдено.', parse_mode: order ? 'HTML' : undefined
      });
      return;
    }

    if (text.startsWith('/status ')) {
      const [, id, status] = text.split(/\s+/);
      if (!id || !status || !STATUSES[status]) {
        await telegramApi('sendMessage', { chat_id: message.chat.id, text: 'Формат: /status LC-1001 shipping' });
        return;
      }
      const order = updateOrderStatus(id, status);
      await telegramApi('sendMessage', {
        chat_id: message.chat.id,
        text: order ? `Оновлено: ${id} → ${statusLabel(status)}` : 'Замовлення не знайдено.'
      });
      return;
    }

    if (text.startsWith('/cancel ')) {
      const id = text.split(' ')[1]?.trim();
      const order = updateOrderStatus(id, 'cancelled');
      await telegramApi('sendMessage', {
        chat_id: message.chat.id,
        text: order ? `Замовлення ${id} скасовано.` : 'Замовлення не знайдено.'
      });
    }
  }

  if (update.callback_query?.data) {
    const query = update.callback_query;
    const [, orderId, nextStatus] = query.data.split(':');
    const order = updateOrderStatus(orderId, nextStatus);
    await telegramApi('answerCallbackQuery', {
      callback_query_id: query.id,
      text: order ? `Статус: ${statusLabel(nextStatus)}` : 'Замовлення не знайдено.'
    });
    if (order && query.message?.chat?.id && query.message?.message_id) {
      await telegramApi('editMessageText', {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        text: formatOrderText(order),
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard(order.publicId),
        link_preview_options: { is_disabled: true }
      });
    }
  }
}

async function pollTelegram() {
  if (!BOT_TOKEN) return;
  try {
    const db = readDb();
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=25&offset=${db.lastUpdateId + 1}`);
    const data = await response.json();
    if (!data.ok || !Array.isArray(data.result)) return;
    for (const update of data.result) {
      db.lastUpdateId = update.update_id;
      writeDb(db);
      await processUpdate(update);
    }
  } catch {}
}

app.post('/api/orders', async (req, res) => {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const cleanItems = items
    .map((item) => ({
      name: sanitizeText(item.name),
      desc: sanitizeText(item.desc),
      price: Number(item.price || 0),
      qty: Number(item.qty || 0)
    }))
    .filter((item) => item.name && item.price > 0 && item.qty > 0);

  const customer = {
    name: sanitizeText(body.name),
    phone: sanitizeText(body.phone),
    city: sanitizeText(body.city),
    address: sanitizeText(body.address),
    comment: sanitizeText(body.comment),
    callMe: Boolean(body.callMe)
  };

  if (!cleanItems.length) return res.status(400).json({ ok: false, error: 'Кошик порожній' });
  if (!customer.name || !customer.phone || !customer.city || !customer.address) {
    return res.status(400).json({ ok: false, error: 'Не вистачає даних для замовлення' });
  }

  const db = readDb();
  db.lastId += 1;
  const order = {
    id: db.lastId,
    publicId: `LC-${db.lastId}`,
    status: 'new',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: cleanItems,
    total: cleanItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    customer
  };
  db.orders.push(order);
  writeDb(db);
  await notifyAdmin(order);
  res.json({ ok: true, order: publicOrder(order) });
});

app.get('/api/orders/by-ids', (req, res) => {
  const ids = String(req.query.ids || '').split(',').map((id) => id.trim()).filter(Boolean);
  const db = readDb();
  const orders = ids.map((id) => db.orders.find((order) => order.publicId === id)).filter(Boolean).map(publicOrder);
  res.json({ ok: true, orders });
});

app.post('/api/orders/:id/cancel', async (req, res) => {
  const id = req.params.id;
  const db = readDb();
  const order = db.orders.find((item) => item.publicId === id);
  if (!order) return res.status(404).json({ ok: false, error: 'Замовлення не знайдено' });
  if (!canCancel(order.status)) return res.status(400).json({ ok: false, error: 'Замовлення вже не можна скасувати' });
  order.status = 'cancelled';
  order.updatedAt = new Date().toISOString();
  writeDb(db);
  await sendAdminMessage(`Замовлення ${order.publicId} скасовано клієнтом.`);
  res.json({ ok: true, order: publicOrder(order) });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (BOT_TOKEN) {
    console.log('Telegram bot polling started');
    pollTelegram();
    setInterval(pollTelegram, 3000);
  } else {
    console.log('BOT_TOKEN is not set. Orders will save locally, but the bot will not send notifications.');
  }
});
