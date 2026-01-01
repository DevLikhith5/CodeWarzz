import React from "react";
interface IconProps {
  className?: string;
  size?: number;
}

// Primary gradient: Orange theme (matches --primary)
const primaryGradient = {
  start: "hsl(20, 90%, 48%)",
  end: "hsl(27, 95%, 60%)"
};

// Accent gradient: Amber/Gold (matches --accent)
const accentGradient = {
  start: "hsl(38, 92%, 50%)",
  end: "hsl(43, 96%, 56%)"
};

// Secondary gradient: Warm neutral
const secondaryGradient = {
  start: "hsl(25, 95%, 53%)",
  end: "hsl(30, 97%, 58%)"
};
export const CodeIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="codeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={primaryGradient.start} />
        <stop offset="100%" stopColor={primaryGradient.end} />
      </linearGradient>
    </defs>
    <path d="M8 6L3 12L8 18" stroke="url(#codeGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 6L21 12L16 18" stroke="url(#codeGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 4L10 20" stroke="url(#codeGrad)" strokeWidth="2" strokeLinecap="round" />
  </svg>;
export const TrophyIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="trophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={accentGradient.start} />
        <stop offset="100%" stopColor={accentGradient.end} />
      </linearGradient>
    </defs>
    <path d="M6 9H4C3 9 2 8 2 7V5C2 4 3 3 4 3H6M18 9H20C21 9 22 8 22 7V5C22 4 21 3 20 3H18" stroke="url(#trophyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15C15.866 15 19 11.866 19 8V3H5V8C5 11.866 8.13401 15 12 15Z" stroke="url(#trophyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15V19M8 21H16M9 19H15" stroke="url(#trophyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
export const ChartIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="chartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={secondaryGradient.start} />
        <stop offset="100%" stopColor={secondaryGradient.end} />
      </linearGradient>
    </defs>
    <path d="M3 3V21H21" stroke="url(#chartGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 14L11 10L15 14L21 8" stroke="url(#chartGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="21" cy="8" r="2" fill="url(#chartGrad)" />
    <circle cx="15" cy="14" r="2" fill="url(#chartGrad)" />
    <circle cx="11" cy="10" r="2" fill="url(#chartGrad)" />
    <circle cx="7" cy="14" r="2" fill="url(#chartGrad)" />
  </svg>;
export const BrainIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={primaryGradient.start} />
        <stop offset="100%" stopColor={primaryGradient.end} />
      </linearGradient>
    </defs>
    <path d="M12 4C10.8954 4 10 5.11929 10 6.5C10 5.11929 9.10457 4 8 4C6.34315 4 5 5.79086 5 8C5 10.5 7 13 12 16C17 13 19 10.5 19 8C19 5.79086 17.6569 4 16 4C14.8954 4 14 5.11929 14 6.5C14 5.11929 13.1046 4 12 4Z" stroke="url(#brainGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 16V20M8 18H16" stroke="url(#brainGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 10C3.5 10.5 3 12 3 13.5C3 15 4 16 5 16M19 10C20.5 10.5 21 12 21 13.5C21 15 20 16 19 16" stroke="url(#brainGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
export const UsersIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="usersGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={accentGradient.start} />
        <stop offset="100%" stopColor={accentGradient.end} />
      </linearGradient>
    </defs>
    <circle cx="9" cy="7" r="3" stroke="url(#usersGrad)" strokeWidth="2" />
    <path d="M3 21V18C3 15.7909 4.79086 14 7 14H11C13.2091 14 15 15.7909 15 18V21" stroke="url(#usersGrad)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="17" cy="8" r="2.5" stroke="url(#usersGrad)" strokeWidth="2" />
    <path d="M17 13C19.2091 13 21 14.7909 21 17V21" stroke="url(#usersGrad)" strokeWidth="2" strokeLinecap="round" />
  </svg>;
export const LightningIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="lightningGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={accentGradient.start} />
        <stop offset="100%" stopColor={secondaryGradient.end} />
      </linearGradient>
    </defs>
    <path d="M13 2L4.09347 12.6879C3.74465 13.1064 3.57024 13.3157 3.56758 13.4925C3.56526 13.6461 3.63372 13.7923 3.75324 13.8889C3.89073 14 4.16316 14 4.70802 14H12L11 22L19.9065 11.3121C20.2554 10.8936 20.4298 10.6843 20.4324 10.5075C20.4347 10.3539 20.3663 10.2077 20.2468 10.1111C20.1093 10 19.8368 10 19.292 10H12L13 2Z" stroke="url(#lightningGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
export const TargetIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="targetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={primaryGradient.start} />
        <stop offset="100%" stopColor={primaryGradient.end} />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" stroke="url(#targetGrad)" strokeWidth="2" />
    <circle cx="12" cy="12" r="6" stroke="url(#targetGrad)" strokeWidth="2" />
    <circle cx="12" cy="12" r="2" fill="url(#targetGrad)" />
  </svg>
);
export const ShieldIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={secondaryGradient.start} />
        <stop offset="100%" stopColor={secondaryGradient.end} />
      </linearGradient>
    </defs>
    <path d="M12 3L4 7V11C4 15.97 7.06 20.66 12 22C16.94 20.66 20 15.97 20 11V7L12 3Z" stroke="url(#shieldGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12L11 14L15 10" stroke="url(#shieldGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
export const RocketIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="rocketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={primaryGradient.start} />
        <stop offset="100%" stopColor={primaryGradient.end} />
      </linearGradient>
    </defs>
    <path d="M4.5 16.5C3 18 3 21 3 21C3 21 6 21 7.5 19.5C8.32843 18.6716 8.32843 17.3284 7.5 16.5C6.67157 15.6716 5.32843 15.6716 4.5 16.5Z" stroke="url(#rocketGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14.5 5.5L11 9L15 13L18.5 9.5C21.6683 6.33168 21.6683 2.33168 18.5 5.5C15.3317 8.66832 11.3317 8.66832 14.5 5.5Z" stroke="url(#rocketGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 9L4 12L5 15L9 14L11 9Z" stroke="url(#rocketGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 13L12 20L9 19L10 15L15 13Z" stroke="url(#rocketGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
export const StarIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={accentGradient.start} />
        <stop offset="100%" stopColor={accentGradient.end} />
      </linearGradient>
    </defs>
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="url(#starGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="url(#starGrad)" fillOpacity="0.2" />
  </svg>;
export const TerminalIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="terminalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={primaryGradient.start} />
        <stop offset="100%" stopColor={primaryGradient.end} />
      </linearGradient>
    </defs>
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="url(#terminalGrad)" strokeWidth="2" />
    <path d="M6 9L9 12L6 15" stroke="url(#terminalGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15H18" stroke="url(#terminalGrad)" strokeWidth="2" strokeLinecap="round" />
  </svg>;
export const ClockIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="clockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={secondaryGradient.start} />
        <stop offset="100%" stopColor={secondaryGradient.end} />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" stroke="url(#clockGrad)" strokeWidth="2" />
    <path d="M12 6V12L16 14" stroke="url(#clockGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
export const ArrowRightIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
export const CheckIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
export const MenuIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
export const CloseIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
export const GlobeIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="globeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={primaryGradient.start} />
        <stop offset="100%" stopColor={primaryGradient.end} />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" stroke="url(#globeGrad)" strokeWidth="2" />
    <path d="M2 12H22" stroke="url(#globeGrad)" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 2C14.5 4.5 16 8 16 12C16 16 14.5 19.5 12 22C9.5 19.5 8 16 8 12C8 8 9.5 4.5 12 2Z" stroke="url(#globeGrad)" strokeWidth="2" />
  </svg>;
export const DatabaseIcon: React.FC<IconProps> = ({
  className,
  size = 24
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="dbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={accentGradient.start} />
        <stop offset="100%" stopColor={accentGradient.end} />
      </linearGradient>
    </defs>
    <ellipse cx="12" cy="5" rx="9" ry="3" stroke="url(#dbGrad)" strokeWidth="2" />
    <path d="M3 5V19C3 20.6569 7.02944 22 12 22C16.9706 22 21 20.6569 21 19V5" stroke="url(#dbGrad)" strokeWidth="2" />
    <path d="M3 12C3 13.6569 7.02944 15 12 15C16.9706 15 21 13.6569 21 12" stroke="url(#dbGrad)" strokeWidth="2" />
  </svg>;
