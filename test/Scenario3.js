const { ethers } = require("hardhat");
const { parseUnits } = require("ethers/lib/utils");
const hre = require("hardhat");
const { expect } = require("chai");
const { loadFixture, impersonateAccount } = require("@nomicfoundation/hardhat-network-helpers");

describe("Flash loan process: liquidate, flashloan, uniswap ", function() {

    require('dotenv').config();

    const BINANCE_WALLET_ADDRESS = '0xF977814e90dA44bFA03b6295A0616a897441aceC';
    const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const UNI_ADDRESS = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
    const USDC_PRICE = parseUnits('1', 18 + (18 - 6));; //due to USDC has 6 decimals 
    const UNI_PRICE = parseUnits('10', 18);
    const UNI_COLLATERAL_FACTOR = parseUnits('0.5', 18);
    const LIQUIDATION_INCENTIVE = parseUnits('1.08', 18);
    const AVVE_LENDING_POOL_ADDRESSES_PROVIDER = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";
    const UNI_SWAP_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
    const USDC_AMOUNT = parseUnits('5000', 6);
    const UNI_AMOUNT = parseUnits('1000', 18);
    const CLOSE_FACTOR = parseUnits("0.5", 18);
    


    async function deployFixture(){

        //fork Fork Ethereum mainnet at block 15815693 with reset enabled

        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: `${process.env.URL}`,
                        blockNumber: 15815693,
                    },
                },
            ],
        });

        //Set diff wallet addresses
        const [ owner, user1, user2 ] = await ethers.getSigners();
        console.log(owner.address);

        //Set comptroller for init
        const Comptroller = await ethers.getContractFactory("Comptroller");
        const comptroller = await Comptroller.deploy();
        await comptroller.deployed();
        console.log('Set comptroller!');

        //Set oracle for init
        const Oracle = await ethers.getContractFactory("SimplePriceOracle");
        const oracle = await Oracle.deploy();
        oracle.deployed();
        console.log('Set oracle!');

        //Set interest%
        const InterestRateModel = await ethers.getContractFactory("WhitePaperInterestRateModel")
        const interestRateModel = await InterestRateModel.deploy(ethers.utils.parseUnits("0", 18), ethers.utils.parseUnits("0", 18),);
        console.log('set interest rate!');

        //Check usdc 
        const usdc = await ethers.getContractAt("Erc20", USDC_ADDRESS);

        //Check uni
        const uni = await ethers.getContractAt("Erc20", UNI_ADDRESS);


        //Create CUSDC
        const Cerc20 = await ethers.getContractFactory("CErc20Immutable");
        const cUsdc = await Cerc20.deploy(
            usdc.address,
            comptroller.address,
            interestRateModel.address,
            ethers.utils.parseUnits("1", 6),
            "CUSDC",
            "cUsdc",
            18,
            owner.address
        );
        await cUsdc.deployed();
        console.log('CUSDC created!');

        //Create CUNI
        const cUni = await Cerc20.deploy(
            uni.address,
            comptroller.address,
            interestRateModel.address,
            ethers.utils.parseUnits("1", 18),
            "CUNI",
            "cUni",
            18,
            owner.address
        );
        cUni.deployed();
        console.log('CUNI created!');    

        //Set comptroller more
        comptroller._setPriceOracle(oracle.address);
        await comptroller._supportMarket(cUsdc.address);
        await comptroller._supportMarket(cUni.address);
        await comptroller.enterMarkets([cUni.address]);
        await comptroller._setCollateralFactor(cUni.address, UNI_COLLATERAL_FACTOR);
        await comptroller._setCloseFactor(CLOSE_FACTOR);
        await comptroller._setLiquidationIncentive(LIQUIDATION_INCENTIVE);
        console.log('Set comptroller more!');

        //Set oracle more
        await oracle.setUnderlyingPrice(cUsdc.address, USDC_PRICE);
        await oracle.setUnderlyingPrice(cUni.address, UNI_PRICE);
        console.log('Set oracle more!');

        return { owner, user1, user2, usdc, cUsdc, uni, cUni, comptroller, oracle };
    }

    async function impersonateFixture() {
        const { owner, user1, user2, usdc, cUsdc, uni, cUni, comptroller, oracle } = await loadFixture(deployFixture);

        await impersonateAccount(BINANCE_WALLET_ADDRESS);
        const binanceWalletImpersonate = await ethers.getSigner(BINANCE_WALLET_ADDRESS);
        
        usdc.connect(binanceWalletImpersonate).transfer(user1.address, USDC_AMOUNT);
        uni.connect(binanceWalletImpersonate).transfer(user2.address, UNI_AMOUNT);

        expect(await usdc.balanceOf(user1.address).to.eq(USDC_AMOUNT));
        expect(await uni.balanceOf(owner.address).to.eq(UNI_AMOUNT));

        return {owner, user1, user2, usdc, cUsdc, uni, cUni, comptroller, oracle, binanceWalletImpersonate };
    }

     //User1 uses 1000 x UNI as collateral
     //to borrow 5000 x USDC
    async function borrowUSDCFixture() {
        const { owner, user1, user2, usdc, cUsdc, uni, cUni, comptroller, oracle, binanceWalletImpersonate } = await loadFixture(impersonateFixture);
        
        //User1 supply 5000 USDC
        await usdc.connect(user1).approve(cUsdc.address, USDC_AMOUNT);
        await cUsdc.connect(user1).mint(USDC_AMOUNT);

        //Owner address supply 1000 UNI as collateral and borrow 5000 USDC
        await uni.approve(cUni.address, UNI_AMOUNT);
        await cUni.mint(UNI_AMOUNT);

        await cUsdc.borrow(USDC_AMOUNT);

        return { owner, user1, user2, usdc, cUsdc, uni, cUni, comptroller, oracle};
    } 
   
    it("shold do flash loan:", async function () {
        const { 
            owner, user1, user2, usdc, cUsdc, uni, cUni, comptroller, oracle } = await loadFixture(deployFixture);
        
    });

});