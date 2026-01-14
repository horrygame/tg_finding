const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');

// ==================== КОНФИГУРАЦИЯ ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Проверка наличия токена
if (!BOT_TOKEN) {
    console.error('❌ ОШИБКА: BOT_TOKEN не установлен!');
    console.error('Добавьте переменную BOT_TOKEN в Environment Variables на Render');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// ==================== БАЗА ДАННЫХ В ПАМЯТИ (для демо) ====================
let searchHistory = [];
const MAX_HISTORY = 50;

// ==================== СЛУЧАЙНЫЕ ЮЗЕРНЕЙМЫ ====================
const RANDOM_USERNAMES = [
    'telegram', 'github', 'durov', 'elonmusk', 'nasa',
    'billgates', 'cristiano', 'taylorswift', 'neymarjr',
    'kyliejenner', 'therock', 'selenagomez', 'kingjames',
    'justinbieber', 'kimkardashian', 'twitter', 'instagram',
    'facebook', 'whatsapp', 'discord', 'microsoft', 'google',
    'apple', 'netflix', 'spotify', 'amazon', 'youtube',
    'wikipedia', 'bbc', 'cnn', 'nytimes', 'forbes'
];

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/**
 * Получение случайного юзернейма
 */
function getRandomUsername() {
    return RANDOM_USERNAMES[Math.floor(Math.random() * RANDOM_USERNAMES.length)];
}

/**
 * Очистка юзернейма от лишних символов
 */
function cleanUsername(username) {
    return username.replace('@', '').trim();
}

/**
 * Валидация юзернейма
 */
function isValidUsername(username) {
    const cleaned = cleanUsername(username);
    return /^[a-zA-Z0-9_]{4,32}$/.test(cleaned);
}

/**
 * Получение информации о пользователе через Telegram API
 */
async function getUserInfo(username) {
    try {
        console.log(`🔍 Поиск информации о @${username}`);
        
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
            params: {
                chat_id: `@${username}`
            },
            timeout: 10000 // 10 секунд таймаут
        });

        if (response.data.ok) {
            const user = response.data.result;
            
            // Формируем структурированные данные
            const userInfo = {
                id: user.id,
                username: user.username || 'Не указан',
                first_name: user.first_name || 'Не указано',
                last_name: user.last_name || 'Не указано',
                bio: user.bio || 'Биография не указана',
                description: user.description || 'Описание не указано',
                type: user.type || 'private',
                is_bot: user.is_bot || false,
                has_private_forwards: user.has_private_forwards || false,
                join_to_send_messages: user.join_to_send_messages || false,
                join_by_request: user.join_by_request || false,
                has_restricted_voice_and_video_messages: user.has_restricted_voice_and_video_messages || false,
                members_count: user.members_count || 0,
                invite_link: user.invite_link || null,
                created_at: new Date().toISOString()
            };

            // Для каналов и групп добавляем дополнительную информацию
            if (user.type === 'channel' || user.type === 'group' || user.type === 'supergroup') {
                userInfo.title = user.title || 'Без названия';
                userInfo.active_usernames = user.active_usernames || [];
                userInfo.emoji_status_custom_emoji_id = user.emoji_status_custom_emoji_id || null;
            }

            console.log(`✅ Найдена информация о @${username}`);
            return {
                success: true,
                data: userInfo,
                message: 'Информация успешно получена'
            };
        }
    } catch (error) {
        console.error(`❌ Ошибка при получении информации о @${username}:`, error.message);
        
        // Более детальные ошибки
        if (error.response) {
            const errorCode = error.response.data.error_code;
            const errorDescription = error.response.data.description;
            
            if (errorCode === 400) {
                return {
                    success: false,
                    data: null,
                    message: 'Неверный запрос или юзернейм не существует'
                };
            } else if (errorCode === 403) {
                return {
                    success: false,
                    data: null,
                    message: 'Доступ запрещен (приватный профиль)'
                };
            } else if (errorCode === 404) {
                return {
                    success: false,
                    data: null,
                    message: 'Пользователь не найден'
                };
            }
        }
        
        return {
            success: false,
            data: null,
            message: `Ошибка соединения: ${error.message}`
        };
    }

    return {
        success: false,
        data: null,
        message: 'Неизвестная ошибка'
    };
}

/**
 * Форматирование информации для вывода
 */
function formatUserInfo(info) {
    const typeMap = {
        'private': '👤 Личный аккаунт',
        'channel': '📢 Канал',
        'group': '👥 Группа',
        'supergroup': '👥 Супергруппа',
        'bot': '🤖 Бот'
    };

    let message = `📋 *ИНФОРМАЦИЯ О ПРОФИЛЕ*\n\n`;
    
    if (info.title) {
        message += `🏷️ *Название:* ${info.title}\n`;
    }
    
    message += `👤 *Юзернейм:* @${info.username}\n`;
    message += `🆔 *ID:* ${info.id}\n`;
    
    if (info.first_name !== 'Не указано') {
        message += `👤 *Имя:* ${info.first_name}\n`;
    }
    
    if (info.last_name !== 'Не указано') {
        message += `👤 *Фамилия:* ${info.last_name}\n`;
    }
    
    message += `📊 *Тип:* ${typeMap[info.type] || info.type}\n`;
    message += `🤖 *Это бот:* ${info.is_bot ? 'Да' : 'Нет'}\n`;
    
    if (info.members_count > 0) {
        message += `👥 *Участников:* ${info.members_count.toLocaleString()}\n`;
    }
    
    message += `\n📝 *Биография/Описание:*\n${info.bio}\n`;
    
    if (info.description && info.description !== 'Описание не указано') {
        message += `\n📄 *Дополнительное описание:*\n${info.description}\n`;
    }
    
    if (info.active_usernames && info.active_usernames.length > 0) {
        message += `\n🔗 *Активные юзернеймы:*\n`;
        info.active_usernames.forEach((username, index) => {
            message += `${index + 1}. @${username}\n`;
        });
    }
    
    if (info.invite_link) {
        message += `\n🔗 *Ссылка-приглашение:* ${info.invite_link}\n`;
    }
    
    message += `\n⏰ *Запрос выполнен:* ${new Date().toLocaleString('ru-RU')}`;
    
    return message;
}

/**
 * Логирование поиска
 */
function logSearch(userId, username, success, message = '') {
    const logEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        userId,
        username,
        success,
        message,
        date: new Date().toLocaleString('ru-RU')
    };
    
    searchHistory.unshift(logEntry);
    
    // Ограничиваем историю
    if (searchHistory.length > MAX_HISTORY) {
        searchHistory = searchHistory.slice(0, MAX_HISTORY);
    }
    
    console.log(`📝 Логирование: ${success ? '✅' : '❌'} @${username} by ${userId}`);
}

/**
 * Получение статистики
 */
function getStats() {
    const total = searchHistory.length;
    const successful = searchHistory.filter(log => log.success).length;
    const failed = total - successful;
    
    // Самые популярные запросы
    const popularRequests = {};
    searchHistory.forEach(log => {
        if (log.success) {
            popularRequests[log.username] = (popularRequests[log.username] || 0) + 1;
        }
    });
    
    const sortedPopular = Object.entries(popularRequests)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([username, count]) => `@${username}: ${count} раз`);
    
    return {
        total,
        successful,
        failed,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : 0,
        lastSearch: searchHistory[0] ? searchHistory[0].date : 'Нет данных',
        popularRequests: sortedPopular
    };
}

// ==================== КОМАНДЫ БОТА ====================

/**
 * Команда /start
 */
bot.start(async (ctx) => {
    try {
        const welcomeMessage = `
👋 *Добро пожаловать в User Info Bot!*

Я могу показать общедоступную информацию о профилях в Telegram.

*📋 Доступные команды:*
/random - 🎲 Случайный публичный профиль
/info @username - 🔍 Информация о профиле
/stats - 📊 Статистика поиска
/help - ❓ Помощь по командам

*📝 Пример использования:*
Просто отправьте мне юзернейм, например: @telegram
Или используйте команду /info telegram

*⚠️ Важно:* Я показываю только общедоступную информацию.
Приватные профили недоступны для просмотра.

*💡 Совет:* Попробуйте команду /random для начала!
        `;
        
        await ctx.replyWithMarkdown(welcomeMessage);
        console.log(`🚀 Новый пользователь: ${ctx.from.id} (@${ctx.from.username || 'без юзернейма'})`);
    } catch (error) {
        console.error('Ошибка в команде /start:', error);
    }
});

/**
 * Команда /help
 */
bot.help(async (ctx) => {
    const helpMessage = `
*❓ ПОМОЩЬ ПО КОМАНДАМ*

*Основные команды:*
🎲 /random - Получить случайный публичный профиль
🔍 /info [юзернейм] - Информация о конкретном пользователе
📊 /stats - Статистика поиска профилей

*Альтернативные способы:*
📨 Просто отправьте юзернейм в чат (например: @telegram)

*📌 Примеры использования:*
/info telegram - информация о канале Telegram
/info github - информация о профиле GitHub
Просто: @elonmusk - тоже сработает

*🔒 Что я могу показать:*
• Имя и фамилия (если публичные)
• Юзернейм и ID
• Биографию/описание
• Количество участников (для каналов/групп)
• Тип профиля (личный, канал, группа)
• Ссылку-приглашение (если есть)

*🚫 Что я НЕ могу показать:*
• Информацию из приватных профилей
• Номер телефона
• Email адреса
• Историю сообщений
• Другие приватные данные

*💡 Советы:*
1. Для каналов используйте их публичный юзернейм
2. Некоторые профили могут быть недоступны
3. Убедитесь, что юзернейм существует
4. Если не работает, попробуйте другой юзернейм

*🆘 Если что-то не работает:*
Попробуйте:
1. Перезапустить бота командой /start
2. Проверить правильность юзернейма
3. Попробовать другой юзернейм
4. Подождать несколько минут и повторить

*📞 Поддержка:*
Если проблемы продолжаются, обратитесь к администратору бота.
    `;
    
    await ctx.replyWithMarkdown(helpMessage);
});

/**
 * Команда /random
 */
bot.command('random', async (ctx) => {
    try {
        await ctx.reply('🎲 *Ищу случайный публичный профиль...*', { parse_mode: 'Markdown' });
        
        const username = getRandomUsername();
        const userInfo = await getUserInfo(username);
        
        if (userInfo.success) {
            const formattedInfo = formatUserInfo(userInfo.data);
            await ctx.replyWithMarkdown(formattedInfo);
            logSearch(ctx.from.id, username, true, 'Случайный поиск');
        } else {
            await ctx.reply(`❌ Не удалось получить информацию о @${username}\nПричина: ${userInfo.message}`);
            logSearch(ctx.from.id, username, false, userInfo.message);
        }
    } catch (error) {
        console.error('Ошибка в команде /random:', error);
        await ctx.reply('❌ Произошла ошибка при поиске случайного профиля. Попробуйте еще раз.');
    }
});

/**
 * Команда /info
 */
bot.command('info', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        
        if (args.length < 2) {
            return await ctx.reply('❌ *Укажите юзернейм!*\n\nПримеры:\n`/info telegram`\n`/info @github`\n`/info elonmusk`', { parse_mode: 'Markdown' });
        }
        
        let username = cleanUsername(args[1]);
        
        if (!isValidUsername(username)) {
            return await ctx.reply('❌ *Некорректный юзернейм!*\nЮзернейм должен содержать только буквы, цифры и подчеркивания (4-32 символа).', { parse_mode: 'Markdown' });
        }
        
        await ctx.reply(`🔍 *Ищу информацию о @${username}...*`, { parse_mode: 'Markdown' });
        
        const userInfo = await getUserInfo(username);
        
        if (userInfo.success) {
            const formattedInfo = formatUserInfo(userInfo.data);
            await ctx.replyWithMarkdown(formattedInfo);
            logSearch(ctx.from.id, username, true, 'Успешный поиск');
        } else {
            const errorMessage = `❌ *Не удалось получить информацию о @${username}*\n\n*Возможные причины:*\n• Профиль не существует\n• Профиль приватный\n• Ошибка соединения\n\n*Сообщение:* ${userInfo.message}`;
            await ctx.replyWithMarkdown(errorMessage);
            logSearch(ctx.from.id, username, false, userInfo.message);
        }
    } catch (error) {
        console.error('Ошибка в команде /info:', error);
        await ctx.reply('❌ Произошла ошибка при получении информации. Попробуйте еще раз.');
    }
});

/**
 * Команда /stats
 */
bot.command('stats', async (ctx) => {
    try {
        const stats = getStats();
        
        let statsMessage = `📊 *СТАТИСТИКА ПОИСКА*\n\n`;
        statsMessage += `📈 Всего запросов: ${stats.total}\n`;
        statsMessage += `✅ Успешных: ${stats.successful}\n`;
        statsMessage += `❌ Неудачных: ${stats.failed}\n`;
        statsMessage += `🎯 Успешность: ${stats.successRate}%\n\n`;
        
        if (stats.lastSearch !== 'Нет данных') {
            statsMessage += `⏰ Последний поиск: ${stats.lastSearch}\n\n`;
        }
        
        if (stats.popularRequests.length > 0) {
            statsMessage += `🔥 *Популярные запросы:*\n`;
            stats.popularRequests.forEach((item, index) => {
                statsMessage += `${index + 1}. ${item}\n`;
            });
        } else {
            statsMessage += `📭 Пока нет статистики по запросам\n`;
        }
        
        statsMessage += `\n💡 *Совет:* Попробуйте /random для нового поиска!`;
        
        await ctx.replyWithMarkdown(statsMessage);
        console.log(`📊 Показана статистика пользователю ${ctx.from.id}`);
    } catch (error) {
        console.error('Ошибка в команде /stats:', error);
        await ctx.reply('❌ Ошибка при получении статистики.');
    }
});

/**
 * Обработка прямых юзернеймов (без команды)
 */
bot.on('text', async (ctx) => {
    try {
        const text = ctx.message.text.trim();
        
        // Пропускаем команды
        if (text.startsWith('/')) return;
        
        // Проверяем, похоже ли сообщение на юзернейм
        let username;
        
        if (text.startsWith('@')) {
            username = cleanUsername(text);
        } else if (isValidUsername(text) && text.length >= 4) {
            username = text;
        } else {
            // Не похоже на юзернейм, ничего не делаем
            return;
        }
        
        if (!isValidUsername(username)) {
            return;
        }
        
        await ctx.reply(`🔍 *Ищу информацию о @${username}...*`, { parse_mode: 'Markdown' });
        
        const userInfo = await getUserInfo(username);
        
        if (userInfo.success) {
            const formattedInfo = formatUserInfo(userInfo.data);
            await ctx.replyWithMarkdown(formattedInfo);
            logSearch(ctx.from.id, username, true, 'Прямой ввод');
        } else {
            await ctx.replyWithMarkdown(`❌ *Не удалось найти @${username}*\n\nПопробуйте:\n• Проверить правильность юзернейма\n• Использовать другой юзернейм\n• Или попробовать команду /random`);
            logSearch(ctx.from.id, username, false, userInfo.message);
        }
    } catch (error) {
        console.error('Ошибка в обработке текста:', error);
    }
});

// ==================== WEB СЕРВЕР ДЛЯ RENDER ====================

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Главная страница
app.get('/', (req, res) => {
    const stats = getStats();
    
    const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Telegram User Info Bot</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 800px;
                width: 100%;
            }
            .header {
                text-align: center;
                margin-bottom: 40px;
            }
            h1 {
                color: #333;
                margin-bottom: 10px;
                font-size: 2.5em;
            }
            .status {
                display: inline-block;
                background: #10b981;
                color: white;
                padding: 5px 15px;
                border-radius: 20px;
                font-weight: bold;
                margin-top: 10px;
            }
            .stats {
                background: #f8fafc;
                border-radius: 15px;
                padding: 25px;
                margin: 25px 0;
                border: 2px solid #e2e8f0;
            }
            .stats h2 {
                color: #475569;
                margin-bottom: 15px;
                font-size: 1.5em;
            }
            .stat-item {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid #e2e8f0;
            }
            .stat-item:last-child {
                border-bottom: none;
            }
            .instructions {
                margin-top: 30px;
                padding: 25px;
                background: #f0f9ff;
                border-radius: 15px;
                border: 2px solid #bae6fd;
            }
            .instructions h2 {
                color: #0369a1;
                margin-bottom: 15px;
                font-size: 1.5em;
            }
            .command {
                background: #1e293b;
                color: #f1f5f9;
                padding: 10px 15px;
                border-radius: 8px;
                font-family: monospace;
                margin: 10px 0;
                display: inline-block;
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                color: #64748b;
                font-size: 0.9em;
            }
            .bot-link {
                display: inline-block;
                background: #0088cc;
                color: white;
                text-decoration: none;
                padding: 12px 30px;
                border-radius: 25px;
                font-weight: bold;
                margin-top: 20px;
                transition: transform 0.3s, box-shadow 0.3s;
            }
            .bot-link:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(0,136,204,0.3);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤖 Telegram User Info Bot</h1>
                <div class="status">🟢 Онлайн и работает</div>
                <p>Бот для получения общедоступной информации о профилях Telegram</p>
                <a href="https://t.me/${bot.botInfo.username}" class="bot-link" target="_blank">
                    💬 Начать общение с ботом
                </a>
            </div>
            
            <div class="stats">
                <h2>📊 Статистика работы</h2>
                <div class="stat-item">
                    <span>Всего запросов:</span>
                    <strong>${stats.total}</strong>
                </div>
                <div class="stat-item">
                    <span>Успешных:</span>
                    <strong style="color: #10b981;">${stats.successful}</strong>
                </div>
                <div class="stat-item">
                    <span>Неудачных:</span>
                    <strong style="color: #ef4444;">${stats.failed}</strong>
                </div>
                <div class="stat-item">
                    <span>Успешность:</span>
                    <strong>${stats.successRate}%</strong>
                </div>
                ${stats.lastSearch !== 'Нет данных' ? `
                <div class="stat-item">
                    <span>Последний запрос:</span>
                    <strong>${stats.lastSearch}</strong>
                </div>
                ` : ''}
            </div>
            
            <div class="instructions">
                <h2>📖 Как использовать бота</h2>
                <p>Доступные команды в Telegram:</p>
                <div class="command">/start</div> - Начало работы<br>
                <div class="command">/random</div> - Случайный профиль<br>
                <div class="command">/info @username</div> - Информация о профиле<br>
                <div class="command">/stats</div> - Статистика<br>
                <div class="command">/help</div> - Помощь<br>
                <p style="margin-top: 15px;">Или просто отправьте боту юзернейм: <span class="command">@telegram</span></p>
            </div>
            
            <div class="footer">
                <p>🚀 Развернуто на Render | ⚡ Node.js ${process.version}</p>
                <p>⏰ Время работы: ${new Date().toLocaleString('ru-RU')}</p>
                <p>🔗 Ссылка на бота: https://t.me/${bot.botInfo.username}</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    res.send(html);
});

// API статуса
app.get('/status', (req, res) => {
    const stats = getStats();
    
    res.json({
        status: 'online',
        service: 'Telegram User Info Bot',
        bot: bot.botInfo?.username || 'unknown',
        version: '1.0.0',
        environment: NODE_ENV,
        stats: {
            totalSearches: stats.total,
            successfulSearches: stats.successful,
            failedSearches: stats.failed,
            successRate: `${stats.successRate}%`
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        nodeVersion: process.version
    });
});

// API для получения логов (только для админов)
app.get('/api/logs', (req, res) => {
    const auth = req.headers.authorization;
    
    // Простая проверка (в продакшене нужно использовать более надежную аутентификацию)
    if (auth !== `Bearer ${process.env.ADMIN_TOKEN}` && !process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.json({
        logs: searchHistory.slice(0, 20), // Последние 20 записей
        total: searchHistory.length
    });
});

// Health check для Render
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ==================== ЗАПУСК ПРИЛОЖЕНИЯ ====================

// Обработка ошибок бота
bot.catch((err, ctx) => {
    console.error(`❌ Ошибка в обновлении ${ctx.updateType}:`, err);
    
    try {
        ctx.reply('❌ Произошла ошибка при обработке запроса. Пожалуйста, попробуйте еще раз.');
    } catch (e) {
        console.error('Не удалось отправить сообщение об ошибке:', e);
    }
});

// Запуск бота
bot.launch().then(() => {
    console.log('='.repeat(50));
    console.log('✅ БОТ УСПЕШНО ЗАПУЩЕН!');
    console.log('='.repeat(50));
    console.log(`🤖 Имя бота: ${bot.botInfo.username}`);
    console.log(`🆔 ID бота: ${bot.botInfo.id}`);
    console.log(`🌐 Режим: ${NODE_ENV}`);
    console.log(`🔗 Ссылка: https://t.me/${bot.botInfo.username}`);
    console.log('='.repeat(50));
    console.log('📝 Команды бота готовы к использованию!');
    console.log('='.repeat(50));
}).catch((error) => {
    console.error('❌ ОШИБКА ПРИ ЗАПУСКЕ БОТА:', error);
    process.exit(1);
});

// Запуск веб-сервера
app.listen(PORT, () => {
    console.log(`🌐 Веб-сервер запущен на порту ${PORT}`);
    console.log(`📊 Статус доступен по адресу: http://localhost:${PORT}`);
    console.log(`📈 API статуса: http://localhost:${PORT}/status`);
    console.log('='.repeat(50));
    console.log('🚀 Приложение полностью запущено и готово к работе!');
    console.log('='.repeat(50));
});

// Грациозное завершение
process.once('SIGINT', () => {
    console.log('🛑 Получен SIGINT, завершаем работу...');
    bot.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('🛑 Получен SIGTERM, завершаем работу...');
    bot.stop('SIGTERM');
    process.exit(0);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Неперехваченное исключение:', error);
});
