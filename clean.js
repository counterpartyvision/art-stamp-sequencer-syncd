const fs = require('fs').promises;

Promise.all(['./s', './log', './currentBlock.txt'].map(async (path) => {
  try {
    await fs.rm(path, { recursive: true });
    console.log(`Deleted ${path}`);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Error deleting ${path}:`, err);
  }
}));