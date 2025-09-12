const fs = require('fs');
const fetch = require('node-fetch');
const pako = require('pako');
const { parse } = require('node-html-parser');
const { createCanvas, loadImage } = require('canvas');
const bitcoin = require('bitcoinjs-lib');
const ecc = require ("tiny-secp256k1");

bitcoin.initEccLib(ecc);

class StampDecoder {
  constructor(network = 'main') {
    this.network = network === 'testnet' ? 'test3' : 'main';
    this.exampleTxs = [
      '9e99825880aa7cac75629ec01de28b419f691503af2c4f51b4c8b939fd37e310', // classic png
      'c46c4e59f64cdcce78e6680079bf6ae9b4d976f07eba2797c02c4c602807b17e', // classic gif
      '703a8e43fbad456480a6a0820584ded924151278a09e1b832b3e11e2299d1a3a', // classic svg
      'ad891d1235b04110e6d174040de034760d1fa4c0a18437f169a1d1de34091ed3', // classic html
      '9bfd550831fd3fde30a8d168e458340256b58b1e75ad109785d7ce5beb726946', // olga PNG
      'c075e98ae365c809ccd2804c1487a799748399eeb9dd61708c814a5da34c9b78', // olga gif
      '2825437c2d6cf4250eca8b7bbc487107cc0ee4dfcd765a2dcf33ce31c7db2f45', // olga webp
      '27000ab9c75570204adc1b3a5e7820c482d99033fbb3aafb844c3a3ce8b063db', // olga svg
      '8c7c8efe339d10a981ae189c7c20851f1e2f10e0e8e6792a99dbe27e32b6b6a6', // olga html
      '2cfdc5d737065aa5c5c9febde8a803b1e6ee44e47de0f2788f9dfc4d40f7ed71', // multisid
      '55f8b7a158f0e4330e7a1db287c3495c1ee6c561262e2e8f490b8ae4c6d9fbe5', // subasset // needs fixed
      '9660860095ba470a9622b41ad7b594cb53dce5ade3c79cd2b226b27619bcd40a', // olga svg gzip
      '7c48691bf8cfafa66b1d938ada4c2c778c07a49c1a0683f969c29b94363a0fec'  // video mp4
    ];

    this.mimeTypes = {
      'image/gif': "gif",
      'image/png': "png",
      'image/jpeg': "jpeg",
      'image/svg+xml': "svg",
      'image/webp': "webp",
      'application/gzip': "gz",
      'application/json': "json",
      'text/html': "html",
    }
  }

    getOutputScriptType(script) {
        try{
            if(script[0] == 0x6A ) return 'opreturn';
            let address = bitcoin.address.fromOutputScript(script);
            if (address.startsWith('bc1q')) return 'segwit';
            if (address.startsWith('bc1p')) return 'taproot';
            if (address.startsWith('1')) return 'legacy';
            if (address.startsWith('3')) return 'p2sh';
            return "unknown"
        }
        catch(e){
            return "unknown";
        }
      }

  saveStamp(txHash,cpid,mimeType,base64Data){
    try {
      let dataFileName = `${txHash}.${this.mimeTypes[mimeType]}`;
      fs.writeFileSync(`./s/${dataFileName}`, Buffer.from(base64Data, 'base64'), { flag: 'w' });
      fs.symlinkSync(dataFileName,"./s/"+cpid);
      return true;
    } catch (err) {
      return false;
    }
  }

  // get the 
  async decodeRawBlock(blockHeight, blockHash, rawBlockData) {
    try {
        /*
        let blockHash = await this.getBlockHashByHeight(blockHeight);

        // Fetch the raw block data
        console.log('=== FETCHING DATA ===');
        console.log(`Fetching raw block data for ${blockHeight} - ${blockHash}...`);
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

        //console.log(`Raw block size: ${rawBlockData.length} bytes`);
        */
        
        // Parse the raw block with bitcoinjs-lib
        const parsedBlock = bitcoin.Block.fromBuffer(rawBlockData);
        let finalBlockData = {};
        finalBlockData.id = parsedBlock.getId();
        finalBlockData.blockNumber = blockHeight;
        finalBlockData.stamps = [];
        
        const transactions = [];
        let totalStampCount = 0;

        for (let i = 0; i < parsedBlock.transactions.length; i++) {
            const tx = parsedBlock.transactions[i];

            try {
                // Get detailed transaction information
                const txInfo = {
                    index: i,
                    txid: tx.getId(),
                    hash: tx.getId(),
                    blockHeight: blockHeight,
                    version: tx.version,
                    locktime: tx.locktime,
                    size: tx.toBuffer().length,
                    // get just enough info to properly decode inputs and outputs
                    inputs: tx.ins.map((input, idx) => {
                        return {
                            index: idx,
                            txid: input.hash.reverse().toString('hex'),
                            vout: input.index,
                            sequence: input.sequence
                        };
                    }),
                    outputs: tx.outs.map((output, idx) => {
                        return {
                            index: idx,
                            value: output.value,
                            script:output.script.toString('hex'),
                            type: this.getOutputScriptType(output.script),
                        };
                    })
                };

                // go over every tx
                    try{
                        let txResult = await this.processTransaction(txInfo, tx.getId());
                        if(txResult){
                          totalStampCount++;
                          //console.log(JSON.stringify(txResult,0,2))
                          //console.log("Stamp Found:",txResult.stampData.asset, txResult.stampData.mimeType, txResult.bitcoinData.txId);
                          let saveResult = this.saveStamp(txResult.bitcoinData.txId, txResult.stampData.asset, txResult.stampData.mimeType, txResult.stampData.base64Data)
                          let currentStampData = {
                            asset: txResult.stampData.asset,
                            issuance: txResult.stampData.issuance,
                            mime: txResult.stampData.mimeType,
                            encoding: txResult.stampData.encoding,
                            saved: saveResult
                          }
                          if(txResult.stampData.subasset){
                            currentStampData.subasset = txResult.stampData.subasset;
                          }

                          finalBlockData.stamps.push(currentStampData);
                        }
                    }
                    catch(e){

                    }

            } catch (txError) {
                console.error(`Failed to decode transaction ${i}:`, txError.message);
                
                // Add basic info even if ASM parsing fails
                transactions.push({
                    index: i,
                    txid: tx.getId(),
                    error: `Transaction decoding failed: ${txError.message}`
                });
            }
        }
        //console.log("Stamps Found:", totalStampCount);
        return finalBlockData;


    } catch (error) {
        console.error('Error fetching/decoding block:', error);
        return false;
    }
}

  async decodeTx(tx) {
    if (!/^[0-9a-fA-F]{64}$/.test(tx)) {
      throw new Error('Invalid transaction ID format');
    }

    if (tx === 'random') {
      tx = this.exampleTxs[Math.floor(Math.random() * this.exampleTxs.length)];
    } else if (!isNaN(tx)) {
      tx = this.exampleTxs[parseInt(tx)];
    }

    const txData = await this.fetchTransaction(tx);
    if (!txData) {
      throw new Error('Failed to fetch transaction data');
    }

    return await this.processTransaction(txData, tx);
  }

  async fetchTransaction(tx) {
    try {
      const url = `https://api.blockcypher.com/v1/btc/${this.network}/txs/${tx}?instart=0&outstart=0&limit=5000`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => 'Unknown error')}`);
      }
      let data = await response.json();
      if (!data || !data.hash) {
        throw new Error('Invalid or empty transaction data');
      }

      while (data.next_outputs) {
        const nextResponse = await fetch(data.next_outputs, { method: 'GET' });
        if (!nextResponse.ok) {
          throw new Error(`HTTP ${nextResponse.status}: Failed to fetch additional outputs`);
        }
        const nextData = await nextResponse.json();
        data.outputs = data.outputs.concat(nextData.outputs);
        data.next_outputs = nextData.next_outputs;
      }
      return data;
    } catch (e) {
      console.error('Error fetching transaction:', e.message, { tx, network: this.network });
      return null;
    }
  }

  async processTransaction(json, tx) {
    try {
      const result = {
        bitcoinData: {
          txId: json.hash || 'unknown',
          blockHeight: json.blockHeight || 'unknown',
        },
        stampData: null
      };

      const p2wshOutputs = [];
      let cpMsg = '';
      let encoding = '';
      const utxo = json.inputs?.[0]?.txid|| 'unknown';
      let recipient = '0';
      let dustSat = 0;

      for (const [index, output] of (json.outputs || []).entries()) {
        const type = output.type;


        if (type === 'opreturn') {
          encoding = 'op_return';
          // slice the 0x6a and size bytes off the hex string
          const raw = this.xcpRc4(utxo, output.script.slice(4));
          if (raw.startsWith('434e545250525459')) {
            cpMsg += raw;
            //console.log(json.hash, "Counterparty tx found");
          } else {
            throw new Error(`Invalid RC4 decryption for OP_RETURN: ${raw.substring(0, 16)}`);
          }
        } else if (type === 'unknown') {
          let raw = output.script;
          let len;

          if (raw.length === 142) {
            encoding = 'op_return';
            len = parseInt(this.hexToDec(raw.substring(72, 74)));
            if (isNaN(len) || len < 0 || len > (raw.length - 74) / 2) {
              //console.error(`Invalid length in multisig script ${index}: len=${len}, script=${raw}`);
              continue;
            }
            raw = raw.substring(74, 74 + len * 2);
            if (!/^[0-9a-fA-F]+$/.test(raw)) {
              //console.error(`Invalid hex data in multisig script ${index}: ${raw}`);
              continue;
            }
            cpMsg += raw;
          } else if (raw.length === 210) {
            encoding = 'multisig';
            raw = this.xcpRc4(utxo, raw.substring(6, 68) + raw.substring(74, 136));
            //console.log(json.hash, raw);
            len = parseInt(this.hexToDec(raw.substring(0, 2)));
            if (isNaN(len) || len < 0 || len > (raw.length - 2) / 2) {
              //console.error(`Invalid length in multisig script ${index}: len=${len}, script=${raw}`);
              continue;
            }
            raw = raw.substring(2, 2 + len * 2);
            if (!/^[0-9a-fA-F]+$/.test(raw)) {
              //console.error(`Invalid hex data in multisig script ${index}: ${raw}`);
              continue;
            }
            cpMsg += raw.startsWith('434e545250525459') ? raw.substring(16) : raw;
          } else {
            encoding = 'multisig';// (custom length)';
            raw = this.xcpRc4(utxo, raw);
            len = parseInt(this.hexToDec(raw.substring(0, 2)));
            if (isNaN(len) || len < 0 || len > (raw.length - 2) / 2) {
              //console.error(`Invalid length in multisig script ${index}: len=${len}, script=${raw}`);
              continue;
            }
            raw = raw.substring(2, 2 + len * 2);
            if (!/^[0-9a-fA-F]+$/.test(raw)) {
              //console.error(`Invalid hex data in multisig script ${index}: ${raw}`);
              continue;
            }
            cpMsg += raw.startsWith('434e545250525459') ? raw.substring(16) : raw;
          }
          //console.log(`Multisig output ${index} (length ${output.script.length}): len=${len}, raw=${raw}`);
        } else if (type === 'segwit') {
          p2wshOutputs.push([output.script, output.value]);
        }
      }

      if(cpMsg.startsWith('434e545250525459')){
        cpMsg = cpMsg.substring(16);
     }

      result.bitcoinData.recipient = recipient !== '0' ? recipient : undefined;
      if (dustSat > 0) {
        result.bitcoinData.dustSat = dustSat;
        result.bitcoinData.dustBtc = (dustSat / 100000000).toFixed(8);
      }

      // do nothing here, its not a stamp
      if (!cpMsg && p2wshOutputs.length === 0) {
        //console.log('No valid CP/Stamp data or P2WSH outputs found');
      }
      // process stamp
      else{
        const id = parseInt(cpMsg.substring(0, 2), 16);
        cpMsg = cpMsg.substring(2);
        const blockHeightNum = result.bitcoinData.blockHeight === 'unknown' ? 0 : parseInt(result.bitcoinData.blockHeight);
        let currentStampData;

        // check for normal olga issuances
        if (encoding != "multisig" && p2wshOutputs.length > 0 && (id === 20 || id === 22)) {
            currentStampData = await this.processOlgaStamp(tx, cpMsg, p2wshOutputs, blockHeightNum, id);
        // check for normal classic stamp issuances
        } else if ((id === 20 || id === 22)) {
            currentStampData = await this.processClassicStamp(tx, cpMsg, blockHeightNum, id);
        // check for olga subasset issuances
        } else if ((id === 21 || id === 23) && blockHeightNum >= 753500) {
          currentStampData = await this.processOlgaSubassetStamp(tx, cpMsg, p2wshOutputs, blockHeightNum, id)
        } else {
            throw new Error(`Invalid Issuance or Subasset transaction: Message ID ${id}, Block Height ${blockHeightNum}`);
        }
        if(currentStampData != false){
          //console.log(encoding,currentStampData);
          result.stampData = { ...result.stampData, ...(currentStampData) };
          return result;
        }
        throw Error("No Stamp found in " + json.hash)
    }
    } catch (e) {
    // if we dont decode it, it didnt have any counterparty data in it... probably
      throw Error(e);
      //throw new Error(`Failed to decode transaction: ${e.message}`);
    }
  }

 stampDataFromCpMsg(id, cpMsg){
    return ({
        type: 'Issuance',
        messageId: id,
        asset: 'A' + BigInt('0x' + cpMsg.substring(0, 16)).toString(10),
        issuance: Number(BigInt('0x' + cpMsg.substring(16, 32))),
        divisible: parseInt(cpMsg.substring(32, 34), 16) ? true : false,
        lock: parseInt(cpMsg.substring(34, 36), 16) ? true : false,
        reset: parseInt(cpMsg.substring(36, 38), 16) ? true : false
      });
  }

  async processClassicStamp(tx, cpMsg, blockHeight, id) {
    const stampData = this.stampDataFromCpMsg(id, cpMsg);
    cpMsg = cpMsg.substring(38);
    const descr = this.hex2a(cpMsg);
    if (descr.toLowerCase().startsWith('stamp:')) {
      return { ...stampData, ...(await this.parseStampContent(tx, descr)) };
    }
    return false;
  }

  async processOlgaStamp(tx, cpMsg, p2wshOutputs, blockHeight, id) {
    let stampData = this.stampDataFromCpMsg(id, cpMsg);
    cpMsg = cpMsg.substring(38);
    const descr = this.hex2a(cpMsg);
    if (descr.toLowerCase().startsWith('stamp:')) {
        return { ...stampData, ...(await this.parseOlgaStamp(tx, cpMsg, p2wshOutputs)) };
    }
    return false;
  }

  async processOlgaSubassetStamp(tx, cpMsg, p2wshOutputs, blockHeight, id) {
    let stampData = this.stampDataFromCpMsg(id, cpMsg);
    cpMsg = cpMsg.substring(38);
    const lenSubasset = parseInt(cpMsg.substring(0, 2), 16);
    cpMsg = cpMsg.substring(2);
    if (cpMsg.length < lenSubasset * 2) {
      throw new Error(`Invalid subasset length: ${lenSubasset}, remaining cp_msg length: ${cpMsg.length}`);
    }
    const subassetHex = cpMsg.substring(0, lenSubasset * 2);
    stampData.subasset = this.hexToSubasset(subassetHex);
    stampData.subassetHex = subassetHex;
    const descr = this.hex2a(cpMsg.substring(lenSubasset * 2));
    if (descr.toLowerCase().startsWith('stamp:')) {
      return { ...stampData, ...(await this.parseOlgaStamp(tx, cpMsg, p2wshOutputs)) };
    }
    return false;
  }

  async parseOlgaStamp(tx, assetHex, p2wshOutputs) {
    let hex = '';
    let dust = 0;
    for (const [script, value] of p2wshOutputs) {
      hex += script.slice(4);
      dust += value;
    }

    const fileSize = parseInt(hex.slice(0, 4), 16);
    if (isNaN(fileSize) || fileSize <= 0 || hex.length < fileSize * 2 + 4) {
      throw new Error(`Invalid P2WSH file size: ${fileSize}`);
    }

    const file = hex.slice(4, 4 + fileSize * 2);
    const hexPairs = file.match(/\w{2}/g);
    if (!hexPairs) {
      throw new Error('Invalid P2WSH data format');
    }

    const base64 = btoa(hexPairs.map(y => String.fromCharCode(parseInt(y, 16))).join(''));
    return await this.parseStampContent(tx, `stamp:${base64}`, fileSize, dust);
  }

  async parseStampContent(tx, descr, fileSize = 0, dust = 0) {
    if (!descr.toLowerCase().startsWith('stamp:') || !/^[a-zA-Z0-9+\/=]+$/.test(descr.substr(6))) {
      throw new Error('Invalid stamp format');
    }

    let image = descr.slice(6).replace(/\s/g, '');
    const paddingNeeded = (4 - (image.length % 4)) % 4;
    image += '='.repeat(paddingNeeded);

    let fileType = '';
    let isGzip = image.startsWith('H4sI');
    let processedImage = image;

    if (isGzip) {
      try {
        const decoded = atob(image);
        const binary = new Uint8Array(decoded.length).map((_, i) => decoded.charCodeAt(i));
        processedImage = btoa(pako.ungzip(binary, { to: 'string' }));
      } catch (e) {
        throw new Error(`Failed to decompress gzip data: ${e.message}`);
      }
    }

    try {
      atob(processedImage);
    } catch (e) {
      throw new Error(`Invalid base64 data: ${e.message}`);
    }

    const isJson = (base64Str) => {
        try { return JSON.parse(atob(base64Str)); } catch(e) { return false; }
    };

    if (processedImage.startsWith('R0lGOD')) {
      fileType = 'image/gif';
    } else if (processedImage.startsWith('iVBORw')) {
      fileType = 'image/png';
    } else if (processedImage.startsWith('/9j/')) {
      fileType = 'image/jpeg';
    } else if (processedImage.startsWith('PHN2Z') || processedImage.startsWith('PD94b')) {
      fileType = 'image/svg+xml';
    } else if (processedImage.startsWith('UklGR')) {
      fileType = 'image/webp';
    } else if (processedImage.startsWith('H4sI')) {
        fileType = 'application/gzip';
    } else if (isJson(image)){
        fileType = 'application/json';
    } else {
      fileType = 'text/html';
    }

    const stampData = {
      encoding: fileSize ? 'olga' : 'multisig',
      compression: isGzip ? 'gzip' : 'None',
      mimeType: fileType,
      base64Data: `${image}`,
    };

    if (fileSize) {
      stampData.fileSizeBytes = fileSize;
      stampData.burnedSat = dust;
      stampData.burnedBtc = (dust / 100000000).toFixed(8);
    }

    if (fileType === 'text/html') {
      try {
        const htmlContent = atob(processedImage);
        const root = parse(htmlContent, { blockTextElements: { script: false, style: false } });
        const video = root.querySelector('video');
        if (video && video.getAttribute('src')) {
          stampData.mimeType = 'video/mp4';
          stampData.videoSrc = encodeURI(video.getAttribute('src'));
          stampData.note = 'Video content detected. Ensure valid playback.';
        }
      } catch (e) {
        throw new Error(`Failed to parse HTML content: ${e.message}`);
      }
    }

    return stampData;
  }

  xcpRc4(key, data) {
    return this.bin2hex(this.rc4(this.hex2bin(key), this.hex2bin(data)));
  }

  hex2a(hex) {
    try {
      if (!/^[0-9a-fA-F]+$/.test(hex)) {
        throw new Error('Invalid hex string');
      }
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.substr(i, 2), 16);
        if (isNaN(byte)) {
          throw new Error(`Invalid hex byte at position ${i}: ${hex.substr(i, 2)}`);
        }
        str += String.fromCharCode(byte);
      }
      return str;
    } catch (e) {
      throw new Error('Error in hex2a:', e.message, { hex });
      return '';
    }
  }

  hex2bin(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length - 1; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return String.fromCharCode(...bytes);
  }

  bin2hex(str) {
    return Array.from(str, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  }

  rc4(key, str) {
    let s = Array(256).fill().map((_, i) => i);
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
      [s[i], s[j]] = [s[j], s[i]];
    }
    let i = 0, k = 0, res = '';
    for (let y = 0; y < str.length; y++) {
      i = (i + 1) % 256;
      k = (k + s[i]) % 256;
      [s[i], s[k]] = [s[k], s[i]];
      res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[k]) % 256]);
    }
    return res;
  }

  hexToDec(hex) {
    let digits = [0];
    for (let i = 0; i < hex.length; i++) {
      let carry = parseInt(hex[i], 16);
      for (let j = 0; j < digits.length; j++) {
        digits[j] = digits[j] * 16 + carry;
        carry = Math.floor(digits[j] / 10);
        digits[j] %= 10;
      }
      while (carry > 0) {
        digits.push(carry % 10);
        carry = Math.floor(carry / 10);
      }
    }
    return digits.reverse().join('');
  }

  hexToSubasset(hex) {
    const SUBASSET_DIGITS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_@!';
    let integer = BigInt('0x' + hex);
    let ret = '';
    while (integer !== 0n) {
      ret = SUBASSET_DIGITS[(integer % 68n) - 1n] + ret;
      integer = integer / 68n;
    }
    return ret;
  }
}

module.exports = StampDecoder;