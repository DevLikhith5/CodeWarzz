import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import api from "@/lib/api";
import { Calendar, Clock, Trophy } from "lucide-react";

const CreateContest = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        startTime: "",
        endTime: "",
        problems: ""
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {

            const payload = {
                title: formData.title,
                description: formData.description,
                startTime: new Date(formData.startTime).toISOString(),
                endTime: new Date(formData.endTime).toISOString(),
            };

            const response = await api.post("/contests", payload);
            toast.success("Contest created successfully!");

            const contestId = response.data?.data?.id;

            if (contestId) {
                // Add problems if any
                if (formData.problems.trim()) {
                    const problemIds = formData.problems.split(/[\n,]+/).map(id => id.trim()).filter(id => id.length > 0);
                    if (problemIds.length > 0) {
                        try {
                            await Promise.all(problemIds.map(problemId =>
                                api.post("/contests/add-problem", { contestId, problemId })
                            ));
                            toast.success(`Added ${problemIds.length} problems to contest`);
                        } catch (addErr) {
                            console.error("Failed to add some problems", addErr);
                            toast.error("Contest created, but failed to add some problems. Please check IDs.");
                        }
                    }
                }
                navigate(`/contest/${contestId}`);
            } else {
                navigate("/contests");
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to create contest");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <AppNavbar />
            <main className="container mx-auto px-4 py-24 max-w-2xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">Create Contest</h1>
                    <p className="text-muted-foreground mt-1">Schedule a new challenge for the community.</p>
                </div>

                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Contest Details</CardTitle>
                        <CardDescription>
                            Configure the basic settings for the contest.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Contest Title
                                </label>
                                <Input
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    placeholder="e.g. Weekly Contest 101"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Description
                                </label>
                                <Textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Brief description of the contest rules and topics..."
                                    className="min-h-[120px]"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-muted-foreground" />
                                        Start Time
                                    </label>
                                    <Input
                                        type="datetime-local"
                                        name="startTime"
                                        value={formData.startTime}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-muted-foreground" />
                                        End Time
                                    </label>
                                    <Input
                                        type="datetime-local"
                                        name="endTime"
                                        value={formData.endTime}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Problem IDs (Optional)
                                </label>
                                <Textarea
                                    name="problems"
                                    value={formData.problems}
                                    onChange={handleInputChange}
                                    placeholder="Enter problem UUIDs separated by commas or newlines..."
                                    className="min-h-[80px] font-mono text-xs"
                                />
                                <p className="text-xs text-muted-foreground">You can add more problems later from the contest detail page.</p>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <Button type="button" variant="ghost" onClick={() => navigate("/contests")}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Creating..." : (
                                        <>
                                            <Trophy className="w-4 h-4 mr-2" />
                                            Create Contest
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default CreateContest;
