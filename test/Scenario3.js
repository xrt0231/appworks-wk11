const { ethers } = require("hardhat");
const parseUnits = require("ethers/lib/utils");
const hre = require("hardhat");
const { expect } = require("chai");
const { loadFixture, impersonateAccount } = require("@nomicfoundation/hardhat-network-helpers");

describe("A simple Compound code", function() {

    require('dotenv').config();
    console.log(process.env);

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

        // comptroller._supportMarket(cerc20.address);
        // comptroller._supportMarket(cerc20b.address);

        //Set interest%
        const InterestRateModel = await ethers.getContractFactory("WhitePaperInterestRateModel")
        const interestRateModel = await InterestRateModel.deploy(ethers.utils.parseUnits("0", 18), ethers.utils.parseUnits("0", 18),);
        console.log('set interest rate!');

        //Check usdc 
        const usdc = await ethers.getContractAt("Erc20", USDC_ADDRESS);

        //Check uni
        const uni = await ethers.getContractAt("Erc20", UNI_ADDRESS);
        
        //Create CUSDC
        const accounts = await ethers.getImpersonatedSigner();
        const Cerc20 = await ethers.getContractFactory("CErc20Immutable");
        const cUsdc = await Cerc20.deploy(
            usdc.address,
            comptroller.address,
            interestRateModel.address,
            ethers.utils.parseUnits("1", 6),
            "CUSDC",
            "cUsdc",
            18,
            accounts[0].address
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
            accounts[0].address
        );
        cUni.deployed();
        console.log('CUNI created!');    


        //Set oracle
        const Oracle = await ethers.getContractFactory("SimplePriceOracle");
        const oracle = await Oracle.deploy();
        oracle.deployed();
        await oracle.setUnderlyingPrice(cUsdc.address, USDC_PRICE);
        await oracle.setUnderlyingPrice(cUni.address, UNI_PRICE);
        console.log('Set oracle!');
        // comptroller._setPriceOracle(oracle.address);


        //Set comptroller
        const Comptroller = await ethers.getContractFactory("Comptroller");
        const comptroller = await Comptroller.deploy();
        await comptroller.deployed();
        comptroller._setPriceOracle("SimplePriceOracle");
        await comptroller._supportMarket(cUsdc.address);
        await comptroller._supportMarket(cUni.address);
        await comptroller.enterMarkets([cUni.address]);
        await comptroller._setCollateralFactor(cUni.address, UNI_COLLATERAL_FACTOR);
        await comptroller._setCloseFactor(CLOSE_FACTOR);
        await comptroller._setLiquidationIncentive(LIQUIDATION_INCENTIVE);
        console.log('Set comptroller!');

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
        
        
    } 
   
    it("shold support 100 erc20 token to Cerc20 token and to redeem cerc20 token to erc20 token", async function () {
        const { 
            owner,
            erc20,
            cerc20,
            comptroller,
            accounts
        } = await loadFixture(deployErc20InterestRateCtokenOracleFixture);

        const mintAmount = ethers.utils.parseUnits("100", 18);
        await erc20.approve(cerc20.address, mintAmount);
        await comptroller._supportMarket(cerc20.address);
        await cerc20.mint(mintAmount); 
        
        expect(await cerc20.balanceOf(owner.address)).to.equal(ethers.utils.parseUnits("100", 18));

        await comptroller._supportMarket(cerc20.address);
        await cerc20.redeem(mintAmount);

        expect(await erc20.balanceOf(erc20.address)).to.equal(0);
    });

    it("should set tokens price and send token to users & user1 mint cerc20b by 1 erc20b & let user2 to liquidate user1 by adjusting the collatral factor from 0.5 to 0.2 of erc20b", 
    
    async function() {
        const {
            owner,
            user1,
            user2,
            erc20, 
            erc20b, 
            interestRateModel, 
            comptroller, 
            cerc20, 
            cerc20b, 
            accounts,
            oracle
        } = await loadFixture(deployErc20InterestRateCtokenOracleFixture);

        //Set cerc20 token price to 1 & set cerc20b price to 100
        const cerc20PriceSetting = await oracle.setUnderlyingPrice(cerc20.address, ethers.utils.parseUnits("1", 18));
        const cerc20bPriceSetting = await oracle.setUnderlyingPrice(cerc20b.address, ethers.utils.parseUnits("100", 18));

        //Set cerc20b collateral %
        const cerc20bCollaterallRateSetting = await comptroller._setCollateralFactor(cerc20b.address, ethers.utils.parseUnits("0.5", 18));

        //Send erc20b to user1
        await erc20b.transfer(user1.address, ethers.utils.parseUnits("1", 18));

        //Send erc20 to user2
        await erc20.transfer(user2.address, ethers.utils.parseUnits("100", 18));
        
        expect(await erc20b.balanceOf(user1.address)).to.equal(ethers.utils.parseUnits("1", 18));
        expect(await erc20.balanceOf(user2.address)).to.equal(ethers.utils.parseUnits("100", 18));
       
        await erc20b.connect(user1).approve(cerc20b.address, ethers.utils.parseUnits("1", 18));
        await erc20.connect(user2).approve(cerc20.address, ethers.utils.parseUnits("100", 18));
       
        const mintCerc20byOneErc20 = await cerc20b.connect(user1).mint(ethers.utils.parseUnits("1", 18));
        await cerc20.connect(user2).mint(ethers.utils.parseUnits("100", 18));

        console.log("scenario preparation done!");
       
        //user1 use cerc20b as collateral
        await comptroller.connect(user1).enterMarkets([cerc20b.address]);
        
        //User1 borrow 50 x cerc20 by erc20b as collateral
        const borrow = await cerc20.connect(user1).borrow(ethers.utils.parseUnits("50", 18));
        expect(await cerc20.getCash()).to.equal(ethers.utils.parseUnits("50", 18));
        //=========================================================================

        //change the token price
        await oracle.setUnderlyingPrice(cerc20b.address, ethers.utils.parseUnits("30", 18));

        //Incentive plan
        await comptroller._setLiquidationIncentive(ethers.utils.parseUnits("1", 18));
        
        //Set % of available liquidation
        await comptroller._setCloseFactor(ethers.utils.parseUnits("0.5", 18));
        
        await erc20.transfer(user2.address, ethers.utils.parseUnits("20", 18));
        
        await erc20.connect(user2).approve(cerc20.address, ethers.utils.parseUnits("20", 18));
        
        //Liquidation scenario with changing the token price
        console.log("scenario starts!");
        const liquidateScenario = await cerc20.connect(user2).liquidateBorrow(user1.address, ethers.utils.parseUnits("20", 18), cerc20b.address);
    });
});