// Файл для генерации иконок через Node.js
// Не все браузеры поддерживают SVG иконки в расширениях, поэтому создаем PNG

const fs = require('fs');
const { createCanvas } = require('canvas');

// Функция для создания иконки
function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Фон (Google Blue)
  ctx.fillStyle = '#4285f4';
  ctx.fillRect(0, 0, size, size);
  
  // Закругленные углы (имитация)
  const radius = size * 0.125; // 1/8 размера
  ctx.fillStyle = '#4285f4';
  
  // Буква "S"
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Настройка размера шрифта в зависимости от размера иконки
  const fontSize = Math.floor(size * 0.6);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  
  // Отрисовка текста по центру
  ctx.fillText('S', size/2, size/2);
  
  // Сохранение в файл
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icons/icon${size}.png`, buffer);
  
  console.log(`Created icon${size}.png`);
}

// Создание иконок всех необходимых размеров
try {
  createIcon(16);
  createIcon(48);
  createIcon(128);
  console.log('All icons generated successfully!');
} catch (error) {
  console.error('Error generating icons:', error);
} 