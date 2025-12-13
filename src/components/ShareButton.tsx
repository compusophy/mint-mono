import { Share2 } from 'lucide-react';
import { sdk } from '@farcaster/miniapp-sdk';

interface ShareButtonProps {
  tokenId?: number;
}

export function ShareButton({ tokenId }: ShareButtonProps) {
  const handleShare = async () => {
    try {
      // Compose a cast with the minted NFT info
      const text = tokenId 
        ? `Just minted my Generative PFP as an NFT! Token #${tokenId} 🎨✨`
        : `Check out my Generative PFP artwork! 🎨✨`;

      // Use Farcaster SDK to open composer
      // The SDK should handle opening the native composer
      await sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`);
    } catch (err) {
      console.error('Share error:', err);
      // Fallback: copy to clipboard
      const shareText = tokenId 
        ? `Just minted my Generative PFP as an NFT! Token #${tokenId} 🎨✨`
        : `Check out my Generative PFP artwork! 🎨✨`;
      
      try {
        await navigator.clipboard.writeText(shareText);
        alert('Copied to clipboard!');
      } catch {
        console.error('Failed to copy');
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
    >
      <Share2 className="w-5 h-5" />
      <span>Share to Farcaster</span>
    </button>
  );
}
