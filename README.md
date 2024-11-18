# Ooga Boga Test

## Disclaimer 

This is my solution to the feeCollection problem outlined in the test. Before i start just note that since this was a take home test I have made some design decisions that i would have not otherwise. 

I created my own price feed over the past couple of days using the Ooga API. I needed histroucal price data in order to derive a condition that the service will use to check whether or not a fee asset is eligible to collect from the rputer and swap into Ooga Rewards for the user. In a production setting i would not do this obviously, use established price APIs or subgraphs. I couldnt find any berachain testnet subgraphs, so this was my alternative. I just wanted to make it known that in prod i would not do this, and if no historical price data was available i would probably create a subgraph for the different Ooga LP entities andtalke the time to index it

## Overview

This service has thre main subRoutines. These are the `PriceUpdater`, `RouterTransfer` and `FeeCollection` routines that come in the form of automated cron jobs that run autonomously on a set schedle. In order to collect fees for some given asset there is a worst case of **four** transactions that have to be made with a minimum of three. Since there is over 150 assets eligible for feeConversion in the OBRouter i have decided to split the collection priocess into two seperate tasks, namely  `RouterTransfer` and `FeeCollection`. I did this because there is too much risk doing the conversion process for so many assets at once for something to go wrong. Therefore, i have delegated an additional job which soley handles transfers from the OBRouter to the FeeCollector on a set and fixed interval. Since the Tramsfer out process doesnt involve swapping there is no risk for market conditions. the only thing that we need to use to halt a transfer routine from running is if the network gas fees are too high. Other than this we can set this job up on a fixed interval to transfer any assets that have a balnce from the OBRouter to the Fee Collectopr

The second and **main** routine is the `FeeCollection` service which is also an automated cron jon. This job runs on longer intervals than the `RouterTransfer` routine and should run maybe once a day to swap all accumulated fee assets for that day  into OOGA and distribut it to a Authorized address. This job has a much more sophisticated straategy that it emplopys to decide whether or not to execute the fee colection process. My strategy is based on a handful of different market analysis formulae for determining price trends is assets. The `FeeCollection` routine will only execute a conversion/distribution process on an asset if one, the current strength of the OOGA price is stronge and two, the current strength of the base asset is weak. this condition ensures that at least we will never be converting and distributing fee assets at bad market times, gaurantueeing and minimising price exposure. Similar to the `RouterTransfer` we also avoid executing the process during periods of high gas fees.

## Fee Collection Strategy
The strategy i devised for determing the condition to be met for executing fee collection/distribution processes on assets uses multiple different indicators on an assets priceData. The indicators that my stategy factors are all different price analysis indicators

1) Moving Average Crossover Strateg
2) Relative Strength Index (RSI) Strateg
3) Trendline Strategy

## 1. **Moving Average Crossover Strategy**
The Moving Average Crossover Strategy involves tracking two moving averages: a **short-term** moving average and a **long-term** moving average. A "crossover" occurs when the short-term moving average crosses above or below the long-term moving average, indicating a change in trend direction.

  $`\text{SMA}_{\text{period}} = \Huge \displaystyle \frac{\sum_{i=1}^{n} \text{price}_i}{n}`$
  
  $`\text{SMA}_{\text{period}} = \Huge \displaystyle \frac{\sum_{i=1}^{m} \text{price}_i}{m}`$

Where:
- $`n`$ is the number of periods in the short-term moving average.
- $`m`$ is the number of periods in the long-term moving average.

## 2. **Relative Strength Index (RSI) Strategy**
The RSI is a momentum oscillator that measures the speed and change of price movements. It oscillates between 0 and 100 and is used to identify overbought or oversold conditions in a market.

$$` \Huge \displaystyle \text{RSI} = 100 - \left( \frac{100}{1 + RS} \right)`$$

Where:
- $`RS = \displaystyle \frac{\text{Average Gain}}{\text{Average Loss}}`$
- **Average Gain** and **Average Loss** are calculated over a specific period (usually 14 periods).

## 4. **Trendline Strategy**
Trendlines are drawn on a chart to indicate the direction of a market's price movement. An uptrend is identified by a series of higher lows, while a downtrend is identified by lower highs. My strategy uses 
linear regression as anothertic to check price data against.

## Combining Stategies
Each time the worker runs it checks if the conditions of the market for an a given asset have been met.  For any point in time if the price of the asset is down whilst the price of OOGA is high, then we can add that tpkken to our swap calldata
it also avoids times when gas Fees are high  or if the smart contract's balance is too low

## Demo 
click the image/video below to play 

[![Watch the video](https://github.com/ChefBingbong/ooga-booga-test/blob/main/assets/images/thumbnail.jpg)](https://www.veed.io/view/4bc6ac5a-7e73-4e2b-a089-6058c61f51d2?panel=share)

or view it here https://www.veed.io/view/4bc6ac5a-7e73-4e2b-a089-6058c61f51d2?panel=share
