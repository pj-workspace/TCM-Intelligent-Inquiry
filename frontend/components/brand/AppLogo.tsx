import Image from "next/image";

type AppLogoProps = {
  /** 显示边长（像素），与 `className` 中的尺寸可同时用于布局 */
  size?: number;
  className?: string;
  priority?: boolean;
};

export function AppLogo({ size = 32, className = "", priority = false }: AppLogoProps) {
  return (
    <Image
      src="/tcm_logo.png"
      alt="中医智询"
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
