interface LogoProps {
  size?: number;
  className?: string;
}

export function CircularOLogo({ size = 32, className = "" }: LogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: "linear-gradient(135deg, #A8123C 0%, #760B28 100%)",
        boxShadow: "0 6px 16px rgba(168, 18, 60, 0.28)",
      }}
    >
      <span
        className="font-black text-white"
        style={{
          fontSize: `${size * 0.62}px`,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        O
      </span>
    </div>
  );
}

interface BrandLogoProps extends LogoProps {
  label?: string;
  labelClassName?: string;
}

export function BrandLogo({
  size = 32,
  className = "",
  label = "Propel",
  labelClassName = "text-crimson",
}: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <CircularOLogo size={size} />
      <span className={`font-black font-display tracking-tight ${labelClassName}`}>
        {label}
      </span>
    </div>
  );
}
