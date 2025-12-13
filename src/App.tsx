import { useState, useEffect } from 'react';
import { AlertCircle, Hash, Code2, Loader2 } from 'lucide-react';
import { sdk } from '@farcaster/miniapp-sdk';
import { WalletButton } from './components/WalletButton';
import { MintButton } from './components/MintButton';
import { ShareButton } from './components/ShareButton';
import { API_URL } from './wagmi';

// Detect mobile device
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || window.innerWidth < 768;
};

function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pfpFound, setPfpFound] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("Initializing...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [context, setContext] = useState<any>(null);
  const [fid, setFid] = useState<number | null>(null);
  const [devMode, setDevMode] = useState<boolean>(false);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);

  // Initialize Farcaster SDK
  useEffect(() => {
    const initSdk = async () => {
      try {
        console.log("Attempting SDK initialization...");
        setStatusMsg("Connecting to Farcaster...");
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("SDK timeout")), 3000)
        );
        
        const readyPromise = sdk.actions.ready();
        await Promise.race([readyPromise, timeoutPromise]);
        console.log("SDK Ready called - splash hidden");
        setStatusMsg("Getting context...");
        
        const ctx = await sdk.context;
        console.log("SDK Context received:", ctx);
        setContext(ctx);
        
        if (ctx?.user?.fid) {
          console.log("Found FID:", ctx.user.fid);
          setFid(ctx.user.fid);
          setStatusMsg(`FID: ${ctx.user.fid}`);
        } else {
          console.warn("No FID found - enabling dev mode");
          setStatusMsg("No user context - Dev Mode");
          setDevMode(true);
        }
      } catch (error) {
        console.log("SDK not available, enabling Dev Mode:", error);
        setStatusMsg("Dev Mode - Upload an image to test");
        setDevMode(true);
      }
    };
    
    initSdk();
  }, []);

  // Generate artwork via API
  const generateArtwork = async (pfpUrl: string, userFid?: number) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setStatusMsg("Generating artwork...");
    console.log("Calling API with:", pfpUrl);

    try {
      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pfp_url: pfpUrl,
          fid: userFid,
          remove_background: true,
          size: 1024,
        }),
      });

      const data = await response.json();
      console.log("API response:", data);

      if (data.success && data.image_base64) {
        setImageSrc(data.image_base64);
        setPfpFound(true);
        setStatusMsg("Artwork generated!");
      } else {
        throw new Error(data.error || "Generation failed");
      }
    } catch (err) {
      console.error("API call failed:", err);
      setErrorMsg(`Error: ${err}`);
      setStatusMsg("Generation failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Process PFP when context is available
  useEffect(() => {
    if (context?.user?.pfpUrl && !pfpFound && !devMode) {
      const pfpUrl = context.user.pfpUrl;
      console.log("Processing PFP from Farcaster:", pfpUrl);
      generateArtwork(pfpUrl, context.user.fid);
    }
  }, [context, pfpFound, devMode]);

  // Dev mode: URL input for testing
  const [testUrl, setTestUrl] = useState<string>("");
  
  const handleTestGenerate = () => {
    if (testUrl) {
      generateArtwork(testUrl);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex-none h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 z-10">
        <div className="flex items-center space-x-2">
          <Code2 className="w-6 h-6 text-blue-400" />
          <h1 className="font-bold text-lg tracking-tight">Generative <span className="text-slate-400 font-normal">PFP</span></h1>
        </div>

        <div className="flex items-center space-x-3">
          {devMode && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
              <span className="text-xs font-medium">DEV</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-red-500/10 text-red-300 border border-red-500/20" title={errorMsg}>
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-medium hidden sm:inline">Error</span>
            </div>
          )}

          {fid && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">
              <Hash className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">FID: {fid}</span>
            </div>
          )}
          
          <WalletButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden bg-black">
        {/* Dev Mode UI */}
        {devMode && !imageSrc && !isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-md space-y-4">
              <p className="text-slate-400 text-sm text-center mb-4">
                Dev Mode: Enter a PFP URL to test
              </p>
              
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="https://example.com/pfp.png"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              
              <button
                onClick={handleTestGenerate}
                disabled={!testUrl}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                Generate Artwork
              </button>
            </div>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
            <p className="mt-4 text-slate-400 text-sm">{statusMsg}</p>
          </div>
        )}

        {/* Status message (when not processing and no image) */}
        {!isProcessing && !imageSrc && !devMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
            <p className="text-slate-400 text-sm">{statusMsg}</p>
          </div>
        )}

        {/* Generated Image */}
        {imageSrc && !isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 overflow-auto">
            <img
              src={imageSrc}
              alt="Generated PFP Art"
              className="max-w-full max-h-[60vh] object-contain rounded-lg mb-6"
            />
            
            {/* Mint & Share Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {!mintedTokenId && fid && (
                <MintButton 
                  imageBase64={imageSrc} 
                  fid={fid}
                  onMintSuccess={(tokenId) => setMintedTokenId(tokenId)}
                />
              )}
              
              {mintedTokenId && (
                <ShareButton tokenId={mintedTokenId} />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Status Bar */}
      <footer className="flex-none h-8 bg-slate-800 border-t border-slate-700 flex items-center justify-between px-4">
        <span className="text-xs text-slate-500">{statusMsg}</span>
        <span className="text-xs text-slate-600">{isMobile() ? '📱 Mobile' : '🖥️ Desktop'}</span>
      </footer>
    </div>
  );
}

export default App;
