interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  accentColor?: string;
}

export const StatCard = ({ label, value, subtitle, accentColor }: StatCardProps) => {
  return (
    <div className="relative group">
      {/* Glow effect */}
      {accentColor && (
        <div 
          className="absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-500"
          style={{ background: accentColor }}
        />
      )}
      
      <div className="relative bg-card/80 backdrop-blur-xl border border-border/30 rounded-2xl p-5 transition-all duration-300 hover:border-border/60 overflow-hidden">
        {/* Subtle gradient orb */}
        {accentColor && (
          <div 
            className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10 blur-2xl"
            style={{ background: accentColor }}
          />
        )}
        
        <div className="relative z-10">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em] font-medium">{label}</p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span 
              className="text-4xl font-bold tracking-tighter"
              style={{ color: accentColor || 'hsl(var(--foreground))' }}
            >
              {value}
            </span>
            {subtitle && (
              <span className="text-[10px] text-muted-foreground/50 font-medium">{subtitle}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
