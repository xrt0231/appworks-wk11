# This is a Compound Protocol practice 

Please do the steps before start to test it:

```shell
git clone https://github.com/compound-finance/compound-protocol
git clone https://github.com/aave/protocol-v2.git
```

Please run scenario 1 for liquidation by changing collateral rate 

```shell
npx hardhat test ./test/Scenario1.js
```

Please run scenario 2 for liquidation by changing token price 

```shell
npx hardhat test ./test/Scenario2.js
```
Please run scenario 3 for liquidation by using flash loan 

```shell
npx hardhat test ./test/Scenario3.js
```


