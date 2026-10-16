import { Avatar } from '@mui/material';
import { avatarColor, displayFont, tokens } from '../theme';

interface PlayerAvatarProps {
  id: number;
  name: string;
  size?: number;
}

export function PlayerAvatar({ id, name, size = 44 }: PlayerAvatarProps) {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: avatarColor(id),
        color: tokens.ink,
        border: `3px solid ${tokens.ink}`,
        fontFamily: displayFont,
        fontWeight: 700,
        fontSize: size * 0.45,
        flexShrink: 0,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </Avatar>
  );
}
