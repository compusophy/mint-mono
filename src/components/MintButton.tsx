import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { COMPUSOPHLETS_ABI, API_URL, CONTRACT_ADDRESS, MINT_FEE, CHAIN_ID } from '../wagmi';

interface MintButtonProps {
  imageBase64: string;
  tokenId?: number; // 0 or undefined for new creation, >0 for collecting
  onMintSuccess?: (tokenId: number) => void;
  isCollecting?: boolean; // True if collecting someone else's
}

type MintState = 'idle' | 'preparing' | 'signing' | 'confirming' | 'success' | 'error';

export function MintButton({ imageBase64, tokenId = 0, onMintSuccess, isCollecting: _isCollecting = false }: MintButtonProps) {
  const { address, isConnected } = useAccount();
  const [mintState, setMintState] = useState<MintState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  // Read user's nonce from contract
  const { refetch: refetchNonce } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: COMPUSOPHLETS_ABI,
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
      // Refetch nonce to ensure it's current
      const { data: currentNonce } = await refetchNonce();
      
      // Step 1: Prepare mint (upload to IPFS if new, get signature)
      console.log('Preparing mint with nonce:', currentNonce);
      const prepareResponse = await fetch(`${API_URL}/api/mint/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          creator_address: address,
          nonce: Number(currentNonce ?? 0),
          token_id: tokenId,
        }),
      });

      const prepareData = await prepareResponse.json();
      console.log('Prepare response:', prepareData);

      if (!prepareData.success) {
        throw new Error(prepareData.error || 'Failed to prepare mint');
      }


      // Step 2: Submit transaction with fee
      setMintState('signing');
      console.log('Submitting mint transaction...');

      writeContract(
        {
          address: CONTRACT_ADDRESS,
          abi: COMPUSOPHLETS_ABI,
          functionName: 'mintWithSignature',
          args: [
            BigInt(prepareData.token_id),
            prepareData.metadata_uri || '',
            BigInt(1), // amount
            BigInt(prepareData.deadline),
            prepareData.signature as `0x${string}`,
          ],
          value: MINT_FEE,
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
            // If user rejected, just reset silently
            if (err.message?.includes('User rejected') || err.message?.includes('rejected') || err.message?.includes('denied')) {
              setMintState('idle');
            } else {
              setError(err.message || 'Transaction failed');
              setMintState('error');
            }
          },
        }
      );
    } catch (err) {
      console.error('Mint error:', err);
      const errMsg = err instanceof Error ? err.message : 'Mint failed';
      // If user rejected, just reset silently
      if (errMsg.includes('User rejected') || errMsg.includes('rejected') || errMsg.includes('denied')) {
        setMintState('idle');
      } else {
        setError(errMsg);
        setMintState('error');
      }
    }
  };

  // Update state when transaction confirms
  useEffect(() => {
    if (isSuccess && mintState === 'confirming') {
      setMintState('success');
      onMintSuccess?.(tokenId || 1);
      // Refetch nonce for next mint
      refetchNonce();
    }
  }, [isSuccess, mintState, onMintSuccess, tokenId, refetchNonce]);

  // Reset to idle after success (fade back to collect button)
  useEffect(() => {
    if (mintState === 'success') {
      const timer = setTimeout(() => {
        setMintState('idle');
        setTxHash(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [mintState]);

  if (!isConnected) {
    return null;
  }

  const getButtonText = () => {
    switch (mintState) {
      case 'preparing':
        return 'preparing...';
      case 'signing':
        return 'sign in wallet...';
      case 'confirming':
        return 'confirming...';
      case 'success':
        return 'collected!';
      case 'error':
        return 'retry';
      default:
        return 'collect';
    }
  };

  const isDisabled = mintState === 'preparing' || mintState === 'signing' || mintState === 'confirming' || isWritePending || isConfirming;
  const isSuccessState = mintState === 'success';

  return (
    <div className="flex flex-col items-center space-y-2" style={{ width: '61.803%' }}>
      <button
        onClick={handleMint}
        disabled={isDisabled}
        className={`w-full flex items-center justify-center py-4 rounded-xl font-semibold text-lg transition-all duration-500 ${
          isSuccessState
            ? 'bg-green-600 text-white cursor-default'
            : isDisabled
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-white text-black hover:bg-slate-200'
        }`}
      >
        {getButtonText()}
      </button>
      
      {error && (
        <p className="text-red-400 text-xs text-center max-w-xs">{error}</p>
      )}
    </div>
  );
}
