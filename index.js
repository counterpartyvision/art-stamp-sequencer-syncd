const StampDecoder = require('./StampDecoder');
const fs = require('fs');
const fetch = require('node-fetch');


function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const decoder = new StampDecoder('main'); // Use 'testnet' for testnet
  //const txId = '2825437c2d6cf4250eca8b7bbc487107cc0ee4dfcd765a2dcf33ce31c7db2f45'; // OLGA wimage/wbp
  //const txId = '9e99825880aa7cac75629ec01de28b419f691503af2c4f51b4c8b939fd37e310';
  
  /*
  const txId = '1adf07258cff3af6c3635cae88aad2eb27aa8c6ec4caf26f6251bca17b2b95b7'; // derp thing
  try {
    const result = await decoder.decodeTx(txId);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
    */
   //await decoder.getAndDecodeRawBlock(834454);
   //await decoder.getAndDecodeRawBlock(904460);
   //await decoder.getAndDecodeRawBlock(780727, true);
   //await decoder.getAndDecodeRawBlock(792370, true);
   //await decoder.getAndDecodeRawBlock(792602, true);



  // if there is not current block file, make one and start at the first stamp, 779652
  const initialBlock = 779652;
  let currentBlock = initialBlock;
  let failCount = 0;
  let blockTipHeight = await decoder.getBlockTipHeight();
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

    let processed = await decoder.getAndDecodeRawBlock(currentBlock, true);
    if(processed){
      failCount = 0;
      currentBlock++;
      try {
        fs.writeFileSync("currentBlock.txt", currentBlock.toString());
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
    wait(1000);
  }
  

}

main();