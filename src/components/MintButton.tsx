import { useState } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { Sparkles, Loader2, Check, AlertCircle } from 'lucide-react';
import { GENERATIVE_PFP_ABI, API_URL, CONTRACT_ADDRESS, CHAIN_ID } from '../wagmi';

interface MintButtonProps {
  imageBase64: string;
  fid: number;
  onMintSuccess?: (tokenId: number) => void;
}

type MintState = 'idle' | 'preparing' | 'signing' | 'confirming' | 'success' | 'error';

export function MintButton({ imageBase64, fid, onMintSuccess }: MintButtonProps) {
  const { address, isConnected } = useAccount();
  const [mintState, setMintState] = useState<MintState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  // Read user's nonce from contract
  const { data: nonce } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: GENERATIVE_PFP_ABI,
    functionName: 'nonces',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!CONTRACT_ADDRESS,
    },
  });

  // Write contract hook
  const { writeContract, isPending: isWritePending } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  const handleMint = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!CONTRACT_ADDRESS) {
      setError('Contract not deployed yet');
      return;
    }

    setMintState('preparing');
    setError(null);

    try {
      // Step 1: Prepare mint (upload to IPFS + get signature)
      console.log('Preparing mint...');
      const prepareResponse = await fetch(`${API_URL}/api/mint/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          fid: fid,
          creator_address: address,
          nonce: Number(nonce ?? 0),
        }),
      });

      const prepareData = await prepareResponse.json();
      console.log('Prepare response:', prepareData);

      if (!prepareData.success) {
        throw new Error(prepareData.error || 'Failed to prepare mint');
      }

      // Step 2: Submit transaction
      setMintState('signing');
      console.log('Submitting mint transaction...');

      writeContract(
        {
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: GENERATIVE_PFP_ABI,
          functionName: 'mintWithSignature',
          args: [
            BigInt(prepareData.token_id),
            prepareData.metadata_uri,
            BigInt(1), // amount
            BigInt(fid),
            BigInt(prepareData.deadline),
            prepareData.signature as `0x${string}`,
          ],
          chainId: CHAIN_ID,
        },
        {
          onSuccess: (hash) => {
            console.log('Transaction submitted:', hash);
            setTxHash(hash);
            setMintState('confirming');
          },
          onError: (err) => {
            console.error('Transaction error:', err);
            setError(err.message || 'Transaction failed');
            setMintState('error');
          },
        }
      );
    } catch (err) {
      console.error('Mint error:', err);
      setError(err instanceof Error ? err.message : 'Mint failed');
      setMintState('error');
    }
  };

  // Update state when transaction confirms
  if (isSuccess && mintState === 'confirming') {
    setMintState('success');
    onMintSuccess?.(1); // Token ID would come from event
  }

  if (!isConnected) {
    return null;
  }

  const getButtonContent = () => {
    switch (mintState) {
      case 'preparing':
        return (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Uploading to IPFS...</span>
          </>
        );
      case 'signing':
        return (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Sign in wallet...</span>
          </>
        );
      case 'confirming':
        return (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Confirming...</span>
          </>
        );
      case 'success':
        return (
          <>
            <Check className="w-5 h-5" />
            <span>Minted!</span>
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="w-5 h-5" />
            <span>Retry Mint</span>
          </>
        );
      default:
        return (
          <>
            <Sparkles className="w-5 h-5" />
            <span>Mint as NFT</span>
          </>
        );
    }
  };

  const isDisabled = mintState === 'preparing' || mintState === 'signing' || mintState === 'confirming' || isWritePending || isConfirming;
  const isSuccessState = mintState === 'success';

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={handleMint}
        disabled={isDisabled || isSuccessState}
        className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
          isSuccessState
            ? 'bg-green-600 text-white cursor-default'
            : isDisabled
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
      >
        {getButtonContent()}
      </button>
      
      {error && (
        <p className="text-red-400 text-xs text-center max-w-xs">{error}</p>
      )}
      
      {txHash && (
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 text-xs hover:underline"
        >
          View on Basescan
        </a>
      )}
    </div>
  );
}
