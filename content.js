// Google Meet Subtitles Logger
// This script monitors Google Meet subtitle elements and logs them to the console

console.log('Google Meet Subtitles Logger started');

// Track previously seen subtitles to avoid duplicates
const seenSubtitles = new Set();
let lastSubtitle = '';
let lastLogTime = 0;
let currentBuffer = '';
let bufferTimer = null;
let isProcessingSubtitles = false;

// Constants for subtitle processing
const MIN_LENGTH = 10;                // Минимальная длина для вывода 
const BUFFER_DELAY = 2000;            // Задержка буфера (2 секунды)
const MIN_LOG_INTERVAL = 1500;        // Минимальный интервал логирования (1.5 сек)
const SENTENCE_ENDS = ['.', '!', '?', ';']; // Окончания предложений

// UI элементы, которые не должны распознаваться как субтитры
const UI_ELEMENTS = [
  'arrow_downward', 'Jump to bottom', 'More options', 'more_vert', 'Present', 'present_to_all',
  'Microphone', 'Camera', 'Join now', 'Leave call', 'Turn on', 'Turn off',
  'mic_', 'videocam', 'settings', 'people', 'chat', 'present_', 'inventory',
  'volume_up', 'check', 'expand_more', 'notifications', 'Ready to join?',
  'Test speakers', 'Use Companion mode', 'Cast this meeting', 'Make a test recording',
  'Cast', 'Other ways', 'Choose activity', 'speaker_', 'Join', 'Leave',
  'Now', 'have joined', 'allowed to', 'hand is', 'camera is', 'microphone is', 
  'desktop notifi', 'is here', 'participants', 'no one'
];

// Проверка, является ли текст элементом интерфейса
function isUIElement(text) {
  // Если текст пустой, это не субтитры
  if (!text || text.trim() === '') return true;
  
  // Нормализуем текст
  const normalizedText = text.toLowerCase();
  
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
    normalizedText.includes('выйти')
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
  
  // Сначала проверим, не является ли текст UI элементом
  if (isUIElement(text)) return false;
  
  // Слишком короткие тексты пропускаем (просто фрагменты слов)
  if (text.length < MIN_LENGTH) return false;
  
  // Субтитры обычно не содержат HTML-тегов
  if (text.includes('<') && text.includes('>')) return false;
  
  // Проверка на наличие предложений: характерная структура с пробелами между словами
  const words = text.split(/\s+/).filter(word => word.length > 0);
  if (words.length < 2) return false; // Субтитры обычно содержат хотя бы 2 слова
  
  // Проверка на рациональное соотношение букв к не-буквам
  const letters = text.match(/[a-zA-Zа-яА-Я]/g) || [];
  const nonLetters = text.match(/[^a-zA-Zа-яА-Я\s]/g) || [];
  if (letters.length === 0 || nonLetters.length / letters.length > 0.5) {
    return false;
  }
  
  // Если текст очень длинный и не содержит знаков пунктуации, вероятно это не субтитры
  if (text.length > 100 && !(/[.!?,;:]/).test(text)) {
    return false;
  }
  
  return true;
}

// Классы элементов, которые могут содержать субтитры
const SUBTITLE_CLASSES = [
  'CNusmb', 'VbkSUe', 'a4cQT', 'iOzk7', 'TBMuR', 'zTETae', 
  'Mz6pEf', 'n2NWs', 'KvPUJb', 'iTTPOb', 'vdk1ce'
];

// Process subtitle text
function processSubtitleText(text) {
  if (!text || text.trim() === '') return;
  
  // Очищаем ненужные префиксы
  let cleanText = text;
  if (cleanText.startsWith('You')) {
    cleanText = cleanText.substring(3).trim();
  }
  
  // Проверяем, реальные ли это субтитры
  if (!isRealSubtitle(cleanText)) return;
  
  // Разделяем текст на предложения
  const sentences = splitIntoSentences(cleanText);
  
  const now = Date.now();
  
  // Обрабатываем каждое предложение отдельно
  for (const sentence of sentences) {
    // Если предложение слишком короткое или уже выводилось - пропускаем
    if (sentence.length < MIN_LENGTH || seenSubtitles.has(sentence)) continue;
    
    console.log('📝 Subtitles:', sentence);
    seenSubtitles.add(sentence);
    lastSubtitle = sentence;
    lastLogTime = now;
  }
  
  // Сбрасываем буфер
  currentBuffer = '';
  if (bufferTimer) {
    clearTimeout(bufferTimer);
    bufferTimer = null;
  }
}

// Разделяет текст на предложения
function splitIntoSentences(text) {
  // Используем регулярное выражение для разделения по знакам окончания предложения,
  // но сохраняем сами знаки в результате
  const sentencesArray = [];
  const sentencesRaw = text.split(/([.!?;]+)/);
  
  // Собираем предложения с их знаками пунктуации
  for (let i = 0; i < sentencesRaw.length - 1; i += 2) {
    const sentenceText = sentencesRaw[i].trim();
    const punctuation = sentencesRaw[i+1] || '';
    
    if (sentenceText) {
      sentencesArray.push(sentenceText + punctuation);
    }
  }
  
  // Если после разделения нет предложений, возвращаем исходный текст как одно предложение
  return sentencesArray.length > 0 ? sentencesArray : [text];
}

// Очистка старых субтитров периодически
setInterval(() => {
  if (seenSubtitles.size > 15) {
    const recent = Array.from(seenSubtitles).slice(-10);
    seenSubtitles.clear();
    recent.forEach(sub => seenSubtitles.add(sub));
  }
}, 60000);

// Function to observe subtitles
function observeSubtitles() {
  console.log('Starting subtitle observation');
  
  // The main container where subtitles appear in Google Meet
  const targetNode = document.body;
  
  // Observer configuration
  const config = { 
    childList: true, 
    subtree: true, 
    characterData: true
  };
  
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
    '[role="log"]'
  ];
  
  // Callback to execute when mutations are observed
  const callback = function(mutationsList, observer) {
    // Prevent processing if we're already doing so to avoid race conditions
    if (isProcessingSubtitles) return;
    isProcessingSubtitles = true;
    
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
        // Обрабатываем найденные элементы субтитров
        let candidateTexts = [];
        
        subtitleElements.forEach(element => {
          const text = element.textContent || element.innerText || '';
          if (text && text.trim() !== '') {
            candidateTexts.push(text.trim());
          }
        });
        
        // Сортируем по длине - обычно самый длинный текст это полная фраза
        candidateTexts.sort((a, b) => b.length - a.length);
        
        // Обрабатываем только самый длинный текст, который является настоящим субтитром
        for (const text of candidateTexts) {
          if (isRealSubtitle(text)) {
            processSubtitleText(text);
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error processing subtitles:', error);
    } finally {
      isProcessingSubtitles = false;
    }
  };
  
  // Create an observer instance linked to the callback function
  const observer = new MutationObserver(callback);
  
  // Start observing the target node for configured mutations
  observer.observe(targetNode, config);
  
  console.log('Subtitle observer started');
  
  // Backup check with reduced frequency (every 1.5 seconds)
  setInterval(() => {
    if (isProcessingSubtitles) return;
    isProcessingSubtitles = true;
    
    try {
      const combinedSelector = SUBTITLE_SELECTORS.join(', ');
      const subtitleElements = document.querySelectorAll(combinedSelector);
      
      if (subtitleElements.length > 0) {
        let candidateTexts = [];
        
        subtitleElements.forEach(element => {
          const text = element.textContent || element.innerText || '';
          if (text && text.trim() !== '') {
            candidateTexts.push(text.trim());
          }
        });
        
        // Сортируем по длине
        candidateTexts.sort((a, b) => b.length - a.length);
        
        // Обрабатываем только самый длинный текст, который является настоящим субтитром
        for (const text of candidateTexts) {
          if (isRealSubtitle(text)) {
            processSubtitleText(text);
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error in interval check:', error);
    } finally {
      isProcessingSubtitles = false;
    }
  }, 1500);
}

// Fallback function to try multiple methods of finding subtitles
function findSubtitlesWithDeepScan() {
  console.log('Performing deep scan for subtitle elements');
  
  // Look for elements with specific text patterns that might be subtitles
  document.querySelectorAll('div, span, p').forEach(el => {
    // Только элементы, которые могут быть субтитрами:
    // - Минимум дочерних элементов
    // - Имеют некоторый текст
    // - Текст не слишком длинный и не слишком короткий
    if (el.childNodes.length <= 3 && el.textContent && 
        el.textContent.trim().length > MIN_LENGTH && 
        el.textContent.trim().length < 200) {
      
      // Игнорируем элементы интерфейса
      if (isUIElement(el.textContent)) return;
      
      // Check if this element changes frequently
      const elId = el.id || Math.random().toString(36).substring(7);
      el.dataset.subtitleScan = elId;
      
      // Watch this element for changes
      const elementObserver = new MutationObserver((mutations) => {
        if (isProcessingSubtitles) return;
        isProcessingSubtitles = true;
        
        try {
          let hasTextChanged = false;
          
          mutations.forEach(mutation => {
            if (mutation.type === 'characterData' || mutation.type === 'childList') {
              hasTextChanged = true;
            }
          });
          
          if (hasTextChanged) {
            const text = el.textContent || el.innerText;
            if (text && text.trim() !== '' && isRealSubtitle(text)) {
              processSubtitleText(text);
            }
          }
        } catch (error) {
          console.error('Error in deep scan observer:', error);
        } finally {
          isProcessingSubtitles = false;
        }
      });
      
      elementObserver.observe(el, {
        characterData: true,
        childList: true,
        subtree: true
      });
    }
  });
  
  // Дополнительная проверка: отслеживание создания новых элементов на странице,
  // которые могут быть контейнерами субтитров
  const bodyObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Проверяем, не является ли это контейнером субтитров
            SUBTITLE_SELECTORS.forEach(selector => {
              try {
                if (node.matches && node.matches(selector) || 
                    node.querySelector && node.querySelector(selector)) {
                  const text = node.textContent || node.innerText;
                  if (text && text.trim() !== '' && isRealSubtitle(text)) {
                    processSubtitleText(text);
                  }
                }
              } catch (error) {
                // Игнорируем ошибки в селекторах
              }
            });
          }
        });
      }
    });
  });
  
  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Function to detect when Google Meet is fully loaded
function detectGoogleMeet() {
  // Method 1: Check for specific Google Meet elements
  const meetElements = [
    '.c8mVDd',  // Meeting bottom bar
    '.crqnQb',  // Meeting container
    '.rG0ybd',  // Main meeting layout
    '.NzPR9b',  // Video grid
    '.GvcWrd'   // Participants panel
  ];
  
  // Check if any Meet elements exist
  const meetLoaded = meetElements.some(selector => document.querySelector(selector));
  
  if (meetLoaded) {
    console.log('Google Meet interface detected');
    observeSubtitles();
    setTimeout(findSubtitlesWithDeepScan, 5000); // Try deep scan after 5 seconds
    return true;
  }
  
  return false;
}

// Initial check on page load
window.addEventListener('load', () => {
  console.log('Page loaded, waiting for Google Meet interface...');
  
  // Try to detect Google Meet interface immediately
  if (!detectGoogleMeet()) {
    // If not detected, set up periodic checks
    const detectInterval = setInterval(() => {
      if (detectGoogleMeet()) {
        clearInterval(detectInterval);
      }
    }, 1000);
    
    // Safety timeout to clear interval after 60 seconds
    setTimeout(() => {
      clearInterval(detectInterval);
      console.log('Timed out waiting for Google Meet interface. Starting observers anyway.');
      observeSubtitles();
      findSubtitlesWithDeepScan();
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