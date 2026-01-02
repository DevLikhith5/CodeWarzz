interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  accentColor?: string;
}

export const StatCard = ({ label, value, subtitle, accentColor }: StatCardProps) => {
  return (
    <div className="min-w-[120px]">
      <p className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em] font-medium">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-1">
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
  );
};
