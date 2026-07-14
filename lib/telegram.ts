type SendTelegramMessageOptions = {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
}

export function escapeTelegramHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendTelegramMessage(text: string, options: SendTelegramMessageOptions = {}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!botToken || !chatId) {
    throw new Error('Telegram is not configured (missing TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID)')
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
    }),
  })

  if (!res.ok) {
    const details = await res.text()
    throw new Error(`Telegram sendMessage failed: ${details}`)
  }

  return res
}
