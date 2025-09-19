const StampDecoder = require('./StampDecoder');
const fs = require('fs');
const fetch = require('node-fetch');
const reorgBuffer = 2;

const args = process.argv.slice(2);
let reindexBlock = null;
let cacheEnabled = true;
let runForMinutes = null;
let waitTime = 2000; // Default wait time


// Parse all arguments
for (let i = 0; i < args.length; i++) {
  // total number of minutes to run for, useful with a cron job
  if (args[i] === '--minutes' && i + 1 < args.length) {
    runForMinutes = parseInt(args[i + 1]);
    i++; // Skip the next argument as we've already processed it
  }
  // total time to wait between blocks, useful to not ddos the provider 
  else if (args[i] === '--wait' && i + 1 < args.length) {
    waitTime = parseInt(args[i + 1]);
    i++; // Skip the next argument as we've already processed it
  }
  // block to reindex 
  else if (args[i] === '--reindex' && i + 1 < args.length) {
    reindexBlock = parseInt(args[i + 1]);
    i++; // Skip the next argument as we've already processed it
  } 
  // are we saving all blocks? if not pass this
  else if (args[i] === '--no-cache') {
    cacheEnabled = false;
  }
}

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
  const dirs = ['s', 'log', 'src721'];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

function saveSrc721Deploy(stampData, jsonData){
  try{

    const tKeys = Object.keys(jsonData).filter(key => /^t\d+$/.test(key));
    // Iterate over each array
    tKeys.forEach(key => {
      // create a property to store an array of base64 data
      jsonData[key+"-b64"] = [];
      jsonData[key+"-b64"].length = jsonData[key].length
      jsonData[key].forEach((item, index) => {
        jsonData[key+"-b64"][index] = (fs.readFileSync("./s/"+item, 'base64'));
      });
    });
    // save the src721 collection jsonData into the folder, then save the stamp like normal
    let dataFileName = `${stampData.asset}.${mimeTypes[stampData.mime]}`;
    fs.writeFileSync(`./src721/${dataFileName}`, JSON.stringify(jsonData), { flag: 'w' });
    createSymlink(`../src721/${dataFileName}`,"./s/"+stampData.asset);
    // make a directory to hold the items
    fs.mkdirSync('./src721/' + stampData.asset, { recursive: true });
    return saveStamp(stampData);
  }
  catch(e){
    console.log(e);
    return false;
  }
}

function saveSrc721Mint(stampData, jsonData){
  try{
    // to save the actual json data at the txhash.json
    let dataFileName = `${stampData.txHash}.${mimeTypes[stampData.mime]}`;
    fs.writeFileSync(`./s/${dataFileName}`, Buffer.from(stampData.base64Data, 'base64'), { flag: 'w' });
    // read the collection json
    let collectionJSON = JSON.parse(fs.readFileSync(`./src721/${jsonData.c}.json`, 'utf8'));
    const src721Traits = {};
    // if the src721 is html, 
    if(collectionJSON.type === "data:text/html"){
      let htmlPath = `./src721/${jsonData.c}/${stampData.asset}.html`;
      fs.writeFileSync(`${htmlPath}`, Buffer.from(stampData.base64Data, 'base64'), { flag: 'w' });
      createSymlink("."+htmlPath,"./s/"+stampData.asset);
      
    }
    // otherwise do the image generation
    else{
      jsonData.ts.forEach((index, i) => {
        src721Traits[`t${i}`] = collectionJSON[`t${index}`];
      });

      // generate the src721 svg by using data from collection for viewbox and image-rendering, the stacking the traits
      let svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewbox ="${collectionJSON.viewbox}" style="image-rendering:${collectionJSON["image-rendering"]}">`
      for(let i=0; i< jsonData.ts.length; i++){
          svgString += `<image href="${collectionJSON.type}, ${collectionJSON["t" + i + "-b64"][jsonData.ts[i]]}"></image>`;
      }
      svgString += "</svg>";
      
      // store the SVG as asset.svg and make a symlink to it
      let svgPath = `./src721/${jsonData.c}/${stampData.asset}.svg`
      fs.writeFileSync(svgPath, svgString, { flag: 'w' });
      createSymlink("."+svgPath,"./s/"+stampData.asset);
    }
    return true;
  }
  catch(e){
    console.log(e);
    return false;
  }
}

function createSymlink(targetPath, linkPath){
  // try removing a symlink, this is needed if partially reindexing and updating paths
  try { 
    fs.unlinkSync(linkPath);
  } 
  catch (err) { 
    /*do nothing if it doesnt exits*/
  }
  fs.symlinkSync(targetPath,linkPath);
}

function saveStamp(stampData){
  try{
    let dataFileName = `${stampData.txHash}.${mimeTypes[stampData.mime]}`;
    fs.writeFileSync(`./s/${dataFileName}`, Buffer.from(stampData.base64Data, 'base64'), { flag: 'w' });
    createSymlink(dataFileName,"./s/"+stampData.asset);
    return true;
  }
  catch(e){
    return false;
  }
}

function processStamp(stampData){
    try {
      // if its a normal json file
      if(stampData.mime === "application/json"){
        let jsonData = JSON.parse(Buffer.from(stampData.base64Data, 'base64').toString('utf-8'));
        if(jsonData.p.toLowerCase() === "src-721"){
          return processSRC721(stampData, jsonData);
        }
      }
      // if its another type of file, and the optext is 721 (probably html)
      else if(stampData?.optext && stampData.optext.startsWith('721')){
        const jsonParts = stampData.optext.split('|');
        const jsonData = {};
        
        // Skip the first part which is "721", then put the rest into json
        jsonParts.slice(1).forEach(part => {
            const [key, value] = part.split(':');
            jsonData[key] = value;
        });
        
        return processSRC721(stampData,jsonData);
      }
      console.log(stampData);

      return saveStamp(stampData);

    } catch (err) {
      console.log(err);
      return false;
    }
}

async function processSRC721(stampData, jsonData){
  //console.log(stampData, jsonData)
  if(jsonData.op.toLowerCase() === "deploy"){
    console.log("SRC721 DEPLOY", stampData.asset, JSON.stringify(jsonData));
    // save the deploy into the src721 folder
    saveSrc721Deploy(stampData, jsonData);
  }
  // one of the requirements for src-721 mint is that the asset is issued locked at a single issuance
  else if(stampData.locked && stampData.issuance === 1 && jsonData.op.toLowerCase() === "mint"){
    saveSrc721Mint(stampData, jsonData);
  }
  // not a valid src721 deploy or mint, just save it like normal
  else{
    return saveStamp(stampData);
  }
}

async function getBlockTipHeight(){
  try {
      const response = await fetch(`https://mempool.space/api/blocks/tip/height`);
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const height = await response.text();
      return parseInt(height.trim()) - reorgBuffer ; // Remove any whitespace/newlines and go to the
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
                console.error('Block not found');
              }
          }
          
          // if our blockData is empty, get it from the internet, then save it for future use
          if(!cacheHit){
            console.log(`No local block, fetching ${blockHeight} now...`);
            const response = await fetch(`https://mempool.space/api/block/${blockHash}/raw`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            rawBlockData = Buffer.from(arrayBuffer);
            // if we are caching blocks, save them
            if(cache){
              try {
                fs.writeFileSync("./blocks/" + blockHeight + '.dat', rawBlockData, { flag: 'w' });
                console.log("Block saved successfully - " + blockHeight + '.dat');
              } catch (err) {
                console.error('Error writing file:', err);
              }
            }
          }

          return rawBlockData;
}

async function main() {
  // Running for a certain number of minutes
  const startTime = Date.now();
  if (runForMinutes !== null) {
    console.log(`Running for ${runForMinutes} minutes...`);
  }
  const decoder = new StampDecoder('main'); // Use 'testnet' for testnet
  createDirectories();

  // if there is not current block file, make one and start at the first stamp, 779652
  const initialBlock = 779652;
  //const initialBlock = 788041; // src20 initial block
  //const initialBlock = 792370; // src721 initial block
  //const initialBlock = 792555; // src721 first valid

  // if we have a command line to reindex a single block, then we need to just do that block
  let currentBlock = reindexBlock ? reindexBlock : initialBlock;

  let failCount = 0;
  let blockTipHeight = await getBlockTipHeight();
  // if we arent reindexing, get block information from file
  if(!reindexBlock){
    try {
      const data = fs.readFileSync("currentBlock.txt", "utf8");
      currentBlock = parseInt(data.trim());
      console.log("Current block:", currentBlock);
    } catch (err) {
      console.error('File not found, creating it with default value...');
      fs.writeFileSync("currentBlock.txt", ""+initialBlock);
      console.log("Created file with default value: "+ initialBlock);
    }
    console.log(`Beginning sequencer - currentBlock:${currentBlock}, blockTipHeight:${blockTipHeight}`);
  }
  else{
    console.log(`Reindexing - currentBlock:${currentBlock}`);
  }

  // if we are reindexing a block, we just do that one. otherwise work toward the blockTipHeight
  while(
    (runForMinutes === null || (Date.now() - startTime) < runForMinutes * 60 * 1000) &&
    (reindexBlock ? currentBlock < reindexBlock + 1 : currentBlock < blockTipHeight)
  ) {
    // get the hash of this block number
    let blockHash = await getBlockHashByHeight(currentBlock);
    // get the raw block, pass the cacheEnabled flag
    let blockData = await getBlockData(currentBlock, blockHash, cacheEnabled);
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
              else{
                // if the stamp isnt processed properly, flag it with an error
                processedBlock.stamps[i].error = true
              }
          }
        }
      }
      failCount = 0;

      try {
        fs.writeFileSync("currentBlock.txt", currentBlock.toString());
        fs.writeFileSync(`./log/${currentBlock.toString()}.json`, JSON.stringify(processedBlock), { flag: 'w' });
        console.log(`Saving ${currentBlock.toString()}, Stamps Found:  ${processedBlock.stamps.length}`)
      } catch (err) {
        console.error('Error writing to file:', err);
      }
      // after saving the current block, move onto the next one
      currentBlock++;
    }
    else{
      
      if(failCount > 5){
        console.log(`Failed to fetch too many times. exiting`)
        break;
      }
      console.log(`Failed to fetch block ${currentBlock}. Trying again`)
      failCount++;
    }
    wait(waitTime);
  }
  

}

main();