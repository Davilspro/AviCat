import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const baseDir = '/mnt/Aviaserver/!Общая/!Авиатор. Каталог продукции'; // Главная папка с категориями
const jsonFile = './data.json';

async function getFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    console.error(`❌ Ошибка при чтении файла ${filePath}: ${error.message}`);
    return null; // Возвращаем null в случае ошибки
  }
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
    const items = await fs.readdir(folder, { withFileTypes: true });
    const promises = items.map(async item => {
      const itemPath = path.join(folder, item.name);
      if (item.isFile()) {
        const hash = await getFileHash(itemPath);
        return hash ? {
          filename: item.name,
          filepath: path.relative(baseDir, itemPath),
          filehash: hash,
          type: getFileType(item.name)
        } : null;
      } else if (item.isDirectory()) {
        console.log(`🔍 Поиск в папке: ${itemPath}`);
        return scanSubfolders(itemPath); // Рекурсивно сканируем подкаталоги
      }
    });
    const results = await Promise.all(promises);
    return results.flat().filter(Boolean); // Преобразуем и фильтруем null
  } catch (error) {
    console.error(`❌ Ошибка при сканировании папки ${folder}: ${error.message}`);
    return []; // Возвращаем пустой массив в случае ошибки
  }
}

async function scanFiles() {
  try {
    const categories = await fs.readdir(baseDir, { withFileTypes: true });
    const fileData = [];

    console.log('🚀 Начало сканирования файлов...');

    const categoryPromises = categories.map(async category => {
      if (!category.isDirectory()) return;

      console.log(`🔍 Обработка категории: ${category.name}`);
      const categoryPath = path.join(baseDir, category.name);
      const subcategories = await fs.readdir(categoryPath, { withFileTypes: true });

      const subcategoryPromises = subcategories.map(async subcategory => {
        if (!subcategory.isDirectory()) return;

        const subcategoryPath = path.join(categoryPath, subcategory.name);
        if (/^\d/.test(subcategory.name)) { // Если имя начинается с цифры, обрабатываем как товар
          console.log(`    ➡️ Обработка товара: ${subcategory.name}`);
          const productFiles = await scanSubfolders(subcategoryPath);
          return {
            category: category.name,
            subcategory: subcategory.name,
            product: subcategory.name,
            files: productFiles
          };
        } else {
          console.log(`    🔸 Обработка подкатегории: ${subcategory.name}`);
          const products = await fs.readdir(subcategoryPath, { withFileTypes: true });
          const productPromises = products.map(async product => {
            if (!product.isDirectory()) return;
            const productPath = path.join(subcategoryPath, product.name);
            const productFiles = await scanSubfolders(productPath);
            return {
              category: category.name,
              subcategory: subcategory.name,
              product: product.name,
              files: productFiles
            };
          });
          return (await Promise.all(productPromises)).filter(Boolean); // Фильтруем недействительные значения
        }
      });
      const subcategoryData = await Promise.all(subcategoryPromises);
      fileData.push(...subcategoryData.filter(Boolean)); // Сохраняем данные
    });

    await Promise.all(categoryPromises);
    await fs.writeFile(jsonFile, JSON.stringify(fileData, null, 2), 'utf8');
    console.log(`✅ Файлы успешно записаны в ${jsonFile}`);
  } catch (error) {
    console.error('❌ Ошибка при сканировании файлов:', error.message);
  }
}

scanFiles();