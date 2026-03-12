interface LogoProps {
  size?: number;
  className?: string;
}

export function CircularOLogo({ size = 32, className = "" }: LogoProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: "#880E4F",
        boxShadow: "0 4px 6px rgba(136, 14, 79, 0.2)",
      }}
    >
      <span
        className="font-black text-white"
        style={{
          fontSize: `${size * 0.65}px`,
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
  labelClassName = "text-brand-burgundy",
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
