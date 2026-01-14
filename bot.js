const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');

// Настройки бота
const BOT_TOKEN = '8380560268:AAFTlWrVDRoN85V7gkRUbki9yFogSV3r85Y';
const bot = new Telegraf(BOT_TOKEN);

// Список случайных юзернеймов (для примера)
const RANDOM_USERNAMES = [
    'elonmusk', 'taylorswift', 'cristiano', 'nasa', 'github',
    'billgates', 'oprah', 'neymarjr', 'kyliejenner', 'therock',
    'katyperry', 'selenagomez', 'kingjames', 'justinbieber', 'kimkardashian'
];

// Функция для получения случайного юзернейма
function getRandomUsername() {
    return RANDOM_USERNAMES[Math.floor(Math.random() * RANDOM_USERNAMES.length)];
}

// Функция для получения информации о пользователе
async function getUserInfo(username) {
    try {
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
            params: {
                chat_id: `@${username}`
            }
        });

        if (response.data.ok) {
            const user = response.data.result;
            return {
                success: true,
                data: {
                    id: user.id,
                    username: user.username,
                    first_name: user.first_name || 'Не указано',
                    last_name: user.last_name || 'Не указано',
                    bio: user.bio || 'Не указано',
                    description: user.description || 'Не указано',
                    members_count: user.members_count || 'Не указано',
                    is_bot: user.is_bot || false,
                    is_channel: user.type === 'channel',
                    is_group: user.type === 'group',
                    is_private: user.type === 'private',
                    invite_link: user.invite_link || 'Недоступно'
                }
            };
        }
    } catch (error) {
        console.error('Error fetching user info:', error.message);
    }

    return { success: false, data: null };
}

// Функция для форматирования информации в читаемый вид
function formatUserInfo(info) {
    return `
📋 *Информация о пользователе*

👤 *Юзернейм:* @${info.username}
🆔 *ID:* ${info.id}
📛 *Имя:* ${info.first_name}
📛 *Фамилия:* ${info.last_name}

📝 *Био/Описание:*
${info.bio}

👥 *Тип профиля:* ${info.is_channel ? 'Канал' : info.is_group ? 'Группа' : 'Личный аккаунт'}
🤖 *Это бот:* ${info.is_bot ? 'Да' : 'Нет'}
🔒 *Приватный:* ${info.is_private ? 'Да' : 'Нет'}

${info.members_count !== 'Не указано' ? `👥 *Количество участников:* ${info.members_count}` : ''}
${info.invite_link !== 'Недоступно' ? `🔗 *Ссылка-приглашение:* ${info.invite_link}` : ''}
    `;
}

// Команда /start
bot.start((ctx) => {
    ctx.reply(
        '👋 Привет! Я бот для анализа профилей Telegram.\n\n' +
        'Доступные команды:\n' +
        '/random - Получить случайный профиль\n' +
        '/info @username - Получить информацию о конкретном пользователе\n' +
        '/help - Показать справку'
    );
});

// Команда /help
bot.help((ctx) => {
    ctx.reply(
        '📖 *Справка по командам:*\n\n' +
        '/random - Получить информацию о случайном публичном профиле\n' +
        '/info @username - Получить информацию о конкретном пользователе\n' +
        '/stats - Статистика поиска\n' +
        '\n*Примечание:* Бот может получить только общедоступную информацию из профилей.'
    );
});

// Команда /random
bot.command('random', async (ctx) => {
    try {
        await ctx.reply('🎲 Ищу случайный профиль...');
        
        const username = getRandomUsername();
        const userInfo = await getUserInfo(username);
        
        if (userInfo.success) {
            const formattedInfo = formatUserInfo(userInfo.data);
            ctx.reply(formattedInfo, { parse_mode: 'Markdown' });
            
            // Логирование
            logSearch(ctx.from.id, username, true);
        } else {
            ctx.reply(`❌ Не удалось получить информацию о @${username}\nПопробуйте другой профиль.`);
            logSearch(ctx.from.id, username, false);
        }
    } catch (error) {
        console.error('Error in /random command:', error);
        ctx.reply('❌ Произошла ошибка при поиске профиля.');
    }
});

// Команда /info
bot.command('info', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        
        if (args.length < 2) {
            return ctx.reply('❌ Укажите юзернейм после команды:\n`/info @username`', { parse_mode: 'Markdown' });
        }
        
        let username = args[1].replace('@', '');
        
        if (!username) {
            return ctx.reply('❌ Неверный формат юзернейма.');
        }
        
        await ctx.reply(`🔍 Ищу информацию о @${username}...`);
        
        const userInfo = await getUserInfo(username);
        
        if (userInfo.success) {
            const formattedInfo = formatUserInfo(userInfo.data);
            ctx.reply(formattedInfo, { parse_mode: 'Markdown' });
            logSearch(ctx.from.id, username, true);
        } else {
            ctx.reply(`❌ Не удалось получить информацию о @${username}\nВозможные причины:\n• Пользователь не существует\n• Профиль приватный\n• Ошибка соединения`);
            logSearch(ctx.from.id, username, false);
        }
    } catch (error) {
        console.error('Error in /info command:', error);
        ctx.reply('❌ Произошла ошибка при получении информации.');
    }
});

// Команда /stats
bot.command('stats', (ctx) => {
    try {
        const stats = getStats();
        ctx.reply(
            `📊 *Статистика поиска*\n\n` +
            `👤 Всего поисков: ${stats.totalSearches}\n` +
            `✅ Успешных: ${stats.successfulSearches}\n` +
            `❌ Неудачных: ${stats.failedSearches}\n\n` +
            `🕒 Последний поиск: ${stats.lastSearch || 'Нет данных'}`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        ctx.reply('❌ Ошибка при получении статистики.');
    }
});

// Функции для логирования
function logSearch(userId, username, success) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        userId,
        username,
        success
    };
    
    const logs = getLogs();
    logs.push(logEntry);
    
    // Сохраняем только последние 100 записей
    if (logs.length > 100) {
        logs.shift();
    }
    
    fs.writeFileSync('search_logs.json', JSON.stringify(logs, null, 2));
}

function getLogs() {
    try {
        if (fs.existsSync('search_logs.json')) {
            const data = fs.readFileSync('search_logs.json', 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading logs:', error);
    }
    return [];
}

function getStats() {
    const logs = getLogs();
    const totalSearches = logs.length;
    const successfulSearches = logs.filter(log => log.success).length;
    const failedSearches = totalSearches - successfulSearches;
    const lastSearch = logs.length > 0 ? new Date(logs[logs.length - 1].timestamp).toLocaleString('ru-RU') : null;
    
    return {
        totalSearches,
        successfulSearches,
        failedSearches,
        lastSearch
    };
}

// Обработка текстовых сообщений (для юзернеймов без команды)
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    
    // Если сообщение похоже на юзернейм (начинается с @)
    if (text.startsWith('@') && text.length > 1) {
        const username = text.substring(1);
        
        if (username.match(/^[a-zA-Z0-9_]{5,32}$/)) {
            await ctx.reply(`🔍 Ищу информацию о ${text}...`);
            
            const userInfo = await getUserInfo(username);
            
            if (userInfo.success) {
                const formattedInfo = formatUserInfo(userInfo.data);
                ctx.reply(formattedInfo, { parse_mode: 'Markdown' });
                logSearch(ctx.from.id, username, true);
            } else {
                ctx.reply(`❌ Не удалось получить информацию о ${text}`);
                logSearch(ctx.from.id, username, false);
            }
        }
    }
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
    ctx.reply('❌ Произошла ошибка при обработке запроса.');
});

// Запуск бота
console.log('🚀 Бот запускается...');
bot.launch().then(() => {
    console.log('✅ Бот успешно запущен!');
    console.log('🤖 Бот готов к работе!');
});

// Грациозное завершение
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
