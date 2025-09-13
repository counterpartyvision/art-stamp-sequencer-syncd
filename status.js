const fs = require('fs');

const logFolder = './log';
let totalStamps = 0;
const fileNumbers = new Set();
const mimeCounts = {};

// Read all files in the folder
const files = fs.readdirSync(logFolder);

files.forEach(file => {
  if (file.endsWith('.json')) {
    // Extract number from filename
    const match = file.match(/^(\d+)\.json$/);
    if (match) {
      const number = parseInt(match[1]);
      fileNumbers.add(number);
      
      try {
        const data = JSON.parse(fs.readFileSync(`${logFolder}/${file}`, 'utf8'));
        if (data.stamps && Array.isArray(data.stamps)) {
          totalStamps += data.stamps.length;
          
          // Count mime types
          data.stamps.forEach(stamp => {
            if (stamp.mime) {
              mimeCounts[stamp.mime] = (mimeCounts[stamp.mime] || 0) + 1;
            }
          });
        }
      } catch (err) {
        console.error(`Error reading ${file}:`, err);
      }
    }
  }
});

// Find missing files
const maxNumber = Math.max(...fileNumbers, 0);
const minNumber = Math.min(...fileNumbers, Infinity);

// create a statusJson to hold the output data
const statusJson = {
    latestLogBlock: maxNumber,
    totalStamps: totalStamps,
    stampMimeTypes: mimeCounts,
    missingLogFiles: []
}


if (minNumber !== Infinity) {
  for (let i = minNumber; i <= maxNumber; i++) {
    if (!fileNumbers.has(i)) {
      statusJson.missingLogFiles.push(i);
    }
  }
  
} else {
  console.log('No valid numbered files found');
}

console.log(statusJson);
