// Google Meet Subtitles Logger
// This script monitors Google Meet subtitle elements and logs them to the console

// Префикс для системных сообщений - позволяет отличать их от субтитров
const SYSTEM_PREFIX = '🔧 SYSTEM: ';
const SUBTITLE_PREFIX = '📝 ';

// Constants for logging
const DEBUG_PREFIX = '[DEBUG] ';
const MAX_DEBUG_MESSAGES = 15; // Maximum number of debug messages to show
const DEBUG_INTERVAL_MS = 1000; // Minimum time between debug messages in ms

// Заменяем стандартный console.log для системных сообщений
const originalConsoleLog = console.log;

// Custom console.log for filtering debug messages
const consoleLog = function() {
  debugMessageCount++;
  if (debugMessageCount < MAX_DEBUG_MESSAGES) {
    originalConsoleLog.apply(console, arguments);
  } else if (debugMessageCount === MAX_DEBUG_MESSAGES) {
    originalConsoleLog(`[DEBUG LIMIT] Лимит отладочных сообщений (${MAX_DEBUG_MESSAGES}) достигнут. Дальнейшие сообщения будут скрыты.`);
  }
};

/**
 * Ограничивает вывод отладочных сообщений по количеству и времени
 */
function limitedDebugLog() {
    const now = Date.now();
    
    // Ограничиваем частоту отладочных сообщений
    if (now - lastDebugLogTime < DEBUG_INTERVAL_MS) {
        return;
    }
    
    // Ограничиваем общее количество отладочных сообщений
    if (debugMessageCount >= MAX_DEBUG_MESSAGES) {
        // Если достигли лимита, показываем сообщение только раз
        if (debugMessageCount === MAX_DEBUG_MESSAGES) {
            originalConsoleLog(`[DEBUG LIMIT] Лимит отладочных сообщений (${MAX_DEBUG_MESSAGES}) достигнут. Дальнейшие сообщения будут скрыты.`);
            debugMessageCount++;
        }
        return;
    }
    
    // Обновляем счетчик и время последнего сообщения
    debugMessageCount++;
    lastDebugLogTime = now;
    
    // Добавляем префикс к текстовым сообщениям
    if (arguments.length > 0 && typeof arguments[0] === 'string') {
        const args = Array.from(arguments);
        args[0] = DEBUG_PREFIX + args[0];
        originalConsoleLog.apply(console, args);
    } else {
        originalConsoleLog.apply(console, arguments);
    }
}

// Теперь запускаем оригинальное сообщение
originalConsoleLog('Google Meet Subtitles Logger started');

// Track previously seen subtitles to avoid duplicates
let seenSubtitles = new Set();
let lastSubtitle = '';
let lastLogTime = 0;
let currentBuffer = '';
let bufferTimer = null;
let isProcessing = false;
// Добавляем счетчик для ограничения отладочных сообщений
let debugMessageCount = 0;

// Отслеживание состояния активных наблюдателей
let activeObservers = new Set();
let mainObserver = null;
let lastSubtitleTime = 0;

// Constants for subtitle processing
const MIN_LENGTH = 3;                 // Минимальная длина для вывода - уменьшена с 10 до 3
const BUFFER_DELAY = 1500;            // Задержка буфера (1.5 секунды) - уменьшена с 1800
const MIN_LOG_INTERVAL = 500;         // Минимальный интервал логирования (0.5 сек) - уменьшен с 800
const DUPLICATE_WINDOW_MS = 3000;     // Максимальное время для проверки дубликатов (3 сек) - уменьшено с 10 сек
const SIMILARITY_WINDOW_MS = 1500;    // Окно для проверки похожих текстов (1.5 сек) - уменьшено с 2 сек
const SIMILARITY_THRESHOLD = 0.85;    // Порог схожести текстов - уменьшен с 0.9 (менее строгий)

// Массив для хранения недавних субтитров с временными метками
let recentSubtitles = [];
let lastDebugLogTime = 0;

// UI элементы, которые не должны распознаваться как субтитры
const UI_ELEMENTS = [
  'arrow_downward', 'Jump to bottom', 'More options', 'more_vert', 'Present', 'present_to_all',
  'Microphone', 'Camera', 'Join now', 'Leave call', 'Turn on', 'Turn off',
  'mic_', 'videocam', 'settings', 'people', 'chat', 'present_', 'inventory',
  'volume_up', 'check', 'expand_more', 'notifications', 'Ready to join?',
  'Test speakers', 'Use Companion mode', 'Cast this meeting', 'Make a test recording',
  'Cast', 'Other ways', 'Choose activity', 'speaker_', 'Join', 'Leave',
  'Now', 'have joined', 'allowed to', 'hand is', 'camera is', 'microphone is', 
  'desktop notifi', 'is here', 'participants', 'no one',
  // Новые служебные сообщения
  'Apply visual effects', 'Gemini', 'note', 'account', 'Show', 'fewer', 'options',
  'Call ends', 'Switch', 'gmail', 'Apply', 'effect', 'Offer', 'Effects', 'soon',
  'maksumonka', 'comSwitch', 'isn\'t taking', 'Will end', 'Call will',
  'taking notes', 'not taking', 'taking note', 'enable', 'disable', 'caption',
  'filter', 'layout', 'view', 'Raise hand', 'hand (ctrl', 'alt', 'fasteners'
];

// Классы элементов, которые могут содержать субтитры
const SUBTITLE_CLASSES = [
  'CNusmb', 'VbkSUe', 'a4cQT', 'iOzk7', 'TBMuR', 'zTETae', 
  'Mz6pEf', 'n2NWs', 'KvPUJb', 'iTTPOb', 'vdk1ce',
  // Добавляем новые классы для последней версии Google Meet
  'VfPpkd-gIZYIncW', 'ceZ3VW', 'JIPKlb'
];

// Основные селекторы для субтитров Google Meet
// Google Meet постоянно обновляется, поэтому эти селекторы могут меняться
const SUBTITLE_SELECTORS = [
  // Основные селекторы субтитров
  '.CNusmb', '.VbkSUe', '.a4cQT', '[data-message-text]', 
  '.iOzk7', '.TBMuR', '.zTETae', '.Mz6pEf', '.n2NWs',
  // Дополнительные селекторы, которые были замечены
  '.KvPUJb', '.iTTPOb',
  // Транскрипция
  '[data-identifier="live-caption"]',
  // Транскрипции в боковой панели
  '.vdk1ce',
  // Элементы транскрипции с атрибутом роли
  '[role="complementary"]',
  '[role="log"]',
  // Новые селекторы для последней версии Google Meet
  '.VfPpkd-gIZYIncW', '.ceZ3VW', '.JIPKlb', 
  '[jsname="tgaKEf"]', // Контейнер субтитров в новой версии
  '[jscontroller="IlfM5e"]', // Контроллер субтитров
  '[data-display-text]', // Атрибут с текстом
  '.subtitle-container', // Общий класс для контейнеров субтитров
  '.captions-container', // Ещё один возможный класс
  '.Pdb3Mc', // Последний обнаруженный класс субтитров
  // Новейшие селекторы (апрель 2023+)
  '.S6VXfe', '.g0gqYb', '.textLayer', '.WkZsyc', '.PBWx0c',
  '[jsname="YPqjbf"]', '[jscontroller="P7L8k"]',
  // Селекторы подписей (май 2023+)
  '.caption-textarea', '.captions-text', '.caption-window',
  '.vjs-text-track-display', '.texttrack-container',
  // Специальные комбинированные селекторы 
  'div[role="log"] div', 'div[role="complementary"] div',
  // Ещё более универсальные селекторы для захвата
  'div[style*="position: absolute"][style*="bottom"]'
];

// Создаем переменную для отслеживания времени последней очистки субтитров
let lastCleanupTime = 0;

// Проверка, является ли текст элементом интерфейса
function isUIElement(text) {
  // Если текст пустой, это не субтитры
  if (!text || text.trim() === '') return true;
  
  // Нормализуем текст
  const normalizedText = text.toLowerCase();
  
  // Проверка на адрес электронной почты или веб-адрес
  if (normalizedText.includes('@') || 
      normalizedText.includes('.com') || 
      normalizedText.includes('.ru') || 
      normalizedText.includes('.net') ||
      normalizedText.includes('.org')) {
    return true;
  }
  
  // Короткие фразы с одним словом, вероятно, UI элементы
  const words = normalizedText.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1 && words[0].length < 15) {
    return true;
  }
  
  // Проверяем наличие ключевых слов интерфейса (независимо от регистра)
  for (const element of UI_ELEMENTS) {
    if (normalizedText.includes(element.toLowerCase())) {
      return true;
    }
  }
  
  // Проверяем наличие русского текста интерфейса
  if (
    normalizedText.includes('микрофон') || 
    normalizedText.includes('динамик') || 
    normalizedText.includes('камер') ||
    normalizedText.includes('презентац') ||
    normalizedText.includes('соединени') ||
    normalizedText.includes('присоед') ||
    normalizedText.includes('покинуть') ||
    normalizedText.includes('уведомлен') ||
    normalizedText.includes('войти') ||
    normalizedText.includes('выйти') ||
    normalizedText.includes('эффект') ||
    normalizedText.includes('запись') ||
    normalizedText.includes('запис') ||
    normalizedText.includes('звонок') ||
    normalizedText.includes('звук') ||
    normalizedText.includes('видео') ||
    normalizedText.includes('экран') ||
    normalizedText.includes('настройк') ||
    normalizedText.includes('делит') ||
    normalizedText.includes('показ')
  ) {
    return true;
  }
  
  // Проверяем наличие материальных иконок (текстовые названия иконок)
  if (
    normalizedText.includes('_') ||      // Как правило, иконки содержат подчеркивания
    /^[a-z_]+$/.test(normalizedText) ||  // Только буквы и подчеркивания
    normalizedText.length < 10 && !normalizedText.includes(' ') // Короткие строки без пробелов
  ) {
    return true;
  }
  
  // Проверяем на наличие большого количества специальных символов
  const specialCharsCount = (normalizedText.match(/[^a-zA-Zа-яА-Я0-9\s.,!?]/g) || []).length;
  if (specialCharsCount > 5 && specialCharsCount / normalizedText.length > 0.3) {
    return true;
  }
  
  return false;
}

// Проверка, является ли DOM-элемент контейнером субтитров
function isSubtitleContainer(element) {
  // Ничто не может быть контейнером субтитров
  if (!element || !element.classList) return false;
  
  // Проверяем атрибуты и классы, которые могут указывать на субтитры
  if (
    element.hasAttribute('data-message-text') ||
    element.hasAttribute('data-identifier') ||
    element.getAttribute('role') === 'log' ||
    element.getAttribute('role') === 'complementary'
  ) {
    return true;
  }
  
  // Проверяем классы
  for (const cls of SUBTITLE_CLASSES) {
    if (element.classList.contains(cls)) {
      return true;
    }
  }
  
  // Проверяем родительские элементы (до 3 уровней вверх)
  let parent = element.parentElement;
  let level = 0;
  while (parent && level < 3) {
    if (
      parent.hasAttribute('data-message-text') ||
      parent.hasAttribute('data-identifier') ||
      parent.getAttribute('role') === 'log' ||
      parent.getAttribute('role') === 'complementary'
    ) {
      return true;
    }
    
    // Проверяем классы родителей
    for (const cls of SUBTITLE_CLASSES) {
      if (parent.classList && parent.classList.contains(cls)) {
        return true;
      }
    }
    
    parent = parent.parentElement;
    level++;
  }
  
  return false;
}

// Является ли текст настоящими субтитрами
function isRealSubtitle(text) {
  // Настоящие субтитры обычно:
  // 1. Имеют разумную длину
  // 2. Не содержат типичных UI элементов
  // 3. Имеют нормальное распределение слов и пунктуации
  
  // Специальная проверка для явных субтитров - даже если они короткие,
  // но содержат характерные признаки речи, считаем их субтитрами
  const normalizedText = text.toLowerCase();
  const speechIndicators = [
    "hello", "hi", "hey", "yes", "no", "yeah", "okay", "ok", "thanks", "thank you",
    "привет", "да", "нет", "спасибо", "хорошо", "ладно", "пока"
  ];
  
  // Если это короткое слово-индикатор речи, принимаем его как субтитр
  for (const indicator of speechIndicators) {
    if (normalizedText === indicator || 
        normalizedText.startsWith(indicator + " ") || 
        normalizedText.endsWith(" " + indicator) ||
        normalizedText.includes(" " + indicator + " ")) {
      return true;
    }
  }
  
  // Сначала проверим, не является ли текст UI элементом
  if (isUIElement(text)) return false;
  
  // Слишком короткие тексты пропускаем (просто фрагменты слов)
  if (text.length < MIN_LENGTH) return false;
  
  // Слишком длинные тексты тоже подозрительны, но увеличиваем порог
  if (text.length > 500) return false;
  
  // Субтитры обычно не содержат HTML-тегов
  if (text.includes('<') && text.includes('>')) return false;
  
  // Смягчаем требование к минимальному количеству слов
  const words = text.split(/\s+/).filter(word => word.length > 0);
  if (words.length < 1) return false; // Субтитры должны содержать хотя бы 1 слово
  
  // Смягчаем проверку на соотношение букв к не-буквам
  const letters = text.match(/[a-zA-Zа-яА-Я0-9]/g) || []; // Добавляем цифры как допустимые символы
  const nonLetters = text.match(/[^a-zA-Zа-яА-Я0-9\s]/g) || [];
  if (letters.length === 0 || nonLetters.length / (letters.length + 1) > 0.8) { // Увеличиваем порог с 0.7 до 0.8
    return false;
  }
  
  return true;
}

/**
 * Рассчитывает расстояние Левенштейна между двумя строками
 * для определения их схожести
 */
function levenshteinDistance(s1, s2) {
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    const matrix = [];

    // Инициализация матрицы
    for (let i = 0; i <= s1.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= s2.length; j++) {
        matrix[0][j] = j;
    }

    // Заполнение матрицы
    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,       // удаление
                matrix[i][j - 1] + 1,       // вставка
                matrix[i - 1][j - 1] + cost // замена или совпадение
            );
        }
    }

    // Возвращаем значение расстояния
    return matrix[s1.length][s2.length];
}

/**
 * Определяет, являются ли два текста похожими
 * на основе порога схожести
 */
function isSimilarText(text1, text2) {
    if (!text1 || !text2) return false;
    
    // Если текст короткий, то используем более простое сравнение
    if (text1.length < 10 || text2.length < 10) {
        // Для коротких фраз сравниваем только буквы и цифры (игнорируем пунктуацию)
        const cleanText1 = text1.replace(/[^\w\s]/g, '').toLowerCase();
        const cleanText2 = text2.replace(/[^\w\s]/g, '').toLowerCase();
        return cleanText1 === cleanText2;
    }
    
    // Для длинного текста используем расстояние Левенштейна
    const maxLength = Math.max(text1.length, text2.length);
    if (maxLength === 0) return true;
    
    const distance = levenshteinDistance(text1.toLowerCase(), text2.toLowerCase());
    const similarity = 1 - distance / maxLength;
    
    return similarity >= SIMILARITY_THRESHOLD;
}

/**
 * Проверяет, похоже ли текст на речь
 * Текст считается речью, если в нем есть хотя бы два слова
 * или есть знаки препинания (кроме скобок и кавычек)
 */
function looksLikeSpeech(text) {
    if (!text) return false;
    
    // Проверка на наличие хотя бы двух слов
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    if (words.length >= 2) return true;
    
    // Проверка на наличие знаков препинания (кроме скобок и кавычек)
    const hasPunctuation = /[.,:;!?]/.test(text);
    return hasPunctuation;
}

/**
 * Очищает старые субтитры из истории, если они не нужны
 */
function clearOldSubtitles() {
    const now = Date.now();
    
    // Очищаем только раз в 5 секунд, чтобы не тратить ресурсы
    if (now - lastCleanupTime < 5000) return;
    
    lastCleanupTime = now;
    
    // Удаляем все субтитры старше DUPLICATE_WINDOW_MS
    const oldestValidTime = now - DUPLICATE_WINDOW_MS;
    recentSubtitles = recentSubtitles.filter(item => item.timestamp >= oldestValidTime);
    
    // Очищаем Set с уникальными текстами, если он слишком большой
    if (seenSubtitles.size > 1000) {
        seenSubtitles.clear();
    }
}

/**
 * Проверяет, является ли текст дубликатом или слишком похожим на недавние субтитры
 */
function isDuplicate(text, isExactCheck = false) {
    const now = Date.now();
    
    // Проверяем точное совпадение в истории
    for (const item of recentSubtitles) {
        // Для точных совпадений - более долгое окно
        if (item.text === text) {
            const timeDiff = now - item.timestamp;
            if (timeDiff < DUPLICATE_WINDOW_MS) {
                return true;
            }
        }
        
        // Для проверки на схожесть - меньшее окно
        if (!isExactCheck && isSimilarText(item.text, text)) {
            const timeDiff = now - item.timestamp;
            if (timeDiff < SIMILARITY_WINDOW_MS) {
                return true;
            }
        }
    }
    
    return false;
}

// Debug function that respects the message limit
function debug(message) {
  debugMessageCount++;
  if (debugMessageCount < MAX_DEBUG_MESSAGES) {
    originalConsoleLog(DEBUG_PREFIX + message);
  } else if (debugMessageCount === MAX_DEBUG_MESSAGES) {
    originalConsoleLog(`[DEBUG LIMIT] Лимит отладочных сообщений (${MAX_DEBUG_MESSAGES}) достигнут. Дальнейшие сообщения будут скрыты.`);
  }
}

function logWithDebug(message, debugMessage = null) {
  if (debugMessage) {
    debugMessageCount++;
    if (debugMessageCount < MAX_DEBUG_MESSAGES) {
      originalConsoleLog(DEBUG_PREFIX + debugMessage);
    } else if (debugMessageCount === MAX_DEBUG_MESSAGES) {
      originalConsoleLog(`[DEBUG LIMIT] Лимит отладочных сообщений (${MAX_DEBUG_MESSAGES}) достигнут. Дальнейшие сообщения будут скрыты.`);
    }
  }
  originalConsoleLog(message);
}

/**
 * Обработка текста субтитров
 */
function processSubtitleText(text, forceSimilar = false) {
    if (!text) return false;
    
    // Debug message for subtitle processing
    debugMessageCount++;
    if (debugMessageCount < MAX_DEBUG_MESSAGES) {
        debug(`Обработка субтитров: "${text}"`);
    }
    
    // Если уже идет обработка, выходим
    if (isProcessing) return;
    isProcessing = true;
    
    try {
        // Пропускаем пустые строки и слишком короткие тексты
        if (!text || text.length < MIN_LENGTH) {
            return;
        }
        
        // Очищаем старые субтитры периодически
        clearOldSubtitles();
        
        const now = Date.now();
        
        // Проверка на дубликат (точное совпадение)
        if (isDuplicate(text, true)) {
            // Пропускаем, но не логируем, чтобы уменьшить шум
            return;
        }
        
        // Если текст явно похож на речь, пропускаем проверку на схожесть
        const isSpeech = looksLikeSpeech(text);
        
        // Если текст не похож на речь, проверяем на схожесть
        if (!isSpeech && isDuplicate(text)) {
            return;
        }
        
        // Проверка минимального интервала между субтитрами
        if (now - lastSubtitleTime < MIN_LOG_INTERVAL) {
            return;
        }
        
        // Добавляем в историю
        recentSubtitles.push({
            text: text,
            timestamp: now
        });
        
        // Обновляем время последнего субтитра
        lastSubtitleTime = now;
        lastSubtitle = text;
        
        // Выводим субтитры
        console.log(SUBTITLE_PREFIX + text);
    } finally {
        // Сбрасываем флаг обработки
        isProcessing = false;
    }
}

// Разделяет текст на предложения по знакам окончания
function splitIntoSentences(text) {
  // Используем регулярное выражение для разделения по знакам окончания предложения
  const sentences = [];
  
  // Разбираем текст на части по знакам препинания
  const regex = /[.!?;]+/g;
  let match;
  let lastIndex = 0;
  
  // Находим все разделители предложений
  while ((match = regex.exec(text)) !== null) {
    const sentence = text.substring(lastIndex, match.index + match[0].length).trim();
    
    // Добавляем только если предложение не пустое
    if (sentence && sentence.length >= MIN_LENGTH) {
      sentences.push(sentence);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Добавляем последнюю часть текста, если она есть
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex).trim();
    if (remainingText && remainingText.length >= MIN_LENGTH) {
      sentences.push(remainingText);
    }
  }
  
  // Если после разделения нет предложений, возвращаем исходный текст
  return sentences.length > 0 ? sentences : [text];
}

// Функция очистки неактивных наблюдателей
function cleanupInactiveObservers() {
  originalConsoleLog(`Cleaning up observers: ${activeObservers.size} active observers`);
  
  // Вместо полной очистки, оставляем основного наблюдателя
  for (const observer of activeObservers) {
    if (observer !== mainObserver && typeof observer.disconnect === 'function') {
      observer.disconnect();
    }
  }
  
  // Создаем новый набор с основным наблюдателем, если он существует
  const newObservers = new Set();
  if (mainObserver) {
    newObservers.add(mainObserver);
  }
  activeObservers = newObservers;
  
  originalConsoleLog(`After cleanup: ${activeObservers.size} active observers`);
}

// Функция перезапуска наблюдателей
function restartObservers() {
  originalConsoleLog('Restarting subtitle observers');
  
  // Фиксируем флаг обработки, чтобы избежать блокировок
  isProcessing = false;
  
  // Останавливаем только дополнительные наблюдатели, сохраняя основной
  if (mainObserver && typeof mainObserver.disconnect === 'function') {
    // Отключаем временно основной наблюдатель
    mainObserver.disconnect();
  }
  
  // Снова запускаем основное наблюдение
  const stopFn = observeSubtitles();
  
  // Через некоторое время запускаем дополнительные методы сканирования
  setTimeout(findSubtitlesWithDeepScan, 2000);
  setTimeout(scanForSubtitles, 5000);
  
  originalConsoleLog('Observers restarted successfully');
}

// Очистка старых субтитров периодически
setInterval(() => {
  if (seenSubtitles.size > 30) {
    const recent = Array.from(seenSubtitles).slice(-20);
    seenSubtitles.clear();
    recent.forEach(sub => seenSubtitles.add(sub));
  }
  
  // Проверяем, не прекратилось ли обнаружение субтитров
  const now = Date.now();
  if (now - lastSubtitleTime > 30000) {
    originalConsoleLog('No subtitles detected for a while, restarting observers...');
    restartObservers();
    lastSubtitleTime = now; // Сбрасываем таймер, чтобы избежать слишком частых перезапусков
  }
}, 20000);

// Периодически перезапускаем наблюдателей, чтобы избежать проблем с отключением
setInterval(restartObservers, 15000);

// Function to observe subtitles
function observeSubtitles() {
  originalConsoleLog('Starting subtitle observation');
  
  // The main container where subtitles appear in Google Meet
  const targetNode = document.body;
  
  // Observer configuration
  const config = { 
    childList: true, 
    subtree: true, 
    characterData: true
  };
  
  // Callback to execute when mutations are observed
  const callback = function(mutationsList, observer) {
    // Prevent processing if we're already doing so to avoid race conditions
    if (isProcessing) return;
    isProcessing = true;
    
    try {
      // Join all selectors
      const combinedSelector = SUBTITLE_SELECTORS.join(', ');
      const subtitleElements = document.querySelectorAll(combinedSelector);
      
      // Если элементы не найдены, попробуем поискать по другим признакам
      if (subtitleElements.length === 0) {
        // Попытка найти субтитры по содержимому
        document.querySelectorAll('div, span').forEach(element => {
          // Проверяем только элементы, которые могут быть субтитрами
          if (element.childNodes.length <= 3 && element.textContent) {
            const text = element.textContent.trim();
            if (text.length > MIN_LENGTH && !isUIElement(text)) {
              processSubtitleText(text);
            }
          }
        });
      } else {
        if (debugMessageCount < MAX_DEBUG_MESSAGES) {
          limitedDebugLog(`Found ${subtitleElements.length} potential subtitle elements`);
        }
        
        // Обрабатываем найденные элементы субтитров
        let candidateTexts = [];
        
        subtitleElements.forEach(element => {
          const text = element.textContent || element.innerText || '';
          if (text && text.trim() !== '') {
            candidateTexts.push(text.trim());
          }
        });
        
        if (debugMessageCount < MAX_DEBUG_MESSAGES) {
          limitedDebugLog(`Found ${candidateTexts.length} candidate texts`);
        }
        
        // Обрабатываем все тексты, а не только самый длинный
        for (const text of candidateTexts) {
          if (isRealSubtitle(text)) {
            processSubtitleText(text);
          }
        }
      }
    } catch (error) {
      originalConsoleLog('Error processing subtitles:', error);
    } finally {
      // Обязательно сбрасываем флаг обработки
      isProcessing = false;
    }
  };
  
  // Create an observer instance linked to the callback function
  const observer = new MutationObserver(callback);
  
  // Start observing the target node for configured mutations
  observer.observe(targetNode, config);
  
  // Обновляем глобальную ссылку на основной наблюдатель
  mainObserver = observer;
  
  // Добавляем наблюдателя в набор активных
  if (!activeObservers.has(mainObserver)) {
    activeObservers.add(mainObserver);
  }
  
  originalConsoleLog('Subtitle observer started');
  
  // Backup check with reduced frequency
  const intervalID = setInterval(() => {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
      const combinedSelector = SUBTITLE_SELECTORS.join(', ');
      const subtitleElements = document.querySelectorAll(combinedSelector);
      
      if (subtitleElements.length > 0) {
        if (debugMessageCount < MAX_DEBUG_MESSAGES) {
          limitedDebugLog(`Interval check: Found ${subtitleElements.length} subtitle elements`);
        }
        
        let candidateTexts = [];
        
        subtitleElements.forEach(element => {
          const text = element.textContent || element.innerText || '';
          if (text && text.trim() !== '') {
            candidateTexts.push(text.trim());
          }
        });
        
        // Обрабатываем все тексты, а не только самый длинный
        for (const text of candidateTexts) {
          if (isRealSubtitle(text)) {
            processSubtitleText(text);
          }
        }
      }
    } catch (error) {
      originalConsoleLog('Error in interval check:', error);
    } finally {
      isProcessing = false;
    }
  }, 500);
  
  // Сохраняем ID интервала для возможной отмены
  return () => {
    clearInterval(intervalID);
  };
}

// Fallback function to try multiple methods of finding subtitles
function findSubtitlesWithDeepScan() {
  originalConsoleLog('Performing deep scan for subtitle elements');
  
  // Первая стратегия: найти ближайший к нижнему краю экрана элемент с текстом
  // Это наиболее вероятное положение субтитров
  const bottomPositionedElements = [];
  document.querySelectorAll('div, span, p').forEach(el => {
    const rect = el.getBoundingClientRect();
    // Интересуют только элементы в нижней части экрана
    if (rect.top > window.innerHeight * 0.7 && 
        rect.bottom < window.innerHeight && 
        rect.width > 100 &&
        el.textContent && 
        el.textContent.trim().length > MIN_LENGTH) {
      
      bottomPositionedElements.push({
        element: el,
        y: rect.bottom,  // Позиция от нижнего края экрана
        x: rect.left,    // Горизонтальная позиция
        width: rect.width,
        text: el.textContent.trim()
      });
    }
  });
  
  // Сортируем по расстоянию от нижнего края (ближайшие к низу первыми)
  bottomPositionedElements.sort((a, b) => b.y - a.y);
  
  // Если у нас есть элементы в нижней части экрана, обрабатываем самые нижние
  if (bottomPositionedElements.length > 0) {
    originalConsoleLog(`Found ${bottomPositionedElements.length} elements positioned at the bottom of the screen`);
    
    // Берем 5 самых нижних элементов
    const probableSubtitles = bottomPositionedElements.slice(0, 5);
    
    // Обрабатываем их как потенциальные субтитры
    for (const item of probableSubtitles) {
      // Проверяем текст на соответствие субтитрам
      if (!isUIElement(item.text)) {
        originalConsoleLog(`Found bottom-positioned element with text: "${item.text.substring(0, 30)}..."`);
        processSubtitleText(item.text);
        
        // Наблюдаем за этим элементом для обнаружения изменений
        const observer = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            if (mutation.type === 'characterData' || mutation.type === 'childList') {
              const newText = item.element.textContent.trim();
              if (newText && newText !== item.text) {
                processSubtitleText(newText);
              }
            }
          });
        });
        
        observer.observe(item.element, {
          characterData: true,
          childList: true,
          subtree: true
        });
        
        activeObservers.add(observer);
      }
    }
  }
  
  // Вторая стратегия: специально ищем элементы с "подозрительными" стилями
  // Google Meet обычно использует конкретные стили для субтитров
  document.querySelectorAll('div[style*="transform"], div[style*="absolute"]').forEach(el => {
    const style = window.getComputedStyle(el);
    const text = el.textContent.trim();
    
    // Проверяем стили на соответствие типичным стилям субтитров
    const isSubtitleStyled = (
      (style.position === 'absolute' && parseInt(style.bottom || '0') < 150) ||
      (style.transform && style.transform.includes('translate')) ||
      (el.className && SUBTITLE_CLASSES.some(cls => el.className.includes(cls)))
    );
    
    if (isSubtitleStyled && text && text.length > MIN_LENGTH && !isUIElement(text)) {
      originalConsoleLog(`Found element with subtitle-like styling: "${text.substring(0, 30)}..."`);
      processSubtitleText(text);
      
      // Наблюдаем за изменениями
      const styleObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          const newText = el.textContent.trim();
          if (newText && newText !== text && newText.length > MIN_LENGTH) {
            processSubtitleText(newText);
          }
        });
      });
      
      styleObserver.observe(el, {
        characterData: true,
        childList: true,
        subtree: true
      });
      
      activeObservers.add(styleObserver);
    }
  });

  // Третья стратегия: Google Meet иногда использует data-атрибуты для субтитров
  document.querySelectorAll('[data-message-text], [data-spotlight-subtitle],' + 
                           '[data-original-text], [data-text-content],' +
                           '[data-caption-text], [data-subtitle]').forEach(el => {
    const text = el.textContent.trim() || 
                 el.getAttribute('data-message-text') || 
                 el.getAttribute('data-original-text') || 
                 el.getAttribute('data-text-content') ||
                 el.getAttribute('data-caption-text') ||
                 el.getAttribute('data-subtitle') ||
                 el.getAttribute('data-spotlight-subtitle');
    
    if (text && text.length > MIN_LENGTH && !isUIElement(text)) {
      originalConsoleLog(`Found element with subtitle data attribute: "${text.substring(0, 30)}..."`);
      processSubtitleText(text);
      
      // Наблюдаем за атрибутами и содержимым
      const attrObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName.startsWith('data-') || 
               mutation.attributeName === 'textContent')) {
            const newText = el.textContent.trim() || 
                           el.getAttribute('data-message-text') || 
                           el.getAttribute('data-original-text') ||
                           el.getAttribute('data-text-content') ||
                           el.getAttribute('data-caption-text') ||
                           el.getAttribute('data-subtitle') ||
                           el.getAttribute('data-spotlight-subtitle');
            if (newText && newText !== text && newText.length > MIN_LENGTH) {
              processSubtitleText(newText);
            }
          } else if (mutation.type === 'characterData' || mutation.type === 'childList') {
            const newText = el.textContent.trim();
            if (newText && newText !== text && newText.length > MIN_LENGTH) {
              processSubtitleText(newText);
            }
          }
        });
      });
      
      attrObserver.observe(el, {
        attributes: true,
        attributeFilter: ['data-message-text', 'data-original-text', 'data-text-content',
                          'data-caption-text', 'data-subtitle', 'data-spotlight-subtitle'],
        characterData: true,
        childList: true,
        subtree: true
      });
      
      activeObservers.add(attrObserver);
    }
  });
  
  // Продолжаем исходный анализ для других элементов
  const textElements = Array.from(document.querySelectorAll('div, span, p'))
    .filter(el => {
      const text = el.textContent?.trim();
      return text && text.length > MIN_LENGTH && text.length < 300;
    });
  
  originalConsoleLog(`Deep scan found ${textElements.length} potential text elements`);
  
  // Examine each element for subtitle-like characteristics
  for (const el of textElements) {
    const text = el.textContent.trim();
    
    // Skip obvious UI elements
    if (isUIElement(text)) continue;
    
    // Check for subtitle characteristics
    if (text.split(' ').length >= 3 && // Has multiple words
        /[a-zA-Zа-яА-Я]{3,}/.test(text) && // Has words with letters
        el.children.length <= 2) { // Not complex nested content
      
      // Analyze position - subtitles often at the bottom of the screen
      const rect = el.getBoundingClientRect();
      const isNearBottom = (window.innerHeight - rect.bottom) < 200;
      const isCentered = Math.abs(rect.left - (window.innerWidth / 2 - rect.width / 2)) < 200;
      
      // Process if it looks like a subtitle or observe if we're not sure
      if (isRealSubtitle(text) || (isNearBottom && isCentered)) {
        processSubtitleText(text);
        
        // Observe this element for changes
        const elementObserver = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            if (mutation.type === 'characterData' || mutation.type === 'childList') {
              const newText = el.textContent.trim();
              if (newText.length >= MIN_LENGTH && !isUIElement(newText)) {
                processSubtitleText(newText);
              }
            }
          });
        });
        
        elementObserver.observe(el, {
          characterData: true,
          childList: true,
          subtree: true
        });
        
        // Add to active observers
        activeObservers.add(elementObserver);
      }
    }
  }
  
  // Force periodic re-scan to catch changes
  setTimeout(findSubtitlesWithDeepScan, 15000);
}

// Агрессивное сканирование всех элементов на странице для обнаружения субтитров
function scanForSubtitles() {
  // Сканируем все div элементы на странице, которые могут содержать текст
  const allElements = document.querySelectorAll('div, span, p');
  originalConsoleLog(`Scanning ${allElements.length} elements for subtitles...`);
  
  let foundSubtitles = false;
  let observerCount = 0;
  
  allElements.forEach(el => {
    // Пропускаем элементы без текста или слишком маленькие/большие
    if (!el.textContent || 
        el.textContent.trim().length < MIN_LENGTH || 
        el.textContent.trim().length > 200) {
      return;
    }
    
    // Проверяем, содержит ли элемент потенциальный текст субтитров
    const text = el.textContent.trim();
    
    // Базовая проверка: не является ли текст UI элементом
    if (!isUIElement(text)) {
      // Проверяем текст на соответствие паттернам субтитров
      if (text.split(' ').length >= 2 && // минимум 2 слова
          /[a-zA-Zа-яА-Я]{3,}/.test(text)) { // минимум 3 буквы в слове
        
        // Ограничиваем количество наблюдателей
        if (observerCount > 100) return;
        
        // Если это похоже на субтитры, наблюдаем за изменениями
        const observer = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            if (mutation.type === 'characterData' || mutation.type === 'childList') {
              const newText = el.textContent.trim();
              if (newText.length >= MIN_LENGTH && !isUIElement(newText)) {
                processSubtitleText(newText);
              }
            }
          });
        });
        
        observerCount++;
        
        // Начинаем наблюдение
        observer.observe(el, {
          characterData: true,
          childList: true, 
          subtree: true
        });
        
        // Добавляем наблюдатель в набор активных
        activeObservers.add(observer);
        
        // Если элемент уже содержит текст, сразу обрабатываем его
        if (isRealSubtitle(text)) {
          processSubtitleText(text);
          foundSubtitles = true;
        }
      }
    }
  });
  
  originalConsoleLog(`Aggressive scan complete. Found subtitles: ${foundSubtitles}, observers: ${observerCount}`);
  
  // Проверяем, не создаем ли мы слишком много наблюдателей
  if (activeObservers.size > 300) {
    originalConsoleLog('Too many observers, cleaning up...');
    cleanupInactiveObservers();
    setTimeout(scanForSubtitles, 1000); // Сразу пересканируем после очистки
  } else {
    // Повторяем сканирование через 20 секунд
    setTimeout(scanForSubtitles, 20000);
  }
}

// Новая функция для захвата субтитров с видео элемента
function captureSubtitlesFromVideoElement() {
  // В Google Meet субтитры могут быть в виде TextTrack на видео элементе
  const videoElements = document.querySelectorAll('video');
  
  videoElements.forEach(video => {
    // Если видео элемент имеет текстовые дорожки
    if (video.textTracks && video.textTracks.length > 0) {
      originalConsoleLog(`Found video element with ${video.textTracks.length} text tracks`);
      
      // Для каждой текстовой дорожки
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        
        // Активируем дорожку
        track.mode = 'showing';
        
        // Слушатель для новых реплик
        track.addEventListener('cuechange', () => {
          if (track.activeCues && track.activeCues.length > 0) {
            for (let j = 0; j < track.activeCues.length; j++) {
              const cue = track.activeCues[j];
              if (cue.text && cue.text.trim()) {
                processSubtitleText(cue.text.trim());
              }
            }
          }
        });
        
        originalConsoleLog(`Activated text track: ${track.label || 'Unnamed track'}`);
      }
    }
  });
  
  // Также проверяем iframe, которые могут содержать видео
  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      // Пытаемся получить доступ к содержимому iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const iframeVideos = iframeDoc.querySelectorAll('video');
      
      if (iframeVideos.length > 0) {
        originalConsoleLog(`Found ${iframeVideos.length} video elements in iframe`);
        
        iframeVideos.forEach(video => {
          if (video.textTracks && video.textTracks.length > 0) {
            for (let i = 0; i < video.textTracks.length; i++) {
              const track = video.textTracks[i];
              track.mode = 'showing';
              
              track.addEventListener('cuechange', () => {
                if (track.activeCues && track.activeCues.length > 0) {
                  for (let j = 0; j < track.activeCues.length; j++) {
                    const cue = track.activeCues[j];
                    if (cue.text && cue.text.trim()) {
                      processSubtitleText(cue.text.trim());
                    }
                  }
                }
              });
            }
          }
        });
      }
    } catch (e) {
      // Игнорируем ошибки доступа к кросс-доменным iframe
    }
  });
}

// Функция для прямого захвата субтитров Google Meet
function directCaptureSubtitles() {
  originalConsoleLog('Attempting direct capture of Google Meet subtitles');
  
  // Приоритетные селекторы для главного контейнера субтитров внизу экрана
  // Эти селекторы нацелены на самые распространенные элементы субтитров
  const priorityContainers = [
    // Главные контейнеры субтитров (последние версии)
    '.a4cQT', '.VbkSUe', '.CNusmb', '.Pdb3Mc', 
    '[jsname="tgaKEf"]', '[data-allow-page-navigation="true"]',
    '.r91Hhe'
  ];
  
  // Сначала ищем по приоритетным селекторам
  for (const selector of priorityContainers) {
    const containers = document.querySelectorAll(selector);
    
    if (containers.length > 0) {
      originalConsoleLog(`Found ${containers.length} primary subtitle containers with selector ${selector}`);
      
      // Для каждого найденного контейнера
      containers.forEach(container => {
        // Обрабатываем текущий текст
        const text = container.textContent?.trim();
        if (text && text.length > MIN_LENGTH) {
          // Форсируем вывод текста как субтитра, пропуская большинство проверок
          originalConsoleLog(SUBTITLE_PREFIX + text);
          
          // Обновляем время последнего субтитра
          lastSubtitleTime = Date.now();
          lastSubtitle = text;
          seenSubtitles.add(text);
          
          // Создаем специальный наблюдатель с высоким приоритетом
          const priorityObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.type === 'characterData' || mutation.type === 'childList') {
                const newText = container.textContent?.trim();
                
                // Проверяем, изменился ли текст и не пустой ли он
                if (newText && newText !== text && newText.length > MIN_LENGTH) {
                  // Прямой вывод в консоль, минуя проверки на дубликаты
                  // для важнейших контейнеров субтитров
                  originalConsoleLog(SUBTITLE_PREFIX + newText);
                  lastSubtitleTime = Date.now();
                  lastSubtitle = newText;
                  seenSubtitles.add(newText);
                }
              }
            }
          });
          
          // Наблюдаем за всеми изменениями в контейнере
          priorityObserver.observe(container, {
            characterData: true,
            childList: true,
            subtree: true
          });
          
          // Добавляем в активные наблюдатели
          activeObservers.add(priorityObserver);
        }
      });
    }
  }
  
  // Прямая селекция известных контейнеров субтитров Google Meet
  const knownContainers = [
    // Основной контейнер субтитров (нижний)
    'div[jscontroller="IlfM5e"]',
    // Контейнер нижних субтитров
    'div[data-allow-page-navigation="true"]',
    // Другие известные контейнеры субтитров
    '.Pdb3Mc', '.a4cQT', '.VbkSUe', '.CNusmb',
    // Элемент с текстом субтитров
    '[jsname="tgaKEf"]', '[data-message-text]',
    // Новые контейнеры субтитров (2023+)
    'div[jscontroller="gJT9L"]', 'div[jscontroller="mgUFIb"]',
    // Элементы для субтитров с известными ролями
    'div[role="log"]', 'div[role="region"][aria-live="polite"]'
  ];
  
  // Поиск контейнеров по всем известным селекторам
  for (const selector of knownContainers) {
    // Пропускаем селекторы, которые уже обработаны в приоритетных
    if (priorityContainers.includes(selector)) continue;
    
    const containers = document.querySelectorAll(selector);
    
    if (containers.length > 0) {
      limitedDebugLog(`Found ${containers.length} direct subtitle containers with selector ${selector}`);
      
      // Обрабатываем каждый найденный контейнер
      containers.forEach(container => {
        // Проверяем текст контейнера
        const text = container.textContent?.trim();
        if (text && text.length > MIN_LENGTH && !isUIElement(text)) {
          processSubtitleText(text);
        }
        
        // Создаем специальный мощный наблюдатель для прямого захвата
        const directObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            // Проверяем, если это изменение текста или дочерних элементов
            if (mutation.type === 'characterData' || mutation.type === 'childList') {
              const currentText = container.textContent?.trim();
              if (currentText && currentText.length > MIN_LENGTH && !isUIElement(currentText)) {
                // Прямая обработка текста субтитров
                processSubtitleText(currentText);
                
                // Обновляем метку времени последнего субтитра
                lastSubtitleTime = Date.now();
              }
            }
          }
        });
        
        // Начинаем наблюдение за контейнером и всеми его дочерними элементами
        directObserver.observe(container, {
          characterData: true,
          childList: true,
          subtree: true,
          attributes: true
        });
        
        // Добавляем наблюдатель в набор активных
        activeObservers.add(directObserver);
      });
    }
  }
  
  // Также ищем элементы, которые могут содержать субтитры по их положению
  // Google Meet обычно размещает субтитры внизу экрана
  const possibleContainers = document.querySelectorAll('div:not([data-is-scanned])');
  let scannedCount = 0;
  
  possibleContainers.forEach(element => {
    // Ограничиваем количество проверяемых элементов для производительности
    if (scannedCount > 100) return;
    
    // Отмечаем элемент как проверенный
    element.dataset.isScanned = 'true';
    scannedCount++;
    
    const rect = element.getBoundingClientRect();
    
    // Если элемент находится в нижней части экрана и достаточно широкий
    if (rect.bottom > window.innerHeight * 0.6 &&
        rect.width > window.innerWidth * 0.3 &&
        rect.height < 100) { // Субтитры обычно не очень высокие
      
      const text = element.textContent?.trim();
      if (text && text.length > MIN_LENGTH && !isUIElement(text)) {
        // Проверка на наличие признаков речи
        const speechLike = text.split(/[.!?]/g).length > 1 || // Несколько предложений
                           /[a-zA-Zа-яА-Я]{3,}/.test(text);   // Содержит слова
        
        if (speechLike) {
          // Это похоже на речь - прямой вывод
          originalConsoleLog(SUBTITLE_PREFIX + text);
          lastSubtitleTime = Date.now();
          seenSubtitles.add(text);
        } else {
          processSubtitleText(text);
        }
        
        // Наблюдаем за изменениями в этом элементе
        const positionObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'characterData' || mutation.type === 'childList') {
              const newText = element.textContent?.trim();
              if (newText && newText.length > MIN_LENGTH && !isUIElement(newText)) {
                processSubtitleText(newText);
              }
            }
          }
        });
        
        positionObserver.observe(element, {
          characterData: true,
          childList: true,
          subtree: true
        });
        
        activeObservers.add(positionObserver);
      }
    }
  });
  
  // Запускаем повторную попытку прямого захвата через некоторое время
  // Google Meet может динамически создавать элементы субтитров
  setTimeout(directCaptureSubtitles, 20000);
}

// Находит любые визуальные признаки субтитров на странице
function findVisualSubtitleIndicators() {
  // Проверяем, включены ли субтитры на странице
  const captionIndicators = document.querySelectorAll('[aria-pressed="true"], [data-is-muted="false"]');
  let captionsEnabled = false;
  
  captionIndicators.forEach(indicator => {
    // Проверяем, связан ли этот индикатор с субтитрами/подписями
    const ariaLabel = indicator.getAttribute('aria-label') || '';
    const text = indicator.textContent || '';
    
    if (ariaLabel.toLowerCase().includes('caption') || 
        ariaLabel.toLowerCase().includes('subtitle') ||
        ariaLabel.toLowerCase().includes('подпис') ||
        text.toLowerCase().includes('cc') ||
        text.toLowerCase().includes('caption')) {
      captionsEnabled = true;
    }
  });
  
  // Если субтитры включены, но мы не видим их, попробуем найти кнопку для их включения
  if (!captionsEnabled) {
    const captionButtons = document.querySelectorAll('button, div[role="button"]');
    
    captionButtons.forEach(button => {
      const ariaLabel = button.getAttribute('aria-label') || '';
      const text = button.textContent || '';
      
      if (ariaLabel.toLowerCase().includes('caption') || 
          ariaLabel.toLowerCase().includes('subtitle') ||
          ariaLabel.toLowerCase().includes('подпис') ||
          text.toLowerCase().includes('cc') ||
          text.toLowerCase().includes('caption')) {
        // Нашли кнопку субтитров - можно было бы кликнуть, но мы не делаем этого автоматически
        originalConsoleLog('Found caption toggle button, but not clicking it automatically');
      }
    });
  }
}

// Функция для поиска текстового содержимого, похожего на речь
function findSpeechLikeText() {
  const textElements = document.querySelectorAll('div, span, p');
  const speechIndicators = [
    "hello", "hi", "hey", "yes", "no", "yeah", "okay", "ok", "thanks", "thank you",
    "привет", "да", "нет", "спасибо", "хорошо", "ладно", "пока"
  ];
  
  textElements.forEach(element => {
    const text = element.textContent?.trim();
    if (!text || text.length < 2) return;
    
    const lowerText = text.toLowerCase();
    
    // Проверяем на наличие индикаторов речи
    for (const indicator of speechIndicators) {
      if (lowerText === indicator || 
          lowerText.startsWith(indicator + " ") || 
          lowerText.endsWith(" " + indicator) ||
          lowerText.includes(" " + indicator + " ")) {
        
        // Это похоже на речь, выводим напрямую
        originalConsoleLog(SUBTITLE_PREFIX + text);
        lastSubtitleTime = Date.now();
        seenSubtitles.add(text);
        
        // Наблюдаем за элементом
        const speechObserver = new MutationObserver(() => {
          const newText = element.textContent?.trim();
          if (newText && newText !== text && newText.length > 2) {
            originalConsoleLog(SUBTITLE_PREFIX + newText);
            lastSubtitleTime = Date.now();
            seenSubtitles.add(newText);
          }
        });
        
        speechObserver.observe(element, {
          characterData: true,
          childList: true,
          subtree: true
        });
        
        activeObservers.add(speechObserver);
        break;
      }
    }
  });
}

// Функция форсированного восстановления субтитров
function forceSubtitleRecovery() {
  // Ограничиваем отладочное сообщение, чтобы уменьшить вывод в консоль
  if (debugMessageCount < MAX_DEBUG_MESSAGES) {
    limitedDebugLog('Performing forced subtitle recovery');
  }
  
  // Проверяем, сколько времени прошло с момента последнего обнаруженного субтитра
  const now = Date.now();
  const timeSinceLastSubtitle = now - lastSubtitleTime;
  
  if (timeSinceLastSubtitle > 10000) { // Если более 10 секунд нет субтитров
    originalConsoleLog(`No subtitles for ${timeSinceLastSubtitle}ms, forcing recovery`);
    
    // 1. Очищаем список ранее виденных субтитров
    seenSubtitles.clear();
    
    // 2. Перезапускаем все наблюдатели
    restartObservers();
    
    // 3. Запускаем прямой захват субтитров
    directCaptureSubtitles();
    
    // 4. Ищем визуальные индикаторы субтитров
    findVisualSubtitleIndicators();
    
    // 5. Ищем текст, похожий на речь
    findSpeechLikeText();
    
    // 6. Сканируем весь DOM заново
    findSubtitlesWithDeepScan();
    captureSubtitlesFromVideoElement();
    
    // 7. Обновляем время последнего субтитра, чтобы избежать слишком частых восстановлений
    lastSubtitleTime = now;
  }
}

// Запускаем периодическую проверку и восстановление субтитров
setInterval(forceSubtitleRecovery, 15000);

// Function to detect when Google Meet is fully loaded
function detectGoogleMeet() {
  // Method 1: Check for specific Google Meet elements
  const meetElements = [
    '.c8mVDd',  // Meeting bottom bar
    '.crqnQb',  // Meeting container
    '.rG0ybd',  // Main meeting layout
    '.NzPR9b',  // Video grid
    '.GvcWrd',  // Participants panel
    // Добавляем новые элементы для последнего интерфейса
    '.juFBgc',  // Новый главный контейнер
    '.XnKlKd',  // Новый контейнер участников
    '.NGp9le',  // Новая панель управления
    '.Tmb7Fd'   // Новый контейнер видео
  ];
  
  // Check if any Meet elements exist
  const meetLoaded = meetElements.some(selector => document.querySelector(selector));
  
  if (meetLoaded) {
    originalConsoleLog('Google Meet interface detected');
    observeSubtitles();
    
    // Запускаем различные методы захвата субтитров с небольшой задержкой
    setTimeout(directCaptureSubtitles, 1000); // Первым делом - прямой захват
    setTimeout(findSpeechLikeText, 1500);     // Поиск речеподобного текста
    setTimeout(findSubtitlesWithDeepScan, 2000); // Затем глубокое сканирование
    setTimeout(captureSubtitlesFromVideoElement, 3000); // Затем захват с видео
    
    // Запускаем агрессивный поиск после инициализации
    setTimeout(() => {
      scanForSubtitles();
    }, 5000);
    
    return true;
  }
  
  return false;
}

// Initial check on page load
window.addEventListener('load', () => {
  originalConsoleLog('Page loaded, waiting for Google Meet interface...');
  
  // Immediately start the observers instead of waiting for detection
  observeSubtitles();
  
  // Try to detect Google Meet interface
  if (!detectGoogleMeet()) {
    // If not detected, set up periodic checks for Google Meet interface
    const detectInterval = setInterval(() => {
      if (detectGoogleMeet()) {
        clearInterval(detectInterval);
      }
    }, 1000);
    
    // Even if we don't detect Google Meet, still try scanning for subtitles
    setTimeout(directCaptureSubtitles, 3000); // Добавляем прямой захват
    setTimeout(findSubtitlesWithDeepScan, 5000);
    setTimeout(scanForSubtitles, 10000);
    
    // Safety timeout to clear interval after 60 seconds
    setTimeout(() => {
      clearInterval(detectInterval);
      originalConsoleLog('Timed out waiting for Google Meet interface.');
      
      // Start regular restart timer and recovery
      setTimeout(() => {
        originalConsoleLog('Starting regular restart timer');
        setInterval(restartObservers, 15000);
        setInterval(forceSubtitleRecovery, 15000);
      }, 5000);
    }, 60000);
  }
});

// Setup a mutation observer to detect when Google Meet loads
const bodyObserver = new MutationObserver((mutations) => {
  if (detectGoogleMeet()) {
    bodyObserver.disconnect();
  }
});

bodyObserver.observe(document.body, { childList: true, subtree: true }); 