
const { Contract } = require("@ethersproject/contracts");
const hre = require("hardhat");
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const jsonRpcUrl = 'http://localhost:8545';
const ethers = hre.ethers;
const GovAbi = require("../abi/UniswapGovernorBravoDelegate.json");
const UniswapTokenAbi = require("../abi/UniswapToken.json");
const FactoryAbi = require("../abi/factory.json");

// Set up localhost fork with Hardhat
(async function () {
    console.log(`\nRunning a hardhat localhost fork of mainnet at ${jsonRpcUrl}\n`);
  
    const jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: 'localhost',
      port: 8545,
      provider: hre.network.provider,
    });
  
    await jsonRpcServer.listen();  
  })().catch(console.error)

  async function main() {
    const accountToInpersonate = "0x9B68c14e936104e9a7a24c712BEecdc220002984"
  
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [accountToInpersonate],
    });
    const signer = await ethers.getSigner(accountToInpersonate)
  
    const goveranceContract = new ethers.Contract("0x408ED6354d4973f66138C91495F2f2FCbd8724C3", GovAbi, signer)
    const UniswapToken = new ethers.Contract("0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", UniswapTokenAbi, signer)
    const factoryContract = new ethers.Contract("0x1F98431c8aD98523631AE4a59f267346ea31F984", FactoryAbi, signer)
    const accountVotes = await UniswapToken.getCurrentVotes(accountToInpersonate)
    console.log("account votes", accountVotes / 1e18)  
    let currentProposalCount = await goveranceContract.proposalCount();
    console.log("current number of proposals created: "+currentProposalCount);
    let fiveCheck = await factoryContract.feeAmountTickSpacing(500);
    console.log(fiveCheck);
    let oneCheck = await factoryContract.feeAmountTickSpacing(100);
    console.log(oneCheck);

    await goveranceContract.propose(["0x1F98431c8aD98523631AE4a59f267346ea31F984"],[0],["enableFeeAmount(uint24,int24)"],["0x00000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000001"],"hello");
    currentProposalCount = await goveranceContract.proposalCount();
    console.log("current number of proposals created: "+currentProposalCount);
    let proposalInfo = await goveranceContract.proposals(9);
    console.log(proposalInfo.length);

    async function advanceBlockHeight(blocks) {
        const txns = [];
        for (let i = 0; i < blocks; i++) {
          txns.push(hre.network.provider.send('evm_mine'));
        }
        await Promise.all(txns);
      }
      
    await advanceBlockHeight(13141); // fast forward 1000 Ethereum blocks

    await goveranceContract.castVote(9,1)

    let largeVoters = [
        "0x2b1ad6184a6b0fac06bd225ed37c2abc04415ff4",
        "0xe02457a1459b6c49469bf658d4fe345c636326bf",
        "0x8e4ed221fa034245f14205f781e0b13c5bd6a42e",
        "0x61c8d4e4be6477bb49791540ff297ef30eaa01c2",
        "0xa2bf1b0a7e079767b4701b5a1d9d5700eb42d1d1",
        "0xe7925d190aea9279400cd9a005e33ceb9389cc2b",
        "0x7e4a8391c728fed9069b2962699ab416628b19fa",
    ]

    for (let i = 0; i<largeVoters.length;i++){
        await signer.sendTransaction({to: largeVoters[i],value: ethers.utils.parseEther(".1")})
    }

    for (let i = 0; i<largeVoters.length;i++){
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [largeVoters[i]],
          });
          const signer = await ethers.getSigner(largeVoters[i])
          await goveranceContract.connect(signer).castVote(9,1)
    }

    await advanceBlockHeight(40320); // fast forward 1000 Ethereum blocks

    await goveranceContract.queue(9);
    
    proposalInfo = await goveranceContract.proposals(9);
    console.log(proposalInfo);

    await hre.network.provider.request({
        method: "evm_increaseTime",
        params: [172800],
      });

    await advanceBlockHeight(1)

    await goveranceContract.execute(9);

    proposalInfo = await goveranceContract.proposals(9);
    console.log(proposalInfo);

    fiveCheck = await factoryContract.feeAmountTickSpacing(500);
    console.log(fiveCheck);
    oneCheck = await factoryContract.feeAmountTickSpacing(100);
    console.log(oneCheck);

  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });