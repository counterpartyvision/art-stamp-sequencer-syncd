const StampDecoder = require('./StampDecoder');

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
   await decoder.getAndDecodeRawBlock(834454);
}

main();