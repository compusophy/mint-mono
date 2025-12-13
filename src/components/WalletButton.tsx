import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

export function WalletButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = () => {
    connect({ connector: farcasterMiniApp() });
  };

  if (isConnecting) {
    return (
      <button
        disabled
        className="flex items-center space-x-2 px-4 py-2 bg-slate-700 text-slate-400 rounded-lg"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Connecting...</span>
      </button>
    );
  }

  if (isConnected && address) {
    const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    
    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-green-500/10 text-green-300 border border-green-500/20">
          <Wallet className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{truncatedAddress}</span>
        </div>
        <button
          onClick={() => disconnect()}
          className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="Disconnect wallet"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
    >
      <Wallet className="w-4 h-4" />
      <span className="text-sm font-medium">Connect</span>
    </button>
  );
}
