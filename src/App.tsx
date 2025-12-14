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
  | 'not_miniapp'
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
  const [sdkReady, setSdkReady] = useState(false);
  const [justCollected, setJustCollected] = useState(false); // Delay before showing share button
  const [imageLoaded, setImageLoaded] = useState(false); // Track if browser has loaded the image

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

  // Check if user has already collected this token
  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: COMPUSOPHLETS_ABI,
    functionName: 'balanceOf',
    args: address && tokenId ? [address, BigInt(tokenId)] : undefined,
    query: {
      enabled: !!address && !!tokenId && !!CONTRACT_ADDRESS,
    },
  });

  const hasAlreadyCollected = userBalance !== undefined && userBalance > 0n;

  // Check URL params for ?token=X (viewing mode)
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

  // Initialize Farcaster SDK - REQUIRED
  useEffect(() => {
    const initSdk = async () => {
      try {
        // Signal ready to Farcaster
        await sdk.actions.ready();
        
        // Get user context
        const ctx = await sdk.context;
        
        if (!ctx?.user?.pfpUrl) {
          // No user context = not in a mini app
          setAppState('not_miniapp');
          return;
        }
        
        setPfpUrl(ctx.user.pfpUrl);
        setSdkReady(true);
        
        // Auto-connect wallet via Farcaster
        if (!isConnected) {
          connect({ connector: farcasterMiniApp() });
        }
      } catch (error) {
        console.error("SDK initialization failed:", error);
        // If viewing a token, allow it even outside mini app
        if (appState !== 'viewing') {
          setAppState('not_miniapp');
        }
      }
    };
    
    initSdk();
  }, []);

  // Handle wallet connection and check for existing creation
  useEffect(() => {
    if (!sdkReady) return;
    if (!isConnected || !address) return;
    if (appState === 'viewing') return;
    if (appState === 'generating' || appState === 'ready_to_create' || appState === 'created') return;
    if (isBalanceLoading || balance === undefined) return;

    const checkExistingCreation = async () => {
      // Check balance first
      if (balance.value < MIN_BALANCE) {
        setAppState('low_balance');
        return;
      }

      if (userTokenId && userTokenId > 0n) {
        // User has already created - show their compusophlet
        setTokenId(Number(userTokenId));
        setAppState('created');
      } else if (pfpUrl) {
        // User hasn't created - generate artwork
        setAppState('generating');
        await generateArtwork(pfpUrl);
      }
    };

    checkExistingCreation();
  }, [sdkReady, isConnected, address, userTokenId, pfpUrl, balance, isBalanceLoading, appState]);

  // Load token image from IPFS when viewing or when user has already created
  useEffect(() => {
    if (tokenUri && (appState === 'viewing' || appState === 'created')) {
      loadImageFromUri(tokenUri);
    }
  }, [tokenUri, appState]);

  const loadImageFromUri = async (uri: string) => {
    try {
      setImageLoaded(false); // Reset while loading new image
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
    }
  };

  const handleMintSuccess = async (tid: number) => {
    // DON'T change appState yet - let MintButton show its success animation
    
    // Refetch to get actual token ID in background
    const { data: actualTokenId } = await refetchUserToken();
    const finalTokenId = actualTokenId ? Number(actualTokenId) : tid;
    setTokenId(finalTokenId);
    
    // Wait for MintButton's 4 second success animation, THEN transition
    setTimeout(async () => {
      await refetchBalance();
      setAppState('created');
      // hasAlreadyCollected will be true, so ShareButton shows immediately
    }, 4000);
  };

  // Handle collect success (for viewing/collecting others' tokens)
  const handleCollectSuccess = () => {
    setJustCollected(true);
    setTimeout(async () => {
      await refetchBalance();
      setJustCollected(false);
    }, 4000);
  };

  // Render loading state
  if (appState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-black">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  // Render not in mini app state
  if (appState === 'not_miniapp') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-white px-8">
        <p className="text-slate-400 text-center text-lg">
          open this app in farcaster
        </p>
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
        {/* Show loader until image is actually loaded in browser */}
        {(!imageSrc || (!imageLoaded && !imageSrc.startsWith('data:'))) && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-slate-400 text-sm">loading artwork...</p>
          </div>
        )}
        {imageSrc && (
          <img
            src={imageSrc}
            alt="compusophlet"
            className={`max-w-full max-h-full object-contain rounded-lg ${
              !imageLoaded && !imageSrc.startsWith('data:') ? 'hidden' : ''
            }`}
            onLoad={() => setImageLoaded(true)}
          />
        )}
      </main>

      {/* Sticky CTA Footer - Single button: collect OR share */}
      {imageSrc && (imageLoaded || imageSrc.startsWith('data:')) && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent">
          <div className="flex flex-col items-center gap-3">
            {isReadyToCreate && (
              <MintButton
                imageBase64={imageSrc}
                tokenId={0}
                onMintSuccess={handleMintSuccess}
                isCollecting={false}
              />
            )}

            {isViewing && tokenId && (
              justCollected ? (
                <div className="flex flex-col items-center space-y-2" style={{ width: '61.803%' }}>
                  <button
                    disabled
                    className="w-full flex items-center justify-center py-4 rounded-xl font-semibold text-lg bg-green-600 text-white cursor-default"
                  >
                    collected!
                  </button>
                </div>
              ) : hasAlreadyCollected ? (
                <ShareButton tokenId={tokenId} imageUrl={imageSrc} />
              ) : (
                <MintButton
                  imageBase64={imageSrc}
                  tokenId={tokenId}
                  onMintSuccess={handleCollectSuccess}
                  isCollecting={true}
                />
              )
            )}

            {isCreated && tokenId && (
              <ShareButton tokenId={tokenId} imageUrl={imageSrc} />
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
