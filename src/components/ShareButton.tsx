import { sdk } from '@farcaster/miniapp-sdk';

interface ShareButtonProps {
  tokenId: number;
}

export function ShareButton({ tokenId }: ShareButtonProps) {
  const shareUrl = `${window.location.origin}/?token=${tokenId}`;

  const handleShare = async () => {
    try {
      const text = `Check out my compusophlet! 🌀✨\n\n${shareUrl}`;
      await sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`);
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  return (
    <div style={{ width: '61.803%' }}>
      <button
        onClick={handleShare}
        className="w-full flex items-center justify-center py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-lg transition-all"
      >
        share
      </button>
    </div>
  );
}
