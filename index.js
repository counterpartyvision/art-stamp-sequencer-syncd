const StampDecoder = require('./StampDecoder');
const fs = require('fs');
const fetch = require('node-fetch');

const mimeTypes = {
  'image/gif': "gif",
  'image/png': "png",
  'image/jpeg': "jpeg",
  'image/svg+xml': "svg",
  'image/webp': "webp",
  'application/gzip': "gz",
  'application/json': "json",
  'text/html': "html",
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createDirectories() {
  const dirs = ['s', 'log'];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

async function processStamp(stampData){
    try {
      let dataFileName = `${stampData.txHash}.${mimeTypes[stampData.mime]}`;
      fs.writeFileSync(`./s/${dataFileName}`, Buffer.from(stampData.base64Data, 'base64'), { flag: 'w' });
      fs.symlinkSync(dataFileName,"./s/"+stampData.asset);
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
}

async function processSRC721(stampData){
  console.log(stampData);
}

async function getBlockTipHeight(){
  try {
      const response = await fetch(`https://mempool.space/api/blocks/tip/height`);
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const height = await response.text();
      return height.trim(); // Remove any whitespace/newlines
  } catch (error) {
      console.error(`Error fetching block tip height:`, error);
      return null;
  } 
}

async function getBlockHashByHeight(blockHeight) {
      try {
          const response = await fetch(`https://mempool.space/api/block-height/${blockHeight}`);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const hash = await response.text();
          return hash.trim(); // Remove any whitespace/newlines
      } catch (error) {
          console.error(`Error fetching block hash for height ${blockHeight}:`, error);
          return null;
      }
  }

async function getBlockData(blockHeight, blockHash, cache){
          // Fetch the raw block data
          let rawBlockData;
          let cacheHit = false;
          //if we are using caching, try to get it from the local folder
          if(cache){
              try {
                const data = fs.readFileSync("./blocks/" + blockHeight + '.dat');
                console.log("File found reading block #" + blockHeight);
                rawBlockData = Buffer.from(data);
                cacheHit = true;
              } catch (err) {
                console.error('Block no found');
              }
          }
          
          // if our blockData is empty, get it from the internet, then save it for future use
          if(!cacheHit){
            console.log("No local block, fetching now...")
            const response = await fetch(`https://mempool.space/api/block/${blockHash}/raw`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            rawBlockData = Buffer.from(arrayBuffer);
            try {
              fs.writeFileSync("./blocks/" + blockHeight + '.dat', rawBlockData, { flag: 'w' });
              console.log("Block saved successfully" + blockHeight + '.dat');
            } catch (err) {
              console.error('Error writing file:', err);
            }
          }

          return rawBlockData;
}

async function main() {
  const decoder = new StampDecoder('main'); // Use 'testnet' for testnet
  createDirectories();

  // if there is not current block file, make one and start at the first stamp, 779652
  //const initialBlock = 779652;
  const initialBlock = 792370; // src721 initial block?
  let currentBlock = initialBlock;
  let failCount = 0;
  let blockTipHeight = await getBlockTipHeight();
  try {
    const data = fs.readFileSync("currentBlock.txt", "utf8");
    currentBlock = parseInt(data.trim());
    console.log("Current block???:", currentBlock);
  } catch (err) {
    console.error('File not found, creating it with default value...');
    fs.writeFileSync("currentBlock.txt", ""+initialBlock);
    console.log("Created file with default value: "+ initialBlock);
  }

  console.log(`Beginning sequencer - currentBlock:${currentBlock}, blockTipHeight:${blockTipHeight}`);

  while(currentBlock < blockTipHeight){
    // get the hash of this block number
    let blockHash = await getBlockHashByHeight(currentBlock);
    // get the raw block
    let blockData = await getBlockData(currentBlock, blockHash, true);
    // process this block
    let processedBlock = await decoder.decodeRawBlock(currentBlock, blockHash, blockData);
    if(processedBlock){
      if(processedBlock.stamps.length > 0){
        console.log(processedBlock.blockNumber, "Stamps Found:" + processedBlock.stamps.length);
        // if we have stamps to process in this block
        if(processedBlock.stamps.length > 0){
          // process them
          for (let i=0; i< processedBlock.stamps.length; i++) {
              let processedStamp = await processStamp(processedBlock.stamps[i]);
              // we no longer need the base64 when we have created the files, so remove it
              if(processedStamp){
                delete processedBlock.stamps[i].base64Data
              }
          }
        }
      }
      failCount = 0;
      currentBlock++;
      try {
        fs.writeFileSync("currentBlock.txt", currentBlock.toString());
        fs.writeFileSync(`./log/${currentBlock.toString()}.json`, JSON.stringify(processedBlock));
      } catch (err) {
        console.error('Error writing to file:', err);
      }
    }
    else{
      
      if(failCount > 5){
        console.log(`Failed to fetch too many times. exiting`)
        break;
      }
      console.log(`Failed to fetch block ${currentBlock}. Trying again`)
      failCount++;
    }
    //wait(1000);
  }
  

}

main();