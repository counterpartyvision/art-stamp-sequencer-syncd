# Art Stamps Sequencer

The **Art Stamps Sequencer** is a Node.js application that scans Bitcoin blocks to find and Counterparty transactions that contain Art Stamps. This tool is designed to extract, decode, and organize art stamps from the Bitcoin blockchain into a structured file system for easy use.

# UNSTABLE
This repo is not finished and is unstable.  Do not use it yet.

## Features

- Scans Bitcoin blocks for Stamps
- Supports both standard stamps and SRC-721 collections (NFT-style)
- Automatically creates directories and symlinks for assets
- Saves processed stamps as base64-decoded files in supported formats (PNG, GIF, SVG, etc.)
- Logs each processed block to a JSON file for debugging or replay
- Caches blocks locally to avoid repeated network fetches

## Supported Formats

Art stamps may come in the following formats:

| Format        | Extension |
|---------------|-----------|
| PNG           | `.png`    |
| GIF           | `.gif`    |
| JPEG          | `.jpeg`   |
| SVG           | `.svg`    |
| WebP          | `.webp`   |
| JSON          | `.json`   |
| HTML          | `.html`   |
| GZIP Archive  | `.gz`     |

## How It Works

1. The application starts at a configured block height (default: 779652, the first stamp block).
2. It fetches the latest Bitcoin block height to determine how far to scan.
3. For each block, it retrieves raw transaction data and decodes stamp artifacts using the `StampDecoder`.
4. If a stamp contains metadata indicating it's an SRC-721 collection deploy or mint, the application saves both:
   - The original stamp data
   - A structured collection (`src721`) with trait information and SVG rendering logic

---

## File Structure Output

```
.
├── s/                    # Directory containing processed stamps
│   └── <txHash>.<ext>    # Stamp files
│   └── <cpid>            # symlink to the stamp file based on asset cpid
├── src721/               # Directory for SRC-721 collections and assets
│   ├── <assetName>.json  # Collection metadata (can be JSON or SVG)
│   └── <assetName>/      # Subdirectory containing minted asset SVGs
│       └── <cpid>.svg    # SRC721 SVG Images
├── log/                  # Logs of each block processed (JSON)
│   └── <blockNum>.json   # Block-level log with stamp details
├── currentBlock.txt      # Tracks the next block to process (persisted)
└── blocks/               # Cached raw blocks from mempool.space
```

---

## Setup & Installation

### Prerequisites

- [Node.js](https://nodejs.org/)
- `npm`

### Installation Steps

```bash
git clone putRepoNameHere
cd art-stamps-sequencer

# Install dependencies
npm install
```

### Run the Sequencer

```bash
node index.js
```

> ⚠️ Note: The script creates directories automatically but requires write permission to the working directory.

---

## Configuration

Edit `index.js` to adjust starting block numbers:

```js
const initialBlock = 779652; // default starting block (Stamp Protocol inception)
```


## Logs & Debugging

All processed blocks are logged to the `log/` directory with filenames like:

```
log/779652.json
```

Each file contains the raw block and decoded stamps.

```json
{
    "id":"00000000000000000002ea8eb5df114c3f198c7ef5851435e8a4d8e7bd33121c",
    "blockNumber":779652,
    "stamps":[
        {   
            "txHash":"17686488353b65b128d19031240478ba50f1387d0ea7e5f188ea7fda78ea06f4",
            "asset":"A7337447728884561000",
            "issuance":1,
            "mime":"image/png",
            "encoding":"multisig",
            "locked":false
        },
        {
            "txHash":"eb3da8146e626b5783f4359fb1510729f4aad923dfac45b6f1f3a2063907147c",
            "asset":"A6360128538192758000",
            "issuance":1,
            "mime":"image/png",
            "encoding":"multisig",
            "locked":false
        }
    ]
}
```


## License

MIT – see [LICENSE](./LICENSE) for more details.
