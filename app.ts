require('dotenv').config();
import {ethers} from "ethers";
import { LogDescription } from "ethers/lib/utils";

const poolAddress = "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852"; // ETH-USDT univ2
const Ten = ethers.BigNumber.from(10);

// event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)
const swapEventTopic = ethers.utils.id("Swap(address,uint256,uint256,uint256,uint256,address)");

const provider = ethers.getDefaultProvider("homestead", {
    etherscan: process.env.ETHERSCAN_API_KEY,
    alchemy: process.env.ALCHEMY_API_KEY,
    infura: process.env.INFURA_API_KEY,
    pocket: process.env.POCKET_API_KEY
});

// Get all events emitted by the contract "address" for the last "blocks" blocks
// WARNING: most rpc providers require a paid tier for archive data (old events)
async function getPoolLogs(address: string, latestBlock: number, blockAmount: number): Promise<ethers.providers.Log[]> {
    let result: ethers.providers.Log[] = [];
    let block = latestBlock;

    // some providers reject big requests, so request block-by-block
    while (block > (latestBlock - blockAmount)) {
        const blockLogs: ethers.providers.Log[] = await provider.getLogs({
            address: address,
            fromBlock: block,
            toBlock: block,
            topics: [
                swapEventTopic,
            ]
        });
        result = result.concat(blockLogs);

        console.log(`getPoolLogs: Got ${blockLogs.length} logs for block ${block}`);
        block--;
    }

    return result;
}

enum Dex {
    Sushiswap,
    Uniswap
}

enum TradeSide {
    Buy,
    Sell
}

interface Trade {
    dex_name: Dex,
    price: number,
    size: number,
    side: TradeSide,
    timestamp: number
}

// event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)
interface SwapAmount {
    amount0In: ethers.BigNumber,
    amount1In: ethers.BigNumber,
    amount0Out: ethers.BigNumber,
    amount1Out: ethers.BigNumber
}

// parses logs into Trade structures
async function parseLogs(decimals0: number, decimals1: number, logs: ethers.providers.Log[], dex: Dex): Promise<Trade[]> {
    let result: Trade[] = [];
    let blockInfo: ethers.providers.Block[] = [];

    for (const log of logs) {
        if (blockInfo[log.blockNumber] == undefined) {
            blockInfo[log.blockNumber] = await provider.getBlock(log.blockNumber);
        }

        let blockTimestamp: number = blockInfo[log.blockNumber].timestamp;
        const swapData: string = log.data.substring(2);
        const swaps: SwapAmount = {
            amount0In: ethers.BigNumber.from("0x" + swapData.substring(0, 64)),
            amount1In: ethers.BigNumber.from("0x" + swapData.substring(64, 128)),
            amount0Out: ethers.BigNumber.from("0x" + swapData.substring(128, 192)),
            amount1Out: ethers.BigNumber.from("0x" + swapData.substring(192, 256))
        };

        // are we "selling" the first asset in the pair?
        if (!swaps.amount0In.eq(0)) {
            const price: ethers.BigNumber = swaps.amount1Out.mul(Ten.pow(decimals0)).div(swaps.amount0In);

            const entry: Trade = {
                dex_name: dex,
                price: +ethers.utils.formatUnits(price, decimals1),
                size: +ethers.utils.formatUnits(swaps.amount0In, decimals0),
                side: TradeSide.Sell,
                timestamp: blockTimestamp
            };
    
            result.push(entry);
        }

        // are we "buying" the first asset in the pair?
        if (!swaps.amount1In.eq(0)) {
            const price: ethers.BigNumber = swaps.amount1In.mul(Ten.pow(decimals0)).div(swaps.amount0Out);

            const entry: Trade = {
                dex_name: dex,
                price: +ethers.utils.formatUnits(price, decimals1),
                size: +ethers.utils.formatUnits(swaps.amount0Out, decimals0),
                side: TradeSide.Buy,
                timestamp: blockTimestamp
            };
    
            result.push(entry);
        }
    }

    return result;
}

// parses all trades from (latestBlock - blockAmount) until latestBlock
async function pullAndParse(latestBlock: number, blockAmount: number): Promise<Trade[]> {
    const logsUniswap: ethers.providers.Log[] = (await getPoolLogs("0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852", latestBlock, blockAmount));
    const logsSushiswap = await getPoolLogs("0x06da0fd433c1a5d7a4faa01111c044910a184553", latestBlock, blockAmount);

    return (await parseLogs(18, 6, logsUniswap, Dex.Uniswap))
        .concat(await parseLogs(18, 6, logsSushiswap, Dex.Sushiswap));
}

// prints trades, sorting them by side (selling or buying)
async function printTradesInBlock(latestBlock: number) {
    const trades: Trade[] = await pullAndParse(latestBlock, 1);
    console.log("BUYS");
    console.log(trades.filter((x) => x.side == TradeSide.Buy));
    console.log("SELLS");
    console.log(trades.filter((x) => x.side == TradeSide.Sell));
}

export {
    pullAndParse,
    printTradesInBlock
}