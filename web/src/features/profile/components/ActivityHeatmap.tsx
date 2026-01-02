import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface ActivityHeatmapProps {
    data: { date: string | Date; count: number }[];
    year: number;
}

export const ActivityHeatmap = ({ data, year }: ActivityHeatmapProps) => {
    // Generate all days for the year
    const days = useMemo(() => {
        const daysArray = [];
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);

        // Calculate max count for color scaling
        const maxCount = Math.max(...data.map(d => d.count), 0);

        // Create a map for quick lookup
        const dataMap = new Map();
        data.forEach(d => {
            const dateStr = d.date instanceof Date
                ? d.date.toISOString().split('T')[0]
                : d.date;
            dataMap.set(dateStr, d.count);
        });

        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const count = dataMap.get(dateStr) || 0;

            let level = 0;
            if (count > 0) {
                level = maxCount === 0 ? 0 : Math.ceil((count / maxCount) * 4);
            }

            daysArray.push({
                date: new Date(currentDate),
                dateStr,
                count,
                level: level as 0 | 1 | 2 | 3 | 4
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return daysArray;
    }, [data, year]);

    // Group by weeks
    const weeks = useMemo(() => {
        const result = [];
        let currentWeek = [];

        // Pad first week if year doesn't start on Sunday
        const firstDay = days[0].date.getDay(); // 0 is Sunday
        for (let i = 0; i < firstDay; i++) {
            currentWeek.push(null);
        }

        days.forEach(day => {
            currentWeek.push(day);
            if (currentWeek.length === 7) {
                result.push(currentWeek);
                currentWeek = [];
            }
        });

        if (currentWeek.length > 0) {
            // Pad last week
            while (currentWeek.length < 7) {
                currentWeek.push(null);
            }
            result.push(currentWeek);
        }

        return result;
    }, [days]);

    const monthLabels = useMemo(() => {
        const labels = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        let lastMonth = -1;
        weeks.forEach((week, weekIndex) => {
            const firstDay = week.find(d => d !== null);
            if (firstDay && firstDay.date.getMonth() !== lastMonth) {
                labels.push({ label: monthNames[firstDay.date.getMonth()], weekIndex });
                lastMonth = firstDay.date.getMonth();
            }
        });
        return labels;
    }, [weeks]);


    const getColor = (level: number) => {
        switch (level) {
            case 0: return "bg-muted/30 dark:bg-[#30363d]"; // Use high contrast for empty
            case 1: return "bg-[#9be9a8] dark:bg-[#0e4429]";
            case 2: return "bg-[#40c463] dark:bg-[#006d32]";
            case 3: return "bg-[#30a14e] dark:bg-[#26a641]";
            case 4: return "bg-[#216e39] dark:bg-[#39d353]";
            default: return "bg-muted/30 dark:bg-[#30363d]";
        }
    };

    return (
        <div className="text-xs">
            {/* Month Labels */}
            <div className="flex mb-1 relative pl-9" style={{ height: '14px' }}>
                {monthLabels.map((m, i) => {
                    return (
                        <div
                            key={m.label}
                            className="text-muted-foreground w-max absolute"
                            style={{
                                left: `calc(2.25rem + ${m.weekIndex * 20}px)` // 2.25rem = pl-9 (36px), 20px = w-4(16px) + gap-1(4px)
                            }}
                        >
                            {m.label}
                        </div>
                    )
                })}
            </div>

            <div className="flex gap-1 mt-4">
                {/* Day Labels */}
                <div className="flex flex-col gap-1 mr-1 w-8 text-[9px] text-muted-foreground justify-around pb-2">
                    <span>Mon</span>
                    <span>Wed</span>
                    <span>Fri</span>
                </div>

                {weeks.map((week, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                        {week.map((day, dIdx) => (
                            day ? (
                                <div
                                    key={day.dateStr}
                                    className={cn(
                                        "w-4 h-4 rounded-sm transition-colors",
                                        getColor(day.level)
                                    )}
                                    title={`${day.count} submissions on ${day.dateStr}`}
                                />
                            ) : (
                                <div key={`empty-${dIdx}`} className="w-4 h-4" />
                            )
                        ))}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 text-[10px] text-muted-foreground justify-end">
                <span>Less</span>
                <div className={cn("w-4 h-4 rounded-sm", getColor(0))} />
                <div className={cn("w-4 h-4 rounded-sm", getColor(2))} />
                <div className={cn("w-4 h-4 rounded-sm", getColor(4))} />
                <span>More</span>
            </div>
        </div>
    );
};
