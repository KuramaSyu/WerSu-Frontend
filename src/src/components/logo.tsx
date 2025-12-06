import { useThemeStore } from '../zustand/useThemeStore';

interface LogoSvgComponentProps {
  style?: React.CSSProperties;
  monochrome?: boolean; // add monochrome flag
}

export const Logo: React.FC<LogoSvgComponentProps> = ({
  style,
  monochrome = false, // default to false
}) => {
  const { theme } = useThemeStore(); // get current theme

  // If monochrome, apply greyscale and color filter
  const filterStyle = monochrome
    ? {
        filter: `grayscale(1) brightness(1.1) drop-shadow(0 0 0 ${theme.palette.primary.main})`,
      }
    : {};

  return (
    <img
      src="/assets/GoToHell-Icon.svg"
      alt="GoToHell Logo"
      style={{
        width: '100%',
        height: '100%',
        ...(style || {}),
        ...filterStyle,
      }}
    />
  );
};
