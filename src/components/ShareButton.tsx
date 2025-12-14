import { sdk } from '@farcaster/miniapp-sdk';

interface ShareButtonProps {
  tokenId: number;
  imageUrl: string; // IPFS gateway URL of the artwork
}

export function ShareButton({ tokenId, imageUrl }: ShareButtonProps) {
  const shareUrl = `https://compusophlets.vercel.app/?token=${tokenId}`;

  const handleShare = async () => {
    try {
      await sdk.actions.composeCast({
        text: 'compusophlet collected!',
        embeds: [imageUrl, shareUrl], // Image first, then link
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-2" style={{ width: '61.803%' }}>
      <button
        onClick={handleShare}
        className="w-full flex items-center justify-center py-4 rounded-xl font-semibold text-lg transition-all bg-white text-black hover:bg-slate-200"
      >
        share
      </button>
    </div>
  );
}
