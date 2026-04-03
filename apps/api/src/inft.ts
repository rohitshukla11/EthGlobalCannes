import { Contract, Wallet, JsonRpcProvider, ethers } from "ethers";
import { assertINFT, config } from "./config.js";

const ABI = [
  "function mintAgent(address to, string tokenURI_, bytes32 configRoot, string dataDescription) returns (uint256)",
  "function appendIntelligentData(uint256 tokenId, bytes32 dataHash, string dataDescription)",
  "function intelligentDataOf(uint256 tokenId) view returns (tuple(string dataDescription, bytes32 dataHash)[])",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
];

function contract(signer: Wallet) {
  return new Contract(config.inftAddress, ABI, signer);
}

export async function mintAgentINFT(
  owner: string,
  tokenUri: string,
  configRootHex: string,
  dataDescription: string
): Promise<number> {
  assertINFT();
  const provider = new JsonRpcProvider(config.zgRpc);
  const signer = new Wallet(config.inftOwnerPrivateKey, provider);
  const c = contract(signer);
  const root = ethers.zeroPadValue(configRootHex, 32);
  const tx = await c.mintAgent(owner, tokenUri, root, dataDescription);
  const receipt = await tx.wait();
  const transferIface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  ]);
  let tokenId: bigint | undefined;
  const ca = config.inftAddress.toLowerCase();
  for (const log of receipt?.logs ?? []) {
    if (log.address.toLowerCase() !== ca) continue;
    try {
      const ev = transferIface.parseLog(log);
      if (ev?.name === "Transfer" && ev.args.from === ethers.ZeroAddress) {
        tokenId = ev.args.tokenId as bigint;
        break;
      }
    } catch {
      /* skip */
    }
  }
  if (tokenId === undefined) throw new Error("Could not parse tokenId from mint receipt");
  return Number(tokenId);
}

export async function appendIntelligentDataOnChain(tokenId: number, rootHex: string, description: string) {
  assertINFT();
  const provider = new JsonRpcProvider(config.zgRpc);
  const signer = new Wallet(config.inftOwnerPrivateKey, provider);
  const c = contract(signer);
  const root = ethers.zeroPadValue(rootHex, 32);
  const tx = await c.appendIntelligentData(tokenId, root, description);
  await tx.wait();
}

export async function transferINFT(fromPk: string, to: string, tokenId: number) {
  assertINFT();
  const provider = new JsonRpcProvider(config.zgRpc);
  const signer = new Wallet(fromPk, provider);
  const c = contract(signer);
  const tx = await c.safeTransferFrom(await signer.getAddress(), to, tokenId);
  await tx.wait();
}
