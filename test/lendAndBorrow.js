const { ethers } = require("hardhat");
const hre = require("hardhat");

describe("lendAndBorrow", function() {
   
    it("erc20, interestRate, Ctoken and Oralce preparations", async function () {
        const [owner] = await ethers.getSigners();

        //ERC20 mint
        const Erc20 = await hre.ethers.getContractFactory("Erc20");
        const erc20 = await Erc20.deploy(
            ethers.utils.parseUnits("1000", 18),
            "ERC20 Token",
            "EC20TK"
        );
        await erc20.deployed();
        await erc20.totalSupply();
        console.log("1) EC20TK mint has done!")
       
        //Interest% set
        const InterestRateModel = await ethers.getContractFactory("WhitePaperInterestRateModel")
        const interestRateModel = await InterestRateModel.deploy(
            ethers.utils.parseUnits("0", 18),
            ethers.utils.parseUnits("0", 18),
            );
        await interestRateModel.deployed();
        console.log("2) interest% has done!")
        
        //Comptroller deployment
        const Comptroller = await ethers.getContractFactory("Comptroller");
        const comptroller = await Comptroller.deploy();
        await comptroller.deployed();
        comptroller._setPriceOracle("SimplePriceOracle");
        console.log("3) Comptroller has done!");

        
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
        await cerc20.deployed();
        console.log("4) Cerc20 exchg% has set!")

        //Mint 100 CToken as a lender and redeem 100 CToken later on 
        const mintAmount = ethers.utils.parseUnits("100", 18);
        await erc20.approve(cerc20.address, mintAmount); // 允許testCErc20合約地址轉出owner的100個testErc20 token
        await cerc20.mint(mintAmount); // owner開始mint 100 個 testCErc20 token

        // CErc20合約裡應該要收到100個testErc20 token
        // let erc20BalanceOfCErc20Contract = await erc20.balanceOf(
        // cerc20.address
        // );
        //expect(erc20BalanceOfCErc20Contract).to.equal(MINT_AMOUNT);
    })
});