import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';

// Получаем __dirname в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Разрешаем CORS для всех запросов
app.use(cors());

// Указываем путь к папке с файлами
const filesDir = '/mnt/Aviaserver/!Общая/!Авиатор. Каталог продукции';

// Проверяем доступность директории
try {
  fs.accessSync(filesDir);
  console.log(`✅ Директория ${filesDir} доступна`);
} catch (error) {
  console.error(`❌ Ошибка доступа к директории ${filesDir}:`, error.message);
  console.log('⚠️ Попробуйте использовать UNC путь или проверьте права доступа');
}

// Настраиваем статическую раздачу файлов с обработкой ошибок
app.use('/files', (req, res, next) => {
  express.static(filesDir, {
    fallthrough: false,
    setHeaders: (res, path) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  })(req, res, (err) => {
    if (err) {
      console.error(`Ошибка доступа к файлу ${req.path}:`, err.message);
      return res.status(404).send(`Файл не найден: ${req.path}`);
    }
    next();
  });
});

// Обслуживаем HTML и JS файлы из текущей директории
app.use(express.static(__dirname));

// Добавляем обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err.message);
  res.status(500).send('Ошибка сервера');
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});