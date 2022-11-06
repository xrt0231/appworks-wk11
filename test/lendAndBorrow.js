const { ethers } = require("hardhat");
const hre = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("A simple Compound code", function() {

    async function deployErc20InterestRateCtokenOracleFixture(){
        //ERC20 mint
        const Erc20 = await hre.ethers.getContractFactory("Erc20");
        const erc20 = await Erc20.deploy(
            ethers.utils.parseUnits("1000", 18),
            "ERC20 Token",
            "EC20TK"
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

        return { erc20, interestRateModel, comptroller, cerc20, accounts };

    }
   
    it("shold support 100 erc20 token to Cerc20 token and to redeem cerc20 token to erc20 token", async function () {
        const { 
            erc20,
            cerc20,
            comptroller,
            accounts
        } = await loadFixture(deployErc20InterestRateCtokenOracleFixture);

        const mintAmount = ethers.utils.parseUnits("100", 18);
        await erc20.approve(cerc20.address, mintAmount);
        await comptroller._supportMarket(cerc20.address);
        await cerc20.mint(mintAmount); 
        
        expect(await cerc20.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseUnits("100", 18));

        await comptroller._supportMarket(cerc20.address);
        await cerc20.redeem(mintAmount);

        expect(await erc20.balanceOf(erc20.address)).to.equal(0);
    });
       
    it("should read the value", async function () {
        const {
            erc20,
            accounts
        } = await loadFixture(deployErc20InterestRateCtokenOracleFixture);

        await expect(await erc20.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseUnits("1000", 18));
        //console.log("the address: ", erc20.address);
    });
});