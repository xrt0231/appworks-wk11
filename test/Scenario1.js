const { ethers } = require("hardhat");
const hre = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("A simple Compound code", function() {

    async function deployErc20InterestRateCtokenOracleFixture(){
        //Set diff address
        const [ owner, user1, user2 ] = await ethers.getSigners();

        //ERC20 mint
        const Erc20 = await hre.ethers.getContractFactory("Erc20");
        const erc20 = await Erc20.deploy(
            ethers.utils.parseUnits("1000", 18),
            "ERC20 Token",
            "EC20TK"
        );
        const erc20b = await Erc20.deploy(
            ethers.utils.parseUnits("1000", 18),
            "ERC20B Token",
            "EC20TKB"
        );
       
        //Interest% set
        const InterestRateModel = await ethers.getContractFactory("WhitePaperInterestRateModel")
        const interestRateModel = await InterestRateModel.deploy(
            ethers.utils.parseUnits("0", 18),
            ethers.utils.parseUnits("0", 18),
            );
        
        //Comptroller deployment
        const Comptroller = await ethers.getContractFactory("Comptroller");
        const comptroller = await Comptroller.deploy();
        comptroller._setPriceOracle("SimplePriceOracle");
        
        //Cerc20 exchg% setting
        const accounts = await ethers.getSigners();
        const Cerc20 = await ethers.getContractFactory("CErc20Immutable");
        const cerc20 = await Cerc20.deploy(
            erc20.address,
            comptroller.address,
            interestRateModel.address,
            ethers.utils.parseUnits("1", 18),
            "ERC20 Token",
            "EC20TK",
            18,
            accounts[0].address
        );
        cerc20.deployed();

        const cerc20b = await Cerc20.deploy(
            erc20b.address,
            comptroller.address,
            interestRateModel.address,
            ethers.utils.parseUnits("1", 18),
            "ERC20 TokenB",
            "EC20TKB",
            18,
            accounts[0].address
        );
        cerc20b.deployed();

        //Set oracle
        const Oracle = await ethers.getContractFactory("SimplePriceOracle");
        const oracle = await Oracle.deploy();
        oracle.deployed();
        comptroller._setPriceOracle(oracle.address);

        comptroller._supportMarket(cerc20.address);
        comptroller._supportMarket(cerc20b.address);

        return { owner, user1, user2, erc20, erc20b, interestRateModel, comptroller, cerc20, cerc20b, accounts, oracle };

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
        
        //===================================================================================

        //Incentive plan
        await comptroller._setLiquidationIncentive(ethers.utils.parseUnits("1", 18));
        
        //Set % of available liquidation
        await comptroller._setCloseFactor(ethers.utils.parseUnits("0.5", 18));
        
        //Adjust collateral %
        await comptroller._setCollateralFactor(cerc20b.address, ethers.utils.parseUnits("0.2", 18));
        
        await erc20.transfer(user2.address, ethers.utils.parseUnits("20", 18));
        
        await erc20.connect(user2).approve(cerc20.address, ethers.utils.parseUnits("20", 18));
        
        //Liquidation scenario with changing the collateral %
        console.log("scenario starts!");
        const liquidateScenario = await cerc20.connect(user2).liquidateBorrow(user1.address, ethers.utils.parseUnits("20", 18), cerc20b.address);
    });
});