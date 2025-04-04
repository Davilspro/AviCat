import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import pLimit from 'p-limit';

const baseDir = '/mnt/Aviaserver/!Общая/!Авиатор. Каталог продукции'; // Главная папка с категориями
const jsonFile = './data.json';
const limit = pLimit(20); // Увеличил лимит до 20

async function getFileHash(filePath) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('md5');
    const stream = createReadStream(filePath);

    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => {
      console.error(`❌ Ошибка при чтении файла ${filePath}: ${err.message}`);
      resolve(null);
    });
  });
}

function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '3D модель': ['.fbx', '.obj', '.stl', '.gltf'],
    'Изображение': ['.jpg', '.jpeg', '.png', '.gif'],
    'Документ': ['.doc', '.docx', '.pdf', '.txt'],
    'Архив': ['.zip', '.rar']
  };
  return Object.entries(types).find(([, exts]) => exts.includes(ext))?.[0] || 'Другое';
}

async function scanSubfolders(folder) {
  try {
    const items = await fs.readdir(folder);
    const tasks = items.map(async item => {
      const itemPath = path.join(folder, item);
      const stats = await fs.stat(itemPath);

      if (stats.isFile()) {
        return limit(async () => {
          const hash = await getFileHash(itemPath);
          return hash ? {
            filename: item,
            filepath: path.relative(baseDir, itemPath),
            filehash: hash,
            type: getFileType(item)
          } : null;
        });
      } else if (stats.isDirectory()) {
        return scanSubfolders(itemPath);
      }
    });

    const results = await Promise.all(tasks);
    return results.flat().filter(Boolean);
  } catch (error) {
    console.error(`❌ Ошибка при сканировании папки ${folder}: ${error.message}`);
    return [];
  }
}

async function scanFiles() {
  try {
    const categories = await fs.readdir(baseDir);
    let fileData = [];

    console.log('🚀 Начало сканирования файлов...');

    for (const category of categories) {
      const categoryPath = path.join(baseDir, category);
      const stats = await fs.stat(categoryPath);
      if (!stats.isDirectory()) continue;
      console.log(`🔍 Обработка категории: ${category}`);

      const subcategories = await fs.readdir(categoryPath);
      for (const subcategory of subcategories) {
        const subcategoryPath = path.join(categoryPath, subcategory);
        const stats = await fs.stat(subcategoryPath);
        if (!stats.isDirectory()) continue;
        console.log(`    🔸 Обработка подкатегории: ${subcategory}`);

        const products = await fs.readdir(subcategoryPath);
        for (const product of products) {
          const productPath = path.join(subcategoryPath, product);
          const stats = await fs.stat(productPath);
          if (!stats.isDirectory()) continue;
          console.log(`    ➡️ Обработка товара: ${product}`);

          const productFiles = await scanSubfolders(productPath);
          fileData.push({ category, subcategory, product, files: productFiles });
        }
      }
    }

    console.log(`📦 Собрано файлов: ${fileData.length}, начинаю запись...`);
    await fs.writeFile(jsonFile, JSON.stringify(fileData, null, 2), 'utf8');
    console.log(`✅ Файлы успешно записаны в ${jsonFile}`);
  } catch (error) {
    console.error('❌ Ошибка при сканировании файлов:', error.message);
  }
}

scanFiles();
