import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export const getDataPath = (filename) => join(process.cwd(), 'data', filename);

export const readJson = async (filename) => {
  const content = await readFile(getDataPath(filename), 'utf8');
  return JSON.parse(content);
};

export const writeJson = async (filename, data) => {
  await writeFile(getDataPath(filename), JSON.stringify(data, null, 2));
};
