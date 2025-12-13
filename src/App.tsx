import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useAccount, useConnect, useReadContract, useBalance } from 'wagmi';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { MintButton } from './components/MintButton';
import { ShareButton } from './components/ShareButton';
import { API_URL, CONTRACT_ADDRESS, COMPUSOPHLETS_ABI } from './wagmi';

// Minimum balance required (0.001 ETH in wei)
const MIN_BALANCE = 1000000000000000n; // 0.001 ETH

type AppState = 
  | 'loading'
  | 'connect'
  | 'low_balance'
  | 'generating'
  | 'ready_to_create'
  | 'created'
  | 'viewing';

function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pfpUrl, setPfpUrl] = useState<string | null>(null);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  
  // Check user's ETH balance
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: address,
    query: {
      enabled: !!address,
    },
  });

  // Check if user has already created a compusophlet
  const { data: userTokenId, refetch: refetchUserToken } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: COMPUSOPHLETS_ABI,
    functionName: 'creatorTokenId',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!CONTRACT_ADDRESS,
    },
  });

  // Get token URI for viewing
  const { data: tokenUri } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: COMPUSOPHLETS_ABI,
    functionName: 'uri',
    args: tokenId ? [BigInt(tokenId)] : undefined,
    query: {
      enabled: !!tokenId && !!CONTRACT_ADDRESS,
    },
  });

  // Check URL params for ?token=X
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      const tid = parseInt(tokenParam, 10);
      if (!isNaN(tid) && tid > 0) {
        setTokenId(tid);
        setAppState('viewing');
      }
    }
  }, []);

  // Initialize Farcaster SDK
  useEffect(() => {
    const initSdk = async () => {
      try {
        await sdk.actions.ready();
        const ctx = await sdk.context;
        
        if (ctx?.user?.pfpUrl) {
          setPfpUrl(ctx.user.pfpUrl);
        }
        
        // Auto-connect wallet
        if (!isConnected) {
          connect({ connector: farcasterMiniApp() });
        }
      } catch (error) {
        console.log("SDK not available:", error);
      }
      
      // If we're not viewing a specific token, check wallet state
      if (appState === 'loading' && !tokenId) {
        setAppState('connect');
      }
    };
    
    initSdk();
  }, []);

  // Handle wallet connection and check for existing creation
  useEffect(() => {
    if (!isConnected || !address) return;
    if (appState === 'viewing') return; // Don't interrupt viewing
    
    // Don't re-run once we've moved past initial states
    if (appState === 'generating' || appState === 'ready_to_create' || appState === 'created') return;
    
    // Wait for balance to load before doing anything
    if (isBalanceLoading || balance === undefined) return;

    const checkExistingCreation = async () => {
      // Check balance first - require at least 0.001 ETH
      if (balance.value < MIN_BALANCE) {
        setAppState('low_balance');
        return;
      }

      if (userTokenId && userTokenId > 0n) {
        // User has already created - show their compusophlet
        setTokenId(Number(userTokenId));
        setAppState('created');
        // Load their artwork from IPFS
        await loadTokenImage();
      } else if (pfpUrl) {
        // User hasn't created - generate artwork
        setAppState('generating');
        await generateArtwork(pfpUrl);
      } else {
        setAppState('connect');
      }
    };

    checkExistingCreation();
  }, [isConnected, address, userTokenId, pfpUrl, balance, isBalanceLoading, appState]);

  // Load token image from IPFS when viewing or when user has already created
  useEffect(() => {
    if (tokenUri && (appState === 'viewing' || appState === 'created')) {
      loadImageFromUri(tokenUri);
    }
  }, [tokenUri, appState]);

  const loadTokenImage = async () => {
    try {
      // Fetch token URI from contract, then load image
      if (tokenUri) {
        await loadImageFromUri(tokenUri);
      }
    } catch (err) {
      console.error('Failed to load token image:', err);
    }
  };

  const loadImageFromUri = async (uri: string) => {
    try {
      // Convert ipfs:// to gateway URL
      const httpUri = uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
      const response = await fetch(httpUri);
      const metadata = await response.json();
      
      if (metadata.image) {
        const imageUrl = metadata.image.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        setImageSrc(imageUrl);
      }
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  const generateArtwork = async (url: string) => {
    try {
      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pfp_url: url,
          remove_background: true,
          size: 1024,
        }),
      });

      const data = await response.json();

      if (data.success && data.image_base64) {
        setImageSrc(data.image_base64);
        setAppState('ready_to_create');
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (err) {
      console.error('Generation failed:', err);
      setErrorMsg(`Failed to generate: ${err}`);
      setAppState('connect');
    }
  };

  const handleMintSuccess = (tid: number) => {
    setTokenId(tid);
    setAppState('created');
    refetchUserToken();
  };

  const handleConnect = () => {
    connect({ connector: farcasterMiniApp() });
  };

  // Render loading state
  if (appState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-black">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  // Render connect state
  if (appState === 'connect' && !isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-white">
        <p className="text-slate-400 mb-6">connect your wallet to create your compusophlet</p>
        <button
          onClick={handleConnect}
          className="px-8 py-4 bg-white text-black rounded-xl font-semibold text-lg hover:bg-slate-200 transition-all"
        >
          connect
        </button>
      </div>
    );
  }

  // Render low balance state
  if (appState === 'low_balance') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-white px-8">
        <p className="text-slate-400 text-center">
          you need at least 0.001 eth to use compusophlets
        </p>
      </div>
    );
  }

  // Render generating state
  if (appState === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-white">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="text-slate-400">creating your compusophlet...</p>
      </div>
    );
  }

  // Main render with image and CTAs
  const isViewing = appState === 'viewing';
  const isCreated = appState === 'created';
  const isReadyToCreate = appState === 'ready_to_create';

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white">
      {/* Main Content - Centered Image */}
      <main className="flex-1 flex items-center justify-center p-4 pb-28">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="compusophlet"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        ) : (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-slate-400 text-sm">loading artwork...</p>
          </div>
        )}
      </main>

      {/* Sticky CTA Footer */}
      {imageSrc && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent">
          <div className="flex flex-col items-center gap-3">
            {isReadyToCreate && (
              <MintButton
                imageBase64={imageSrc}
                tokenId={0}
                onMintSuccess={handleMintSuccess}
                isCollecting={true}
              />
            )}

            {isViewing && tokenId && (
              <MintButton
                imageBase64={imageSrc}
                tokenId={tokenId}
                onMintSuccess={() => {}}
                isCollecting={true}
              />
            )}

            {isCreated && tokenId && (
              <>
                <MintButton
                  imageBase64={imageSrc}
                  tokenId={tokenId}
                  onMintSuccess={() => {}}
                  isCollecting={true}
                />
                <ShareButton tokenId={tokenId} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {errorMsg && (
        <div className="fixed top-4 left-4 right-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-300 text-sm text-center">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

export default App;
