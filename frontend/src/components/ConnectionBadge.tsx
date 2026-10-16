import { Chip } from '@mui/material';
import WifiRoundedIcon from '@mui/icons-material/WifiRounded';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { useGame } from '../game/GameContext';
import { tokens } from '../theme';

export function ConnectionBadge() {
  const { state } = useGame();

  switch (state.connection) {
    case 'open':
      return (
        <Chip
          size="small"
          icon={<WifiRoundedIcon />}
          label="Live"
          sx={{ bgcolor: tokens.mintSoft, '& .MuiChip-icon': { color: tokens.ink } }}
        />
      );
    case 'closed':
      return (
        <Chip
          size="small"
          icon={<WifiOffRoundedIcon />}
          label="Offline"
          sx={{ bgcolor: tokens.coralSoft, '& .MuiChip-icon': { color: tokens.ink } }}
        />
      );
    default:
      return (
        <Chip
          size="small"
          icon={<SyncRoundedIcon sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />}
          label={state.connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
          sx={{ bgcolor: tokens.sunSoft, '& .MuiChip-icon': { color: tokens.ink } }}
        />
      );
  }
}
