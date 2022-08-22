# dextrades

Shows ETHUSDT trades from Uniswap V2 and Sushiswap.

Exposes the following functions:

```ts
// parses all trades from (latestBlock - blockAmount) until latestBlock
async function pullAndParse(latestBlock: number, blockAmount: number): Promise<Trade[]>

// prints trades, sorting them by side (selling or buying)
async function printTradesInBlock(latestBlock: number)
```

DEX and trade side is outputted as a number.

```ts
enum Dex {
    Sushiswap, // 0
    Uniswap // 1
}

enum TradeSide {
    Buy, // 0
    Sell // 1
}

interface Trade {
    dex_name: Dex,
    price: number,
    size: number,
    side: TradeSide,
    timestamp: number
}
```

Be aware that JavaScript doesn't support large fixed-point numbers, so 'size' and 'price' fields will be rounded.

## Usage:

```
npm install
npx ts-node
```

Once you're in the ts-node environment, import the necessary functions:

```ts
import {pullAndParse, printTradesInBlock} from "./app"
```

You can call the necessary functions now. Example:

```ts
> await printTradesInBlock(15372584)
BUYS
[
  {
    dex_name: 1,
    price: 1724.865973,
    size: 7.124354753916578,
    side: 0,
    timestamp: 1660929231
  },
  {
    dex_name: 0,
    price: 1727.688207,
    size: 0.003321974981027221,
    side: 0,
    timestamp: 1660929231
  }
]
SELLS
[]
> await pullAndParse(15372584, 60)
[
...
]
```

**WARNING!** You might get rate-limited if you use public keys. To avoid this, put a .env file in project root with your own API keys:

```
ETHERSCAN_API_KEY='*your etherscan key*'
ALCHEMY_API_KEY='*your alchemy key*'
INFURA_API_KEY='*your infura key*'
POCKET_API_KEY='*your pokt network key*'
```